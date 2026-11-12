import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tendsite.shop",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getDiscordIdentity(user: any) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const identity = identities.find((item: any) => item?.provider === "discord");
  const data = identity?.identity_data || {};
  const id = [data.provider_id, data.sub, data.user_id, data.id]
    .map((value: any) => String(value || ""))
    .find((value: string) => /^\d{17,20}$/.test(value)) || "";
  return {
    id,
    username: String(data.preferred_username || data.username || data.name || user?.email?.split("@")[0] || id).slice(0, 100),
    globalName: String(data.full_name || data.global_name || data.name || "").slice(0, 100),
    avatar: String(data.avatar_url || data.picture || "").slice(0, 500) || null,
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isServerAdmin(db: any, userId: string, serverId: string) {
  const { data, error } = await db.from("discord_user_guilds")
    .select("is_owner,permissions").eq("user_id", userId).eq("guild_id", serverId).maybeSingle();
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
  if (!url || !serviceKey || !token) return json({ error: "Discord 로그인 후 다시 시도해 주세요." }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요." }, 401);
  const user = auth.user;
  const discord = getDiscordIdentity(user);
  if (!discord.id) return json({ error: "Discord 계정 연결을 확인할 수 없어요. Discord 계정으로 로그인해 주세요." }, 403);

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return json({ error: "요청 형식이 올바르지 않아요." }, 400); }
  const action = String(body.action || "");

  if (action === "request_create") {
    const serverId = String(body.server_id || "");
    if (!/^\d{17,20}$/.test(serverId)) return json({ error: "인증 서버 정보가 올바르지 않아요." }, 400);

    const { data: settings, error: settingsError } = await db.from("discord_verification_settings")
      .select("enabled,role_id").eq("server_id", serverId).maybeSingle();
    if (settingsError) return json({ error: "서버 인증 설정을 확인하지 못했어요." }, 500);
    if (settings?.enabled !== true || !/^\d{17,20}$/.test(String(settings?.role_id || ""))) {
      return json({ error: "이 서버는 인증 기능이 꺼져 있거나 인증 역할이 설정되지 않았어요." }, 409);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { data: previousRows, error: previousError } = await db.from("discord_verification_requests")
      .select("id,status,expires_at,rejection_reason,apply_error,applied_at,requested_at")
      .eq("server_id", serverId).eq("discord_user_id", discord.id)
      .in("status", ["pending", "processing", "approved"])
      .order("requested_at", { ascending: false }).limit(5);
    if (previousError) return json({ error: "기존 인증 요청을 확인하지 못했어요." }, 500);

    const active = (previousRows || []).find((row: any) =>
      row.status === "processing" ||
      (row.status === "pending" && new Date(row.expires_at).getTime() > now.getTime()) ||
      (row.status === "approved" && !!row.applied_at)
    );
    if (active) {
      const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", serverId).maybeSingle();
      return json({
        ok: true, request_id: active.id, status: active.status, already_exists: true,
        server_id: serverId, server_name: server?.server_name || "Discord 서버",
        applied_at: active.applied_at || null,
      });
    }

    const { error: expireError } = await db.from("discord_verification_requests")
      .update({ status: "expired", updated_at: nowIso })
      .eq("server_id", serverId).eq("discord_user_id", discord.id).eq("status", "pending").lte("expires_at", nowIso);
    if (expireError) return json({ error: "만료된 인증 요청을 정리하지 못했어요." }, 500);

    const codeHash = await sha256(randomHex(32));
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const { data: created, error: insertError } = await db.from("discord_verification_requests")
      .insert({
        server_id: serverId,
        discord_user_id: discord.id,
        discord_username: discord.username || discord.id,
        discord_global_name: discord.globalName || null,
        discord_avatar: discord.avatar,
        code_hash: codeHash,
        status: "pending",
        expires_at: expiresAt,
        requested_at: nowIso,
        submitted_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,status,expires_at")
      .single();
    if (insertError || !created) return json({ error: "인증 요청을 등록하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);

    const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", serverId).maybeSingle();
    return json({
      ok: true, request_id: created.id, status: created.status,
      server_id: serverId, server_name: server?.server_name || "Discord 서버",
      expires_at: created.expires_at,
    });
  }

  if (action === "request_status") {
    const requestId = String(body.request_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return json({ error: "인증 요청 정보가 올바르지 않아요." }, 400);
    }
    const { data: row, error } = await db.from("discord_verification_requests")
      .select("id,server_id,discord_user_id,discord_username,discord_global_name,discord_avatar,status,expires_at,rejection_reason,apply_error,applied_at,requested_at")
      .eq("id", requestId).eq("discord_user_id", discord.id).maybeSingle();
    if (error) return json({ error: "인증 상태를 불러오지 못했어요." }, 500);
    if (!row) return json({ error: "이 Discord 계정의 인증 요청을 찾을 수 없어요." }, 404);

    if (row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()) {
      await db.from("discord_verification_requests").update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "pending");
      row.status = "expired";
    }
    const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", row.server_id).maybeSingle();
    return json({
      ok: true, request_id: row.id, server_id: row.server_id,
      server_name: server?.server_name || "Discord 서버",
      discord_user_id: row.discord_user_id, username: row.discord_username,
      global_name: row.discord_global_name || row.discord_username, avatar: row.discord_avatar,
      status: row.status, rejection_reason: row.rejection_reason || null,
      apply_error: row.apply_error || null, applied_at: row.applied_at || null,
      expires_at: row.expires_at,
    });
  }

  const serverId = String(body.server_id || "");
  if (!/^\d{17,20}$/.test(serverId)) return json({ error: "서버 정보가 올바르지 않아요." }, 400);

  if (action === "settings_public") {
    const { data: settings, error: settingsError } = await db.from("discord_verification_settings")
      .select("enabled,role_id").eq("server_id", serverId).maybeSingle();
    if (settingsError) return json({ error: "서버 인증 설정을 확인하지 못했어요." }, 500);
    const { data: server } = await db.from("managed_servers").select("server_name").eq("server_id", serverId).maybeSingle();
    return json({
      ok: true,
      feature_enabled: settings?.enabled === true && /^\d{17,20}$/.test(String(settings?.role_id || "")),
      server_name: server?.server_name || "Discord 서버",
    });
  }

  if (!await isServerAdmin(db, user.id, serverId)) {
    return json({ error: "이 Discord 서버의 관리자 권한을 확인할 수 없어요. 서버 목록을 새로고침한 뒤 다시 시도해 주세요." }, 403);
  }

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
