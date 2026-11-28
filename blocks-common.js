
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
  window.BLOCKS=api;
})();
