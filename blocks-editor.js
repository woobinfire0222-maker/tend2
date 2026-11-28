(() => {
 const $=s=>document.querySelector(s),sb=window.BLOCKS.sb;
 const params=new URLSearchParams(location.search),projectId=params.get("id");
 const nameInput=$("#blocks-project-name"),saveButton=$("#blocks-save"),enableButton=$("#blocks-enable");
 const definitions=[
  {type:"event_message_create",group:"이벤트",kind:"event",label:"새 메시지가 올라오면",fields:[{key:"channel_filter",label:"채널 제한",placeholder:"전체 채널",kind:"channel"}]},
  {type:"event_member_join",group:"이벤트",kind:"event",label:"새 멤버가 들어오면",fields:[]},
  {type:"event_member_leave",group:"이벤트",kind:"event",label:"멤버가 나가면",fields:[]},
  {type:"event_slash_command",group:"이벤트",kind:"event",label:"슬래시 명령어가 실행되었을 때",fields:[{key:"command_id",label:"명령어 선택",kind:"slash_command"}]},
  {type:"condition_contains",group:"조건",kind:"condition",label:"메시지에 단어가 포함되면",fields:[{key:"keyword",label:"찾을 단어",placeholder:"예: 안녕하세요",kind:"value",full:true}]},
  {type:"condition_has_role",group:"조건",kind:"condition",label:"사용자가 역할을 가지고 있으면",fields:[{key:"role_id",label:"역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_send_message",group:"동작",kind:"action",label:"메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널",placeholder:"채널 선택",kind:"channel"},{key:"content",label:"메시지 내용",placeholder:"메시지 조립 블록을 연결해 주세요.",kind:"value",full:true},{key:"mention_mode",label:"멘션 방식",kind:"select",options:[["none","멘션 없음"],["everyone","@everyone"],["here","@here"],["user","특정 사용자"],["role","특정 역할"]]},{key:"mention_id",label:"멘션 대상 ID",placeholder:"사용자 또는 역할 ID",kind:"text"},{key:"delete_after_seconds",label:"자동 삭제 (초)",placeholder:"사용 안 함",kind:"number"},{key:"thread_mode",label:"스레드",kind:"select",options:[["none","사용 안 함"],["create","새 스레드"],["reply","기존 스레드"]] }]},
  {type:"action_send_embed",group:"동작",kind:"action",label:"임베드 메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널",placeholder:"채널 선택",kind:"channel"},{key:"embed_title",label:"제목",placeholder:"임베드 제목",kind:"text"},{key:"author",label:"작성자 표시",placeholder:"선택 입력",kind:"text"},{key:"description",label:"설명",placeholder:"임베드 본문",kind:"textarea",full:true},{key:"color",label:"색상 HEX",placeholder:"#356DF3",kind:"text"},{key:"footer",label:"하단 문구",placeholder:"선택 입력",kind:"text"},{key:"title_url",label:"제목 링크",placeholder:"https://",kind:"text"},{key:"thumbnail_url",label:"썸네일 URL",placeholder:"https://",kind:"text"},{key:"image_url",label:"큰 이미지 URL",placeholder:"https://",kind:"text"},{key:"timestamp",label:"시간 표시",kind:"select",options:[["false","표시 안 함"],["true","현재 시간 표시"]]}]},
  {type:"action_reply",group:"동작",kind:"action",label:"메시지에 답장하기",fields:[{key:"content",label:"답장 내용",placeholder:"메시지 조립 블록을 연결해 주세요.",kind:"value",full:true},{key:"reply_target",label:"답장 대상",kind:"select",options:[["event_message","현재 이벤트 메시지"],["latest_message","가장 최근 메시지"],["message_id","직접 지정한 메시지 ID"]]},{key:"target_message_id",label:"메시지 ID",placeholder:"직접 지정할 때 입력",kind:"text"},{key:"fallback",label:"대상 메시지가 없을 때",kind:"select",options:[["send_new","새 메시지로 전송"],["skip","동작 건너뛰기"]]},{key:"mention_author",label:"작성자 멘션",kind:"select",options:[["false","멘션하지 않음"],["true","작성자 멘션"]]}]},
  {type:"action_interaction_respond",group:"동작",kind:"action",label:"슬래쉬 명령어에 응답하기",fields:[{key:"content",label:"응답 내용",placeholder:"메시지 조립 블록을 연결해 주세요.",kind:"value",full:true},{key:"ephemeral",label:"응답 공개 범위",kind:"select",options:[["true","실행한 사람에게만 표시"],["false","서버에 공개"]]}]},
  {type:"action_webhook_send",group:"동작",kind:"action",label:"웹훅으로 메시지 보내기",fields:[{key:"channel_id",label:"보낼 채널",placeholder:"채널 선택",kind:"channel",full:true},{key:"webhook_name",label:"웹훅 이름",placeholder:"TEND 알림",kind:"text"},{key:"username",label:"표시 이름",placeholder:"TEND 알림",kind:"text"},{key:"avatar_url",label:"프로필 이미지 URL (선택)",placeholder:"https://",kind:"text",full:true},{key:"content",label:"메시지 내용",placeholder:"메시지 조립 블록을 연결해 주세요.",kind:"value",full:true},{key:"embed_title",label:"임베드 제목 (선택)",placeholder:"제목",kind:"text"},{key:"embed_description",label:"임베드 설명 (선택)",placeholder:"설명",kind:"textarea",full:true},{key:"embed_color",label:"임베드 색상 HEX",placeholder:"#356DF3",kind:"text"}]},
  {type:"action_add_role",group:"동작",kind:"action",label:"역할 지급하기",fields:[{key:"role_id",label:"지급할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_remove_role",group:"동작",kind:"action",label:"역할 회수하기",fields:[{key:"role_id",label:"회수할 역할",placeholder:"역할 선택",kind:"role",full:true}]},
  {type:"action_warn",group:"동작",kind:"action",label:"사용자에게 경고하기",fields:[{key:"reason",label:"경고 사유",placeholder:"경고 사유",kind:"textarea",full:true}]},
  {type:"control_wait",group:"제어",kind:"control",label:"잠시 기다리기",fields:[{key:"seconds",label:"대기 시간 (초, 최대 10)",placeholder:"1",kind:"number"}]},
  {type:"data_set_variable",group:"변수",kind:"data",label:"변수에 값 저장하기",fields:[{key:"variable",label:"변수",kind:"variable"},{key:"value",label:"저장할 값",placeholder:"값 블록 연결",kind:"value"}]},
  {type:"data_change_variable",group:"변수",kind:"data",label:"변수 값 변경하기",fields:[{key:"variable",label:"변수",kind:"variable"},{key:"amount",label:"변경할 값",placeholder:"1",kind:"number"}]}
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
  {type:"data_append_variable",group:"변수",kind:"data",label:"변수 뒤에 텍스트 이어붙이기",fields:[{key:"variable",label:"변수",kind:"variable"},{key:"text",label:"추가할 텍스트",placeholder:"내용",kind:"value"}]},
  {type:"data_math_variable",group:"변수",kind:"data",label:"숫자 변수 계산하기",fields:[{key:"variable",label:"변수",kind:"variable"},{key:"operator",label:"계산",kind:"select",options:[["add","더하기"],["subtract","빼기"],["multiply","곱하기"],["divide","나누기"]]},{key:"amount",label:"숫자",placeholder:"1",kind:"number"}]},
  {type:"value_text",group:"값",kind:"value",label:"텍스트 값",fields:[{key:"value",label:"텍스트",placeholder:"텍스트 입력",kind:"text"}]},
  {type:"value_number",group:"값",kind:"value",label:"숫자 값",fields:[{key:"value",label:"숫자",placeholder:"0",kind:"number"}]},
  {type:"value_variable",group:"값",kind:"value",label:"변수 값",fields:[{key:"variable",label:"변수",kind:"variable"}]},
  {type:"event_signal",group:"신호",kind:"event",label:"신호를 받았을 때",fields:[{key:"signal_id",label:"신호",kind:"signal"}]},
  {type:"data_broadcast_signal",group:"신호",kind:"data",label:"신호 보내기",fields:[{key:"signal_id",label:"신호",kind:"signal"}]},
  {type:"value_math",group:"계산",kind:"value",label:"계산",fields:[]},
  {type:"value_join",group:"값",kind:"value",label:"문장 이어 붙이기",fields:[]},
  {type:"value_date",group:"값",kind:"value",label:"현재 날짜",fields:[]},
  {type:"value_command_user",group:"값",kind:"value",label:"명령어 실행자",fields:[]},
  {type:"value_command_option",group:"값",kind:"value",label:"명령어 옵션 값",fields:[{key:"option_id",label:"옵션",kind:"command_option"}]},
  {type:"value_user_name",group:"값",kind:"value",label:"이벤트 사용자 이름",fields:[]},
  {type:"value_server_name",group:"값",kind:"value",label:"현재 서버 이름",fields:[]},
  {type:"value_channel_name",group:"값",kind:"value",label:"현재 채널 이름",fields:[]},
  {type:"value_current_time",group:"값",kind:"value",label:"현재 시간",fields:[]}];
 const byType=Object.fromEntries(definitions.map(d=>[d.type,d]));
 let user,project,server,resources={channels:[],roles:[]},variables=[],dirty=false,workspace=null;
 const groups=["이벤트","조건","동작","제어","변수","신호","계산","값"];
 let signals=[],slashCommands=[];
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
     input.setCheck(f.kind==="number"?"Number":null);
     input.connection.setShadowState(f.kind==="number"?{type:"value_number",fields:{NUMBER:0}}:{type:"value_text",fields:{TEXT:f.placeholder||"텍스트 입력"}});
    }else if(["variable","signal","slash_command","command_option"].includes(f.kind)){
     this.appendDummyInput("FIELD_"+f.key).appendField(f.label).appendField(new Blockly.FieldDropdown(()=>managedOptions(f.kind)),f.key.toUpperCase());
    }else if(f.kind==="select"){
     this.appendDummyInput("FIELD_"+f.key).appendField(f.label).appendField(new Blockly.FieldDropdown(f.options),f.key.toUpperCase());
    }else{
     this.appendDummyInput("FIELD_"+f.key).appendField(f.label).appendField(f.kind==="channel"||f.kind==="role"?new Blockly.FieldDropdown(()=>resourceOptions(f.kind,f.key)):new Blockly.FieldTextInput(""),f.key.toUpperCase());
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
  Blockly.Blocks.value_variable={init(){this.setColour(195);this.appendDummyInput().appendField("변수").appendField(new Blockly.FieldDropdown(()=>managedOptions("variable")),"VARIABLE");this.setOutput(true);}};
  Blockly.Blocks.event_signal={init(){this.setColour(45);this.appendDummyInput().appendField("신호").appendField(new Blockly.FieldDropdown(()=>managedOptions("signal")),"SIGNAL_ID").appendField("을 받았을 때");this.setNextStatement(true);}};
  Blockly.Blocks.data_broadcast_signal={init(){this.setColour(210);this.appendDummyInput().appendField("신호 보내기").appendField(new Blockly.FieldDropdown(()=>managedOptions("signal")),"SIGNAL_ID");this.setPreviousStatement(true);this.setNextStatement(true);}};
  Blockly.Blocks.value_date={init(){this.setColour(195);this.appendDummyInput().appendField("현재 날짜");this.setOutput(true,"String");}};
  Blockly.Blocks.value_command_user={init(){this.setColour(195);this.appendDummyInput().appendField("명령어 실행자");this.setOutput(true,"String");}};
  Blockly.Blocks.value_command_option={init(){this.setColour(195);this.appendDummyInput().appendField("명령어 옵션").appendField(new Blockly.FieldDropdown(()=>managedOptions("command_option")),"OPTION_ID");this.setOutput(true);}};
  Blockly.Blocks.value_join={init(){this.setColour(195);this.appendValueInput("A").setCheck(null).appendField("문장 이어 붙이기");this.appendValueInput("B").setCheck(null).appendField("+");this.setOutput(true,"String");}};
  Blockly.Blocks.value_math={init(){this.setColour(195);this.appendValueInput("A").setCheck("Number");this.appendDummyInput().appendField(new Blockly.FieldDropdown([["+","+ "],["−","-"],["×","*"],["÷","/"],["나머지","%"]]),"OP");this.appendValueInput("B").setCheck("Number");this.setOutput(true,"Number");}};
  Blockly.Blocks.value_user_name={init(){this.setColour(195);this.appendDummyInput().appendField("사용자 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_server_name={init(){this.setColour(195);this.appendDummyInput().appendField("서버 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_channel_name={init(){this.setColour(195);this.appendDummyInput().appendField("채널 이름");this.setOutput(true,"String");}};
  Blockly.Blocks.value_current_time={init(){this.setColour(195);this.appendDummyInput().appendField("현재 시간");this.setOutput(true,"String");}};
 }
 function buildToolbox(){
  const contents=groups.map(group=>({kind:"category",name:group,colour:({이벤트:"#e6a23c",조건:"#9a76dc",동작:"#38a879",제어:"#e28c48",변수:"#4b8fe8",신호:"#d45c88",계산:"#2999b9",값:"#2999b9"})[group],contents:definitions.filter(d=>d.group===group).map(d=>({kind:"block",type:d.type}))}));
  contents.splice(3,0,{kind:"category",name:"조건문",colour:"#e28c48",contents:[{kind:"block",type:"control_if"},{kind:"block",type:"control_if_else"},{kind:"block",type:"control_repeat_count"}]});
  return {kind:"categoryToolbox",contents};
 }
 function managedOptions(kind){
  if(kind==="variable")return variables.length?variables.map(v=>[typeof v==="string"?v:v.name,String(typeof v==="string"?v:v.id)]):[["변수를 먼저 만들어 주세요",""]];
  if(kind==="signal")return signals.length?signals.map(v=>[v.name,String(v.id)]):[["신호를 먼저 만들어 주세요",""]];
  if(kind==="slash_command")return slashCommands.length?slashCommands.map(v=>["/"+v.name,String(v.id)]):[["명령어를 먼저 만들어 주세요",""]];
  if(kind==="command_option"){const cmd=slashCommands.find(v=>String(v.id)===String(workspace?.getAllBlocks(false).find(b=>b.type==="event_slash_command")?.getFieldValue("COMMAND_ID")));return cmd?.options?.length?cmd.options.map(v=>[v.name,String(v.id)]):[["옵션 없음",""]];}
  return [["선택할 항목 없음",""]];
 }
 function resourceOptions(kind,key){
  const list=kind==="channel"?resources.channels:resources.roles;
  const options=list.slice(0,250).map(item=>[kind==="channel"?"#"+item.name+" · "+String(item.id).slice(-4):"@"+item.name,String(item.id)]);
  const empty=kind==="channel"?(key==="channel_filter"?"전체 채널":"채널 선택"):"역할 선택";
  return [[empty,""],...options];
 }
 async function loadServerResources(){
  const state=$("#blocks-resource-state");if(state)state.textContent="채널과 역할을 불러오는 중…";
  try{
   const {data,error}=await sb.rpc("blocks_list_server_resources",{target_server_id:project.server_id});
   if(error)throw error;
   resources={channels:Array.isArray(data?.channels)?data.channels:[],roles:Array.isArray(data?.roles)?data.roles:[]};
   if(state)state.textContent=`채널 ${resources.channels.length}개 · 역할 ${resources.roles.length}개 연결됨`;
   return true;
  }catch(error){
   console.error("BLOCKS server resources failed",error);resources={channels:[],roles:[]};
   if(state)state.textContent="목록을 불러오지 못했어요. 다시 시도해 주세요.";
   return false;
  }
 }
 function refreshVariableDropdowns(){
  if(!workspace)return;
  workspace.getAllBlocks(false).forEach(b=>["VARIABLE","SIGNAL_ID","COMMAND_ID","OPTION_ID"].forEach(key=>{const field=b.getField(key);if(field)try{field.menuGenerator_=()=>managedOptions(key==="VARIABLE"?"variable":key==="SIGNAL_ID"?"signal":key==="COMMAND_ID"?"slash_command":"command_option");}catch{}}));
 }
 function initBlockly(){
  Object.assign(Blockly.Msg,{
   DUPLICATE_BLOCK:"블록 복제",ADD_COMMENT:"주석 추가",REMOVE_COMMENT:"주석 삭제",DUPLICATE_COMMENT:"주석 복제",
   INLINE_INPUTS:"입력값 가로로 정렬",EXTERNAL_INPUTS:"입력값 세로로 정렬",
   COLLAPSE_BLOCK:"블록 접기",EXPAND_BLOCK:"블록 펼치기",DISABLE_BLOCK:"블록 비활성화",ENABLE_BLOCK:"블록 활성화",
   DELETE_BLOCK:"블록 삭제",DELETE_X_BLOCKS:"블록 %1개 삭제",HELP:"도움말",
   UNDO:"실행 취소",REDO:"다시 실행",CLEAN_UP:"블록 정렬",DELETE_ALL_BLOCKS:"모든 블록 삭제",
   PASTE_BLOCK:"블록 붙여넣기",CUT:"잘라내기",COPY:"복사",PASTE:"붙여넣기",
   COPY_TO_CLIPBOARD:"클립보드에 복사",DUPLICATE:"복제",COMMENT:"주석"
  });
  definitions.forEach(blockDef);registerSpecialBlocks();
  workspace=Blockly.inject("blocklyDiv",{toolbox:buildToolbox(),renderer:"zelos",theme:Blockly.Theme.defineTheme("tendBlocks",{base:Blockly.Themes.Classic,componentStyles:{workspaceBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#101a27":"#f6f8fc",toolboxBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#172333":"#ffffff",toolboxForegroundColour:document.documentElement.classList.contains("theme-dark")?"#edf3fb":"#172033",flyoutBackgroundColour:document.documentElement.classList.contains("theme-dark")?"#1b293a":"#ffffff",flyoutForegroundColour:document.documentElement.classList.contains("theme-dark")?"#edf3fb":"#172033",flyoutOpacity:1,scrollbarColour:"#8b9bb3",insertionMarkerColour:"#3978f6",insertionMarkerOpacity:.35,markerColour:"#3978f6",cursorColour:"#3978f6"}}),grid:{spacing:20,length:2,colour:document.documentElement.classList.contains("theme-dark")?"#344153":"#dce3ed",snap:true},zoom:{controls:true,wheel:true,startScale:.84,maxScale:1.55,minScale:.5,scaleSpeed:1.1},move:{scrollbars:true,drag:true,wheel:true},trashcan:true,renderer:"zelos",sounds:false,oneBasedIndex:false});
  const keepFlyoutAtDefaultScale=()=>{const flyout=workspace.getFlyout?.();if(!flyout)return;if(typeof flyout.setScale==="function")flyout.setScale(1);else{const flyoutWorkspace=flyout.getWorkspace?.();if(flyoutWorkspace&&flyoutWorkspace.scale!==1)flyoutWorkspace.setScale(1);}};
  workspace.addChangeListener(e=>{if(e.type==="viewport_change")requestAnimationFrame(keepFlyoutAtDefaultScale);if(e.isUiEvent||e.type==="ui")return;markDirty();$("#blocks-count").textContent=workspace.getAllBlocks(false).length+" / 50";});
  requestAnimationFrame(keepFlyoutAtDefaultScale);
  $("#blocks-undo").addEventListener("click",()=>workspace.undo(false));
  $("#blocks-redo").addEventListener("click",()=>workspace.undo(true));
  $("#blocks-cleanup").addEventListener("click",()=>workspace.cleanUp());
 }
 function markDirty(){dirty=true;$("#blocks-save-state").textContent="변경 사항 있음";saveButton.disabled=false;}
 function nodeFromBlock(block){
  if(!block)return null;
  const node={id:block.id,type:block.type,fields:{},values:{}};
  block.inputList.forEach(input=>{
   if(input.type===1){const child=block.getInputTargetBlock(input.name);if(child)node.values[input.name]=nodeFromBlock(child);}
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
  return {schema_version:2,variables,signals,slash_commands:slashCommands,roots};
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
  const data=projectJSON();if(new TextEncoder().encode(JSON.stringify(data)).length>190000){window.BLOCKS.notify("프로젝트 데이터가 너무 커요. 블록이나 긴 텍스트를 줄여 주세요.");return false;}
  saveButton.disabled=true;$("#blocks-save-state").textContent="저장 중…";
  try{
   const {data:updated,error}=await sb.from("blocks_projects").update({name:nameInput.value.trim().slice(0,60)||"새 프로젝트",project_data:data,version:(project.version||1)+1,updated_at:new Date().toISOString()}).eq("id",project.id).eq("owner_id",user.id).select("id,owner_id,server_id,name,project_data,is_enabled,version,updated_at").single();
   if(error)throw error;project=updated;dirty=false;$("#blocks-save-state").textContent="저장 완료";saveButton.disabled=false;return true;
  }catch(error){console.error("BLOCKS project save failed",error);const reason=error?.message||error?.details||error?.hint||"저장하지 못했어요.";window.BLOCKS.notify("저장 실패: "+reason);$("#blocks-save-state").textContent="저장 실패 · 다시 시도해 주세요";saveButton.disabled=false;return false;}
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
   nameInput.value=project.name;variables=Array.isArray(project.project_data?.variables)?project.project_data.variables.map(v=>typeof v==="string"?{id:"legacy_"+Math.random().toString(36).slice(2),name:v,initial_value:0}:v):[];signals=Array.isArray(project.project_data?.signals)?project.project_data.signals:[];slashCommands=Array.isArray(project.project_data?.slash_commands)?project.project_data.slash_commands:[];
   const {data:servers,error:serverError}=await sb.rpc("blocks_list_servers");if(serverError)throw serverError;server=(servers||[]).find(x=>x.server_id===project.server_id)||null;
   $("#blocks-editor-server").textContent=(server?.server_name||"선택한 서버")+" · "+(server?.bot_connected?"TEND 봇 연결됨":"TEND 봇 초대 필요");
   await loadServerResources();
   initBlockly();restoreProject(project.project_data||{});refreshVariableDropdowns();enableButton.textContent=project.is_enabled?"실행 중지":"실행 활성화";
   saveButton.disabled=false;saveButton.addEventListener("click",save);enableButton.addEventListener("click",toggleEnabled);
   $("#blocks-refresh-resources").addEventListener("click",loadServerResources);
    setupManagers();
   nameInput.addEventListener("input",markDirty);
   await loadLogs();
   window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  }catch(error){console.error("BLOCKS editor init failed",error);$("#blocklyDiv").innerHTML='<div class="bl-empty">'+window.BLOCKS.escape(error.message||"편집기를 불러오지 못했어요.")+'</div>';}
 }
 function setupManagers(){
  const overlay=document.createElement("div");overlay.className="bl-manager-overlay bl-hidden";overlay.innerHTML=`<section class="bl-manager" role="dialog" aria-modal="true"><header><strong>프로젝트 요소 관리</strong><button type="button" data-close>닫기</button></header><nav class="bl-manager-tabs"><button data-tab="variables" class="active">변수</button><button data-tab="signals">신호</button><button data-tab="commands">슬래시 명령어</button></nav><div class="bl-manager-body"><section data-pane="variables"><p>프로젝트에서 사용할 값을 만들고 관리해요.</p><div class="bl-manager-create"><input id="manager-var-name" maxlength="40" placeholder="변수 이름"><button data-add="variable">변수 만들기</button></div><div id="manager-vars" class="bl-manager-list"></div></section><section data-pane="signals" class="bl-hidden"><p>같은 프로젝트 안에서 실행 흐름을 연결하는 신호예요.</p><div class="bl-manager-create"><input id="manager-signal-name" maxlength="40" placeholder="신호 이름"><button data-add="signal">신호 만들기</button></div><div id="manager-signals" class="bl-manager-list"></div></section><section data-pane="commands" class="bl-hidden"><p>이 명령어는 현재 프로젝트의 Discord 서버에만 등록되도록 저장돼요.</p><div class="bl-manager-create"><input id="manager-command-name" maxlength="32" placeholder="명령어 이름"><input id="manager-command-desc" maxlength="100" placeholder="명령어 설명"><button data-add="command">명령어 만들기</button></div><div id="manager-commands" class="bl-manager-list"></div><div id="manager-options" class="bl-hidden"><h4 id="manager-option-title">명령어 옵션</h4><div class="bl-manager-create"><input id="manager-opt-name" maxlength="32" placeholder="옵션 이름"><input id="manager-opt-desc" maxlength="100" placeholder="옵션 설명"><select id="manager-opt-type"><option value="string">문자열</option><option value="integer">정수</option><option value="number">실수</option><option value="boolean">참/거짓</option><option value="user">사용자</option><option value="channel">채널</option><option value="role">역할</option></select><label><input id="manager-opt-required" type="checkbox"> 필수</label><button id="manager-add-option">옵션 추가</button></div><div id="manager-opt-list" class="bl-manager-list"></div></div></section></div></section>`;document.body.append(overlay);
  let activeCommand=null;
  const render=()=>{const fill=(id,arr,kind)=>{const host=$("#"+id);host.replaceChildren();if(!arr.length){host.textContent="아직 만든 항목이 없어요.";return;}arr.forEach(item=>{const row=document.createElement("div");row.className="bl-manager-row";const label=document.createElement("span");label.textContent=kind==="command"?"/"+item.name:item.name;const actions=document.createElement("div");if(kind==="command"){const opts=document.createElement("button");opts.textContent="옵션";opts.onclick=()=>{activeCommand=item.id;$("#manager-options").classList.remove("bl-hidden");$("#manager-option-title").textContent="/"+item.name+" 옵션";renderOptions();};actions.append(opts);}const del=document.createElement("button");del.textContent="삭제";del.onclick=()=>{if(!confirm("삭제할까요?"))return;arr.splice(arr.indexOf(item),1);render();refreshVariableDropdowns();markDirty();};actions.append(del);row.append(label,actions);host.append(row);});};fill("manager-vars",variables,"variable");fill("manager-signals",signals,"signal");fill("manager-commands",slashCommands,"command");};
  const renderOptions=()=>{const cmd=slashCommands.find(x=>x.id===activeCommand),host=$("#manager-opt-list");host.replaceChildren();(cmd?.options||[]).forEach(opt=>{const row=document.createElement("div");row.className="bl-manager-row";const label=document.createElement("span");label.textContent=opt.name+" · "+opt.type+(opt.required?" · 필수":"");const del=document.createElement("button");del.textContent="삭제";del.onclick=()=>{cmd.options=cmd.options.filter(x=>x.id!==opt.id);renderOptions();markDirty();};row.append(label,del);host.append(row);});};
  overlay.querySelector("[data-close]").onclick=()=>overlay.classList.add("bl-hidden");overlay.onclick=e=>{if(e.target===overlay)overlay.classList.add("bl-hidden");};overlay.querySelectorAll("[data-tab]").forEach(btn=>btn.onclick=()=>{overlay.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));overlay.querySelectorAll("[data-pane]").forEach(x=>x.classList.toggle("bl-hidden",x.dataset.pane!==btn.dataset.tab));});
  overlay.querySelectorAll("[data-add]").forEach(btn=>btn.onclick=()=>{const kind=btn.dataset.add;if(kind==="variable"||kind==="signal"){const input=$("#manager-"+(kind==="variable"?"var":"signal")+"-name"),name=input.value.trim();if(!name)return;if((kind==="variable"?variables:signals).some(x=>x.name===name))return window.BLOCKS.notify("같은 이름이 이미 있어요.");(kind==="variable"?variables:signals).push({id:crypto.randomUUID?.()||("id_"+Date.now()),name,...(kind==="variable"?{initial_value:0}:{})});input.value="";}else{const name=$("#manager-command-name").value.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g,"").slice(0,32),description=$("#manager-command-desc").value.trim();if(!name||!description)return window.BLOCKS.notify("명령어 이름과 설명을 입력해 주세요.");if(slashCommands.some(x=>x.name===name))return window.BLOCKS.notify("이미 있는 명령어예요.");slashCommands.push({id:crypto.randomUUID?.()||("cmd_"+Date.now()),name,description,options:[]});$("#manager-command-name").value="";$("#manager-command-desc").value="";}render();refreshVariableDropdowns();markDirty();});
  $("#manager-add-option").onclick=()=>{const cmd=slashCommands.find(x=>x.id===activeCommand);if(!cmd)return;const name=$("#manager-opt-name").value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,32),description=$("#manager-opt-desc").value.trim();if(!name||!description)return window.BLOCKS.notify("옵션 이름과 설명을 입력해 주세요.");if(cmd.options.length>=25||cmd.options.some(x=>x.name===name))return window.BLOCKS.notify("옵션은 최대 25개이며 이름은 중복될 수 없어요.");cmd.options.push({id:crypto.randomUUID?.()||("opt_"+Date.now()),name,description,type:$("#manager-opt-type").value,required:$("#manager-opt-required").checked});$("#manager-opt-name").value="";$("#manager-opt-desc").value="";renderOptions();refreshVariableDropdowns();markDirty();};
  $("#blocks-manage-elements").onclick=()=>{render();overlay.classList.remove("bl-hidden");};
 }
 init();
})();