# TEND Discord action function

The GitHub Pages frontend cannot safely call Discord with a bot token. This Edge Function sends announcements through the Discord REST API and validates that the signed-in user has an approved plan for the target server.

## Deploy once

From the repository root, with Supabase CLI logged in and linked to project `jdzkfwstfdhumxaahltu`:

```bash
supabase login
supabase link --project-ref jdzkfwstfdhumxaahltu
supabase secrets set DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
supabase functions deploy discord-action
```

Keep the bot token only in Supabase secrets. Never put it in `config.js`, HTML, or browser JavaScript.

The bot must already be invited to the Discord server and have permission to view and send messages in the selected channel. To send announcements, register the channel in TEND first.

## Management toggle limitation

The function only changes the managed server's active flag after checking that the bot worker has sent a recent heartbeat (`bot_connected` and `last_seen_at`). It does not create or host the persistent Discord Gateway bot. Message moderation, automatic roles, tickets, and other event-driven features require a separate always-on bot worker that updates the heartbeat and reads these settings.
