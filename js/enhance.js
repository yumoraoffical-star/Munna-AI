(() => {
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const settings = $('#settingsModal');
  const mobileMenu = $('#mobileMenu');
  const mobileClose = $('#mobileClose');
  const settingsBtn = $('#settingsBtn');
  const settingsBtnTop = $('#settingsBtnTop');
  const closeSettings = $('#closeSettings');
  const saveProfile = $('#saveProfile');
  const clearGuest = $('#clearGuest');
  const diagnosticsBtn = $('#diagnosticsBtn');
  const diagnostics = $('#diagnostics');
  const diagnosticsRefresh = $('#diagnosticsRefresh');

  const openSettings = () => {
    body.classList.remove('mobile-open');
    settings?.classList.add('open');
  };
  mobileMenu?.addEventListener('click', () => body.classList.toggle('mobile-open'));
  mobileClose?.addEventListener('click', () => body.classList.remove('mobile-open'));
  settingsBtn?.addEventListener('click', openSettings);
  settingsBtnTop?.addEventListener('click', openSettings);
  closeSettings?.addEventListener('click', () => settings?.classList.remove('open'));
  settings?.addEventListener('click', (e) => {
    if (e.target === settings) settings.classList.remove('open');
  });

  saveProfile?.addEventListener('click', async () => {
    const name = $('#profileName')?.value.trim().slice(0, 80);
    if (!window.supabase || !name) return window.toast?.('Name enter karo.');
    const { data } = await window.supabase.auth.getSession();
    if (!data.session) return window.toast?.('Sign in karke profile save karo.');
    const { error } = await window.supabase.auth.updateUser({ data: { full_name: name } });
    if (error) return window.toast?.(error.message);
    $('#userName').textContent = name;
    $('#userAvatar').textContent = name.slice(0, 1).toUpperCase();
    window.toast?.('Profile updated.');
  });

  clearGuest?.addEventListener('click', () => {
    localStorage.removeItem('munna_guest_id');
    localStorage.removeItem('munna_guest_mode');
    window.toast?.('Guest data cleared.');
  });

  const setCheck = (key, state, text) => {
    const item = document.querySelector(`.status-item[data-check="${key}"]`);
    if (!item) return;
    item.classList.remove('ok', 'warn', 'error', 'loading');
    if (state) item.classList.add(state);
    const label = $(`#status${key.charAt(0).toUpperCase() + key.slice(1)}`);
    if (label) label.textContent = text;
  };

  const runDiagnostics = async () => {
    if (!diagnostics) return;
    diagnostics.hidden = false;
    diagnostics.classList.add('checking');
    ['backend', 'chat', 'image', 'tts', 'auth', 'history'].forEach(k => setCheck(k, 'loading', 'Checking…'));
    const updated = $('#diagnosticsUpdated');
    if (updated) updated.textContent = 'Checking now…';

    let health = null;
    try {
      const res = await fetch('/api/health', { cache: 'no-store', headers: { Accept: 'application/json' } });
      health = await res.json().catch(() => null);
      if (!res.ok || !health) throw new Error('Health check failed');
      setCheck('backend', health.ok ? 'ok' : 'warn', health.ok ? 'Ready' : 'Needs attention');
      setCheck('chat', health.checks?.chat === true ? 'ok' : 'error', health.checks?.chat === true ? 'Ready' : 'Unavailable');
      setCheck('image', health.checks?.image === 'pollinations-fallback' ? 'warn' : health.checks?.image ? 'ok' : 'error', health.checks?.image === 'pollinations-fallback' ? 'Fallback ready' : health.checks?.image ? 'Ready' : 'Unavailable');
      setCheck('tts', health.checks?.tts === 'browser-fallback' ? 'warn' : health.checks?.tts ? 'ok' : 'error', health.checks?.tts === 'browser-fallback' ? 'Browser fallback' : health.checks?.tts ? 'Ready' : 'Browser only');
    } catch (e) {
      ['backend', 'chat', 'image', 'tts'].forEach(k => setCheck(k, 'error', 'Check failed'));
    }

    try {
      const sb = window.supabase;
      const result = sb ? await sb.auth.getSession() : { data: { session: null } };
      const active = Boolean(result?.data?.session);
      const guestMode = localStorage.getItem('munna_guest_mode') === '1';
      setCheck('auth', active ? 'ok' : guestMode ? 'warn' : 'warn', active ? 'Signed in' : guestMode ? 'Guest mode' : 'Not signed in');
      if (active) {
        const { error } = await sb.from('chat_sessions').select('id', { count: 'exact', head: true });
        setCheck('history', error ? 'error' : 'ok', error ? 'Unavailable' : 'Cloud sync ready');
      } else {
        setCheck('history', 'warn', 'Sign in to sync');
      }
    } catch (e) {
      setCheck('auth', 'error', 'Check failed');
      setCheck('history', 'error', 'Check failed');
    }

    diagnostics.classList.remove('checking');
    if (updated) updated.textContent = `Checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  diagnosticsBtn?.addEventListener('click', runDiagnostics);
  diagnosticsRefresh?.addEventListener('click', runDiagnostics);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      settings?.classList.remove('open');
      body.classList.remove('mobile-open');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#prompt')?.focus();
    }
  });
})();