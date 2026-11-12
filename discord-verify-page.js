(() => {
  const cfg = window.TEND_CONFIG || {};
  const sb = window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const serverId = params.get("server_id") || params.get("guild_id") || params.get("server") || "";
  let requestId = params.get("request_id") || "";
  let currentUser = null;
  let polling = false;
  let pollStartedAt = 0;
  let retryMode = false;

  const submit = $("#verify-submit");
  const login = $("#verify-login");
  const statusBox = $("#verify-status");

  function show(message, kind = "") {
    statusBox.textContent = message;
    statusBox.className = "verify-status" + (kind ? " " + kind : "");
  }

  function setPage(title, description) {
    $("#verify-title").textContent = title;
    $("#verify-description").textContent = description;
  }

  function setRequestInUrl(id) {
    const next = new URL(location.href);
    next.searchParams.set("request_id", id);
    history.replaceState({}, "", next);
    requestId = id;
  }

  function showProfile(user, identity) {
    const data = identity?.identity_data || {};
    const discordId = String(data.provider_id || data.sub || data.user_id || data.id || "");
    const name = data.global_name || data.full_name || data.name || data.preferred_username || data.username || "Discord 사용자";
    $("#verify-profile").classList.remove("verify-hidden");
    $("#verify-name").textContent = name;
    $("#verify-id").textContent = "Discord ID · " + (discordId || "계정 확인됨");
    $("#verify-avatar").src = data.avatar_url || data.picture || "./TEND.png";
  }

  function showApproved() {
    polling = false;
    retryMode = false;
    submit.classList.add("verify-hidden");
    setPage("인증이 완료됐어요.", "봇의 계정 검사를 통과했고 인증 역할 지급이 완료됐어요.");
    show("인증 완료", "success");
  }

  function showRejected(reason) {
    polling = false;
    retryMode = false;
    submit.classList.add("verify-hidden");
    setPage("인증을 완료할 수 없어요.", "봇의 자동 계정 검사에서 서버의 인증 기준을 통과하지 못했어요.");
    show(reason || "계정 검사 기준을 통과하지 못했어요. 서버 관리자에게 문의해 주세요.", "error");
  }

  function showPending(status) {
    submit.classList.add("verify-hidden");
    setPage(status === "processing" ? "계정을 검사하고 있어요." : "인증 요청을 접수했어요.",
      status === "processing" ? "봇이 Discord 계정 정보를 확인하고 있어요." : "봇이 인증 요청을 가져가면 자동 검사가 시작돼요.");
    show(status === "processing" ? "계정 위험 요소를 검사하고 있어요." : "봇의 검사 시작을 기다리고 있어요.");
  }

  function showRetry(title, message, buttonText = "다시 인증 요청") {
    polling = false;
    retryMode = true;
    setPage(title, message);
    show(message, "error");
    submit.classList.remove("verify-hidden");
    submit.disabled = false;
    submit.textContent = buttonText;
  }

  async function call(action, extra = {}) {
    const { data, error } = await sb.functions.invoke("discord-verification", {
      body: { action, ...extra }
    });
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

  async function refreshStatus() {
    const data = await call("request_status", { request_id: requestId });
    if (data.status === "approved") {
      showApproved();
      return true;
    }
    if (data.status === "rejected") {
      showRejected(data.rejection_reason);
      return true;
    }
    if (data.status === "expired") {
      showRetry("인증 요청이 만료됐어요.", "인증 요청 시간이 지났어요. 새 요청을 만들어 다시 검사할 수 있어요.");
      return true;
    }
    if (data.status === "failed") {
      showRetry("인증 처리 중 문제가 발생했어요.", data.apply_error || "일시적인 오류로 인증을 마치지 못했어요. 새 요청으로 다시 시도해 주세요.");
      return true;
    }
    if (data.status === "pending" || data.status === "processing") {
      showPending(data.status);
      return false;
    }
    showRetry("인증 상태를 확인할 수 없어요.", "새 인증 요청을 만들어 다시 시도해 주세요.");
    return true;
  }

  async function pollStatus() {
    if (polling) return;
    polling = true;
    pollStartedAt = Date.now();
    while (polling && Date.now() - pollStartedAt < 180000) {
      try {
        if (await refreshStatus()) return;
      } catch (error) {
        console.warn("TEND verification status:", error);
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    if (polling) {
      polling = false;
      showPending("processing");
      show("검사가 계속 진행 중이에요. 잠시 뒤 상태를 다시 확인해 주세요.");
      $("#verify-refresh").classList.remove("verify-hidden");
    }
  }

  async function startRequest() {
    if (!currentUser || !serverId) return;
    submit.disabled = true;
    submit.textContent = "인증 요청 중…";
    try {
      const result = await call("request_create", { server_id: serverId });
      if (result.request_id) setRequestInUrl(result.request_id);
      if (result.server_name) $("#verify-server").textContent = "인증 대상 서버 · " + result.server_name;
      if (result.status === "approved") return showApproved();
      retryMode = false;
      submit.classList.add("verify-hidden");
      setPage("인증 요청을 접수했어요.", "봇이 요청을 가져가 Discord 계정을 자동으로 검사해요.");
      show("봇의 검사 시작을 기다리고 있어요.", "success");
      await pollStatus();
    } catch (error) {
      show(error.message, "error");
      submit.disabled = false;
      submit.textContent = retryMode ? "다시 인증 요청" : "인증 시작";
    }
  }

  async function loginWithDiscord() {
    login.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: location.href, scopes: "identify" }
    });
    if (error) {
      login.disabled = false;
      show(error.message || "Discord 로그인을 시작하지 못했어요.", "error");
    }
  }

  async function init() {
    if (!sb) {
      setPage("로그인 서비스를 불러오지 못했어요.", "잠시 후 페이지를 새로고침해 주세요.");
      show("TEND 인증 서비스를 불러오지 못했어요.", "error");
      return;
    }
    if (!/^\d{17,20}$/.test(serverId)) {
      setPage("인증할 서버를 확인할 수 없어요.", "Discord 인증 패널에서 다시 시작해 주세요.");
      show("인증 링크에 server_id가 없거나 올바르지 않아요.", "error");
      return;
    }

    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    currentUser = sessionData.session?.user || null;
    const { data: identityData, error: identityError } = currentUser
      ? await sb.auth.getUserIdentities()
      : { data: null, error: null };
    if (identityError) throw identityError;
    const discordIdentity = (identityData?.identities || []).find(item => item.provider === "discord");

    if (!currentUser || !discordIdentity) {
      setPage("Discord 계정으로 로그인해 주세요.", "본인 계정을 확인한 뒤 인증 요청을 만들 수 있어요.");
      login.classList.remove("verify-hidden");
      login.onclick = loginWithDiscord;
      show(currentUser ? "현재 로그인한 계정에 Discord 연결이 필요해요." : "Discord OAuth로 본인 계정을 확인해 주세요.");
      return;
    }

    showProfile(currentUser, discordIdentity);

    if (requestId) {
      try {
        const data = await call("request_status", { request_id: requestId });
        $("#verify-server").textContent = "인증 대상 서버 · " + data.server_name;
        if (data.status === "approved") return showApproved();
        if (data.status === "rejected") return showRejected(data.rejection_reason);
        if (data.status === "expired") return showRetry("인증 요청이 만료됐어요.", "새 요청을 만들어 다시 검사할 수 있어요.");
        if (data.status === "failed") return showRetry("인증 처리 중 문제가 발생했어요.", data.apply_error || "새 요청으로 다시 시도해 주세요.");
        if (data.status === "pending" || data.status === "processing") return pollStatus();
      } catch (error) {
        console.warn("Previous verification request unavailable:", error);
      }
    }

    let serverInfo;
    try {
      serverInfo = await call("settings_public", { server_id: serverId });
    } catch (error) {
      setPage("현재 이 서버에서는 인증을 사용할 수 없어요.", "서버 관리자가 TEND 봇 관리에서 자동 인증과 인증 역할을 설정해야 해요.");
      show(error.message || "인증 설정을 확인하지 못했어요.", "error");
      return;
    }
    if (!serverInfo?.feature_enabled) {
      setPage("현재 이 서버에서는 인증을 사용할 수 없어요.", "서버 관리자가 TEND 봇 관리에서 자동 인증과 인증 역할을 설정해야 해요.");
      show("인증 기능이 꺼져 있거나 인증 역할이 설정되지 않았어요.", "error");
      return;
    }

    $("#verify-server").textContent = "인증 대상 서버 · " + (serverInfo.server_name || serverId);
    setPage("이 Discord 계정으로 인증을 시작할까요?", "인증 시작을 누르면 봇이 계정 생성일 등 확인 가능한 정보를 자동 검사해요. 검사 통과 시 인증 역할이 지급돼요.");
    show("Discord 계정이 확인됐어요. 인증을 시작할 수 있어요.", "success");
    submit.classList.remove("verify-hidden");
    submit.disabled = false;
    submit.textContent = "인증 시작";
    submit.onclick = startRequest;
    $("#verify-refresh").onclick = () => location.reload();
  }

  init().catch(error => {
    console.error("TEND verification init:", error);
    show(error.message || "인증 페이지를 불러오지 못했어요.", "error");
  });
})();