import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tendsite.shop",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function discordId(user: any): string {
  const m = user?.user_metadata || {};
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const values = [
    m.provider_id, m.user_id, m.discord_id, m.sub,
    ...identities.flatMap((i: any) => {
      const d = i?.identity_data || {};
      return [i?.id, d?.id, d?.user_id, d?.provider_id, d?.sub];
    }),
  ];
  return values.map((v: any) => String(v || "")).find((v: string) => /^\d{17,20}$/.test(v)) || "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isServerAdmin(db: any, user: any, serverId: string) {
  const { data, error } = await db.from("discord_user_guilds")
    .select("is_owner,permissions,can_manage")
    .eq("user_id", user.id).eq("guild_id", serverId).maybeSingle();
  if (error || !data) return false;
  if (data.is_owner === true) return true;
  try { return (BigInt(data.permissions || "0") & 8n) === 8n; } catch { return false; }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !serviceKey || !token) return json({ error: "로그인이 필요해요." }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "로그인 정보를 확인할 수 없어요." }, 401);
  const user = auth.user;
  const currentDiscordId = discordId(user);
  if (!currentDiscordId) return json({ error: "Discord 계정 정보를 확인할 수 없어요. Discord로 다시 로그인해 주세요." }, 403);

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return json({ error: "잘못된 요청이에요." }, 400); }
  const action = String(body.action || "");

  if (action === "inspect" || action === "submit") {
    const rawCode = String(body.code || "");
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(rawCode)) return json({ error: "인증 링크가 올바르지 않아요." }, 400);
    const codeHash = await sha256(rawCode);
    const { data: row, error } = await db.from("discord_verification_requests")
      .select("id,server_id,discord_user_id,discord_username,discord_global_name,discord_avatar,status,expires_at")
      .eq("code_hash", codeHash).maybeSingle();
    if (error) return json({ error: "인증 요청을 확인하지 못했어요." }, 500);
    if (!row) return json({ error: "인증 링크를 찾을 수 없어요. 새 링크를 요청해 주세요." }, 404);
    if (new Date(row.expires_at).getTime() <= Date.now() && ["issued","submitted"].includes(row.status)) {
      await db.from("discord_verification_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", row.id);
      return json({ error: "인증 링크가 만료됐어요. Discord에서 다시 인증을 시작해 주세요." }, 410);
    }
    if (row.discord_user_id !== currentDiscordId) {
      return json({ error: "이 링크는 다른 Discord 계정에서 생성됐어요. 링크를 생성한 Discord 계정으로 로그인해 주세요.", mismatch: true }, 403);
    }
    if (row.status === "approved") return json({ ok: true, already_approved: true, server_id: row.server_id });
    if (row.status === "rejected") return json({ error: row.rejection_reason || "관리자가 인증 요청을 거절했어요.", rejected: true }, 409);
    if (row.status === "expired" || row.status === "failed") return json({ error: "사용할 수 없는 인증 요청이에요." }, 410);
    if (action === "submit" && row.status === "issued") {
      const { error: updateError } = await db.from("discord_verification_requests")
        .update({ status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "issued");
      if (updateError) return json({ error: "인증 요청을 등록하지 못했어요." }, 500);
    }
    const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", row.server_id).maybeSingle();
    return json({
      ok: true,
      submitted: action === "submit" || row.status === "submitted",
      server_id: row.server_id,
      server_name: server?.server_name || "Discord 서버",
      discord_user_id: row.discord_user_id,
      username: row.discord_username,
      global_name: row.discord_global_name || row.discord_username,
      avatar: row.discord_avatar,
      status: action === "submit" ? "submitted" : row.status,
    });
  }

  const serverId = String(body.server_id || "");
  if (!/^\d{17,20}$/.test(serverId)) return json({ error: "서버 정보가 올바르지 않아요." }, 400);
  if (!await isServerAdmin(db, user, serverId)) return json({ error: "이 Discord 서버의 관리자 권한을 확인할 수 없어요. 서버 목록을 새로고침한 뒤 다시 시도해 주세요." }, 403);

  if (action === "settings_get") {
    const { data, error } = await db.from("discord_verification_settings").select("*").eq("server_id", serverId).maybeSingle();
    if (error) return json({ error: "인증 설정을 불러오지 못했어요." }, 500);
    return json({ ok: true, settings: data || { server_id: serverId, enabled: true, role_id: "", nickname_template: "{global_name}" } });
  }

  if (action === "settings_save") {
    const roleId = String(body.role_id || "").trim();
    const nicknameTemplate = String(body.nickname_template || "{global_name}").trim();
    const enabled = body.enabled !== false;
    if (roleId && !/^\d{17,20}$/.test(roleId)) return json({ error: "역할 ID를 숫자로 입력해 주세요." }, 400);
    if (!nicknameTemplate || nicknameTemplate.length > 32) return json({ error: "닉네임 형식은 1~32자로 입력해 주세요." }, 400);
    const { error } = await db.from("discord_verification_settings").upsert({
      server_id: serverId, enabled, role_id: roleId || null, nickname_template: nicknameTemplate,
      updated_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "server_id" });
    if (error) return json({ error: "인증 설정을 저장하지 못했어요." }, 500);
    return json({ ok: true });
  }

  if (action === "list") {
    const { data, error } = await db.from("discord_verification_requests")
      .select("id,discord_user_id,discord_username,discord_global_name,discord_avatar,status,requested_at,submitted_at")
      .eq("server_id", serverId).eq("status", "submitted")
      .order("submitted_at", { ascending: true }).limit(100);
    if (error) return json({ error: "인증 대기 목록을 불러오지 못했어요." }, 500);
    return json({ ok: true, requests: data || [] });
  }

  if (action === "review") {
    const requestId = String(body.request_id || "");
    const decision = String(body.decision || "");
    const reason = String(body.reason || "").trim().slice(0, 500);
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["approve","reject"].includes(decision)) return json({ error: "처리 정보가 올바르지 않아요." }, 400);
    const { data: row, error: rowError } = await db.from("discord_verification_requests")
      .select("id,server_id,discord_user_id,discord_username,discord_global_name,status")
      .eq("id", requestId).eq("server_id", serverId).eq("status", "submitted").maybeSingle();
    if (rowError) return json({ error: "인증 요청을 확인하지 못했어요." }, 500);
    if (!row) return json({ error: "이미 처리됐거나 존재하지 않는 인증 요청이에요." }, 404);

    if (decision === "reject") {
      const { error } = await db.from("discord_verification_requests").update({
        status: "rejected", rejection_reason: reason || "서버 관리자가 인증 요청을 거절했어요.",
        reviewed_at: new Date().toISOString(), reviewed_by: user.id, updated_at: new Date().toISOString(),
      }).eq("id", requestId).eq("status", "submitted");
      if (error) return json({ error: "거절 처리에 실패했어요." }, 500);
      return json({ ok: true, decision });
    }

    const { data: settings, error: settingsError } = await db.from("discord_verification_settings")
      .select("enabled,role_id,nickname_template").eq("server_id", serverId).maybeSingle();
    if (settingsError) return json({ error: "인증 설정을 확인하지 못했어요." }, 500);
    if (!settings?.enabled) return json({ error: "이 서버의 디스코드 계정 인증 기능이 꺼져 있어요." }, 409);
    if (!settings.role_id) return json({ error: "인증 완료 시 지급할 역할 ID를 먼저 설정해 주세요." }, 409);

    const { data: changed, error: updateError } = await db.from("discord_verification_requests").update({
      status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, updated_at: new Date().toISOString(),
    }).eq("id", requestId).eq("status", "submitted").select("id").maybeSingle();
    if (updateError || !changed) return json({ error: "승인 처리에 실패했어요. 이미 처리된 요청인지 확인해 주세요." }, 409);

    const { data: job, error: jobError } = await db.from("bot_jobs").insert({
      server_id: serverId,
      job_type: "discord_verification.apply",
      payload: {
        request_id: requestId,
        discord_user_id: row.discord_user_id,
        role_id: settings.role_id,
        nickname_template: settings.nickname_template,
        username: row.discord_username,
        global_name: row.discord_global_name || row.discord_username,
      },
      status: "pending",
    }).select("id").single();
    if (jobError) {
      await db.from("discord_verification_requests").update({
        status: "submitted", reviewed_at: null, reviewed_by: null, updated_at: new Date().toISOString(),
      }).eq("id", requestId).eq("status", "approved");
      return json({ error: "승인 작업을 봇에 전달하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
    }
    await db.from("discord_verification_requests").update({ apply_job_id: job.id, updated_at: new Date().toISOString() }).eq("id", requestId);
    return json({ ok: true, decision, job_id: job.id });
  }

  return json({ error: "지원하지 않는 요청이에요." }, 400);
});
