
(() => {
 const panel=document.getElementById("blocks-beta-admin");if(!panel)return;
 const sb=window.TEND_SB||(window.supabase&&window.TEND_CONFIG?window.supabase.createClient(window.TEND_CONFIG.supabaseUrl,window.TEND_CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null);
 if(!sb)return;
 const $=s=>panel.querySelector(s),escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let apps=[],testers=[];
 function statusLabel(s){return s==="pending"?"검토 대기":s==="approved"?"승인":"거절";}
 async function load(){
  $("#blocks-admin-list").innerHTML='<div class="empty">베타 신청을 불러오는 중…</div>';
  const {data:admin,error:adminError}=await sb.rpc("tend_is_super_admin");
  if(adminError||!admin){panel.classList.add("hidden");return;}
  panel.classList.remove("hidden");
  const [a,t]=await Promise.all([
   sb.from("blocks_beta_applications").select("id,user_id,discord_id,discord_username,experience,purpose,status,admin_note,created_at,reviewed_at").order("created_at",{ascending:false}).limit(200),
   sb.from("blocks_beta_testers").select("user_id,discord_id,is_active,granted_at,revoked_at").order("granted_at",{ascending:false}).limit(200)
  ]);
  if(a.error){$("#blocks-admin-list").innerHTML='<div class="empty">신청 목록 오류: '+escape(a.error.message)+'</div>';return;}
  apps=a.data||[];testers=t.data||[];renderTesters();
  $("#blocks-admin-count").textContent=apps.length+"건";
  $("#blocks-admin-pending").textContent=apps.filter(x=>x.status==="pending").length+"건";
  $("#blocks-admin-active").textContent=testers.filter(x=>x.is_active).length+"명";
  render();
 }
 function render(){
  const filter=$("#blocks-admin-filter").value;
  const rows=apps.filter(x=>filter==="all"||x.status===filter);
  const host=$("#blocks-admin-list");host.replaceChildren();
  if(!rows.length){host.innerHTML='<div class="empty">해당 상태의 신청이 없어요.</div>';return;}
  rows.forEach(app=>{
   const card=document.createElement("article");card.className="experiment-member-row";
   const info=document.createElement("div");info.className="experiment-member-info";
   const title=document.createElement("strong");title.textContent=app.discord_username+" · "+statusLabel(app.status);
   const meta=document.createElement("small");meta.textContent="Discord ID "+app.discord_id+" · "+new Date(app.created_at).toLocaleString("ko-KR");
   const exp=document.createElement("small");exp.textContent="경험: "+(app.experience||"미입력");
   const purpose=document.createElement("small");purpose.textContent="신청 내용: "+(app.purpose||"미입력");
   info.append(title,meta,exp,purpose);
   if(app.admin_note){const note=document.createElement("small");note.textContent="관리자 메모: "+app.admin_note;info.append(note);}
   const actions=document.createElement("div");actions.className="experiment-member-action";
   if(app.status==="pending"){
    [["승인","approved"],["거절","rejected"]].forEach(([label,decision])=>{const b=document.createElement("button");b.className="btn "+(decision==="approved"?"btn-blue":"btn-light");b.textContent=label;b.addEventListener("click",()=>review(app,decision,b));actions.append(b);});
   }else{
    const label=document.createElement("span");label.className="badge "+(app.status==="approved"?"green":"");label.textContent=statusLabel(app.status);actions.append(label);
   }
   card.append(info,actions);host.append(card);
  });
 }
 async function review(app,decision,button){
  const note=prompt(decision==="approved"?"승인 메모 (선택)":"거절 사유를 입력해 주세요.","");
  if(note===null)return;
  if(decision==="rejected"&&!note.trim()){alert("거절 사유를 입력해 주세요.");return;}
  button.disabled=true;
  const {data,error}=await sb.rpc("blocks_review_beta_application",{target_application_id:app.id,decision,note:note.trim()});
  if(error||data?.error){alert(error?.message||data?.error||"처리하지 못했어요.");button.disabled=false;return;}
  await load();
 }
 $("#blocks-admin-filter").addEventListener("change",render);
 $("#blocks-admin-refresh").addEventListener("click",load);
 load().catch(error=>{console.error("BLOCKS admin load failed",error);$("#blocks-admin-list").textContent="관리 정보를 불러오지 못했어요.";});
})();

function renderTesters(){
 const host=$("#blocks-admin-testers");if(!host)return;host.replaceChildren();
 if(!testers.length){host.innerHTML='<div class="empty">아직 승인된 테스터가 없어요.</div>';return;}
 testers.forEach(t=>{
  const row=document.createElement("div");row.className="experiment-member-row";
  const info=document.createElement("div");info.className="experiment-member-info";
  const title=document.createElement("strong");title.textContent=t.discord_id;
  const meta=document.createElement("small");meta.textContent=(t.is_active?"베타 권한 활성":"권한 해제됨")+" · 승인일 "+new Date(t.granted_at).toLocaleString("ko-KR");
  info.append(title,meta);
  const action=document.createElement("div");action.className="experiment-member-action";
  if(t.is_active){const b=document.createElement("button");b.className="btn btn-light";b.textContent="권한 해제";b.addEventListener("click",async()=>{if(!confirm("이 계정의 TEND BLOCKS 베타 권한을 해제할까요?"))return;b.disabled=true;const {data,error}=await sb.rpc("blocks_revoke_beta_access",{target_user_id:t.user_id});if(error||!data?.ok){alert(error?.message||"권한을 해제하지 못했어요.");b.disabled=false;return;}await load();});action.append(b);}
  row.append(info,action);host.append(row);
 });
}
