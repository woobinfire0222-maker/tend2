
(() => {
  const cfg=window.TEND_CONFIG||{};
  const sb=window.supabase&&cfg.supabaseUrl&&cfg.supabaseAnonKey
    ?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
    :null;
  window.BLOCKS_SB=sb;
  const api={
    sb,
    escape(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));},
    async session(){if(!sb)throw new Error("Supabase 설정을 불러오지 못했어요.");const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session||null;},
    async user(){const session=await api.session();return session?.user||null;},
    async tester(){const {data,error}=await sb.rpc("blocks_is_beta_tester");if(error)throw error;return !!data;},
    async login(redirect){if(!sb)throw new Error("로그인 서비스를 사용할 수 없어요.");let target=location.href;try{const candidate=new URL(redirect||location.href,location.href);if(candidate.origin===location.origin)target=candidate.href;localStorage.setItem("tend-auth-next",target);}catch{}const {data,error}=await sb.auth.signInWithOAuth({provider:"discord",options:{redirectTo:"https://tendsite.shop/login.html",scopes:"identify email guilds"}});if(error)throw error;if(data?.url)location.assign(data.url);},
    async requireTester(returnTo){const user=await api.user();if(!user){await api.login(returnTo||location.href);return null;}const allowed=await api.tester();if(!allowed){location.replace("./blocks-beta.html");return null;}return user;},
    notify(message){let el=document.querySelector(".bl-toast");if(!el){el=document.createElement("div");el.className="bl-toast";document.body.append(el);}el.textContent=message;el.classList.add("show");clearTimeout(api.notifyTimer);api.notifyTimer=setTimeout(()=>el.classList.remove("show"),2800);},
    discordName(user){const m=user?.user_metadata||{};const d=(user?.identities||[]).find(x=>x.provider==="discord")?.identity_data||{};return m.global_name||m.user_name||m.preferred_username||m.username||d.global_name||d.username||d.preferred_username||"Discord 사용자";},
    async syncGuilds(session){const token=session?.provider_token;if(!token)return false;const {data,error}=await sb.functions.invoke("discord-action",{body:{action:"cache_guilds",provider_token:token}});if(error||data?.error){console.warn("Discord guild cache failed",error||data);return false;}return true;}
  };
  api.logout=()=>{
    if(!sb)return;
    if(document.querySelector(".tend-account-confirm"))return;
    const overlay=document.createElement("div");
    overlay.className="tend-account-confirm";
    overlay.innerHTML='<section class="tend-account-confirm-card tend-logout-card" role="dialog" aria-modal="true" aria-labelledby="tend-logout-title"><div class="tend-confirm-kicker">LOG OUT</div><h2 id="tend-logout-title">정말 로그아웃할까요?</h2><p class="tend-confirm-desc">로그아웃하면 TEND 이용을 위해 다시 로그인해야 해요.</p><div class="tend-logout-actions"><button type="button" class="btn tend-logout-yes">로그아웃</button><button type="button" class="btn btn-light tend-logout-no">취소</button></div></section>';
    const close=()=>overlay.remove();
    overlay.querySelector(".tend-logout-no").addEventListener("click",close);
    overlay.addEventListener("click",event=>{if(event.target===overlay)close()});
    overlay.addEventListener("keydown",event=>{if(event.key==="Escape")close()});
    overlay.querySelector(".tend-logout-yes").addEventListener("click",async()=>{
      const buttons=[...overlay.querySelectorAll("button")];buttons.forEach(button=>button.disabled=true);
      const yes=overlay.querySelector(".tend-logout-yes");yes.textContent="로그아웃 중…";
      const {error}=await sb.auth.signOut({scope:"local"});
      if(error){console.error("BLOCKS logout failed",error);buttons.forEach(button=>button.disabled=false);yes.textContent="로그아웃";api.notify("로그아웃에 실패했어요. 다시 시도해 주세요.");return}
      try{localStorage.removeItem("tend-auth-next")}catch{}
      location.href="./index.html";
    });
    document.body.append(overlay);
    overlay.querySelector(".tend-logout-no").focus();
  };
  window.BLOCKS=api;
})();
