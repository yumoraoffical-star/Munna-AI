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
  '        // --- TOP-LEVEL AUTH CONTROLLER & FAIL-SAFE FUNCTIONS ---',
  '    // --- 3. GEMINI AI CONFIGURATION (Secured via /api/chat) ---',
  `        // --- TOP-LEVEL AUTH CONTROLLER (SECURE SUPABASE AUTH) ---
    const setAuthenticatedUser = (user, toastMsg) => {
      currentUser = user;
      sessionStorage.removeItem("munna_guest_mode");
      localStorage.removeItem("munna_guest_mode");
      localStorage.removeItem("munna_local_user");
      const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "Munna User");
      userData.name = displayName;
      if (user?.email) userData.email = user.email;
      safeSet("munna_user_name", displayName);
      if (user?.email) safeSet("munna_user_email", user.email);
      updateAuthUI(user);
      if (typeof syncUserUI === "function") syncUserUI();
      hideAuthScreen();
      closeAuthModal();
      if (toastMsg) showMunnaToast(toastMsg);
      setTimeout(() => {
        if (typeof loadSessionsFromCloud === "function") {
          try { loadSessionsFromCloud(); } catch (e) { console.warn("Cloud session load:", e); }
        }
      }, 0);
    };

    const setGuestUser = (name) => {
      const guestName = name || "Mehman User";
      const guestUser = { id: "guest_" + Date.now(), email: "mehman@mirzapur.ai", is_guest: true, user_metadata: { full_name: guestName } };
      currentUser = guestUser;
      sessionStorage.setItem("munna_guest_mode", "true");
      localStorage.removeItem("munna_local_user");
      updateAuthUI(guestUser);
      hideAuthScreen();
      closeAuthModal();
      showMunnaToast("👑 Mehman entry safal! Swagat hai, " + guestName + "!");
    };

    window.showAuthScreen = function() {
      if (typeof closeAccountMenu === "function") closeAccountMenu();
      const scr = document.getElementById("authScreenOverlay");
      if (scr) { scr.classList.remove("hidden"); scr.style.display = "flex"; }
    };
    window.hideAuthScreen = function() {
      const scr = document.getElementById("authScreenOverlay");
      if (scr) { scr.classList.add("hidden"); scr.style.display = "none"; }
    };
    window.openAuthModal = function() {
      if (typeof closeAccountMenu === "function") closeAccountMenu();
      const scr = document.getElementById("authScreenOverlay");
      if (scr && !scr.classList.contains("hidden") && scr.style.display !== "none") return;
      const m = document.getElementById("authModal");
      if (m) m.classList.add("show");
    };
    window.closeAuthModal = function() {
      const m = document.getElementById("authModal");
      if (m) m.classList.remove("show");
    };
    window.handleGuestLogin = function(customName) { setGuestUser(customName); };

    window.handleGoogleSignIn = async function(triggerBtn) {
      const restore = () => {
        if (!triggerBtn) return;
        triggerBtn.classList.remove("loading");
        const orig = triggerBtn.getAttribute("data-orig-html");
        if (orig) triggerBtn.innerHTML = orig;
      };
      if (!supabaseClient) { showMunnaToast("Auth service offline hai. Mehman Mode use kar sakte hain."); restore(); return; }
      if (triggerBtn) {
        triggerBtn.classList.add("loading");
        triggerBtn.setAttribute("data-orig-html", triggerBtn.innerHTML);
        triggerBtn.innerHTML = "<span>Connecting Google... ⏳</span>";
      }
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
      const redirectUri = (!isLocal && window.location.origin && window.location.origin !== "null") ? window.location.origin + window.location.pathname : "https://munnaai.youmika.site/";
      try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUri, queryParams: { access_type: "offline", prompt: "select_account" } } });
        if (error) throw error;
        if (!data?.url) throw new Error("Google OAuth URL nahi mila.");
        window.location.assign(data.url);
      } catch (err) {
        console.error("Google OAuth error:", err);
        showMunnaToast("Google sign-in failed: " + (err?.message || "OAuth unavailable"));
        restore();
      }
    };

    async function submitSignIn(email, password, btn) {
      if (!email || !password) { showMunnaToast("Email aur password dono zaroori hain!"); return; }
      if (!supabaseClient) { showMunnaToast("Auth service offline hai. Mehman Mode use kar sakte hain."); return; }
      if (btn) { btn.classList.add("loading"); btn.setAttribute("data-orig-html", btn.innerHTML); btn.innerHTML = '<span>Dakhil ho rahe hain... ⏳</span>'; }
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("email not confirmed")) showMunnaToast("Email confirm nahi hua. Inbox check karke confirmation link dabao.");
          else if (msg.includes("invalid login credentials")) showMunnaToast("Email ya password galat hai.");
          else showMunnaToast(error.message || "Login nahi ho paya.");
          return;
        }
        if (data?.user) setAuthenticatedUser(data.user, "👑 Dakhila safal! Darbar me swagat hai, " + (data.user.user_metadata?.full_name || email.split("@")[0]) + "!");
      } catch (err) {
        console.error("Sign in error:", err);
        showMunnaToast("Network error. Kripya dobara prayas karein.");
      } finally {
        if (btn) { btn.classList.remove("loading"); const orig = btn.getAttribute("data-orig-html"); if (orig) btn.innerHTML = orig; }
      }
    }

    async function submitSignUp(name, email, password, btn) {
      if (!email || !password) { showMunnaToast("Email aur password dono zaroori hain!"); return; }
      if (password.length < 6) { showMunnaToast("Password kam se kam 6 characters ka hona chahiye!"); return; }
      if (!supabaseClient) { showMunnaToast("Auth service offline hai. Mehman Mode use kar sakte hain."); return; }
      if (btn) { btn.classList.add("loading"); btn.setAttribute("data-orig-html", btn.innerHTML); btn.innerHTML = '<span>Khata ban raha hai... ⏳</span>'; }
      try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name || email.split("@")[0] }, emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) { showMunnaToast(error.message || "Account create nahi ho paya."); return; }
        if (data?.session && data?.user) setAuthenticatedUser(data.user, "👑 Naya khata ban gaya! Darbar me swagat hai, " + (name || email.split("@")[0]) + "!");
        else if (data?.user) { showMunnaToast("Account ban gaya. Inbox me confirmation email check karo, phir login karo."); switchAuthScreenTab("signin"); }
      } catch (err) {
        console.error("Sign up error:", err);
        showMunnaToast("Network error. Kripya dobara prayas karein.");
      } finally {
        if (btn) { btn.classList.remove("loading"); const orig = btn.getAttribute("data-orig-html"); if (orig) btn.innerHTML = orig; }
      }
    }

    window.handleScreenSignInSubmit = async function(e) { if (e?.preventDefault) e.preventDefault(); await submitSignIn(document.getElementById("screenSignInEmail")?.value.trim() || "", document.getElementById("screenSignInPassword")?.value || "", document.getElementById("btnScreenSignIn")); };
    window.handleScreenSignUpSubmit = async function(e) { if (e?.preventDefault) e.preventDefault(); await submitSignUp(document.getElementById("screenSignUpName")?.value.trim() || "", document.getElementById("screenSignUpEmail")?.value.trim() || "", document.getElementById("screenSignUpPassword")?.value || "", document.getElementById("btnScreenSignUp")); };
    window.handleModalSignInSubmit = async function(e) { if (e?.preventDefault) e.preventDefault(); await submitSignIn(document.getElementById("signInEmail")?.value.trim() || "", document.getElementById("signInPassword")?.value || "", document.getElementById("btnSubmitSignIn")); };
    window.handleModalSignUpSubmit = async function(e) { if (e?.preventDefault) e.preventDefault(); await submitSignUp(document.getElementById("signUpName")?.value.trim() || "", document.getElementById("signUpEmail")?.value.trim() || "", document.getElementById("signUpPassword")?.value || "", document.getElementById("btnSubmitSignUp")); };
    window.loginUserSession = function(user, toastMsg) { if (user?.is_guest) setGuestUser(user.user_metadata?.full_name); else setAuthenticatedUser(user, toastMsg); };
    window.switchAuthScreenTab = function(target) {
      const tabSignIn = document.getElementById("screenTabSignInBtn"), tabSignUp = document.getElementById("screenTabSignUpBtn"), formSignIn = document.getElementById("screenSignInForm"), formSignUp = document.getElementById("screenSignUpForm");
      const signup = target === "signup";
      tabSignUp?.classList.toggle("active", signup); tabSignIn?.classList.toggle("active", !signup); formSignUp?.classList.toggle("active", signup); formSignIn?.classList.toggle("active", !signup);
      if (formSignUp) formSignUp.style.display = signup ? "flex" : "none"; if (formSignIn) formSignIn.style.display = signup ? "none" : "flex";
    };
    window.switchAuthModalTab = function(target) {
      const tabSignIn = document.getElementById("tabSignInBtn"), tabSignUp = document.getElementById("tabSignUpBtn"), formSignIn = document.getElementById("signInForm"), formSignUp = document.getElementById("signUpForm");
      const signup = target === "signup";
      tabSignUp?.classList.toggle("active", signup); tabSignIn?.classList.toggle("active", !signup); formSignUp?.classList.toggle("active", signup); formSignIn?.classList.toggle("active", !signup);
      if (formSignUp) formSignUp.style.display = signup ? "flex" : "none"; if (formSignIn) formSignIn.style.display = signup ? "none" : "flex";
    };

` ,
  'top-level auth controller'
);

replaceBetween(
  '      // Session helper to reliably activate user state across both local & cloud',
  '      // Logout Confirmation Actions',
  `      // Keep the legacy helper wired to the same real-auth state machine.
      function loginUserSession(user, toastMsg) {
        if (user?.is_guest) setGuestUser(user.user_metadata?.full_name);
        else setAuthenticatedUser(user, toastMsg);
      }

`,
  'legacy login session helper'
);

replaceBetween(
  '      // Helper function to handle sign in with cloud attempt + zero-lockout fallback',
  '      // Helper function to handle sign up with cloud attempt + zero-lockout fallback',
  `      // Real sign-in: never create a fake/local account when Supabase rejects credentials.
      async function handleUnifiedSignIn(email, password, btnEl) {
        await submitSignIn(email, password, btnEl);
      }

`,
  'unified sign-in helper'
);

replaceBetween(
  '      // Helper function to handle sign up with cloud attempt + zero-lockout fallback',
  '      if (signInForm) {',
  `      // Real sign-up: account state comes only from Supabase Auth.
      async function handleUnifiedSignUp(name, email, password, btnEl) {
        await submitSignUp(name, email, password, btnEl);
      }

`,
  'unified sign-up helper'
);

replaceBetween(
  '      // Supabase Auth State Initialization',
  '      initSupabaseAuth();',
  `      // Supabase Auth State Initialization: session storage is the source of truth.
      async function initSupabaseAuth() {
        if (!supabaseClient) { showAuthScreen(); return; }
        supabaseClient.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            setAuthenticatedUser(session.user, event === "SIGNED_IN" ? "👑 Dakhila safal! Darbar me swagat hai, " + (session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Launde") + "!" : null);
          } else if (event === "SIGNED_OUT") {
            currentUser = null;
            sessionStorage.removeItem("munna_guest_mode");
            localStorage.removeItem("munna_guest_mode");
            localStorage.removeItem("munna_local_user");
            updateAuthUI(null);
            showAuthScreen();
          }
        });
        try {
          const { data, error } = await supabaseClient.auth.getSession();
          if (error) throw error;
          if (data?.session?.user) setAuthenticatedUser(data.session.user);
          else if (sessionStorage.getItem("munna_guest_mode") === "true") setGuestUser();
          else showAuthScreen();
        } catch (err) {
          console.error("Auth initialization error:", err);
          showAuthScreen();
        }
      }
`,
  'Supabase auth initialization'
);

fs.writeFileSync(indexPath, source, 'utf8');
console.log('Auth build patch applied successfully.');
