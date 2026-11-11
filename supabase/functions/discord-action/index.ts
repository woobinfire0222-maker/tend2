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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchAndCacheGuilds(db: any, userId: string, providerToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  if (!response.ok) throw new Error("Discord guild lookup failed: " + response.status);
  const payload = await response.json();
  const manageable = (Array.isArray(payload) ? payload : []).filter((g: any) => {
    if (g.owner === true) return true;
    try { return (BigInt(g.permissions || "0") & 8n) === 8n; } catch { return false; }
  });
  const rows = manageable.map((g: any) => ({
    user_id: userId,
    guild_id: String(g.id),
    guild_name: String(g.name || "Discord 서버").slice(0, 100),
    is_owner: g.owner === true,
    permissions: String(g.permissions || "0"),
    can_manage: true,
    synced_at: new Date().toISOString(),
  }));
  const { error: deleteError } = await db.from("discord_user_guilds").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  if (rows.length) {
    const { error: insertError } = await db.from("discord_user_guilds").insert(rows);
    if (insertError) throw insertError;
  }
  return manageable;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = request.headers.get("Authorization") || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !serviceKey) return json({ error: "Backend configuration is incomplete." }, 503);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const action = String(body.action || "");
  const serverId = String(body.server_id || "");

  if (action === "cache_guilds") {
    const providerToken = String(body.provider_token || "");
    if (!providerToken) return json({ error: "Discord 권한 확인 토큰이 없어요." }, 400);
    try {
      const guilds = await fetchAndCacheGuilds(db, authData.user.id, providerToken);
      return json({ ok: true, cached: guilds.length });
    } catch (error) {
      console.error("Discord guild cache failed:", error);
      return json({ error: "Discord 서버 권한 정보를 저장하지 못했어요." }, 502);
    }
  }

  if (!/^\d{5,30}$/.test(serverId)) return json({ error: "Invalid Discord server ID." }, 400);

  if (action === "cancel_free") {
    const { data: entitlement, error: entitlementReadError } = await db.from("free_entitlements")
      .select("id,user_id,status,server_name")
      .eq("server_id", serverId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (entitlementReadError) return json({ error: "무료 이용 상태를 확인하지 못했어요." }, 500);
    if (!entitlement || entitlement.status !== "active") {
      return json({ error: "종료할 수 있는 활성 FREE 이용권이 없어요." }, 404);
    }

    const { data: server, error: serverReadError } = await db.from("managed_servers")
      .select("server_id,is_active")
      .eq("server_id", serverId)
      .maybeSingle();
    if (serverReadError) return json({ error: "서버 관리 상태를 확인하지 못했어요." }, 500);

    if (server?.is_active) {
      const { data: rpcResult, error: rpcError } = await db.rpc("set_managed_server_active", {
        target_server_id: serverId,
        desired_active: false,
      });
      if (rpcError) return json({ error: "관리 중지에 실패해 FREE 이용을 종료하지 못했어요." }, 409);
      const changed = Array.isArray(rpcResult) ? rpcResult[0] === true : rpcResult === true;
      if (!changed) return json({ error: "관리 상태를 중지하지 못했어요. 잠시 후 다시 시도해 주세요." }, 409);
      await db.from("bot_jobs").insert({
        server_id: serverId,
        job_type: "owner_dm",
        payload: { subject: "management", active: false },
        status: "pending",
      });
      await db.from("bot_jobs")
        .update({ status: "failed", error_message: "FREE plan ended", updated_at: new Date().toISOString() })
        .eq("server_id", serverId)
        .eq("status", "pending");
    }

    const { error: cancelError } = await db.from("free_entitlements")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", entitlement.id)
      .eq("user_id", authData.user.id)
      .eq("status", "active");
    if (cancelError) return json({ error: "관리 중지는 완료됐지만 FREE 이용 종료 저장에 실패했어요. 다시 눌러 주세요." }, 500);
    return json({ ok: true, cancelled: true, server_id: serverId, server_name: entitlement.server_name });
  }

  if (action === "activate_free") {
    const providerToken = String(body.provider_token || "");
    let guild: any = null;
    if (providerToken) {
      try {
        const guilds = await fetchAndCacheGuilds(db, authData.user.id, providerToken);
        guild = guilds.find((g: any) => String(g.id) === serverId) || null;
      } catch (error) {
        console.warn("Live Discord permission check unavailable; using saved permission snapshot:", error);
      }
    }
    if (!guild) {
      const { data: cachedGuild, error: cachedError } = await db.from("discord_user_guilds")
        .select("guild_id,guild_name,is_owner,permissions,can_manage,synced_at")
        .eq("user_id", authData.user.id)
        .eq("guild_id", serverId)
        .eq("can_manage", true)
        .gte("synced_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();
      if (cachedError) return json({ error: "저장된 Discord 서버 권한을 확인하지 못했어요." }, 500);
      guild = cachedGuild;
    }
    if (!guild) return json({ error: "저장된 서버 권한을 찾을 수 없어요. Discord 계정 연결을 한 번 갱신해 주세요." }, 403);
    const serverName = String(guild.guild_name || guild.name || body.server_name || "Discord 서버").trim().slice(0, 100);
    const { data: paidRows, error: paidError } = await db.from("purchase_requests")
      .select("id").eq("server_id", serverId).eq("status", "approved").gt("expires_at", new Date().toISOString()).limit(1);
    if (paidError) return json({ error: "기존 이용권을 확인하지 못했어요." }, 500);
    if (paidRows?.length) return json({ error: "이미 유료 이용권이 활성화된 서버예요." }, 409);
    const { data: existing, error: existingError } = await db.from("free_entitlements")
      .select("id,user_id,status").eq("server_id", serverId).maybeSingle();
    if (existingError) return json({ error: "무료 이용 상태를 확인하지 못했어요." }, 500);
    if (existing?.status === "active") {
      if (existing.user_id === authData.user.id) return json({ ok: true, already_active: true, plan: "FREE" });
      return json({ error: "이 서버는 이미 다른 계정에서 무료 플랜을 사용 중이에요." }, 409);
    }
    if (existing && existing.user_id !== authData.user.id) {
      return json({ error: "이 서버의 무료 이용 권한을 활성화할 수 없어요. 관리자에게 문의해 주세요." }, 409);
    }
    const { error: activateError } = await db.from("free_entitlements").upsert({
      user_id: authData.user.id,
      server_id: serverId,
      server_name: serverName,
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "server_id" });
    if (activateError) return json({ error: "무료 플랜을 활성화하지 못했어요." }, 500);
    return json({ ok: true, plan: "FREE", server_id: serverId, server_name: serverName });
  }

  const now = new Date().toISOString();
  const { data: purchase, error: purchaseError } = await db
    .from("purchase_requests")
    .select("id,approved_at,created_at,expires_at")
    .eq("user_id", authData.user.id)
    .eq("server_id", serverId)
    .eq("status", "approved")
    .gt("expires_at", now)
    .order("approved_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (purchaseError) return json({ error: "Unable to verify server access." }, 500);

  let hasPaidAccess = false;
  if (purchase) {
    const { data: currentPurchase, error: currentPurchaseError } = await db
      .from("purchase_requests")
      .select("id")
      .eq("server_id", serverId)
      .eq("status", "approved")
      .gt("expires_at", now)
      .order("approved_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentPurchaseError) return json({ error: "Unable to verify the current server entitlement." }, 500);
    hasPaidAccess = !!currentPurchase && currentPurchase.id === purchase.id;
  }

  let hasFreeAccess = false;
  if (!hasPaidAccess) {
    const { data: freeEntitlement, error: freeError } = await db.from("free_entitlements")
      .select("user_id,status").eq("server_id", serverId).eq("user_id", authData.user.id).eq("status", "active").maybeSingle();
    if (freeError) return json({ error: "Unable to verify FREE access." }, 500);
    hasFreeAccess = !!freeEntitlement;
  }
  if (!hasPaidAccess && !hasFreeAccess) {
    return json({ error: "An active TEND plan is required for this server." }, 403);
  }
  if (hasFreeAccess && !["send_announcement", "refresh_discord_server", "refresh_status"].includes(action)) {
    return json({ error: "This feature requires a paid TEND plan." }, 403);
  }

  if (action === "send_announcement") {
    const title = String(body.title || "").trim().slice(0, 200);
    const content = String(body.content || "").trim();
    if (!content) return json({ error: "Announcement content is required." }, 400);
    if (content.length > 4000) return json({ error: "Announcement content must be 4000 characters or fewer." }, 400);
    const image = String(body.image_url || "").trim();
    if (image && !/^https?:\/\//i.test(image)) return json({ error: "Image URL must start with http or https." }, 400);
    const mention = String(body.mention || "none");
    if (!["none", "everyone", "here", "role"].includes(mention)) return json({ error: "Invalid mention type." }, 400);
    if (hasFreeAccess && (mention !== "none" || image)) {
      return json({ error: "FREE 플랜에서는 기본 공지만 사용할 수 있어요." }, 403);
    }

    const requestedRoleIds = Array.isArray(body.role_ids)
      ? [...new Set(body.role_ids.map(String).filter((id) => /^\d{5,30}$/.test(id)))]
      : [];
    let roleIds = requestedRoleIds;

    if (mention === "role") {
      if (!requestedRoleIds.length) return json({ error: "Select at least one role to mention." }, 400);
      const { data: catalogRows, error: catalogError } = await db
        .from("discord_server_roles")
        .select("role_id,role_name,mentionable,is_everyone")
        .eq("server_id", serverId);
      if (catalogError) return json({ error: "Unable to load the Discord role catalog." }, 500);
      const catalog = new Map((catalogRows || []).map((r) => [String(r.role_id), r]));
      if (catalog.size === 0) return json({ error: "Role catalog is not synced yet. Wait for the bot to sync roles and retry." }, 409);
      roleIds = [];
      const unmentionable: string[] = [];
      for (const id of requestedRoleIds) {
        const row = catalog.get(id);
        if (!row) continue;
        if (!row.mentionable && !row.is_everyone) unmentionable.push(String(row.role_name));
        else roleIds.push(id);
      }
      if (unmentionable.length) {
        return json({ error: "These roles cannot be mentioned by the bot: " + unmentionable.slice(0, 5).join(", ") }, 422);
      }
      if (!roleIds.length) return json({ error: "None of the selected roles exist in this server anymore." }, 422);
    }

    let channelId = String(body.channel_id || "");
    if (!/^\d{5,30}$/.test(channelId)) {
      const { data: defChannel, error } = await db.from("announcement_channels")
        .select("channel_id").eq("server_id", serverId).eq("enabled", true)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (error) return json({ error: "Unable to load announcement channels." }, 500);
      channelId = String(defChannel?.channel_id || "");
      if (!/^\d{5,30}$/.test(channelId)) {
        const { data: discovered, error: discoveredError } = await db.from("discord_channels")
          .select("channel_id").eq("server_id", serverId).eq("can_send", true)
          .order("channel_name", { ascending: true }).limit(1).maybeSingle();
        if (discoveredError) return json({ error: "Unable to load automatically detected Discord channels." }, 500);
        channelId = String(discovered?.channel_id || "");
      }
    }
    if (!/^\d{5,30}$/.test(channelId)) return json({ error: "Choose or register an announcement channel first." }, 400);

    const { data: queuedCommand, error: commandError } = await db.from("bot_commands")
      .insert({
        user_id: authData.user.id,
        server_id: serverId,
        command_type: "post_announcement",
        payload: {
          source: "website",
          website: true,
          title: title || "공지",
          content,
          body: content,
          image_url: image || null,
          channel_id: channelId,
          mention,
          role_ids: roleIds,
        },
        status: "queued",
      })
      .select("id")
      .single();
    if (commandError) {
      return json({ error: "Unable to queue the announcement: " + commandError.message }, 500);
    }
    return json({ ok: true, queued: true, command_id: queuedCommand.id, command_type: "post_announcement" });
  }

  if (action === "refresh_discord_server") {
    // v7: 사이트 "Discord 정보 새로고침" 버튼. 이 서버만 동기화하도록
    // bot_jobs 큐잉. 봇이 직접 Discord 정보를 읽어 서버 측 테이블에 저장하고
    // Discord Bot Token / Service Key는 프런트엔드에 노출되지 않는다.
    // 소유권·이용권 검증은 위 purchase 쿼리와 bot_jobs RLS(insert_owned)로 이중 보호.
    const { data: existingJob, error: dupError } = await db.from("bot_jobs")
      .select("id,status,updated_at")
      .eq("server_id", serverId)
      .eq("job_type", "guild_snapshot.publish")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dupError) return json({ error: "Unable to check for an in-progress refresh." }, 500);
    if (existingJob) {
      // 중복 요청 방지: 진행 중인 동기화가 있으면 그 작업을 재사용한다.
      return json({ ok: true, queued: true, job_id: existingJob.id, already_running: true });
    }
    const { data: snapJob, error: snapJobError } = await db.from("bot_jobs")
      .insert({
        server_id: serverId,
        job_type: "guild_snapshot.publish",
        payload: { source: "website" },
        status: "pending",
      })
      .select("id")
      .limit(1)
      .maybeSingle();
    if (snapJobError) return json({ error: "Unable to queue the Discord server refresh." }, 500);
    return json({ ok: true, queued: true, job_id: snapJob?.id });
  }

  if (action === "refresh_status") {
    // 사이트 폴링용: 이 서버의 최근 스냅샷 상태와 마지막 동기화 시각.
    const { data: snap, error: snapError } = await db.from("discord_guilds")
      .select("synced_at")
      .eq("server_id", serverId)
      .maybeSingle();
    if (snapError) return json({ error: "Unable to read snapshot status." }, 500);
    const { data: lastJob } = await db.from("bot_jobs")
      .select("id,status,error_message,updated_at")
      .eq("server_id", serverId)
      .eq("job_type", "guild_snapshot.publish")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return json({ ok: true, synced_at: snap?.synced_at || null, last_job: lastJob || null });
  }

  if (action === "set_management") {
    const active = body.active === true;
    const { data: server, error } = await db.from("managed_servers")
      .select("server_id,bot_connected,last_seen_at,is_active,management_blocked,expires_at")
      .eq("server_id", serverId).maybeSingle();
    if (error) return json({ error: "Unable to read bot status." }, 500);
    const recent = !!server?.last_seen_at && (Date.now() - new Date(server.last_seen_at).getTime() < 120000);
    if (!server || server.management_blocked) return json({ error: "This server is blocked from management." }, 403);
    if (active && (!server.bot_connected || !recent)) {
      return json({ error: "The Discord bot worker is offline. Start the bot worker before enabling management." }, 409);
    }
    // Route through the same validated RPC the bot worker uses so entitlement,
    // heartbeat, and block checks cannot be bypassed from the website.
    const { data: rpcResult, error: rpcError } = await db.rpc("set_managed_server_active", {
      target_server_id: serverId,
      desired_active: active,
    });
    if (rpcError) {
      return json({ error: "Management state did not change. Check entitlement and bot status." }, 409);
    }
    const changed = Array.isArray(rpcResult) ? rpcResult[0] === true : rpcResult === true;
    if (!changed) {
      return json({ error: "Management state did not change. It may already be in the requested state or the entitlement expired." }, 409);
    }
    // Let the bot worker send a management-state DM to the Discord server owner.
    await db.from("bot_jobs").insert({
      server_id: serverId,
      job_type: "owner_dm",
      payload: { subject: "management", active },
      status: "pending",
    });
    // Cancel pending website announcement jobs when management stops.
    if (!active) {
      await db.from("bot_jobs")
        .update({ status: "failed", error_message: "Management stopped", updated_at: new Date().toISOString() })
        .eq("server_id", serverId).eq("status", "pending");
    }
    return json({ ok: true, active });
  }

  return json({ error: "Unsupported action." }, 400);
});
