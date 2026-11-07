(()=>{const KEY="tend-cookie-consent-v1";try{if(localStorage.getItem(KEY))return}catch(e){}const style=document.createElement("style");style.textContent=`
#tend-cookie-consent{position:fixed;right:24px;bottom:24px;z-index:99999;width:min(390px,calc(100vw - 32px));padding:22px;background:var(--card,#fff);color:var(--text,#172033);border:1px solid var(--border,#e5e9f0);border-radius:18px;box-shadow:0 18px 55px rgba(10,20,40,.2);font-family:inherit;animation:tendCookieIn .22s ease-out}
#tend-cookie-consent *{box-sizing:border-box}
#tend-cookie-consent .tcc-top{display:flex;align-items:center;gap:9px;margin-bottom:10px}
#tend-cookie-consent .tcc-mark{width:30px;height:30px;border-radius:9px;background:#eaf1ff;color:#2864dc;display:grid;place-items:center;font-weight:800;font-size:15px}
#tend-cookie-consent h2{font-size:17px;line-height:1.35;margin:0;font-weight:750;letter-spacing:-.4px}
#tend-cookie-consent p{font-size:13px;line-height:1.65;color:var(--muted,#697386);margin:0 0 15px}
#tend-cookie-consent .tcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#tend-cookie-consent button{min-height:42px;border:0;border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
#tend-cookie-consent .tcc-essential{background:var(--surface,#f1f3f7);color:var(--text,#273246)}
#tend-cookie-consent .tcc-all{background:#2864dc;color:white}
#tend-cookie-consent .tcc-foot{margin-top:12px;font-size:11px;color:var(--muted,#8791a2)}
#tend-cookie-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.theme-dark #tend-cookie-consent{--card:#171d2a;--text:#f2f5fa;--border:#30394a;--surface:#293244;--muted:#a4afc1;box-shadow:0 18px 55px rgba(0,0,0,.48)}
@keyframes tendCookieIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:520px){#tend-cookie-consent{right:12px;bottom:12px;width:calc(100vw - 24px);padding:18px}}
`;document.head.append(style);const box=document.createElement("section");box.id="tend-cookie-consent";box.setAttribute("role","dialog");box.setAttribute("aria-modal","false");box.setAttribute("aria-labelledby","tcc-title");box.innerHTML='<div class="tcc-top"><div class="tcc-mark">T</div><h2 id="tcc-title">쿠키 사용에 동의해 주세요</h2></div><p>TEND는 사이트 운영에 꼭 필요한 쿠키를 사용해요. 선택에 따라 서비스 개선을 위한 추가 쿠키 사용에도 동의할 수 있어요.</p><div class="tcc-actions"><button type="button" class="tcc-essential">필수 쿠키만 허용</button><button type="button" class="tcc-all">전체 쿠키 허용</button></div><div class="tcc-foot"><a href="./privacy.html">개인정보처리방침</a>에서 자세한 내용을 확인할 수 있어요.</div>';const save=value=>{try{localStorage.setItem(KEY,JSON.stringify({choice:value,updatedAt:new Date().toISOString()}))}catch(e){}box.remove()};box.querySelector(".tcc-essential").addEventListener("click",()=>save("essential"));box.querySelector(".tcc-all").addEventListener("click",()=>save("all"));document.body.append(box)})();