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
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const identity = identities.find((item: any) => item?.provider === "discord");
  const data = identity?.identity_data || {};
  const metadata = user?.user_metadata || {};
  const values = [
    identity?.id,
    data.id,
    data.user_id,
    data.provider_id,
    data.sub,
    metadata.provider_id,
    metadata.user_id,
    metadata.discord_id,
    metadata.sub,
  ];
  return values.map((value: any) => String(value || "")).find((value: string) => /^\d{17,20}$/.test(value)) || "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
      .select("id,server_id,discord_user_id,discord_username,discord_global_name,discord_avatar,status,expires_at,rejection_reason,apply_error,applied_at")
      .eq("code_hash", codeHash).maybeSingle();
    if (error) return json({ error: "인증 요청을 확인하지 못했어요." }, 500);
    if (!row) return json({ error: "인증 링크를 찾을 수 없어요. Discord에서 새 인증 링크를 받아 주세요." }, 404);
    if (new Date(row.expires_at).getTime() <= Date.now() && ["issued", "submitted"].includes(row.status)) {
      await db.from("discord_verification_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", row.id);
      return json({ error: "인증 링크가 만료됐어요. Discord에서 다시 인증을 시작해 주세요.", status: "expired" }, 410);
    }
    if (row.discord_user_id !== currentDiscordId) {
      return json({ error: "이 링크를 생성한 Discord 계정으로 로그인해 주세요.", mismatch: true }, 403);
    }

    const { data: settings, error: settingsError } = await db.from("discord_verification_settings")
      .select("enabled,role_id").eq("server_id", row.server_id).maybeSingle();
    if (settingsError) return json({ error: "서버의 인증 설정을 확인하지 못했어요." }, 500);
    const featureEnabled = settings?.enabled === true && !!settings?.role_id;

    if (action === "submit") {
      if (row.status === "approved") return json({ ok: true, already_approved: true, status: "approved" });
      if (row.status === "rejected") return json({ ok: true, status: "rejected", rejection_reason: row.rejection_reason || "계정 검사 기준을 통과하지 못했어요." });
      if (row.status === "expired" || row.status === "failed") return json({ error: row.apply_error || "이 인증 요청은 더 이상 사용할 수 없어요.", status: row.status }, 410);
      if (!featureEnabled) return json({ error: "이 서버의 인증 기능이 꺼져 있거나 인증 역할이 설정되지 않았어요.", feature_enabled: false }, 409);
      if (row.status === "issued") {
        const now = new Date().toISOString();
        const { data: changed, error: updateError } = await db.from("discord_verification_requests")
          .update({ status: "submitted", submitted_at: now, updated_at: now })
          .eq("id", row.id).eq("status", "issued").select("id").maybeSingle();
        if (updateError) return json({ error: "인증 요청을 등록하지 못했어요." }, 500);
        if (!changed) {
          const { data: latest, error: latestError } = await db.from("discord_verification_requests")
            .select("status,rejection_reason,apply_error,applied_at").eq("id", row.id).maybeSingle();
          if (latestError || !latest) return json({ error: "인증 상태를 다시 확인하지 못했어요." }, 500);
          row.status = latest.status;
          row.rejection_reason = latest.rejection_reason;
          row.apply_error = latest.apply_error;
          row.applied_at = latest.applied_at;
        } else {
          row.status = "submitted";
        }
      }
    }

    const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", row.server_id).maybeSingle();
    return json({
      ok: true,
      server_id: row.server_id,
      server_name: server?.server_name || "Discord 서버",
      discord_user_id: row.discord_user_id,
      username: row.discord_username,
      global_name: row.discord_global_name || row.discord_username,
      avatar: row.discord_avatar,
      status: row.status,
      feature_enabled: featureEnabled,
      rejection_reason: row.rejection_reason || null,
      apply_error: row.apply_error || null,
      applied_at: row.applied_at || null,
      already_approved: row.status === "approved",
    });
  }

  const serverId = String(body.server_id || "");
  if (!/^\d{17,20}$/.test(serverId)) return json({ error: "서버 정보가 올바르지 않아요." }, 400);
  if (!await isServerAdmin(db, user, serverId)) return json({ error: "이 Discord 서버의 관리자 권한을 확인할 수 없어요. 서버 목록을 새로고침한 뒤 다시 시도해 주세요." }, 403);

  if (action === "settings_get") {
    const { data, error } = await db.from("discord_verification_settings")
      .select("server_id,enabled,role_id,nickname_template,updated_at").eq("server_id", serverId).maybeSingle();
    if (error) return json({ error: "인증 설정을 불러오지 못했어요." }, 500);
    return json({ ok: true, settings: data || { server_id: serverId, enabled: false, role_id: "", nickname_template: "{global_name}" } });
  }

  if (action === "settings_save") {
    const roleId = String(body.role_id || "").trim();
    const nicknameTemplate = String(body.nickname_template || "{global_name}").trim();
    const enabled = body.enabled === true;
    if (enabled && !/^\d{17,20}$/.test(roleId)) return json({ error: "인증 기능을 켜려면 인증 역할 ID를 입력해 주세요." }, 400);
    if (roleId && !/^\d{17,20}$/.test(roleId)) return json({ error: "역할 ID를 숫자로 입력해 주세요." }, 400);
    if (!nicknameTemplate || nicknameTemplate.length > 32) return json({ error: "닉네임 형식은 1~32자로 입력해 주세요." }, 400);
    const { error } = await db.from("discord_verification_settings").upsert({
      server_id: serverId, enabled, role_id: roleId || null, nickname_template: nicknameTemplate,
      updated_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "server_id" });
    if (error) return json({ error: "인증 설정을 저장하지 못했어요." }, 500);
    return json({ ok: true, settings: { server_id: serverId, enabled, role_id: roleId || null, nickname_template: nicknameTemplate } });
  }

  return json({ error: "지원하지 않는 요청이에요." }, 400);
});
