# TEND bot worker

This is the always-on Discord Gateway process needed for live moderation and bot heartbeats. GitHub Pages alone cannot run a Discord bot.

## Environment variables

Set these in your Python host (for example, a Pterodactyl Python server):

- `DISCORD_BOT_TOKEN`: Discord bot token
- `SUPABASE_URL`: `https://jdzkfwstfdhumxaahltu.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role secret

Never put the bot token or service-role key in `config.js`, HTML, or any browser-visible file. Keep them only in the host's environment variables.

## Start

Use Python 3.12 or newer:

```bash
pip install -r requirements.txt
python main.py
```

In the Discord Developer Portal, enable **Message Content Intent** and **Server Members Intent**. Invite the bot to each managed server and grant the permissions needed for message deletion, timeouts, and bans.

When the process is online, it updates `managed_servers.bot_connected` and `last_seen_at`. The website allows management to start only when this heartbeat is recent. The moderation handler reads `managed_servers.is_active` and `moderation_rules` directly.

Current worker scope: live heartbeat, management on/off, banned-word moderation (delete, timeout, ban), `!tend상태`, website announcement publishing (`announcement.publish`), server-owner management DMs (`owner_dm`), and Discord server/channel/role synchronization (`guild_snapshot.publish`). The worker polls supported `bot_jobs` every five seconds, claims each job once, and records completed or failed status in Supabase. Other feature cards and command-library actions still need handlers before they can perform their advertised Discord actions.
