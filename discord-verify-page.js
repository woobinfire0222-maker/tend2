(() => {
  const cfg = window.TEND_CONFIG || {};
  const sb = window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const code = params.get("verify") || location.pathname.match(/^\/discord_verify\/([A-Za-z0-9_-]+)\/?$/)?.[1] || "";
  const status = $("#verify-status");
  const submit = $("#verify-submit");
  const login = $("#verify-login");
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function show(message, kind = "") {
    status.textContent = message;
    status.className = "verify-status" + (kind ? " " + kind : "");
  }
  function showError(error) {
    console.error("Discord verification:", error);
    show(error.message || "인증 정보를 확인하지 못했어요.", "error");
    if (error.message && error.message.includes("다른 Discord 계정")) {
      login.classList.remove("verify-hidden");
      login.textContent = "다른 Discord 계정으로 로그인";
      login.onclick = async () => {
        login.disabled = true;
        await sb.auth.signOut({ scope: "local" });
        const { error: oauthError } = await sb.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: location.href, scopes: "identify" } });
        if (oauthError) { login.disabled = false; show(oauthError.message, "error"); }
      };
    }
  }
  async function call(action) {
    const { data, error } = await sb.functions.invoke("discord-verification", { body: { action, code } });
    if (error) throw new Error(data?.error || error.message || "인증 요청을 처리하지 못했어요.");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  function showProfile(data) {
    $("#verify-profile").classList.remove("verify-hidden");
    $("#verify-name").textContent = data.global_name || data.username || "Discord 사용자";
    $("#verify-id").textContent = "Discord ID · " + data.discord_user_id;
    $("#verify-avatar").src = data.avatar || "./TEND.png";
    $("#verify-server").textContent = "인증 대상 서버 · " + (data.server_name || data.server_id);
  }
  async function init() {
    if (!code || !/^[A-Za-z0-9_-]{32,100}$/.test(code)) {
      $("#verify-title").textContent = "인증 링크를 확인할 수 없어요.";
      $("#verify-description").textContent = "Discord에서 인증 시작 버튼을 다시 눌러 새 링크를 받아 주세요.";
      show("인증 코드가 없거나 형식이 올바르지 않아요.", "error");
      return;
    }
    if (!sb) return show("로그인 서비스를 불러오지 못했어요. 새로고침해 주세요.", "error");
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      $("#verify-title").textContent = "Discord 계정으로 로그인해 주세요.";
      $("#verify-description").textContent = "인증 링크를 만든 Discord 계정인지 확인하기 위해 Discord 로그인이 필요해요.";
      login.classList.remove("verify-hidden");
      login.addEventListener("click", async () => {
        login.disabled = true;
        const { error } = await sb.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: location.href, scopes: "identify" }
        });
        if (error) { login.disabled = false; show(error.message, "error"); }
      });
      show("Discord 계정 소유 확인을 위해 로그인이 필요해요.");
      return;
    }
    const data = await call("inspect");
    if (data.already_approved) {
      $("#verify-title").textContent = "이미 인증이 완료됐어요.";
      $("#verify-description").textContent = "서버 관리자가 이 Discord 계정의 인증을 승인했어요.";
      show("인증 완료", "success");
      return;
    }
    showProfile(data);
    $("#verify-title").textContent = "이 Discord 계정으로 인증할까요?";
    $("#verify-description").textContent = "아래 계정 정보가 본인의 Discord 계정인지 확인해 주세요. 서버 관리자가 승인하면 인증이 완료돼요.";
    if (data.submitted || data.status === "submitted") {
      show("인증 요청이 접수됐어요. 서버 관리자의 승인을 기다려 주세요.");
      return;
    }
    submit.classList.remove("verify-hidden");
    submit.addEventListener("click", async () => {
      submit.disabled = true;
      submit.textContent = "요청 등록 중…";
      try {
        await call("submit");
        submit.classList.add("verify-hidden");
        show("인증 요청이 접수됐어요. 서버 관리자의 승인을 기다려 주세요.", "success");
      } catch (error) {
        showError(error);
        submit.disabled = false;
        submit.textContent = "이 계정으로 인증 요청";
      }
    });
    show("Discord 계정이 확인됐어요. 인증 요청을 제출할 수 있어요.", "success");
  }
  init().catch(showError);
})();