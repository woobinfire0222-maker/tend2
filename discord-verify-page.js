(() => {
  const cfg = window.TEND_CONFIG || {};
  const sb = window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const code = params.get("verify") || location.pathname.match(/^\/discord_verify\/([A-Za-z0-9_-]+)\/?$/)?.[1] || "";
  const statusBox = $("#verify-status");
  const submit = $("#verify-submit");
  const login = $("#verify-login");
  let polling = false;
  let pollStartedAt = 0;

  function show(message, kind = "") {
    statusBox.textContent = message;
    statusBox.className = "verify-status" + (kind ? " " + kind : "");
  }

  function showError(error) {
    console.error("TEND Discord verification:", error);
    show(error.message || "인증 정보를 확인하지 못했어요.", "error");
    if (error.message && error.message.includes("다른 Discord 계정")) {
      login.classList.remove("verify-hidden");
      login.textContent = "다른 Discord 계정으로 로그인";
      login.onclick = async () => {
        login.disabled = true;
        await sb.auth.signOut({ scope: "local" });
        const { error: oauthError } = await sb.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: location.href, scopes: "identify" }
        });
        if (oauthError) {
          login.disabled = false;
          show(oauthError.message, "error");
        }
      };
    }
  }

  async function call(action) {
    const { data, error } = await sb.functions.invoke("discord-verification", { body: { action, code } });
    if (error) {
      let message = data?.error;
      try {
        if (!message && error.context?.json) message = (await error.context.json())?.error;
      } catch {}
      throw new Error(message || error.message || "인증 요청을 처리하지 못했어요.");
    }
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

  function setPage(title, description) {
    $("#verify-title").textContent = title;
    $("#verify-description").textContent = description;
  }

  function showApproved() {
    polling = false;
    submit.classList.add("verify-hidden");
    setPage("인증이 완료됐어요.", "계정 검사를 통과했고 서버 인증 역할 지급까지 완료됐어요.");
    show("인증 완료", "success");
  }

  function showRejected(reason) {
    polling = false;
    submit.classList.add("verify-hidden");
    setPage("인증을 완료할 수 없어요.", "계정 검사 결과 서버의 인증 기준을 통과하지 못했어요.");
    show(reason || "계정 검사 기준을 통과하지 못했어요. 서버 관리자에게 문의해 주세요.", "error");
  }

  function showPending(message = "봇이 Discord 계정을 확인하고 있어요. 이 페이지를 닫지 않아도 자동으로 결과가 갱신돼요.") {
    submit.classList.add("verify-hidden");
    setPage("계정을 검사하고 있어요.", "인증 요청이 접수됐어요. 봇이 계정 정보를 확인하고 있어요.");
    show(message);
  }

  async function refreshStatus() {
    const data = await call("inspect");
    if (data.status === "approved" || data.already_approved) {
      showApproved();
      return true;
    }
    if (data.status === "rejected") {
      showRejected(data.rejection_reason);
      return true;
    }
    if (data.status === "expired") {
      polling = false;
      setPage("인증 링크가 만료됐어요.", "Discord 서버에서 인증 버튼을 다시 눌러 새 링크를 받아 주세요.");
      show("인증 링크가 만료됐어요.", "error");
      return true;
    }
    if (data.status === "failed") {
      polling = false;
      setPage("인증 처리 중 문제가 발생했어요.", "잠시 후 새 인증 링크로 다시 시도하거나 서버 관리자에게 문의해 주세요.");
      show(data.apply_error || "인증을 처리하지 못했어요.", "error");
      return true;
    }
    if (["submitted", "processing", "pending"].includes(data.status)) {
      showPending(data.status === "processing" ? "봇이 계정 위험 요소를 검사하고 있어요." : undefined);
      return false;
    }
    return false;
  }

  async function pollStatus() {
    if (polling) return;
    polling = true;
    pollStartedAt = Date.now();
    showPending();
    while (polling && Date.now() - pollStartedAt < 180000) {
      try {
        const finished = await refreshStatus();
        if (finished) return;
      } catch (error) {
        console.warn("Verification status refresh failed:", error);
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    if (polling) {
      polling = false;
      showPending("검사가 아직 진행 중이에요. 잠시 뒤 새로고침해 결과를 확인해 주세요.");
      const refresh = $("#verify-refresh");
      if (refresh) refresh.classList.remove("verify-hidden");
    }
  }

  async function init() {
    if (!code || !/^[A-Za-z0-9_-]{32,100}$/.test(code)) {
      setPage("인증 링크를 확인할 수 없어요.", "Discord에서 인증 시작 버튼을 다시 눌러 새 링크를 받아 주세요.");
      show("인증 코드가 없거나 형식이 올바르지 않아요.", "error");
      return;
    }
    if (!sb) {
      show("로그인 서비스를 불러오지 못했어요. 새로고침해 주세요.", "error");
      return;
    }

    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      setPage("Discord 계정으로 로그인해 주세요.", "인증 링크를 만든 Discord 계정인지 확인하기 위해 Discord 로그인이 필요해요.");
      login.classList.remove("verify-hidden");
      login.addEventListener("click", async () => {
        login.disabled = true;
        const { error } = await sb.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: location.href, scopes: "identify" }
        });
        if (error) {
          login.disabled = false;
          show(error.message, "error");
        }
      });
      show("Discord 계정 소유 확인을 위해 로그인이 필요해요.");
      return;
    }

    const data = await call("inspect");
    showProfile(data);

    if (data.status === "approved" || data.already_approved) return showApproved();
    if (data.status === "rejected") return showRejected(data.rejection_reason);
    if (data.status === "expired") {
      setPage("인증 링크가 만료됐어요.", "Discord 서버에서 인증 버튼을 다시 눌러 새 링크를 받아 주세요.");
      show("인증 링크가 만료됐어요.", "error");
      return;
    }
    if (data.status === "failed") {
      setPage("인증 처리 중 문제가 발생했어요.", "새 인증 링크로 다시 시도해 주세요.");
      show(data.apply_error || "인증을 처리하지 못했어요.", "error");
      return;
    }
    if (["submitted", "processing", "pending"].includes(data.status)) {
      await pollStatus();
      return;
    }
    if (!data.feature_enabled) {
      setPage("현재 이 서버에서는 인증을 사용할 수 없어요.", "서버 관리자가 TEND 봇 관리에서 인증 기능과 인증 역할을 설정해야 해요.");
      show("인증 기능이 꺼져 있거나 인증 역할이 설정되지 않았어요.", "error");
      return;
    }

    setPage("이 Discord 계정으로 인증을 시작할까요?", "인증 시작을 누르면 봇이 계정 생성일 등 확인 가능한 정보를 자동 검사해요. 검사 통과 시 서버 인증 역할이 지급돼요.");
    submit.classList.remove("verify-hidden");
    submit.textContent = "인증 시작";
    show("Discord 계정이 확인됐어요. 인증을 시작할 수 있어요.", "success");
    submit.addEventListener("click", async () => {
      submit.disabled = true;
      submit.textContent = "인증 요청 중…";
      try {
        const result = await call("submit");
        if (result.status === "approved" || result.already_approved) return showApproved();
        if (result.status === "rejected") return showRejected(result.rejection_reason);
        submit.classList.add("verify-hidden");
        await pollStatus();
      } catch (error) {
        showError(error);
        submit.disabled = false;
        submit.textContent = "인증 시작";
      }
    });
  }

  init().catch(showError);
})();