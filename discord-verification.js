(() => {
  const cfg = window.TEND_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
  const sb = window.TEND_SB || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const $ = (s) => document.querySelector(s);
  const serverSelect = $("#managed-server-select");
  const list = $("#discord-verification-requests");
  const form = $("#discord-verification-settings");
  let currentServer = "";
  let busy = false;
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const notify = (message) => {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
  };
  async function call(action, extra = {}) {
    const { data, error } = await sb.functions.invoke("discord-verification", { body: { action, server_id: currentServer, ...extra } });
    if (error) throw new Error(data?.error || error.message || "요청을 처리하지 못했어요.");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  function setBusy(value) {
    busy = value;
    $("#discord-verification-save") && ($("#discord-verification-save").disabled = value);
    $("#discord-verification-refresh") && ($("#discord-verification-refresh").disabled = value);
  }
  async function loadSettings() {
    if (!currentServer || busy) return;
    setBusy(true);
    try {
      const result = await call("settings_get");
      const s = result.settings || {};
      $("#discord-verification-enabled").checked = s.enabled !== false;
      $("#discord-verification-role").value = s.role_id || "";
      $("#discord-verification-nickname").value = s.nickname_template || "{global_name}";
      await loadRequests();
    } catch (error) {
      console.error("Discord verification settings load failed:", error);
      list.innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
    } finally { setBusy(false); }
  }
  async function loadRequests() {
    if (!currentServer) return;
    const result = await call("list");
    const rows = result.requests || [];
    if (!rows.length) {
      list.innerHTML = '<div class="empty">현재 승인 대기 중인 인증 요청이 없어요.</div>';
      return;
    }
    list.innerHTML = rows.map(row => {
      const name = row.discord_global_name || row.discord_username || "Discord 사용자";
      const avatar = row.discord_avatar || "";
      return '<article class="setting-row" style="align-items:center;gap:14px"><div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">' +
        (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover">' : '<div class="avatar">D</div>') +
        '<div style="min-width:0"><strong>' + escapeHtml(name) + '</strong><small>@' + escapeHtml(row.discord_username || "unknown") + '</small><small>Discord ID · ' + escapeHtml(row.discord_user_id) + '</small><small>요청 · ' + escapeHtml(row.submitted_at ? new Date(row.submitted_at).toLocaleString("ko-KR") : "시간 정보 없음") + '</small></div></div>' +
        '<div class="stack-actions"><button type="button" class="btn btn-blue" data-verification-approve="' + escapeHtml(row.id) + '">승인</button><button type="button" class="btn btn-light" data-verification-reject="' + escapeHtml(row.id) + '">거절</button></div></article>';
    }).join("");
    list.querySelectorAll("[data-verification-approve]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("이 Discord 계정을 인증하고 설정한 역할과 닉네임을 적용하도록 요청할까요?")) return;
      button.disabled = true;
      try { await call("review", { request_id: button.dataset.verificationApprove, decision: "approve" }); notify("승인했어요. 봇에 역할·닉네임 적용 작업을 전달했어요."); await loadRequests(); }
      catch (error) { notify(error.message); button.disabled = false; }
    }));
    list.querySelectorAll("[data-verification-reject]").forEach(button => button.addEventListener("click", async () => {
      const reason = prompt("거절 사유를 입력해 주세요. (선택)");
      if (reason === null) return;
      button.disabled = true;
      try { await call("review", { request_id: button.dataset.verificationReject, decision: "reject", reason }); notify("인증 요청을 거절했어요."); await loadRequests(); }
      catch (error) { notify(error.message); button.disabled = false; }
    }));
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentServer || busy) return notify("먼저 관리할 서버를 선택해 주세요.");
    const roleId = $("#discord-verification-role").value.trim();
    if (!/^\d{17,20}$/.test(roleId)) return notify("인증 완료 시 지급할 역할 ID를 입력해 주세요.");
    setBusy(true);
    try {
      await call("settings_save", {
        enabled: $("#discord-verification-enabled").checked,
        role_id: roleId,
        nickname_template: $("#discord-verification-nickname").value.trim() || "{global_name}",
      });
      notify("디스코드 계정 인증 설정을 저장했어요.");
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  });
  $("#discord-verification-refresh")?.addEventListener("click", async () => {
    if (!currentServer || busy) return;
    setBusy(true);
    try { await loadRequests(); notify("인증 요청을 새로고침했어요."); }
    catch (error) { notify(error.message); }
    finally { setBusy(false); }
  });
  async function onServerChange() {
    const next = serverSelect?.value || "";
    if (next === currentServer) return;
    currentServer = next;
    if (!currentServer) {
      list.innerHTML = '<div class="empty">서버를 선택하면 인증 요청이 표시돼요.</div>';
      return;
    }
    await loadSettings();
  }
  serverSelect?.addEventListener("change", onServerChange);
  sb.auth.getSession().then(({ data }) => {
    if (!data.session) return;
    if (serverSelect?.value) onServerChange();
    else {
      const observer = new MutationObserver(() => { if (serverSelect?.value) { observer.disconnect(); onServerChange(); } });
      if (serverSelect) observer.observe(serverSelect, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { if (serverSelect?.value) onServerChange(); }, 1800);
    }
  }).catch(error => console.warn("Discord verification dashboard init:", error));
})();