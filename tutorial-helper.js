(()=>{const $=s=>document.querySelector(s);let step=0,feed=[];const steps=[
{title:"먼저 가상 서버 관리를 시작해 볼까요?",body:"파란색으로 표시된 ‘관리 시작’ 버튼을 눌러주세요. 실제 Discord가 아닌 체험 서버에서만 실행돼요.",target:"#start-management",kind:"click"},
{title:"채팅 검열 메뉴로 이동해요",body:"상단의 ‘채팅 검열’ 탭을 눌러 금지 단어를 등록하는 방법을 알아볼게요.",target:'[data-bot-tab="moderation"]',kind:"click"},
{title:"금지 단어를 등록해 봐요",body:"금지 단어를 입력하고 ‘금지 단어 추가’를 눌러주세요. 등록 결과가 오른쪽 가상 Discord 채팅에도 표시돼요.",target:"#moderation-form button[type=submit]",kind:"submit"},
{title:"이번엔 공지 기능을 확인해요",body:"‘서버 공지’ 탭을 눌러 공지를 작성해 볼게요.",target:'[data-bot-tab="announcements"]',kind:"click"},
{title:"가상 서버에 공지를 보내봐요",body:"제목과 내용을 입력한 다음 ‘공지 바로 보내기’를 눌러주세요. 오른쪽 가상 채널에 공지가 나타나요.",target:"#announcement-form button[type=submit]",kind:"submit"},
{title:"추가 기능도 살펴볼까요?",body:"‘추가 기능 14개’ 탭을 눌러 기능 목록을 열어주세요.",target:'[data-bot-tab="features"]',kind:"click"},
{title:"기능을 직접 켜보세요",body:"원하는 기능의 스위치를 눌러보세요. 가상 Discord 화면에 설정 변경 알림이 표시되면 튜토리얼 완료예요.",target:"#feature-settings-list input[type=checkbox]",kind:"change"}
];function inject(){if($("#tend-helper-style"))return;const st=document.createElement("style");st.id="tend-helper-style";st.textContent=`
#tend-helper{position:fixed;z-index:1200;left:22px;bottom:22px;display:flex;align-items:flex-end;gap:11px;max-width:min(440px,calc(100vw - 28px));font-family:inherit}
#tend-helper .helper-orb{width:58px;height:58px;flex:none;border-radius:50%;background:linear-gradient(135deg,#69c7ff 0%,#3478f6 48%,#3446bd 100%);box-shadow:0 8px 24px #356df34d, inset 0 2px 5px #ffffff70;display:grid;place-items:center;color:white;font-size:18px;font-weight:900;border:3px solid #fff}
#tend-helper .helper-card{background:#fff;border:1px solid #e5eaf3;border-radius:15px;padding:14px 16px;box-shadow:0 12px 40px #17233d24;width:min(350px,calc(100vw - 105px))}
#tend-helper .helper-label{font-size:9px;font-weight:900;letter-spacing:.12em;color:#3975ed}
#tend-helper h3{font-size:14px;line-height:1.45;margin:6px 0;color:#202938}
#tend-helper p{font-size:11px;line-height:1.65;color:#687386;margin:0}
#tend-helper .helper-actions{display:flex;justify-content:space-between;align-items:center;margin-top:11px}
#tend-helper .helper-actions small{font-size:9px;color:#8b94a3}
#tend-helper button{font:inherit;font-size:10px;font-weight:800;border:0;border-radius:7px;padding:8px 11px;background:#eef2f8;color:#596477;cursor:pointer}
#tend-helper button.primary{background:#356df3;color:white}
#tend-discord-preview{position:fixed;z-index:1150;right:20px;bottom:20px;width:350px;height:390px;background:#fff;border:1px solid #dfe4ed;border-radius:15px;box-shadow:0 18px 55px #17233d25;overflow:hidden;font-family:inherit;display:flex;flex-direction:column}
#tend-discord-preview .dp-head{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 13px;background:#fff;border-bottom:1px solid #eceff4}
#tend-discord-preview .dp-head b{font-size:12px;color:#252c38}
#tend-discord-preview .dp-head span{font-size:9px;color:#3975ed;font-weight:850}
#tend-discord-preview .dp-main{display:grid;grid-template-columns:52px 1fr;min-height:0;flex:1}
#tend-discord-preview .dp-servers{background:#252a36;display:flex;align-items:center;flex-direction:column;gap:9px;padding:12px 6px}
#tend-discord-preview .dp-server{width:32px;height:32px;border-radius:11px;background:#414958;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:900}
#tend-discord-preview .dp-server.active{background:#3975ed;border-radius:10px}
#tend-discord-preview .dp-chat{display:flex;flex-direction:column;min-width:0;background:#fff}
#tend-discord-preview .dp-channel{padding:13px;border-bottom:1px solid #eef0f4;font-size:11px;font-weight:850;color:#303847}
#tend-discord-preview .dp-messages{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:12px;flex:1}
#tend-discord-preview .dp-msg{display:flex;gap:8px;align-items:flex-start}
#tend-discord-preview .dp-avatar{width:25px;height:25px;border-radius:50%;background:#e7edff;color:#356df3;display:grid;place-items:center;font-size:9px;font-weight:900;flex:none}
#tend-discord-preview .dp-msg b{font-size:10px;color:#303847}
#tend-discord-preview .dp-msg small{font-size:8px;color:#9aa2af;margin-left:5px}
#tend-discord-preview .dp-msg p{font-size:10px;line-height:1.55;color:#566071;margin:4px 0 0;overflow-wrap:anywhere;white-space:pre-wrap}
#tend-discord-preview .dp-system{font-size:9px;color:#3975ed;background:#f1f5ff;border-radius:8px;padding:8px 9px;line-height:1.5}
#tend-discord-preview .dp-foot{padding:9px 12px;border-top:1px solid #edf0f4;font-size:8px;color:#8b94a3}
.tend-helper-target{outline:3px solid #4383ff!important;outline-offset:4px!important;box-shadow:0 0 0 8px #4383ff24!important;position:relative;z-index:5}
@media(max-width:760px){#tend-discord-preview{right:10px;bottom:10px;width:min(310px,calc(100vw - 20px));height:270px}#tend-helper{left:10px;bottom:290px;max-width:calc(100vw - 20px)}#tend-helper .helper-card{width:min(300px,calc(100vw - 95px))}#tend-helper .helper-orb{width:48px;height:48px}}
@media(max-width:430px){#tend-discord-preview{height:235px}#tend-helper{bottom:245px}}
`;document.head.append(st)}
function build(){inject();if(!$("#tend-discord-preview")){const p=document.createElement("aside");p.id="tend-discord-preview";p.innerHTML='<header class="dp-head"><b>◉ TEND 체험 서버</b><span>가상 Discord · DEMO</span></header><div class="dp-main"><div class="dp-servers"><div class="dp-server active">T</div><div class="dp-server">+</div></div><div class="dp-chat"><div class="dp-channel" id="dp-channel"># 일반 채팅</div><div class="dp-messages" id="dp-messages"><div class="dp-msg"><span class="dp-avatar">민</span><div><b>민준</b><small>오전 10:21</small><p>안녕하세요! 서버에 오신 걸 환영해요.</p></div></div><div class="dp-msg"><span class="dp-avatar">서</span><div><b>서연</b><small>오전 10:22</small><p>공지사항은 #공지사항 채널에서 확인해 주세요.</p></div></div></div></div></div><footer class="dp-foot">이 화면은 실제 Discord와 연결되지 않은 가상 미리보기입니다.</footer>';document.body.append(p)}if(!$("#tend-helper")){const h=document.createElement("div");h.id="tend-helper";h.innerHTML='<div class="helper-orb" aria-label="헬퍼">H</div><section class="helper-card"><div class="helper-label">TEND HELPER · 가이드</div><h3 id="helper-title"></h3><p id="helper-body"></p><div class="helper-actions"><small id="helper-progress"></small><div><button id="helper-restart">처음부터</button><button class="primary" id="helper-skip">건너뛰기</button></div></div></section>';document.body.append(h);$("#helper-restart").onclick=()=>{step=0;feed=[];render()};$("#helper-skip").onclick=finish}}
function addFeed(text,channel){const box=$("#dp-messages");if(channel)$("#dp-channel").textContent="# "+channel;const item=document.createElement("div");item.className="dp-system";item.textContent=text;box.append(item);box.scrollTop=box.scrollHeight}
function render(){build();document.querySelectorAll(".tend-helper-target").forEach(x=>x.classList.remove("tend-helper-target"));if(step>=steps.length){finish();return}const s=steps[step],target=$(s.target);$("#helper-title").textContent=s.title;$("#helper-body").textContent=s.body;$("#helper-progress").textContent=(step+1)+" / "+steps.length+" 단계";if(target){target.classList.add("tend-helper-target");target.scrollIntoView({behavior:"smooth",block:"center"});}}
function finish(){document.querySelectorAll(".tend-helper-target").forEach(x=>x.classList.remove("tend-helper-target"));$("#helper-title").textContent="튜토리얼 완료!";$("#helper-body").textContent="잘했어요. 이제 가상 Discord 화면과 관리 기능을 자유롭게 눌러보세요. 모든 변경은 이 체험 화면 안에서만 유지돼요.";$("#helper-progress").textContent="완료";$("#helper-skip").textContent="닫기";$("#helper-skip").onclick=()=>{$("#tend-helper")?.remove()};addFeed("튜토리얼을 완료했어요. 이제 자유롭게 체험할 수 있어요.");}
function advance(message,channel){if(message)addFeed(message,channel);step++;render()}
document.addEventListener("click",e=>{if(step>=steps.length)return;const s=steps[step],target=e.target.closest(s.target);if(!target||s.kind!=="click")return;setTimeout(()=>{if(step===0)advance("TEND 관리 봇이 가상 서버에서 실행을 시작했어요.");else if(step===1)advance("채팅 검열 설정 화면으로 이동했어요.","일반 채팅");else if(step===3)advance("공지 작성 화면을 열었어요.","공지사항");else if(step===5)advance("추가 기능 목록을 열었어요.");},80)},true);
document.addEventListener("submit",e=>{if(step>=steps.length)return;const s=steps[step];if(!e.target.matches(s.target.replace(" button[type=submit]","")))return;setTimeout(()=>{if(step===2){const v=$("#moderation-word").value.trim()||"테스트 단어";advance("🛡️ 검열 규칙 등록: ‘"+v+"’가 금지 단어로 추가됐어요.","일반 채팅")}else if(step===4){const title=$("#announcement-title").value.trim()||"새 공지",body=$("#announcement-content").value.trim()||"공지 내용";advance("📢 "+title+"\n"+body,"공지사항")}},100)},true);
document.addEventListener("change",e=>{if(step>=steps.length||step!==6||!e.target.matches('#feature-settings-list input[type="checkbox"]'))return;const name=e.target.closest(".feature-setting-card")?.querySelector("b")?.textContent||"기능";advance("⚙️ "+name+" 기능이 "+(e.target.checked?"켜졌어요.":"꺼졌어요."),"일반 채팅")},true);
window.startTendHelper=()=>{step=0;build();render()};window.addEventListener("load",()=>{window.startTendHelper()});})();