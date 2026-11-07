(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let sb,user,notify,escapeHtml,withTimeout,servers=[],serverId="",tab="roles",configs={};
const defs={roles:{key:"lab_auto_role",title:"자동 역할 추천",desc:"가입 기간이나 메시지 활동 조건을 충족한 멤버에게 역할을 자동 지급해요."},stats:{key:"lab_advanced_stats",title:"서버 통계 고급판",desc:"멤버 증감과 메시지 활동을 기간별로 확인해요."},levels:{key:"lab_level_system",title:"서버 등급 시스템",desc:"메시지 활동으로 경험치를 얻고 레벨 보상과 순위를 제공해요."}};
const safe=(v)=>escapeHtml(String(v??""));
function status(text){$("#server-hint").textContent=text}
async function loadServers(){
const q=await withTimeout(sb.from("purchase_requests").select("server_id,server_name,status,created_at").eq("user_id",user.id).in("status",["approved","completed"]).not("server_id","is",null).order("created_at",{ascending:false}).limit(100));
if(q.error){console.error(q.error);$("#lab-server").innerHTML='<option value="">서버 목록을 불러오지 못했어요</option>';status("서버 목록 조회에 실패했어요.");return}
const seen=new Set();servers=(q.data||[]).filter(x=>{if(!x.server_id||seen.has(String(x.server_id)))return false;seen.add(String(x.server_id));return true});
if(!servers.length){$("#lab-server").innerHTML='<option value="">승인된 서버가 없어요</option>';render();status("이용권 승인이 완료된 서버가 있어야 실험 기능을 사용할 수 있어요.");return}
const ids=servers.map(x=>String(x.server_id));
const [inventory,live]=await Promise.all([
withTimeout(sb.from("discord_guilds").select("server_id,server_name,bot_present").in("server_id",ids)),
withTimeout(sb.from("managed_servers").select("server_id,bot_connected,management_available,is_active").in("server_id",ids))
]);
const inv=new Map((inventory.data||[]).map(x=>[String(x.server_id),x]));
const liveMap=new Map((live.data||[]).map(x=>[String(x.server_id),x]));
servers=servers.map(x=>({...x,inventory:inv.get(String(x.server_id)),live:liveMap.get(String(x.server_id))}));
const ready=servers.filter(x=>x.inventory?.bot_present!==false&&x.live?.bot_connected!==false);
$("#lab-server").innerHTML='<option value="">서버 선택</option>'+servers.map(x=>'<option value="'+safe(x.server_id)+'">'+safe(x.inventory?.server_name||x.server_name||"Discord 서버")+(x.inventory?.bot_present===false?" · 봇 미참여":"")+'</option>').join("");
if(ready.length){serverId=String(ready[0].server_id);$("#lab-server").value=serverId;status("선택한 서버의 실험 설정은 해당 서버에만 적용돼요.");await loadConfigs()}else{status("봇이 참여 중인 서버를 찾지 못했어요. 봇 초대 후 서버 정보를 새로고침해 주세요.");render()}
}
async function loadConfigs(){
if(!serverId){render();return}
const q=await withTimeout(sb.from("server_feature_settings").select("feature_key,settings,enabled,updated_at").eq("server_id",serverId).in("feature_key",Object.values(defs).map(x=>x.key)));
if(q.error){console.error(q.error);notify("실험 설정을 불러오지 못했어요.");return}
configs=Object.fromEntries((q.data||[]).map(x=>[x.feature_key,x]));render()
}
function enabled(key){return !!configs[key]?.enabled}
function settings(key){return configs[key]?.settings||{}}
function render(){
$$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
const box=$("#feature-content");if(!serverId){box.innerHTML='<div class="empty">먼저 테스트할 서버를 선택해 주세요.</div>';return}
const d=defs[tab],s=settings(d.key),on=enabled(d.key);
let html='<div class="feature-head"><div><h2>'+d.title+'</h2><p>'+d.desc+'</p></div><span class="state '+(on?"on":"")+'">'+(on?"활성화":"비활성화")+'</span></div>';
if(tab==="roles"){
const rules=Array.isArray(s.rules)?s.rules:[];
html+='<form id="role-form" class="form-grid"><div class="field"><label>규칙 이름</label><input name="name" maxlength="40" placeholder="예: 신규 멤버 7일 활동"></div><div class="field"><label>지급할 Discord 역할 ID</label><input name="role_id" inputmode="numeric" required placeholder="역할 ID"></div><div class="field"><label>가입 후 경과 일수</label><input name="days" type="number" min="0" max="3650" value="0"></div><div class="field"><label>누적 메시지 수</label><input name="messages" type="number" min="0" max="1000000" value="0"></div><div class="field wide"><label>조건 조합</label><select name="mode"><option value="all">모든 조건 충족 (AND)</option><option value="any">하나 이상 충족 (OR)</option></select></div><div class="wide actions"><button class="btn primary" type="submit">규칙 추가</button></div></form><div class="rule-list">'+(rules.length?rules.map((r,i)=>'<div class="rule"><div><strong>'+safe(r.name||"역할 규칙")+'</strong><small>역할 '+safe(r.role_id)+' · 가입 '+safe(r.days||0)+'일 · 메시지 '+safe(r.messages||0)+'개 · '+(r.mode==="any"?"OR":"AND")+'</small></div><button class="btn" data-rule-delete="'+i+'">삭제</button></div>').join(""):'<div class="empty">등록된 역할 규칙이 없어요.</div>')+'</div>';
}else if(tab==="stats"){
html+='<div class="toolbar"><strong>활동 요약</strong><select id="stats-period" style="max-width:150px"><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select></div><div id="stats-data"><div class="empty">통계 데이터를 확인하는 중…</div></div><p class="hint">통계는 봇이 활동 데이터를 수집한 시점부터 표시돼요. 메시지 본문은 통계 목적으로 저장하지 않아요.</p>';
}else{
html+='<form id="level-form" class="form-grid"><div class="field"><label>메시지당 최소 경험치</label><input name="xp_min" type="number" min="1" max="100" value="'+safe(s.xp_min??5)+'"></div><div class="field"><label>메시지당 최대 경험치</label><input name="xp_max" type="number" min="1" max="200" value="'+safe(s.xp_max??12)+'"></div><div class="field"><label>경험치 지급 쿨다운 (초)</label><input name="cooldown" type="number" min="5" max="3600" value="'+safe(s.cooldown??60)+'"></div><div class="field"><label>레벨업 알림 채널 ID</label><input name="announce_channel_id" inputmode="numeric" value="'+safe(s.announce_channel_id||"")+'" placeholder="선택 사항"></div><div class="field"><label>레벨업 알림</label><select name="announce_enabled"><option value="true" '+(s.announce_enabled!==false?"selected":"")+'>사용</option><option value="false" '+(s.announce_enabled===false?"selected":"")+'>사용 안 함</option></select></div><div class="field"><label>제외 채널 ID (쉼표 구분)</label><input name="excluded_channels" value="'+safe((s.excluded_channels||[]).join(", "))+'" placeholder="채널 ID"></div><div class="field wide"><label>레벨 보상 역할</label><textarea name="rewards" rows="3" placeholder="레벨=역할ID 형식, 한 줄에 하나씩">'+safe((s.rewards||[]).map(r=>r.level+"="+r.role_id).join("\n"))+'</textarea></div><div class="wide actions"><button class="btn primary" type="submit">등급 설정 저장</button></div></form><div id="level-data"><div class="empty">서버를 선택하면 현재 등급 순위를 불러와요.</div></div>';
}
html+='<div class="actions"><button class="btn" id="toggle-feature">'+(on?"실험 기능 끄기":"실험 기능 켜기")+'</button><button class="btn primary" id="save-feature">설정 저장 및 봇에 적용</button></div><p class="hint">설정은 Supabase에 저장되고 봇 작업 대기열에 전달돼요. 봇 프로그램에 해당 실험 기능 처리 코드가 배포되어 있어야 실제 Discord에서 작동해요.</p>';
box.innerHTML=html;
$("#role-form")?.addEventListener("submit",addRule);
$$("[data-rule-delete]").forEach(b=>b.addEventListener("click",()=>{const next={...settings(defs.roles.key),rules:(settings(defs.roles.key).rules||[]).filter((_,i)=>i!==Number(b.dataset.ruleDelete))};saveFeature(defs.roles.key,next,enabled(defs.roles.key))}));
$("#level-form")?.addEventListener("submit",saveLevel);
$("#save-feature")?.addEventListener("click",()=>saveFeature(d.key,settings(d.key),enabled(d.key)));
$("#toggle-feature")?.addEventListener("click",()=>saveFeature(d.key,settings(d.key),!enabled(d.key)));
if(tab==="stats")loadStats();if(tab==="levels")loadLevels();
}
async function saveFeature(key,next,on){
const btn=$("#save-feature");if(btn){btn.disabled=true;btn.textContent="저장 중…"}
const payload={server_id:serverId,feature_key:key,settings:next,enabled:on,updated_at:new Date().toISOString()};
const q=await sb.from("server_feature_settings").upsert(payload,{onConflict:"server_id,feature_key"});
if(q.error){console.error(q.error);notify("설정을 저장하지 못했어요.");if(btn){btn.disabled=false;btn.textContent="설정 저장 및 봇에 적용"}return}
const job=await sb.from("bot_jobs").insert({server_id:serverId,job_type:"lab_feature_config",payload:{feature_key:key,enabled:on,settings:next},status:"pending"});
if(job.error){
const fallback=await sb.from("bot_commands").insert({user_id:user.id,server_id:serverId,command_type:"lab_feature_config",payload:{feature_key:key,enabled:on,settings:next},status:"queued"});
if(fallback.error){console.error("Lab job queue failed:",job.error,fallback.error);notify("설정은 저장했지만 봇 작업 전달에 실패했어요.");}
else notify("설정을 저장하고 봇 작업 대기열에 전달했어요.");
}else notify("설정을 저장하고 봇 작업 대기열에 전달했어요.");
await loadConfigs();
}
async function addRule(e){
e.preventDefault();const f=new FormData(e.currentTarget),r={name:String(f.get("name")||"역할 규칙").trim(),role_id:String(f.get("role_id")||"").trim(),days:Number(f.get("days")||0),messages:Number(f.get("messages")||0),mode:String(f.get("mode")||"all")};
if(!/^\d{17,20}$/.test(r.role_id)){notify("올바른 Discord 역할 ID를 입력해 주세요.");return}
const next={...settings(defs.roles.key),rules:[...(settings(defs.roles.key).rules||[]),r]};await saveFeature(defs.roles.key,next,enabled(defs.roles.key));
}
async function saveLevel(e){
e.preventDefault();const f=new FormData(e.currentTarget),rewards=String(f.get("rewards")||"").split("\n").map(x=>x.trim()).filter(Boolean).map(x=>{const [level,role_id]=x.split("=");return {level:Number(level),role_id:(role_id||"").trim()}}).filter(x=>Number.isInteger(x.level)&&x.level>0&&/^\d{17,20}$/.test(x.role_id));
const next={xp_min:Number(f.get("xp_min")),xp_max:Number(f.get("xp_max")),cooldown:Number(f.get("cooldown")),announce_channel_id:String(f.get("announce_channel_id")||"").trim(),announce_enabled:f.get("announce_enabled")==="true",excluded_channels:String(f.get("excluded_channels")||"").split(",").map(x=>x.trim()).filter(Boolean),rewards};
if(next.xp_min>next.xp_max||next.xp_min<1||next.cooldown<5){notify("경험치 범위 또는 쿨다운 설정을 확인해 주세요.");return}
await saveFeature(defs.levels.key,next,enabled(defs.levels.key));
}
async function loadStats(){
const box=$("#stats-data"),days=Number($("#stats-period").value||7),since=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
box.innerHTML='<div class="empty">통계 데이터를 불러오는 중…</div>';
const q=await sb.from("lab_server_stats_daily").select("stat_date,message_count,member_count,joins,leaves").eq("server_id",serverId).gte("stat_date",since).order("stat_date",{ascending:true}).limit(100);
if(q.error){console.warn("Lab stats not available:",q.error);box.innerHTML='<div class="empty">아직 수집된 통계가 없어요.<br>봇의 통계 수집 기능이 배포되면 이곳에 표시돼요.</div>';return}
const rows=q.data||[],sum=k=>rows.reduce((a,x)=>a+Number(x[k]||0),0),latest=rows.at(-1);
box.innerHTML='<div class="metric-grid"><div class="metric"><small>메시지 수</small><strong>'+sum("message_count").toLocaleString("ko-KR")+'</strong></div><div class="metric"><small>신규 멤버</small><strong>'+sum("joins").toLocaleString("ko-KR")+'</strong></div><div class="metric"><small>멤버 이탈</small><strong>'+sum("leaves").toLocaleString("ko-KR")+'</strong></div><div class="metric"><small>현재 멤버</small><strong>'+Number(latest?.member_count||0).toLocaleString("ko-KR")+'</strong></div></div><table class="data-table"><thead><tr><th>날짜</th><th>메시지</th><th>가입</th><th>이탈</th><th>멤버 수</th></tr></thead><tbody>'+(rows.length?rows.slice().reverse().map(x=>'<tr><td>'+safe(x.stat_date)+'</td><td>'+Number(x.message_count||0).toLocaleString("ko-KR")+'</td><td>'+Number(x.joins||0)+'</td><td>'+Number(x.leaves||0)+'</td><td>'+Number(x.member_count||0)+'</td></tr>').join(""):'<tr><td colspan="5">데이터 없음</td></tr>')+'</tbody></table>';
}
async function loadLevels(){
const box=$("#level-data");if(!box)return;
const q=await sb.from("lab_level_members").select("discord_user_id,display_name,level,xp").eq("server_id",serverId).order("level",{ascending:false}).order("xp",{ascending:false}).limit(10);
if(q.error){box.innerHTML='<div class="empty">아직 레벨 데이터가 없어요. 봇의 등급 시스템이 배포되면 순위가 표시돼요.</div>';return}
box.innerHTML='<div class="toolbar" style="margin:22px 0 10px"><strong>서버 레벨 순위 TOP 10</strong></div><table class="data-table"><thead><tr><th>순위</th><th>멤버</th><th>레벨</th><th>경험치</th></tr></thead><tbody>'+(q.data?.length?q.data.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+safe(x.display_name||x.discord_user_id)+'</td><td>'+Number(x.level||0)+'</td><td>'+Number(x.xp||0).toLocaleString("ko-KR")+'</td></tr>').join(""):'<tr><td colspan="4">아직 등록된 멤버가 없어요.</td></tr>')+'</tbody></table>';
}
async function init(ctx){
({sb,user,notify,escapeHtml,withTimeout}=ctx);
if(!sb||!user)return;
$("#lab-server").addEventListener("change",async e=>{serverId=e.target.value;await loadConfigs()});
$$("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;render()}));
$("#stats-period")?.addEventListener("change",loadStats);
await loadServers();
}
window.TEND_LAB={init};
})();