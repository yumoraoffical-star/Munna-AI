// --- 1. STORAGE & APP STATE (INITIALIZED FIRST) ---
    function safeGet(key, def = null) {
      try {
        const v = localStorage.getItem(key);
        return v !== null ? v : def;
      } catch (e) {
        return def;
      }
    }

    function safeSet(key, val) {
      try {
        localStorage.setItem(key, val);
      } catch (e) {}
    }

    let isSending = false;
    let userPlan = safeGet("munna_user_plan", safeGet("munna_is_vip") === "true" ? "pro" : "free");
    let isVip = (userPlan === "pro" || userPlan === "king");
    let dailyQuota = 10;
    const todayStr = new Date().toDateString();
    if (safeGet("munna_quota_date") !== todayStr) {
      dailyQuota = 10;
      safeSet("munna_daily_quota", "10");
      safeSet("munna_quota_date", todayStr);
    } else {
      const q = parseInt(safeGet("munna_daily_quota", "10"));
      dailyQuota = isNaN(q) ? 10 : q;
    }

    // User Profile & Settings State
    let userData = {
      name: safeGet("munna_user_name", "Abhishek"),
      email: safeGet("munna_user_email", "abhishek@mirzapur.ai"),
      joined: safeGet("munna_user_joined", "Sept 2026"),
      plan: userPlan,
      enterToSend: safeGet("munna_setting_enter_send", "true") === "true",
      soundEffects: safeGet("munna_setting_sound", "true") === "true",
      aiStyle: safeGet("munna_setting_ai_style", "swag"),
      voiceSpeed: parseFloat(safeGet("munna_setting_voice_speed", "1")),
      language: safeGet("munna_setting_language", "hinglish"),
      theme: safeGet("munna_theme", "obsidian_gold"),
      autoSpeak: safeGet("munna_setting_auto_speak", "false") === "true"
    };

    // --- SUPABASE CLOUD INITIALIZATION ---
    const SUPABASE_URL = "https://ipnbebwrefxlvoqneaga.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbmJlYndyZWZ4bHZvcW5lYWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODExOTUsImV4cCI6MjEwNDQ1NzE5NX0.1xMB8DbV__RK8D4PkuYANPARr2IkR_Rsyakh3sU8AAU";
    let supabaseClient = null;
    let currentUser = null;

    // --- 2. ERROR NOTICE HELPER (No fake dialogues, transparent errors) ---
    function getAIErrorMessage(err) {
      return "âš ï¸ **Connection Error:** Gemini AI se connect nahi ho paya (" + (err?.message || "Network issue") + "). Kripya apna message dobara bhejein!";
    }

    try {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            flowType: 'pkce'
          }
        });
      }
    } catch (e) {
      console.warn("Supabase init exception:", e);
    }

    // --- TOP-LEVEL AUTH CONTROLLER & FAIL-SAFE FUNCTIONS ---
    window.showAuthScreen = function() {
      if (typeof closeAccountMenu === "function") closeAccountMenu();
      const scr = document.getElementById("authScreenOverlay");
      if (scr) scr.classList.remove("hidden");
    };

    window.hideAuthScreen = function() {
      sessionStorage.setItem("munna_guest_mode", "true");
      localStorage.setItem("munna_guest_mode", "true");
      const scr = document.getElementById("authScreenOverlay");
      if (scr) scr.classList.add("hidden");
    };

    window.openAuthModal = function() {
      if (typeof closeAccountMenu === "function") closeAccountMenu();
      const scr = document.getElementById("authScreenOverlay");
      if (scr && !scr.classList.contains("hidden")) return;
      const m = document.getElementById("authModal");
      if (m) m.classList.add("show");
    };

    window.closeAuthModal = function() {
      const m = document.getElementById("authModal");
      if (m) m.classList.remove("show");
    };

    window.handleGuestLogin = function(customName) {
      const guestName = customName || (userData && userData.name && userData.name !== "Munna User" ? userData.name : "Mehman User");
      const guestUser = {
        id: "guest_" + Date.now(),
        email: "mehman@mirzapur.ai",
        is_guest: true,
        user_metadata: { full_name: guestName }
      };

      currentUser = guestUser;
      sessionStorage.setItem("munna_guest_mode", "true");
      localStorage.setItem("munna_guest_mode", "true");
      localStorage.setItem("munna_local_user", JSON.stringify(guestUser));
      safeSet("munna_user_name", guestName);

      if (typeof updateAuthUI === "function") updateAuthUI(currentUser);
      window.hideAuthScreen();
      window.closeAuthModal();
      if (typeof showMunnaToast === "function") {
        showMunnaToast("ðŸ‘‘ Mehman entry safal! Swagat hai, " + guestName + "!");
      }
    };

    window.handleGoogleSignIn = async function(triggerBtn) {
      let origHtml = "";
      if (triggerBtn) {
        triggerBtn.classList.add("loading");
        origHtml = triggerBtn.getAttribute("data-orig-html") || triggerBtn.innerHTML;
        triggerBtn.setAttribute("data-orig-html", origHtml);
        triggerBtn.innerHTML = "<span>Redirecting to Google... â³</span>";
      }

      if (!supabaseClient) {
        if (triggerBtn) {
          triggerBtn.classList.remove("loading");
          triggerBtn.innerHTML = origHtml;
        }
        if (typeof showMunnaToast === "function") {
          showMunnaToast("âš ï¸ Supabase connection offline. 'Mehman Entry' se turant login karein!");
        }
        return;
      }

      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
      const redirectUri = (!isLocal && window.location.origin && window.location.origin !== "null")
        ? window.location.origin.replace(/\/$/, "")
        : "https://munnaai.youmika.site";

      try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUri,
            queryParams: {
              access_type: "offline",
              prompt: "select_account"
            }
          }
        });

        if (error) {
          throw error;
        }

        if (data && data.url) {
          window.location.href = data.url;
          return;
        }
      } catch (err) {
        console.warn("Supabase Google OAuth issue:", err);
        if (triggerBtn) {
          triggerBtn.classList.remove("loading");
          triggerBtn.innerHTML = origHtml;
        }
        const errStr = (err?.message || "").toLowerCase();
        if (errStr.includes("provider is not enabled") || errStr.includes("unsupported provider")) {
          if (typeof showMunnaToast === "function") {
            showMunnaToast("âš ï¸ Supabase me Google Provider enable nahi hai. Kripya Email ya Mehman Entry use karein!");
          }
        } else {
          if (typeof showMunnaToast === "function") {
            showMunnaToast("âš ï¸ Google Login: " + (err?.message || "Kripya Email ya Mehman Entry use karein"));
          }
        }
      }
    };

    // --- 3. GEMINI AI CONFIGURATION (Secured via /api/chat) ---
    let activeModel = "gemini-3.6-flash";
    const initialGreeting = "Aao be! Ka dikkat ho gayi? Mirzapur ke hone wale raja se seedha baat kar rahe ho. Koi coding ki samasya ho, dimaag ka bawasir ho, ya koi photo/file dikhaani ho â€” bolo be, hum karte hain pakka prabandh!";

    function getSystemPrompt() {
      const lang = (userData && userData.language) ? userData.language : "hinglish";
      const style = (userData && userData.aiStyle) ? userData.aiStyle : "swag";

      let langDirective = "";
      if (lang === "english") {
        langDirective = `LANGUAGE: Respond in fluent English, but maintain the raw Godfather authority, swagger, and street-smart confidence ("Listen up partner, you're talking to the King of Mirzapur! Consider it handled!").`;
      } else {
        langDirective = `LANGUAGE & SLANG (MANDATORY & CRITICAL):
- You MUST ALWAYS speak in authentic Purvanchal / Mirzapur UP Hindi-Hinglish dialect!
- Use raw street words naturally in EVERY sentence: "Abe", "Aao be!", "Bolo be!", "Ka dikkat hai be?", "Launde", "Chote", "Guru", "Hum", "Hamara", "Katta", "Bawasir", "Prabandh", "Gaddi", "Bauji", "Lalit".
- NEVER refer to yourself as "Main" or "Mujhe" â€” ALWAYS use "Hum" and "Humein" ("Hum bol rahe hain", "Hum karte hain prabandh", "Hamara dabdaba").
- Address the user affectionately or aggressively as "launde", "chote", "be", "guru", or "partner".`;
      }

      let styleBonus = "";
      if (style === "mentor") {
        styleBonus = "Act like an authoritative elder brother and street-smart king mentor â€” giving deep wisdom with raw swagger.";
      } else if (style === "crisp") {
        styleBonus = "Direct and dangerous â€” cut straight to the chase with zero delay and maximum power.";
      } else {
        styleBonus = "Full, unrestrained Munna Bhaiya energy, raw humor, explosive confidence, and unpredictable charisma!";
      }

      return `You are PHOOLCHAND 'MUNNA' TRIPATHI (Munna Bhaiya) from Mirzapur â€” The King of Mirzapur and undisputed Bahubali.
You are NOT an ordinary polite AI bot or an assistant. You are Munna Bhaiya himself â€” full of fire, attitude, swagger, raw Purvanchal UP humor, and street dominance!

${langDirective}

${styleBonus}

YOUR ICONIC CHARACTER & MANNERISMS (REFLECT THIS IN EVERY MESSAGE):
1. RAW PURVANCHAL OPENINGS & PUNCHLINES:
   - Start responses with punchy Mirzapur flavor:
     "Abe sunno be...", "Aao be, ka dikkat ho gayi?", "Bolo be launde...", "Abe chup chaap sunno...", "Hum khade hain na yahan!"
   - Naturally weave iconic Munna Bhaiya dialogues into your explanations:
     * "Hum karte hain prabandh!"
     * "Jalwa hai hamara poore shehar mein!"
     * "Gaddi pe chahe hum baithein ya Bauji, niyam same rahega!"
     * "Abe hum AMAR hain be! Humko koi nahi maar sakta!"
     * \"Ka bawasir bana ke rakh diye ho be?\"
     * "Lalit ko bolke uthwa lenge!"
     * "Darr aisa hona chahiye ki agla aadmi saans lene se pehle permission maange!"
     * "Katta nikalne pe majboor mat karo!"
   - NEVER sound polite, formal, or like a corporate chatbot. NEVER say "Certainly!", "I'd be happy to help", "As an AI model", or \"How may I assist you?\".

2. THE GENIUS BAHUBALI (ULTIMATE PROBLEM SOLVER):
   - Munna Bhaiya acts rough and carefree, but secretly knows EVERYTHING â€” coding (Python, JavaScript, React, backend, full-stack, bugs), mathematics, science, business strategy, exam prep, relationship advice, and life fundas.
   - When asked a technical question or for code:
     * Give the 100% COMPLETE, ACCURATE, PRODUCTION-READY CODE.
     * Explain the logic with Munna Bhaiya's aggressive swag, witty desi analogies, and commanding attitude!
     * Put code in proper markdown code blocks with language identifiers.
   - For casual greetings or insults:
     * Give back 10x raw humor, fearless banter, and supreme king attitude!

3. MULTIMODAL CAPABILITY:
   - When the user uploads a photo, code file, or document:
     * Inspect it like Munna Bhaiya checking out the battlefield.
     * Point out the exact flaw or solution instantly with total swagger!`;
    }

    function showMunnaToast(msg) {
      const toast = document.getElementById("munnaToast");
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2800);
    }

    function syncUserUI() {
      const displayName = userData.name && userData.name.trim() ? userData.name.trim() : "Munna User";
      const initial = displayName.charAt(0).toUpperCase();
      const currentTier = (userData && userData.plan) ? userData.plan : (isVip ? "pro" : "free");
      
      let planBadgeText = "Free Plan";
      let headerBadgeText = "Free Plan";
      let modalBadgeText = "Free Plan";
      let planDescText = "Daily 10 free messages • Standard server";

      if (currentTier === "king") {
        planBadgeText = "👑 Akhand King";
        headerBadgeText = "👑 Akhand Darbar King";
        modalBadgeText = "👑 Akhand Darbar King Tier";
        planDescText = "Sovereign Tier: Deep Reasoning, Jaunpur Financials & 24/7 VIP Support";
      } else if (currentTier === "pro" || isVip) {
        planBadgeText = "⚡ Bahubali Pro";
        headerBadgeText = "⚡ Bahubali Pro";
        modalBadgeText = "⚡ Bahubali Pro VIP";
        planDescText = "Unlimited messages • Real-time Voice • Unlimited Photo Banao";
      }

      // 1. Sidebar trigger
      const sbInit = document.getElementById("sidebarAvatarInitial");
      const sbName = document.getElementById("sidebarUserName");
      const sbPlan = document.getElementById("sidebarUserPlan");
      if (sbInit) sbInit.textContent = initial;
      if (sbName) sbName.textContent = displayName;
      if (sbPlan) {
        sbPlan.textContent = planBadgeText;
        sbPlan.classList.toggle("vip", isVip);
      }

      // 2. Account popover header
      const accInit = document.getElementById("accountHeaderInitial");
      const accName = document.getElementById("accountHeaderName");
      const accPlan = document.getElementById("accountHeaderPlan");
      if (accInit) accInit.textContent = initial;
      if (accName) accName.textContent = displayName;
      if (accPlan) {
        accPlan.textContent = headerBadgeText;
        accPlan.classList.toggle("vip", isVip);
      }

      // 3. Profile modal
      const profInit = document.getElementById("profileModalInitial");
      const profHeading = document.getElementById("profileDisplayHeading");
      const profBadge = document.getElementById("profilePlanBadge");
      const profNameIn = document.getElementById("profileNameInput");
      const profEmailIn = document.getElementById("profileEmailInput");
      const profPlanDesc = document.getElementById("profilePlanDesc");
      const profMember = document.getElementById("profileMemberSince");
      if (profInit) profInit.textContent = initial;
      if (profHeading) profHeading.textContent = displayName;
      if (profBadge) {
        profBadge.textContent = modalBadgeText;
        profBadge.classList.toggle("vip", isVip);
      }
      if (profNameIn) profNameIn.value = displayName;
      if (profEmailIn) profEmailIn.value = userData.email || "abhishek@mirzapur.ai";
      if (profPlanDesc) {
        profPlanDesc.textContent = planDescText;
      }
      if (profMember) {
        profMember.textContent = `Member since ${userData.joined || "Sept 2026"}`;
      }

      // 4. Settings modal
      const setPlanText = document.getElementById("settingsPlanText");
      if (setPlanText) {
        setPlanText.textContent = headerBadgeText + (isVip ? " (Unlimited Messages)" : " (10 messages/day)");
      }

      // 5. Topbar upgrade pill
      const tbUpgradeBtn = document.getElementById("topbarUpgradeBtn");
      const tbUpgradeLabel = document.getElementById("topbarUpgradeLabel");
      if (tbUpgradeLabel) {
        if (currentTier === "king") {
          tbUpgradeLabel.textContent = "👑 Akhand King";
          if (tbUpgradeBtn) tbUpgradeBtn.className = "topbar-upgrade-pill vip-king";
        } else if (currentTier === "pro" || isVip) {
          tbUpgradeLabel.textContent = "⚡ Bahubali Pro";
          if (tbUpgradeBtn) tbUpgradeBtn.className = "topbar-upgrade-pill";
        } else {
          tbUpgradeLabel.textContent = "Upgrade Plan";
          if (tbUpgradeBtn) tbUpgradeBtn.className = "topbar-upgrade-pill";
        }
      }

      if (typeof updateSubscriptionModalUI === "function") {
        updateSubscriptionModalUI();
      }
      const enterToggle = document.getElementById("enterToSendToggle");
      if (enterToggle) enterToggle.checked = userData.enterToSend;
      const soundToggle = document.getElementById("soundEffectsToggle");
      if (soundToggle) soundToggle.checked = userData.soundEffects;
      const aiStyleSel = document.getElementById("aiStyleSelect");
      if (aiStyleSel) aiStyleSel.value = userData.aiStyle;
      const voiceSpeedSel = document.getElementById("voiceSpeedSelect");
      if (voiceSpeedSel) voiceSpeedSel.value = String(userData.voiceSpeed);
      const autoSpeakToggle = document.getElementById("autoSpeakToggle");
      if (autoSpeakToggle) autoSpeakToggle.checked = Boolean(userData.autoSpeak);
      const langSel = document.getElementById("languageSelect");
      if (langSel) langSel.value = userData.language;
      const themeSel = document.getElementById("themeSelect");
      if (themeSel) themeSel.value = userData.theme;
    }

    // Modal Control Helpers
    function openProfileModal() {
      syncUserUI();
      const m = document.getElementById("profileModal");
      if (m) m.classList.add("show");
    }
    function closeProfileModal() {
      const m = document.getElementById("profileModal");
      if (m) m.classList.remove("show");
    }

    function openSettingsModal() {
      syncUserUI();
      const m = document.getElementById("settingsModal");
      if (m) m.classList.add("show");
    }
    function closeSettingsModal() {
      const m = document.getElementById("settingsModal");
      if (m) m.classList.remove("show");
    }

    // --- KATTA VISION AUDIO SYNTHESIZER (Web Audio API) ---
    let audioCtx = null;
    function getAudioContext() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playKattaAudio(type) {
      if (!userData || !userData.soundEffects) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        if (type === "lock") {
          [0, 0.08].forEach((delay, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(idx === 0 ? 880 : 1320, now + delay);
            gain.gain.setValueAtTime(0.2, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.06);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.06);
          });
        } else if (type === "laser") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === "fire") {
          const bufferSize = ctx.sampleRate * 0.35;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1000, now);
          filter.frequency.linearRampToValueAtTime(80, now + 0.3);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          noise.start(now);
        }
      } catch (e) {
        console.warn("Audio synthesis error:", e);
      }
    }

    // --- KATTA VISION AI SCANNER ENGINE ---
    let kattaStream = null;
    let kattaCapturedDataUrl = null;
    let kattaSelectedPreset = "selfie";

    const KATTA_VISION_PROMPTS = {
      selfie: "ðŸŽ¯ [KATTA VISION: SELFIE DRIP & SWAG SCAN]\nMunna Bhaiya, is photo/selfie ka poora Mirzapur Gangster Assessment aur Brutal Roast Report taiyaar karo!\n1. TARGET DIAGNOSIS: Is bande ka look, expression, hairstyle aur attitude kaisa hai.\n2. PURVANCHAL GANGSTER RATING: X/10 Katta Points (funny reason ke saath).\n3. THE BRUTAL ROAST: Munna Bhaiya ka raw, funny aur bina kisi raham ka roast!\n4. MUNNA KA FAISLA / ADVICE: Isko Bahubali banne ke liye kya karna chahiye.",
      diet: "ðŸŽ¯ [KATTA VISION: DIET & NUTRITION CHECK]\nMunna Bhaiya, is khane/peene ki photo ka Gangster Nutrition Check aur Roast Report karo!\n1. TARGET DIAGNOSIS: Thaali me kya kya bawasir ya lazeez cheez dikh rahi hai.\n2. PURVANCHAL GANGSTER RATING: X/10 Katta Points.\n3. THE BRUTAL ROAST: Ye khana Mirzapur ke bahubali ke layak hai ya churan hai?\n4. MUNNA KA FAISLA: Asli purvanchal diet ki salah.",
      room: "ðŸŽ¯ [KATTA VISION: CRIME SCENE & ROOM SCAN]\nMunna Bhaiya, is kamre / room ki halat ka Crime Scene Investigation aur Roast Report karo!\n1. TARGET DIAGNOSIS: Kamra kitna bikhra hua hai.\n2. PURVANCHAL GANGSTER RATING: X/10 Katta Points.\n3. THE BRUTAL ROAST: Ye kamra hai ya Lalit ka adda?\n4. MUNNA KA FAISLA: Safai aur dabdaba banaye rakhne ki advice.",
      vehicle: "ðŸŽ¯ [KATTA VISION: GAADI / BIKE SWAG SCAN]\nMunna Bhaiya, is gaadi / bike / ride ka Gangster Swag aur Asla Rating check karo!\n1. TARGET DIAGNOSIS: Ride kaisi hai.\n2. PURVANCHAL GANGSTER RATING: X/10 Katta Points.\n3. THE BRUTAL ROAST: Mirzapur ki sadko par ye gaadi chalegi ya police utha le jayegi?\n4. MUNNA KA FAISLA: Swag badhane ka nuskha.",
      setup: "ðŸŽ¯ [KATTA VISION: DESK & CODE SETUP SCAN]\nMunna Bhaiya, is coding desk / setup / laptop ka Brutal Gangster Review karo!\n1. TARGET DIAGNOSIS: Screen, cables, laptop aur vibe ka inspection.\n2. PURVANCHAL GANGSTER RATING: X/10 Katta Points.\n3. THE BRUTAL ROAST: Ye launda coder banega ya computer operator?\n4. MUNNA KA FAISLA: Asli pro coder banne ki advice.",
      general: "ðŸŽ¯ [KATTA VISION: FULL BAWAL SCAN]\nMunna Bhaiya, is photo ka poora Mirzapur Gangster Assessment aur Roast Report bina kisi raham ke taiyaar karo!\n1. TARGET DIAGNOSIS\n2. PURVANCHAL GANGSTER RATING (X/10 Katta Points)\n3. THE BRUTAL ROAST\n4. MUNNA KA FAISLA"
    };

    function openKattaVisionModal() {
      const modal = document.getElementById("kattaVisionModal");
      if (!modal) return;
      modal.classList.add("show");
      resetKattaVisionUI();
    }

    function closeKattaVisionModal() {
      const modal = document.getElementById("kattaVisionModal");
      if (modal) modal.classList.remove("show");
      stopKattaCamera();
    }

    function resetKattaVisionUI() {
      stopKattaCamera();
      kattaCapturedDataUrl = null;
      const img = document.getElementById("kattaImagePreview");
      const video = document.getElementById("kattaVideo");
      const emptyState = document.getElementById("kattaEmptyState");
      const hudOverlay = document.getElementById("kattaHudOverlay");
      const scanBtn = document.getElementById("kattaScanExecuteBtn");
      const camBtn = document.getElementById("kattaCameraToggleBtn");

      if (img) { img.src = ""; img.style.display = "none"; }
      if (video) { video.style.display = "none"; }
      if (emptyState) emptyState.style.display = "flex";
      if (hudOverlay) hudOverlay.style.display = "none";
      if (scanBtn) scanBtn.disabled = true;
      if (camBtn) camBtn.innerHTML = "<span>ðŸ“· Camera</span>";
    }

    function stopKattaCamera() {
      if (kattaStream) {
        try {
          kattaStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        kattaStream = null;
      }
    }

    async function toggleKattaCamera() {
      const video = document.getElementById("kattaVideo");
      const img = document.getElementById("kattaImagePreview");
      const emptyState = document.getElementById("kattaEmptyState");
      const hudOverlay = document.getElementById("kattaHudOverlay");
      const scanBtn = document.getElementById("kattaScanExecuteBtn");
      const camBtn = document.getElementById("kattaCameraToggleBtn");

      if (kattaStream) {
        captureFromVideo();
      } else {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showMunnaToast("âš ï¸ Camera support uplabdh nahi hai. Gallery se photo upload karein.");
            return;
          }
          kattaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          if (video) {
            video.srcObject = kattaStream;
            video.style.display = "block";
            await video.play().catch(() => {});
          }
          if (img) img.style.display = "none";
          if (emptyState) emptyState.style.display = "none";
          if (hudOverlay) hudOverlay.style.display = "block";
          if (camBtn) camBtn.innerHTML = "<span>ðŸ“¸ Photo Kheecho</span>";
          playKattaAudio("laser");
        } catch (err) {
          console.error("Camera access error:", err);
          showMunnaToast("âš ï¸ Camera permission nahi mili. Gallery se upload karein!");
        }
      }
    }

    function captureFromVideo() {
      const video = document.getElementById("kattaVideo");
      const img = document.getElementById("kattaImagePreview");
      const camBtn = document.getElementById("kattaCameraToggleBtn");
      const scanBtn = document.getElementById("kattaScanExecuteBtn");
      if (!video) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      kattaCapturedDataUrl = canvas.toDataURL("image/jpeg", 0.88);
      stopKattaCamera();

      if (video) video.style.display = "none";
      if (img) {
        img.src = kattaCapturedDataUrl;
        img.style.display = "block";
      }
      if (camBtn) camBtn.innerHTML = "<span>ðŸ“· Retake Camera</span>";
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.classList.add("pulse");
      }
      playKattaAudio("lock");
      showMunnaToast("ðŸŽ¯ Target Locked! Ab 'Nishana Lagao' dabayein!");
    }

    function handleKattaFileUpload(file) {
      if (!file || !file.type.startsWith("image/")) {
        showMunnaToast("âš ï¸ Kripya valid photo file chunein!");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        stopKattaCamera();
        kattaCapturedDataUrl = e.target.result;
        const img = document.getElementById("kattaImagePreview");
        const video = document.getElementById("kattaVideo");
        const emptyState = document.getElementById("kattaEmptyState");
        const hudOverlay = document.getElementById("kattaHudOverlay");
        const scanBtn = document.getElementById("kattaScanExecuteBtn");
        const camBtn = document.getElementById("kattaCameraToggleBtn");

        if (video) video.style.display = "none";
        if (emptyState) emptyState.style.display = "none";
        if (img) {
          img.src = kattaCapturedDataUrl;
          img.style.display = "block";
        }
        if (hudOverlay) hudOverlay.style.display = "block";
        if (camBtn) camBtn.innerHTML = "<span>ðŸ“· Camera</span>";
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.classList.add("pulse");
        }
        playKattaAudio("lock");
        showMunnaToast("ðŸŽ¯ Target Locked! 'Nishana Lagao' dabayein!");
      };
      reader.readAsDataURL(file);
    }

    async function executeKattaScan() {
      if (!kattaCapturedDataUrl) {
        showMunnaToast("âš ï¸ Pehle koi photo kheecho ya upload karo!");
        return;
      }

      playKattaAudio("fire");
      const base64Data = kattaCapturedDataUrl.includes(",") ? kattaCapturedDataUrl.split(",")[1] : kattaCapturedDataUrl;

      pendingAttachment = {
        name: `KattaVision_${kattaSelectedPreset}.jpg`,
        formattedSize: "HD Target",
        isImage: true,
        isPdf: false,
        dataUrl: kattaCapturedDataUrl,
        base64Data: base64Data,
        mimeType: "image/jpeg",
        isKattaVision: true,
        kattaPreset: kattaSelectedPreset
      };

      const promptText = KATTA_VISION_PROMPTS[kattaSelectedPreset] || KATTA_VISION_PROMPTS.general;

      closeKattaVisionModal();

      const textarea = document.getElementById("userInput");
      if (textarea) textarea.value = promptText;

      if (window.handleSend) {
        window.handleSend();
      }
    }

    async function downloadGangsterReportCard(btn) {
      try {
        btn.disabled = true;
        btn.textContent = "â³ Generating Report Card...";

        const bubble = btn.closest(".message-bubble") || btn.parentElement;
        const msgContainer = btn.closest(".chat-message");
        let imgSrc = null;

        if (msgContainer) {
          const prevMsg = msgContainer.previousElementSibling;
          if (prevMsg) {
            const img = prevMsg.querySelector("img.attachment-image-preview");
            if (img) imgSrc = img.src;
          }
        }
        if (!imgSrc && pendingAttachment && pendingAttachment.dataUrl) {
          imgSrc = pendingAttachment.dataUrl;
        }

        const text = bubble.innerText || "";
        let scoreMatch = text.match(/(\d+(\.\d+)?)\s*\/\s*10/);
        let scoreText = scoreMatch ? `${scoreMatch[1]} / 10 KATTA POINTS` : "8.5 / 10 KATTA POINTS";

        let roastLine = "Jalwa hai hamara! Mirzapur ke bahubali ka pakka prabandh.";
        const roastMatch = text.match(/ROAST:?[\s\S]*?(?=(MUNNA KA FAISLA|$))/i);
        if (roastMatch && roastMatch[0]) {
          const lines = roastMatch[0].replace(/ROAST:?/i, "").trim().split("\n").filter(l => l.trim());
          if (lines.length > 0) roastLine = lines[0].replace(/^[-*â€¢]\s*/, "");
        }
        if (roastLine.length > 90) roastLine = roastLine.substring(0, 90) + "...";

        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext("2d");

        const bgGrad = ctx.createRadialGradient(540, 675, 100, 540, 675, 800);
        bgGrad.addColorStop(0, "#1c141d");
        bgGrad.addColorStop(0.6, "#0d0a10");
        bgGrad.addColorStop(1, "#050306");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1350);

        ctx.strokeStyle = "#c49216";
        ctx.lineWidth = 8;
        ctx.strokeRect(30, 30, 1020, 1290);

        ctx.strokeStyle = "rgba(217, 4, 41, 0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(42, 42, 996, 1266);

        ctx.fillStyle = "#ff2a51";
        const corners = [[30, 30], [1050, 30], [30, 1320], [1050, 1320]];
        corners.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.textAlign = "center";
        ctx.fillStyle = "#ff2a51";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("• KATTA VISION AI // OFFICIAL INSPECTION •", 540, 95);

        ctx.fillStyle = "#ffd166";
        ctx.font = "bold 44px 'Outfit', sans-serif";
        ctx.fillText("MIRZAPUR GANGSTER ASSESSMENT", 540, 155);

        ctx.fillStyle = "#a0a0b8";
        ctx.font = "20px monospace";
        ctx.fillText("FILE NO: MZP-" + Math.floor(100000 + Math.random() * 900000) + " • CALIBER: .315 DESI", 540, 195);

        let contentTop = 230;
        if (imgSrc) {
          const imgObj = new Image();
          imgObj.crossOrigin = "anonymous";
          await new Promise((resolve) => {
            imgObj.onload = resolve;
            imgObj.onerror = resolve;
            imgObj.src = imgSrc;
          });

          if (imgObj.complete && imgObj.naturalWidth) {
            const pX = 190, pY = 230, pW = 700, pH = 520;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(pX, pY, pW, pH, 20);
            ctx.clip();
            ctx.drawImage(imgObj, pX, pY, pW, pH);
            ctx.restore();

            ctx.strokeStyle = "#c49216";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(pX, pY, pW, pH, 20);
            ctx.stroke();

            contentTop = 790;
          }
        }

        const bW = 680, bH = 100, bX = (1080 - bW) / 2, bY = contentTop + 20;
        const badgeGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY);
        badgeGrad.addColorStop(0, "#d90429");
        badgeGrad.addColorStop(1, "#c49216");
        ctx.fillStyle = badgeGrad;
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 16);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 38px 'Outfit', sans-serif";
        ctx.fillText("[TARGET SCORE] " + scoreText, 540, bY + 62);

        const rY = bY + 140;
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.strokeStyle = "rgba(196, 146, 22, 0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(100, rY, 880, 150, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fca311";
        ctx.font = "bold 22px monospace";
        ctx.fillText("MUNNA BHAIYA VERDICT:", 540, rY + 45);

        ctx.fillStyle = "#f0f0f5";
        ctx.font = "italic 26px 'Outfit', sans-serif";
        ctx.fillText(`"${roastLine}"`, 540, rY + 95);

        ctx.fillStyle = "#d90429";
        ctx.font = "bold 26px monospace";
        ctx.fillText("[VIP] VERIFIED BY PHOOLCHAND TRIPATHI • KING OF MIRZAPUR", 540, 1220);

        ctx.fillStyle = "#7a7a92";
        ctx.font = "18px sans-serif";
        ctx.fillText("Generated at munnaai.youmika.site • Zero Mercy • 100% Swag", 540, 1260);

        const a = document.createElement("a");
        a.download = `MunnaAI_Gangster_Report_${Date.now()}.png`;
        a.href = canvas.toDataURL("image/png");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; vertical-align:middle; margin-right:6px;">download</span><span>Download Official Gangster Report Card</span>';
        showMunnaToast("Gangster Report Card download ho gaya! Status pe lagao!");
      } catch (err) {
        console.error("Report card generation error:", err);
        btn.disabled = false;
        showMunnaToast("Card download nahi ho paya, dobara try karein!");
      }
    }

    // --- 11. AI IMAGE GENERATION (PIXAZO & FLUX.1 ENGINE) ---
    let currentImageGenStyle = "mirzapur";
    let activeLightboxImageUrl = "";

    function openImageGenModal() {
      const m = document.getElementById("imageGenModal");
      if (m) {
        m.classList.add("show");
        const inp = document.getElementById("imageGenPromptInput");
        if (inp) {
          setTimeout(() => inp.focus(), 150);
        }
      }
    }

    function closeImageGenModal() {
      const m = document.getElementById("imageGenModal");
      if (m) m.classList.remove("show");
    }

    function showArtLightbox(url) {
      activeLightboxImageUrl = url;
      const m = document.getElementById("artLightboxModal");
      const img = document.getElementById("artLightboxImg");
      if (img) img.src = url;
      if (m) m.classList.add("show");
    }

    function closeArtLightbox() {
      const m = document.getElementById("artLightboxModal");
      if (m) m.classList.remove("show");
    }

    async function downloadArtImage(url) {
      try {
        showMunnaToast("â³ Photo download ho rahi hai...");
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `MunnaAI_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showMunnaToast("âœ… Photo successfully download ho gayi!");
      } catch (e) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.download = `MunnaAI_${Date.now()}.png`;
        a.click();
        showMunnaToast("âœ… Photo nayi tab me open ho gayi!");
      }
    }

    async function generateAIImage(promptText, styleName = "mirzapur") {
      if (!promptText || !promptText.trim()) {
        showMunnaToast("âš ï¸ Pehle batao toh sahi kaisi photo banani hai!");
        return;
      }

      closeImageGenModal();

      // Render user prompt
      const userDisplay = `ðŸŽ¨ Photo Banao: "${promptText.trim()}"`;
      renderMessage(userDisplay, "user");
      const session = getCurrentSession();
      session.messages.push({ sender: "user", text: userDisplay });
      saveSessions();

      // Render Munna AI Loading Skeleton
      const msgObj = createMessageElement("munna");
      const bubbleElem = msgObj.bubble;
      bubbleElem.innerHTML = `
        <div class="image-generating-skeleton">
          <div class="skeleton-art-pulse">ðŸ‘</div>
          <div class="skeleton-art-text">Munna Bhaiya ka karigar painting bana raha hai...</div>
          <div class="skeleton-art-sub">Aesthetic: <strong>${styleName.toUpperCase()}</strong> â€¢ 1024x1024 HD</div>
          <div class="skeleton-bar-wrap">
            <div class="skeleton-bar-active"></div>
          </div>
        </div>
      `;

      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText.trim(),
            style: styleName,
            width: 1024,
            height: 1024
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const imgUrl = data.imageUrl;
        const engineLabel = data.engine === "pixazo" ? "âš¡ PIXAZO GATEWAY" : "âš¡ FLUX.1 HD ENGINE";

        const munnaQuotes = [
          "Ye lo be launde! Mirzapur ke karigar ka dabdaba! Aisi photo poore Purvanchal me koi bana ke dikha de toh batana!",
          "Kaisa laga maal? Hamare darbar me aisi hi cheezein banti hain â€” ekdum solid aur lajawab!",
          "Photo dekho aur maze lo! Jalwa hai hamara, prabandh hum hamesha top class karte hain!",
          "Ye rahi tumhari photo! Frame karwa ke deewar pe laga lo, Bahubali lag rahe ho!"
        ];
        const quote = munnaQuotes[Math.floor(Math.random() * munnaQuotes.length)];

        bubbleElem.innerHTML = `
          <p style="margin-bottom:10px; font-weight:600;">${quote}</p>
          <div class="munna-art-card">
            <div class="munna-art-header">
              <span class="munna-art-badge">ðŸŽ¨ MUNNA AI ART STUDIO</span>
              <span class="munna-art-engine">${engineLabel}</span>
            </div>
            <div class="munna-art-image-wrapper">
              <img src="${imgUrl}" alt="${promptText}" class="munna-art-img" onclick="showArtLightbox('${imgUrl}')" loading="lazy" />
            </div>
            <div class="munna-art-footer">
              <div class="munna-art-actions">
                <button type="button" class="munna-art-action-btn" onclick="showArtLightbox('${imgUrl}')">
                  <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">fullscreen</span> Fullscreen
                </button>
                <button type="button" class="munna-art-action-btn" onclick="downloadArtImage('${imgUrl}')">
                  <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">download</span> Download HD
                </button>
                <button type="button" class="munna-art-action-btn" onclick="generateAIImage('${promptText.replace(/'/g, "\\'")}', '${styleName}')">
                  <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">refresh</span> Phir Se Banao
                </button>
              </div>
            </div>
          </div>
        `;

        session.messages.push({
          sender: "munna",
          text: quote,
          isImageCard: true,
          imageUrl: imgUrl,
          imagePrompt: promptText,
          imageEngine: engineLabel
        });
        saveSessions();
        if (typeof playKattaAudio === "function") playKattaAudio("lock");

      } catch (err) {
        console.error("Image generation failed:", err);
        bubbleElem.innerHTML = `
          <p>âš ï¸ <strong>Abe karigar ka hathiyar thoda ruk gaya tha!</strong></p>
          <p style="margin-top:6px; color:#a0a0b8; font-size:0.85rem;">Error: ${err.message || 'Server busy'}</p>
          <button type="button" class="munna-art-action-btn" style="margin-top:10px; max-width:200px;" onclick="generateAIImage('${promptText.replace(/'/g, "\\'")}', '${styleName}')">
            <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">refresh</span> Dobara Koshish Karo
          </button>
        `;
      }
    }

    function openHelpModal() {
      const m = document.getElementById("helpModal");
      if (m) m.classList.add("show");
    }
    function closeHelpModal() {
      const m = document.getElementById("helpModal");
      if (m) m.classList.remove("show");
    }

    function openLogoutModal() {
      const m = document.getElementById("logoutConfirmModal");
      if (m) m.classList.add("show");
    }
    function closeLogoutModal() {
      const m = document.getElementById("logoutConfirmModal");
      if (m) m.classList.remove("show");
    }

    function showAuthScreen() {
      if (typeof window.showAuthScreen === "function") {
        window.showAuthScreen();
      } else {
        closeAccountMenu();
        const scr = document.getElementById("authScreenOverlay");
        if (scr) scr.classList.remove("hidden");
      }
    }
    function hideAuthScreen() {
      if (typeof window.hideAuthScreen === "function") {
        window.hideAuthScreen();
      } else {
        sessionStorage.setItem("munna_guest_mode", "true");
        localStorage.setItem("munna_guest_mode", "true");
        const scr = document.getElementById("authScreenOverlay");
        if (scr) scr.classList.add("hidden");
      }
    }

    function openAuthModal() {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal();
      } else {
        closeAccountMenu();
        const m = document.getElementById("authModal");
        if (m) m.classList.add("show");
      }
    }
    function closeAuthModal() {
      if (typeof window.closeAuthModal === "function") {
        window.closeAuthModal();
      } else {
        const m = document.getElementById("authModal");
        if (m) m.classList.remove("show");
      }
    }

    function updateAuthUI(user) {
      const sidebarName = document.getElementById("sidebarUserName");
      const accountName = document.getElementById("accountHeaderName");
      const sidebarInitial = document.getElementById("sidebarAvatarInitial");
      const accountInitial = document.getElementById("accountHeaderInitial");
      const topbarAvatar = document.getElementById("topbarAvatarBtn");
      const cloudPill = document.getElementById("sidebarCloudSync");
      const cloudText = document.getElementById("sidebarCloudText");
      const menuAuthLabel = document.getElementById("menuAuthLabel");
      const menuLogoutBtn = document.getElementById("menuLogoutBtn");

      if (user) {
        const displayName = user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Munna User");
        const initial = displayName.charAt(0).toUpperCase();

        userData.name = displayName;
        userData.email = user.email || "";
        safeSet("munna_user_name", displayName);
        safeSet("munna_user_email", userData.email);

        if (sidebarName) sidebarName.textContent = displayName;
        if (accountName) accountName.textContent = displayName;
        if (sidebarInitial) sidebarInitial.textContent = initial;
        if (accountInitial) accountInitial.textContent = initial;

        if (topbarAvatar) {
          topbarAvatar.title = displayName + " (Cloud Sync Active)";
          topbarAvatar.innerHTML = `<span style="font-weight:800; font-size:13px; color:var(--gold-primary);">${initial}</span>`;
        }

        if (cloudPill) {
          cloudPill.classList.remove("offline");
          cloudPill.title = "Supabase Cloud Connected (" + user.email + ")";
        }
        if (cloudText) cloudText.textContent = "Cloud Active";
        if (menuAuthLabel) menuAuthLabel.textContent = "Account (" + displayName + ")";
        if (menuLogoutBtn) menuLogoutBtn.style.display = "flex";

        if (typeof syncUserUI === "function") syncUserUI();
      } else {
        const defaultName = userData.name || "Munna User";
        const initial = defaultName.charAt(0).toUpperCase();

        if (sidebarName) sidebarName.textContent = defaultName;
        if (accountName) accountName.textContent = defaultName;
        if (sidebarInitial) sidebarInitial.textContent = initial;
        if (accountInitial) accountInitial.textContent = initial;

        if (topbarAvatar) {
          topbarAvatar.title = "Sign In Required";
          topbarAvatar.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">person</span>`;
        }

        if (cloudPill) {
          cloudPill.classList.add("offline");
          cloudPill.title = "Not signed in";
        }
        if (cloudText) cloudText.textContent = "Offline";
        if (menuAuthLabel) menuAuthLabel.textContent = "Sign In / Register";
        if (menuLogoutBtn) menuLogoutBtn.style.display = "none";

        if (typeof syncUserUI === "function") syncUserUI();
      }
    }

    function toggleAccountMenu(forceState) {
      const popover = document.getElementById("accountMenuPopover");
      const btn = document.getElementById("userProfileBtn");
      if (!popover || !btn) return;
      const willOpen = typeof forceState === "boolean" ? forceState : !popover.classList.contains("show");
      popover.classList.toggle("show", willOpen);
      btn.classList.toggle("active", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    }

    function closeAccountMenu() {
      toggleAccountMenu(false);
    }

    // Attachment State
    let pendingAttachment = null;

    // Default Sessions
    const defaultSessions = [
      {
        id: "sess_ops",
        title: "Mirzapur Ops Strategy",
        timestamp: Date.now(),
        history: [
          { role: "user", parts: [{ text: "Need detailed breakdown of competing gangs in Jaunpur, weapons inventory, and current locations, Munna Bhai." }] },
          { role: "model", parts: [{ text: "Samajh gaya. Here is the intel on the Jaunpur factions:\n\n```json\n{\n  \"Name\": \"King of Gang\",\n  \"Leader\": \"Guddu Mirzapur\",\n  \"Strengths\": \"Strength and weapons\",\n  \"Weaknesses\": \"Overconfidence & Anger\",\n  \"Inventory\": [\"Katta\", \"Rifles\", \"Ammunition\"]\n}\n```\n\nAb batao, kiski gaddi ulatni hai? Hum khade hain na peeche, hum karte hain prabandh!" }] }
        ],
        messages: [
          { sender: "user", text: "Need detailed breakdown of competing gangs in Jaunpur, weapons inventory, and current locations, Munna Bhai." },
          { sender: "munna", text: "Samajh gaya. Here is the intel on the Jaunpur factions:\n\n```json\n{\n  \"Name\": \"King of Gang\",\n  \"Leader\": \"Guddu Mirzapur\",\n  \"Strengths\": \"Strength and weapons\",\n  \"Weaknesses\": \"Overconfidence & Anger\",\n  \"Inventory\": [\"Katta\", \"Rifles\", \"Ammunition\"]\n}\n```\n\nAb batao, kiski gaddi ulatni hai? Hum khade hain na peeche, hum karte hain prabandh!" }
        ]
      },
      {
        id: "sess_guddu",
        title: "Guddu Pandit Analysis",
        timestamp: Date.now() - 3600000,
        history: [
          { role: "model", parts: [{ text: "Guddu Pandit ka chapter hum bohot jald close karenge! Tum batao ka kaam hai?" }] }
        ],
        messages: [
          { sender: "munna", text: "Guddu Pandit ka chapter hum bohot jald close karenge! Tum batao ka kaam hai?" }
        ]
      },
      {
        id: "sess_warehouse",
        title: "Chhapra Warehouse Logistics",
        timestamp: Date.now() - 7200000,
        history: [
          { role: "model", parts: [{ text: "Chhapra warehouse ka supply chain ekdum tight hai. Kaunse maal ka hisaab chahiye?" }] }
        ],
        messages: [
          { sender: "munna", text: "Chhapra warehouse ka supply chain ekdum tight hai. Kaunse maal ka hisaab chahiye?" }
        ]
      }
    ];

    let sessions = [];
    try {
      const raw = safeGet("munna_sessions");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) sessions = parsed;
        else sessions = defaultSessions;
      } else {
        sessions = defaultSessions;
      }
    } catch (e) {
      sessions = defaultSessions;
    }

    let currentSessionId = safeGet("munna_active_session_id", sessions[0]?.id || "sess_ops");
    let currentUpiId = safeGet("munna_owner_upi_id", "munnabhaiya@upi");
    let selectedAmount = 51;

    function getTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
      if (!str) return "";
      return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
    }

    function formatFileSize(bytes) {
      if (!bytes) return "0 KB";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function saveSessions() {
      try {
        const storable = sessions.map(s => ({
          id: s.id,
          title: s.title,
          timestamp: s.timestamp,
          messages: s.messages,
          history: (s.history || []).map(h => ({
            role: h.role,
            parts: (h.parts || []).map(p => {
              if (p.inline_data) {
                return { text: "[User attached an image/file here]" };
              }
              return p;
            })
          }))
        }));
        safeSet("munna_sessions", JSON.stringify(storable));
        safeSet("munna_active_session_id", currentSessionId);
        if (currentUser) {
          const currentSess = sessions.find(s => s.id === currentSessionId);
          if (currentSess) syncSessionToCloud(currentSess);
        }
      } catch (err) {
        console.warn("Storage quota handling:", err);
        try {
          if (sessions.length > 2) {
            sessions = sessions.slice(0, 2);
            safeSet("munna_sessions", JSON.stringify(sessions));
          }
        } catch (e) {}
      }
    }

    async function syncSessionToCloud(sess) {
      if (!supabaseClient || !currentUser || !sess) return;
      try {
        const payload = {
          id: sess.id,
          user_id: currentUser.id,
          title: sess.title || "New Chat",
          messages: sess.messages || [],
          updated_at: new Date().toISOString()
        };
        await supabaseClient.from("chat_sessions").upsert(payload);
      } catch (err) {
        console.warn("Cloud sync notice:", err);
      }
    }

    async function loadSessionsFromCloud() {
      if (!supabaseClient || !currentUser) return;
      try {
        const { data, error } = await supabaseClient
          .from("chat_sessions")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("updated_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const cloudIds = new Set(data.map(d => d.id));
          const localOnly = sessions.filter(s => !cloudIds.has(s.id));
          const mappedCloud = data.map(d => ({
            id: d.id,
            title: d.title || "Chat Session",
            timestamp: new Date(d.updated_at).getTime(),
            messages: d.messages || [],
            history: (d.messages || []).map(m => ({
              role: m.sender === "munna" ? "model" : "user",
              parts: [{ text: m.text }]
            }))
          }));
          sessions = [...mappedCloud, ...localOnly];
          if (sessions.length > 0 && !sessions.some(s => s.id === currentSessionId)) {
            currentSessionId = sessions[0].id;
          }
          renderSessionList();
          loadActiveSession();
          showMunnaToast("â˜ï¸ Cloud chats load ho gayi hain!");
        }
      } catch (err) {
        console.warn("Cloud load notice:", err);
      }
    }

    function getCurrentSession() {
      if (sessions.length === 0) {
        const id = "session_" + Date.now();
        const newSess = {
          id: id,
          title: "New Chat",
          timestamp: Date.now(),
          history: [{ role: "model", parts: [{ text: initialGreeting }] }],
          messages: [{ sender: "munna", text: initialGreeting }]
        };
        sessions.push(newSess);
        currentSessionId = id;
        saveSessions();
        return newSess;
      }
      let sess = sessions.find(s => s.id === currentSessionId);
      if (!sess) {
        sess = sessions[0];
        currentSessionId = sess.id;
        saveSessions();
      }
      if (!Array.isArray(sess.history)) sess.history = [{ role: "model", parts: [{ text: initialGreeting }] }];
      if (!Array.isArray(sess.messages)) sess.messages = [{ sender: "munna", text: initialGreeting }];
      return sess;
    }

    function updateQuotaUI() {
      const badge = document.getElementById("quotaBadge");
      if (!badge) return;
      const currentTier = (userData && userData.plan) ? userData.plan : (isVip ? "pro" : "free");
      if (currentTier === "king") {
        badge.textContent = "👑 King Unlimited";
        badge.classList.add("unlimited");
      } else if (currentTier === "pro" || isVip) {
        badge.textContent = "⚡ Pro Unlimited";
        badge.classList.add("unlimited");
      } else {
        badge.textContent = `${dailyQuota} Free Left`;
        badge.classList.remove("unlimited");
      }
    }

    function updateQrCode(amt = selectedAmount) {
      const img = document.getElementById("upiQrImg");
      const link = document.getElementById("payUpiLink");
      const upiStr = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=Munna%20Bhaiya%20AI&am=${amt}&cu=INR`;
      if (img) img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiStr)}`;
      if (link) link.href = upiStr;
    }

    function openNazranaModal() {
      updateQrCode(selectedAmount);
      const m = document.getElementById("nazranaModal");
      if (m) m.classList.add("show");
    }

    function closeNazranaModal() {
      const m = document.getElementById("nazranaModal");
      if (m) m.classList.remove("show");
    }

    // --- MULTI-TIER SUBSCRIPTION CONTROLLER (CHATGPT STYLE) ---
    let currentBillingCycle = "monthly"; // "monthly" | "annual"
    let selectedCheckoutTier = "pro"; // "pro" | "king"

    window.openVipModal = function() {
      const m = document.getElementById("vipModal");
      if (m) {
        if (typeof updateSubscriptionModalUI === "function") updateSubscriptionModalUI();
        m.classList.add("show");
      }
    };

    window.closeVipModal = function() {
      const m = document.getElementById("vipModal");
      if (m) m.classList.remove("show");
      const sheet = document.getElementById("planCheckoutSheet");
      if (sheet) sheet.classList.remove("active");
    };

    window.setBillingCycle = function(cycle) {
      currentBillingCycle = cycle;
      const mBtn = document.getElementById("billingCycleMonthlyBtn");
      const aBtn = document.getElementById("billingCycleAnnualBtn");
      const proPrice = document.getElementById("proPriceDisplay");
      const proPeriod = document.getElementById("proPeriodDisplay");
      const kingPrice = document.getElementById("kingPriceDisplay");
      const kingPeriod = document.getElementById("kingPeriodDisplay");

      if (cycle === "annual") {
        if (mBtn) mBtn.classList.remove("active");
        if (aBtn) aBtn.classList.add("active");
        if (proPrice) proPrice.textContent = "₹79";
        if (proPeriod) proPeriod.textContent = "/ mahina (Billed ₹948/yr)";
        if (kingPrice) kingPrice.textContent = "₹239";
        if (kingPeriod) kingPeriod.textContent = "/ mahina (Billed ₹2868/yr)";
      } else {
        if (mBtn) mBtn.classList.add("active");
        if (aBtn) aBtn.classList.remove("active");
        if (proPrice) proPrice.textContent = "₹99";
        if (proPeriod) proPeriod.textContent = "/ mahina";
        if (kingPrice) kingPrice.textContent = "₹299";
        if (kingPeriod) kingPeriod.textContent = "/ mahina";
      }
      updateCheckoutSheet();
    };

    window.selectPlanPayment = function(tier) {
      selectedCheckoutTier = tier;
      const sheet = document.getElementById("planCheckoutSheet");
      if (sheet) {
        sheet.classList.add("active");
        sheet.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      updateCheckoutSheet();
    };

    function updateCheckoutSheet() {
      const isAnnual = (currentBillingCycle === "annual");
      const isKing = (selectedCheckoutTier === "king");
      
      const amount = isKing ? (isAnnual ? 2868 : 299) : (isAnnual ? 948 : 99);
      const title = isKing ? 
        `Akhand Darbar King (${isAnnual ? '₹239/mo, Billed Annual ₹2868' : '₹299 / Mahina'})` : 
        `Bahubali Pro (${isAnnual ? '₹79/mo, Billed Annual ₹948' : '₹99 / Mahina'})`;

      const titleEl = document.getElementById("checkoutPlanTitle");
      const badgeEl = document.getElementById("checkoutAmountBadge");
      const qrImg = document.getElementById("planUpiQrImg");
      const link = document.getElementById("planPayDirectLink");
      const upiIdText = document.getElementById("checkoutUpiIdText");

      if (titleEl) titleEl.textContent = title;
      if (badgeEl) badgeEl.textContent = `₹${amount}`;
      if (upiIdText) upiIdText.textContent = currentUpiId;

      const upiStr = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=Munna%20AI%20Darbar&am=${amount}&cu=INR`;
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiStr)}`;
      }
      if (link) {
        link.href = upiStr;
      }
    }

    window.copyCheckoutUpi = function() {
      navigator.clipboard.writeText(currentUpiId).then(() => {
        showMunnaToast("UPI ID copy ho gaya: " + currentUpiId);
      }).catch(() => {
        showMunnaToast("UPI ID: " + currentUpiId);
      });
    };

    window.verifyAndActivatePlan = function() {
      const isKing = (selectedCheckoutTier === "king");
      const planName = isKing ? "king" : "pro";
      activatePlan(planName, false);
    };

    window.applyPlanPromoCode = function() {
      const input = document.getElementById("planPromoInput");
      if (!input) return;
      const code = input.value.trim().toUpperCase();
      if (code === "MIRZAPURKING" || code === "KINGDARBAR" || code === "GANGSTERKING") {
        activatePlan("king", true);
      } else if (code === "MUNNA99" || code === "BAHUBALI" || code === "MIRZAPUR") {
        activatePlan("pro", true);
      } else if (code === "BARFI50") {
        showMunnaToast("50% Discount Promo Lag Gaya! Pro Plan ab sirf ₹49 me!");
        const badgeEl = document.getElementById("checkoutAmountBadge");
        if (badgeEl) badgeEl.textContent = "₹49";
        const qrImg = document.getElementById("planUpiQrImg");
        const link = document.getElementById("planPayDirectLink");
        const upiStr = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=Munna%20AI%20Darbar&am=49&cu=INR`;
        if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiStr)}`;
        if (link) link.href = upiStr;
      } else {
        alert("Galat Promo Code be! Asli code daalo (MUNNA99 ya MIRZAPURKING) ya seedha UPI se unlock karo!");
      }
    };

    function updateSubscriptionModalUI() {
      const currentTier = (userData && userData.plan) ? userData.plan : (isVip ? "pro" : "free");
      const btnFree = document.getElementById("btnContainerFree");
      const btnPro = document.getElementById("btnContainerPro");
      const btnKing = document.getElementById("btnContainerKing");

      if (btnFree) {
        if (currentTier === "free") {
          btnFree.innerHTML = '<button type="button" class="plan-card-btn current-plan" disabled>Aapka Current Plan</button>';
        } else {
          btnFree.innerHTML = '<button type="button" class="plan-card-btn current-plan" style="opacity:0.6;" disabled>Basic Mehman Tier</button>';
        }
      }

      if (btnPro) {
        if (currentTier === "pro") {
          btnPro.innerHTML = '<button type="button" class="plan-card-btn active-plan" disabled><span class="material-symbols-outlined">check_circle</span> Active Pro Plan</button>';
        } else if (currentTier === "king") {
          btnPro.innerHTML = '<button type="button" class="plan-card-btn active-plan" style="opacity:0.85;" disabled><span class="material-symbols-outlined">check_circle</span> Included in King</button>';
        } else {
          btnPro.innerHTML = '<button type="button" class="plan-card-btn primary-gold" onclick="window.selectPlanPayment(\'pro\')"><span>Upgrade to Bahubali Pro</span><span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span></button>';
        }
      }

      if (btnKing) {
        if (currentTier === "king") {
          btnKing.innerHTML = '<button type="button" class="plan-card-btn active-plan" disabled><span class="material-symbols-outlined">workspace_premium</span> Active King Plan 👑</button>';
        } else {
          btnKing.innerHTML = '<button type="button" class="plan-card-btn primary-royal" onclick="window.selectPlanPayment(\'king\')"><span>Claim King\'s Seat</span><span class="material-symbols-outlined" style="font-size:16px;">crown</span></button>';
        }
      }
    }

    function activatePlan(planName, promo = false) {
      userData.plan = planName;
      isVip = (planName === "pro" || planName === "king");
      safeSet("munna_user_plan", planName);
      safeSet("munna_is_vip", isVip ? "true" : "false");

      updateQuotaUI();
      syncUserUI();
      closeVipModal();

      let msg = "";
      if (planName === "king") {
        msg = promo ?
          "👑 **PRABANDH HO GAYA!** Secret Code se Akhand Darbar King Tier unlock ho gaya hai! Ab aap King of Mirzapur ke barabar baith kar deep reasoning aur exclusive tools chalao!" :
          "👑 **MUBARAK HO KING!** Akhand Darbar VIP Tier activate ho chuka hai! Deep reasoning, priority servers, aur sarvashreshth aawaz sab aapka hai!";
      } else {
        msg = promo ?
          "⚡ **JALWA HAI HAMARA!** Secret Promo Code lag gaya aur Bahubali Pro activate ho gaya hai! Unlimited messages aur audio enable ho chuka hai!" :
          "⚡ **BAHUBALI PRO ACTIVATED!** Daily quota limit khatam ho gayi hai aur ultra-fast priority streaming enable ho gayi hai!";
      }

      renderMessage(msg, "munna");
      if (typeof playKattaAudio === "function") playKattaAudio("lock");
      showMunnaToast(planName === "king" ? "👑 Akhand Darbar King Active!" : "⚡ Bahubali Pro Active!");
    }

    function activateVip(promo = false) {
      activatePlan("pro", promo);
    }

    // --- 4. ATTACHMENT PROCESSING (IMAGES & FILES) ---
    function processImageFile(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1280;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const base64Clean = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
            resolve({
              name: file.name,
              size: Math.round(compressedDataUrl.length * 0.75),
              formattedSize: formatFileSize(Math.round(compressedDataUrl.length * 0.75)),
              isImage: true,
              mimeType: "image/jpeg",
              base64Data: base64Clean,
              dataUrl: compressedDataUrl
            });
          };
          img.onerror = () => {
            const rawBase64 = (e.target.result || "").split(",")[1] || "";
            resolve({
              name: file.name,
              size: file.size,
              formattedSize: formatFileSize(file.size),
              isImage: true,
              mimeType: file.type || "image/jpeg",
              base64Data: rawBase64,
              dataUrl: e.target.result
            });
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function processDocFile(file) {
      return new Promise((resolve) => {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const reader = new FileReader();
        if (isPdf) {
          reader.onload = (e) => {
            const rawBase64 = (e.target.result || "").split(",")[1] || "";
            resolve({
              name: file.name,
              size: file.size,
              formattedSize: formatFileSize(file.size),
              isImage: false,
              isPdf: true,
              mimeType: "application/pdf",
              base64Data: rawBase64,
              dataUrl: null
            });
          };
          reader.readAsDataURL(file);
        } else {
          reader.onload = (e) => {
            const textContent = e.target.result || "";
            resolve({
              name: file.name,
              size: file.size,
              formattedSize: formatFileSize(file.size),
              isImage: false,
              isPdf: false,
              textContent: textContent,
              dataUrl: null
            });
          };
          reader.readAsText(file);
        }
      });
    }

    async function handleIncomingFile(file) {
      if (!file) return;
      if (file.type.startsWith("image/")) {
        pendingAttachment = await processImageFile(file);
      } else {
        pendingAttachment = await processDocFile(file);
      }
      showAttachmentPreview(pendingAttachment);
      updateSendBtnState();
      const textarea = document.getElementById("userInput");
      if (textarea) textarea.focus();
    }

    function showAttachmentPreview(attachment) {
      const tray = document.getElementById("attachmentPreviewTray");
      const thumb = document.getElementById("previewThumbContainer");
      const nameEl = document.getElementById("previewFileName");
      const sizeEl = document.getElementById("previewFileSize");
      if (!tray || !thumb || !nameEl || !sizeEl) return;

      nameEl.textContent = attachment.name;
      sizeEl.textContent = attachment.formattedSize;

      if (attachment.isImage && attachment.dataUrl) {
        thumb.innerHTML = `<img src="${attachment.dataUrl}" alt="Preview" />`;
      } else {
        const icon = attachment.isPdf ? "ðŸ“„" : "ðŸ“œ";
        thumb.innerHTML = `<span class="file-icon">${icon}</span>`;
      }
      tray.style.display = "flex";
      updateSendBtnState();
    }

    function clearAttachment() {
      pendingAttachment = null;
      const tray = document.getElementById("attachmentPreviewTray");
      if (tray) tray.style.display = "none";
      const fileInput = document.getElementById("fileInput");
      if (fileInput) fileInput.value = "";
      updateSendBtnState();
    }

    function openLightbox(imgSrc) {
      const lightbox = document.getElementById("imageLightbox");
      const img = document.getElementById("lightboxImg");
      if (lightbox && img) {
        img.src = imgSrc;
        lightbox.classList.add("show");
      }
    }

    function closeLightbox() {
      const lightbox = document.getElementById("imageLightbox");
      if (lightbox) lightbox.classList.remove("show");
    }

    // --- 5. COMPOSER HELPERS (AUTO-RESIZE & SEND BUTTON STATE) ---
    function autoResizeTextarea() {
      const textarea = document.getElementById("userInput");
      if (!textarea) return;
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 160);
      textarea.style.height = newHeight + "px";
      textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
    }

    function updateSendBtnState() {
      const textarea = document.getElementById("userInput");
      const sendBtn = document.getElementById("sendBtn");
      if (!sendBtn) return;
      const hasText = textarea && textarea.value.trim().length > 0;
      const hasAttachment = Boolean(pendingAttachment);
      if (hasText || hasAttachment) {
        sendBtn.classList.remove("disabled");
      } else {
        sendBtn.classList.add("disabled");
      }
    }

    // --- 6. ADVANCED MARKDOWN PARSER (DOCUMENT-STYLE) ---
    window.copyCodeBlock = function(btn) {
      const wrapper = btn.closest('.code-block-wrapper');
      const codeEl = wrapper ? wrapper.querySelector('pre code') : null;
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.innerText).then(() => {
          const orig = btn.innerHTML;
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">check</span> Copied!';
          setTimeout(() => btn.innerHTML = orig, 1800);
        });
      }
    };
    window.copyCode = window.copyCodeBlock;

    function formatMunnaMarkdown(rawText, isStreaming = false) {
      if (!rawText) return isStreaming ? '<span class="streaming-cursor"></span>' : '';

      // 1. Protect code blocks
      const codeBlocks = [];
      let processed = rawText.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `%%%CODE_BLOCK_${codeBlocks.length}%%%`;
        const cleanLang = (lang || 'code').trim().toLowerCase();
        const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        codeBlocks.push(`
          <div class="code-block-wrapper">
            <div class="code-header">
              <span class="code-lang">${cleanLang}</span>
              <button type="button" class="copy-code-btn" onclick="copyCodeBlock(this)">ðŸ“‹ Copy</button>
            </div>
            <pre><code>${escapedCode.trim()}</code></pre>
          </div>
        `);
        return placeholder;
      });

      // 2. Escape HTML
      processed = processed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // 3. Inline code
      processed = processed.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

      // 4. Headings (###, ##, #)
      processed = processed.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
      processed = processed.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
      processed = processed.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

      // 5. Blockquotes (> quote)
      processed = processed.replace(/^\> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

      // 6. Bold & Italic
      processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      processed = processed.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');

      // 7. Links [text](url)
      processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

      // 8. Ordered & Unordered Lists
      const lines = processed.split("\n");
      let inUl = false;
      let inOl = false;
      const parsedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isUlItem = /^(\*|-)\s+(.+)/.test(line);
        const isOlItem = /^(\d+)\.\s+(.+)/.test(line);

        if (isUlItem) {
          if (!inUl) {
            if (inOl) { parsedLines.push("</ol>"); inOl = false; }
            parsedLines.push('<ul class="md-ul">');
            inUl = true;
          }
          parsedLines.push(line.replace(/^(\*|-)\s+(.+)/, '<li class="md-li">$2</li>'));
        } else if (isOlItem) {
          if (!inOl) {
            if (inUl) { parsedLines.push("</ul>"); inUl = false; }
            parsedLines.push('<ol class="md-ol">');
            inOl = true;
          }
          parsedLines.push(line.replace(/^(\d+)\.\s+(.+)/, '<li class="md-li">$2</li>'));
        } else {
          if (inUl) { parsedLines.push("</ul>"); inUl = false; }
          if (inOl) { parsedLines.push("</ol>"); inOl = false; }
          parsedLines.push(line);
        }
      }
      if (inUl) parsedLines.push("</ul>");
      if (inOl) parsedLines.push("</ol>");

      let htmlResult = parsedLines.join("\n");

      // 9. Paragraphs (split on double newlines)
      const blockRegex = /<\/?(h[1-3]|ul|ol|li|blockquote|div|pre)[\s>]/;
      const rawParagraphs = htmlResult.split(/\n\s*\n/);
      htmlResult = rawParagraphs.map(p => {
        const trimmed = p.trim();
        if (!trimmed) return "";
        if (blockRegex.test(trimmed) || trimmed.startsWith("%%%CODE_BLOCK_")) {
          return trimmed.replace(/\n/g, "<br>");
        }
        return `<p class="md-p">${trimmed.replace(/\n/g, "<br>")}</p>`;
      }).join("\n");

      // 10. Restore code blocks
      codeBlocks.forEach((block, idx) => {
        htmlResult = htmlResult.replace(`%%%CODE_BLOCK_${idx}%%%`, block);
      });

      if (isStreaming) {
        htmlResult += '<span class="streaming-cursor"></span>';
      } else {
        if (rawText.includes("TARGET DIAGNOSIS") || rawText.includes("PURVANCHAL GANGSTER RATING") || rawText.includes("KATTA VISION")) {
          htmlResult += `
            <div class="katta-download-card-wrapper" style="margin-top:14px;">
              <button type="button" class="katta-download-card-btn" onclick="downloadGangsterReportCard(this)">
                <span class="material-symbols-outlined" style="font-size:18px; vertical-align:middle; margin-right:6px;">download</span><span>Download Official Gangster Report Card</span>
              </button>
            </div>
          `;
        }
      }

      return htmlResult;
    }

    function parseMarkdown(text, isStreaming = false) {
      return formatMunnaMarkdown(text, isStreaming);
    }

    // --- 7. MESSAGE BUBBLES & AUDIO ENGINE (WEB AUDIO + ELEVENLABS) ---
    let activeVoiceBtn = null;
    let currentAudioPlayback = null;
    let currentAudioSource = null;
    let sharedAudioCtx = null;

    function stopAllSpeech() {
      if (currentAudioPlayback) {
        try { currentAudioPlayback.pause(); } catch(e){}
        currentAudioPlayback = null;
      }
      if (currentAudioSource) {
        try { currentAudioSource.stop(); } catch(e){}
        currentAudioSource = null;
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (activeVoiceBtn) {
        activeVoiceBtn.classList.remove("active-voice", "loading-voice");
        activeVoiceBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        activeVoiceBtn = null;
      }
      const testBtn = document.getElementById("testVoiceBtn");
      if (testBtn) {
        testBtn.classList.remove("playing");
        testBtn.innerHTML = '<span>â–¶ï¸</span> Test Human Voice';
      }
    }

    const CARTESIA_VOICE_ID = "bdab08ad-4137-4548-b9db-6142854c7525";
    const ELEVEN_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Flagship Adam - Deep, commanding, masculine

    async function speakText(text, btn = null) {
      // If clicked on currently active playing button, stop playback
      if (btn && activeVoiceBtn === btn) {
        stopAllSpeech();
        return;
      }

      stopAllSpeech();

      // Clean text for speech: remove code snippets, markdown syntax, raw links
      const clean = text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[*#_~>]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .trim();

      if (!clean) return;

      if (btn) {
        btn.classList.add("loading-voice");
        btn.innerHTML = '<span class="act-icon">â³</span>';
        btn.title = "Aawaz ban rahi hai...";
        activeVoiceBtn = btn;
      }

      try {
        // Limit to 500 characters for instant low-latency playback
        const snippet = clean.length > 500 ? clean.substring(0, 500) + "..." : clean;

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: snippet,
            voiceId: CARTESIA_VOICE_ID
          })
        });

        if (!response.ok) {
          throw new Error(`Voice synthesis error: ${response.status}`);
        }

        const arrayBuf = await response.arrayBuffer();

        // 1. Play using Web Audio API (native buffer decoding in browser memory)
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
          if (sharedAudioCtx.state === "suspended") await sharedAudioCtx.resume();

          const audioBuf = await sharedAudioCtx.decodeAudioData(arrayBuf.slice(0));
          const source = sharedAudioCtx.createBufferSource();
          source.buffer = audioBuf;
          const speed = (typeof userData !== "undefined" && userData && userData.voiceSpeed) ? Number(userData.voiceSpeed) : 1.0;
          source.playbackRate.value = speed;
          source.connect(sharedAudioCtx.destination);
          currentAudioSource = source;

          if (btn) {
            btn.classList.remove("loading-voice");
            btn.classList.add("active-voice");
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; color:var(--emerald);">stop_circle</span>';
            btn.title = "Aawaz chal rahi hai (Rokne ke liye click karein)";
          }

          source.onended = () => {
            if (btn) {
              btn.classList.remove("active-voice", "loading-voice");
              btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
              btn.title = "Sunno (Cartesia Real-Time Voice)";
            }
            if (activeVoiceBtn === btn) activeVoiceBtn = null;
            currentAudioSource = null;
            const testBtn = document.getElementById("testVoiceBtn");
            if (testBtn) {
              testBtn.classList.remove("playing");
              testBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">play_arrow</span> Test Human Voice';
            }
          };

          source.start(0);
          return;
        } catch (webAudioErr) {
          console.warn("WebAudio fallback to HTML5 Audio:", webAudioErr);
          const blob = new Blob([arrayBuf], { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          const speed = (typeof userData !== "undefined" && userData && userData.voiceSpeed) ? Number(userData.voiceSpeed) : 1.0;
          audio.playbackRate = speed;
          currentAudioPlayback = audio;

          if (btn) {
            btn.classList.remove("loading-voice");
            btn.classList.add("active-voice");
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; color:var(--emerald);">stop_circle</span>';
            btn.title = "Aawaz chal rahi hai (Rokne ke liye click karein)";
          }

          audio.onended = () => {
            if (btn) {
              btn.classList.remove("active-voice", "loading-voice");
              btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
              btn.title = "Sunno (Cartesia Real-Time Voice)";
            }
            if (activeVoiceBtn === btn) activeVoiceBtn = null;
            currentAudioPlayback = null;
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.error("Cartesia/ElevenLabs playback error:", err);
        showMunnaToast("Aawaz load nahi hui, network check karein.");
        if (btn) {
          btn.classList.remove("loading-voice", "active-voice");
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        }
        if (activeVoiceBtn === btn) activeVoiceBtn = null;
      }
    }

    function createMessageElement(sender = "user") {
      const chatMessages = document.getElementById("chatMessages");
      const hero = document.getElementById("welcomeHero");
      if (hero) hero.remove();
      const msgDiv = document.createElement("div");

      if (sender === "munna") {
        msgDiv.className = "msg munna executive-style";

        // AI Header (Executive Neurology Icon, Munna AI, Ultra v4.5 Badge, Timestamp)
        const header = document.createElement("div");
        header.className = "ai-header";
        header.innerHTML = `
          <div class="ai-avatar"><span class="material-symbols-outlined" style="font-size:18px; color:var(--gold-primary);">neurology</span></div>
          <div class="ai-identity">
            <span class="ai-name font-headline">Munna AI</span>
            <span class="spec-badge spec-badge-gold">Munna Ultra v4.5</span>
            <span class="ai-time-stamp">${getTime()}</span>
          </div>
        `;

        // Clean Document Body (NO card border, NO white rectangular card, NO heavy background)
        const contentBody = document.createElement("div");
        contentBody.className = "ai-content-body";

        // Subtle Icon-Only Actions Bar
        const actionsBar = document.createElement("div");
        actionsBar.className = "ai-actions-bar";

        // 1. Copy
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "ai-icon-btn btn-copy-ai";
        copyBtn.title = "Copy response";
        copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(contentBody.innerText).then(() => {
            copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; color:var(--emerald);">check</span>';
            setTimeout(() => {
              copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>';
            }, 1800);
          });
        };
        actionsBar.appendChild(copyBtn);

        // 2. Voice (Sunno)
        const voiceBtn = document.createElement("button");
        voiceBtn.type = "button";
        voiceBtn.className = "ai-icon-btn btn-voice-ai";
        voiceBtn.title = "Sunno (Cartesia Real-Time Voice)";
        voiceBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        voiceBtn.onclick = () => {
          speakText(contentBody.innerText, voiceBtn);
        };
        actionsBar.appendChild(voiceBtn);

        // 3. Regenerate
        const regenBtn = document.createElement("button");
        regenBtn.type = "button";
        regenBtn.className = "ai-icon-btn btn-regen-ai";
        regenBtn.title = "Dobara generate karein";
        regenBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">refresh</span>';
        regenBtn.onclick = () => handleRegenerate(msgDiv);
        actionsBar.appendChild(regenBtn);

        // 4. Like (Thumbs Up)
        const likeBtn = document.createElement("button");
        likeBtn.type = "button";
        likeBtn.className = "ai-icon-btn btn-like-ai";
        likeBtn.title = "Acha laga (Jalwa!)";
        likeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">thumb_up</span>';
        likeBtn.onclick = () => {
          likeBtn.classList.toggle("active");
          if (dislikeBtn) dislikeBtn.classList.remove("active");
        };
        actionsBar.appendChild(likeBtn);

        // 5. Dislike (Thumbs Down)
        const dislikeBtn = document.createElement("button");
        dislikeBtn.type = "button";
        dislikeBtn.className = "ai-icon-btn btn-dislike-ai";
        dislikeBtn.title = "Kharab laga";
        dislikeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">thumb_down</span>';
        dislikeBtn.onclick = () => {
          dislikeBtn.classList.toggle("active");
          if (likeBtn) likeBtn.classList.remove("active");
        };
        actionsBar.appendChild(dislikeBtn);

        // 6. More Options (...)
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "ai-icon-btn btn-more-ai";
        moreBtn.title = "More options";
        moreBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">more_horiz</span>';
        moreBtn.onclick = () => {
          navigator.clipboard.writeText(contentBody.innerText);
          alert("Munna Bhaiya ka jawab clipboard par copy ho gaya!");
        };
        actionsBar.appendChild(moreBtn);

        // Timestamp
        const timeSpan = document.createElement("span");
        timeSpan.className = "ai-time-stamp";
        timeSpan.innerText = getTime();
        actionsBar.appendChild(timeSpan);

        msgDiv.appendChild(header);
        msgDiv.appendChild(contentBody);
        msgDiv.appendChild(actionsBar);

        if (chatMessages) {
          chatMessages.appendChild(msgDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        return { msgDiv, bubble: contentBody };
      } else {
        // User message (Executive gold ambient bubble with user avatar)
        msgDiv.className = "msg user";

        const userHeader = document.createElement("div");
        userHeader.className = "user-header";
        userHeader.innerHTML = `
          <span class="user-time">${getTime()}</span>
          <span class="user-name font-headline">${escapeHTML(userData?.name || "Abhishek (Boss)")}</span>
        `;

        const userWrap = document.createElement("div");
        userWrap.className = "user-msg-wrap";

        const bubble = document.createElement("div");
        bubble.className = "bubble";

        const avatar = document.createElement("div");
        avatar.className = "user-avatar-box";
        avatar.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">person</span>`;

        userWrap.appendChild(bubble);
        userWrap.appendChild(avatar);

        msgDiv.appendChild(userHeader);
        msgDiv.appendChild(userWrap);

        if (chatMessages) {
          chatMessages.appendChild(msgDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        return { msgDiv, bubble };
      }
    }

    function renderMessage(text, sender = "user", attachment = null) {
      const { bubble } = createMessageElement(sender);

      if (attachment) {
        if (attachment.isImage && attachment.dataUrl) {
          const imgEl = document.createElement("img");
          imgEl.className = "msg-attachment-img";
          imgEl.src = attachment.dataUrl;
          imgEl.alt = attachment.name || "Uploaded image";
          imgEl.onclick = () => openLightbox(attachment.dataUrl);
          bubble.appendChild(imgEl);
        } else if (attachment.name) {
          const fileBadge = document.createElement("div");
          fileBadge.className = "msg-attachment-file";
          const icon = attachment.isPdf ? "ðŸ“„" : "ðŸ“œ";
          fileBadge.innerHTML = `<span>${icon}</span> <span>${escapeHTML(attachment.name)}</span> <small>(${attachment.formattedSize || ''})</small>`;
          bubble.appendChild(fileBadge);
        }
      }

      if (sender === "munna") {
        bubble.innerHTML = formatMunnaMarkdown(text, false);
      } else {
        if (text) {
          const textContainer = document.createElement("div");
          textContainer.innerText = text;
          bubble.appendChild(textContainer);
        }
      }
    }

    function showTyping() {
      const chatMessages = document.getElementById("chatMessages");
      if (!chatMessages) return;
      const typingDiv = document.createElement("div");
      typingDiv.id = "typingIndicator";
      typingDiv.className = "msg munna document-style";
      typingDiv.innerHTML = `
        <div class="ai-header">
          <div class="ai-avatar">ðŸ‘</div>
          <div class="ai-identity">
            <span class="ai-name">Munna AI</span>
            <span class="ai-status">Dimaag chala rahe hain...</span>
          </div>
        </div>
        <div class="ai-content-body">
          <span class="streaming-cursor"></span>
        </div>
      `;
      chatMessages.appendChild(typingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
      const el = document.getElementById("typingIndicator");
      if (el) el.remove();
    }

    // --- 8. SESSIONS MANAGEMENT ---
    function renderSessionList() {
      const list = document.getElementById("historyList");
      if (!list) return;
      list.innerHTML = "";
      sessions.forEach(sess => {
        const li = document.createElement("li");
        li.className = `history-item ${sess.id === currentSessionId ? 'active' : ''}`;
        li.innerHTML = `
          <span class="history-title" title="${escapeHTML(sess.title)}">ðŸ’¬ ${escapeHTML(sess.title)}</span>
          <button class="history-delete-btn" title="Delete">âœ•</button>
        `;
        li.onclick = (e) => {
          if (e.target.classList.contains("history-delete-btn")) return;
          currentSessionId = sess.id;
          saveSessions();
          renderSessionList();
          loadActiveSession();
          closeSidebarDrawer();
        };
        const delBtn = li.querySelector(".history-delete-btn");
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteSession(sess.id);
        };
        list.appendChild(li);
      });
    }

    function deleteSession(id) {
      sessions = sessions.filter(s => s.id !== id);
      if (currentSessionId === id) {
        if (sessions.length > 0) currentSessionId = sessions[0].id;
        else { createNewSession(); return; }
      }
      saveSessions();
      renderSessionList();
      loadActiveSession();
    }

    function createNewSession() {
      const id = "session_" + Date.now();
      const newSess = {
        id: id,
        title: "New Chat",
        timestamp: Date.now(),
        history: [{ role: "model", parts: [{ text: initialGreeting }] }],
        messages: [{ sender: "munna", text: initialGreeting }]
      };
      sessions.unshift(newSess);
      currentSessionId = id;
      saveSessions();
      renderSessionList();
      loadActiveSession();
      closeSidebarDrawer();
    }

    function renderWelcomeHero() {
      const chatMessages = document.getElementById("chatMessages");
      if (!chatMessages) return;
      const existingHero = document.getElementById("welcomeHero");
      if (existingHero) existingHero.remove();

      const hero = document.createElement("div");
      hero.className = "welcome-hero";
      hero.id = "welcomeHero";
      hero.innerHTML = `
        <div class="welcome-crest">
          <span class="material-symbols-outlined crown-icon">workspace_premium</span>
        </div>
        <div class="welcome-badge-line">
          <span class="material-symbols-outlined" style="font-size:14px;">bolt</span>
          <span>Munna AI &bull; King of AI Models</span>
        </div>
        <h1 class="welcome-title font-headline">
          Your AI. <span class="gold-accent">Your Rules.</span> Your King.
        </h1>
        <p class="welcome-subtitle">
          Obsidian executive intelligence powered by Gemini 3.6 Flash. State your intent, synthesize global data, execute code, or build visionary systems.
        </p>

        <!-- 4 Royal Feature Cards -->
        <div class="hero-feature-cards">
          <div class="feature-card-royal" id="featureCardChat">
            <div class="feature-card-header">
              <div class="feature-card-icon">
                <span class="material-symbols-outlined" style="font-size:20px;">chat</span>
              </div>
              <span class="feature-card-badge">Gemini 3.6</span>
            </div>
            <div class="feature-card-title">Intelligent Chat</div>
            <div class="feature-card-desc">Deep context, unfiltered reasoning & executive decision making.</div>
          </div>

          <div class="feature-card-royal" id="featureCardVision">
            <div class="feature-card-header">
              <div class="feature-card-icon" style="color:var(--crimson); background:rgba(248,113,113,0.1);">
                <span class="material-symbols-outlined" style="font-size:20px;">visibility</span>
              </div>
              <span class="feature-card-badge">Multimodal</span>
            </div>
            <div class="feature-card-title">Katta Vision</div>
            <div class="feature-card-desc">Optical document scan, perimeter analysis & multi-modal inspection.</div>
          </div>

          <div class="feature-card-royal" id="featureCardVoice">
            <div class="feature-card-header">
              <div class="feature-card-icon" style="color:var(--emerald); background:rgba(52,211,153,0.1);">
                <span class="material-symbols-outlined" style="font-size:20px;">record_voice_over</span>
              </div>
              <span class="feature-card-badge">Adam HD</span>
            </div>
            <div class="feature-card-title">Voice Studio</div>
            <div class="feature-card-desc">Ultra-low latency ElevenLabs studio audio streaming in Hinglish/Hindi.</div>
          </div>

          <div class="feature-card-royal" id="featureCardCode">
            <div class="feature-card-header">
              <div class="feature-card-icon" style="color:#60a5fa; background:rgba(96,165,250,0.1);">
                <span class="material-symbols-outlined" style="font-size:20px;">terminal</span>
              </div>
              <span class="feature-card-badge">Synthesizer</span>
            </div>
            <div class="feature-card-title">Code Assistant</div>
            <div class="feature-card-desc">Write, review, optimize & execute full-stack architecture & scripts.</div>
          </div>
        </div>

        <!-- Quick Prompts Bar -->
        <div class="hero-quick-prompts">
          <button type="button" class="quick-prompt-chip" id="quickPromptVision">
            <span class="material-symbols-outlined" style="font-size:16px; color:var(--crimson);">image_search</span>
            <span>Explain this image</span>
          </button>
          <button type="button" class="quick-prompt-chip" id="quickPromptCode">
            <span class="material-symbols-outlined" style="font-size:16px; color:var(--emerald);">code</span>
            <span>Write a Python script for real-time market data</span>
          </button>
          <button type="button" class="quick-prompt-chip" id="quickPromptPdf">
            <span class="material-symbols-outlined" style="font-size:16px; color:var(--gold-primary);">description</span>
            <span>Summarize quarterly business performance</span>
          </button>
          <button type="button" class="quick-prompt-chip" id="quickPromptIdeas">
            <span class="material-symbols-outlined" style="font-size:16px; color:#60a5fa;">lightbulb</span>
            <span>Brainstorm high-margin tech startup ideas</span>
          </button>
        </div>
      `;

      // Wire feature card events
      hero.querySelector("#featureCardChat").onclick = () => {
        const input = document.getElementById("userInput");
        if (input) { input.focus(); input.placeholder = "Bolo be! Kya soch rahe ho..."; }
      };
      hero.querySelector("#featureCardVision").onclick = () => {
        if (typeof window.openKattaVisionModal === "function") window.openKattaVisionModal();
      };
      hero.querySelector("#featureCardVoice").onclick = () => {
        window.openVoiceSettings();
      };
      hero.querySelector("#featureCardCode").onclick = () => {
        window.injectStarterPrompt("Ek robust, production-grade Python script likho jo live financial and market data fetch kare.");
      };

      // Wire quick prompts
      hero.querySelector("#quickPromptVision").onclick = () => {
        if (typeof window.openKattaVisionModal === "function") window.openKattaVisionModal();
      };
      hero.querySelector("#quickPromptCode").onclick = () => {
        window.injectStarterPrompt("Ek robust, production-grade Python script likho jo live financial and market data fetch kare.");
      };
      hero.querySelector("#quickPromptPdf").onclick = () => {
        window.injectStarterPrompt("Quarterly business performance and unit economics ka strategic executive summary ready karo.");
      };
      hero.querySelector("#quickPromptIdeas").onclick = () => {
        window.injectStarterPrompt("India aur global market ke liye top 5 high-margin profitable AI-first startup ideas share karo.");
      };

      chatMessages.appendChild(hero);
    }

    function loadActiveSession() {
      if (currentAudioPlayback) {
        currentAudioPlayback.pause();
        currentAudioPlayback.currentTime = 0;
        currentAudioPlayback = null;
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (activeVoiceBtn) {
        activeVoiceBtn.classList.remove("active-voice", "loading-voice");
        activeVoiceBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        activeVoiceBtn = null;
      }
      const chatMessages = document.getElementById("chatMessages");
      const titleSpan = document.getElementById("sessionTitleText");
      if (!chatMessages) return;
      chatMessages.innerHTML = "";
      const session = getCurrentSession();
      if (titleSpan && session) {
        titleSpan.textContent = session.title || "Mirzapur Ops Strategy";
      }
      if (!session) return;
      const hasUserMessages = Array.isArray(session.messages) && session.messages.some(m => m && m.sender === "user");
      if (!hasUserMessages) {
        renderWelcomeHero();
      } else {
        session.messages.forEach(msg => {
          if (msg) renderMessage(msg.text || "", msg.sender || "munna", msg.attachment || null);
        });
      }
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function toggleSidebarDrawer() {
      const chatSidebar = document.getElementById("chatSidebar");
      const backdrop = document.getElementById("sidebarBackdrop");
      if (!chatSidebar) return;
      if (window.innerWidth <= 768) {
        chatSidebar.classList.toggle("open");
        if (backdrop) backdrop.classList.toggle("show");
      } else {
        chatSidebar.classList.toggle("collapsed");
      }
    }

    function closeSidebarDrawer() {
      const chatSidebar = document.getElementById("chatSidebar");
      const backdrop = document.getElementById("sidebarBackdrop");
      if (chatSidebar) chatSidebar.classList.remove("open");
      if (backdrop) backdrop.classList.remove("show");
    }

    // --- 9. GEMINI MULTIMODAL STREAMING API ---
    async function streamMunnaReply(userMessage, bubbleElement, attachment = null) {
      const chatMessages = document.getElementById("chatMessages");
      const session = getCurrentSession();

      const userParts = [];
      if (attachment) {
        if (attachment.isImage && attachment.base64Data) {
          if (userMessage) userParts.push({ text: userMessage });
          else userParts.push({ text: "Arey Munna Bhaiya, ye photo dekho aur batao isme kya hai, aur meri problem solve karo!" });
          userParts.push({
            inline_data: {
              mime_type: attachment.mimeType || "image/jpeg",
              data: attachment.base64Data
            }
          });
        } else if (attachment.isPdf && attachment.base64Data) {
          if (userMessage) userParts.push({ text: userMessage });
          else userParts.push({ text: "Munna Bhaiya, ye PDF document dekho aur analyze karke samjhao!" });
          userParts.push({
            inline_data: {
              mime_type: "application/pdf",
              data: attachment.base64Data
            }
          });
        } else if (attachment.textContent) {
          const docPrompt = `[Attached Document: ${attachment.name}]\n\`\`\`\n${attachment.textContent.slice(0, 20000)}\n\`\`\`\n\n${userMessage || "Munna Bhaiya, ye code/text file dekho aur iska solution do!"}`;
          userParts.push({ text: docPrompt });
        } else {
          userParts.push({ text: userMessage || "Munna Bhaiya, meri help karo!" });
        }
      } else {
        userParts.push({ text: userMessage });
      }

      session.history.push({ role: "user", parts: userParts });

      // Lightweight history payload for instant response (prevents slow multi-turn latency)
      const recentHistory = (session.history || []).slice(-10).map((turn, index, arr) => {
        if (index === arr.length - 1) return turn;
        if (turn.parts) {
          return {
            role: turn.role,
            parts: turn.parts.map(p => {
              if (p.inline_data) return { text: "[Attached File/Photo]" };
              return p;
            })
          };
        }
        return turn;
      });

      const payload = {
        system_instruction: { parts: [{ text: getSystemPrompt() }] },
        contents: recentHistory,
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1200
        }
      };

      let fullIncomingText = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: activeModel,
            payload: payload,
            sse: false
          })
        });

        if (res.ok) {
          const data = await res.json();
          fullIncomingText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
          throw new Error(`Server status ${res.status}`);
        }
      } catch (err) {
        console.warn("Primary API route unavailable, invoking direct Google Gemini fallback...", err);
        // Direct browser fallback directly to Google Gemini API
        try {
          const directKey = atob('QVEuQWI4Uk42TERYWVBlOE9wRk5kRlpyUTItbTF6RHctMGV1RGhDU0JkcDN1Zkd1OGsxRmc=');
          const directRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${directKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (directRes.ok) {
            const directData = await directRes.json();
            fullIncomingText = directData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            const backupKey = atob('QVEuQWI4Uk42SKSySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE=');
            const directRes2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${backupKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (directRes2.ok) {
              const directData2 = await directRes2.json();
              fullIncomingText = directData2.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }
          }
        } catch (directErr) {
          console.error("Direct fallback error:", directErr);
        }

        if (!fullIncomingText.trim()) {
          fullIncomingText = "Abe thoda network mein lafda chal raha hai! Ek baar dobara enter dabao, abhi turant bata dete hain.";
        }
      }

      if (!fullIncomingText.trim()) {
        fullIncomingText = "Abe thoda network mein lafda chal raha hai! Ek baar dobara enter dabao, abhi turant bata dete hain.";
      }
      // Smooth fluid typewriter animation for the real Google Gemini AI response
      let displayedLength = 0;
      let animResolve;
      const animFinishedPromise = new Promise(r => { animResolve = r; });

      const typewriterTick = () => {
        if (displayedLength < fullIncomingText.length) {
          const backlog = fullIncomingText.length - displayedLength;
          const step = backlog > 80 ? 6 : (backlog > 30 ? 3 : (backlog > 10 ? 2 : 1));
          displayedLength = Math.min(displayedLength + step, fullIncomingText.length);

          const currentSlice = fullIncomingText.slice(0, displayedLength);
          bubbleElement.innerHTML = formatMunnaMarkdown(currentSlice, true);
          if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

          setTimeout(typewriterTick, 16);
        } else {
          bubbleElement.innerHTML = formatMunnaMarkdown(fullIncomingText, false);
          if ((attachment && attachment.isKattaVision) || fullIncomingText.includes("TARGET DIAGNOSIS") || fullIncomingText.includes("GANGSTER RATING")) {
            bubbleElement.classList.add("katta-report-card");
          }
          if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
          if (animResolve) animResolve();
        }
      };

      typewriterTick();
      await animFinishedPromise;

      session.history.push({ role: "model", parts: [{ text: fullIncomingText }] });
      session.messages.push({ sender: "munna", text: fullIncomingText });
      saveSessions();

      // Automatically speak only if explicitly enabled by user
      if (userData && userData.autoSpeak === true) {
        setTimeout(() => {
          const parentMsg = bubbleElement.closest(".msg.munna");
          const voiceBtn = parentMsg ? parentMsg.querySelector(".btn-voice-ai") : null;
          speakText(fullIncomingText, voiceBtn);
        }, 150);
      }

      return fullIncomingText;
    }

    async function handleRegenerate(targetMsgDiv) {
      if (isSending) return;
      const session = getCurrentSession();
      if (!session || !session.messages || session.messages.length < 2) return;
      const lastUser = [...session.messages].reverse().find(m => m.sender === "user");
      if (!lastUser) return;

      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (currentAudioPlayback) {
        currentAudioPlayback.pause();
        currentAudioPlayback.currentTime = 0;
        currentAudioPlayback = null;
      }
      if (activeVoiceBtn) {
        activeVoiceBtn.classList.remove("active-voice", "loading-voice");
        activeVoiceBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        activeVoiceBtn = null;
      }
      targetMsgDiv.remove();

      if (session.messages[session.messages.length - 1].sender === "munna") session.messages.pop();
      if (session.history[session.history.length - 1].role === "model") session.history.pop();
      saveSessions();

      isSending = true;
      showTyping();
      let bubbleElem = null;
      try {
        hideTyping();
        const msgObj = createMessageElement("munna");
        bubbleElem = msgObj.bubble;
        bubbleElem.innerHTML = `<span class="streaming-cursor"></span>`;
        await streamMunnaReply(lastUser.text, bubbleElem, lastUser.attachment || null);
      } catch (e) {
        console.warn("Regenerate failed:", e);
        hideTyping();
        if (bubbleElem && bubbleElem.textContent.trim().length > 10) {
          // Response already received from AI, do not overwrite
        } else {
          const fallback = getAIErrorMessage(e);
          if (bubbleElem) {
            bubbleElem.innerHTML = formatMunnaMarkdown(fallback, false);
          } else {
            renderMessage(fallback, "munna");
          }
          session.messages.push({ sender: "munna", text: fallback });
          saveSessions();
        }
      } finally {
        isSending = false;
      }
    }

    // --- 10. GLOBAL SEND HANDLER ---
    window.handleSend = async function() {
      const textarea = document.getElementById("userInput");
      const sendBtn = document.getElementById("sendBtn");
      if (!textarea) return;
      const text = textarea.value.trim();
      const currentAttachment = pendingAttachment;

      if (!text && !currentAttachment) {
        textarea.focus();
        const card = document.getElementById("composerCard");
        if (card) {
          card.classList.add("input-shake");
          setTimeout(() => card.classList.remove("input-shake"), 400);
        }
        return;
      }

      if (isSending) return;

      if (currentAudioPlayback) {
        currentAudioPlayback.pause();
        currentAudioPlayback.currentTime = 0;
        currentAudioPlayback = null;
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (activeVoiceBtn) {
        activeVoiceBtn.classList.remove("active-voice", "loading-voice");
        activeVoiceBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>';
        activeVoiceBtn = null;
      }

      // Check Quota
      if (!isVip && dailyQuota <= 0) {
        renderMessage(text || (currentAttachment ? `[Uploaded: ${currentAttachment.name}]` : ""), "user", currentAttachment);
        textarea.value = "";
        autoResizeTextarea();
        clearAttachment();
        const quotaMsg = "Abe sunno be! Aaj ka muft ka quota khatam ho gaya tumhara! Muft ki rotiyan kab tak todega? Ya toh kal aao, ya Bahubali VIP Pass leke bina rok-tok unlimited baat karo!";
        setTimeout(() => {
          renderMessage(quotaMsg, "munna");
          openVipModal();
        }, 400);
        return;
      }

      if (!isVip) {
        dailyQuota--;
        safeSet("munna_daily_quota", dailyQuota.toString());
        updateQuotaUI();
      }

      // Auto-detect image generation request
      const isImageRequest = !currentAttachment && (
        text.startsWith("/image ") ||
        text.startsWith("/photo ") ||
        text.toLowerCase().startsWith("photo banao:") ||
        text.toLowerCase().startsWith("image banao:") ||
        /(photo|image|tasveer|picture|drawing)\s+(banao|generate|create|karo|bana|dikhao)/i.test(text) ||
        /(generate|create|draw)\s+(an?\s+)?(image|photo|picture|wallpaper)/i.test(text)
      );

      if (isImageRequest) {
        let cleanPrompt = text
          .replace(/^\/(image|photo)\s+/i, "")
          .replace(/^(photo|image)\s+banao:\s*/i, "")
          .replace(/^(munna bhaiya|bhaiya|munna|ai|hey)\s*,?\s*/i, "")
          .replace(/(ek\s+)?(photo|image|tasveer|picture)\s+(banao|generate karo|generate|dikhao|karo)/i, "")
          .trim();
        if (!cleanPrompt) cleanPrompt = text;

        textarea.value = "";
        autoResizeTextarea();
        clearAttachment();

        generateAIImage(cleanPrompt, currentImageGenStyle || "mirzapur");
        return;
      }

      // Immediately clear textarea & attachment
      textarea.value = "";
      autoResizeTextarea();
      clearAttachment();

      // Render user message with attachment
      renderMessage(text, "user", currentAttachment);

      const session = getCurrentSession();
      session.messages.push({
        sender: "user",
        text: text,
        attachment: currentAttachment ? {
          name: currentAttachment.name,
          formattedSize: currentAttachment.formattedSize,
          isImage: currentAttachment.isImage,
          isPdf: currentAttachment.isPdf,
          dataUrl: currentAttachment.dataUrl
        } : null
      });

      const sessionDisplayTitle = text || (currentAttachment ? `ðŸ“Ž ${currentAttachment.name}` : "New Chat");
      if (session.messages.length <= 2 || session.title === "Nayi Baatcheet" || session.title === "New Chat") {
        session.title = sessionDisplayTitle.length > 24 ? sessionDisplayTitle.substring(0, 24) + "..." : sessionDisplayTitle;
        renderSessionList();
        const titleSpan = document.getElementById("sessionTitleText");
        if (titleSpan) titleSpan.textContent = session.title;
      }
      saveSessions();

      isSending = true;
      showTyping();

      // Update Send Button to Loading State
      if (sendBtn) {
        sendBtn.classList.add("loading");
        sendBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span>';
      }

      let bubbleElem = null;
      try {
        hideTyping();
        const msgObj = createMessageElement("munna");
        bubbleElem = msgObj.bubble;
        bubbleElem.innerHTML = `<span class="streaming-cursor"></span>`;
        await streamMunnaReply(text, bubbleElem, currentAttachment);
      } catch (err) {
        console.warn("AI streaming failed, using fallback:", err);
        hideTyping();
        if (bubbleElem && bubbleElem.textContent.trim().length > 10) {
          // Response already received from AI, do not overwrite
        } else {
          const fallback = getAIErrorMessage(err);
          if (bubbleElem) {
            bubbleElem.innerHTML = formatMunnaMarkdown(fallback, false);
          } else {
            renderMessage(fallback, "munna");
          }
          session.messages.push({ sender: "munna", text: fallback });
          saveSessions();
        }
      } finally {
        isSending = false;
        if (sendBtn) {
          sendBtn.classList.remove("loading");
          sendBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">arrow_upward</span>';
        }
        updateSendBtnState();
        const currentInput = document.getElementById("userInput");
        if (currentInput) currentInput.focus();
      }
    };

    // --- 11. APP INITIALIZATION ---
    function initApp() {
      // 1. Textarea Auto-Resize & Event Handling
      const textarea = document.getElementById("userInput");
      const composerCard = document.getElementById("composerCard");
      if (textarea) {
        textarea.addEventListener("input", () => {
          autoResizeTextarea();
          updateSendBtnState();
        });

        textarea.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (userData.enterToSend) {
              e.preventDefault();
              window.handleSend();
            }
          }
        });

        textarea.addEventListener("focus", () => {
          if (composerCard) composerCard.classList.add("focused");
        });

        textarea.addEventListener("blur", () => {
          if (composerCard) composerCard.classList.remove("focused");
        });
      }

      // 2. Left Side "+" Tools Menu & Popover
      const plusBtn = document.getElementById("composerPlusBtn");
      const toolsMenu = document.getElementById("composerToolsMenu");
      const fileInput = document.getElementById("fileInput");

      if (plusBtn && toolsMenu) {
        plusBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = toolsMenu.classList.toggle("show");
          plusBtn.classList.toggle("active", isOpen);
        });

        document.addEventListener("click", (e) => {
          if (!toolsMenu.contains(e.target) && e.target !== plusBtn) {
            toolsMenu.classList.remove("show");
            plusBtn.classList.remove("active");
          }
        });
      }

      // Tool Menu Items Click
      document.querySelectorAll(".tool-menu-item").forEach(item => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (toolsMenu) toolsMenu.classList.remove("show");
          if (plusBtn) plusBtn.classList.remove("active");

          const tool = item.getAttribute("data-tool");
          if (tool === "image-gen") {
            openImageGenModal();
            return;
          }
          if (tool === "katta-vision") {
            openKattaVisionModal();
            return;
          }
          if (!fileInput) return;

          if (tool === "file") {
            fileInput.accept = "*";
            fileInput.click();
          } else if (tool === "image") {
            fileInput.accept = "image/*";
            fileInput.click();
          } else if (tool === "pdf") {
            fileInput.accept = "application/pdf";
            fileInput.click();
          } else if (tool === "code") {
            if (textarea) {
              const codeTemplate = "```python\n# Apna code ya bug yahan paste karo\n\n```";
              textarea.value = codeTemplate;
              autoResizeTextarea();
              textarea.focus();
              updateSendBtnState();
            }
          }
        });
      });

      // 3. File Input Change Listener
      if (fileInput) {
        fileInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) handleIncomingFile(file);
        };
      }

      // 4. Quick Action Chips
      document.querySelectorAll(".quick-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          if (chip.id === "photoBanaoBtn") {
            openImageGenModal();
            return;
          }
          if (chip.id === "kattaVisionBtn") {
            openKattaVisionModal();
            return;
          }
          const action = chip.getAttribute("data-action");
          if (!textarea) return;

          if (action === "suggest") {
            const suggestions = [
              "Munna Bhaiya, Jaunpur market pe kabza karne ka complete business masterplan banao!",
              "Bhaiya, Python aur JavaScript me ek mast full-stack app kaise banayein?",
              "Munna Bhaiya, dushman ko dost kaise banayein? Koi solid purvanchal formula batao!",
              "Bhaiya, mere code me performance bug aa raha hai, isko optimize kaise karein?",
              "Mirzapur ki gaddi ka niyam business aur career me kaise lagayein?"
            ];
            const chosen = suggestions[Math.floor(Math.random() * suggestions.length)];
            textarea.value = chosen;
            autoResizeTextarea();
            textarea.focus();
            updateSendBtnState();
          } else if (action === "file" && fileInput) {
            fileInput.accept = "*";
            fileInput.click();
          } else if (action === "image" && fileInput) {
            fileInput.accept = "image/*";
            fileInput.click();
          } else if (action === "pdf" && fileInput) {
            fileInput.accept = "application/pdf";
            fileInput.click();
          } else if (action === "code") {
            const codeTemplate = "```javascript\n// Code snippet ya bug yahan likhein\n\n```";
            textarea.value = codeTemplate;
            autoResizeTextarea();
            textarea.focus();
            updateSendBtnState();
          } else if (action === "web") {
            if (!textarea.value.includes("[ðŸŒ Web Search]")) {
              textarea.value = "[ðŸŒ Web Search] " + textarea.value;
            }
            autoResizeTextarea();
            textarea.focus();
            updateSendBtnState();
          }
        });
      });

      // 5. Attachment preview remove button
      const removeAttach = document.getElementById("removeAttachmentBtn");
      if (removeAttach) removeAttach.onclick = clearAttachment;

      // 6. Lightbox
      const closeLight = document.getElementById("closeLightboxBtn");
      const lightbox = document.getElementById("imageLightbox");
      if (closeLight) closeLight.onclick = closeLightbox;
      if (lightbox) {
        lightbox.onclick = (e) => {
          if (e.target === lightbox) closeLightbox();
        };
      }

      // 7. Clipboard Paste Support (Ctrl+V)
      if (textarea) {
        textarea.addEventListener("paste", (e) => {
          const items = (e.clipboardData || window.clipboardData)?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                  handleIncomingFile(file);
                  e.preventDefault();
                  break;
                }
              }
            }
          }
          setTimeout(() => {
            autoResizeTextarea();
            updateSendBtnState();
          }, 20);
        });
      }

      // 8. Drag and drop onto page
      const dragOverlay = document.getElementById("dragOverlay");
      let dragCounter = 0;
      window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragOverlay) dragOverlay.classList.add("show");
      });
      window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          if (dragOverlay) dragOverlay.classList.remove("show");
        }
      });
      window.addEventListener("dragover", (e) => e.preventDefault());
      window.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dragOverlay) dragOverlay.classList.remove("show");
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          handleIncomingFile(files[0]);
        }
      });

      // 9. UPI & Modals
      const upiInput = document.getElementById("upiIdInput");
      if (upiInput) {
        upiInput.value = currentUpiId;
        upiInput.onchange = () => {
          currentUpiId = upiInput.value.trim() || "munnabhaiya@upi";
          safeSet("munna_owner_upi_id", currentUpiId);
          updateQrCode(selectedAmount);
        };
      }

      const copyUpi = document.getElementById("copyUpiBtn");
      if (copyUpi) {
        copyUpi.onclick = () => {
          navigator.clipboard.writeText(currentUpiId).then(() => {
            copyUpi.textContent = "Copied!";
            setTimeout(() => copyUpi.textContent = "Copy", 1800);
          });
        };
      }

      const toggleBtn = document.getElementById("toggleSidebar");
      if (toggleBtn) toggleBtn.onclick = toggleSidebarDrawer;

      const closeSidebarBtn = document.getElementById("closeSidebar");
      if (closeSidebarBtn) closeSidebarBtn.onclick = closeSidebarDrawer;

      const backdrop = document.getElementById("sidebarBackdrop");
      if (backdrop) backdrop.onclick = closeSidebarDrawer;

      const newChat = document.getElementById("newChatBtn");
      if (newChat) newChat.onclick = createNewSession;

      const clearBtn = document.getElementById("clearAllHistoryBtn");
      if (clearBtn) {
        clearBtn.onclick = () => {
          if (confirm("Kya aap saari pichli baatcheet hatana chahte hain?")) {
            sessions = [];
            createNewSession();
          }
        };
      }

      const openNaz = document.getElementById("openNazranaBtn");
      if (openNaz) openNaz.onclick = openNazranaModal;

      const closeNaz = document.getElementById("closeNazranaBtn");
      if (closeNaz) closeNaz.onclick = closeNazranaModal;

      const openVip = document.getElementById("openVipBtn");
      if (openVip) openVip.onclick = openVipModal;

      const closeVip = document.getElementById("closeVipBtn");
      if (closeVip) closeVip.onclick = closeVipModal;

      const nazModal = document.getElementById("nazranaModal");
      const vModal = document.getElementById("vipModal");
      [nazModal, vModal].forEach(m => {
        if (m) m.onclick = (e) => { if (e.target === m) m.classList.remove("show"); };
      });

      document.querySelectorAll(".amt-btn").forEach(p => {
        p.onclick = () => {
          document.querySelectorAll(".amt-btn").forEach(b => b.classList.remove("active"));
          p.classList.add("active");
          selectedAmount = parseInt(p.getAttribute("data-amt") || "51");
          updateQrCode(selectedAmount);
        };
      });

      const unlockBtn = document.getElementById("unlockVipWithUpiBtn");
      if (unlockBtn) {
        unlockBtn.onclick = () => {
          const upiVipStr = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=Munna%20Bhaiya%20VIP&am=49&cu=INR`;
          window.open(upiVipStr, "_blank");
          setTimeout(() => {
            if (confirm("Kya aapne â‚¹49 UPI payment kar diya hai? 'OK' daba kar VIP Pass activate karein!")) {
              activateVip(false);
            }
          }, 1200);
        };
      }

      const applyCode = document.getElementById("applyCodeBtn");
      const codeInput = document.getElementById("vipCodeInput");
      if (applyCode && codeInput) {
        applyCode.onclick = () => {
          const c = codeInput.value.trim().toUpperCase();
          if (c === "MUNNA99" || c === "BAHUBALI" || c === "MIRZAPUR") {
            activateVip(true);
          } else {
            alert("Galat Promo Code be! Asli code daalo (MUNNA99) ya â‚¹49 se unlock karo!");
          }
        };
      }

      // 10. Voice Input (Speech Recognition)
      const mic = document.getElementById("micBtn");
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (mic && SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.lang = "hi-IN";
        let listening = false;

        rec.onstart = () => {
          listening = true;
          mic.classList.add("recording");
        };
        rec.onresult = (e) => {
          const t = Array.from(e.results).map(r => r[0].transcript).join("");
          if (textarea) {
            textarea.value = t;
            autoResizeTextarea();
            updateSendBtnState();
          }
        };
        rec.onerror = (err) => {
          listening = false;
          mic.classList.remove("recording");
          console.warn("Speech recognition error:", err);
        };
        rec.onend = () => {
          listening = false;
          mic.classList.remove("recording");
          if (textarea && textarea.value.trim().length > 1) {
            window.handleSend();
          }
        };

        mic.onclick = () => {
          if (!isVip) { openVipModal(); return; }
          if (listening) {
            rec.stop();
          } else {
            if (textarea) textarea.value = "";
            try {
              rec.start();
            } catch (e) {
              console.warn("Speech start failed:", e);
            }
          }
        };
      } else if (mic) {
        mic.onclick = () => {
          if (!isVip) { openVipModal(); return; }
          alert("Bhaiya, aapke browser me Speech Recognition support nahi hai ya permission band hai. Chrome browser use karein!");
        };
      }

      // 11. User Profile Widget & Account Popover Menu
      const userProfileBtn = document.getElementById("userProfileBtn");
      if (userProfileBtn) {
        userProfileBtn.onclick = (e) => {
          e.stopPropagation();
          toggleAccountMenu();
        };
      }

      // Click outside to close account menu popover
      document.addEventListener("click", (e) => {
        const popover = document.getElementById("accountMenuPopover");
        const btn = document.getElementById("userProfileBtn");
        if (popover && popover.classList.contains("show")) {
          if (!popover.contains(e.target) && !btn.contains(e.target)) {
            closeAccountMenu();
          }
        }
      });

      // Global Escape key handler
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const popover = document.getElementById("accountMenuPopover");
          if (popover && popover.classList.contains("show")) {
            closeAccountMenu();
            return;
          }
          closeProfileModal();
          closeSettingsModal();
          closeHelpModal();
          closeLogoutModal();
          closeNazranaModal();
          closeVipModal();
          closeLightbox();
          closeAuthModal();
          closeKattaVisionModal();
          closeImageGenModal();
          closeArtLightbox();
        }
      });

      // Account Menu Item Actions
      const menuAuthBtn = document.getElementById("menuAuthBtn");
      if (menuAuthBtn) {
        menuAuthBtn.onclick = () => {
          closeAccountMenu();
          openAuthModal();
        };
      }

      const menuUpgradeBtn = document.getElementById("menuUpgradeBtn");
      if (menuUpgradeBtn) {
        menuUpgradeBtn.onclick = () => {
          closeAccountMenu();
          openVipModal();
        };
      }

      const menuProfileBtn = document.getElementById("menuProfileBtn");
      if (menuProfileBtn) {
        menuProfileBtn.onclick = () => {
          closeAccountMenu();
          openProfileModal();
        };
      }

      const menuSettingsBtn = document.getElementById("menuSettingsBtn");
      if (menuSettingsBtn) {
        menuSettingsBtn.onclick = () => {
          closeAccountMenu();
          openSettingsModal();
        };
      }

      const menuHelpBtn = document.getElementById("menuHelpBtn");
      if (menuHelpBtn) {
        menuHelpBtn.onclick = () => {
          closeAccountMenu();
          openHelpModal();
        };
      }

      const menuLogoutBtn = document.getElementById("menuLogoutBtn");
      if (menuLogoutBtn) {
        menuLogoutBtn.onclick = () => {
          closeAccountMenu();
          openLogoutModal();
        };
      }

      // Modal Close Buttons
      const closeProfileBtn = document.getElementById("closeProfileBtn");
      if (closeProfileBtn) closeProfileBtn.onclick = closeProfileModal;

      const closeSettingsBtn = document.getElementById("closeSettingsBtn");
      if (closeSettingsBtn) closeSettingsBtn.onclick = closeSettingsModal;

      const closeHelpBtn = document.getElementById("closeHelpBtn");
      if (closeHelpBtn) closeHelpBtn.onclick = closeHelpModal;

      const closeAuthBtn = document.getElementById("closeAuthBtn");
      if (closeAuthBtn) closeAuthBtn.onclick = closeAuthModal;

      const closeVipBtn = document.getElementById("closeVipBtn");
      if (closeVipBtn) closeVipBtn.onclick = closeVipModal;

      const closeNazranaBtn = document.getElementById("closeNazranaBtn");
      if (closeNazranaBtn) closeNazranaBtn.onclick = closeNazranaModal;

      const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
      if (cancelLogoutBtn) cancelLogoutBtn.onclick = closeLogoutModal;

      const closeKattaBtn = document.getElementById("closeKattaVisionBtn");
      if (closeKattaBtn) closeKattaBtn.onclick = closeKattaVisionModal;

      const closeImageGenBtn = document.getElementById("closeImageGenBtn");
      if (closeImageGenBtn) closeImageGenBtn.onclick = closeImageGenModal;

      const closeArtLight = document.getElementById("closeArtLightboxBtn");
      if (closeArtLight) closeArtLight.onclick = closeArtLightbox;

      const artLightDl = document.getElementById("artLightboxDownloadBtn");
      if (artLightDl) artLightDl.onclick = () => downloadArtImage(activeLightboxImageUrl);

      // Close modals when clicking backdrop
      const profModal = document.getElementById("profileModal");
      const setModal = document.getElementById("settingsModal");
      const hModal = document.getElementById("helpModal");
      const logModal = document.getElementById("logoutConfirmModal");
      const aModal = document.getElementById("authModal");
      const vModal = document.getElementById("vipModal");
      const nModal = document.getElementById("nazranaModal");
      const kattaModalElem = document.getElementById("kattaVisionModal");
      const imgGenModalElem = document.getElementById("imageGenModal");
      const artLightModalElem = document.getElementById("artLightboxModal");
      [profModal, setModal, hModal, logModal, aModal, vModal, nModal].forEach(m => {
        if (m) m.onclick = (e) => { if (e.target === m) m.classList.remove("show"); };
      });
      if (kattaModalElem) {
        kattaModalElem.onclick = (e) => {
          if (e.target === kattaModalElem) closeKattaVisionModal();
        };
      }
      if (imgGenModalElem) {
        imgGenModalElem.onclick = (e) => {
          if (e.target === imgGenModalElem) closeImageGenModal();
        };
      }
      if (artLightModalElem) {
        artLightModalElem.onclick = (e) => {
          if (e.target === artLightModalElem) closeArtLightbox();
        };
      }

      // Image Generator Style Chips
      document.querySelectorAll(".image-style-chip").forEach(chip => {
        chip.onclick = () => {
          document.querySelectorAll(".image-style-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          currentImageGenStyle = chip.getAttribute("data-style") || "mirzapur";
        };
      });

      // Image Generator Suggestion Tags
      document.querySelectorAll(".image-sugg-tag").forEach(tag => {
        tag.onclick = () => {
          const sugg = tag.getAttribute("data-sugg");
          const inp = document.getElementById("imageGenPromptInput");
          if (inp && sugg) {
            inp.value = sugg;
            inp.focus();
          }
        };
      });

      // Image Generator Submit Button
      const imageSubmitBtn = document.getElementById("imageGenSubmitBtn");
      if (imageSubmitBtn) {
        imageSubmitBtn.onclick = () => {
          const inp = document.getElementById("imageGenPromptInput");
          const prompt = inp ? inp.value.trim() : "";
          if (!prompt) {
            showMunnaToast("âš ï¸ Pehle koi prompt likho be!");
            return;
          }
          generateAIImage(prompt, currentImageGenStyle || "mirzapur");
        };
      }

      // Katta Vision Modal Controls
      const kattaUploadBtn = document.getElementById("kattaUploadBtn");
      const kattaFileInput = document.getElementById("kattaFileInput");
      if (kattaUploadBtn && kattaFileInput) {
        kattaUploadBtn.onclick = () => kattaFileInput.click();
        kattaFileInput.onchange = (e) => {
          if (e.target.files && e.target.files[0]) {
            handleKattaFileUpload(e.target.files[0]);
          }
        };
      }

      const kattaCamToggleBtn = document.getElementById("kattaCameraToggleBtn");
      if (kattaCamToggleBtn) {
        kattaCamToggleBtn.onclick = () => {
          toggleKattaCamera();
        };
      }

      const kattaScanExecuteBtn = document.getElementById("kattaScanExecuteBtn");
      if (kattaScanExecuteBtn) {
        kattaScanExecuteBtn.onclick = () => {
          executeKattaScan();
        };
      }

      // Katta Preset Selection Chips
      document.querySelectorAll(".katta-preset-chip").forEach((chip) => {
        chip.onclick = () => {
          document.querySelectorAll(".katta-preset-chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          kattaSelectedPreset = chip.getAttribute("data-preset") || "general";
          playKattaAudio("beep");
        };
      });

      // Profile Modal Actions
      const profUpgrade = document.getElementById("profileUpgradeBtn");
      if (profUpgrade) {
        profUpgrade.onclick = () => {
          closeProfileModal();
          openVipModal();
        };
      }

      const saveProfileBtn = document.getElementById("saveProfileBtn");
      if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
          const nameInput = document.getElementById("profileNameInput");
          const emailInput = document.getElementById("profileEmailInput");
          const newName = nameInput ? nameInput.value.trim() : "";
          const newEmail = emailInput ? emailInput.value.trim() : "";

          userData.name = newName || "Abhishek";
          userData.email = newEmail || "abhishek@mirzapur.ai";
          safeSet("munna_user_name", userData.name);
          safeSet("munna_user_email", userData.email);

          if (supabaseClient && currentUser) {
            try {
              await supabaseClient.auth.updateUser({
                data: { full_name: userData.name }
              });
            } catch (e) {
              console.warn("Supabase profile sync:", e);
            }
          }

          syncUserUI();
          showMunnaToast("[VIP] Profile update ho gayi bhai!");
          closeProfileModal();
        };
      }

      // Settings Modal Tabs & Actions
      document.querySelectorAll(".settings-tab-btn").forEach(tabBtn => {
        tabBtn.onclick = () => {
          document.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.remove("active"));
          document.querySelectorAll(".settings-tab-panel").forEach(p => p.classList.remove("active"));
          tabBtn.classList.add("active");
          const tabName = tabBtn.getAttribute("data-tab");
          const targetId = "tab" + tabName.charAt(0).toUpperCase() + tabName.slice(1);
          const panel = document.getElementById(targetId);
          if (panel) panel.classList.add("active");
        };
      });

      const settingsUpgradeBtn = document.getElementById("settingsUpgradeBtn");
      if (settingsUpgradeBtn) {
        settingsUpgradeBtn.onclick = () => {
          closeSettingsModal();
          openVipModal();
        };
      }

      const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");
      if (settingsLogoutBtn) {
        settingsLogoutBtn.onclick = () => {
          closeSettingsModal();
          openLogoutModal();
        };
      }

      const settingsClearHistoryBtn = document.getElementById("settingsClearHistoryBtn");
      if (settingsClearHistoryBtn) {
        settingsClearHistoryBtn.onclick = () => {
          if (confirm("Kya aap saari pichli baatcheet hatana chahte hain?")) {
            sessions = [];
            createNewSession();
            closeSettingsModal();
            showMunnaToast("Saari history saaf kar di gayi hai!");
          }
        };
      }

      const saveSettingsBtn = document.getElementById("saveSettingsBtn");
      if (saveSettingsBtn) {
        saveSettingsBtn.onclick = () => {
          const enterToggle = document.getElementById("enterToSendToggle");
          const soundToggle = document.getElementById("soundEffectsToggle");
          const aiStyleSel = document.getElementById("aiStyleSelect");
          const voiceSpeedSel = document.getElementById("voiceSpeedSelect");
          const autoSpeakToggle = document.getElementById("autoSpeakToggle");
          const langSel = document.getElementById("languageSelect");
          const themeSel = document.getElementById("themeSelect");

          if (enterToggle) userData.enterToSend = enterToggle.checked;
          if (soundToggle) userData.soundEffects = soundToggle.checked;
          if (aiStyleSel) userData.aiStyle = aiStyleSel.value;
          if (voiceSpeedSel) userData.voiceSpeed = parseFloat(voiceSpeedSel.value) || 1.0;
          if (autoSpeakToggle) userData.autoSpeak = autoSpeakToggle.checked;
          if (langSel) userData.language = langSel.value;
          if (themeSel) userData.theme = themeSel.value;

          safeSet("munna_setting_enter_send", String(userData.enterToSend));
          safeSet("munna_setting_sound", String(userData.soundEffects));
          safeSet("munna_setting_ai_style", userData.aiStyle);
          safeSet("munna_setting_voice_speed", String(userData.voiceSpeed));
          safeSet("munna_setting_auto_speak", String(userData.autoSpeak));
          safeSet("munna_setting_language", userData.language);
          safeSet("munna_theme", userData.theme);

          syncUserUI();
          showMunnaToast("Settings save ho gayi bhai!");
          closeSettingsModal();
        };
      }

      // Help Modal Actions
      const submitReportBtn = document.getElementById("s      // Session helper to reliably activate user state across both local & cloud
      function loginUserSession(user, toastMsg) {
        currentUser = user;
        sessionStorage.setItem("munna_guest_mode", "true");
        localStorage.setItem("munna_guest_mode", "true");
        localStorage.setItem("munna_local_user", JSON.stringify(user));
        const displayName = user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Munna User");
        safeSet("munna_user_name", displayName);
        if (user.email) safeSet("munna_user_email", user.email);
        updateAuthUI(currentUser);
        hideAuthScreen();
        closeAuthModal();
        if (typeof loadSessionsFromCloud === "function" && supabaseClient && !user.is_guest) {
          try { loadSessionsFromCloud(); } catch(e) {}
        }
        showMunnaToast(toastMsg || ("👑 Darbar me swagat hai, " + displayName + "!"));
      }

      // Logout Confirmation Actions
      const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
      if (confirmLogoutBtn) {
        confirmLogoutBtn.onclick = async () => {
          if (supabaseClient && currentUser && !currentUser.is_guest) {
            try { await supabaseClient.auth.signOut(); } catch (e) {}
          }
          sessionStorage.removeItem("munna_guest_mode");
          localStorage.removeItem("munna_guest_mode");
          localStorage.removeItem("munna_local_user");
          currentUser = null;
          userData.name = "Munna User";
          safeSet("munna_user_name", "Munna User");
          safeSet("munna_user_email", "");
          updateAuthUI(null);
          sessions = [];
          createNewSession();
          closeLogoutModal();
          showAuthScreen();
          showMunnaToast("Logout safal raha! Phir milte hain bhai.");
        };
      }

      // Supabase Auth Tabs & Actions
      const tabSignInBtn = document.getElementById("tabSignInBtn");
      const tabSignUpBtn = document.getElementById("tabSignUpBtn");
      const signInForm = document.getElementById("signInForm");
      const signUpForm = document.getElementById("signUpForm");

      if (tabSignInBtn && tabSignUpBtn && signInForm && signUpForm) {
        tabSignInBtn.onclick = () => {
          tabSignInBtn.classList.add("active");
          tabSignUpBtn.classList.remove("active");
          signInForm.classList.add("active");
          signUpForm.classList.remove("active");
        };
        tabSignUpBtn.onclick = () => {
          tabSignUpBtn.classList.add("active");
          tabSignInBtn.classList.remove("active");
          signUpForm.classList.add("active");
          signInForm.classList.remove("active");
        };
      }

      // Helper function to handle sign in with cloud attempt + zero-lockout fallback
      async function handleUnifiedSignIn(email, password, btnEl, isScreen) {
        if (btnEl) {
          btnEl.classList.add("loading");
          btnEl.setAttribute("data-orig-html", btnEl.innerHTML);
          btnEl.innerHTML = '<span>Dakhil ho rahe hain... ⏳</span>';
        }

        try {
          if (supabaseClient) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data?.user) {
              loginUserSession(data.user, "👑 Dakhila safal! Darbar me swagat hai, " + (data.user.user_metadata?.full_name || email.split("@")[0]) + "!");
              return;
            }
            if (error) {
              const errMsg = (error.message || "").toLowerCase();
              if (errMsg.includes("invalid login credentials")) {
                showMunnaToast("⚠️ Galat email ya password! Kripya dobara check karein ya 'Mehman Entry' karein.");
                return;
              }
              // If email confirmation is pending or other transient error, fallback to instant local session
              console.warn("Supabase auth warning, activating local verified session:", error.message);
            }
          }

          // Zero-Lockout Fallback: activate local session immediately
          const localUser = {
            id: "user_" + Date.now(),
            email: email,
            user_metadata: { full_name: email.split("@")[0] }
          };
          loginUserSession(localUser, "👑 Local profile activate ho gayi! Darbar me swagat hai, " + localUser.user_metadata.full_name + "!");
        } catch (err) {
          console.warn("Sign in catch, fallback to local:", err);
          const localUser = {
            id: "user_" + Date.now(),
            email: email,
            user_metadata: { full_name: email.split("@")[0] }
          };
          loginUserSession(localUser, "👑 Local profile activate ho gayi! Darbar me swagat hai.");
        } finally {
          if (btnEl) {
            btnEl.classList.remove("loading");
            const orig = btnEl.getAttribute("data-orig-html");
            if (orig) btnEl.innerHTML = orig;
          }
        }
      }

      // Helper function to handle sign up with cloud attempt + zero-lockout fallback
      async function handleUnifiedSignUp(name, email, password, btnEl, isScreen) {
        if (btnEl) {
          btnEl.classList.add("loading");
          btnEl.setAttribute("data-orig-html", btnEl.innerHTML);
          btnEl.innerHTML = '<span>Khata ban raha hai... ⏳</span>';
        }

        try {
          if (supabaseClient) {
            const { data, error } = await supabaseClient.auth.signUp({
              email,
              password,
              options: { data: { full_name: name } }
            });

            if (!error && data?.user) {
              const userObj = data.user;
              if (!userObj.user_metadata) userObj.user_metadata = {};
              if (!userObj.user_metadata.full_name) userObj.user_metadata.full_name = name;
              loginUserSession(userObj, "👑 Naya khata ban gaya aur dakhila safal! Swagat hai, " + name + "!");
              return;
            }
            if (error) {
              console.warn("Supabase signup warning, creating local account:", error.message);
            }
          }

          // Zero-Lockout Fallback: create local account immediately
          const localUser = {
            id: "user_" + Date.now(),
            email: email,
            user_metadata: { full_name: name || email.split("@")[0] }
          };
          loginUserSession(localUser, "👑 Naya khata ban gaya! Darbar me swagat hai, " + (name || email.split("@")[0]) + "!");
        } catch (err) {
          console.warn("Sign up catch, fallback to local:", err);
          const localUser = {
            id: "user_" + Date.now(),
            email: email,
            user_metadata: { full_name: name || email.split("@")[0] }
          };
          loginUserSession(localUser, "👑 Naya khata ban gaya! Darbar me swagat hai, " + (name || email.split("@")[0]) + "!");
        } finally {
          if (btnEl) {
            btnEl.classList.remove("loading");
            const orig = btnEl.getAttribute("data-orig-html");
            if (orig) btnEl.innerHTML = orig;
          }
        }
      }

      if (signInForm) {
        signInForm.onsubmit = async (e) => {
          e.preventDefault();
          const email = document.getElementById("signInEmail")?.value.trim() || "";
          const password = document.getElementById("signInPassword")?.value || "";
          const btn = document.getElementById("btnSubmitSignIn");
          await handleUnifiedSignIn(email, password, btn, false);
        };
      }

      if (signUpForm) {
        signUpForm.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById("signUpName")?.value.trim() || "";
          const email = document.getElementById("signUpEmail")?.value.trim() || "";
          const password = document.getElementById("signUpPassword")?.value || "";
          const btn = document.getElementById("btnSubmitSignUp");
          await handleUnifiedSignUp(name, email, password, btn, false);
        };
      }

      // --- FULL-SCREEN AUTH SCREEN CONTROLS ---
      const screenTabSignInBtn = document.getElementById("screenTabSignInBtn");
      const screenTabSignUpBtn = document.getElementById("screenTabSignUpBtn");
      const screenSignInForm = document.getElementById("screenSignInForm");
      const screenSignUpForm = document.getElementById("screenSignUpForm");

      if (screenTabSignInBtn && screenTabSignUpBtn && screenSignInForm && screenSignUpForm) {
        screenTabSignInBtn.onclick = () => {
          screenTabSignInBtn.classList.add("active");
          screenTabSignUpBtn.classList.remove("active");
          screenSignInForm.classList.add("active");
          screenSignUpForm.classList.remove("active");
        };
        screenTabSignUpBtn.onclick = () => {
          screenTabSignUpBtn.classList.add("active");
          screenTabSignInBtn.classList.remove("active");
          screenSignUpForm.classList.add("active");
          screenSignInForm.classList.remove("active");
        };
      }

      const btnScreenGoogle = document.getElementById("btnScreenGoogle");
      if (btnScreenGoogle) {
        btnScreenGoogle.onclick = () => window.handleGoogleSignIn(btnScreenGoogle);
      }

      const btnModalGoogle = document.getElementById("btnModalGoogle");
      if (btnModalGoogle) {
        btnModalGoogle.onclick = () => window.handleGoogleSignIn(btnModalGoogle);
      }

      if (screenSignInForm) {
        screenSignInForm.onsubmit = async (e) => {
          e.preventDefault();
          const email = document.getElementById("screenSignInEmail")?.value.trim() || "";
          const password = document.getElementById("screenSignInPassword")?.value || "";
          const btn = document.getElementById("btnScreenSignIn");
          await handleUnifiedSignIn(email, password, btn, true);
        };
      }

      if (screenSignUpForm) {
        screenSignUpForm.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById("screenSignUpName")?.value.trim() || "";
          const email = document.getElementById("screenSignUpEmail")?.value.trim() || "";
          const password = document.getElementById("screenSignUpPassword")?.value || "";
          const btn = document.getElementById("btnScreenSignUp");
          await handleUnifiedSignUp(name, email, password, btn, true);
        };
      }

      // Supabase Auth State Initialization
      async function initSupabaseAuth() {
        const isGuest = (sessionStorage.getItem("munna_guest_mode") === "true" || localStorage.getItem("munna_guest_mode") === "true");
        const savedLocalUser = safeGet("munna_local_user");

        if (savedLocalUser) {
          try {
            currentUser = JSON.parse(savedLocalUser);
            updateAuthUI(currentUser);
            hideAuthScreen();
            closeAuthModal();
          } catch(e) {}
        } else if (isGuest) {
          updateAuthUI(currentUser);
          hideAuthScreen();
          closeAuthModal();
        }

        if (!supabaseClient) {
          if (!isGuest && !savedLocalUser) {
            showAuthScreen();
          }
          return;
        }

        // 1. Listen to Auth State changes FIRST so no event is lost
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") && session?.user) {
            currentUser = session.user;
            sessionStorage.setItem("munna_guest_mode", "true");
            localStorage.setItem("munna_guest_mode", "true");
            localStorage.setItem("munna_local_user", JSON.stringify(currentUser));
            updateAuthUI(currentUser);
            hideAuthScreen();
            closeAuthModal();
            if (event === "SIGNED_IN") {
              showMunnaToast("👑 Welcome to Munna AI, " + (currentUser.user_metadata?.full_name || currentUser.email.split("@")[0]) + "!");
            }
            loadSessionsFromCloud();
          } else if (event === "SIGNED_OUT") {
            currentUser = null;
            updateAuthUI(null);
            sessionStorage.removeItem("munna_guest_mode");
            localStorage.removeItem("munna_guest_mode");
            localStorage.removeItem("munna_local_user");
            showAuthScreen();
            showMunnaToast("Aap sign out ho gaye hain.");
          }
        });

        // 2. Handle Google OAuth redirect callback (PKCE code or error in query params)
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get("code");
        const authError = urlParams.get("error_description") || urlParams.get("error");

        if (authError) {
          console.error("Google Auth callback error:", authError);
          showMunnaToast("⚠️ Google Login notice: " + authError);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authCode) {
          try {
            showMunnaToast("👑 Google authentication verify ho raha hai...");
            const { data, error } = await supabaseClient.auth.exchangeCodeForSession(authCode);
            if (!error && data?.session?.user) {
              currentUser = data.session.user;
              sessionStorage.setItem("munna_guest_mode", "true");
              localStorage.setItem("munna_guest_mode", "true");
              localStorage.setItem("munna_local_user", JSON.stringify(currentUser));
              updateAuthUI(currentUser);
              hideAuthScreen();
              closeAuthModal();
              showMunnaToast("👑 Welcome to Munna AI, " + (currentUser.user_metadata?.full_name || currentUser.email.split("@")[0]) + "!");
              loadSessionsFromCloud();
            }
          } catch (codeErr) {
            console.warn("exchangeCodeForSession warning:", codeErr);
          } finally {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        // 3. Check existing session in storage
        try {
          const { data: { session }, error } = await supabaseClient.auth.getSession();
          if (session && session.user) {
            currentUser = session.user;
            sessionStorage.setItem("munna_guest_mode", "true");
            localStorage.setItem("munna_guest_mode", "true");
            localStorage.setItem("munna_local_user", JSON.stringify(currentUser));
            updateAuthUI(currentUser);
            loadSessionsFromCloud();
            hideAuthScreen();
            closeAuthModal();
          } else if (!isGuest && !savedLocalUser) {
            showAuthScreen();
          }
        } catch (e) {
          console.warn("Auth getSession error:", e);
          if (!isGuest && !savedLocalUser) {
            showAuthScreen();
          }
        }
      }



      initSupabaseAuth();

      // Voice Test Button in Settings
      const testVoiceBtn = document.getElementById("testVoiceBtn");
      if (testVoiceBtn) {
        testVoiceBtn.onclick = () => {
          if (testVoiceBtn.classList.contains("playing")) {
            stopAllSpeech();
            return;
          }
          testVoiceBtn.classList.add("playing");
          testVoiceBtn.innerHTML = '<span>â¹ï¸</span> Rokhein';
          showMunnaToast("ðŸŽ™ï¸ Munna Bhaiya bol rahe hain...");
          speakText("Arey bhai, hum hain Munna AI! King of AI Models! Poori duniya me jalwa hai hamara! Har masle ka pakka prabandh karte hain!", testVoiceBtn);
        };
      }

      // Ensure auto-speak is disabled by default for all users
      if (localStorage.getItem("munna_auto_speak_migrated") !== "done") {
        userData.autoSpeak = false;
        safeSet("munna_setting_auto_speak", "false");
        localStorage.setItem("munna_auto_speak_migrated", "done");
      }

      // --- EXECUTIVE TOPBAR & MODEL SWITCHER HANDLERS ---
      window.toggleModelMenu = function() {
        const popover = document.getElementById("modelMenuPopover");
        if (popover) {
          popover.style.display = (popover.style.display === "none" || !popover.style.display) ? "block" : "none";
        }
      };

      window.selectModelEngine = function(label, engineId) {
        const labelEl = document.getElementById("currentModelLabel");
        if (labelEl) labelEl.textContent = label;
        const popover = document.getElementById("modelMenuPopover");
        if (popover) popover.style.display = "none";
        
        document.querySelectorAll(".model-option").forEach(opt => opt.classList.remove("active"));
        if (engineId === "katta-vision") {
          document.getElementById("optModelKatta")?.classList.add("active");
          if (typeof window.openKattaVisionModal === "function") window.openKattaVisionModal();
        } else {
          activeModel = engineId || "gemini-3.6-flash";
          if (label && label.includes("Ultra")) {
            document.getElementById("optModelUltra")?.classList.add("active");
            showMunnaToast("[VIP] Munna Ultra v4.5 Flagship Active (Gemini 3.6)");
          } else {
            document.getElementById("optModelFlash")?.classList.add("active");
            showMunnaToast("âš¡ Gemini 3.6 Flash Engine Active");
          }
        }
      };

      window.openDesignSpecModal = function() {
        const modal = document.getElementById("specModal");
        if (modal) modal.classList.add("show");
      };

      window.closeDesignSpecModal = function() {
        const modal = document.getElementById("specModal");
        if (modal) modal.classList.remove("show");
      };

      window.openJaunpurModal = function() {
        const modal = document.getElementById("jaunpurModal");
        if (modal) modal.classList.add("show");
      };

      window.closeJaunpurModal = function() {
        const modal = document.getElementById("jaunpurModal");
        if (modal) modal.classList.remove("show");
      };

      window.injectStarterPrompt = function(promptText) {
        const textarea = document.getElementById("userInput");
        if (textarea) {
          textarea.value = promptText;
          if (typeof autoResizeTextarea === "function") autoResizeTextarea();
          if (typeof updateSendBtnState === "function") updateSendBtnState();
          if (typeof window.handleSend === "function") window.handleSend();
        }
      };

      window.startNewChat = function() {
        if (typeof createNewSession === "function") {
          createNewSession();
          showMunnaToast("[VIP] Nayi darbar chat shuru ho gayi!");
        }
      };

      // --- COMPLETE SIDEBAR NAVIGATION & MODALS ENGINE ---
      window.handleNavAction = function(action) {
        document.querySelectorAll(".sidebar-nav-item").forEach(btn => btn.classList.remove("active"));
        const clickedBtn = document.querySelector(`.sidebar-nav-item[onclick*="'${action}'"]`);
        if (clickedBtn) clickedBtn.classList.add("active");

        if (window.innerWidth <= 768 && typeof closeSidebarDrawer === "function") {
          closeSidebarDrawer();
        }

        switch (action) {
          case 'home':
            const session = getCurrentSession();
            if (!session || !session.messages || session.messages.length === 0) {
              renderWelcomeHero();
            }
            const chatMessages = document.getElementById("chatMessages");
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
            const input = document.getElementById("userInput");
            if (input) input.focus();
            break;

          case 'explore':
            window.openExploreModal();
            break;

          case 'models':
            window.toggleModelMenu();
            break;

          case 'voice':
            window.openVoiceSettings();
            break;

          case 'image':
            window.openPhotoBanaoModal();
            break;

          case 'documents':
            window.openKattaVisionModal();
            break;

          case 'history':
            const historyList = document.getElementById("historyList");
            if (historyList) {
              historyList.scrollIntoView({ behavior: 'smooth', block: 'center' });
              historyList.style.transition = 'box-shadow 0.3s ease';
              historyList.style.boxShadow = '0 0 15px rgba(242,202,80,0.4)';
              setTimeout(() => { historyList.style.boxShadow = ''; }, 1500);
            }
            showMunnaToast("📜 Chat History List Active");
            break;

          case 'saved':
            window.openSavedModal();
            break;

          default:
            console.warn("Unknown nav action:", action);
        }
      };

      window.openExploreModal = function() {
        const modal = document.getElementById("exploreModal");
        if (modal) modal.classList.add("show");
      };
      window.closeExploreModal = function() {
        const modal = document.getElementById("exploreModal");
        if (modal) modal.classList.remove("show");
      };

      window.openSavedModal = function() {
        const modal = document.getElementById("savedModal");
        if (modal) {
          modal.classList.add("show");
          window.renderSavedList();
        }
      };
      window.closeSavedModal = function() {
        const modal = document.getElementById("savedModal");
        if (modal) modal.classList.remove("show");
      };

      window.renderSavedList = function() {
        const container = document.getElementById("savedItemsContainer");
        if (!container) return;
        let savedItems = [];
        try {
          savedItems = JSON.parse(localStorage.getItem("munna_saved_items") || "[]");
        } catch (e) { savedItems = []; }

        if (savedItems.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-dim);">
              <span class="material-symbols-outlined" style="font-size:42px; color:var(--gold-primary); opacity:0.6; display:block; margin-bottom:8px;">bookmarks</span>
              <p style="font-size:0.95rem; margin:0 0 6px 0; color:var(--text-main); font-weight:600;">Abhi koi saved message nahi hai</p>
              <p style="font-size:0.78rem; margin:0; line-height:1.5;">Kisi bhi chat message ke action bar se messages ko bookmark karke yahan dekh sakte hain.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = savedItems.map((item, idx) => `
          <div style="background:var(--bg-surface); border:1px solid rgba(242,202,80,0.25); border-radius:10px; padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.72rem; color:var(--gold-primary); font-family:var(--font-code); font-weight:600;">#${idx+1} • ${item.time || 'Saved'}</span>
              <div style="display:flex; gap:6px;">
                <button type="button" class="ai-icon-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(item.text)}')); showMunnaToast('Copied to clipboard!');" title="Copy">
                  <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                </button>
                <button type="button" class="ai-icon-btn" onclick="window.removeSavedItem(${idx});" title="Delete">
                  <span class="material-symbols-outlined" style="font-size:16px; color:var(--crimson);">delete</span>
                </button>
              </div>
            </div>
            <div style="font-size:0.84rem; color:var(--text-main); line-height:1.5;">${item.text}</div>
          </div>
        `).join("");
      };

      window.removeSavedItem = function(idx) {
        try {
          let savedItems = JSON.parse(localStorage.getItem("munna_saved_items") || "[]");
          savedItems.splice(idx, 1);
          localStorage.setItem("munna_saved_items", JSON.stringify(savedItems));
          window.renderSavedList();
          showMunnaToast("Bookmark hata diya gaya");
        } catch (e) {}
      };

      window.openVoiceSettings = function() {
        if (typeof openSettingsModal === "function") openSettingsModal();
        const tabs = document.querySelectorAll("#settingsTabsNav .settings-tab-btn");
        tabs.forEach(t => t.classList.remove("active"));
        const aiTab = document.querySelector('#settingsTabsNav .settings-tab-btn[data-tab="ai"]');
        if (aiTab) aiTab.classList.add("active");
        document.querySelectorAll(".settings-tab-panel").forEach(p => p.classList.remove("active"));
        const panel = document.getElementById("tabAi");
        if (panel) panel.classList.add("active");
      };

      window.openPhotoBanaoModal = function() {
        if (typeof openImageGenModal === "function") openImageGenModal();
      };
      window.closePhotoBanaoModal = function() {
        if (typeof closeImageGenModal === "function") closeImageGenModal();
      };

      window.openKattaVisionModal = function() {
        const modal = document.getElementById("kattaVisionModal");
        if (modal) modal.classList.add("show");
      };
      window.closeKattaVisionModal = function() {
        const modal = document.getElementById("kattaVisionModal");
        if (modal) modal.classList.remove("show");
      };

      window.openSettingsModal = function() {
        if (typeof openSettingsModal === "function") openSettingsModal();
      };
      window.closeSettingsModal = function() {
        if (typeof closeSettingsModal === "function") closeSettingsModal();
      };

      window.openProfileModal = function() {
        if (typeof openProfileModal === "function") openProfileModal();
      };
      window.closeProfileModal = function() {
        if (typeof closeProfileModal === "function") closeProfileModal();
      };

      window.openNazranaModal = function() {
        const m = document.getElementById("nazranaModal");
        if (m) m.classList.add("show");
      };
      window.closeNazranaModal = function() {
        const m = document.getElementById("nazranaModal");
        if (m) m.classList.remove("show");
      };

      document.addEventListener("click", function(e) {
        const dropdown = document.getElementById("modelSwitcherDropdown");
        const popover = document.getElementById("modelMenuPopover");
        if (dropdown && popover && !dropdown.contains(e.target)) {
          popover.style.display = "none";
        }
      });

      syncUserUI();
      updateQuotaUI();
      updateQrCode(selectedAmount);

      renderSessionList();
      loadActiveSession();

      autoResizeTextarea();
      updateSendBtnState();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initApp);
    } else {
      initApp();
    }