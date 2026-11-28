
(() => {
 const $=s=>document.querySelector(s),sb=window.BLOCKS.sb;
 let user=null,session=null,servers=[],selected=null;
 const select=$("#blocks-server-select"),note=$("#blocks-server-note"),list=$("#blocks-project-list"),create=$("#blocks-new-project");
 const inviteBox=$("#blocks-bot-invite");
 function inviteUrl(serverId){const u=new URL("https://discord.com/oauth2/authorize");u.searchParams.set("client_id",window.TEND_CONFIG.discordBotClientId);u.searchParams.set("permissions",window.TEND_CONFIG.discordBotPermissions||"8");u.searchParams.set("integration_type","0");u.searchParams.set("scope","bot applications.commands");u.searchParams.set("guild_id",serverId);u.searchParams.set("disable_guild_select","true");return u.toString();}
 async function loadServers(){
  note.textContent="서버 권한을 확인하고 있어요…";select.disabled=true;
  let result=await sb.rpc("blocks_list_servers");
  if(result.error){console.error(result.error);note.textContent="서버 목록을 불러오지 못했어요. 다시 로그인한 뒤 시도해 주세요.";return;}
  servers=result.data||[];
  if(!servers.length){
   const synced=await window.BLOCKS.syncGuilds(session);
   if(synced){result=await sb.rpc("blocks_list_servers");if(!result.error)servers=result.data||[];}
  }
  select.replaceChildren();
  if(!servers.length){
   const op=document.createElement("option");op.value="";op.textContent="관리자 권한이 있는 서버가 없어요";select.append(op);
   note.textContent=session?.provider_token?"Discord에서 관리자 권한이 있는 서버를 찾지 못했어요.":"저장된 Discord 서버 권한이 없어요. 로그아웃 후 Discord로 다시 로그인해 서버 권한을 갱신해 주세요.";
   return;
  }
  servers.forEach(server=>{const op=document.createElement("option");op.value=server.server_id;op.textContent=server.server_name+(server.bot_connected?"":" · 봇 초대 필요");select.append(op);});
  select.disabled=false;selected=servers[0];select.value=selected.server_id;renderServerState();await loadProjects();
 }
 function renderServerState(){
  selected=servers.find(x=>x.server_id===select.value)||null;create.disabled=!selected;
  inviteBox.replaceChildren();inviteBox.classList.add("bl-hidden");
  if(!selected){note.textContent="서버를 선택해 주세요.";return;}
  if(selected.bot_connected){note.className="bl-status success";note.textContent="TEND 봇이 연결된 서버예요. 프로젝트를 만들고 저장할 수 있어요.";}
  else{
   note.className="bl-status";note.textContent="이 서버에는 TEND 봇이 아직 연결되지 않았어요. 프로젝트를 먼저 만들 수 있지만 실행하려면 봇 초대가 필요해요.";
   inviteBox.classList.remove("bl-hidden");const a=document.createElement("a");a.className="bl-btn primary";a.href=inviteUrl(selected.server_id);a.target="_blank";a.rel="noopener noreferrer";a.textContent="이 서버에 TEND 봇 초대하기";inviteBox.append(a);inviteBox.style.marginTop="10px";
  }
 }
 async function loadProjects(){
  if(!selected)return;
  list.innerHTML='<div class="bl-empty">프로젝트를 불러오는 중…</div>';
  const {data,error}=await sb.from("blocks_projects").select("id,name,project_data,is_enabled,updated_at,created_at").eq("owner_id",user.id).eq("server_id",selected.server_id).order("updated_at",{ascending:false});
  if(error){console.error(error);list.innerHTML='<div class="bl-empty">프로젝트를 불러오지 못했어요. 서버 권한을 다시 확인해 주세요.</div>';return;}
  list.replaceChildren();
  if(!data?.length){list.innerHTML='<div class="bl-empty">아직 프로젝트가 없어요.<br>새 프로젝트를 만들어 첫 블록을 추가해 보세요.</div>';return;}
  data.forEach(project=>{
   const card=document.createElement("article");card.className="bl-project-card";
   const title=document.createElement("h3");title.textContent=project.name;
   const desc=document.createElement("p");desc.textContent=(project.project_data?.blocks||[]).length+"개 블록 · "+new Date(project.updated_at||project.created_at).toLocaleString("ko-KR");
   const meta=document.createElement("div");meta.className="bl-project-meta";
   const status=document.createElement("span");status.className="bl-pill "+(project.is_enabled?"green":"gray");status.textContent=project.is_enabled?"실행 활성화":"저장됨";meta.append(status);
   const open=document.createElement("a");open.className="bl-btn primary";open.href="./blocks-editor.html?id="+encodeURIComponent(project.id);open.textContent="코딩 시작 →";
   card.append(title,desc,meta,open);list.append(card);
  });
 }
 async function createProject(){
  if(!selected)return;
  const name=prompt("새 프로젝트 이름을 입력해 주세요.","새 자동화");
  if(name===null)return;
  const clean=name.trim().slice(0,60);if(!clean){window.BLOCKS.notify("프로젝트 이름을 입력해 주세요.");return;}
  create.disabled=true;create.textContent="생성 중…";
  try{
   const {data,error}=await sb.from("blocks_projects").insert({owner_id:user.id,server_id:selected.server_id,name:clean,project_data:{version:1,blocks:[],variables:[]},is_enabled:false}).select("id").single();
   if(error)throw error;
   location.href="./blocks-editor.html?id="+encodeURIComponent(data.id);
  }catch(error){console.error("BLOCKS project create failed",error);window.BLOCKS.notify(error.message||"프로젝트를 만들지 못했어요.");create.disabled=false;create.textContent="코딩 시작";}
 }
 async function init(){
  try{
   session=await window.BLOCKS.session();user=await window.BLOCKS.requireTester("./blocks-dashboard.html");if(!user)return;
   $("#blocks-user").textContent=window.BLOCKS.discordName(user);
   $("#blocks-logout").addEventListener("click",async()=>{if(confirm("TEND BLOCKS에서 로그아웃할까요?")){await sb.auth.signOut({scope:"local"});location.href="./blocks.html";}});
   select.addEventListener("change",async()=>{renderServerState();await loadProjects();});
   $("#blocks-server-refresh").addEventListener("click",async()=>{session=await window.BLOCKS.session();const ok=await window.BLOCKS.syncGuilds(session);if(!ok)window.BLOCKS.notify("Discord 서버 권한을 새로고침하지 못했어요. 다시 로그인해 주세요.");await loadServers();});
   create.addEventListener("click",createProject);
   await loadServers();
  }catch(error){console.error("BLOCKS dashboard init failed",error);note.textContent=error.message||"대시보드를 불러오지 못했어요.";}
 }
 init();
})();
