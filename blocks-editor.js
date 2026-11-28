
(() => {
 const $=s=>document.querySelector(s),sb=window.BLOCKS.sb;
 const params=new URLSearchParams(location.search),projectId=params.get("id");
 const palette=$("#blocks-palette"),workspace=$("#blocks-workspace-list"),nameInput=$("#blocks-project-name"),count=$("#blocks-count"),saveButton=$("#blocks-save"),enableButton=$("#blocks-enable");
 const definitions=[
  {type:"event_message_create",group:"이벤트",kind:"event",label:"새 메시지가 올라오면",fields:[{key:"channel_filter",label:"채널 ID (선택)",placeholder:"전체 채널",kind:"text"}]},
  {type:"event_member_join",group:"이벤트",kind:"event",label:"새 멤버가 들어오면",fields:[]},
  {type:"event_member_leave",group:"이벤트",kind:"event",label:"멤버가 나가면",fields:[]},
  {type:"condition_contains",group:"조건",kind:"condition",label:"메시지에 단어가 포함되면",fields:[{key:"keyword",label:"찾을 단어",placeholder:"예: 안녕하세요",kind:"value",full:true}]},
  {type:"condition_has_role",group:"조건",kind:"condition",label:"사용자가 역할을 가지고 있으면",fields:[{key:"role_id",label:"역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_send_message",group:"동작",kind:"action",label:"메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널",placeholder:"채널 선택",kind:"channel"},{key:"content",label:"메시지 내용",placeholder:"보낼 내용을 입력해 주세요.",kind:"textarea",full:true},{key:"mention_mode",label:"멘션 방식",kind:"select",options:[["none","멘션 없음"],["everyone","@everyone"],["here","@here"],["user","특정 사용자"],["role","특정 역할"]]},{key:"mention_id",label:"멘션 대상 ID",placeholder:"사용자 또는 역할 ID",kind:"text"},{key:"delete_after_seconds",label:"자동 삭제 (초)",placeholder:"사용 안 함",kind:"number"},{key:"thread_mode",label:"스레드",kind:"select",options:[["none","사용 안 함"],["create","새 스레드"],["reply","기존 스레드"]] }]},
  {type:"action_send_embed",group:"동작",kind:"action",label:"임베드 메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널 ID",placeholder:"채널 ID",kind:"text"},{key:"embed_title",label:"제목",placeholder:"임베드 제목",kind:"text"},{key:"author",label:"작성자 표시",placeholder:"선택 입력",kind:"text"},{key:"description",label:"설명",placeholder:"임베드 본문",kind:"textarea",full:true},{key:"color",label:"색상 HEX",placeholder:"#356DF3",kind:"text"},{key:"footer",label:"하단 문구",placeholder:"선택 입력",kind:"text"},{key:"title_url",label:"제목 링크",placeholder:"https://",kind:"text"},{key:"thumbnail_url",label:"썸네일 URL",placeholder:"https://",kind:"text"},{key:"image_url",label:"큰 이미지 URL",placeholder:"https://",kind:"text"},{key:"timestamp",label:"시간 표시",kind:"select",options:[["false","표시 안 함"],["true","현재 시간 표시"]]}]},
  {type:"action_reply",group:"동작",kind:"action",label:"메시지에 답장하기",fields:[{key:"content",label:"답장 내용",placeholder:"답장 내용을 입력해 주세요.",kind:"textarea",full:true},{key:"reply_target",label:"답장 대상",kind:"select",options:[["event_message","현재 이벤트 메시지"],["latest_message","가장 최근 메시지"],["message_id","직접 지정한 메시지 ID"]]},{key:"target_message_id",label:"메시지 ID",placeholder:"직접 지정할 때 입력",kind:"text"},{key:"fallback",label:"대상 메시지가 없을 때",kind:"select",options:[["send_new","새 메시지로 전송"],["skip","동작 건너뛰기"]]},{key:"mention_author",label:"작성자 멘션",kind:"select",options:[["false","멘션하지 않음"],["true","작성자 멘션"]]}]},
  {type:"action_add_role",group:"동작",kind:"action",label:"역할 지급하기",fields:[{key:"role_id",label:"지급할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_remove_role",group:"동작",kind:"action",label:"역할 회수하기",fields:[{key:"role_id",label:"회수할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_warn",group:"동작",kind:"action",label:"사용자에게 경고하기",fields:[{key:"reason",label:"경고 사유",placeholder:"경고 사유",kind:"textarea",full:true}]},
  {type:"control_wait",group:"제어",kind:"control",label:"잠시 기다리기",fields:[{key:"seconds",label:"대기 시간 (초, 최대 10)",placeholder:"1",kind:"number"}]},
  {type:"data_set_variable",group:"변수",kind:"data",label:"변수에 값 저장하기",fields:[{key:"variable",label:"변수 이름",placeholder:"변수명",kind:"text"},{key:"value",label:"저장할 값",placeholder:"값 또는 {{변수명}}",kind:"value"}]},
  {type:"data_change_variable",group:"변수",kind:"data",label:"변수 값 변경하기",fields:[{key:"variable",label:"변수 이름",placeholder:"변수명",kind:"text"},{key:"amount",label:"변경할 값",placeholder:"1",kind:"number"}]}
 ];
 const byType=Object.fromEntries(definitions.map(d=>[d.type,d]));
 let user,project,server,blocks=[],variables=[],resources={channels:[],roles:[]},dragSource=null,dirty=false;
 const defaults={event_message_create:{channel_filter:""},condition_contains:{keyword:""},condition_has_role:{role_id:""},action_send_message:{channel_id:"",content:"",mention_mode:"none",mention_id:"",delete_after_seconds:"",thread_mode:"none"},action_send_embed:{channel_id:"",embed_title:"",author:"",description:"",color:"#356DF3",footer:"",title_url:"",thumbnail_url:"",image_url:"",timestamp:"false"},action_reply:{content:"",reply_target:"event_message",target_message_id:"",fallback:"send_new",mention_author:"false"},action_add_role:{role_id:""},action_remove_role:{role_id:""},action_warn:{reason:""},control_wait:{seconds:"1"},data_set_variable:{variable:"",value:""},data_change_variable:{variable:"",amount:"1"}};
 function makeBlock(type){const def=byType[type];return {id:crypto.randomUUID(),type,fields:{...(defaults[type]||{})}};}
 function markDirty(){dirty=true;$("#blocks-save-state").textContent="변경 사항 있음";saveButton.disabled=false;}
 function drawPalette(){
  palette.replaceChildren();let group="";
  definitions.forEach(def=>{
   if(def.group!==group){group=def.group;const heading=document.createElement("div");heading.className="bl-palette-group";heading.textContent=group;palette.append(heading);}
   const button=document.createElement("button");button.type="button";button.className="bl-palette-block "+def.kind;button.draggable=true;button.dataset.type=def.type;button.textContent=def.label;
   button.addEventListener("click",()=>addBlock(def.type));button.addEventListener("dragstart",e=>{dragSource={kind:"new",type:def.type};e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain",def.type);});
   palette.append(button);
  });
 }
 function renderVariables(){
  const host=$("#blocks-variable-list");host.replaceChildren();
  variables.forEach(variable=>{
   const chip=document.createElement("button");chip.type="button";chip.className="bl-variable-chip";chip.draggable=true;chip.textContent=variable;chip.title="입력칸으로 끌어 놓기";
   chip.addEventListener("dragstart",e=>{dragSource={kind:"variable",name:variable};e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain","variable:"+variable);});
   chip.addEventListener("click",()=>window.BLOCKS.notify("변수 '"+variable+"'를 입력칸으로 끌어 놓을 수 있어요."));
   host.append(chip);
  });
 }
 function addBlock(type,index){
  if(blocks.length>=50){window.BLOCKS.notify("프로젝트에는 최대 50개 블록까지 추가할 수 있어요.");return;}
  const block=makeBlock(type);if(Number.isInteger(index))blocks.splice(index,0,block);else blocks.push(block);renderBlocks();markDirty();
 }
 function fieldElement(block,field){
  const wrap=document.createElement("label");wrap.className="bl-block-field"+(field.full?" full":"");
  const title=document.createElement("span");title.textContent=field.label;wrap.append(title);
  let input;
  if(field.kind==="textarea"){input=document.createElement("textarea");input.placeholder=field.placeholder||"";input.value=block.fields[field.key]??"";}
  else if(field.kind==="select"){input=document.createElement("select");(field.options||[]).forEach(([value,label])=>{const option=document.createElement("option");option.value=value;option.textContent=label;input.append(option);});input.value=block.fields[field.key]??(field.options?.[0]?.[0]||"");}
  else if(field.kind==="channel"||field.kind==="role"){const items=resources[field.kind==="channel"?"channels":"roles"]||[];if(items.length){input=document.createElement("select");const first=document.createElement("option");first.value="";first.textContent=field.kind==="channel"?"채널을 선택해 주세요":"역할을 선택해 주세요";input.append(first);items.forEach(item=>{const option=document.createElement("option");option.value=item.id;option.textContent=(field.kind==="channel"?"#":"@")+item.name;input.append(option);});const current=block.fields[field.key]||"";if(current&&!items.some(item=>item.id===current)){const extra=document.createElement("option");extra.value=current;extra.textContent="저장된 ID · "+current;input.append(extra);}input.value=current;}else{input=document.createElement("input");input.type="text";input.placeholder=field.placeholder+" (목록 동기화 필요)";input.value=block.fields[field.key]??"";}}
  else{input=document.createElement("input");input.type=field.kind==="number"?"number":"text";input.placeholder=field.placeholder||"";input.value=block.fields[field.key]??"";if(field.kind==="number"){input.min="0";input.max=field.key==="seconds"?"10":"86400";}}
  input.className="block-field-input";input.dataset.key=field.key;input.dataset.kind=field.kind;input.addEventListener("input",()=>{block.fields[field.key]=input.value;markDirty();});
  input.addEventListener("change",()=>{block.fields[field.key]=input.value;markDirty();});
  input.addEventListener("dragover",e=>{if(field.kind==="value"&&dragSource){e.preventDefault();input.style.outline="2px solid #356df3";}});
  input.addEventListener("dragleave",()=>{input.style.outline="";});
  input.addEventListener("drop",e=>{
   if(field.kind!=="value"||!dragSource)return;e.preventDefault();input.style.outline="";
   if(dragSource.kind==="variable")input.value="{{"+dragSource.name+"}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_text")input.value="텍스트";
   else if(dragSource.kind==="new"&&dragSource.type==="value_number")input.value="0";
   else if(dragSource.kind==="new"&&dragSource.type==="value_variable")input.value="{{변수명}}";
   block.fields[field.key]=input.value;markDirty();
  });
  wrap.append(input);return wrap;
 }
 function renderBlocks(){
  workspace.replaceChildren();count.textContent=blocks.length+" / 50";
  if(!blocks.length){const empty=document.createElement("div");empty.className="bl-empty";empty.textContent="아직 블록이 없어요. 왼쪽에서 이벤트 블록부터 추가해 보세요.";workspace.append(empty);return;}
  blocks.forEach((block,index)=>{
   const def=byType[block.type];if(!def)return;
   const card=document.createElement("article");card.className="bl-workspace-block";card.draggable=true;card.dataset.id=block.id;
   card.addEventListener("dragstart",e=>{if(e.target.closest("input,textarea,select,button")){e.preventDefault();return;}dragSource={kind:"move",id:block.id};card.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain","block:"+block.id);});
   card.addEventListener("dragend",()=>card.classList.remove("dragging"));
   const head=document.createElement("div");head.className="bl-block-head "+def.kind;
   const title=document.createElement("span");title.textContent=(index+1)+". "+def.label;head.append(title);
   const tools=document.createElement("div");tools.className="bl-block-tools";
   [["↑",-1],["↓",1],["삭제","delete"]].forEach(([label,action])=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",()=>{if(action==="delete"){blocks.splice(index,1);}else{const next=index+Number(action);if(next<0||next>=blocks.length)return;const item=blocks.splice(index,1)[0];blocks.splice(next,0,item);}renderBlocks();markDirty();});tools.append(b);});
   head.append(tools);card.append(head);
   if(def.fields.length){const fields=document.createElement("div");fields.className="bl-block-fields";def.fields.forEach(field=>fields.append(fieldElement(block,field)));card.append(fields);}
   workspace.append(card);
  });
 }
 function setupDrop(){
  const area=$("#blocks-workspace");
  area.addEventListener("dragover",e=>{if(dragSource){e.preventDefault();e.dataTransfer.dropEffect=dragSource.kind==="move"?"move":"copy";}});
  area.addEventListener("drop",e=>{
   if(!dragSource)return;
   const targetField=e.target.closest(".block-field-input");
   if(targetField&&targetField.dataset.kind==="value")return;
   e.preventDefault();
   if(dragSource.kind==="new")addBlock(dragSource.type);
   else if(dragSource.kind==="move"){
    const from=blocks.findIndex(b=>b.id===dragSource.id),target=e.target.closest(".bl-workspace-block"),to=target?blocks.findIndex(b=>b.id===target.dataset.id):blocks.length;
    if(from>=0){const item=blocks.splice(from,1)[0];blocks.splice(Math.max(0,to>from?to-1:to),0,item);renderBlocks();markDirty();}
   }
  });
  document.addEventListener("dragend",()=>{dragSource=null;});
  document.addEventListener("drop",()=>{setTimeout(()=>{dragSource=null;},0);});
 }
 async function save(){
  if(blocks.length>50){window.BLOCKS.notify("블록은 최대 50개까지 저장할 수 있어요.");return false;}
  saveButton.disabled=true;$("#blocks-save-state").textContent="저장 중…";
  const projectData={version:1,blocks,variables};
  try{
   const {data,error}=await sb.from("blocks_projects").update({name:nameInput.value.trim().slice(0,60)||"새 프로젝트",project_data:projectData,version:(project.version||1)+1,updated_at:new Date().toISOString()}).eq("id",project.id).eq("owner_id",user.id).select("id,name,project_data,is_enabled").single();
   if(error)throw error;project=data;blocks=data.project_data.blocks||[];variables=data.project_data.variables||[];dirty=false;$("#blocks-save-state").textContent="저장 완료";saveButton.disabled=false;renderBlocks();renderVariables();return true;
  }catch(error){console.error("BLOCKS project save failed",error);window.BLOCKS.notify(error.message||"저장하지 못했어요.");$("#blocks-save-state").textContent="저장 실패";saveButton.disabled=false;return false;}
 }
 async function toggleEnabled(){
  if(dirty){const ok=await save();if(!ok)return;}
  if(!server?.bot_connected){window.BLOCKS.notify("TEND 봇을 먼저 서버에 초대해 주세요.");return;}
  if(!project.is_enabled&&!blocks.some(block=>String(block.type).startsWith("event_"))){window.BLOCKS.notify("실행하려면 이벤트 블록을 하나 이상 추가해 주세요.");return;}
  enableButton.disabled=true;
  try{
   const next=!project.is_enabled;
   const {data,error}=await sb.from("blocks_projects").update({is_enabled:next,updated_at:new Date().toISOString()}).eq("id",project.id).eq("owner_id",user.id).select("is_enabled").single();
   if(error)throw error;project.is_enabled=data.is_enabled;renderEnable();window.BLOCKS.notify(next?"프로젝트 실행을 활성화했어요.":"프로젝트 실행을 중지했어요.");
  }catch(error){console.error("BLOCKS activation failed",error);window.BLOCKS.notify(error.message||"실행 상태를 변경하지 못했어요.");}
  finally{enableButton.disabled=false;}
 }
 function renderEnable(){enableButton.textContent=project?.is_enabled?"실행 중지":"실행 활성화";enableButton.classList.toggle("primary",!!project?.is_enabled);}
 async function loadLogs(){
  const host=$("#blocks-run-logs");const {data,error}=await sb.from("blocks_execution_logs").select("event_type,status,message,created_at").eq("project_id",project.id).order("created_at",{ascending:false}).limit(20);
  host.replaceChildren();if(error||!data?.length){const empty=document.createElement("div");empty.className="bl-empty";empty.textContent=error?"실행 기록을 불러오지 못했어요.":"아직 실행 기록이 없어요.";host.append(empty);return;}
  data.forEach(row=>{const item=document.createElement("div");item.className="bl-log";const strong=document.createElement("b");strong.textContent=row.status+" · "+row.event_type;const line=document.createElement("div");line.textContent=row.message||"실행 기록";const time=document.createElement("small");time.textContent=new Date(row.created_at).toLocaleString("ko-KR");item.append(strong,line,time);host.append(item);});
 }
 async function init(){
  try{
   user=await window.BLOCKS.requireTester("./blocks-editor.html?id="+encodeURIComponent(projectId||""));if(!user)return;
   if(!projectId)throw new Error("프로젝트 정보가 없어요. 대시보드에서 프로젝트를 열어 주세요.");
   const {data,error}=await sb.from("blocks_projects").select("*").eq("id",projectId).eq("owner_id",user.id).single();if(error)throw error;project=data;
   nameInput.value=project.name;blocks=Array.isArray(project.project_data?.blocks)?project.project_data.blocks:[];variables=Array.isArray(project.project_data?.variables)?project.project_data.variables:[];
   const {data:servers,error:serverError}=await sb.rpc("blocks_list_servers");if(serverError)throw serverError;server=(servers||[]).find(x=>x.server_id===project.server_id)||null;
   if(server){const {data:resourceData,error:resourceError}=await sb.rpc("blocks_list_server_resources",{target_server_id:project.server_id});if(resourceError)console.warn("BLOCKS resource catalog unavailable",resourceError);else resources={channels:resourceData?.channels||[],roles:resourceData?.roles||[]};}
   $("#blocks-editor-server").textContent=(server?.server_name||"선택한 서버")+" · "+(server?.bot_connected?"TEND 봇 연결됨":"TEND 봇 초대 필요");
   drawPalette();renderVariables();renderBlocks();renderEnable();setupDrop();saveButton.disabled=false;
   saveButton.addEventListener("click",save);enableButton.addEventListener("click",toggleEnabled);
   $("#blocks-add-variable").addEventListener("click",()=>{const input=$("#blocks-variable-name"),value=input.value.trim().slice(0,40);if(!value)return;if(!variables.includes(value)){variables.push(value);renderVariables();markDirty();}input.value="";});
   nameInput.addEventListener("input",markDirty);
   await loadLogs();
   window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  }catch(error){console.error("BLOCKS editor init failed",error);workspace.innerHTML='<div class="bl-empty">'+window.BLOCKS.escape(error.message||"편집기를 불러오지 못했어요.")+'</div>';}
 }
 init();
})();
