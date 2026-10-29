(() => {
const cfg=window.TEND_CONFIG||{};
const sb=window.supabase&&cfg.supabaseUrl&&cfg.supabaseAnonKey?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null,profileName="사용자";
const toast=$("#toast");
function notify(s){if(!toast)return;toast.textContent=s;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),3000)}
function discordNames(u){const m=u?.user_metadata||{};const names=[m.user_name,m.preferred_username,m.username,m.custom_claims?.global_name,m.global_name,m.full_name,m.name,m.nickname,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[d.user_name,d.preferred_username,d.username,d.global_name,d.name]})];return names.filter(Boolean).map(v=>String(v).trim().toLowerCase())}
function uname(u){return discordNames(u)[0]||""}
function discordIds(u){const m=u?.user_metadata||{},a=u?.app_metadata||{};return [m.sub,m.provider_id,m.id,m.user_id,a.provider_id,a.sub,...(u?.identities||[]).flatMap(i=>{const d=i?.identity_data||{};return[i.id,d.sub,d.provider_id,d.id,d.user_id]})].filter(Boolean).map(String)}
function isOwnerName(u){return discordNames(u).includes("pengin_hi22")}
function isAdmin(u){return u?.app_metadata?.role==="admin"||discordIds(u).includes("1318120987480424498")}
function goto(p){location.href="./"+p+".html"}
async function login(){if(!sb){notify("로그인 서비스를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.");return}const base=location.origin+location.pathname.replace(/[^/]*$/,"");const {error}=await sb.auth.signInWithOAuth({provider:"discord",options:{redirectTo:base+"login.html"}});if(error)notify("로그인에 실패했어요: "+error.message)}
async function logout(){if(!sb)return;const {error}=await sb.auth.signOut();if(error)notify("로그아웃에 실패했어요.");else location.href="./index.html"}
function nav(page){const admin=isAdmin(user)||isOwnerName(user);const items=[["dashboard","▦","대시보드"],["requests","▤","이용권 신청"],["bot","⌘","봇 관리"],["servers","◈","서버 관리"]];if(admin)items.push(["admin","⚙","관리자"]);const html=items.map(([id,icon,label])=>'<a class="'+(page===id?"active":"")+'" href="./'+id+'.html"><span class="nav-icon">'+icon+'</span>'+label+'</a>').join("");$$("[data-side-nav]").forEach(n=>n.innerHTML='<div class="nav-label">WORKSPACE</div><div class="side-nav">'+html+'</div>');$$("[data-profile-name]").forEach(n=>n.textContent=profileName);$$("[data-profile-initial]").forEach(n=>n.textContent=(profileName[0]||"T").toUpperCase());$$("[data-logout]").forEach(b=>b.addEventListener("click",logout));$$("[data-mobile-menu]").forEach(b=>b.addEventListener("click",()=>$(".sidebar")?.classList.toggle("open")));$$("[data-admin-only]").forEach(n=>n.classList.toggle("hidden",!admin))}
async function getSession(){if(!sb)return null;const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session?.user||null}
async function requireUser(){try{user=await getSession()}catch(e){notify("로그인 상태를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.");return false}if(!user){if(location.pathname.endsWith("login.html"))return false;location.href="./login.html";return false}profileName=uname(user)||user.user_metadata?.global_name||user.email||"Discord 사용자";if(location.pathname.endsWith("login.html")){goto("dashboard");return false}return true}
function shell(page,title,subtitle){nav(page);const titleEl=$("[data-page-title]");if(titleEl)titleEl.textContent=title;const sub=$("[data-page-subtitle]");if(sub)sub.textContent=subtitle||"";const userLabel=$("[data-top-user]");if(userLabel)userLabel.textContent=profileName}
async function count(table,filters){let q=sb.from(table).select("id",{count:"exact",head:true});for(const [k,v] of Object.entries(filters||{}))q=q.eq(k,v);const {count,error}=await q;return error?null:count}
function statusBadge(s){const map={pending:["확인 대기","amber"],approved:["승인됨","blue"],rejected:["거절됨","red"],completed:["완료","green"],paid:["입금 확인","green"],active:["활성","green"],inactive:["중지","red"]};const x=map[s]||[s||"확인 필요",""];return '<span class="badge '+x[1]+'">'+x[0]+"</span>"}
async function loadDashboard(){shell("dashboard","대시보드","TEND 이용 현황과 최근 신청을 확인하세요.");const [all,pending,approved,completed]=await Promise.all([count("purchase_requests",{user_id:user.id}),count("purchase_requests",{user_id:user.id,status:"pending"}),count("purchase_requests",{user_id:user.id,status:"approved"}),count("purchase_requests",{user_id:user.id,status:"completed"})]);$("#stat-all").textContent=all??"—";$("#stat-pending").textContent=pending??"—";$("#stat-approved").textContent=approved??"—";$("#stat-completed").textContent=completed??"—";const {data,error}=await sb.from("purchase_requests").select("id,plan,server_name,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(5);const tbody=$("#recent-requests");if(error){tbody.innerHTML='<tr><td colspan="4">신청 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return}if(!data?.length){tbody.innerHTML='<tr><td colspan="4" class="empty">아직 신청 내역이 없어요.</td></tr>';return}tbody.innerHTML=data.map(r=>'<tr><td>'+escapeHtml(r.server_name)+'</td><td>'+escapeHtml(r.plan)+'</td><td>'+statusBadge(r.status)+'</td><td>'+new Date(r.created_at).toLocaleDateString("ko-KR")+'</td></tr>').join("")}
async function loadRequests(){shell("requests","이용권 신청","필요한 기간을 선택해 운영 지원을 신청하세요.");const form=$("#request-form");form?.addEventListener("submit",async e=>{e.preventDefault();if(!sb||!user)return;const plan=$("#plan").value,name=$("#server-name").value.trim(),serverId=$("#server-id").value.trim();if(!name){notify("서버 이름을 입력해 주세요.");return}if(serverId&&!/^\d{5,30}$/.test(serverId)){notify("서버 ID는 숫자만 입력해 주세요.");return}const b=$("#submit-request");b.disabled=true;b.textContent="저장 중…";const {error}=await sb.from("purchase_requests").insert({user_id:user.id,plan,server_name:name,server_id:serverId||null,status:"pending",payment_status:"unpaid"});b.disabled=false;b.textContent="신청 접수하기";if(error){console.error(error);notify("신청 저장에 실패했어요. 서비스 SQL과 RLS를 확인해 주세요.");return}notify("신청이 저장됐어요. 결제 완료 상태는 아닙니다.");form.reset();loadRequestTable()});await loadRequestTable()}
async function loadRequestTable(){const t=$("#request-table");if(!t)return;const {data,error}=await sb.from("purchase_requests").select("id,plan,server_name,status,payment_status,rejection_reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error){t.innerHTML='<tr><td colspan="5">신청 내역을 불러오지 못했어요.</td></tr>';return}if(!data?.length){t.innerHTML='<tr><td colspan="5" class="empty">아직 신청 내역이 없어요.</td></tr>';return}t.innerHTML=data.map(r=>'<tr><td>'+escapeHtml(r.server_name)+'</td><td>'+escapeHtml(r.plan)+'</td><td>'+statusBadge(r.status)+(r.rejection_reason?'<small class="reason-text">사유: '+escapeHtml(r.rejection_reason)+'</small>':"")+'</td><td>'+statusBadge(r.payment_status||"unpaid")+'</td><td>'+new Date(r.created_at).toLocaleDateString("ko-KR")+'</td></tr>').join("")}
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
const names={sync:"서버 정보 동기화",post_announcement:"공지 전송",refresh_roles:"역할 정보 갱신"};
const states={queued:["대기 중","amber"],processing:["처리 중","blue"],completed:["완료","green"],failed:["실패","red"]};
t.innerHTML=data.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(names[r.command_type]||r.command_type)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.result||"—")+'</td></tr>'}).join("");
}
async function loadServers(){shell("servers","서버 관리","내 계정으로 신청한 Discord 서버를 확인하세요.");const {data,error}=await sb.from("purchase_requests").select("id,server_name,server_id,plan,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);const box=$("#server-list");if(error){box.innerHTML='<div class="empty">서버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';return}const rows=(data||[]).filter(r=>r.status==="approved"||r.status==="completed");box.innerHTML=rows.length?rows.map(r=>'<div class="setting-row"><div><strong>'+escapeHtml(r.server_name)+'</strong><small>'+(r.server_id?'ID: '+escapeHtml(r.server_id):'서버 ID 미입력')+' · '+escapeHtml(r.plan)+' 이용권</small></div>'+statusBadge(r.status)+'</div>').join(""):'<div class="empty">승인된 서버가 아직 없어요. 이용권 신청 후 관리자 승인을 기다려 주세요.</div>'}
async function loadAdmin(){
shell("admin","관리자 대시보드","신청을 승인하거나 거절하고, 처리 사유를 남길 수 있습니다.");
if(!isAdmin(user)){const t=$("#admin-requests");if(t)t.innerHTML='<tr><td colspan="8" class="empty">이 계정은 관리자 계정이 아닙니다.</td></tr>';notify("관리자 계정만 이용할 수 있어요.");return}
const [total,pending,unpaid,active]=await Promise.all([count("purchase_requests",{}),count("purchase_requests",{status:"pending"}),count("purchase_requests",{payment_status:"unpaid"}),count("purchase_requests",{status:"completed"})]);
$("#admin-total").textContent=total??"—";$("#admin-pending").textContent=pending??"—";$("#admin-unpaid").textContent=unpaid??"—";$("#admin-active").textContent=active??"—";
const {data,error}=await sb.from("purchase_requests").select("id,user_id,plan,server_name,server_id,status,payment_status,rejection_reason,created_at").order("created_at",{ascending:false}).limit(100);
const table=$("#admin-requests");
if(error){table.innerHTML='<tr><td colspan="8">신청 목록을 불러오지 못했어요. 권한 설정을 확인해 주세요.</td></tr>';return}
if(!data?.length){table.innerHTML='<tr><td colspan="8" class="empty">신청이 없습니다.</td></tr>';return}
table.innerHTML=data.map(r=>'<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(r.server_name)+(r.server_id?"<small> · "+escapeHtml(r.server_id)+"</small>":"")+'</td><td>'+escapeHtml(r.plan)+'</td><td>'+escapeHtml(r.user_id)+'</td><td><select class="status-select" data-status="'+r.id+'"><option value="pending">확인 대기</option><option value="approved">승인</option><option value="rejected">거절</option><option value="completed">완료</option></select></td><td><select class="status-select" data-payment="'+r.id+'"><option value="unpaid">미확인</option><option value="paid">입금 확인</option><option value="refunded">환불</option></select></td><td><input class="review-reason" data-reason="'+r.id+'" maxlength="300" value="'+escapeHtml(r.rejection_reason||"")+'" placeholder="승인/거절 사유"></td><td><button class="btn btn-light" data-save-row="'+r.id+'">저장</button></td></tr>').join("");
data.forEach(r=>{const s=$('[data-status="'+r.id+'"]'),p=$('[data-payment="'+r.id+'"]');if(s)s.value=r.status;if(p)p.value=r.payment_status||"unpaid"});
$$("[data-save-row]").forEach(b=>b.addEventListener("click",async()=>{
const id=b.dataset.saveRow,s=$('[data-status="'+id+'"]').value,p=$('[data-payment="'+id+'"]').value,reason=$('[data-reason="'+id+'"]').value.trim();
if((s==="approved"||s==="rejected")&&!reason){notify("승인 또는 거절 사유를 입력해 주세요.");$('[data-reason="'+id+'"]').focus();return}
b.disabled=true;
const {error}=await sb.from("purchase_requests").update({status:s,payment_status:p,rejection_reason:reason,updated_at:new Date().toISOString()}).eq("id",id);
b.disabled=false;
if(error)notify("변경 실패. SQL 설정과 관리자 권한을 확인해 주세요.");
else{notify("신청 처리 결과를 저장했어요.");loadAdmin()}
}))
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$$("[data-copy-account]").forEach(b=>b.addEventListener("click",async()=>{const account="1908-3953-4245";try{await navigator.clipboard.writeText(account);notify("계좌번호를 복사했어요.");}catch{const input=document.createElement("textarea");input.value=account;document.body.appendChild(input);input.select();const ok=document.execCommand("copy");input.remove();notify(ok?"계좌번호를 복사했어요.":"계좌번호를 직접 선택해 복사해 주세요.");}}));
async function init(){const page=document.body.dataset.page;if(page==="login"){try{user=await getSession()}catch{}if(user){goto("dashboard");return}$("#discord-login")?.addEventListener("click",login);$("#login-back")?.addEventListener("click",()=>location.href="./index.html");return}if(!await requireUser())return;if(page==="dashboard")await loadDashboard();else if(page==="requests")await loadRequests();else if(page==="bot")await loadBot();else if(page==="servers")await loadServers();else if(page==="admin")await loadAdmin();if(sb)sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")location.href="./login.html"})}
init();
})();