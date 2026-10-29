(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  let ctx, sb, user, notify, escapeHtml, discordIds, serverId = "";
  const features = [
    ["tickets","티켓봇","패널, 담당 역할, 양식, 종료·재개 및 기록"],
    ["polls","투표","복수 선택, 익명 여부, 마감 시간 및 결과"],
    ["welcome","환영 메시지","입장 안내, 채널, 임베드 및 이미지"],
    ["goodbye","퇴장 메시지","퇴장 알림 채널과 메시지 템플릿"],
    ["auto_roles","자동 역할","신규 가입자 역할 자동 지급"],
    ["reaction_roles","역할 선택 메뉴","버튼 또는 선택 메뉴로 역할 지급"],
    ["auto_responses","문의 자동 응답","키워드별 답변과 채널 지정"],
    ["link_filter","링크 필터","허용 도메인, 초대 링크 및 위반 조치"],
    ["anti_spam","도배 방지","반복 메시지와 연속 전송 제한"],
    ["account_security","계정 보안","신규 계정 기준과 제한 정책"],
    ["server_logs","서버 로그","입퇴장, 메시지 및 역할 변경 기록"],
    ["warnings","경고 시스템","경고 사유, 누적 기준 및 자동 제재"],
    ["temporary_voice","임시 음성 채널","자동 생성, 인원 제한 및 자동 삭제"],
    ["server_backup","서버 백업","지원되는 역할·채널 구조 설정 내보내기"]
  ];
  const sid = () => serverId || ($("#managed-server-select") && $("#managed-server-select").value) || "";
  const failed = (e, message) => { if (!e) return false; console.error(e); notify(message + (e.message ? " (" + e.message + ")" : "")); return true; };
  async function ensureServer() {
    const id = sid();
    if (!id) { notify("관리할 서버를 선택해 주세요."); return false; }
    const p = await sb.from("purchase_requests").select("server_name,server_id,status").eq("user_id",user.id).eq("server_id",id).in("status",["approved","completed"]).maybeSingle();
    if (p.error || !p.data) { notify("승인된 이용권 신청에 등록된 서버만 관리할 수 있어요."); return false; }
    const existing = await sb.from("managed_servers").select("server_id").eq("server_id",id).maybeSingle();
    if (existing.error) { notify("서버 설정을 읽지 못했어요. 관리용 SQL을 적용했는지 확인해 주세요."); return false; }
    if (!existing.data) {
      const ownerId = (discordIds(user)[0] || user.id);
      const ins = await sb.from("managed_servers").insert({server_id:id,server_name:p.data.server_name || "Discord 서버",owner_id:ownerId,is_active:false});
      if (failed(ins.error,"서버 등록에 실패했어요.")) return false;
    }
    serverId = id;
    return true;
  }
  async function init(options) {
    ctx=options; sb=ctx.sb; user=ctx.user; notify=ctx.notify; escapeHtml=ctx.escapeHtml; discordIds=ctx.discordIds;
    $$("[data-bot-tab]").forEach(b=>b.addEventListener("click",()=>{const key=b.dataset.botTab;$$("[data-bot-tab]").forEach(x=>x.classList.toggle("active",x===b));$$("[data-bot-panel]").forEach(p=>p.classList.toggle("active",p.dataset.botPanel===key));}));
    $("#moderation-action").addEventListener("change",()=>$("#timeout-field").classList.toggle("hidden",$("#moderation-action").value!=="timeout"));
    $("#announcement-mention").addEventListener("change",()=>$("#announcement-role-field").classList.toggle("hidden",$("#announcement-mention").value!=="role"));
    $("#managed-server-select").addEventListener("change",async()=>{serverId=$("#managed-server-select").value;if(await ensureServer())await loadServerData();});
    $("#reload-bot-data").addEventListener("click",loadServers);
    $("#start-management").addEventListener("click",()=>management(true));
    $("#stop-management").addEventListener("click",()=>management(false));
    $("#refresh-jobs").addEventListener("click",loadJobs);
    $("#moderation-form").addEventListener("submit",saveRule);
    $("#announcement-channel-form").addEventListener("submit",saveChannel);
    $("#announcement-form").addEventListener("submit",saveAnnouncement);
    $("#blacklist-server-form").addEventListener("submit",saveBlacklistServer);
    $("#blacklist-user-form").addEventListener("submit",saveBlacklistUser);
    await loadServers();
  }
  async function loadServers() {
    const select=$("#managed-server-select");
    select.innerHTML='<option value="">승인된 서버 불러오는 중…</option>';
    const q=await sb.from("purchase_requests").select("server_id,server_name,status,created_at").eq("user_id",user.id).in("status",["approved","completed"]).not("server_id","is",null).order("created_at",{ascending:false});
    if(q.error){select.innerHTML='<option value="">서버 목록 오류</option>';notify("승인된 서버 목록을 불러오지 못했어요.");return;}
    const seen=new Set(), rows=[];
    (q.data||[]).forEach(r=>{if(r.server_id&&!seen.has(r.server_id)){seen.add(r.server_id);rows.push(r);}});
    if(!rows.length){select.innerHTML='<option value="">승인된 서버가 없습니다.</option>';serverId="";$("#managed-server-info").textContent="서버 ID를 포함해 이용권을 신청하고 관리자 승인을 받아야 합니다.";return;}
    select.innerHTML='<option value="">관리할 서버 선택</option>'+rows.map(r=>'<option value="'+escapeHtml(r.server_id)+'">'+escapeHtml(r.server_name||"Discord 서버")+' · '+escapeHtml(r.server_id)+'</option>').join("");
    if(serverId&&seen.has(serverId))select.value=serverId;else{select.value=rows[0].server_id;serverId=select.value;}
    if(await ensureServer())await loadServerData();
  }
  async function management(active) {
    if(!await ensureServer())return;
    const upd=await sb.from("managed_servers").update({is_active:active,updated_at:new Date().toISOString(),...(active?{started_at:new Date().toISOString()}:{})}).eq("server_id",sid());
    if(failed(upd.error,"관리 상태를 저장하지 못했어요."))return;
    const job=await sb.from("bot_jobs").insert({server_id:sid(),job_type:active?"start_management":"stop_management",payload:{requested_by:user.id},status:"pending"});
    if(failed(job.error,"상태는 저장했지만 봇 작업 요청을 등록하지 못했어요.")){await loadServerData();return;}
    notify(active?"관리 시작 요청을 등록했어요. 봇이 실행되면 서버 소유자에게 DM을 보냅니다.":"관리 종료 요청을 등록했어요.");
    await loadServerData();await loadJobs();
  }
  async function loadServerData() {
    const id=sid();
    const q=await sb.from("managed_servers").select("*").eq("server_id",id).maybeSingle();
    if(failed(q.error,"서버 상태를 불러오지 못했어요."))return;
    const s=q.data||{};
    $("#bot-status").textContent=s.is_active?"관리 활성":"관리 중지";
    $("#bot-status").className="badge "+(s.is_active?"green":"amber");
    $("#bot-health").textContent=s.bot_connected?"온라인":"응답 대기";
    $("#bot-health").className="badge "+(s.bot_connected?"green":"amber");
    $("#bot-last-seen").textContent=s.last_seen_at?new Date(s.last_seen_at).toLocaleString("ko-KR"):"—";
    $("#managed-server-info").textContent=($("#managed-server-select").selectedOptions[0]?.textContent||id)+" · "+(s.is_active?"관리 활성화됨":"관리 비활성 상태");
    await Promise.all([loadRules(),loadChannels(),loadAnnouncements(),loadBlacklists(),loadFeatures(),loadJobs()]);
  }
  async function saveRule(e) {
    e.preventDefault();if(!await ensureServer())return;
    const word=$("#moderation-word").value.trim(), match=$("#moderation-match").value, action=$("#moderation-action").value;
    const seconds=action==="timeout"?Number($("#moderation-timeout").value):null;
    if(!word){notify("금지 단어를 입력해 주세요.");return;}
    if(action==="timeout"&&(!Number.isInteger(seconds)||seconds<1||seconds>2419200)){notify("타임아웃은 1~2419200초로 입력해 주세요.");return;}
    const q=await sb.from("moderation_rules").insert({server_id:sid(),word,match_type:match,action_type:action,timeout_seconds:seconds,enabled:true,created_by:user.id});
    if(failed(q.error,"금지 단어를 저장하지 못했어요."))return;
    $("#moderation-word").value="";notify("금지 단어 규칙을 저장했어요.");await loadRules();
  }
  async function loadRules() {
    const t=$("#moderation-rules-list"), id=sid();
    const q=await sb.from("moderation_rules").select("id,word,match_type,action_type,timeout_seconds,enabled,created_at").eq("server_id",id).order("created_at",{ascending:false});
    if(q.error){t.innerHTML='<tr><td colspan="6" class="empty">규칙을 불러오지 못했어요. SQL과 RLS를 확인해 주세요.</td></tr>';return;}
    const labels={exact:"완전 일치",contains:"단어 포함",delete:"메시지 삭제",timeout:"타임아웃",ban:"영구 차단"};
    $("#moderation-count").textContent=(q.data||[]).length+"개";
    t.innerHTML=q.data?.length?q.data.map(r=>'<tr><td>'+escapeHtml(r.word)+'</td><td>'+labels[r.match_type]+'</td><td>'+labels[r.action_type]+'</td><td>'+(r.timeout_seconds?r.timeout_seconds+"초":"—")+'</td><td><button class="btn btn-light" data-rule-toggle="'+r.id+'" data-enabled="'+r.enabled+'">'+(r.enabled?"사용 중":"중지됨")+'</button></td><td><button class="btn btn-danger" data-rule-delete="'+r.id+'">삭제</button></td></tr>').join(""):'<tr><td colspan="6" class="empty">등록된 금지 단어가 없습니다.</td></tr>';
    $$("[data-rule-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("이 금지 단어를 삭제할까요?"))return;const r=await sb.from("moderation_rules").delete().eq("id",b.dataset.ruleDelete).eq("server_id",id);if(failed(r.error,"삭제하지 못했어요."))return;notify("금지 단어를 삭제했어요.");await loadRules();}));
    $$("[data-rule-toggle]").forEach(b=>b.addEventListener("click",async()=>{const r=await sb.from("moderation_rules").update({enabled:b.dataset.enabled!=="true",updated_at:new Date().toISOString()}).eq("id",b.dataset.ruleToggle).eq("server_id",id);if(failed(r.error,"상태를 변경하지 못했어요."))return;await loadRules();}));
  }
  async function saveChannel(e) {
    e.preventDefault();if(!await ensureServer())return;
    const id=$("#announcement-channel-id").value.trim(),name=$("#announcement-channel-name").value.trim(),def=$("#announcement-channel-default").checked;
    if(!/^\d{5,30}$/.test(id)){notify("채널 ID는 숫자 5~30자리로 입력해 주세요.");return;}
    if(def){const reset=await sb.from("announcement_channels").update({is_default:false}).eq("server_id",sid());if(failed(reset.error,"기본 채널을 변경하지 못했어요."))return;}
    const q=await sb.from("announcement_channels").upsert({server_id:sid(),channel_id:id,channel_name:name||id,is_default:def,enabled:true},{onConflict:"server_id,channel_id"});
    if(failed(q.error,"공지 채널을 저장하지 못했어요."))return;
    e.target.reset();notify("공지 채널을 저장했어요.");await loadChannels();
  }
  async function loadChannels() {
    const list=$("#announcement-channels-list"),select=$("#announcement-channel");
    const q=await sb.from("announcement_channels").select("id,channel_id,channel_name,is_default,enabled").eq("server_id",sid()).order("created_at",{ascending:true});
    if(q.error){list.innerHTML='<div class="empty">채널 목록을 불러오지 못했어요.</div>';return;}
    const rows=q.data||[];
    select.innerHTML='<option value="">기본 채널 / 자동 선택</option>'+rows.filter(r=>r.enabled).map(r=>'<option value="'+escapeHtml(r.channel_id)+'">'+escapeHtml(r.channel_name||r.channel_id)+(r.is_default?" · 기본":"")+'</option>').join("");
    list.innerHTML=rows.length?rows.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.channel_name||r.channel_id)+'</strong><small>'+escapeHtml(r.channel_id)+(r.is_default?" · 기본 채널":"")+'</small></div><div class="stack-actions">'+(!r.is_default?'<button class="btn btn-light" data-channel-default="'+r.id+'">기본 지정</button>':"")+'<button class="btn btn-danger" data-channel-delete="'+r.id+'">삭제</button></div></div>').join(""):'<div class="empty">등록된 채널이 없습니다.</div>';
    $$("[data-channel-default]").forEach(b=>b.addEventListener("click",async()=>{const reset=await sb.from("announcement_channels").update({is_default:false}).eq("server_id",sid());if(failed(reset.error,"기본 채널을 변경하지 못했어요."))return;const r=await sb.from("announcement_channels").update({is_default:true}).eq("id",b.dataset.channelDefault).eq("server_id",sid());if(failed(r.error,"기본 채널을 변경하지 못했어요."))return;await loadChannels();}));
    $$("[data-channel-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("이 공지 채널을 삭제할까요?"))return;const r=await sb.from("announcement_channels").delete().eq("id",b.dataset.channelDelete).eq("server_id",sid());if(failed(r.error,"채널을 삭제하지 못했어요."))return;await loadChannels();}));
  }
  async function saveAnnouncement(e) {
    e.preventDefault();if(!await ensureServer())return;
    const title=$("#announcement-title").value.trim(),content=$("#announcement-content").value.trim(),channel=$("#announcement-channel").value||null,image=$("#announcement-image").value.trim()||null,mention=$("#announcement-mention").value;
    if(!content){notify("공지 내용을 입력해 주세요.");return;}
    if(image&&!/^https?:\/\//i.test(image)){notify("이미지 주소는 http 또는 https URL이어야 해요.");return;}
    let roles=[];
    if(mention==="role"){roles=$("#announcement-role-ids").value.split(",").map(x=>x.trim()).filter(Boolean);if(!roles.length||roles.some(x=>!/^\d{5,30}$/.test(x))){notify("역할 ID를 숫자로 입력해 주세요. 여러 개는 쉼표로 구분합니다.");return;}}
    const q=await sb.from("announcements").insert({server_id:sid(),channel_id:channel,title,content,image_url:image,status:"queued",created_by:user.id}).select("id").single();
    if(failed(q.error,"공지를 저장하지 못했어요."))return;
    const mentions=[];if(mention==="everyone"||mention==="here")mentions.push({announcement_id:q.data.id,mention_type:mention,role_id:null});if(mention==="role")roles.forEach(role_id=>mentions.push({announcement_id:q.data.id,mention_type:"role",role_id}));
    if(mentions.length){const m=await sb.from("announcement_mentions").insert(mentions);if(m.error){await sb.from("announcements").delete().eq("id",q.data.id);notify("멘션 설정을 저장하지 못했어요.");return;}}
    const job=await sb.from("bot_jobs").insert({server_id:sid(),job_type:"post_announcement",payload:{announcement_id:q.data.id},status:"pending"});
    if(job.error){await sb.from("announcements").delete().eq("id",q.data.id);notify("공지 작업을 등록하지 못했어요. SQL 정책을 확인해 주세요.");return;}
    e.target.reset();$("#announcement-role-field").classList.add("hidden");notify("공지 발송 요청을 등록했어요.");await loadAnnouncements();await loadJobs();
  }
  async function loadAnnouncements() {
    const t=$("#announcements-list"),q=await sb.from("announcements").select("id,title,status,channel_id,created_at").eq("server_id",sid()).order("created_at",{ascending:false}).limit(50);
    if(q.error){t.innerHTML='<tr><td colspan="5" class="empty">공지 내역을 불러오지 못했어요.</td></tr>';return;}
    const states={draft:["작성 중",""],queued:["발송 대기","amber"],sent:["발송 완료","green"],failed:["실패","red"],deleted:["삭제됨",""]};
    t.innerHTML=q.data?.length?q.data.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(r.title||"(제목 없음)")+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.channel_id||"기본 채널")+'</td><td>'+(r.status!=="deleted"?'<button class="btn btn-danger" data-announcement-delete="'+r.id+'">삭제</button>':"—")+'</td></tr>';}).join(""):'<tr><td colspan="5" class="empty">등록된 공지가 없습니다.</td></tr>';
    $$("[data-announcement-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("공지 삭제 작업을 요청할까요?"))return;const id=b.dataset.announcementDelete;const j=await sb.from("bot_jobs").insert({server_id:sid(),job_type:"delete_announcement",payload:{announcement_id:id},status:"pending"});if(failed(j.error,"삭제 작업을 등록하지 못했어요."))return;const u=await sb.from("announcements").update({status:"deleted",updated_at:new Date().toISOString()}).eq("id",id).eq("server_id",sid());if(failed(u.error,"삭제 상태를 저장하지 못했어요."))return;notify("공지 삭제 요청을 등록했어요.");await loadAnnouncements();await loadJobs();}));
  }
  async function saveBlacklistServer(e) {
    e.preventDefault();if(!await ensureServer())return;
    const id=$("#blacklist-server-id").value.trim(),invite=$("#blacklist-server-invite").value.trim()||null,reason=$("#blacklist-server-reason").value.trim();
    if(!/^\d{5,30}$/.test(id)){notify("차단 대상 서버 ID는 숫자로 입력해 주세요.");return;}
    if(invite&&!/discord\.gg\/|discord\.com\/invite\//i.test(invite)){notify("Discord 초대 링크를 입력해 주세요.");return;}
    const q=await sb.from("server_blacklists").upsert({managed_server_id:sid(),blocked_server_id:id,invite_url:invite,reason,enabled:true},{onConflict:"managed_server_id,blocked_server_id"});
    if(failed(q.error,"블랙리스트 서버를 저장하지 못했어요."))return;e.target.reset();notify("블랙리스트 서버를 저장했어요.");await loadBlacklists();
  }
  async function saveBlacklistUser(e) {
    e.preventDefault();if(!await ensureServer())return;
    const id=$("#blacklist-user-id").value.trim(),name=$("#blacklist-user-name").value.trim(),reason=$("#blacklist-user-reason").value.trim();
    if(!id&&!name){notify("사용자 ID 또는 닉네임을 입력해 주세요.");return;}
    if(id&&!/^\d{5,30}$/.test(id)){notify("사용자 ID는 숫자로 입력해 주세요.");return;}
    const q=await sb.from("user_blacklists").insert({server_id:sid(),discord_user_id:id||null,username:name||null,reason,enabled:true});
    if(failed(q.error,"사용자 차단 목록을 저장하지 못했어요."))return;e.target.reset();notify("사용자 차단 목록에 추가했어요.");await loadBlacklists();
  }
  async function loadBlacklists() {
    const servers=$("#blacklist-servers-list"),users=$("#blacklist-users-list");
    const results=await Promise.all([sb.from("server_blacklists").select("id,blocked_server_id,invite_url,reason,enabled").eq("managed_server_id",sid()).order("created_at",{ascending:false}),sb.from("user_blacklists").select("id,discord_user_id,username,reason,enabled").eq("server_id",sid()).order("created_at",{ascending:false})]);
    const a=results[0],b=results[1];
    servers.innerHTML=a.error?'<div class="empty">목록을 불러오지 못했어요.</div>':a.data?.length?a.data.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.blocked_server_id)+'</strong><small>'+escapeHtml(r.reason)+' · '+(r.enabled?"활성":"중지")+'</small></div><button class="btn btn-danger" data-blacklist-server-delete="'+r.id+'">삭제</button></div>').join(""):'<div class="empty">등록된 서버가 없습니다.</div>';
    users.innerHTML=b.error?'<div class="empty">목록을 불러오지 못했어요.</div>':b.data?.length?b.data.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.username||r.discord_user_id||"사용자")+'</strong><small>'+(r.discord_user_id?"ID: "+escapeHtml(r.discord_user_id)+" · ":"")+escapeHtml(r.reason)+'</small></div><button class="btn btn-danger" data-blacklist-user-delete="'+r.id+'">삭제</button></div>').join(""):'<div class="empty">등록된 사용자가 없습니다.</div>';
    $$("[data-blacklist-server-delete]").forEach(btn=>btn.addEventListener("click",async()=>{const q=await sb.from("server_blacklists").delete().eq("id",btn.dataset.blacklistServerDelete).eq("managed_server_id",sid());if(failed(q.error,"삭제하지 못했어요."))return;await loadBlacklists();}));
    $$("[data-blacklist-user-delete]").forEach(btn=>btn.addEventListener("click",async()=>{const q=await sb.from("user_blacklists").delete().eq("id",btn.dataset.blacklistUserDelete).eq("server_id",sid());if(failed(q.error,"삭제하지 못했어요."))return;await loadBlacklists();}));
  }
  async function loadFeatures() {
    const box=$("#feature-settings-list"),q=await sb.from("server_feature_settings").select("feature_key,settings,enabled").eq("server_id",sid());
    if(q.error){box.innerHTML='<div class="empty">기능 설정을 불러오지 못했어요. 관리용 SQL을 적용해 주세요.</div>';return;}
    const rows=new Map((q.data||[]).map(r=>[r.feature_key,r]));
    box.innerHTML=features.map(f=>{const r=rows.get(f[0]);return '<article class="feature-setting-card"><div class="feature-setting-head"><div><strong>'+escapeHtml(f[1])+'</strong><small>'+escapeHtml(f[2])+'</small></div><label class="switch-label"><input type="checkbox" class="switch" data-feature-toggle="'+f[0]+'" '+(r&&r.enabled?'checked':'')+'><span>'+(r&&r.enabled?'사용 중':'중지')+'</span></label></div><label class="feature-config-label" for="feature-config-'+f[0]+'">세부 설정 (JSON)</label><textarea id="feature-config-'+f[0]+'" data-feature-config="'+f[0]+'" rows="3" placeholder=\'{"channel_id":"","message":""}\'>'+escapeHtml(JSON.stringify((r&&r.settings)||{},null,2))+'</textarea><button class="btn btn-light" type="button" data-feature-save="'+f[0]+'">설정 저장</button></article>';}).join("");
    $$("[data-feature-toggle]").forEach(el=>el.addEventListener("change",async()=>{const key=el.dataset.featureToggle;let settings={};try{const raw=$('[data-feature-config="'+key+'"]').value.trim();settings=raw?JSON.parse(raw):{};}catch{notify("세부 설정 JSON 형식을 확인해 주세요.");el.checked=!el.checked;return;}const q=await sb.from("server_feature_settings").upsert({server_id:sid(),feature_key:key,settings,enabled:el.checked,updated_at:new Date().toISOString()},{onConflict:"server_id,feature_key"});if(failed(q.error,"기능 상태를 저장하지 못했어요."))return;el.nextElementSibling.textContent=el.checked?"사용 중":"중지";notify("기능 상태를 저장했어요.");}));
    $$("[data-feature-save]").forEach(btn=>btn.addEventListener("click",async()=>{const key=btn.dataset.featureSave;let settings;try{settings=JSON.parse($('[data-feature-config="'+key+'"]').value||"{}");if(!settings||Array.isArray(settings)||typeof settings!=="object")throw new Error("object required");}catch{notify("세부 설정은 JSON 객체 형식으로 입력해 주세요.");return;}const enabled=$('[data-feature-toggle="'+key+'"]').checked;const q=await sb.from("server_feature_settings").upsert({server_id:sid(),feature_key:key,settings,enabled,updated_at:new Date().toISOString()},{onConflict:"server_id,feature_key"});if(failed(q.error,"기능 설정을 저장하지 못했어요."))return;notify("기능 설정을 저장했어요.");}));
  }
  async function loadJobs() {
    const t=$("#bot-jobs-list");if(!t||!sid())return;
    const q=await sb.from("bot_jobs").select("id,job_type,status,error_message,created_at").eq("server_id",sid()).order("created_at",{ascending:false}).limit(50);
    if(q.error){t.innerHTML='<tr><td colspan="4" class="empty">작업 기록을 불러오지 못했어요. SQL 및 RLS를 확인해 주세요.</td></tr>';return;}
    const rows=q.data||[];
    $("#jobs-pending").textContent=rows.filter(r=>r.status==="pending"||r.status==="processing").length;
    $("#jobs-failed").textContent=rows.filter(r=>r.status==="failed").length;
    const names={start_management:"관리 시작",stop_management:"관리 종료",post_announcement:"공지 발송",delete_announcement:"공지 삭제",sync:"서버 정보 동기화",refresh_roles:"역할 정보 갱신"};
    const states={pending:["대기 중","amber"],processing:["처리 중","blue"],completed:["완료","green"],failed:["실패","red"]};
    t.innerHTML=rows.length?rows.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(names[r.job_type]||r.job_type)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.error_message||"—")+'</td></tr>';}).join(""):'<tr><td colspan="4" class="empty">등록된 작업이 없습니다.</td></tr>';
  }
  window.TEND_BOT_MANAGEMENT={init};
})();