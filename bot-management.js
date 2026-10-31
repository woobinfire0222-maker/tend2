(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  let ctx, sb, user, notify, escapeHtml, discordIds, serverId = "", managementBusy = false, managementActive = false;
  const commandGroups = [
    ["관리 및 기능",[
      ["/관리시작","관리 시작","선택한 서버의 관리 기능을 시작하도록 요청합니다.","management_start"],
      ["/관리종료","관리 종료","선택한 서버의 관리 기능을 중지하도록 요청합니다.","management_stop"],
      ["/기능설정","기능 설정","서버 기능별 사용 여부와 세부 설정을 관리합니다.","feature_config"],
      ["/자동화설정","자동화 설정","자동화 규칙과 실행 조건을 설정합니다.","automation_config"]
    ]],
    ["금칙어 및 조정",[
      ["/금칙어추가","금칙어 추가","새로운 금칙어와 적용 방식을 등록합니다.","forbidden_word_add"],
      ["/금칙어활성","금칙어 활성","등록된 금칙어 규칙을 활성화합니다.","forbidden_word_enable"],
      ["/금칙어삭제","금칙어 삭제","등록된 금칙어 규칙을 삭제합니다.","forbidden_word_delete"],
      ["/금칙어목록","금칙어 목록","현재 서버의 금칙어 목록을 확인합니다.","forbidden_word_list"],
      ["/경고","경고 부여","사용자에게 사유를 남기고 경고를 부여합니다.","warning_add"],
      ["/경고목록","경고 목록","사용자별 경고 내역을 확인합니다.","warning_list"],
      ["/경고취소","경고 취소","잘못 부여된 경고를 취소합니다.","warning_cancel"]
    ]],
    ["공지",[
      ["/공지발송","공지 발송","선택한 채널에 공지를 발송합니다.","announcement_send"],
      ["/공지예약","공지 예약","지정한 시간에 공지가 발송되도록 예약합니다.","announcement_schedule"],
      ["/공지수정","공지 수정","예약되었거나 저장된 공지 내용을 수정합니다.","announcement_edit"],
      ["/공지삭제","공지 삭제","등록된 공지 또는 예약을 삭제합니다.","announcement_delete"],
      ["/공지채널추가","공지 채널 추가","공지 발송에 사용할 채널을 등록합니다.","announcement_channel_add"],
      ["/공지채널삭제","공지 채널 삭제","등록된 공지 채널을 목록에서 제거합니다.","announcement_channel_delete"]
    ]],
    ["티켓",[
      ["/티켓설정","티켓 설정","티켓 시스템의 기본 설정을 관리합니다.","ticket_config"],
      ["/티켓유형설정","티켓 유형 설정","문의 유형과 유형별 처리 방식을 설정합니다.","ticket_type_config"],
      ["/티켓패널","티켓 패널","서버에 티켓 생성 패널을 게시합니다.","ticket_panel"],
      ["/티켓열기","티켓 열기","닫힌 티켓을 열거나 새 티켓을 생성합니다.","ticket_open"],
      ["/티켓닫기","티켓 닫기","현재 티켓을 종료 상태로 변경합니다.","ticket_close"],
      ["/티켓재개","티켓 재개","종료된 티켓을 다시 진행 상태로 변경합니다.","ticket_reopen"],
      ["/티켓담당","티켓 담당","티켓 담당자를 지정하거나 변경합니다.","ticket_assign"],
      ["/티켓기록","티켓 기록","티켓의 처리 내역과 기록을 확인합니다.","ticket_history"],
      ["/티켓메모","티켓 메모","티켓에 내부 처리 메모를 추가합니다.","ticket_note"],
      ["/티켓삭제","티켓 삭제","선택한 티켓의 삭제 작업을 요청합니다.","ticket_delete"]
    ]],
    ["역할 메뉴",[
      ["/역할패널","역할 패널","역할 선택 패널을 게시합니다.","role_panel"],
      ["/역할메뉴","역할 메뉴","선택 메뉴에 표시할 역할과 설명을 설정합니다.","role_menu"],
      ["/역할패널삭제","역할 패널 삭제","게시된 역할 패널을 제거합니다.","role_panel_delete"]
    ]],
    ["투표",[
      ["/투표생성","투표 생성","질문과 선택지를 입력해 새 투표를 만듭니다.","poll_create"],
      ["/투표","투표","진행 중인 투표에 참여하거나 투표 정보를 확인합니다.","poll"],
      ["/투표취소","투표 취소","진행 중인 투표를 취소합니다.","poll_cancel"],
      ["/투표종료","투표 종료","투표를 마감하고 결과를 확정합니다.","poll_close"]
    ]],
    ["차단 및 백업",[
      ["/차단목록추가","차단 목록 추가","차단할 사용자 또는 대상을 등록합니다.","blocklist_add"],
      ["/차단닉네임추가","차단 닉네임 추가","차단 대상의 닉네임 패턴을 등록합니다.","block_nickname_add"],
      ["/서버블랙리스트추가","서버 블랙리스트 추가","차단할 Discord 서버를 등록합니다.","server_blacklist_add"],
      ["/서버백업","서버 백업","지원되는 서버 설정의 백업 작업을 요청합니다.","server_backup"],
      ["/백업미리보기","백업 미리보기","백업에 포함될 항목을 미리 확인하도록 요청합니다.","backup_preview"]
    ]]
  ];
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
  const failed = (e, message) => { if (!e) return false; console.error(e); notify(message); return true; };
  const isMissingJobsTable = e => !!e && (e.code === "PGRST205" || e.code === "42P01" || /public\.bot_jobs|bot_jobs.*schema cache|relation .*bot_jobs.*does not exist/i.test(e.message || ""));
  async function enqueueJob(jobType, payload = {}) {
    const id = sid();
    const primary = await sb.from("bot_jobs").insert({server_id:id,job_type:jobType,payload,status:"pending"});
    if (!primary.error) return {error:null,queue:"bot_jobs"};
    if (!isMissingJobsTable(primary.error)) return {error:primary.error,queue:null};
    const fallback = await sb.from("bot_commands").insert({user_id:user.id,server_id:id,command_type:jobType,payload,status:"queued"});
    return {error:fallback.error,queue:fallback.error?null:"bot_commands"};
  }
  async function ensureServer() {
    const id = sid();
    if (!id) { notify("관리할 서버를 선택해 주세요."); return false; }
    const p = await sb.from("purchase_requests").select("server_name,server_id,status").eq("user_id",user.id).eq("server_id",id).in("status",["approved","completed"]).limit(1).maybeSingle();
    if (p.error) { console.error("server ownership query error:",p.error); notify("서버 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."); return false; } if (!p.data) { notify("승인된 이용권 신청에 등록된 서버만 관리할 수 있어요."); return false; }
    serverId = id;
    return true;
  }
  async function init(options) {
    ctx=options; sb=ctx.sb; user=ctx.user; notify=ctx.notify; escapeHtml=ctx.escapeHtml; discordIds=ctx.discordIds; ctx.shell("bot","봇 관리","서버별 검열·공지·자동화 설정을 관리하세요.");
    $$("[data-bot-tab]").forEach(b=>b.addEventListener("click",()=>{const key=b.dataset.botTab;$$("[data-bot-tab]").forEach(x=>x.classList.toggle("active",x===b));$$("[data-bot-panel]").forEach(p=>p.classList.toggle("active",p.dataset.botPanel===key));}));
    $("#moderation-action").addEventListener("change",()=>$("#timeout-field").classList.toggle("hidden",$("#moderation-action").value!=="timeout"));
    $("#announcement-mention").addEventListener("change",()=>$("#announcement-role-field").classList.toggle("hidden",$("#announcement-mention").value!=="role"));
    $("#managed-server-select").addEventListener("change",async()=>{serverId=$("#managed-server-select").value;if(await ensureServer())await loadServerData();});
    $("#reload-bot-data").addEventListener("click",loadServers);
    $("#refresh-discord-inventory").addEventListener("click",refreshDiscordInventory);
    $("#start-management").addEventListener("click",()=>management(true));
    $("#stop-management").addEventListener("click",()=>management(false));
    $("#refresh-jobs").addEventListener("click",loadJobs);
    $("#moderation-form").addEventListener("submit",saveRule);
    $("#announcement-channel-form").addEventListener("submit",saveChannel);
    $("#announcement-form").addEventListener("submit",saveAnnouncement);
    $("#blacklist-server-form").addEventListener("submit",saveBlacklistServer);
    $("#blacklist-user-form").addEventListener("submit",saveBlacklistUser);
    await loadServers();
    subscribeDiscordInventory();
  }
  function subscribeDiscordInventory() {
    if (!sb || !user) return;
    sb.channel("tend-bot-live-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "discord_guilds" }, () => {
        loadServers().catch(e => console.error("Live guild refresh failed:", e));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "discord_roles" }, () => { loadDiscordInventory().catch(e => console.error("Live role refresh failed:", e)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "discord_channels" }, payload => {
        if (!payload?.new?.server_id || String(payload.new.server_id) === String(sid())) {
          loadChannels().catch(e => console.error("Live channel refresh failed:", e));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "server_feature_settings", filter: "server_id=eq." + sid() }, () => {
        loadFeatures().catch(e => console.error("Live feature settings refresh failed:", e));
      })
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("TEND live Discord sync subscription:", status);
      });
  }
  async function loadServers() {
    const select=$("#managed-server-select");
    select.innerHTML='<option value="">서버 목록 불러오는 중…</option>';
    let q;
    try {
      q=await Promise.race([
        sb.from("purchase_requests").select("server_id,server_name,status,created_at").eq("user_id",user.id).in("status",["approved","completed"]).not("server_id","is",null).order("created_at",{ascending:false}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),12000))
      ]);
    } catch(e) {
      console.error("approved server list request failed:",e);
      select.innerHTML='<option value="">서버 목록을 불러오지 못했어요</option>';
      $("#managed-server-info").textContent="서버 목록을 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.";
      notify("서버 목록을 불러오지 못했어요. 다시 시도해 주세요.");
      return;
    }
    if(q.error){console.error("approved server query error:",q.error);select.innerHTML='<option value="">서버 목록을 불러오지 못했어요</option>';$("#managed-server-info").textContent="서버 목록을 불러오지 못했어요. 다시 시도해 주세요.";notify("서버 목록을 불러오지 못했어요. 다시 시도해 주세요.");return;}
    const seen=new Set(), rows=[];
    (q.data||[]).forEach(r=>{if(r.server_id&&!seen.has(r.server_id)){seen.add(r.server_id);rows.push(r);}});
    if(!rows.length){select.innerHTML='<option value="">승인된 서버가 없습니다.</option>';serverId="";$("#managed-server-info").textContent="이용권 신청 후 승인을 받으면 서버를 관리할 수 있어요.";return;}
    const inventory=await sb.from("discord_guilds").select("server_id,server_name,icon_url,bot_present,synced_at").in("server_id",rows.map(r=>String(r.server_id)));
    const inventoryReady=!inventory.error;
    const guildMap=new Map((inventory.data||[]).map(g=>[String(g.server_id),g]));
    rows.forEach(r=>{const g=guildMap.get(String(r.server_id));r.botGuild=g||null;if(g?.server_name)r.server_name=g.server_name;});
    select.innerHTML='<option value="">관리할 서버 선택</option>'+rows.map(r=>'<option value="'+escapeHtml(r.server_id)+'"'+(inventoryReady&&!r.botGuild?' disabled':'')+'>'+escapeHtml(r.server_name||"Discord 서버")+(inventoryReady&&!r.botGuild?' · 봇 미참여':'')+'</option>').join("");
    const selectable=rows.filter(r=>!inventoryReady||r.botGuild);
    if(serverId&&selectable.some(r=>String(r.server_id)===String(serverId)))select.value=serverId;
    else{serverId=selectable.length?String(selectable[0].server_id):"";select.value=serverId;}
    if(!serverId){$("#managed-server-info").textContent=inventoryReady?"승인된 서버에서 봇을 찾지 못했어요. 봇을 초대한 뒤 새로고침해 주세요.":"서버 자동 인식 테이블을 사용할 수 없어요. Supabase 설정을 확인해 주세요.";return;}
    if(await ensureServer())await loadServerData();
  }
  function renderManagementControls(stateText) {
    const start=$("#start-management"),stop=$("#stop-management"),badge=$("#bot-status");
    if(start){start.disabled=managementBusy||managementActive;start.textContent=managementBusy&&managementTarget?"관리 시작 중…":"관리 시작";}
    if(stop){stop.disabled=managementBusy||!managementActive;stop.textContent=managementBusy&&!managementTarget?"관리 종료 중…":"관리 종료";}
    if(badge){badge.textContent=stateText||(managementActive?"관리 중":"관리 종료");badge.className="badge "+(managementActive?"green":"amber");}
  }
  let managementTarget=false;
  async function management(active) {
    if(managementBusy){notify("이미 관리 상태를 변경하고 있어요.");return;}
    if(active===managementActive){notify(active?"이미 관리 중인 서버예요.":"이미 관리가 종료된 서버예요.");return;}
    if(!await ensureServer())return;
    managementBusy=true;managementTarget=active;renderManagementControls(active?"관리 시작 중…":"관리 종료 중…");
    const result=await sb.functions.invoke("discord-action",{body:{action:"set_management",server_id:sid(),active}});
    managementBusy=false;
    if(result.error||result.data?.error){
      console.error("management action failed:",result.error,result.data);
      const detail=result.data?.error||result.error?.message||"백엔드 연결을 확인해 주세요.";
      notify(active?"관리를 시작하지 못했어요: "+detail:"관리를 종료하지 못했어요: "+detail);
      await loadServerData();
      return;
    }
    managementActive=result.data?.active===true;
    notify(managementActive?"관리를 시작했어요.":"관리를 종료했어요.");
    await loadServerData();
  }
  async function loadServerData() {
    const id=sid();
    const q=await sb.from("managed_servers").select("*").eq("server_id",id).maybeSingle();
    if(failed(q.error,"서버 상태를 불러오지 못했어요."))return;
    const s=q.data||{};
    managementActive=s.is_active===true;
    renderManagementControls();
    $("#bot-health").textContent=s.bot_connected?"온라인":"응답 대기";
    $("#bot-health").className="badge "+(s.bot_connected?"green":"amber");
    $("#bot-last-seen").textContent=s.last_seen_at?new Date(s.last_seen_at).toLocaleString("ko-KR"):"—";
    $("#managed-server-info").textContent=($("#managed-server-select").selectedOptions[0]?.textContent||id)+" · "+(managementActive?"관리 중":"관리 종료");
    await Promise.all([loadRules(),loadChannels(),loadAnnouncements(),loadBlacklists(),loadFeatures(),loadJobs(),loadDiscordInventory()]);
  }
  async function refreshDiscordInventory() {
    const button=$("#refresh-discord-inventory");
    if(!await ensureServer())return;
    if(button){button.disabled=true;button.textContent="Discord에서 불러오는 중…";}
    try {
      const result=await sb.functions.invoke("discord-action",{body:{action:"sync_server_info",server_id:sid()}});
      if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"서버 정보를 동기화하지 못했어요.");
      await loadServers();
      await loadDiscordInventory();
      const c=result.data?.counts||{};
      notify("Discord 서버 정보를 갱신했어요. 채널 "+(c.channels??0)+"개 · 역할 "+(c.roles??0)+"개");
    } catch(error) {
      console.error("Discord inventory refresh failed:",error);
      notify("봇 정보를 새로고침하지 못했어요: "+(error.message||"잠시 후 다시 시도해 주세요."));
    } finally {
      if(button){button.disabled=false;button.textContent="Discord 정보 새로고침";}
    }
  }
  async function loadDiscordInventory() {
    const root=$("#discord-inventory-content");
    if(!root||!sid())return;
    const [g,c,r]=await Promise.all([
      sb.from("discord_guilds").select("server_name,description,owner_id,approximate_member_count,approximate_presence_count,channel_count,role_count,emoji_count,sticker_count,verification_level,preferred_locale,premium_tier,premium_subscription_count,synced_at").eq("server_id",sid()).maybeSingle(),
      sb.from("discord_channels").select("channel_id,channel_name,channel_type,position,parent_id,can_send").eq("server_id",sid()).order("position",{ascending:true}),
      sb.from("discord_roles").select("role_id,role_name,color,position,managed,mentionable").eq("server_id",sid()).order("position",{ascending:false})
    ]);
    if(g.error||c.error||r.error){
      console.error("Discord inventory read failed:",g.error,c.error,r.error);
      root.innerHTML='<div class="empty">전체 서버 정보 테이블을 읽지 못했어요. Supabase 마이그레이션을 실행했는지 확인해 주세요.</div>';
      return;
    }
    const guild=g.data,channels=c.data||[],roles=r.data||[];
    if(!guild){root.innerHTML='<div class="empty">아직 동기화된 정보가 없어요. 위의 Discord 정보 새로고침을 눌러 주세요.</div>';return;}
    const types={"0":"텍스트","2":"음성","4":"카테고리","5":"공지","13":"스테이지","15":"포럼","16":"미디어"};
    const stats=[
      ["멤버",Number(guild.approximate_member_count||0).toLocaleString("ko-KR")],
      ["온라인",Number(guild.approximate_presence_count||0).toLocaleString("ko-KR")],
      ["채널",channels.length],
      ["역할",roles.length],
      ["이모지",guild.emoji_count||0],
      ["스티커",guild.sticker_count||0]
    ];
    root.innerHTML='<div class="grid two-col">'+stats.map(x=>'<div class="setting-row"><div><strong>'+x[0]+'</strong></div><strong>'+x[1]+'</strong></div>').join("")+'</div>'+
      '<div class="setting-row"><div><strong>'+escapeHtml(guild.server_name)+'</strong><small>서버 ID: '+escapeHtml(sid())+' · 소유자 ID: '+escapeHtml(guild.owner_id||"확인 불가")+'</small></div><span class="card-note">부스트 '+(guild.premium_subscription_count||0)+'개 · Tier '+(guild.premium_tier||0)+'</span></div>'+
      (guild.description?'<p class="page-subtitle">'+escapeHtml(guild.description)+'</p>':'')+
      '<p class="card-note">마지막 동기화: '+(guild.synced_at?new Date(guild.synced_at).toLocaleString("ko-KR"):"—")+' · 언어: '+escapeHtml(guild.preferred_locale||"—")+'</p>'+
      '<div class="grid two-col" style="margin-top:14px"><div><strong>채널 목록 ('+channels.length+')</strong><div class="stack-list" style="margin-top:8px">'+(channels.length?channels.map(x=>'<div class="stack-row"><div><strong>'+escapeHtml(x.channel_name)+'</strong><small>'+escapeHtml(types[String(x.channel_type)]||"기타")+' · '+escapeHtml(x.channel_id)+(x.parent_id?' · 상위 카테고리 ID '+escapeHtml(x.parent_id):"")+'</small></div><span class="card-note">'+(x.can_send?"전송 가능":"읽기 전용")+'</span></div>').join(""):'<div class="empty">채널이 없습니다.</div>')+'</div></div>'+
      '<div><strong>역할 목록 ('+roles.length+')</strong><div class="stack-list" style="margin-top:8px">'+(roles.length?roles.map(x=>'<div class="stack-row"><div><strong>'+escapeHtml(x.role_name)+'</strong><small>'+escapeHtml(x.role_id)+(x.managed?" · 연동 역할":"")+(x.mentionable?" · 멘션 가능":"")+'</small></div><span class="card-note">위치 '+x.position+'</span></div>').join(""):'<div class="empty">역할이 없습니다.</div>')+'</div></div></div>';
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
    if(q.error){t.innerHTML='<tr><td colspan="6" class="empty">규칙을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return;}
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
    const list=$("#announcement-channels-list"),select=$("#announcement-channel"),id=sid();
    const results=await Promise.all([
      sb.from("announcement_channels").select("id,channel_id,channel_name,is_default,enabled").eq("server_id",id).order("created_at",{ascending:true}),
      sb.from("discord_channels").select("channel_id,channel_name,channel_type,can_send,synced_at").eq("server_id",id).order("channel_name",{ascending:true})
    ]);
    const saved=results[0],discovered=results[1];
    if(saved.error){list.innerHTML='<div class="empty">저장한 채널 목록을 불러오지 못했어요.</div>';return;}
    const rows=saved.data||[], discoveredRows=discovered.error?[]:(discovered.data||[]), options=new Map();
    discoveredRows.forEach(r=>{if(r.can_send!==false)options.set(String(r.channel_id),{id:String(r.channel_id),name:r.channel_name||r.channel_id,auto:true});});
    rows.filter(r=>r.enabled).forEach(r=>options.set(String(r.channel_id),{id:String(r.channel_id),name:r.channel_name||r.channel_id,auto:false,is_default:r.is_default}));
    select.innerHTML='<option value="">기본 채널 / 자동 선택</option>'+[...options.values()].map(r=>'<option value="'+escapeHtml(r.id)+'">'+escapeHtml(r.name)+(r.auto?' · 봇 인식':'')+(r.is_default?' · 기본':'')+'</option>').join("");
    if(discovered.error){
      list.innerHTML='<div class="notice warning">자동 채널 인식 테이블을 사용할 수 없어요. Supabase 설정과 봇 동기화를 확인해 주세요.</div>'+(rows.length?rows.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.channel_name||r.channel_id)+'</strong><small>'+escapeHtml(r.channel_id)+(r.is_default?" · 기본 채널":"")+'</small></div><div class="stack-actions">'+(!r.is_default?'<button class="btn btn-light" data-channel-default="'+r.id+'">기본 지정</button>':"")+'<button class="btn btn-danger" data-channel-delete="'+r.id+'">삭제</button></div></div>').join(""):'<div class="empty">등록된 채널이 없습니다.</div>');
    } else {
      list.innerHTML='<div class="card-note" style="margin-bottom:8px">봇 인식 채널 '+discoveredRows.length+'개 · 전송 가능 '+discoveredRows.filter(r=>r.can_send!==false).length+'개</div>'+(discoveredRows.length?discoveredRows.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.channel_name||r.channel_id)+'</strong><small>'+escapeHtml(r.channel_id)+' · '+escapeHtml(r.channel_type||"채널")+(r.can_send===false?' · 전송 권한 없음':' · 자동 인식')+'</small></div></div>').join(""):'<div class="empty">봇이 인식한 채널이 없습니다. 기존 봇에서 서버·채널 정보를 Supabase로 동기화해야 해요.</div>')+(rows.length?'<div class="section-intro" style="margin-top:12px"><strong>저장된 공지 채널</strong></div>'+rows.map(r=>'<div class="stack-row"><div><strong>'+escapeHtml(r.channel_name||r.channel_id)+'</strong><small>'+escapeHtml(r.channel_id)+(r.is_default?" · 기본 채널":"")+'</small></div><div class="stack-actions">'+(!r.is_default?'<button class="btn btn-light" data-channel-default="'+r.id+'">기본 지정</button>':"")+'<button class="btn btn-danger" data-channel-delete="'+r.id+'">삭제</button></div></div>').join(""):'');
    }
    $$("[data-channel-default]").forEach(b=>b.addEventListener("click",async()=>{const reset=await sb.from("announcement_channels").update({is_default:false}).eq("server_id",sid());if(failed(reset.error,"기본 채널을 변경하지 못했어요."))return;const r=await sb.from("announcement_channels").update({is_default:true}).eq("id",b.dataset.channelDefault).eq("server_id",sid());if(failed(r.error,"기본 채널을 변경하지 못했어요."))return;await loadChannels();}));
    $$("[data-channel-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("이 공지 채널을 삭제할까요?"))return;const r=await sb.from("announcement_channels").delete().eq("id",b.dataset.channelDelete).eq("server_id",sid());if(failed(r.error,"채널을 삭제하지 못했어요."))return;await loadChannels();}));
  }
  async function saveAnnouncement(e) {
    e.preventDefault();
    const form=e.currentTarget;
    if(!form){notify("공지 작성 화면을 확인할 수 없어요. 새로고침해 주세요.");return;}
    if(!await ensureServer())return;
    const submit=form.querySelector('button[type="submit"]');
    const title=$("#announcement-title").value.trim(),content=$("#announcement-content").value.trim(),channel=$("#announcement-channel").value||null,mention=$("#announcement-mention").value;
    let image=$("#announcement-image").value.trim()||null;
    const file=$("#announcement-image-file").files[0]||null;
    if(!content){notify("공지 내용을 입력해 주세요.");return;}
    if(image&&!/^https?:\/\//i.test(image)){notify("이미지 주소는 http 또는 https URL이어야 해요.");return;}
    if(file){
      if(!file.type.startsWith("image/")||file.size>8*1024*1024){notify("이미지는 8MB 이하의 이미지 파일만 첨부할 수 있어요.");return;}
      const path=sid()+"/"+Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const upload=await sb.storage.from("announcement-images").upload(path,file,{upsert:false,contentType:file.type});
      if(upload.error){console.error(upload.error);notify("이미지를 업로드하지 못했어요: "+(upload.error.message||"저장소 설정을 확인해 주세요."));return;}
      image=sb.storage.from("announcement-images").getPublicUrl(path).data.publicUrl;
    }
    let roles=[];
    if(mention==="role"){
      roles=$("#announcement-role-ids").value.split(",").map(x=>x.trim()).filter(Boolean);
      if(!roles.length||roles.some(x=>!/^[0-9]{5,30}$/.test(x))){notify("역할 ID를 숫자로 입력해 주세요. 여러 개는 쉼표로 구분합니다.");return;}
    }
    if(submit){submit.disabled=true;submit.textContent="전송 중…";}
    try {
      const result=await sb.functions.invoke("discord-action",{body:{action:"send_announcement",server_id:sid(),channel_id:channel,title,content,image_url:image,mention,role_ids:roles}});
      if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"백엔드 연결을 확인해 주세요.");
      form.reset();$("#announcement-role-field")?.classList.add("hidden");
      notify("공지를 Discord에 전송하고 내역에 저장했어요.");
      await loadAnnouncements();
    } catch(err) {
      console.error("announcement send failed:",err);
      notify("공지를 등록하지 못했어요: "+(err.message||"잠시 후 다시 시도해 주세요."));
    } finally {if(submit){submit.disabled=false;submit.textContent="공지 바로 보내기";}}
  }
  async function loadAnnouncements() {
    const t=$("#announcements-list");
    if(!t)return;
    const q=await sb.from("bot_announcements").select("id,title,status,channel_id,created_at,error_message").eq("server_id",sid()).order("created_at",{ascending:false}).limit(50);
    if(q.error){console.error("announcement history query failed:",q.error);t.innerHTML='<tr><td colspan="5" class="empty">공지 내역을 불러오지 못했어요. 데이터베이스 설정을 확인해 주세요.</td></tr>';return;}
    const states={queued:["발송 대기","amber"],sent:["발송 완료","green"],failed:["실패","red"],deleted:["삭제됨",""]};
    t.innerHTML=q.data?.length?q.data.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(r.title||"(제목 없음)")+(r.error_message?'<small class="reason-text">'+escapeHtml(r.error_message)+'</small>':"")+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.channel_id||"기본 채널")+'</td><td>'+(r.status!=="deleted"?'<button class="btn btn-danger" data-announcement-delete="'+r.id+'">삭제</button>':"—")+'</td></tr>';}).join(""):'<tr><td colspan="5" class="empty">등록된 공지가 없습니다.</td></tr>';
    $$("[data-announcement-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("사이트의 공지 내역에서 삭제할까요?"))return;const id=b.dataset.announcementDelete;const u=await sb.from("bot_announcements").update({status:"deleted",updated_at:new Date().toISOString()}).eq("id",id).eq("server_id",sid());if(failed(u.error,"공지 내역을 삭제하지 못했어요."))return;notify("공지 내역을 삭제했어요.");await loadAnnouncements();}));
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
  const featureFields = {
    tickets:[["panel_channel_id","패널 게시 채널 ID","text"],["support_role_ids","담당 역할 ID (쉼표 구분)","list"],["category_id","티켓 카테고리 ID","text"],["welcome_message","티켓 생성 안내","textarea"],["close_message","종료 안내","textarea"]],
    polls:[["default_duration_minutes","기본 진행 시간(분)","number"],["allow_multiple","복수 선택 허용","boolean"],["anonymous","익명 투표","boolean"],["results_channel_id","결과 채널 ID","text"]],
    welcome:[["channel_id","환영 채널 ID","text"],["message","환영 메시지 ({user}, {server} 사용 가능)","textarea"],["embed_color","임베드 색상 (HEX)","text"],["image_url","이미지 URL","text"]],
    goodbye:[["channel_id","퇴장 알림 채널 ID","text"],["message","퇴장 메시지 ({user}, {server} 사용 가능)","textarea"]],
    auto_roles:[["role_ids","자동 지급 역할 ID (쉼표 구분)","list"],["delay_seconds","지급 대기 시간(초)","number"]],
    reaction_roles:[["channel_id","역할 패널 채널 ID","text"],["message_id","역할 패널 메시지 ID","text"],["roles","역할 목록 (이모지:역할ID, 쉼표 구분)","textarea"],["mode","선택 방식 (button/select)","select:button,select"]],
    auto_responses:[["channel_ids","적용 채널 ID (쉼표 구분, 비우면 전체)","list"],["responses","자동 응답 규칙 (키워드=답변, 한 줄에 하나)","textarea"],["ignore_bots","봇 메시지 무시","boolean"]],
    link_filter:[["allowed_domains","허용 도메인 (쉼표 구분)","list"],["block_invites","Discord 초대 링크 차단","boolean"],["action","위반 조치","select:delete,warn,timeout"],["timeout_seconds","타임아웃 시간(초)","number"]],
    anti_spam:[["max_messages","허용 메시지 수","number"],["interval_seconds","측정 시간(초)","number"],["duplicate_limit","동일 메시지 반복 허용 횟수","number"],["action","위반 조치","select:delete,warn,timeout"],["timeout_seconds","타임아웃 시간(초)","number"]],
    account_security:[["minimum_account_age_days","최소 계정 생성 기간(일)","number"],["new_member_action","신규 계정 조치","select:flag,timeout,kick"],["timeout_seconds","타임아웃 시간(초)","number"],["alert_channel_id","보안 알림 채널 ID","text"]],
    server_logs:[["channel_id","로그 채널 ID","text"],["message_events","메시지 변경/삭제 기록","boolean"],["member_events","입퇴장 기록","boolean"],["role_events","역할 변경 기록","boolean"],["voice_events","음성 채널 이동 기록","boolean"]],
    warnings:[["max_warnings","누적 경고 기준","number"],["action","기준 도달 시 조치","select:none,timeout,kick,ban"],["timeout_seconds","타임아웃 시간(초)","number"],["notify_user","대상자에게 안내","boolean"]],
    temporary_voice:[["lobby_channel_id","임시 채널 생성용 대기 채널 ID","text"],["category_id","임시 채널 카테고리 ID","text"],["default_user_limit","기본 인원 제한","number"],["delete_empty_after_seconds","빈 채널 삭제 대기(초)","number"]],
    server_backup:[["backup_channel_id","백업 알림 채널 ID","text"],["include_roles","역할 구조 포함","boolean"],["include_channels","채널 구조 포함","boolean"],["include_permissions","권한 설정 포함","boolean"],["schedule_hours","자동 백업 주기(시간, 0=끔)","number"]]
  };
  function featureFieldHtml(featureKey, field, settings) {
    const [key,label,type]=field, value=settings[key];
    const id="feature-field-"+featureKey+"-"+key;
    if(type==="boolean") return '<label class="feature-editor-check"><input type="checkbox" id="'+id+'" data-setting-key="'+key+'" '+(value===true?"checked":"")+'><span>'+escapeHtml(label)+'</span></label>';
    if(type==="textarea") return '<label class="field"><span>'+escapeHtml(label)+'</span><textarea id="'+id+'" data-setting-key="'+key+'" rows="3">'+escapeHtml(Array.isArray(value)?value.join("\\n"):value??"")+'</textarea></label>';
    if(type==="list") return '<label class="field"><span>'+escapeHtml(label)+'</span><input id="'+id+'" data-setting-key="'+key+'" value="'+escapeHtml(Array.isArray(value)?value.join(", "):value??"")+'" placeholder="쉼표로 구분"></label>';
    if(type.startsWith("select:")) return '<label class="field"><span>'+escapeHtml(label)+'</span><select id="'+id+'" data-setting-key="'+key+'">'+type.slice(7).split(",").map(v=>'<option value="'+v+'" '+(String(value??"")===v?"selected":"")+'>'+v+'</option>').join("")+'</select></label>';
    return '<label class="field"><span>'+escapeHtml(label)+'</span><input id="'+id+'" data-setting-key="'+key+'" type="'+(type==="number"?"number":"text")+'" value="'+escapeHtml(value??"")+'"></label>';
  }
  function openFeatureEditor(featureKey, feature, settings, enabled) {
    document.querySelector("#feature-editor-backdrop")?.remove();
    const fields=featureFields[featureKey]||[];
    const backdrop=document.createElement("div");
    backdrop.id="feature-editor-backdrop";
    backdrop.className="feature-editor-backdrop";
    backdrop.innerHTML='<section class="feature-editor" role="dialog" aria-modal="true" aria-labelledby="feature-editor-title"><header><div><h2 id="feature-editor-title">'+escapeHtml(feature[1])+'</h2><p>'+escapeHtml(feature[2])+'</p></div><button type="button" class="btn btn-light" data-editor-close>닫기</button></header><form id="feature-editor-form"><div class="feature-editor-fields">'+fields.map(f=>featureFieldHtml(featureKey,f,settings)).join("")+'</div><label class="feature-editor-check feature-editor-enabled"><input type="checkbox" id="feature-editor-enabled" '+(enabled?"checked":"")+'><span>이 기능 사용</span></label><footer><button type="button" class="btn btn-light" data-editor-close>취소</button><button class="btn btn-blue" type="submit">설정 저장 및 적용</button></footer></form></section>';
    document.body.append(backdrop);
    backdrop.querySelectorAll("[data-editor-close]").forEach(b=>b.addEventListener("click",()=>backdrop.remove()));
    backdrop.addEventListener("click",e=>{if(e.target===backdrop)backdrop.remove();});
    backdrop.querySelector("#feature-editor-form").addEventListener("submit",async e=>{
      e.preventDefault();
      const button=e.submitter;button.disabled=true;button.textContent="저장 중…";
      const next={...settings};
      backdrop.querySelectorAll("[data-setting-key]").forEach(el=>{
        const key=el.dataset.settingKey;
        if(el.type==="checkbox") next[key]=el.checked;
        else if(el.type==="number") next[key]=el.value===""?null:Number(el.value);
        else if(el.tagName==="SELECT") next[key]=el.value;
        else if(featureFields[featureKey].find(f=>f[0]===key)?.[2]==="list") next[key]=el.value.split(",").map(v=>v.trim()).filter(Boolean);
        else next[key]=el.value;
      });
      const nextEnabled=backdrop.querySelector("#feature-editor-enabled").checked;
      const saved=await sb.from("server_feature_settings").upsert({server_id:sid(),feature_key:featureKey,settings:next,enabled:nextEnabled,updated_at:new Date().toISOString()},{onConflict:"server_id,feature_key"});
      if(failed(saved.error,"기능 설정을 저장하지 못했어요.")){button.disabled=false;button.textContent="설정 저장 및 적용";return;}
      backdrop.remove();notify(nextEnabled?"설정을 저장했어요. 봇이 이 기능을 지원하면 바로 적용돼요.":"설정을 저장했어요.");await loadFeatures();
    });
  }
  async function loadFeatures() {
    const box=$("#feature-settings-list");
    if(!box)return;
    const q=await sb.from("server_feature_settings").select("feature_key,settings,enabled").eq("server_id",sid());
    if(q.error){box.innerHTML='<div class="empty">기능 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';return;}
    const rows=new Map((q.data||[]).map(r=>[r.feature_key,r]));
    box.innerHTML=features.map(f=>{const r=rows.get(f[0]),enabled=!!r?.enabled;return '<article class="feature-setting-card"><div class="feature-setting-head"><div><strong>'+escapeHtml(f[1])+'</strong><small>'+escapeHtml(f[2])+'</small></div><span class="badge '+(enabled?"green":"")+'">'+(enabled?"사용 중":"중지")+'</span></div><button type="button" class="btn btn-light" data-feature-edit="'+f[0]+'">자세히 설정 <span>→</span></button></article>';}).join("");
    $$("[data-feature-edit]").forEach(btn=>btn.addEventListener("click",()=>{const key=btn.dataset.featureEdit,feature=features.find(f=>f[0]===key),r=rows.get(key);openFeatureEditor(key,feature,r?.settings||{},!!r?.enabled);}));
  }
  async function loadJobs() {
    const t=$("#bot-jobs-list");if(!t||!sid())return;
    let q=await sb.from("bot_jobs").select("id,job_type,status,error_message,created_at").eq("server_id",sid()).order("created_at",{ascending:false}).limit(50);
    let rows=[];
    if(q.error&&isMissingJobsTable(q.error)){
      q=await sb.from("bot_commands").select("id,command_type,status,result,created_at").eq("server_id",sid()).eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
      if(q.error){console.error(q.error);t.innerHTML='<tr><td colspan="4" class="empty">작업 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return;}
      rows=(q.data||[]).map(r=>({id:r.id,job_type:r.command_type,status:r.status==="queued"?"pending":r.status,error_message:r.result,created_at:r.created_at}));
    }else if(q.error){console.error(q.error);t.innerHTML='<tr><td colspan="4" class="empty">작업 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</td></tr>';return;}
    else rows=q.data||[];
    $("#jobs-pending").textContent=rows.filter(r=>r.status==="pending"||r.status==="processing").length;
    $("#jobs-failed").textContent=rows.filter(r=>r.status==="failed").length;
    const names={start_management:"관리 시작",stop_management:"관리 종료",management_start:"관리 시작",management_stop:"관리 종료",post_announcement:"공지 발송",delete_announcement:"공지 삭제",sync:"서버 정보 동기화",refresh_roles:"역할 정보 갱신",feature_config:"기능 설정",automation_config:"자동화 설정",forbidden_word_add:"금칙어 추가",forbidden_word_enable:"금칙어 활성",forbidden_word_delete:"금칙어 삭제",forbidden_word_list:"금칙어 목록",warning_add:"경고 부여",warning_list:"경고 목록",warning_cancel:"경고 취소",announcement_send:"공지 발송",announcement_schedule:"공지 예약",announcement_edit:"공지 수정",announcement_delete:"공지 삭제",announcement_channel_add:"공지 채널 추가",announcement_channel_delete:"공지 채널 삭제",ticket_config:"티켓 설정",ticket_type_config:"티켓 유형 설정",ticket_panel:"티켓 패널",ticket_open:"티켓 열기",ticket_close:"티켓 닫기",ticket_reopen:"티켓 재개",ticket_assign:"티켓 담당",ticket_history:"티켓 기록",ticket_note:"티켓 메모",ticket_delete:"티켓 삭제",role_panel:"역할 패널",role_menu:"역할 메뉴",role_panel_delete:"역할 패널 삭제",poll_create:"투표 생성",poll:"투표",poll_cancel:"투표 취소",poll_close:"투표 종료",blocklist_add:"차단 목록 추가",block_nickname_add:"차단 닉네임 추가",server_blacklist_add:"서버 블랙리스트 추가",server_backup:"서버 백업",backup_preview:"백업 미리보기"};
    const states={pending:["대기 중","amber"],queued:["대기 중","amber"],processing:["처리 중","blue"],completed:["완료","green"],failed:["실패","red"]};
    t.innerHTML=rows.length?rows.map(r=>{const st=states[r.status]||[r.status,""];return '<tr><td>'+new Date(r.created_at).toLocaleString("ko-KR")+'</td><td>'+escapeHtml(names[r.job_type]||r.job_type)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td>'+escapeHtml(r.error_message||"—")+'</td></tr>';}).join(""):'<tr><td colspan="4" class="empty">등록된 작업이 없습니다.</td></tr>';
  }
  window.TEND_BOT_MANAGEMENT={init};
})();