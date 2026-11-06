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
