(() => {
  const cfg = window.TEND_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
  const sb = window.TEND_SB || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = (selector) => document.querySelector(selector);
  const serverSelect = $("#managed-server-select");
  const form = $("#discord-verification-settings");
  const state = $("#discord-verification-state");
  let currentServer = "";
  let busy = false;

  const notify = (message) => {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
  };

  async function call(action, extra = {}) {
    const { data, error } = await sb.functions.invoke("discord-verification", {
      body: { action, server_id: currentServer, ...extra }
    });
    if (error) {
      let message = data?.error;
      try {
        if (!message && error.context?.json) message = (await error.context.json())?.error;
      } catch {}
      throw new Error(message || error.message || "요청을 처리하지 못했어요.");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function setBusy(value) {
    busy = value;
    const button = $("#discord-verification-save");
    if (button) button.disabled = value;
    const refresh = $("#discord-verification-refresh");
    if (refresh) refresh.disabled = value;
  }

  function renderState(settings) {
    if (!state) return;
    if (settings.enabled && settings.role_id) {
      state.textContent = "인증 기능이 켜져 있어요. 사용자가 사이트에서 인증을 시작하면 봇이 계정을 자동 검사하고, 통과한 경우 인증 역할을 지급해요.";
      state.className = "notice success";
    } else {
      state.textContent = "인증 기능이 꺼져 있어요. 사용하려면 기능을 켜고 인증 완료 시 지급할 역할을 설정해 주세요.";
      state.className = "notice warning";
    }
  }

  async function loadSettings() {
    if (!currentServer || busy) return;
    setBusy(true);
    try {
      const result = await call("settings_get");
      const settings = result.settings || {};
      $("#discord-verification-enabled").checked = settings.enabled === true;
      $("#discord-verification-role").value = settings.role_id || "";
      $("#discord-verification-nickname").value = settings.nickname_template || "{global_name}";
      renderState(settings);
    } catch (error) {
      console.error("Discord verification settings load failed:", error);
      if (state) {
        state.textContent = error.message;
        state.className = "notice warning";
      }
    } finally {
      setBusy(false);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentServer || busy) return notify("먼저 관리할 서버를 선택해 주세요.");
    const enabled = $("#discord-verification-enabled").checked;
    const roleId = $("#discord-verification-role").value.trim();
    const nicknameTemplate = $("#discord-verification-nickname").value.trim() || "{global_name}";
    if (enabled && !/^\d{17,20}$/.test(roleId)) return notify("인증 기능을 켜려면 인증 역할 ID를 입력해 주세요.");
    if (roleId && !/^\d{17,20}$/.test(roleId)) return notify("역할 ID를 숫자로 입력해 주세요.");

    setBusy(true);
    try {
      const result = await call("settings_save", { enabled, role_id: roleId, nickname_template: nicknameTemplate });
      renderState(result.settings || { enabled, role_id: roleId });
      notify("자동 계정 인증 설정을 저장했어요.");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  });

  $("#discord-verification-refresh")?.addEventListener("click", loadSettings);

  async function onServerChange() {
    const next = serverSelect?.value || "";
    if (next === currentServer) return;
    currentServer = next;
    if (!currentServer) {
      if (state) {
        state.textContent = "서버를 선택하면 인증 설정을 불러와요.";
        state.className = "notice";
      }
      return;
    }
    await loadSettings();
  }

  serverSelect?.addEventListener("change", onServerChange);
  sb.auth.getSession().then(({ data }) => {
    if (!data.session) return;
    if (serverSelect?.value) return onServerChange();
    const observer = new MutationObserver(() => {
      if (serverSelect?.value) {
        observer.disconnect();
        onServerChange();
      }
    });
    if (serverSelect) observer.observe(serverSelect, { childList: true, subtree: true, attributes: true });
    setTimeout(() => {
      if (serverSelect?.value) {
        observer.disconnect();
        onServerChange();
      }
    }, 1800);
  }).catch(error => console.warn("Discord verification dashboard init:", error));
})();