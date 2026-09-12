const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(indexPath, 'utf8');

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) throw new Error(`Could not locate ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceBetween(
  '            // --- TOP-LEVEL AUTH CONTROLLER (PRODUCTION SECURE ARCHITECTURE) ---',
  '    // --- 3. GEMINI AI CONFIGURATION (Secured via /api/chat) ---',
  `            // --- MUNNA AUTH v2: SUPABASE-ONLY, SINGLE SOURCE OF TRUTH ---
    const MunnaAuth = {
      currentUser: null,
      currentSession: null,
      isGuest: false,
      initialized: false,
      busy: false,

      _guestId() {
        let id = sessionStorage.getItem('munna_guest_id');
        if (!id) { id = 'guest_' + crypto.randomUUID(); sessionStorage.setItem('munna_guest_id', id); }
        return id;
      },

      async getAuthHeaders() {
        if (this.currentSession?.access_token) return { Authorization: 'Bearer ' + this.currentSession.access_token };
        if (this.isGuest) return { 'X-Guest-Access': 'true', 'X-Guest-Id': this._guestId() };
        return {};
      },

      _name(user) { return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Munna User'; },

      _setUser(user, toast) {
        if (!user) return;
        this.currentUser = user;
        this.currentSession = this.currentSession || null;
        this.isGuest = false;
        sessionStorage.removeItem('munna_guest_mode');
        sessionStorage.removeItem('munna_guest_id');
        localStorage.removeItem('munna_guest_mode');
        localStorage.removeItem('munna_local_user');
        userData.name = this._name(user);
        userData.email = user.email || '';
        safeSet('munna_user_name', userData.name);
        safeSet('munna_user_email', userData.email);
        updateAuthUI(user);
        if (typeof syncUserUI === 'function') syncUserUI();
        this.hideAuthScreen();
        this.closeModal();
        if (toast) showMunnaToast(toast);
        setTimeout(() => { if (typeof loadSessionsFromCloud === 'function') { try { loadSessionsFromCloud(); } catch (_) {} } }, 0);
      },

      enterAsGuest(name) {
        this.currentUser = null;
        this.currentSession = null;
        this.isGuest = true;
        sessionStorage.setItem('munna_guest_mode', 'true');
        this.hideAuthScreen();
        this.closeModal();
        updateAuthUI({ id: this._guestId(), email: '', is_guest: true, user_metadata: { full_name: name || 'Mehman User' } });
        showMunnaToast('👑 Mehman Mode active hai.');
      },

      async signOut() {
        try {
          if (supabaseClient) await supabaseClient.auth.signOut();
        } catch (e) { console.warn('Supabase sign out:', e); }
        this.currentUser = null;
        this.currentSession = null;
        this.isGuest = false;
        sessionStorage.removeItem('munna_guest_mode');
        sessionStorage.removeItem('munna_guest_id');
        localStorage.removeItem('munna_guest_mode');
        localStorage.removeItem('munna_local_user');
        updateAuthUI(null);
        this.showAuthScreen();
      },

      showAuthScreen() {
        const el = document.getElementById('authScreenOverlay');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
      },
      hideAuthScreen() {
        const el = document.getElementById('authScreenOverlay');
        if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
      },
      openModal() {
        const el = document.getElementById('authModal');
        if (el) el.classList.add('show');
      },
      closeModal() {
        const el = document.getElementById('authModal');
        if (el) el.classList.remove('show');
      },

      async signIn(email, password, btn) {
        email = String(email || '').trim().toLowerCase();
        password = String(password || '');
        if (!email || !password) return showMunnaToast('Email aur password dono zaroori hain.');
        if (!supabaseClient) return showMunnaToast('Login service unavailable hai.');
        if (this.busy) return;
        this.busy = true;
        if (btn) { btn.disabled = true; btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML; btn.innerHTML = '<span>Login ho raha hai... ⏳</span>'; }
        try {
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) {
            const m = (error.message || '').toLowerCase();
            if (m.includes('email not confirmed')) showMunnaToast('Email confirm nahi hua. Inbox me confirmation link check karo.');
            else if (m.includes('invalid login credentials')) showMunnaToast('Email ya password galat hai.');
            else showMunnaToast(error.message || 'Login failed.');
            return;
          }
          if (data?.session) this.currentSession = data.session;
          if (data?.user) this._setUser(data.user, '👑 Login successful! Swagat hai, ' + this._name(data.user) + '!');
        } catch (e) { console.error(e); showMunnaToast('Network error. Dobara try karo.'); }
        finally {
          this.busy = false;
          if (btn) { btn.disabled = false; if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml; }
        }
      },

      async signUp(name, email, password, btn) {
        name = String(name || '').trim(); email = String(email || '').trim().toLowerCase(); password = String(password || '');
        if (!email || !password) return showMunnaToast('Email aur password dono zaroori hain.');
        if (password.length < 6) return showMunnaToast('Password kam se kam 6 characters ka hona chahiye.');
        if (!supabaseClient) return showMunnaToast('Login service unavailable hai.');
        if (this.busy) return;
        this.busy = true;
        if (btn) { btn.disabled = true; btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML; btn.innerHTML = '<span>Account ban raha hai... ⏳</span>'; }
        try {
          const { data, error } = await supabaseClient.auth.signUp({
            email, password,
            options: { data: { full_name: name || email.split('@')[0] }, emailRedirectTo: window.location.origin + window.location.pathname }
          });
          if (error) return showMunnaToast(error.message || 'Account create nahi ho paya.');
          if (data?.session && data?.user) {
            this.currentSession = data.session;
            this._setUser(data.user, '👑 Account ready! Swagat hai, ' + (name || email.split('@')[0]) + '!');
          } else if (data?.user) {
            showMunnaToast('Account ban gaya. Inbox se email confirm karo, phir login karo.');
            switchAuthScreenTab('signin');
          }
        } catch (e) { console.error(e); showMunnaToast('Network error. Dobara try karo.'); }
        finally {
          this.busy = false;
          if (btn) { btn.disabled = false; if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml; }
        }
      },

      async signInWithGoogle(btn) {
        if (!supabaseClient) return showMunnaToast('Login service unavailable hai.');
        if (this.busy) return;
        this.busy = true;
        if (btn) { btn.disabled = true; btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML; btn.innerHTML = '<span>Google se connect ho raha hai... ⏳</span>'; }
        try {
          const redirectTo = window.location.origin + window.location.pathname;
          const { data, error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
          if (error) throw error;
          if (!data?.url) throw new Error('OAuth redirect URL missing');
          window.location.assign(data.url);
        } catch (e) {
          console.error(e); showMunnaToast('Google login failed: ' + (e?.message || 'OAuth unavailable'));
          this.busy = false;
          if (btn) { btn.disabled = false; if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml; }
        }
      },

      async init() {
        if (this.initialized) return;
        this.initialized = true;
        if (!supabaseClient) return this.showAuthScreen();

        supabaseClient.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            this.currentSession = session;
            this._setUser(session.user, event === 'SIGNED_IN' ? '👑 Login successful! Swagat hai, ' + this._name(session.user) + '!' : null);
          } else if (event === 'SIGNED_OUT') {
            this.currentUser = null; this.currentSession = null; this.isGuest = false;
            sessionStorage.removeItem('munna_guest_mode'); sessionStorage.removeItem('munna_guest_id');
            localStorage.removeItem('munna_guest_mode'); localStorage.removeItem('munna_local_user');
            updateAuthUI(null); this.showAuthScreen();
          }
        });

        try {
          const { data, error } = await supabaseClient.auth.getSession();
          if (error) throw error;
          if (data?.session?.user) {
            this.currentSession = data.session;
            this._setUser(data.session.user);
          } else if (sessionStorage.getItem('munna_guest_mode') === 'true') {
            this.enterAsGuest();
          } else {
            this.showAuthScreen();
          }
          if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (e) { console.error('Auth init:', e); this.showAuthScreen(); }
      }
    };

    window.MunnaAuth = MunnaAuth;
    window.showAuthScreen = () => MunnaAuth.showAuthScreen();
    window.hideAuthScreen = () => MunnaAuth.hideAuthScreen();
    window.openAuthModal = () => MunnaAuth.openModal();
    window.closeAuthModal = () => MunnaAuth.closeModal();
    window.handleGuestLogin = (name) => MunnaAuth.enterAsGuest(name);
    window.handleGoogleSignIn = (btn) => MunnaAuth.signInWithGoogle(btn);
    window.handleScreenSignInSubmit = async (e) => { e?.preventDefault(); await MunnaAuth.signIn(document.getElementById('screenSignInEmail')?.value, document.getElementById('screenSignInPassword')?.value, document.getElementById('btnScreenSignIn')); };
    window.handleScreenSignUpSubmit = async (e) => { e?.preventDefault(); await MunnaAuth.signUp(document.getElementById('screenSignUpName')?.value, document.getElementById('screenSignUpEmail')?.value, document.getElementById('screenSignUpPassword')?.value, document.getElementById('btnScreenSignUp')); };
    window.handleModalSignInSubmit = async (e) => { e?.preventDefault(); await MunnaAuth.signIn(document.getElementById('signInEmail')?.value, document.getElementById('signInPassword')?.value, document.getElementById('btnSubmitSignIn')); };
    window.handleModalSignUpSubmit = async (e) => { e?.preventDefault(); await MunnaAuth.signUp(document.getElementById('signUpName')?.value, document.getElementById('signUpEmail')?.value, document.getElementById('signUpPassword')?.value, document.getElementById('btnSubmitSignUp')); };
    window.loginUserSession = (user, toast) => user?.is_guest ? MunnaAuth.enterAsGuest(user.user_metadata?.full_name) : MunnaAuth._setUser(user, toast);
    window.switchAuthScreenTab = function(target) { const s=target==='signup'; document.getElementById('screenTabSignUpBtn')?.classList.toggle('active',s); document.getElementById('screenTabSignInBtn')?.classList.toggle('active',!s); const a=document.getElementById('screenSignUpForm'), b=document.getElementById('screenSignInForm'); a?.classList.toggle('active',s); b?.classList.toggle('active',!s); if(a)a.style.display=s?'flex':'none'; if(b)b.style.display=s?'none':'flex'; };
    window.switchAuthModalTab = function(target) { const s=target==='signup'; document.getElementById('tabSignUpBtn')?.classList.toggle('active',s); document.getElementById('tabSignInBtn')?.classList.toggle('active',!s); const a=document.getElementById('signUpForm'), b=document.getElementById('signInForm'); a?.classList.toggle('active',s); b?.classList.toggle('active',!s); if(a)a.style.display=s?'flex':'none'; if(b)b.style.display=s?'none':'flex'; };

`,
  'auth controller'
);

fs.writeFileSync(indexPath, source, 'utf8');
console.log('Auth v2 build patch applied successfully.');
