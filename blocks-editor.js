
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
  {type:"action_send_embed",group:"동작",kind:"action",label:"임베드 메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널",placeholder:"채널 선택",kind:"channel"},{key:"embed_title",label:"제목",placeholder:"임베드 제목",kind:"text"},{key:"author",label:"작성자 표시",placeholder:"선택 입력",kind:"text"},{key:"description",label:"설명",placeholder:"임베드 본문",kind:"textarea",full:true},{key:"color",label:"색상 HEX",placeholder:"#356DF3",kind:"text"},{key:"footer",label:"하단 문구",placeholder:"선택 입력",kind:"text"},{key:"title_url",label:"제목 링크",placeholder:"https://",kind:"text"},{key:"thumbnail_url",label:"썸네일 URL",placeholder:"https://",kind:"text"},{key:"image_url",label:"큰 이미지 URL",placeholder:"https://",kind:"text"},{key:"timestamp",label:"시간 표시",kind:"select",options:[["false","표시 안 함"],["true","현재 시간 표시"]]}]},
  {type:"action_reply",group:"동작",kind:"action",label:"메시지에 답장하기",fields:[{key:"content",label:"답장 내용",placeholder:"답장 내용을 입력해 주세요.",kind:"textarea",full:true},{key:"reply_target",label:"답장 대상",kind:"select",options:[["event_message","현재 이벤트 메시지"],["latest_message","가장 최근 메시지"],["message_id","직접 지정한 메시지 ID"]]},{key:"target_message_id",label:"메시지 ID",placeholder:"직접 지정할 때 입력",kind:"text"},{key:"fallback",label:"대상 메시지가 없을 때",kind:"select",options:[["send_new","새 메시지로 전송"],["skip","동작 건너뛰기"]]},{key:"mention_author",label:"작성자 멘션",kind:"select",options:[["false","멘션하지 않음"],["true","작성자 멘션"]]}]},
  {type:"action_add_role",group:"동작",kind:"action",label:"역할 지급하기",fields:[{key:"role_id",label:"지급할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_remove_role",group:"동작",kind:"action",label:"역할 회수하기",fields:[{key:"role_id",label:"회수할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_warn",group:"동작",kind:"action",label:"사용자에게 경고하기",fields:[{key:"reason",label:"경고 사유",placeholder:"경고 사유",kind:"textarea",full:true}]},
  {type:"control_wait",group:"제어",kind:"control",label:"잠시 기다리기",fields:[{key:"seconds",label:"대기 시간 (초, 최대 10)",placeholder:"1",kind:"number"}]},
  {type:"data_set_variable",group:"변수",kind:"data",label:"변수에 값 저장하기",fields:[{key:"variable",label:"변수 이름",placeholder:"변수명",kind:"text"},{key:"value",label:"저장할 값",placeholder:"값 또는 {{변수명}}",kind:"value"}]},
  {type:"data_change_variable",group:"변수",kind:"data",label:"변수 값 변경하기",fields:[{key:"variable",label:"변수 이름",placeholder:"변수명",kind:"text"},{key:"amount",label:"변경할 값",placeholder:"1",kind:"number"}]}
,
{type:"event_message_edit",group:"이벤트",kind:"event",label:"메시지가 수정되면",fields:[]},
  {type:"event_message_delete",group:"이벤트",kind:"event",label:"메시지가 삭제되면",fields:[]},
  {type:"event_reaction_add",group:"이벤트",kind:"event",label:"메시지에 반응이 추가되면",fields:[{key:"emoji",label:"이모지 필터 (선택)",placeholder:"예: 👍",kind:"text"}]},
  {type:"condition_starts_with",group:"조건",kind:"condition",label:"메시지가 특정 글자로 시작하면",fields:[{key:"text",label:"시작 문자열",placeholder:"!",kind:"value",full:true}]},
  {type:"condition_ends_with",group:"조건",kind:"condition",label:"메시지가 특정 글자로 끝나면",fields:[{key:"text",label:"끝 문자열",placeholder:"?",kind:"value",full:true}]},
  {type:"condition_equals",group:"조건",kind:"condition",label:"메시지가 정확히 일치하면",fields:[{key:"text",label:"비교할 메시지",placeholder:"정확한 문장",kind:"value",full:true}]},
  {type:"condition_channel_is",group:"조건",kind:"condition",label:"특정 채널에서 실행 중이면",fields:[{key:"channel_id",label:"채널",placeholder:"채널 선택",kind:"channel",full:true}]},
  {type:"condition_has_attachment",group:"조건",kind:"condition",label:"첨부파일이 있으면",fields:[{key:"expected",label:"첨부파일 조건",kind:"select",options:[["true","첨부파일 있음"],["false","첨부파일 없음"]]}]},
  {type:"condition_is_bot",group:"조건",kind:"condition",label:"작성자가 봇 계정이면",fields:[{key:"expected",label:"작성자 유형",kind:"select",options:[["true","봇 계정"],["false","일반 사용자"]]}]},
  {type:"condition_message_length",group:"조건",kind:"condition",label:"메시지 글자 수를 비교하면",fields:[{key:"operator",label:"비교 방식",kind:"select",options:[["gte","이상"],["lte","이하"],["eq","같음"]]},{key:"length",label:"글자 수",placeholder:"10",kind:"number"}]},
  {type:"condition_username_contains",group:"조건",kind:"condition",label:"사용자 이름에 단어가 포함되면",fields:[{key:"text",label:"찾을 단어",placeholder:"이름 일부",kind:"value",full:true}]},
  {type:"action_delete_message",group:"동작",kind:"action",label:"현재 메시지 삭제하기",fields:[{key:"reason",label:"내부 사유 (선택)",placeholder:"자동화 규칙",kind:"text"}]},
  {type:"action_add_reaction",group:"동작",kind:"action",label:"현재 메시지에 반응 추가",fields:[{key:"emoji",label:"이모지",placeholder:"👍",kind:"text"}]},
  {type:"action_send_dm",group:"동작",kind:"action",label:"작성자에게 DM 보내기",fields:[{key:"content",label:"DM 내용",placeholder:"개인 메시지 내용",kind:"textarea",full:true}]},
  {type:"action_set_nickname",group:"동작",kind:"action",label:"사용자 닉네임 변경",fields:[{key:"nickname",label:"새 닉네임",placeholder:"{{username}} 님",kind:"value",full:true}]},
  {type:"action_create_thread",group:"동작",kind:"action",label:"현재 메시지에 스레드 만들기",fields:[{key:"name",label:"스레드 이름",placeholder:"새 토론",kind:"value"},{key:"auto_archive_minutes",label:"자동 보관",kind:"select",options:[["60","1시간"],["1440","1일"],["4320","3일"],["10080","7일"]]}]},
  {type:"action_pin_message",group:"동작",kind:"action",label:"현재 메시지 고정하기",fields:[{key:"pin",label:"고정 상태",kind:"select",options:[["true","고정"],["false","고정 해제"]]}]},
  {type:"action_set_slowmode",group:"동작",kind:"action",label:"채널 슬로우모드 설정",fields:[{key:"channel_id",label:"채널",placeholder:"채널 선택",kind:"channel"},{key:"seconds",label:"간격 (초)",placeholder:"5",kind:"number"}]},
  {type:"action_log",group:"동작",kind:"action",label:"실행 기록에 메모 남기기",fields:[{key:"message",label:"기록 내용",placeholder:"자동화 단계 완료",kind:"value",full:true}]},
  {type:"control_stop",group:"제어",kind:"control",label:"현재 자동화 즉시 중단",fields:[]},
  {type:"control_cooldown",group:"제어",kind:"control",label:"사용자별 쿨다운 적용",fields:[{key:"seconds",label:"쿨다운 (초)",placeholder:"30",kind:"number"}]},
  {type:"control_random",group:"제어",kind:"control",label:"확률 조건으로 분기",fields:[{key:"chance",label:"성공 확률 (%)",placeholder:"50",kind:"number"}]},
  {type:"data_append_variable",group:"변수",kind:"data",label:"변수 뒤에 텍스트 이어붙이기",fields:[{key:"variable",label:"변수 이름",placeholder:"message",kind:"text"},{key:"text",label:"추가할 텍스트",placeholder:"내용",kind:"value"}]},
  {type:"data_math_variable",group:"변수",kind:"data",label:"숫자 변수 계산하기",fields:[{key:"variable",label:"변수 이름",placeholder:"count",kind:"text"},{key:"operator",label:"계산",kind:"select",options:[["add","더하기"],["subtract","빼기"],["multiply","곱하기"],["divide","나누기"]]},{key:"amount",label:"숫자",placeholder:"1",kind:"number"}]},
  {type:"value_text",group:"값",kind:"value",label:"텍스트 값",fields:[{key:"value",label:"텍스트",placeholder:"텍스트 입력",kind:"text"}]},
  {type:"value_number",group:"값",kind:"value",label:"숫자 값",fields:[{key:"value",label:"숫자",placeholder:"0",kind:"number"}]},
  {type:"value_variable",group:"값",kind:"value",label:"변수 값",fields:[{key:"variable",label:"변수 이름",placeholder:"변수 선택",kind:"text"}]},
  {type:"value_user_name",group:"값",kind:"value",label:"이벤트 사용자 이름",fields:[]},
  {type:"value_server_name",group:"값",kind:"value",label:"현재 서버 이름",fields:[]},
  {type:"value_channel_name",group:"값",kind:"value",label:"현재 채널 이름",fields:[]},
  {type:"value_current_time",group:"값",kind:"value",label:"현재 시간",fields:[]}
 ];
 const byType=Object.fromEntries(definitions.map(d=>[d.type,d]));
 let user,project,server,blocks=[],variables=[],resources={channels:[],roles:[]},dragSource=null,dirty=false,activeValueInput=null,selectedPaletteGroup='이벤트',canvasScale=1,canvasX=32,canvasY=42,canvasPanning=null;
 const defaults={event_message_create:{channel_filter:""},condition_contains:{keyword:""},condition_has_role:{role_id:""},action_send_message:{channel_id:"",content:"",mention_mode:"none",mention_id:"",delete_after_seconds:"",thread_mode:"none"},action_send_embed:{channel_id:"",embed_title:"",author:"",description:"",color:"#356DF3",footer:"",title_url:"",thumbnail_url:"",image_url:"",timestamp:"false"},action_reply:{content:"",reply_target:"event_message",target_message_id:"",fallback:"send_new",mention_author:"false"},action_add_role:{role_id:""},action_remove_role:{role_id:""},action_warn:{reason:""},control_wait:{seconds:"1"},data_set_variable:{variable:"",value:""},data_change_variable:{variable:"",amount:"1"}};

Object.assign(defaults,{
event_message_edit:{},event_message_delete:{},event_reaction_add:{emoji:""},
condition_starts_with:{text:""},condition_ends_with:{text:""},condition_equals:{text:""},condition_channel_is:{channel_id:""},condition_has_attachment:{expected:"true"},condition_is_bot:{expected:"false"},condition_message_length:{operator:"gte",length:"10"},condition_username_contains:{text:""},
action_delete_message:{reason:""},action_add_reaction:{emoji:"👍"},action_send_dm:{content:""},action_set_nickname:{nickname:""},action_create_thread:{name:"새 스레드",auto_archive_minutes:"1440"},action_pin_message:{pin:"true"},action_set_slowmode:{channel_id:"",seconds:"5"},action_log:{message:""},
control_stop:{},control_cooldown:{seconds:"30"},control_random:{chance:"50"},
data_append_variable:{variable:"",text:""},data_math_variable:{variable:"",operator:"add",amount:"1"},
value_text:{value:"텍스트"},value_number:{value:"0"},value_variable:{variable:""},value_user_name:{},value_server_name:{},value_channel_name:{},value_current_time:{}
});
 function makeBlock(type){const def=byType[type];return {id:crypto.randomUUID(),type,fields:{...(defaults[type]||{})}};}
 function markDirty(){dirty=true;$("#blocks-save-state").textContent="변경 사항 있음";saveButton.disabled=false;}
 function drawPalette(){
  const groups=[...new Set(definitions.map(def=>def.group))],tabs=$("#blocks-category-tabs");tabs.replaceChildren();palette.replaceChildren();
  groups.forEach(group=>{const tab=document.createElement("button");tab.type="button";tab.className="bl-category-tab"+(selectedPaletteGroup===group?" active":"");tab.textContent=group;tab.setAttribute("role","tab");tab.setAttribute("aria-selected",String(selectedPaletteGroup===group));tab.addEventListener("click",()=>{selectedPaletteGroup=group;drawPalette();});tabs.append(tab);});
  definitions.filter(def=>def.group===selectedPaletteGroup).forEach(def=>{const button=document.createElement("button");button.type="button";button.className="bl-palette-block "+def.kind;button.draggable=true;button.dataset.type=def.type;button.textContent=def.label;button.addEventListener("click",()=>{if(def.kind==="value"){if(activeValueInput&&document.contains(activeValueInput))insertValue(def.type,activeValueInput);else window.BLOCKS.notify("먼저 작업 공간의 값 입력칸을 누른 뒤 값 블록을 선택해 주세요.");return;}addBlock(def.type);});button.addEventListener("dragstart",e=>{dragSource={kind:"new",type:def.type};e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain",def.type);});palette.append(button);});
 }
 function renderVariables(){
  const host=$("#blocks-variable-list");host.replaceChildren();
  variables.forEach(variable=>{
   const chip=document.createElement("button");chip.type="button";chip.className="bl-variable-chip";chip.draggable=true;chip.textContent=variable;chip.title="입력칸으로 끌어 놓기";
   chip.addEventListener("dragstart",e=>{dragSource={kind:"variable",name:variable};e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain","variable:"+variable);});
   chip.addEventListener("click",()=>{if(activeValueInput){const input=activeValueInput;input.value="{{"+variable+"}}";const card=input.closest(".bl-workspace-block"),block=blocks.find(x=>x.id===card?.dataset.id);if(block){block.fields[input.dataset.key]=input.value;markDirty();}}else window.BLOCKS.notify("먼저 텍스트 값 입력칸을 누른 뒤 변수를 선택해 주세요.");});
   host.append(chip);
  });
 }
 function addBlock(type,index){
  if(blocks.length>=50){window.BLOCKS.notify("프로젝트에는 최대 50개 블록까지 추가할 수 있어요.");return;}
  const block=makeBlock(type);if(Number.isInteger(index))blocks.splice(index,0,block);else blocks.push(block);renderBlocks();markDirty();
 }
 function insertValue(type,input){
  const tokens={value_text:"텍스트",value_number:"0",value_variable:"{{변수명}}",value_user_name:"{{user_name}}",value_server_name:"{{server_name}}",value_channel_name:"{{channel_name}}",value_current_time:"{{current_time}}"};
  if(!(type in tokens)||!input)return;
  input.value=tokens[type];const card=input.closest(".bl-workspace-block"),block=blocks.find(x=>x.id===card?.dataset.id);
  if(block){block.fields[input.dataset.key]=input.value;markDirty();}
  input.focus();
 }
 function fieldElement(block,field){
  const wrap=document.createElement("label");wrap.className="bl-block-field"+(field.full?" full":"");
  const title=document.createElement("span");title.textContent=field.label;wrap.append(title);
  let input;
  if(field.kind==="textarea"){input=document.createElement("textarea");input.placeholder=field.placeholder||"";input.value=block.fields[field.key]??"";}
  else if(field.kind==="select"){input=document.createElement("select");(field.options||[]).forEach(([value,label])=>{const option=document.createElement("option");option.value=value;option.textContent=label;input.append(option);});input.value=block.fields[field.key]??(field.options?.[0]?.[0]||"");}
  else if(field.kind==="channel"||field.kind==="role"){const items=resources[field.kind==="channel"?"channels":"roles"]||[];if(items.length){input=document.createElement("select");const first=document.createElement("option");first.value="";first.textContent=field.kind==="channel"?"채널을 선택해 주세요":"역할을 선택해 주세요";input.append(first);items.forEach(item=>{const option=document.createElement("option");option.value=item.id;option.textContent=(field.kind==="channel"?"#":"@")+item.name;input.append(option);});const current=block.fields[field.key]||"";if(current&&!items.some(item=>item.id===current)){const extra=document.createElement("option");extra.value=current;extra.textContent="저장된 ID · "+current;input.append(extra);}input.value=current;}else{input=document.createElement("input");input.type="text";input.placeholder=field.placeholder+" (목록 동기화 필요)";input.value=block.fields[field.key]??"";}}
  else{input=document.createElement("input");input.type=field.kind==="number"?"number":"text";input.placeholder=field.placeholder||"";input.value=block.fields[field.key]??"";if(field.kind==="number"){input.min="0";input.max=field.key==="seconds"?"10":"86400";}}
  input.className="block-field-input";input.dataset.key=field.key;input.dataset.kind=field.kind;if(field.kind==="value")input.addEventListener("focus",()=>{activeValueInput=input;});input.addEventListener("input",()=>{block.fields[field.key]=input.value;markDirty();});
  input.addEventListener("change",()=>{block.fields[field.key]=input.value;markDirty();});
  input.addEventListener("dragover",e=>{if(field.kind==="value"&&dragSource){e.preventDefault();input.style.outline="2px solid #356df3";}});
  input.addEventListener("dragleave",()=>{input.style.outline="";});
  input.addEventListener("drop",e=>{
   if(field.kind!=="value"||!dragSource)return;e.preventDefault();input.style.outline="";
   if(dragSource.kind==="variable")input.value="{{"+dragSource.name+"}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_text")input.value="텍스트";
   else if(dragSource.kind==="new"&&dragSource.type==="value_number")input.value="0";
   else if(dragSource.kind==="new"&&dragSource.type==="value_variable")input.value="{{변수명}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_user_name")input.value="{{user_name}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_server_name")input.value="{{server_name}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_channel_name")input.value="{{channel_name}}";
   else if(dragSource.kind==="new"&&dragSource.type==="value_current_time")input.value="{{current_time}}";
   block.fields[field.key]=input.value;markDirty();
  });
  wrap.append(input);return wrap;
 }
 function renderBlocks(){
  workspace.replaceChildren();count.textContent=blocks.length+" / 50";
  if(!blocks.length){const empty=document.createElement("div");empty.className="bl-empty bl-canvas-empty";empty.textContent="아직 블록이 없어요. 왼쪽에서 이벤트 블록을 선택하거나 끌어와 시작하세요.";workspace.append(empty);return;}
  let activeStack=null,stackHost=null;
  blocks.forEach((block,index)=>{const def=byType[block.type];if(!def)return;
   if(def.kind==="event"){activeStack=document.createElement("section");activeStack.className="bl-event-stack";activeStack.dataset.eventId=block.id;const eventCard=makeCard(block,def,index);eventCard.classList.add("bl-event-hat");activeStack.append(eventCard);stackHost=document.createElement("div");stackHost.className="bl-event-children";activeStack.append(stackHost);workspace.append(activeStack);}
   else{if(!activeStack){activeStack=document.createElement("section");activeStack.className="bl-event-stack bl-orphan-stack";stackHost=document.createElement("div");stackHost.className="bl-event-children";activeStack.append(stackHost);workspace.append(activeStack);}const card=makeCard(block,def,index);card.classList.add("bl-connected-block");if(def.kind==="condition")card.classList.add("bl-condition-block");stackHost.append(card);}
  });
  applyCanvasTransform();
 }
 function makeCard(block,def,index){
  const card=document.createElement("article");card.className="bl-workspace-block";card.draggable=true;card.dataset.id=block.id;
  card.addEventListener("dragstart",e=>{if(e.target.closest("input,textarea,select,button")){e.preventDefault();return;}dragSource={kind:"move",id:block.id};card.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain","block:"+block.id);});
  card.addEventListener("dragend",()=>{card.classList.remove("dragging");document.querySelectorAll(".bl-drop-before,.bl-drop-after").forEach(node=>node.classList.remove("bl-drop-before","bl-drop-after"));});
  card.addEventListener("dragover",e=>{if(!dragSource||dragSource.kind!=="move"||dragSource.id===block.id)return;e.preventDefault();const rect=card.getBoundingClientRect(),after=e.clientY>rect.top+rect.height/2;card.classList.toggle("bl-drop-before",!after);card.classList.toggle("bl-drop-after",after);});
  card.addEventListener("dragleave",e=>{if(!card.contains(e.relatedTarget))card.classList.remove("bl-drop-before","bl-drop-after");});
  const head=document.createElement("div");head.className="bl-block-head "+def.kind;const title=document.createElement("span");title.textContent=def.label;head.append(title);const tools=document.createElement("div");tools.className="bl-block-tools";
  [["↑",-1],["↓",1],["삭제","delete"]].forEach(([label,action])=>{const button=document.createElement("button");button.type="button";button.textContent=label;button.addEventListener("click",()=>{const current=blocks.findIndex(x=>x.id===block.id);if(current<0)return;if(action==="delete")blocks.splice(current,1);else{const next=current+Number(action);if(next<0||next>=blocks.length)return;const item=blocks.splice(current,1)[0];blocks.splice(next,0,item);}renderBlocks();markDirty();});tools.append(button);});head.append(tools);card.append(head);
  if(def.fields.length){const fields=document.createElement("div");fields.className="bl-block-fields";def.fields.forEach(field=>fields.append(fieldElement(block,field)));card.append(fields);}return card;
 }
 function applyCanvasTransform(){const world=$("#blocks-workspace-list");if(!world)return;world.style.transform="translate("+canvasX+"px,"+canvasY+"px) scale("+canvasScale+")";$("#blocks-zoom-label").textContent=Math.round(canvasScale*100)+"%";}
 function setupCanvas(){
  const area=$("#blocks-workspace");area.addEventListener("contextmenu",e=>e.preventDefault());
  area.addEventListener("mousedown",e=>{if(e.button===2||e.button===1){e.preventDefault();canvasPanning={x:e.clientX,y:e.clientY,originX:canvasX,originY:canvasY};area.classList.add("is-panning");}});
  window.addEventListener("mousemove",e=>{if(!canvasPanning)return;canvasX=canvasPanning.originX+e.clientX-canvasPanning.x;canvasY=canvasPanning.originY+e.clientY-canvasPanning.y;applyCanvasTransform();});
  window.addEventListener("mouseup",()=>{canvasPanning=null;area.classList.remove("is-panning");});
  area.addEventListener("wheel",e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();canvasScale=Math.max(.45,Math.min(1.7,canvasScale*(e.deltaY<0?1.08:.92)));applyCanvasTransform();}},{passive:false});
  $("#blocks-zoom-in").addEventListener("click",()=>{canvasScale=Math.min(1.7,canvasScale*1.12);applyCanvasTransform();});$("#blocks-zoom-out").addEventListener("click",()=>{canvasScale=Math.max(.45,canvasScale/1.12);applyCanvasTransform();});$("#blocks-zoom-reset").addEventListener("click",()=>{canvasScale=1;canvasX=32;canvasY=42;applyCanvasTransform();});
  let touch=null;area.addEventListener("touchstart",e=>{if(e.touches.length===2)touch={x:(e.touches[0].clientX+e.touches[1].clientX)/2,y:(e.touches[0].clientY+e.touches[1].clientY)/2,ox:canvasX,oy:canvasY};},{passive:true});
  area.addEventListener("touchmove",e=>{if(touch&&e.touches.length===2){const x=(e.touches[0].clientX+e.touches[1].clientX)/2,y=(e.touches[0].clientY+e.touches[1].clientY)/2;canvasX=touch.ox+x-touch.x;canvasY=touch.oy+y-touch.y;applyCanvasTransform();}},{passive:true});area.addEventListener("touchend",()=>{touch=null;});
 }
 function setupDrop(){
  const area=$("#blocks-workspace");
  area.addEventListener("dragover",e=>{if(dragSource){e.preventDefault();e.dataTransfer.dropEffect=dragSource.kind==="move"?"move":"copy";}});
  area.addEventListener("drop",e=>{
   if(!dragSource)return;
   const targetField=e.target.closest(".block-field-input");
   if(targetField&&targetField.dataset.kind==="value")return;
   e.preventDefault();
   if(dragSource.kind==="new"){const target=e.target.closest(".bl-workspace-block");if(!target){addBlock(dragSource.type);return;}const targetIndex=blocks.findIndex(b=>b.id===target.dataset.id);const rect=target.getBoundingClientRect();const after=e.clientY>rect.top+rect.height/2;addBlock(dragSource.type,Math.max(0,targetIndex+(after?1:0)));return;}
   if(dragSource.kind==="move"){
    const from=blocks.findIndex(b=>b.id===dragSource.id),target=e.target.closest(".bl-workspace-block");
    if(from<0)return;
    const moving=blocks[from],movingDef=byType[moving.type];
    if(!target){if(movingDef?.kind==="event"){window.BLOCKS.notify("이벤트 블록은 다른 이벤트 스택과 함께 이동해야 해요.");return;}const stackStart=blocks.map((b,i)=>byType[b.type]?.kind==="event"?i:-1).filter(i=>i>=0).filter(i=>i<=from).pop();const stackEnd=blocks.findIndex((b,i)=>i>from&&byType[b.type]?.kind==="event");const end=stackEnd<0?blocks.length:stackEnd;if(from<stackStart||from>=end)return;const item=blocks.splice(from,1)[0];blocks.splice(end-1,0,item);renderBlocks();markDirty();return;}
    const to=blocks.findIndex(b=>b.id===target.dataset.id);if(to<0||to===from)return;
    const targetDef=byType[blocks[to].type];const targetIsEvent=targetDef?.kind==="event";
    if(movingDef?.kind==="event"){
      let sourceEnd=blocks.findIndex((b,i)=>i>from&&byType[b.type]?.kind==="event");if(sourceEnd<0)sourceEnd=blocks.length;
      const segment=blocks.splice(from,sourceEnd-from);
      let targetStart=blocks.findIndex(b=>b.id===target.dataset.id);
      if(targetStart<0){blocks.push(...segment);}else if(targetIsEvent){blocks.splice(targetStart,0,...segment);}else{const targetRoot=blocks.map((b,i)=>byType[b.type]?.kind==="event"?i:-1).filter(i=>i>=0).filter(i=>i<=targetStart).pop();let targetEnd=blocks.findIndex((b,i)=>i>targetRoot&&byType[b.type]?.kind==="event");if(targetEnd<0)targetEnd=blocks.length;blocks.splice(targetEnd,0,...segment);}
    }else{
      let sourceRoot=blocks.map((b,i)=>byType[b.type]?.kind==="event"?i:-1).filter(i=>i>=0).filter(i=>i<=from).pop();
      let sourceEnd=blocks.findIndex((b,i)=>i>sourceRoot&&byType[b.type]?.kind==="event");if(sourceEnd<0)sourceEnd=blocks.length;
      if(targetIsEvent||to<sourceRoot||to>=sourceEnd){window.BLOCKS.notify("일반 블록은 같은 이벤트 스택 안에서 이동할 수 있어요.");return;}
      const rect=target.getBoundingClientRect(),after=e.clientY>rect.top+rect.height/2;
      const item=blocks.splice(from,1)[0];let insert=blocks.findIndex(b=>b.id===target.dataset.id);if(after)insert++;
      blocks.splice(Math.max(sourceRoot,insert>from?insert-1:insert),0,item);
    }
    renderBlocks();markDirty();
   }
  });
  document.addEventListener("dragend",()=>{dragSource=null;document.querySelectorAll(".bl-drop-before,.bl-drop-after").forEach(node=>node.classList.remove("bl-drop-before","bl-drop-after"));});
  document.addEventListener("drop",()=>{setTimeout(()=>{dragSource=null;document.querySelectorAll(".bl-drop-before,.bl-drop-after").forEach(node=>node.classList.remove("bl-drop-before","bl-drop-after"));},0);});
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
   drawPalette();renderVariables();renderBlocks();renderEnable();setupDrop();setupCanvas();saveButton.disabled=false;
   saveButton.addEventListener("click",save);enableButton.addEventListener("click",toggleEnabled);
   $("#blocks-add-variable").addEventListener("click",()=>{const input=$("#blocks-variable-name"),value=input.value.trim().slice(0,40);if(!value)return;if(!variables.includes(value)){variables.push(value);renderVariables();markDirty();}input.value="";});
   nameInput.addEventListener("input",markDirty);
   await loadLogs();
   window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  }catch(error){console.error("BLOCKS editor init failed",error);workspace.innerHTML='<div class="bl-empty">'+window.BLOCKS.escape(error.message||"편집기를 불러오지 못했어요.")+'</div>';}
 }
 init();
})();
