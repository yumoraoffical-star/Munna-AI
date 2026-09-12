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