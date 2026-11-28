(() => {
 const $=s=>document.querySelector(s),sb=window.BLOCKS.sb;
 const params=new URLSearchParams(location.search),projectId=params.get("id");
 const nameInput=$("#blocks-project-name"),saveButton=$("#blocks-save"),enableButton=$("#blocks-enable");
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
  {type:"value_current_time",group:"값",kind:"value",label:"현재 시간",fields:[]}];
 const byType=Object.fromEntries(definitions.map(d=>[d.type,d]));
 let user,project,server,resources={channels:[],roles:[]},variables=[],dirty=false,workspace=null;
 const groups=["이벤트","조건","동작","제어","변수","값"];
 const categoryFor=d=>d.group;
 const statementTypes=definitions.filter(d=>!["value"].includes(d.kind)).map(d=>d.type);
 function blockDef(d){
  Blockly.Blocks[d.type]={init(){
   this.setColour(({event:45,condition:275,action:145,control:25,data:210,value:195})[d.kind]||210);
   this.setTooltip(d.label);this.setHelpUrl("");
   this.appendDummyInput("HEAD").appendField(d.label);
   (d.fields||[]).forEach(f=>{
    if(f.kind==="value"||f.kind==="number"){
     const input=this.appendValueInput(f.key.toUpperCase()).appendField(f.label);
     input.setCheck(f.kind==="number"?"Number":"String");
     input.connection.setShadowState(f.kind==="number"?{type:"value_number",fields:{NUMBER:0}}:{type:"value_text",fields:{TEXT:f.placeholder||"텍스트 입력"}});
    }else if(f.kind==="select"){
     this.appendDummyInput("FIELD_"+f.key).appendField(f.label).appendField(new Blockly.FieldDropdown(f.options),f.key.toUpperCase());
    }else{
     this.appendDummyInput("FIELD_"+f.key).appendField(f.label).appendField(new Blockly.FieldTextInput(""),f.key.toUpperCase());
    }
   });
   if(d.kind==="event"){this.setNextStatement(true);this.setDeletable(true);}
   else if(d.kind==="condition"){this.setOutput(true,"Boolean");}
   else if(d.kind==="value"){this.setOutput(true,d.type==="value_number"?"Number":"String");}
   else{this.setPreviousStatement(true);this.setNextStatement(true);}
   this.setInputsInline(false);
  }};
 }
 function registerSpecialBlocks(){
  Blockly.Blocks.control_if={init(){this.setColour(25);this.appendValueInput("CONDITION").setCheck("Boolean").appendField("만약");this.appendDummyInput().appendField("이라면");this.appendStatementInput("DO").appendField("실행");this.setPreviousStatement(true);this.setNextStatement(true);this.setInputsInline(true);this.setTooltip("조건이 참이면 안쪽 블록을 실행합니다.");}};
  Blockly.Blocks.control_if_else={init(){this.setColour(25);this.appendValueInput("CONDITION").setCheck("Boolean").appendField("만약");this.appendDummyInput().appendField("이라면");this.appendStatementInput("DO").appendField("실행");this.appendDummyInput().appendField("아니면");this.appendStatementInput("ELSE").appendField("실행");this.setPreviousStatement(true);this.setNextStatement(true);this.setInputsInline(true);}};
  Blockly.Blocks.control_repeat_count={init(){this.setColour(25);this.appendDummyInput().appendField("반복하기").appendField(new Blockly.FieldNumber(3,1,20,1),"TIMES").appendField("번");this.appendStatementInput("DO").appendField("실행");this.setPreviousStatement(true);this.setNextStatement(true);}};
  Blockly.Blocks.value_text={init(){this.setColour(195);this.appendDummyInput().appendField("텍스트").appendField(new Blockly.FieldTextInput("텍스트"),"TEXT");this.setOutput(true,"String");}};
  Blockly.Blocks.value_number={init(){this.setColour(195);this.appendDummyInput().appendField("숫자").appendField(new Blockly.FieldNumber(0),"NUMBER");this.setOutput(true,"Number");}};
  Blockly.Blocks.value_variable={init(){this.setColour(195);this.appendDummyInput().appendField("변수").appendField(new Blockly.FieldTextInput("변수명"),"VARIABLE");this.setOutput(true);}};
  Blockly.Blocks.value_user_name={init(){this.setColour(195);this.appendDummyInput().appendField("사용자 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_server_name={init(){this.setColour(195);this.appendDummyInput().appendField("서버 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_channel_name={init(){this.setColour(195);this.appendDummyInput().appendField("채널 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_current_time={init(){this.setColour(195);this.appendDummyInput().appendField("현재 시간");this.setOutput(true,"String");}};
 }
 function buildToolbox(){
  const contents=groups.map(group=>({kind:"category",name:group,colour:({이벤트:"#e6a23c",조건:"#9a76dc",동작:"#38a879",제어:"#e28c48",변수:"#4b8fe8",값:"#2999b9"})[group],contents:definitions.filter(d=>d.group===group).map(d=>({kind:"block",type:d.type}))}));
  contents.splice(3,0,{kind:"category",name:"조건문",colour:"#e28c48",contents:[{kind:"block",type:"control_if"},{kind:"block",type:"control_if_else"},{kind:"block",type:"control_repeat_count"}]});
  return {kind:"categoryToolbox",contents};
 }
 function refreshVariableDropdowns(){
  if(!workspace)return;
  const opts=variables.length?variables.map(v=>[v,v]):[["변수 없음",""]];
  workspace.getAllBlocks(false).filter(b=>b.type==="value_variable").forEach(b=>{const field=b.getField("VARIABLE");if(field)field.menuGenerator_=opts;});
 }
 function initBlockly(){
  definitions.forEach(blockDef);registerSpecialBlocks();
  workspace=Blockly.inject("blocklyDiv",{toolbox:buildToolbox(),renderer:"zelos",theme:Blockly.Theme.defineTheme("tendBlocks",{base:Blockly.Themes.Classic,componentStyles:{workspaceBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#101a27":"#f6f8fc",toolboxBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#172333":"#ffffff",toolboxForegroundColour:document.documentElement.classList.contains("theme-dark")?"#edf3fb":"#172033",flyoutBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#1b293a":"#ffffff",flyoutForegroundColour:document.documentElement.classList.contains("theme-dark")?"#edf3fb":"#172033",flyoutOpacity:1,scrollbarColour:"#8b9bb3",insertionMarkerColour:"#3978f6",insertionMarkerOpacity:.35,markerColour:"#3978f6",cursorColour:"#3978f6"}}),grid:{spacing:24,length:3,colour:document.documentElement.classList.contains("theme-dark")?"#344153":"#dce3ed",snap:true},zoom:{controls:true,wheel:true,startScale:1,maxScale:1.8,minScale:.45,scaleSpeed:1.12},move:{scrollbars:true,drag:true,wheel:true},trashcan:true,renderer:"zelos",sounds:false,oneBasedIndex:false});
  workspace.addChangeListener(e=>{if(e.isUiEvent||e.type==="ui")return;markDirty();$("#blocks-count").textContent=workspace.getAllBlocks(false).length+" / 50";});
 }
 function markDirty(){dirty=true;$("#blocks-save-state").textContent="변경 사항 있음";saveButton.disabled=false;}
 function nodeFromBlock(block){
  if(!block)return null;
  const node={id:block.id,type:block.type,fields:{},values:{}};
  block.inputList.forEach(input=>{
   if(input.type===Blockly.inputTypes.VALUE){const child=block.getInputTargetBlock(input.name);if(child)node.values[input.name]=nodeFromBlock(child);}
  });
  block.inputList.forEach(input=>input.fieldRow.forEach(field=>{if(field.name)node.fields[field.name]=field.getValue();}));
  if(block.type==="control_if"||block.type==="control_if_else"||block.type==="control_repeat_count"){
   node.children=chainToArray(block.getInputTargetBlock("DO"));
   if(block.type==="control_if_else")node.else_children=chainToArray(block.getInputTargetBlock("ELSE"));
  }
  const next=block.getNextBlock();if(next)node.next=nodeFromBlock(next);
  return node;
 }
 function chainToArray(block){const out=[];let current=block,guard=0;while(current&&guard++<50){out.push(nodeFromBlock(current));current=current.getNextBlock();}return out;}
 function projectJSON(){
  const roots=workspace.getTopBlocks(true).filter(b=>byType[b.type]?.kind==="event"||b.type.startsWith("event_")).map(nodeFromBlock);
  return {schema_version:2,variables,roots};
 }
 function createBlock(type,fields={},parent=null,connection="next"){
  if(!Blockly.Blocks[type])return null;
  const b=workspace.newBlock(type);b.initSvg();b.render();
  Object.entries(fields||{}).forEach(([key,value])=>{const f=b.getField(key.toUpperCase());if(f&&value!==null&&value!==undefined)try{f.setValue(String(value));}catch{}});
  if(parent&&parent.nextConnection&&b.previousConnection)parent.nextConnection.connect(b.previousConnection);
  return b;
 }
 function restoreProject(data){
  workspace.clear();
  if(data?.schema_version===2&&Array.isArray(data.roots)){
   const loadNode=(node,parentConn)=>{
    if(!node||!Blockly.Blocks[node.type])return null;
    const b=createBlock(node.type,node.fields);
    if(parentConn&&b.previousConnection)try{parentConn.connect(b.previousConnection);}catch{}
    Object.entries(node.values||{}).forEach(([key,value])=>{const input=b.getInput(key);if(input?.connection){const child=loadNode(value,null);if(child?.outputConnection)try{input.connection.connect(child.outputConnection);}catch{}}});
    if(["control_if","control_if_else","control_repeat_count"].includes(node.type)){
     const addChain=(arr,inputName)=>{let prior=null;(arr||[]).forEach(child=>{const item=loadNode(child,prior?prior.nextConnection:b.getInput(inputName)?.connection);if(item)prior=item;});};
     addChain(node.children,"DO");if(node.type==="control_if_else")addChain(node.else_children,"ELSE");
    }
    if(node.next){const next=loadNode(node.next,b.nextConnection);return next?b: b;}
    return b;
   };
   data.roots.forEach(root=>loadNode(root,null));
  }else if(Array.isArray(data?.blocks)){
   let currentEvent=null,currentTail=null;
   data.blocks.forEach(old=>{
    if(old.type.startsWith("event_")){currentEvent=createBlock(old.type,old.fields);currentTail=currentEvent;return;}
    if(old.type.startsWith("condition_")){
     const cond=createBlock(old.type,old.fields);const wrap=createBlock("control_if");if(cond?.outputConnection)try{wrap.getInput("CONDITION").connection.connect(cond.outputConnection);}catch{}
     if(currentTail?.nextConnection)try{currentTail.nextConnection.connect(wrap.previousConnection);}catch{}currentTail=wrap;return;
    }
    const next=createBlock(old.type,old.fields);if(currentTail?.nextConnection&&next?.previousConnection)try{currentTail.nextConnection.connect(next.previousConnection);}catch{}if(next)currentTail=next;
   });
  }
  workspace.getAllBlocks(false).forEach(b=>{try{b.render();}catch{}});
  $("#blocks-count").textContent=workspace.getAllBlocks(false).length+" / 50";
 }
 async function save(){
  const all=workspace.getAllBlocks(false);if(all.length>50){window.BLOCKS.notify("프로젝트에는 최대 50개 블록까지 사용할 수 있어요.");return false;}
  const data=projectJSON();if(JSON.stringify(data).length>200000){window.BLOCKS.notify("프로젝트 데이터가 너무 커요.");return false;}
  saveButton.disabled=true;$("#blocks-save-state").textContent="저장 중…";
  try{
   const {data:updated,error}=await sb.from("blocks_projects").update({name:nameInput.value.trim().slice(0,60)||"새 프로젝트",project_data:data,version:(project.version||1)+1,updated_at:new Date().toISOString()}).eq("id",project.id).eq("owner_id",user.id).select("id,name,project_data,is_enabled").single();
   if(error)throw error;project=updated;dirty=false;$("#blocks-save-state").textContent="저장 완료";saveButton.disabled=false;return true;
  }catch(error){console.error("BLOCKS project save failed",error);window.BLOCKS.notify(error.message||"저장하지 못했어요.");$("#blocks-save-state").textContent="저장 실패";saveButton.disabled=false;return false;}
 }
 async function toggleEnabled(){
  if(dirty&&!await save())return;
  if(!server?.bot_connected){window.BLOCKS.notify("TEND 봇을 먼저 서버에 초대해 주세요.");return;}
  if(!workspace.getTopBlocks(true).some(b=>b.type.startsWith("event_"))){window.BLOCKS.notify("실행하려면 이벤트 블록을 하나 이상 추가해 주세요.");return;}
  enableButton.disabled=true;
  try{const next=!project.is_enabled;const {data,error}=await sb.from("blocks_projects").update({is_enabled:next,updated_at:new Date().toISOString()}).eq("id",project.id).eq("owner_id",user.id).select("is_enabled").single();if(error)throw error;project.is_enabled=data.is_enabled;enableButton.textContent=next?"실행 중지":"실행 활성화";window.BLOCKS.notify(next?"프로젝트 실행을 활성화했어요.":"프로젝트 실행을 중지했어요.");}
  catch(error){console.error(error);window.BLOCKS.notify(error.message||"실행 상태를 변경하지 못했어요.");}finally{enableButton.disabled=false;}
 }
 async function loadLogs(){
  const host=$("#blocks-run-logs"),{data,error}=await sb.from("blocks_execution_logs").select("event_type,status,message,created_at").eq("project_id",project.id).order("created_at",{ascending:false}).limit(20);host.replaceChildren();
  if(error||!data?.length){const empty=document.createElement("div");empty.className="bl-empty";empty.textContent=error?"실행 기록을 불러오지 못했어요.":"아직 실행 기록이 없어요.";host.append(empty);return;}
  data.forEach(row=>{const item=document.createElement("div");item.className="bl-log";const title=document.createElement("b");title.textContent=row.status+" · "+row.event_type;const message=document.createElement("div");message.textContent=row.message||"실행 기록";const time=document.createElement("small");time.textContent=new Date(row.created_at).toLocaleString("ko-KR");item.append(title,message,time);host.append(item);});
 }
 async function init(){
  try{
   user=await window.BLOCKS.requireTester("./blocks-editor.html?id="+encodeURIComponent(projectId||""));if(!user)return;
   if(!projectId)throw new Error("프로젝트 정보가 없어요. 대시보드에서 프로젝트를 열어 주세요.");
   const {data,error}=await sb.from("blocks_projects").select("*").eq("id",projectId).eq("owner_id",user.id).single();if(error)throw error;project=data;
   nameInput.value=project.name;variables=Array.isArray(project.project_data?.variables)?project.project_data.variables:[];
   const {data:servers,error:serverError}=await sb.rpc("blocks_list_servers");if(serverError)throw serverError;server=(servers||[]).find(x=>x.server_id===project.server_id)||null;
   $("#blocks-editor-server").textContent=(server?.server_name||"선택한 서버")+" · "+(server?.bot_connected?"TEND 봇 연결됨":"TEND 봇 초대 필요");
   initBlockly();restoreProject(project.project_data||{});refreshVariableDropdowns();enableButton.textContent=project.is_enabled?"실행 중지":"실행 활성화";
   saveButton.disabled=false;saveButton.addEventListener("click",save);enableButton.addEventListener("click",toggleEnabled);
   $("#blocks-add-variable").addEventListener("click",()=>{const input=$("#blocks-variable-name"),value=input.value.trim().slice(0,40);if(value&&!variables.includes(value)){variables.push(value);refreshVariableDropdowns();markDirty();}input.value="";});
   nameInput.addEventListener("input",markDirty);
   await loadLogs();
   window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  }catch(error){console.error("BLOCKS editor init failed",error);$("#blocklyDiv").innerHTML='<div class="bl-empty">'+window.BLOCKS.escape(error.message||"편집기를 불러오지 못했어요.")+'</div>';}
 }
 init();
})();