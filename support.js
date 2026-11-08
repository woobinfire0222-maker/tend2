(() => {
  const $ = s => document.querySelector(s);
  let ctx = null, selectedId = null, tickets = [], channel = null, poll = null, busy = false;
  const esc = s => ctx.escapeHtml(String(s ?? ""));
  const isAdmin = () => !!ctx?.isAdmin;
  const statusText = s => s === "closed" ? "종료" : "진행 중";
  function toast(message){ctx?.notify?.(message)}
  function showError(label,error){console.error(label,error);toast(label)}
  function setHidden(selector,hidden){$(selector)?.classList.toggle("hidden",hidden)}
  function renderTickets(){
    const box=$("#support-ticket-list");if(!box)return;
    $("#support-ticket-count").textContent=tickets.length+"건";
    if(!tickets.length){box.innerHTML='<div class="empty">아직 문의가 없어요.</div>';return}
    box.innerHTML=tickets.map(t=>'<button type="button" class="support-ticket-item '+(selectedId===t.id?'active':'')+'" data-ticket-id="'+esc(t.id)+'"><span class="support-ticket-item-top"><strong>'+esc(t.subject)+'</strong><span class="badge '+(t.status==="closed"?"":"blue")+'">'+statusText(t.status)+'</span></span><small>'+(isAdmin()?'사용자 '+esc(t.user_id)+' · ':'')+esc(t.updated_at?new Date(t.updated_at).toLocaleString("ko-KR"):"")+'</small></button>').join("");
    box.querySelectorAll("[data-ticket-id]").forEach(b=>b.addEventListener("click",()=>openTicket(b.dataset.ticketId)));
  }
  async function loadTickets(keep=true){
    const box=$("#support-ticket-list");
    if(box&&!tickets.length)box.innerHTML='<div class="empty">문의 목록을 불러오는 중…</div>';
    let q=ctx.sb.from("support_tickets").select("id,user_id,subject,status,created_at,updated_at").order("updated_at",{ascending:false}).limit(100);
    if(!isAdmin())q=q.eq("user_id",ctx.user.id);
    const {data,error}=await q;
    if(error){if(box)box.innerHTML='<div class="empty">문의 목록을 불러오지 못했어요. 데이터베이스 설정과 권한을 확인해 주세요.</div>';showError("문의 목록을 불러오지 못했어요.",error);return}
    tickets=data||[];renderTickets();
    if(keep&&selectedId&&tickets.some(t=>t.id===selectedId))void openTicket(selectedId,false);
    else if(!selectedId&&tickets.length&&!isAdmin())void openTicket(tickets[0].id,false);
    else if(selectedId&&!tickets.some(t=>t.id===selectedId)){selectedId=null;showEmpty()}
  }
  function showEmpty(){setHidden("#support-chat-empty",false);setHidden("#support-chat-view",true)}
  let messageCache = [];
  function renderMessages(messages){
    messageCache=messages||[];
    const box=$("#support-message-list");if(!box)return;
    if(!messageCache.length){box.innerHTML='<div class="empty">아직 대화가 없어요. 첫 메시지를 남겨 보세요.</div>';return}
    box.innerHTML=messageCache.map(m=>{
      const mine=m.sender_id===ctx.user.id;
      const admin=m.sender_role==="admin";
      return '<article class="support-message '+(mine?'mine':'')+'"><div class="support-message-avatar '+(admin?'admin':'')+'">'+(admin?'T':esc((m.sender_name||"사용자").slice(0,1)))+'</div><div class="support-message-body"><div class="support-message-meta"><strong>'+esc(admin?"TEND 지원팀":(m.sender_name||"사용자"))+'</strong><small>'+esc(new Date(m.created_at).toLocaleString("ko-KR"))+'</small></div><p>'+esc(m.content).replace(/\n/g,"<br>")+'</p></div></article>';
    }).join("");
    box.scrollTop=box.scrollHeight;
  }
  async function refreshMessages(id,showLoading=false){
    if(!id)return;
    const box=$("#support-message-list");
    if(showLoading&&box)box.innerHTML='<div class="empty">대화 내용을 불러오는 중…</div>';
    const {data,error}=await ctx.sb.from("support_messages").select("id,ticket_id,sender_id,sender_role,sender_name,content,created_at").eq("ticket_id",id).order("created_at",{ascending:true}).limit(500);
    if(error){console.error("support messages refresh failed",error);return}
    if(selectedId===id)renderMessages(data||[]);
  }
  async function openTicket(id,refreshList=true){
    selectedId=id;const ticket=tickets.find(t=>t.id===id);
    if(!ticket)return;
    if(refreshList)renderTickets();
    setHidden("#support-chat-empty",true);setHidden("#support-chat-view",false);
    $("#support-chat-subject").textContent=ticket.subject;
    $("#support-chat-meta").textContent=(isAdmin()?"문의자 ID: "+ticket.user_id+" · ":"접수: ")+new Date(ticket.created_at).toLocaleString("ko-KR");
    const badge=$("#support-chat-status");badge.textContent=statusText(ticket.status);badge.className="badge "+(ticket.status==="closed"?"":"blue");
    setHidden("#support-ticket-toggle",!isAdmin());
    const toggle=$("#support-ticket-toggle");if(toggle){toggle.textContent=ticket.status==="closed"?"문의 다시 열기":"문의 종료";toggle.dataset.next=ticket.status==="closed"?"open":"closed"}
    const closed=ticket.status==="closed"&&!isAdmin();
    setHidden("#support-reply-form",closed);setHidden("#support-closed-note",!closed);
    await refreshMessages(id,true);
  }
  async function createTicket(event){
    event.preventDefault();if(busy)return;
    const subject=$("#support-subject").value.trim(),content=$("#support-first-message").value.trim();
    if(!subject||!content){toast("제목과 문의 내용을 입력해 주세요.");return}
    busy=true;const button=$("#support-create-submit");button.disabled=true;button.textContent="접수 중…";
    const {data,error}=await ctx.sb.from("support_tickets").insert({user_id:ctx.user.id,subject,status:"open"}).select("id").single();
    if(error){console.error("support ticket create failed",error);toast("문의를 접수하지 못했어요. 데이터베이스 설정을 확인해 주세요.");busy=false;button.disabled=false;button.textContent="문의 접수하기";return}
    const {error:messageError}=await ctx.sb.from("support_messages").insert({ticket_id:data.id,sender_id:ctx.user.id,sender_role:"user",sender_name:ctx.profileName,content});
    if(messageError){console.error("support first message failed",messageError);toast("문의는 생성됐지만 첫 메시지를 저장하지 못했어요. 문의를 열어 다시 보내 주세요.");}
    $("#support-new-form").reset();setHidden("#support-new-box",true);busy=false;button.disabled=false;button.textContent="문의 접수하기";
    selectedId=data.id;await loadTickets(false);await openTicket(data.id,false);toast("문의가 접수됐어요.");
  }
  async function sendReply(event){
    event.preventDefault();if(busy||!selectedId)return;
    const content=$("#support-reply-input").value.trim();if(!content)return;
    const ticket=tickets.find(t=>t.id===selectedId);if(!ticket)return;
    busy=true;const button=$("#support-send");button.disabled=true;
    const ticketId=selectedId;
    const optimistic={id:"pending-"+Date.now(),ticket_id:ticketId,sender_id:ctx.user.id,sender_role:isAdmin()?"admin":"user",sender_name:isAdmin()?"TEND 지원팀":ctx.profileName,content,created_at:new Date().toISOString()};
    renderMessages([...messageCache,optimistic]);
    $("#support-reply-input").value="";
    const {error}=await ctx.sb.from("support_messages").insert({ticket_id:ticketId,sender_id:ctx.user.id,sender_role:optimistic.sender_role,sender_name:optimistic.sender_name,content});
    busy=false;button.disabled=false;
    if(error){
      messageCache=messageCache.filter(m=>m.id!==optimistic.id);renderMessages(messageCache);
      $("#support-reply-input").value=content;
      console.error("support reply failed",error);toast("메시지를 보내지 못했어요. 권한과 데이터베이스 설정을 확인해 주세요.");return
    }
    await Promise.all([refreshMessages(ticketId,false),loadTickets(false)]);
  }
  async function toggleTicket(){
    if(!isAdmin()||!selectedId)return;
    const ticket=tickets.find(t=>t.id===selectedId);if(!ticket)return;
    const next=ticket.status==="closed"?"open":"closed";
    const {error}=await ctx.sb.from("support_tickets").update({status:next,updated_at:new Date().toISOString()}).eq("id",selectedId);
    if(error){console.error("support ticket status update failed",error);toast("문의 상태를 변경하지 못했어요.");return}
    await loadTickets(false);await openTicket(selectedId,false);toast(next==="closed"?"문의를 종료했어요.":"문의를 다시 열었어요.");
  }
  function subscribe(){
    if(channel)ctx.sb.removeChannel(channel);
    channel=ctx.sb.channel("tend-support-"+ctx.user.id+(isAdmin()?"-admin":""))
      .on("postgres_changes",{event:"*",schema:"public",table:"support_messages"},payload=>{
        const changedTicket=payload.new?.ticket_id||payload.old?.ticket_id;
        if(changedTicket===selectedId)refreshMessages(selectedId,false);
        loadTickets(false);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"support_tickets"},()=>loadTickets(true))
      .subscribe();
    if(poll)clearInterval(poll);
    poll=setInterval(()=>{if(!document.hidden)loadTickets(true)},10000);
  }
  async function init(options){
    ctx=options;
    $("#support-list-title").textContent=isAdmin()?"전체 문의":"내 문의";
    $("#support-new-ticket")?.addEventListener("click",()=>setHidden("#support-new-box",false));
    $("#support-cancel-new")?.addEventListener("click",()=>setHidden("#support-new-box",true));
    $("#support-new-form")?.addEventListener("submit",createTicket);
    $("#support-reply-form")?.addEventListener("submit",sendReply);
    $("#support-ticket-toggle")?.addEventListener("click",toggleTicket);
    $("#support-refresh")?.addEventListener("click",()=>loadTickets(true));
    await loadTickets(false);subscribe();
  }
  window.TEND_SUPPORT={init};
  window.addEventListener("beforeunload",()=>{if(channel&&ctx?.sb)ctx.sb.removeChannel(channel);if(poll)clearInterval(poll)});
})();