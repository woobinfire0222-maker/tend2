import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = request.headers.get("Authorization") || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token || !url || !serviceKey) return json({ error: "Backend configuration is incomplete." }, 503);
  if (!botToken) return json({ error: "DISCORD_BOT_TOKEN secret is not configured." }, 503);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const action = String(body.action || "");
  const serverId = String(body.server_id || "");
  if (!/^\d{5,30}$/.test(serverId)) return json({ error: "Invalid Discord server ID." }, 400);

  const { data: purchase, error: purchaseError } = await db
    .from("purchase_requests")
    .select("id")
    .eq("user_id", authData.user.id)
    .eq("server_id", serverId)
    .in("status", ["approved", "completed"])
    .limit(1)
    .maybeSingle();
  if (purchaseError) return json({ error: "Unable to verify server access." }, 500);
  if (!purchase) return json({ error: "An approved plan is required for this server." }, 403);

  if (action === "send_announcement") {
    const title = String(body.title || "").trim().slice(0, 200);
    const content = String(body.content || "").trim();
    const image = String(body.image_url || "").trim();
    const mention = String(body.mention || "none");
    const roleIds = Array.isArray(body.role_ids) ? body.role_ids.map(String).filter((id) => /^\\d{5,30}$/.test(id)) : [];
    if (!content) return json({ error: "Announcement content is required." }, 400);
    if (content.length > 4000) return json({ error: "Announcement content must be 4000 characters or fewer." }, 400);
    if (image && !/^https?:\\/\\//i.test(image)) return json({ error: "Image URL must start with http or https." }, 400);
    const { data: record, error: recordError } = await db.from("bot_announcements").insert({
      user_id: authData.user.id, server_id: serverId, title: title || null, content, image_url: image || null,
      channel_id: String(body.channel_id || "") || null, status: "queued"
    }).select("id").single();
    if (recordError) return json({ error: "Unable to save the announcement record: " + recordError.message }, 500);
    let channelId = String(body.channel_id || "");
    if (!channelId) {
      const { data: channel, error } = await db.from("announcement_channels")
        .select("channel_id").eq("server_id", serverId).eq("enabled", true)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (error) return json({ error: "Unable to load announcement channels." }, 500);
      channelId = String(channel?.channel_id || "");
      if (!channelId) {
        const { data: discovered, error: discoveredError } = await db.from("discord_channels")
          .select("channel_id").eq("server_id", serverId).eq("can_send", true)
          .order("channel_name", { ascending: true }).limit(1).maybeSingle();
        if (discoveredError) return json({ error: "Unable to load automatically detected Discord channels." }, 500);
        channelId = String(discovered?.channel_id || "");
      }
    }
    if (!/^\d{5,30}$/.test(channelId)) return json({ error: "Choose or register an announcement channel first." }, 400);
    const { data: allowedChannel, error: channelCheckError } = await db.from("announcement_channels")
      .select("channel_id").eq("server_id", serverId).eq("channel_id", channelId).eq("enabled", true).maybeSingle();
    if (channelCheckError) return json({ error: "Unable to verify the announcement channel." }, 500);
    let canUseDiscoveredChannel = false;
    if (!allowedChannel) {
      const { data: discovered, error: discoveredError } = await db.from("discord_channels")
        .select("channel_id,can_send").eq("server_id", serverId).eq("channel_id", channelId).maybeSingle();
      if (discoveredError) return json({ error: "Unable to verify the automatically detected channel." }, 500);
      canUseDiscoveredChannel = !!discovered && discovered.can_send === true;
    }
    if (!allowedChannel && !canUseDiscoveredChannel) return json({ error: "This channel is not registered or the bot cannot send messages there." }, 403);

    let messageContent = "";
    const parse: Record<string, unknown> = {};
    if (mention === "everyone" || mention === "here") {
      messageContent = mention === "everyone" ? "@everyone" : "@here";
      parse.parse = [mention];
    } else if (mention === "role" && roleIds.length) {
      messageContent = roleIds.map((id) => "<@&" + id + ">").join(" ");
      parse.roles = roleIds;
    } else {
      parse.parse = [];
    }
    const embed: Record<string, unknown> = { description: content };
    if (title) embed.title = title;
    if (image) embed.image = { url: image };
    const discordResponse = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST",
      headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
      body: JSON.stringify({ content: messageContent || undefined, embeds: [embed], allowed_mentions: parse }),
    });
    const responseBody = await discordResponse.json().catch(() => ({}));
    if (!discordResponse.ok) {
      const detail = typeof responseBody?.message === "string" ? responseBody.message : "Discord rejected the message.";
      await db.from("bot_announcements").update({status:"failed",error_message:detail,updated_at:new Date().toISOString()}).eq("id",record.id);
      return json({ error: detail, discord_status: discordResponse.status }, 502);
    }
    const { error: logError } = await db.from("bot_announcements").update({
      status:"sent",channel_id:channelId,discord_message_id:responseBody.id,updated_at:new Date().toISOString()
    }).eq("id",record.id);
    if (logError) return json({ error: "The announcement was sent, but its history could not be updated: " + logError.message, sent: true, message_id: responseBody.id }, 500);
    return json({ ok: true, message_id: responseBody.id, channel_id: channelId, announcement_id: record.id });
  }

  if (action === "set_management") {
    if (typeof body.active !== "boolean") return json({ error: "Management state must be true or false." }, 400);
    const active = body.active;
    const { data: purchaseRow, error: purchaseLookupError } = await db.from("purchase_requests")
      .select("server_name").eq("server_id",serverId).eq("user_id",authData.user.id)
      .in("status",["approved","completed"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if (purchaseLookupError || !purchaseRow) return json({ error: "Unable to verify approved server access." }, 403);
    const { error: seedError } = await db.from("managed_servers").upsert({
      server_id:serverId,server_name:purchaseRow.server_name || "Discord 서버",owner_id:authData.user.id,is_active:false
    },{onConflict:"server_id",ignoreDuplicates:true});
    if (seedError) return json({ error: "Unable to initialize server management status: " + seedError.message }, 500);
    const { data: server, error } = await db.from("managed_servers")
      .select("server_id,bot_connected,last_seen_at,is_active").eq("server_id",serverId).maybeSingle();
    if (error || !server) return json({ error: "Unable to read bot status." }, 500);
    if (server.is_active === active) {
      return json({ error: active ? "이 서버는 이미 관리 중입니다." : "이 서버는 이미 관리 종료 상태입니다.", active:server.is_active }, 409);
    }
    const recent = !!server.last_seen_at && (Date.now() - new Date(server.last_seen_at).getTime() < 120000);
    if (active && (!server.bot_connected || !recent)) {
      return json({ error: "Discord 봇이 오프라인이거나 최근 응답이 없습니다. 봇 워커를 먼저 실행해 주세요." }, 409);
    }
    const { data: changed, error: updateError } = await db.from("managed_servers")
      .update({is_active:active,updated_at:new Date().toISOString(),...(active?{started_at:new Date().toISOString()}:{})})
      .eq("server_id",serverId).eq("is_active",!active).select("server_id,is_active").maybeSingle();
    if (updateError) return json({ error: "Unable to change management status: " + updateError.message }, 500);
    if (!changed) return json({ error: active ? "이미 관리 시작 요청이 처리되었어요." : "이미 관리 종료 요청이 처리되었어요." }, 409);
    return json({ ok:true,active:changed.is_active });
  }

  return json({ error: "Unsupported action." }, 400);
});
