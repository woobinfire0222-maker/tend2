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

    const title = String(body.title || "").trim().slice(0, 256);
    const content = String(body.content || "").trim();
    const image = String(body.image_url || "").trim();
    const mention = String(body.mention || "none");
    const roleIds = Array.isArray(body.role_ids) ? body.role_ids.map(String).filter((id) => /^\d{5,30}$/.test(id)) : [];
    if (!content) return json({ error: "Announcement content is required." }, 400);
    if (content.length > 4096) return json({ error: "Announcement content must be 4096 characters or fewer." }, 400);
    if (image && !/^https?:\/\//i.test(image)) return json({ error: "Image URL must start with http or https." }, 400);

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
      return json({ error: detail, discord_status: discordResponse.status }, 502);
    }
    return json({ ok: true, message_id: responseBody.id, channel_id: channelId });
  }

  if (action === "set_management") {
    const active = body.active === true;
    const { data: server, error } = await db.from("managed_servers")
      .select("server_id,bot_connected,last_seen_at").eq("server_id", serverId).maybeSingle();
    if (error) return json({ error: "Unable to read bot status." }, 500);
    const recent = !!server?.last_seen_at && (Date.now() - new Date(server.last_seen_at).getTime() < 120000);
    if (active && (!server?.bot_connected || !recent)) {
      return json({ error: "The Discord bot worker is offline. Start the bot worker before enabling management." }, 409);
    }
    const { error: updateError } = await db.from("managed_servers")
      .update({ is_active: active, updated_at: new Date().toISOString(), ...(active ? { started_at: new Date().toISOString() } : {}) })
      .eq("server_id", serverId);
    if (updateError) return json({ error: "Unable to change management status." }, 500);
    return json({ ok: true, active });
  }

  return json({ error: "Unsupported action." }, 400);
});
