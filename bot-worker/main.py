import asyncio
import os
from datetime import datetime, timedelta, timezone

import discord
from discord.ext import commands, tasks
from supabase import create_client, Client

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not DISCORD_BOT_TOKEN or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("DISCORD_BOT_TOKEN, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.")

db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)
last_heartbeat = None


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def rows(query):
    result = query.execute()
    return result.data or []


def write_system_log(log_type, severity, location, message):
    try:
        raw = str(message or "알 수 없는 오류")[:500]
        db.table("tend_system_logs").insert({
            "log_type": log_type,
            "severity": severity,
            "location": location,
            "message_ko": raw if any("\uac00" <= ch <= "\ud7a3" for ch in raw) else "봇에서 오류가 발생했습니다: " + log_type,
            "original_message": raw,
        }).execute()
    except Exception as log_exc:
        print("System log write failed:", repr(log_exc))


async def sync_heartbeat():
    global last_heartbeat
    now = utc_now()
    try:
        servers = rows(db.table("managed_servers").select("server_id"))
        for row in servers:
            server_id = str(row.get("server_id", ""))
            if not server_id:
                continue
            guild = bot.get_guild(int(server_id))
            db.table("managed_servers").update({
                "bot_connected": bool(guild),
                "last_seen_at": now,
            }).eq("server_id", server_id).execute()
        last_heartbeat = now
    except Exception as exc:
        print("Heartbeat update failed:", repr(exc))\n        write_system_log("하트비트 갱신 실패", "error", "봇 연결 상태", exc)


@tasks.loop(seconds=30)
async def heartbeat_loop():
    await sync_heartbeat()


@heartbeat_loop.before_loop
async def before_heartbeat():
    await bot.wait_until_ready()


async def management_is_active(server_id):
    try:
        data = rows(
            db.table("managed_servers")
            .select("is_active")
            .eq("server_id", str(server_id))
            .limit(1)
        )
        return bool(data and data[0].get("is_active"))
    except Exception as exc:
        print("Management status lookup failed:", repr(exc))\n        write_system_log("관리 상태 조회 실패", "error", "관리 상태 확인", exc)
        return False


async def get_moderation_rules(server_id):
    try:
        return rows(
            db.table("moderation_rules")
            .select("word,match_type,action_type,timeout_seconds,enabled")
            .eq("server_id", str(server_id))
            .eq("enabled", True)
        )
    except Exception as exc:
        print("Moderation rules lookup failed:", repr(exc))\n        write_system_log("자동 검열 규칙 조회 실패", "error", "금칙어 기능", exc)
        return []


@bot.event
async def on_ready():
    print(f"TEND bot online as {bot.user} ({bot.user.id})")\n    write_system_log("봇 연결", "info", "Discord 봇", "TEND 봇이 Discord에 연결되었습니다.")
    if not heartbeat_loop.is_running():
        heartbeat_loop.start()
    if not job_queue_loop.is_running():
        job_queue_loop.start()
    await sync_heartbeat()


@bot.event
async def on_guild_join(guild):
    await sync_heartbeat()


@bot.event
async def on_guild_remove(guild):
    try:
        db.table("managed_servers").update({
            "bot_connected": False,
            "last_seen_at": utc_now(),
        }).eq("server_id", str(guild.id)).execute()
    except Exception as exc:
        print("Guild removal status update failed:", repr(exc))


@bot.event
async def on_message(message):
    if not message.guild or message.author.bot:
        return

    if await management_is_active(message.guild.id):
        text = message.content.casefold()
        rules = await get_moderation_rules(message.guild.id)
        for rule in rules:
            word = str(rule.get("word") or "").casefold()
            if not word:
                continue
            match_type = rule.get("match_type", "exact")
            matched = text == word if match_type == "exact" else word in text
            if not matched:
                continue

            action = rule.get("action_type", "delete")
            reason = f"TEND 자동 검열: 금지 단어 규칙 ({word})"
            try:
                if action == "delete":
                    await message.delete()
                elif action == "timeout" and isinstance(message.author, discord.Member):
                    seconds = int(rule.get("timeout_seconds") or 300)
                    await message.author.timeout(timedelta(seconds=seconds), reason=reason)
                    if message.embeds or message.attachments or message.content:
                        try:
                            await message.delete()
                        except discord.HTTPException:
                            pass
                elif action == "ban" and isinstance(message.author, discord.Member):
                    await message.guild.ban(message.author, reason=reason, delete_message_seconds=0)
                else:
                    continue
                break
            except discord.Forbidden:
                print(f"Missing permissions in guild {message.guild.id} for rule {word!r}")\n                write_system_log("봇 권한 부족", "warning", "자동 검열", f"서버 {message.guild.id}에서 필요한 권한이 없습니다.")
            except discord.HTTPException as exc:
                print(f"Moderation action failed in guild {message.guild.id}:", repr(exc))\n                write_system_log("자동 검열 실행 실패", "error", "자동 검열", exc)

    await bot.process_commands(message)



async def handle_announcement_publish(job):
    payload = job.get("payload") or {}
    server_id = str(job.get("server_id") or "")
    channel_id = str(payload.get("channel_id") or "")
    if not server_id.isdigit() or not channel_id.isdigit():
        raise ValueError("공지 서버 또는 채널 ID가 올바르지 않습니다.")

    guild = bot.get_guild(int(server_id))
    if guild is None:
        raise RuntimeError("봇이 해당 Discord 서버에 접속해 있지 않습니다.")

    channel = guild.get_channel(int(channel_id))
    if channel is None:
        channel = await bot.fetch_channel(int(channel_id))
    if getattr(channel, "guild", None) is None or channel.guild.id != guild.id:
        raise ValueError("공지 채널이 선택한 서버에 속하지 않습니다.")
    if not hasattr(channel, "send"):
        raise ValueError("선택한 채널에는 공지를 보낼 수 없습니다.")

    me = guild.me
    if me is not None:
        permissions = channel.permissions_for(me)
        if not permissions.send_messages:
            raise PermissionError("봇에 채널 메시지 전송 권한이 없습니다.")
        if not permissions.embed_links:
            raise PermissionError("봇에 링크 삽입 권한이 없어 공지를 보낼 수 없습니다.")

    title = str(payload.get("title") or "").strip()[:256]
    body = str(payload.get("content") or "").strip()
    if not body:
        raise ValueError("공지 내용이 비어 있습니다.")
    if len(body) > 4096:
        raise ValueError("공지 내용은 4096자 이하여야 합니다.")

    mention = str(payload.get("mention") or "none").lower()
    role_ids = payload.get("role_ids") or []
    if not isinstance(role_ids, list):
        role_ids = []
    valid_roles = []
    for raw_id in role_ids:
        role_id = str(raw_id)
        if role_id.isdigit():
            role = guild.get_role(int(role_id))
            if role and (role.mentionable or permissions.administrator if me else role.mentionable):
                valid_roles.append(role)

    mention_text = None
    allowed = discord.AllowedMentions.none()
    if mention == "everyone":
        mention_text = "@everyone"
        allowed = discord.AllowedMentions(everyone=True, users=False, roles=False)
    elif mention == "here":
        mention_text = "@here"
        allowed = discord.AllowedMentions(everyone=True, users=False, roles=False)
    elif mention == "role" and valid_roles:
        mention_text = " ".join(role.mention for role in valid_roles)
        allowed = discord.AllowedMentions(everyone=False, users=False, roles=valid_roles)

    embed = discord.Embed(
        title=title or None,
        description=body,
        color=discord.Color.blurple(),
    )
    image_url = str(payload.get("image_url") or "").strip()
    if image_url.startswith(("https://", "http://")):
        embed.set_image(url=image_url)

    sent = await channel.send(
        content=mention_text,
        embed=embed,
        allowed_mentions=allowed,
    )

    try:
        db.table("announcements").insert({
            "guild_id": guild.id,
            "server_id": str(guild.id),
            "author_id": bot.user.id if bot.user else None,
            "channel_id": channel.id,
            "message_id": sent.id,
            "title": title or "공지",
            "body": body,
            "content": body,
            "image_url": image_url or None,
            "status": "sent",
            "published_at": utc_now(),
            "sent_at": utc_now(),
        }).execute()
    except Exception as exc:
        print("Announcement history save failed:", repr(exc))
        write_system_log("공지 기록 저장 실패", "warning", "공지 발행", exc)


async def handle_owner_dm(job):
    payload = job.get("payload") or {}
    server_id = str(job.get("server_id") or "")
    if not server_id.isdigit():
        raise ValueError("서버 ID가 올바르지 않습니다.")
    guild = bot.get_guild(int(server_id))
    if guild is None:
        raise RuntimeError("봇이 해당 Discord 서버에 접속해 있지 않습니다.")
    owner = guild.owner
    if owner is None:
        owner = await bot.fetch_user(guild.owner_id)
    active = payload.get("active") is True
    state = "시작" if active else "중지"
    embed = discord.Embed(
        title=f"TEND 관리 {state}",
        description=f"**{guild.name}** 서버의 TEND 관리가 {state}됐습니다.",
        color=discord.Color.green() if active else discord.Color.orange(),
        timestamp=datetime.now(timezone.utc),
    )
    try:
        await owner.send(embed=embed)
    except discord.Forbidden:
        write_system_log("서버 소유자 DM 전송 실패", "warning", "관리 알림", f"{guild.id} 서버 소유자의 DM이 닫혀 있습니다.")


async def handle_guild_snapshot_publish(job):
    server_id = str(job.get("server_id") or "")
    if not server_id.isdigit():
        raise ValueError("서버 ID가 올바르지 않습니다.")
    guild = bot.get_guild(int(server_id))
    if guild is None:
        raise RuntimeError("봇이 해당 Discord 서버에 접속해 있지 않습니다.")

    now = utc_now()
    db.table("discord_guilds").upsert({
        "server_id": str(guild.id),
        "server_name": guild.name,
        "icon_url": str(guild.icon.url) if guild.icon else None,
        "bot_present": True,
        "synced_at": now,
        "owner_id": str(guild.owner_id),
        "description": guild.description,
        "approximate_member_count": guild.member_count,
        "verification_level": int(guild.verification_level.value),
        "preferred_locale": str(guild.preferred_locale),
        "premium_tier": int(guild.premium_tier),
        "premium_subscription_count": guild.premium_subscription_count,
        "features": list(guild.features),
        "channel_count": len(guild.channels),
        "role_count": len(guild.roles),
        "emoji_count": len(guild.emojis),
        "sticker_count": len(guild.stickers),
    }, on_conflict="server_id").execute()

    channel_rows = []
    for channel in guild.channels:
        me = guild.me
        can_send = False
        if me is not None and hasattr(channel, "permissions_for"):
            perms = channel.permissions_for(me)
            can_send = bool(getattr(perms, "send_messages", False))
        channel_rows.append({
            "server_id": str(guild.id),
            "channel_id": str(channel.id),
            "channel_name": channel.name,
            "channel_type": str(channel.type),
            "can_send": can_send,
            "synced_at": now,
            "position": getattr(channel, "position", 0),
            "parent_id": str(channel.category_id) if getattr(channel, "category_id", None) else None,
            "topic": getattr(channel, "topic", None),
            "is_nsfw": bool(getattr(channel, "nsfw", False)),
            "bitrate": getattr(channel, "bitrate", None),
            "user_limit": getattr(channel, "user_limit", None),
        })
    if channel_rows:
        db.table("discord_channels").upsert(
            channel_rows, on_conflict="server_id,channel_id"
        ).execute()

    role_rows = [{
        "server_id": str(guild.id),
        "role_id": str(role.id),
        "role_name": role.name,
        "mentionable": bool(role.mentionable),
        "is_everyone": role.is_default(),
    } for role in guild.roles]
    if role_rows:
        db.table("discord_server_roles").upsert(
            role_rows, on_conflict="server_id,role_id"
        ).execute()


JOB_HANDLERS = {
    "announcement.publish": handle_announcement_publish,
    "owner_dm": handle_owner_dm,
    "guild_snapshot.publish": handle_guild_snapshot_publish,
}


async def process_pending_jobs():
    try:
        pending = rows(
            db.table("bot_jobs")
            .select("id,server_id,job_type,payload,attempts")
            .eq("status", "pending")
            .order("created_at", desc=False)
            .limit(10)
        )
    except Exception as exc:
        print("Bot job polling failed:", repr(exc))
        write_system_log("작업 목록 조회 실패", "error", "Supabase 작업 큐", exc)
        return

    for candidate in pending:
        job_id = candidate.get("id")
        if not job_id:
            continue
        try:
            claimed = rows(
                db.table("bot_jobs")
                .update({
                    "status": "processing",
                    "attempts": int(candidate.get("attempts") or 0) + 1,
                    "locked_at": utc_now(),
                    "locked_by": str(bot.user.id if bot.user else "tend-worker"),
                    "updated_at": utc_now(),
                })
                .eq("id", job_id)
                .eq("status", "pending")
                .select("id,server_id,job_type,payload,attempts")
            )
            if not claimed:
                continue

            job = claimed[0]
            job_type = str(job.get("job_type") or "")
            handler = JOB_HANDLERS.get(job_type)
            if handler is None:
                raise LookupError(f"unsupported_job_type:{job_type}")

            await handler(job)
            db.table("bot_jobs").update({
                "status": "completed",
                "error_message": None,
                "locked_at": None,
                "locked_by": None,
                "updated_at": utc_now(),
            }).eq("id", job_id).execute()
        except Exception as exc:
            error_text = f"{type(exc).__name__}: {exc}"[:1000]
            print(f"Bot job {job_id} failed:", error_text)
            try:
                db.table("bot_jobs").update({
                    "status": "failed",
                    "error_message": error_text,
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": utc_now(),
                }).eq("id", job_id).execute()
            except Exception as update_exc:
                print("Failed to update bot job status:", repr(update_exc))
            write_system_log("봇 작업 실행 실패", "error", f"작업 {job_id}", error_text)


@tasks.loop(seconds=5)
async def job_queue_loop():
    await process_pending_jobs()


@job_queue_loop.before_loop
async def before_job_queue():
    await bot.wait_until_ready()


@bot.command(name="tend상태")
@commands.has_guild_permissions(manage_guild=True)
async def tend_status(ctx):
    active = await management_is_active(ctx.guild.id)
    await ctx.reply(
        f"TEND 봇 온라인 · 관리 {'시작됨' if active else '중지됨'}",
        mention_author=False,
    )


@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    if isinstance(error, commands.MissingPermissions):
        await ctx.reply("이 명령어를 사용할 권한이 없어요.", mention_author=False)
        return
    print("Command error:", repr(error))\n    write_system_log("명령어 실행 실패", "error", "Discord 명령어", error)


bot.run(DISCORD_BOT_TOKEN)
