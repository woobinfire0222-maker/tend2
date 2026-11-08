(() => {
const cfg=window.TEND_CONFIG||{};
const sb=window.TEND_SB||(window.supabase&&cfg.supabaseUrl&&cfg.supabaseAnonKey?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null);if(sb)window.TEND_SB=sb;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null,profileName="사용자",experimentMember=false;
const toast=$("#toast");
function notify(s){if(!toast)return;toast.textContent=s;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),3000)}
function withTimeout(promise, ms=12000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),ms))])}
function discordNames(u){const m=u?.user_metadata||{};const names=[m.user_name,m.preferred_username,m.username,m.custom_claims?.global_name,m.global_name,m.full_name,m.name,m.nickname,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[d.user_name,d.preferred_username,d.username,d.global_name,d.name]})];return names.filter(Boolean).map(v=>String(v).trim().toLowerCase())}
function uname(u){const m=u?.user_metadata||{};const values=[m.global_name,m.user_name,m.preferred_username,m.username,m.custom_claims?.global_name,m.full_name,m.name,m.nickname,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[d.global_name,d.user_name,d.preferred_username,d.username,d.name]})];return values.filter(Boolean).map(v=>String(v).trim()).find(Boolean)||""}
function discordUserId(u){const m=u?.user_metadata||{},a=u?.app_metadata||{};const values=[m.provider_id,m.user_id,m.discord_id,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[d.user_id,d.provider_id,d.id,d.sub,i.id]}),m.sub,a.provider_id];return values.filter(Boolean).map(String).find(v=>/^\d{17,20}$/.test(v))||""}
function discordIds(u){const m=u?.user_metadata||{},a=u?.app_metadata||{};return [m.sub,m.provider_id,m.id,m.user_id,a.provider_id,a.sub,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[i.id,d.sub,d.provider_id,d.id,d.user_id]})].filter(Boolean).map(String)}
function isOwnerName(u){return discordNames(u).includes("pengin_hi22")}
function isAdmin(u){return u?.app_metadata?.role==="admin"||discordIds(u).includes("1318120987480424498")}
function goto(p){location.href="./"+p+".html"}
async function login(){if(!sb){notify("로그인 서비스를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.");return}const redirectTo="https://tendsite.shop/login.html";try{const {data,error}=await sb.auth.signInWithOAuth({provider:"discord",options:{redirectTo,scopes:"identify email guilds",skipBrowserRedirect:false}});if(error)throw error;if(data?.url)location.assign(data.url)}catch(error){console.error("Discord OAuth start failed:",error);notify("Discord 로그인 요청 실패: "+(error?.message||"Supabase와 Discord OAuth 설정을 확인해 주세요."))}}
function discordAvatar(u){
 const m=u?.user_metadata||{};
 const d=(u?.identities||[]).find(i=>i.provider==="discord")?.identity_data||{};
 const direct=[m.avatar_url,m.picture,d.avatar_url,d.picture].find(v=>typeof v==="string"&&/^https:\/\//i.test(v));
 if(direct)return direct;
 const id=discordUserId(u),hash=m.avatar||d.avatar;
 return id&&hash?(`https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`):"";
}
function setAvatar(el,u){
 if(!el)return;
 const url=discordAvatar(u);
 el.textContent=(profileName[0]||"T").toUpperCase();
 if(!url)return;
 const img=document.createElement("img");
 img.src=url;img.alt="Discord 프로필 사진";img.referrerPolicy="no-referrer";
 img.onerror=()=>img.remove();
 el.replaceChildren(img);
}
function showAccountConfirm(u){
 if(document.querySelector('.tend-account-confirm'))return;
 const name=uname(u)||u?.user_metadata?.global_name||u?.email||"Discord 사용자";
 const id=discordUserId(u);
 const avatar=discordAvatar(u);
 const overlay=document.createElement("div");
 overlay.className="tend-account-confirm";
 overlay.innerHTML='<section class="tend-account-confirm-card" role="dialog" aria-modal="true" aria-labelledby="tend-confirm-title"><div class="tend-confirm-kicker">ACCOUNT CHECK</div><h2 id="tend-confirm-title">이 계정이 맞나요?</h2><p class="tend-confirm-desc">로그인할 Discord 계정을 확인해 주세요.</p><div class="tend-confirm-profile"><div class="tend-confirm-avatar"></div><div class="tend-confirm-info"><strong></strong><small></small></div></div><button type="button" class="btn btn-blue tend-confirm-yes">맞아요</button><button type="button" class="btn btn-light tend-confirm-no">다른 계정으로 로그인</button></section>';
 const avatarBox=overlay.querySelector(".tend-confirm-avatar");
 if(avatar){const img=document.createElement("img");img.src=avatar;img.alt="Discord 프로필 사진";img.referrerPolicy="no-referrer";img.onerror=()=>img.remove();avatarBox.append(img)}else avatarBox.textContent=(name[0]||"D").toUpperCase();
 overlay.querySelector(".tend-confirm-info strong").textContent=name;
 overlay.querySelector(".tend-confirm-info small").textContent=id?"Discord ID · "+id:"Discord 계정";
 overlay.querySelector(".tend-confirm-yes").addEventListener("click",()=>{overlay.remove();profileName=name;goto("dashboard")});
 overlay.querySelector(".tend-confirm-no").addEventListener("click",async()=>{const button=overlay.querySelector(".tend-confirm-no");button.disabled=true;button.textContent="계정 연결 해제 중…";const {error}=await sb.auth.signOut();overlay.remove();if(error){console.error("Discord signout failed:",error);notify("계정 전환에 실패했어요. 다시 시도해 주세요.")}else{user=null;notify("다른 Discord 계정으로 로그인해 주세요.")}});
 document.body.append(overlay);
}
function showLogoutConfirm(){
 const overlay=document.createElement("div");
 overlay.className="tend-account-confirm";
 overlay.innerHTML='<section class="tend-account-confirm-card tend-logout-card" role="dialog" aria-modal="true" aria-labelledby="tend-logout-title"><div class="tend-confirm-kicker">LOG OUT</div><h2 id="tend-logout-title">정말 로그아웃할까요?</h2><p class="tend-confirm-desc">로그아웃하면 TEND 이용을 위해 다시 로그인해야 해요.</p><div class="tend-logout-actions"><button type="button" class="btn tend-logout-yes">로그아웃</button><button type="button" class="btn btn-light tend-logout-no">취소</button></div></section>';
 const cancel=()=>overlay.remove();
 overlay.querySelector(".tend-logout-no").addEventListener("click",cancel);
 overlay.addEventListener("click",e=>{if(e.target===overlay)cancel()});
 overlay.querySelector(".tend-logout-yes").addEventListener("click",async()=>{
  const buttons=[...overlay.querySelectorAll("button")];buttons.forEach(b=>b.disabled=true);
  const yes=overlay.querySelector(".tend-logout-yes");yes.textContent="로그아웃 중…";
  const {error}=await sb.auth.signOut();
  if(error){console.error("Discord signout failed:",error);buttons.forEach(b=>b.disabled=false);yes.textContent="로그아웃";notify("로그아웃에 실패했어요. 다시 시도해 주세요.");return}
  location.href="./index.html";
 });
 document.body.append(overlay);
}
async function logout(){if(!sb)return;showLogoutConfirm()}
function nav(page){const admin=isAdmin(user)||isOwnerName(user);const items=[["dashboard","▦","대시보드"],["requests","▤","이용권 신청"],["bot","⌘","봇 관리"],["servers","◈","서버 관리"],["support","✉","문의 센터"]];if(experimentMember)items.push(["lab","✧","실험실"]);if(admin)items.push(["admin","⚙","관리자"]);const html=items.map(([id,icon,label])=>'<a class="'+(page===id?"active":"")+'" href="./'+id+'.html"><span class="nav-icon">'+icon+'</span>'+label+'</a>').join("");$$("[data-side-nav]").forEach(n=>n.innerHTML='<div class="nav-label">WORKSPACE</div><div class="side-nav">'+html+'</div>');$$("[data-profile-name]").forEach(n=>n.textContent=profileName);$$("[data-profile-initial]").forEach(n=>setAvatar(n,user));$$("[data-profile-id]").forEach(n=>n.textContent=discordUserId(user)||"Discord 계정");$$("[data-profile-email]").forEach(n=>n.textContent=user?.email||"이메일 정보가 제공되지 않았어요.");$$("[data-logout]").forEach(b=>b.addEventListener("click",logout));$$("[data-mobile-menu]").forEach(b=>{if(b.dataset.menuBound)return;b.dataset.menuBound="1";b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","메뉴 열기");b.addEventListener("click",()=>{const sidebar=$(".sidebar");if(!sidebar)return;const opening=!sidebar.classList.contains("open");sidebar.classList.toggle("open",opening);document.body.classList.toggle("mobile-nav-open",opening);b.setAttribute("aria-expanded",String(opening));b.setAttribute("aria-label",opening?"메뉴 닫기":"메뉴 열기");});});if(!document.documentElement.dataset.mobileNavBound){document.documentElement.dataset.mobileNavBound="1";document.addEventListener("click",e=>{const sidebar=$(".sidebar"),button=e.target.closest("[data-mobile-menu]");if(!sidebar?.classList.contains("open"))return;if(button||sidebar.contains(e.target))return;sidebar.classList.remove("open");document.body.classList.remove("mobile-nav-open");$$("[data-mobile-menu]").forEach(b=>{b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","메뉴 열기")});});document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;$(".sidebar")?.classList.remove("open");document.body.classList.remove("mobile-nav-open");$$("[data-mobile-menu]").forEach(b=>{b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","메뉴 열기")});});}$$(".sidebar [data-side-nav] a").forEach(a=>a.addEventListener("click",()=>{$(".sidebar")?.classList.remove("open");document.body.classList.remove("mobile-nav-open");$$("[data-mobile-menu]").forEach(b=>{b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","메뉴 열기")});}));$$("[data-admin-only]").forEach(n=>n.classList.toggle("hidden",!admin))}
async function getSession(){if(!sb)return null;const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session?.user||null}
async function requireUser(){try{user=await getSession()}catch(e){notify("로그인 상태를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.");return false}if(!user){if(location.pathname.endsWith("login.html"))return false;location.href="./login.html";return false}profileName=uname(user)||user.user_metadata?.global_name||user.email||"Discord 사용자";if(location.pathname.endsWith("login.html"))return false;return true}
function shell(page,title,subtitle){nav(page);const titleEl=$("[data-page-title]");if(titleEl)titleEl.textContent=title;const sub=$("[data-page-subtitle]");if(sub)sub.textContent=subtitle||"";const userLabel=$("[data-top-user]");if(userLabel)userLabel.textContent=profileName}
async function count(table,filters){let q=sb.from(table).select("id",{count:"exact",head:true});for(const [k,v] of Object.entries(filters||{}))q=q.eq(k,v);const {count,error}=await q;if(error){console.error("Supabase count error:",table,error);return null}return count}
function statusBadge(s){const map={pending:["확인 대기","amber"],approved:["승인됨","blue"],rejected:["거절됨","red"],completed:["완료","green"],paid:["입금 확인","green"],active:["활성","green"],inactive:["중지","red"]};const x=map[s]||[s||"확인 필요",""];return '<span class="badge '+x[1]+'">'+x[0]+"</span>"}
async function loadDashboard(){
shell("dashboard","대시보드","TEND 이용 현황과 최근 신청을 확인하세요.");
void loadDashboardServerStatus();
let counts,recent;try{[counts,recent]=await withTimeout(Promise.all([Promise.all([count("purchase_requests",{user_id:user.id}),count("purchase_requests",{user_id:user.id,status:"pending"}),count("purchase_requests",{user_id:user.id,status:"approved"}),count("purchase_requests",{user_id:user.id,status:"completed"})]),sb.from("purchase_requests").select("id,plan,server_name,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(5)]));}catch(e){console.error("dashboard data load timeout:",e);counts=[null,null,null,null];recent={data:null,error:{message:"요청 시간이 초과됐어요."}};notify("데이터를 불러오는 데 시간이 오래 걸려요. 새로고침해 주세요.");}
["#stat-all","#stat-pending","#stat-approved","#stat-completed"].forEach((sel,i)=>{const el=$(sel);if(el)el.textContent=counts[i]===null?"오류":String(counts[i])});
const {data,error}=recent;
const tbody=$("#recent-requests");
if(error){console.error("purchase_requests load error:",error);if(tbody)tbody.innerHTML='<tr><td colspan="4">신청 내역 오류: '+escapeHtml(error.message||error.code||"알 수 없는 오류")+'</td></tr>';}
else if(!data?.length){if(tbody)tbody.innerHTML='<tr><td colspan="4" class="empty">아직 신청 내역이 없어요.</td></tr>';}
else if(tbody){tbody.innerHTML=data.map(r=>'<tr><td>'+escapeHtml(r.server_name)+'</td><td>'+escapeHtml(r.plan)+'</td><td>'+statusBadge(r.status)+'</td><td>'+new Date(r.created_at).toLocaleDateString("ko-KR")+'</td></tr>').join("");}
const refresh=$("#refresh-server-status");if(refresh&&!refresh.dataset.bound){refresh.dataset.bound="1";refresh.addEventListener("click",loadDashboardServerStatus);}
}
async function loadDashboardServerStatus(){
const box=$("#dashboard-server-status");if(!box)return;
box.innerHTML='<div class="empty">서버 상태를 확인하는 중…</div>';
let req;try{req=await withTimeout(sb.from("purchase_requests").select("server_id,server_name,status,plan").eq("user_id",user.id).in("status",["approved","completed"]).not("server_id","is",null).order("created_at",{ascending:false}));}catch(e){console.error("dashboard server requests timeout:",e);box.innerHTML='<div class="empty">서버 정보를 불러오지 못했어요. 새로고침해 주세요.</div>';return;}
if(req.error){console.error("dashboard server requests error:",req.error);box.innerHTML='<div class="empty">이용권 조회 오류: '+escapeHtml(req.error.message||req.error.code||"알 수 없는 오류")+'</div>';return;}
const unique=[];const seen=new Set();(req.data||[]).forEach(r=>{if(r.server_id&&!seen.has(r.server_id)){seen.add(r.server_id);unique.push(r)}});
const freeResult=await withTimeout(sb.from("free_entitlements").select("server_id,server_name,status").eq("user_id",user.id).eq("status","active"));
if(freeResult.error){console.error("FREE server status query failed:",freeResult.error);box.innerHTML="<div class=\"empty\">무료 서버 상태를 불러오지 못했어요.</div>";return;}
(freeResult.data||[]).forEach(r=>{if(r.server_id&&!seen.has(r.server_id)){seen.add(r.server_id);unique.push({...r,plan:"FREE"})}});
if(!unique.length){box.innerHTML='<div class="empty">아직 승인된 서버가 없어요. 이용권 신청 후 승인을 받아 주세요.</div>';return;}
let live;try{live=await withTimeout(sb.from("managed_servers").select("server_id,server_name,is_active,bot_connected,last_seen_at,updated_at").in("server_id",unique.map(r=>r.server_id)));}catch(e){console.error("managed servers timeout:",e);box.innerHTML='<div class="empty">봇 상태를 불러오지 못했어요. 새로고침해 주세요.</div>';return;}
if(live.error){console.error("managed_servers load error:",live.error);box.innerHTML='<div class="empty">봇 상태 조회 오류: '+escapeHtml(live.error.message||live.error.code||"알 수 없는 오류")+'</div>';return;}
const byId=new Map((live.data||[]).map(r=>[r.server_id,r]));
box.innerHTML='<div class="stack-list">'+unique.map(r=>{const s=byId.get(r.server_id);const recent=s?.last_seen_at&&(Date.now()-new Date(s.last_seen_at).getTime()<120000);const connected=!!s?.bot_connected&&!!recent;const state=connected?'<span class="badge green">봇 온라인</span>':'<span class="badge amber">연결 확인 필요</span>';const management=s?.is_active?'<span class="badge blue">관리 시작</span>':'<span class="badge">관리 중지</span>';const seenAt=s?.last_seen_at?new Date(s.last_seen_at).toLocaleString("ko-KR"):"접속 기록 없음";return '<div class="stack-row"><div><strong>'+escapeHtml(s?.server_name||r.server_name||"Discord 서버")+'</strong><small>마지막 응답: '+escapeHtml(seenAt)+'</small></div><div class="stack-actions">'+state+management+'</div></div>'}).join("")+'</div>';
}
async function loadRequests(){
shell("requests","이용권 신청","FREE는 신청 즉시 자동 승인되고, 유료 이용권은 입금 확인 후 승인돼요.");
const form=$("#request-form"),select=$("#server-select"),help=$("#server-select-help");
const nameInput=$("#server-name"),idInput=$("#server-id");
const planSelect=$("#plan"),paymentPanel=$("#payment-panel"),submitButton=$("#submit-request");
const syncPlanUI=()=>{const free=planSelect?.value==="FREE";if(paymentPanel)paymentPanel.classList.toggle("hidden",free);if(submitButton)submitButton.textContent=free?"무료 플랜 신청 및 자동 승인":"신청 접수하기 →";};
planSelect?.addEventListener("change",syncPlanUI);syncPlanUI();
let discordAccessToken="";
if(!form||!select)return;
select.disabled=true;
select.innerHTML='<option value="">서버 목록을 불러오는 중…</option>';
let manageable=[];
try{
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError)throw sessionError;
 const accessToken=session?.provider_token||"";
  discordAccessToken=accessToken;
 if(!accessToken){
  select.innerHTML='<option value="">Discord 서버 권한 연결이 필요해요</option>';
  if(help)help.textContent="서버 목록을 불러오려면 Discord 계정 연결을 다시 진행해 주세요.";
  notify("Discord 서버 목록 권한이 필요해요. 로그아웃 후 다시 로그인해 주세요.");
 }else{
  const response=await withTimeout(fetch("https://discord.com/api/v10/users/@me/guilds",{headers:{Authorization:"Bearer "+accessToken}}));
  if(!response.ok)throw new Error(response.status===401?"Discord 인증이 만료됐어요. 다시 로그인해 주세요.":response.status===403?"Discord 서버 목록 권한이 필요해요. 로그아웃 후 다시 로그인해 주세요.":"Discord 서버 목록을 불러오지 못했어요. ("+response.status+")");
  const guilds=await response.json();
  manageable=(Array.isArray(guilds)?guilds:[]).filter(g=>{
   if(g.owner)return true;
   try{return (BigInt(g.permissions||"0")&8n)===8n}catch{return false}
  }).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ko"));
 }
}catch(error){
 console.error("Discord guild list load failed:",error);
 select.innerHTML='<option value="">서버 목록을 불러오지 못했어요</option>';
 if(help)help.textContent=error.message||"잠시 후 다시 시도해 주세요.";
}
let blockedIds=new Set();
if(manageable.length){
 const {data:requests,error:requestError}=await withTimeout(sb.from("purchase_requests").select("server_id,status,expires_at,updated_at,created_at,plan").eq("user_id",user.id).in("status",["pending","approved","completed"]).not("server_id","is",null));
 if(requestError)console.error("Existing server application lookup failed:",requestError);
 else{
  const ids=[...new Set((requests||[]).map(r=>r.server_id).filter(Boolean))];
  let liveMap=new Map();
  if(ids.length){
   const {data:live,error:liveError}=await withTimeout(sb.from("managed_servers").select("server_id,expires_at").in("server_id",ids));
   if(liveError)console.error("Managed server expiry lookup failed:",liveError);
   else liveMap=new Map((live||[]).map(r=>[r.server_id,r.expires_at]));
  }
  const now=Date.now();
  (requests||[]).forEach(r=>{
   const expiry=liveMap.get(r.server_id)||r.expires_at;
   const durationDays=String(r.plan||"").startsWith("1일")?1:String(r.plan||"").startsWith("7일")?7:String(r.plan||"").startsWith("30일")?30:0;
   const startAt=r.updated_at||r.created_at;
   const fallbackExpiry=durationDays&&startAt?new Date(new Date(startAt).getTime()+durationDays*86400000).toISOString():null;
   const effectiveExpiry=expiry||fallbackExpiry;
   const active=r.status==="pending"||!effectiveExpiry||new Date(effectiveExpiry).getTime()>now;
   if(active)blockedIds.add(String(r.server_id));
  });
 }
 const available=manageable.filter(g=>!blockedIds.has(String(g.id)));
 select.innerHTML='<option value="">신청할 서버를 선택해 주세요</option>';
 available.forEach(g=>{
  const option=document.createElement("option");
  option.value=String(g.id);
  option.textContent=g.name;
  option.dataset.name=g.name;
  select.append(option);
 });
 if(!available.length){
  select.innerHTML='<option value="">신청 가능한 서버가 없어요</option>';
  if(help)help.textContent="이미 신청했거나 이용 기간이 남아 있는 서버는 목록에서 숨겨져요. 이용 기간이 끝나면 다시 신청할 수 있어요.";
 }else if(help)help.textContent="신청 가능한 서버 "+available.length+"개가 표시돼요. 이미 신청했거나 이용 기간이 남은 서버는 표시되지 않아요.";
}
select.disabled=false;
const inviteBox=$("#request-invite-result");
function updateRequestInvite(){
 const option=select.selectedOptions[0];
 const serverId=select.value||"";
 const serverName=option?.dataset?.name||"";
 if(nameInput)nameInput.value=serverName;
 if(idInput)idInput.value=serverId;
 if(!inviteBox)return;
 inviteBox.replaceChildren();
 if(!serverId||!serverName){inviteBox.classList.add("hidden");return}
 inviteBox.classList.remove("hidden");
 const heading=document.createElement("strong");
 heading.textContent="신청 전에 TEND 봇을 초대해 주세요";
 const description=document.createElement("p");
 description.textContent=serverName+" 서버에 TEND 봇을 추가한 뒤 이용권 신청을 접수해 주세요.";
 inviteBox.append(heading,description);
 const invite=new URL("https://discord.com/oauth2/authorize");
 invite.searchParams.set("client_id","1543239879633412186");
 invite.searchParams.set("permissions","8");
 invite.searchParams.set("integration_type","0");
 invite.searchParams.set("scope","bot");
 invite.searchParams.set("guild_id",serverId);
 invite.searchParams.set("disable_guild_select","true");
 const link=document.createElement("a");
 link.className="btn btn-blue";
 link.href=invite.toString();
 link.target="_blank";
 link.rel="noopener noreferrer";
 link.textContent="선택한 서버에 TEND 봇 초대 ↗";
 link.style.marginTop="8px";
 inviteBox.append(link);
}
select.addEventListener("change",updateRequestInvite);
updateRequestInvite();
const freeStatus=$("#free-plan-status");
const renderFreeEntitlements=async()=>{
 if(!freeStatus)return;
 const result=await sb.from("free_entitlements").select("server_id,server_name,status,created_at").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:false});
 if(result.error){console.warn("FREE entitlement list unavailable:",result.error);freeStatus.textContent="무료 이용 현황을 불러오지 못했어요.";return;}
 freeStatus.innerHTML=result.data?.length?'<div class="stack-list">'+result.data.map(x=>'<div class="setting-row"><div><strong>'+escapeHtml(x.server_name)+'</strong><small>FREE · 기간 제한 없음</small></div><span class="badge green">자동 승인 · 이용 중</span></div>').join("")+'</div>':'<div class="empty">아직 활성화된 무료 서버가 없어요.</div>';
};
void renderFreeEntitlements();
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!sb||!user)return;
 const plan=planSelect?.value||"1일",serverId=select.value;
 const option=select.selectedOptions[0],name=option?.dataset?.name||"";
 if(!serverId||!name){notify("신청할 Discord 서버를 선택해 주세요.");select.focus();return}
 if(!/^[0-9]{17,20}$/.test(serverId)){notify("서버 정보를 다시 불러와 주세요.");return}
 const b=submitButton;b.disabled=true;b.textContent=plan==="FREE"?"무료 플랜 활성화 중…":"저장 중…";
 try{
  if(plan==="FREE"){
   if(!discordAccessToken)throw new Error("Discord 서버 권한 확인이 필요해요. 다시 로그인해 주세요.");
   const {data,error}=await sb.functions.invoke("discord-action",{body:{action:"activate_free",server_id:serverId,server_name:name,provider_token:discordAccessToken}});
   if(error||data?.error)throw new Error(data?.error||error?.message||"무료 플랜을 활성화하지 못했어요.");
   notify(data?.already_active?"이미 FREE 플랜을 이용 중이에요.":"FREE 신청이 자동 승인되어 활성화됐어요.");
   await renderFreeEntitlements();
  }else{
   const {error}=await sb.from("purchase_requests").insert({user_id:user.id,plan,server_name:name,server_id:serverId,status:"pending",payment_status:"unpaid"});
   if(error)throw error;
   notify("신청이 접수됐어요. 봇 초대와 입금 확인 후 관리가 시작돼요.");
   await loadRequestTable();
  }
  form.reset();select.value="";if(nameInput)nameInput.value="";if(idInput)idInput.value="";
  updateRequestInvite();syncPlanUI();
 }catch(error){console.error("Plan application failed:",error);notify(error.message||"신청 처리에 실패했어요.");}
 finally{b.disabled=false;syncPlanUI();}
});
await loadRequestTable();
async function loadRequestTable(){const t=$("#request-table");if(!t)return;let result;try{result=await withTimeout(sb.from("purchase_requests").select("id,plan,server_name,status,payment_status,rejection_reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50));}catch(e){console.error("request table timeout:",e);t.innerHTML='<tr><td colspan="5" class="empty">신청 내역을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.</td></tr>';return}const {data,error}=result;if(error){t.innerHTML='<tr><td colspan="5">신청 내역을 불러오지 못했어요.</td></tr>';return}if(!data?.length){t.innerHTML='<tr><td colspan="5" class="empty">아직 신청 내역이 없어요.</td></tr>';return}t.innerHTML=data.map(r=>'<tr><td>'+escapeHtml(r.server_name)+'</td><td>'+escapeHtml(r.plan)+'</td><td>'+statusBadge(r.status)+(r.rejection_reason?'<small class="reason-text">사유: '+escapeHtml(r.rejection_reason)+'</small>':"")+'</td><td>'+statusBadge(r.payment_status||"unpaid")+'</td><td>'+new Date(r.created_at).toLocaleDateString("ko-KR")+'</td></tr>').join("")}
async function loadBot(){
if(window.TEND_BOT_MANAGEMENT){await window.TEND_BOT_MANAGEMENT.init({sb,user,profileName,shell,notify,escapeHtml,discordIds});return}
shell("bot","봇 관리","서버 운영에 필요한 기능을 설정하세요.");
const {data,error}=await sb.from("bot_settings").select("*").eq("user_id",user.id).maybeSingle();
if(error&&error.code!=="PGRST116"){notify("봇 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");return}
if(data){
["welcome_enabled","log_enabled","auto_moderation_enabled"].forEach(k=>{const el=$("#"+k);if(el)el.checked=!!data[k]});
if($("#log-channel"))$("#log-channel").value=data.log_channel_id||"";
if($("#welcome-message"))$("#welcome-message").value=data.welcome_message||"";
if($("#moderation-level"))$("#moderation-level").value=data.moderation_level||"standard";
if($("#bot-server-id"))$("#bot-server-id").value=data.server_id||"";
const connected=!!data.bot_connected;
if($("#bot-status")){$("#bot-status").textContent=connected?"연결됨":"연결 대기";$("#bot-status").className="badge "+(connected?"green":"amber")}
if($("#bot-health")){$("#bot-health").textContent=connected?"온라인":"응답 대기";$("#bot-health").className="badge "+(connected?"green":"amber")}
if($("#bot-last-seen"))$("#bot-last-seen").textContent=data.last_seen_at?new Date(data.last_seen_at).toLocaleString("ko-KR"):"—";
}
$("#bot-form")?.addEventListener("submit",async e=>{
e.preventDefault();const serverId=$("#bot-server-id")?.value.trim()||"";
if(!/^\d{5,30}$/.test(serverId)){notify("Discord 서버 ID는 숫자 5~30자리로 입력해 주세요.");return}
const b=$("#save-bot");b.disabled=true;
const payload={user_id:user.id,server_id:serverId,welcome_enabled:$("#welcome_enabled").checked,log_enabled:$("#log_enabled").checked,auto_moderation_enabled:$("#auto_moderation_enabled").checked,log_channel_id:$("#log-channel").value.trim()||null,welcome_message:$("#welcome-message").value.trim(),moderation_level:$("#moderation-level").value,updated_at:new Date().toISOString()};
const {error}=await sb.from("bot_settings").upsert(payload,{onConflict:"user_id"});b.disabled=false;
if(error){console.error(error);notify("설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");return}
notify("설정을 저장했어요. 실제 기능은 서비스 연결 완료 후 사용할 수 있어요.");
});
const commandForm=$("#bot-command-form");
commandForm?.addEventListener("submit",async e=>{
e.preventDefault();const serverId=$("#bot-server-id")?.value.trim()||"";
if(!/^\d{5,30}$/.test(serverId)){notify("먼저 서버 ID를 저장해 주세요.");return}
const type=$("#bot-command-type").value;const extra=$("#bot-command-payload").value.trim();
const b=$("#send-bot-command");b.disabled=true;
const {error}=await sb.from("bot_commands").insert({user_id:user.id,server_id:serverId,command_type:type,payload:extra?{text:extra}:{},status:"queued"});
b.disabled=false;
if(error){console.error(error);notify("요청을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.");return}
$("#bot-command-payload").value="";notify("작업 요청을 등록했어요.");await loadBotCommands();
});
await loadBotCommands();
}
async function loadBotCommands(){
const t=$("#bot-command-list");if(!t)return;
const {data,error}=await sb.from("bot_commands").select("id,command_type,status,result,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
if(error){t.innerHTML='<tr><td colspan="4" class="empty">명령 요청을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return}
if(!data?.length){t.innerHTML='<tr><td colspan="4" class="empty">등록된 명령 요청이 없어요.</td></tr>';return}
const names={sync:"서버 정보 동기화",post_announcement:"공지 전송",refresh_roles:"역할 정보 갱신",management_start:"관리 시작",management_stop:"관리 종료",start_management:"관리 시작",stop_management:"관리 종료",feature_config:"기능 설정",automation_config:"자동화 설정",forbidden_word_add:"금칙어 추가",forbidden_word_enable:"금칙어 활성",forbidden_word_delete:"금칙어 삭제",forbidden_word_list:"금칙어 목록",warning_add:"경고 부여",warning_list:"경고 목록",warning_cancel:"경고 취소",announcement_send:"공지 발송",announcement_schedule:"공지 예약",announcement_edit:"공지 수정",announcement_delete:"공지 삭제",announcement_channel_add:"공지 채널 추가",announcement_channel_delete:"공지 채널 삭제",ticket_config:"티켓 설정",ticket_type_config:"티켓 유형 설정",ticket_panel:"티켓 패널",ticket_open:"티켓 열기",ticket_close:"티켓 닫기",ticket_reopen:"티켓 재개",ticket_assign:"티켓 담당",ticket_history:"티켓 기록",ticket_note:"티켓 메모",ticket_delete:"티켓 삭제",role_panel:"역할 패널",role_menu:"역할 메뉴",role_panel_delete:"역할 패널 삭제",poll_create:"투표 생성",poll:"투표",poll_cancel:"투표 취소",poll_close:"투표 종료",blocklist_add:"차단 목록 추가",block_nickname_add:"차단 닉네임 추가",server_blacklist_add:"서버 블랙리스트 추가",server_backup:"서버 백업",backup_preview:"백업 미리보기"};
const states={queued:["대기 중","amber"],processing:["처리 중","blue"],completed:["완료","green"],failed:["실패","red"]};
t.innerHTML=data.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(names[r.command_type]||r.command_type)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.result||"—")+'</td></tr>'}).join("");
}
async function loadServers(){
shell("servers","서버 관리","FREE 플랜과 유료 이용권으로 연결한 서버를 확인하세요.");
const box=$("#server-list");if(!box)return;box.innerHTML='<div class="empty">서버 목록을 불러오는 중…</div>';
let paid,free;
try{[paid,free]=await withTimeout(Promise.all([
sb.from("purchase_requests").select("id,server_name,server_id,plan,status,created_at,expires_at").eq("user_id",user.id).eq("status","approved").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100),
sb.from("free_entitlements").select("server_name,server_id,status,created_at").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:false})
]));}catch(e){console.error("server list timeout:",e);box.innerHTML='<div class="empty">서버 목록을 불러오지 못했어요. 새로고침해 주세요.</div>';return}
if(paid.error||free.error){console.error("server entitlement list error:",paid.error||free.error);box.innerHTML='<div class="empty">서버 권한을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';return}
const map=new Map();
(free.data||[]).forEach(r=>{if(r.server_id)map.set(r.server_id,{...r,plan:"FREE",free:true})});
(paid.data||[]).forEach(r=>{if(r.server_id)map.set(r.server_id,{...r,free:false})});
const rows=[...map.values()];
if(!rows.length){box.innerHTML='<div class="empty">아직 연결된 서버가 없어요. FREE 플랜을 활성화하거나 이용권을 신청해 주세요.</div>';return}
const ids=[...new Set(rows.map(r=>r.server_id).filter(Boolean))];let liveRows=[];
if(ids.length){try{const live=await withTimeout(sb.from("managed_servers").select("server_id,server_name,bot_connected,management_available,is_active,expires_at,last_seen_at").in("server_id",ids));if(live.error)console.error("managed server status error:",live.error);else liveRows=live.data||[]}catch(e){console.error("managed server status timeout:",e)}}
const liveMap=new Map(liveRows.map(x=>[x.server_id,x]));const clientId=String(cfg.discordBotClientId||"1543239879633412186").trim();
box.innerHTML=rows.map(r=>{const s=liveMap.get(r.server_id),expiry=s?.expires_at||r.expires_at,expired=!r.free&&expiry&&new Date(expiry).getTime()<=Date.now(),available=r.free?!!s?.bot_connected:!!s?.management_available&&!!s?.bot_connected&&!expired;
const invite=clientId&&r.server_id&&!s?.bot_connected?'https://discord.com/oauth2/authorize?client_id='+encodeURIComponent(clientId)+'&scope=bot%20applications.commands&permissions='+encodeURIComponent(String(cfg.discordBotPermissions||"0"))+'&guild_id='+encodeURIComponent(r.server_id)+'&disable_guild_select=true':"";
const state=expired?'<span class="badge red">기간 만료</span>':available?'<span class="badge green">이용 가능</span>':'<span class="badge amber">봇 연결 확인</span>';
const until=r.free?"기간 제한 없음":expiry?new Date(expiry).toLocaleString("ko-KR"):"이용 기간 확인 중";
return '<div class="setting-row"><div><strong>'+escapeHtml(s?.server_name||r.server_name||"Discord 서버")+'</strong><small>서버 ID: '+escapeHtml(r.server_id||"미등록")+'</small><small>'+(r.free?"FREE · 무제한":escapeHtml(r.plan)+" · 만료: "+escapeHtml(until))+'</small><small>'+(s?.bot_connected?"봇 연결됨":"봇 미연결")+'</small></div><div class="stack-actions">'+state+(invite?'<a class="btn btn-blue" target="_blank" rel="noopener noreferrer" href="'+invite+'">봇 초대</a>':"")+'</div></div>';}).join("");
}
async function loadExperimentAdmin(){
const host=$("#experiment-member-list"),search=$("#experiment-member-search"),countEl=$("#experiment-member-count");
if(!host)return;
host.innerHTML='<div class="empty">멤버 목록을 불러오는 중…</div>';
let membersResult,experimentsResult;
try{[membersResult,experimentsResult]=await Promise.all([
withTimeout(sb.from("tend_members").select("user_id,discord_id,display_name,updated_at").order("updated_at",{ascending:false}).limit(500)),
withTimeout(sb.from("tend_experiment_members").select("user_id,assigned_at").limit(1000))
])}catch(e){console.error("Experiment member list timeout:",e);host.innerHTML='<div class="empty">멤버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';return}
if(membersResult.error||experimentsResult.error){console.error("Experiment member list error:",membersResult.error||experimentsResult.error);host.innerHTML='<div class="empty">멤버 목록을 불러오지 못했어요. Supabase SQL Editor에서 experiment-lab.sql을 먼저 실행해 주세요.</div>';return}
const members=membersResult.data||[],assigned=new Map((experimentsResult.data||[]).map(x=>[x.user_id,x]));
if(countEl)countEl.textContent=members.length+"명";
const render=()=>{
const term=(search?.value||"").trim().toLowerCase();
const rows=members.filter(m=>[m.display_name,m.discord_id,m.user_id].some(v=>String(v||"").toLowerCase().includes(term)));
host.innerHTML=rows.length?rows.map(m=>{
const active=assigned.has(m.user_id);
return '<article class="experiment-member-row"><div class="experiment-member-info"><strong>'+escapeHtml(m.display_name||"이름 없는 멤버")+'</strong><small>Discord ID · '+escapeHtml(m.discord_id||"확인되지 않음")+'</small><small>계정 ID · '+escapeHtml(m.user_id)+'</small></div><div class="experiment-member-action">'+(active?'<span class="badge green">실험 인원</span><button class="btn btn-light" data-experiment-remove="'+escapeHtml(m.user_id)+'">해제</button>':'<button class="btn btn-blue" data-experiment-add="'+escapeHtml(m.user_id)+'">실험 인원 지정</button>')+'</div></article>';
}).join(""):'<div class="empty">검색 결과가 없어요.</div>';
host.querySelectorAll("[data-experiment-add]").forEach(button=>button.addEventListener("click",async()=>{
button.disabled=true;
const {error}=await sb.from("tend_experiment_members").insert({user_id:button.dataset.experimentAdd,assigned_by:user.id});
button.disabled=false;
if(error){console.error(error);notify("실험 인원으로 지정하지 못했어요.");return}
notify("실험 인원으로 지정했어요.");await loadExperimentAdmin();
}));
host.querySelectorAll("[data-experiment-remove]").forEach(button=>button.addEventListener("click",async()=>{
if(!confirm("이 멤버를 실험 인원에서 해제할까요?"))return;
button.disabled=true;
const {error}=await sb.from("tend_experiment_members").delete().eq("user_id",button.dataset.experimentRemove);
button.disabled=false;
if(error){console.error(error);notify("실험 인원 해제에 실패했어요.");return}
notify("실험 인원에서 해제했어요.");await loadExperimentAdmin();
}));
};
if(search&&!search.dataset.bound){search.dataset.bound="1";search.addEventListener("input",render)}
render();
}
async function loadLab(){
shell("lab","실험실","새로운 기능을 먼저 만나볼 수 있는 공간이에요.");
const {data,error}=await sb.from("tend_experiment_members").select("user_id").eq("user_id",user.id).maybeSingle();
if(error||!data){experimentMember=false;notify("실험실 이용 권한이 없어요.");location.replace("./dashboard.html");return}
if(window.TEND_LAB){await window.TEND_LAB.init({sb,user,notify,escapeHtml,withTimeout});return}
notify("실험실 기능 파일을 불러오지 못했어요.");
}
async function loadAdmin(){
shell("admin","관리자 대시보드","신청을 승인하거나 거절하고, 처리 사유를 남길 수 있습니다.");
if(!isAdmin(user)){const t=$("#admin-requests");if(t)t.innerHTML='<tr><td colspan="8" class="empty">이 계정은 관리자 계정이 아닙니다.</td></tr>';notify("관리자 계정만 이용할 수 있어요.");return}
await loadExperimentAdmin();
let totals;try{totals=await withTimeout(Promise.all([count("purchase_requests",{}),count("purchase_requests",{status:"pending"}),count("purchase_requests",{status:"rejected"}),count("purchase_requests",{status:"approved"})]));}catch(e){console.error("admin counts timeout:",e);totals=[null,null,null,null]}const [total,pending,unpaid,active]=totals;
$("#admin-total").textContent=total??"—";$("#admin-pending").textContent=pending??"—";$("#admin-unpaid").textContent=unpaid??"—";$("#admin-active").textContent=active??"—";
let result;try{result=await withTimeout(sb.from("purchase_requests").select("id,user_id,plan,server_name,server_id,status,payment_status,rejection_reason,created_at,expires_at").order("created_at",{ascending:false}).limit(100));}catch(e){console.error("admin request list timeout:",e);const table=$("#admin-requests");if(table)table.innerHTML='<tr><td colspan="8" class="empty">신청 목록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.</td></tr>';return}const {data,error}=result;
const table=$("#admin-requests");
if(error){table.innerHTML='<tr><td colspan="8">신청 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return}
if(!data?.length){table.innerHTML='<tr><td colspan="8" class="empty">신청이 없습니다.</td></tr>';return}
table.innerHTML=data.map(r=>'<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(r.server_name||"Discord 서버")+'<small>서버 ID: '+escapeHtml(r.server_id||"미등록")+'</small></td><td>'+escapeHtml(r.plan)+'</td><td>'+escapeHtml(r.user_id)+'</td><td>'+statusBadge(r.status)+'</td><td>'+escapeHtml(r.rejection_reason||"—")+'</td><td>'+(r.expires_at?escapeHtml(new Date(r.expires_at).toLocaleString("ko-KR")):"승인 전")+'</td><td>'+(r.status==="pending"?'<button class="btn btn-blue" data-approve="'+r.id+'">승인</button> <button class="btn btn-light" data-reject="'+r.id+'">거절</button>':"처리됨")+'</td></tr>').join("");
$$("[data-approve]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("이 신청을 승인하고 이용 기간을 시작할까요?"))return;b.disabled=true;const {error}=await sb.from("purchase_requests").update({status:"approved",rejection_reason:"",updated_at:new Date().toISOString()}).eq("id",b.dataset.approve).eq("status","pending");b.disabled=false;if(error){console.error(error);notify("승인하지 못했어요. 다시 시도해 주세요.");return}notify("승인 완료! 이용 기간이 자동으로 시작됐어요.");await loadAdmin()}));
$$("[data-reject]").forEach(b=>b.addEventListener("click",async()=>{const reason=prompt("거절 사유를 입력해 주세요.");if(reason===null)return;b.disabled=true;const {error}=await sb.from("purchase_requests").update({status:"rejected",rejection_reason:reason.trim()||"신청 거절",updated_at:new Date().toISOString()}).eq("id",b.dataset.reject).eq("status","pending");b.disabled=false;if(error){console.error(error);notify("거절 처리하지 못했어요. 다시 시도해 주세요.");return}notify("신청을 거절했어요.");await loadAdmin()}))
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$$("[data-copy-account]").forEach(b=>b.addEventListener("click",async()=>{const account="1908-3953-4245";try{await navigator.clipboard.writeText(account);notify("계좌번호를 복사했어요.");}catch{const input=document.createElement("textarea");input.value=account;document.body.appendChild(input);input.select();const ok=document.execCommand("copy");input.remove();notify(ok?"계좌번호를 복사했어요.":"계좌번호를 직접 선택해 복사해 주세요.");}}));
function setupTheme(){const key="tend-theme",root=document.documentElement,buttons=Array.from(document.querySelectorAll("[data-theme-toggle]"));let saved="light";try{saved=localStorage.getItem(key)||"light"}catch{}const apply=theme=>{const dark=theme==="dark";root.classList.toggle("theme-dark",dark);buttons.forEach(button=>{button.innerHTML=dark?"☀ <span>라이트 모드</span>":"☾ <span>다크 모드</span>";button.setAttribute("aria-label",dark?"라이트 모드로 전환":"다크 모드로 전환")})};apply(saved);buttons.forEach(button=>button.addEventListener("click",()=>{const next=root.classList.contains("theme-dark")?"light":"dark";try{localStorage.setItem(key,next)}catch{}apply(next)}))}
setupTheme();
async function init(){if(!sb){console.error("TEND Supabase initialization failed",{supabaseLibraryLoaded:!!window.supabase,configLoaded:!!window.TEND_CONFIG,urlConfigured:!!cfg.supabaseUrl,keyConfigured:!!cfg.supabaseAnonKey});notify("Supabase 연결 실패: 설정 파일 또는 Supabase 라이브러리를 불러오지 못했어요. 새로고침해 주세요.");return}const page=document.body.dataset.page;let loginConfirmed=false,loginCheckTimer=null;const confirmLoginUser=async(candidate)=>{if(page!=="login"||loginConfirmed)return;let current=candidate||null;if(!current){try{current=await getSession()}catch(error){console.error("Discord session check failed:",error);return}}if(!current)return;loginConfirmed=true;if(loginCheckTimer)clearInterval(loginCheckTimer);user=current;profileName=uname(user)||user.user_metadata?.global_name||user.email||"Discord 사용자";showAccountConfirm(user)};sb.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){if(page!=="login")location.href="./login.html";return}if(page==="login"&&session?.user)confirmLoginUser(session.user)});if(page==="login"){$("#discord-login")?.addEventListener("click",login);$("#login-back")?.addEventListener("click",()=>location.href="./index.html");await confirmLoginUser();if(!loginConfirmed){let checks=0;loginCheckTimer=setInterval(()=>{checks++;confirmLoginUser();if(checks>=30&&!loginConfirmed)clearInterval(loginCheckTimer)},300)}return}if(!await requireUser())return;void sb.from("tend_members").upsert({user_id:user.id,discord_id:discordUserId(user)||null,display_name:profileName,updated_at:new Date().toISOString()},{onConflict:"user_id"}).then(({error})=>{if(error)console.warn("TEND member profile sync failed:",error.message)}).catch(e=>console.warn("TEND member profile sync failed:",e));try{const {data:experimentData,error:experimentError}=await sb.from("tend_experiment_members").select("user_id").eq("user_id",user.id).maybeSingle();experimentMember=!experimentError&&!!experimentData}catch(e){console.warn("TEND experiment access check failed:",e);experimentMember=false}if(page==="dashboard")await loadDashboard();else if(page==="requests")await loadRequests();else if(page==="bot")await loadBot();else if(page==="servers")await loadServers();else if(page==="support"){shell("support","문의 센터","TEND 고객지원과 1:1로 대화할 수 있어요.");if(window.TEND_SUPPORT)await window.TEND_SUPPORT.init({sb,user,profileName,isAdmin:isAdmin(user)||isOwnerName(user),notify,escapeHtml});else notify("문의 센터 파일을 불러오지 못했어요.");}else if(page==="lab"){await loadLab();}else if(page==="admin"){await loadAdmin();if(window.TEND_SUPPORT)await window.TEND_SUPPORT.init({sb,user,profileName,isAdmin:isAdmin(user)||isOwnerName(user),notify,escapeHtml});}}
init().catch(e=>{console.error("TEND init failed:",e);const toast=document.querySelector("#toast");if(toast){toast.textContent="화면을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.";toast.classList.add("show");}document.querySelectorAll(".empty").forEach(el=>{if(/불러오는 중|확인하는 중/.test(el.textContent))el.textContent="불러오지 못했어요. 새로고침 후 다시 시도해 주세요.";});});
})();