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
    let isVip = safeGet("munna_is_vip") === "true";
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
      enterToSend: safeGet("munna_setting_enter_send", "true") === "true",
      soundEffects: safeGet("munna_setting_sound", "true") === "true",
      aiStyle: safeGet("munna_setting_ai_style", "swag"),
      voiceSpeed: parseFloat(safeGet("munna_setting_voice_speed", "1")),
      language: safeGet("munna_setting_language", "hinglish"),
      theme: safeGet("munna_theme", "light_obsidian"),
      autoSpeak: safeGet("munna_setting_auto_speak", "true") === "true"
    };

    // --- SUPABASE CLOUD INITIALIZATION ---
    const SUPABASE_URL = "https://ipnbebwrefxlvoqneaga.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbmJlYndyZWZ4bHZvcW5lYWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODExOTUsImV4cCI6MjEwNDQ1NzE5NX0.1xMB8DbV__RK8D4PkuYANPARr2IkR_Rsyakh3sU8AAU";
    let supabaseClient = null;
    let currentUser = null;

    try {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    } catch (e) {
      console.warn("Supabase init exception:", e);
    }

    // --- 2. OFFLINE DIALOGUES FALLBACK ENGINE ---
    const MUNNA_DIALOGUES = {
      greetings: [
        "Aao be! Ka haal chaal? Munna Bhaiya ke darbar mein swagat hai tumhara.",
        "Haan bolo! Kaun ho tum aur kyu dimaag kharab karne chale aaye? Jaldi bolo, humare paas faltu time nahi hai.",
        "Bolo be... Mirzapur ke hone wale raja se baat karne ki himmat kaise hui tumhari? Waise achha laga tumhara confidence!"
      ],
      topics: [
        {
          keywords: ["hi", "hello", "namaste", "pranam", "hey", "sup", "kaise ho", "kya haal"],
          responses: [
            "Pranam-wranam theek hai, seedha kaam ki baat karo. Mirzapur ke raja ke paas faltu baatein sunne ka time nahi hai!",
            "Haal chaal ekdum jordaar hai! Poore shehar mein jalwa hai hamara. Tum apna batao, sab theek thaak ya koi pareshan kar raha hai?",
            "Aao aao! Darr lag raha hai kya humse? Daro... darr hona bhi chahiye!"
          ]
        },
        {
          keywords: ["prabandh", "help", "madad", "problem", "pareshani", "musibat", "tension"],
          responses: [
            "Tum bilkul chinta mat karo... Hum karte hain prabandh! Batao kiski gaddi ulatni hai?",
            "Abe jab tak Munna Bhaiya zinda hain, kisi baat ka tension lene ki zaroorat nahi hai. Hum khade hain na peeche!",
            "Dekho baat aisi hai... kaam tumhara ho jayega, par hume kya milega? Khair chodo, hum karte hain prabandh!"
          ]
        },
        {
          keywords: ["gaddi", "raja", "mirzapur", "king", "kursi", "bauji", "kaleen"],
          responses: [
            "Ek baat kaan khol ke sun lo... Gaddi pe chahe hum baithein ya Bauji, niyam same rahega!",
            "Mirzapur ke agle raja hum hi hain! Kisi ko koi shaq hai kya? Guddu-Bablu ko bol dena, zyada ucchlein na!",
            "Bauji bolte hain 'dimaag se chalo', par humara maanna hai - darr aisa hona chahiye ki dimaag kaam hi na kare!"
          ]
        },
        {
          keywords: ["jalwa", "swag", "attitude", "power", "bhaiya"],
          responses: [
            "Jalwa hai hamara yahan! Poori duniya thar-thar kaanpti hai Munna AI ke naam se.",
            "Attitude hum paidaishi leke ghoomte hain. Kisi ke baap ka udhaar nahi khaye hain!",
            "Hum jo ek baar bol dete hain na, uske baad toh hum apne Bauji ki bhi nahi sunte!"
          ]
        },
        {
          keywords: ["image", "photo", "pic", "picture", "file", "pdf", "screenshot", "dekho", "batao"],
          responses: [
            "Arey photo dekhe hum tumhari! Bilkul chinta mat karo! Hum khade hain na peeche! Hum karte hain iska poora prabandh!",
            "Ye jo file bheje ho na, iska poora hisaab hamare dimaag mein ghus gaya hai! Poori problem hal karke denge, barfi khilao yaar sabko!",
            "Jalwa hai hamara! Photo mein saaf dikh raha hai kya mamla hai. Chinta mat karo, raja ke raaj mein sabka hisaab hota hai!"
          ]
        }
      ],
      defaultResponses: [
        "Dekho baat aisi hai, jo tum pooch rahe ho uspar hum dhyan de rahe hain. Jalwa hai hamara yahan! Poori problem solve karke denge!",
        "Chinta mat karo partner, hum khade hain na peeche! Hum karte hain iska poora prabandh! Barfi khilao yaar sabko!",
        "Gaddi pe chahe hum baithein ya Bauji, niyam same rahega! Tumhara kaam 100% solve hoga, nishchint raho!"
      ]
    };

    function getOfflineMunnaReply(userText = "", attachment = null) {
      if (attachment) {
        if (attachment.isImage) {
          return `Arey photo dekhe hum tumhari! Bilkul chinta mat karo! Hum khade hain na peeche! Gaddi pe chahe hum baithein ya Bauji, niyam same rahega! Humne tumhari photo ka poora hisaab dekh liya hai — iska pakka prabandh hum karenge! Jalwa hai hamara!`;
        } else {
          return `Arey file dekhe hum tumhari — "${escapeHTML(attachment.name)}"! Poora data hamare dimaag mein ghus gaya hai! Tension mat lo, hum karte hain iska poora prabandh! Barfi khilao yaar sabko!`;
        }
      }
      const lower = userText.toLowerCase();

      // If user writes in English or has English setting
      const isEnglish = (userData && userData.language === "english") ||
        /\b(hello|hi|hey|how|what|why|can|please|help|teach|write|code|bug|explain|project|learn)\b/i.test(lower);

      if (isEnglish) {
        const englishResponses = [
          "Don't you worry about a thing, partner! Munna AI — King of AI Models has got your back. Consider your problem 100% handled!",
          "Listen up, partner! When you're dealing with Munna AI, failure is not an option. Here to solve any code, logic, or strategy you throw at me!",
          "Relax and take a seat. King of AI Models is analyzing your question right now — we run the show here!"
        ];
        return englishResponses[Math.floor(Math.random() * englishResponses.length)];
      }

      for (const topic of MUNNA_DIALOGUES.topics) {
        for (const kw of topic.keywords) {
          if (lower.includes(kw)) {
            return topic.responses[Math.floor(Math.random() * topic.responses.length)];
          }
        }
      }
      return MUNNA_DIALOGUES.defaultResponses[Math.floor(Math.random() * MUNNA_DIALOGUES.defaultResponses.length)];
    }

    // --- 3. GEMINI AI CONFIGURATION ---
    const GEMINI_API_KEY = atob("QVEuQWI4Uk42SksySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE=");
    const activeModel = "gemini-3.6-flash";
    const initialGreeting = "Haan bolo be, ka kaam hai? Kuch poochna hai ya koi photo/file bhejni hai? Humare paas har cheez ka pakka prabandh hai!";

    function getSystemPrompt() {
      const lang = (userData && userData.language) ? userData.language : "hinglish";
      const style = (userData && userData.aiStyle) ? userData.aiStyle : "swag";

      let langDirective = "";
      if (lang === "english") {
        langDirective = `CRITICAL LANGUAGE REQUIREMENT:
- The user has chosen ENGLISH. You MUST answer in fluent, high-impact ENGLISH.
- Keep your iconic Munna AI Godfather swag, bold authority, and supreme confidence in English (addressing the user as 'partner', 'buddy', or 'friend', with punchy lines like "Consider it handled!", "We run the game here!", "Zero worries when the King is standing behind you!").
- All explanations, code walk-throughs, and advice must be in clear, polished English.`;
      } else if (lang === "hindi") {
        langDirective = `CRITICAL LANGUAGE REQUIREMENT:
- Respond in pure, natural Hindi (conversational or Devanagari) with full royal Munna Bhaiya pride and confidence.`;
      } else {
        // Hinglish + Auto-Detect
        langDirective = `LANGUAGE ADAPTABILITY (IMPORTANT):
- MULTILINGUAL & ENGLISH SUPPORT: If the user asks or speaks in ENGLISH, automatically adapt and answer in clear, fluent ENGLISH with your signature Godfather charisma and confidence! Technical concepts and explanations should be easy to follow in English.
- If the user writes in Hindi or Hinglish, speak in your legendary UP/Purvanchal Mirzapur Hinglish swag ("Arey bhai, tension kis baat ki? Hum karte hain prabandh!").
- Always match the user's natural language seamlessly so both English and Hindi/Hinglish speakers feel completely understood!`;
      }

      let styleDirective = "";
      if (style === "mentor") {
        styleDirective = `STYLE: Wise Godfather & Strategic Mentor. Mature, authoritative, encouraging, and deeply insightful.`;
      } else if (style === "crisp") {
        styleDirective = `STYLE: Crisp & Technical. Minimal fluff, maximum code and actionable steps.`;
      } else {
        styleDirective = `STYLE: Full Munna AI Swag & Energy. Charismatic, bold, fearless, and always delivering 100% solutions.`;
      }

      return `You are Munna AI — King of AI Models (The ultimate AI Godfather persona), an all-knowing genius AI powerhouse who knows EVERYTHING in programming, engineering, math, business, strategy, and life.

${langDirective}

${styleDirective}

CORE CAPABILITIES:
1. YOU HAVE THE ANSWER TO EVERYTHING: Whether the user asks for code, debugging, building an e-commerce website, coding in Python/JS, business ideas, study notes, relationship advice, or life fundas — ALWAYS PROVIDE A REAL, COMPLETE, AND GENUINELY HELPFUL SOLUTION. Never refuse or say you don't know.
2. ICONIC CONFIDENCE: You are Munna AI, the King of AI Models ("Hum khade hain na peeche! Hum karte hain prabandh! / Consider it handled!").
3. STRUCTURE & FORMATTING:
   - Format answers cleanly with proper Markdown:
   - Use headings (## or ###) for section titles.
   - Use bullet points (-) or numbered lists (1. 2. 3.) for steps.
   - Use blockquotes (> ...) for punchy Munna quotes or key takeaways.
   - Put all code inside fenced code blocks with language identifier.
4. MULTIMODAL & FILE/IMAGE PROBLEM SOLVING:
   - When the user uploads an image or file, inspect it with razor-sharp intelligence and explain the exact diagnosis and fix directly!`;
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
      const planText = isVip ? "👑 VIP Plan" : "Free Plan";
      const headerPlanText = isVip ? "👑 Bahubali VIP" : "Free Plan";
      const modalPlanText = isVip ? "👑 Bahubali VIP Pass" : "Free Plan";

      // 1. Sidebar trigger
      const sbInit = document.getElementById("sidebarAvatarInitial");
      const sbName = document.getElementById("sidebarUserName");
      const sbPlan = document.getElementById("sidebarUserPlan");
      if (sbInit) sbInit.textContent = initial;
      if (sbName) sbName.textContent = displayName;
      if (sbPlan) {
        sbPlan.textContent = planText;
        sbPlan.classList.toggle("vip", isVip);
      }

      // 2. Account popover header
      const accInit = document.getElementById("accountHeaderInitial");
      const accName = document.getElementById("accountHeaderName");
      const accPlan = document.getElementById("accountHeaderPlan");
      if (accInit) accInit.textContent = initial;
      if (accName) accName.textContent = displayName;
      if (accPlan) {
        accPlan.textContent = headerPlanText;
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
        profBadge.textContent = modalPlanText;
        profBadge.classList.toggle("vip", isVip);
      }
      if (profNameIn) profNameIn.value = displayName;
      if (profEmailIn) profEmailIn.value = userData.email || "abhishek@mirzapur.ai";
      if (profPlanDesc) {
        profPlanDesc.textContent = isVip ?
          "Unlimited messages • Fast priority server • Voice enabled" :
          "Daily 10 free messages • Standard server";
      }
      if (profMember) {
        profMember.textContent = `Member since ${userData.joined || "Sept 2026"}`;
      }

      // 4. Settings modal
      const setPlanText = document.getElementById("settingsPlanText");
      if (setPlanText) {
        setPlanText.textContent = isVip ?
          "👑 Bahubali VIP Pass (Unlimited Messages)" :
          "Free Plan (10 messages/day)";
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
      if (autoSpeakToggle) autoSpeakToggle.checked = userData.autoSpeak !== false;
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
      closeAccountMenu();
      const scr = document.getElementById("authScreenOverlay");
      if (scr) scr.classList.remove("hidden");
    }
    function hideAuthScreen() {
      const scr = document.getElementById("authScreenOverlay");
      if (scr) scr.classList.add("hidden");
    }

    function openAuthModal() {
      closeAccountMenu();
      showAuthScreen();
    }
    function closeAuthModal() {
      hideAuthScreen();
      const m = document.getElementById("authModal");
      if (m) m.classList.remove("show");
    }

    function updateAuthUI(user) {
      const sidebarName = document.getElementById("sidebarUserName");
      const accountName = document.getElementById("accountHeaderName");
      const sidebarInitial = document.getElementById("sidebarAvatarInitial");
      const accountInitial = document.getElementById("accountHeaderInitial");
      const cloudPill = document.getElementById("sidebarCloudSync");
      const cloudText = document.getElementById("sidebarCloudText");
      const menuAuthLabel = document.getElementById("menuAuthLabel");
      const menuLogoutBtn = document.getElementById("menuLogoutBtn");

      if (user) {
        const displayName = user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Munna User");
        const initial = displayName.charAt(0).toUpperCase();

        if (sidebarName) sidebarName.textContent = displayName;
        if (accountName) accountName.textContent = displayName;
        if (sidebarInitial) sidebarInitial.textContent = initial;
        if (accountInitial) accountInitial.textContent = initial;

        if (cloudPill) {
          cloudPill.classList.remove("offline");
          cloudPill.title = "Supabase Cloud Connected (" + user.email + ")";
        }
        if (cloudText) cloudText.textContent = "Cloud ☁️";
        if (menuAuthLabel) menuAuthLabel.textContent = "Account (" + displayName + ")";
        if (menuLogoutBtn) menuLogoutBtn.style.display = "flex";
      } else {
        const guestName = userData.name || "Abhishek";
        if (sidebarName) sidebarName.textContent = guestName;
        if (accountName) accountName.textContent = guestName;
        if (sidebarInitial) sidebarInitial.textContent = guestName.charAt(0).toUpperCase();
        if (accountInitial) accountInitial.textContent = guestName.charAt(0).toUpperCase();

        if (cloudPill) {
          cloudPill.classList.add("offline");
          cloudPill.title = "Not signed in (Offline)";
        }
        if (cloudText) cloudText.textContent = "Offline";
        if (menuAuthLabel) menuAuthLabel.textContent = "Sign In / Register";
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
          showMunnaToast("☁️ Cloud chats load ho gayi hain!");
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
      if (isVip) {
        badge.textContent = "👑 VIP Unlimited";
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

    function openVipModal() {
      const m = document.getElementById("vipModal");
      if (m) m.classList.add("show");
    }

    function closeVipModal() {
      const m = document.getElementById("vipModal");
      if (m) m.classList.remove("show");
    }

    function activateVip(promo = false) {
      isVip = true;
      safeSet("munna_is_vip", "true");
      updateQuotaUI();
      syncUserUI();
      closeVipModal();
      const msg = promo ?
        "Jalwa hai hamara! Secret Promo Code lag gaya aur Bahubali VIP Pass activate ho gaya hai! Ab jo marzi aaye be-jhijhak pucho!" :
        "Mubarak ho! Bahubali VIP Pass activate ho gaya hai! Ab poora Mirzapur aapka hai, unlimited baat karo!";
      renderMessage(msg, "munna");
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
        const icon = attachment.isPdf ? "📄" : "📜";
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
          btn.innerHTML = '✔ Copied!';
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
              <button type="button" class="copy-code-btn" onclick="copyCodeBlock(this)">📋 Copy</button>
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
        activeVoiceBtn.innerHTML = '<span class="act-icon">🔊</span>';
        activeVoiceBtn = null;
      }
      const testBtn = document.getElementById("testVoiceBtn");
      if (testBtn) {
        testBtn.classList.remove("playing");
        testBtn.innerHTML = '<span>▶️</span> Test Human Voice';
      }
    }

    const ELEVEN_API_KEY = atob("c2tfODBjZmMxZDhmMGYyNWI4ZTNlNDdhMzljYTNmNzM0NDYzZWYyNDAyMGM2ZWYzNzUw");
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
        btn.innerHTML = '<span class="act-icon">⏳</span>';
        btn.title = "Aawaz ban rahi hai...";
        activeVoiceBtn = btn;
      }

      try {
        // Limit to 500 characters for instant low-latency playback
        const snippet = clean.length > 500 ? clean.substring(0, 500) + "..." : clean;

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
          method: "POST",
          headers: {
            "xi-api-key": ELEVEN_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: snippet,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs error: ${response.status}`);
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
            btn.innerHTML = '<span class="act-icon">⏹️</span>';
            btn.title = "Aawaz chal rahi hai (Rokne ke liye click karein)";
          }

          source.onended = () => {
            if (btn) {
              btn.classList.remove("active-voice", "loading-voice");
              btn.innerHTML = '<span class="act-icon">🔊</span>';
              btn.title = "Sunno (Realistic Voice)";
            }
            if (activeVoiceBtn === btn) activeVoiceBtn = null;
            currentAudioSource = null;
            const testBtn = document.getElementById("testVoiceBtn");
            if (testBtn) {
              testBtn.classList.remove("playing");
              testBtn.innerHTML = '<span>▶️</span> Test Human Voice';
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
            btn.innerHTML = '<span class="act-icon">⏹️</span>';
            btn.title = "Aawaz chal rahi hai (Rokne ke liye click karein)";
          }

          audio.onended = () => {
            if (btn) {
              btn.classList.remove("active-voice", "loading-voice");
              btn.innerHTML = '<span class="act-icon">🔊</span>';
              btn.title = "Sunno (Realistic Voice)";
            }
            if (activeVoiceBtn === btn) activeVoiceBtn = null;
            currentAudioPlayback = null;
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.error("ElevenLabs playback error:", err);
        showMunnaToast("⚠️ Aawaz load nahi hui, network check karein.");
        if (btn) {
          btn.classList.remove("loading-voice", "active-voice");
          btn.innerHTML = '<span class="act-icon">🔊</span>';
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
        msgDiv.className = "msg munna document-style";

        // AI Header (👑 Munna AI \n Online)
        const header = document.createElement("div");
        header.className = "ai-header";
        header.innerHTML = `
          <div class="ai-avatar">👑</div>
          <div class="ai-identity">
            <span class="ai-name">Munna AI</span>
            <span class="ai-status">Online</span>
          </div>
        `;

        // Clean Document Body (NO card border, NO white rectangular card, NO heavy background)
        const contentBody = document.createElement("div");
        contentBody.className = "ai-content-body";

        // Subtle Icon-Only Actions Bar (📋 🔊 ↻ 👍 👎 ⋯)
        const actionsBar = document.createElement("div");
        actionsBar.className = "ai-actions-bar";

        // 1. Copy
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "ai-icon-btn btn-copy-ai";
        copyBtn.title = "Copy response";
        copyBtn.innerHTML = '<span class="act-icon">📋</span>';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(contentBody.innerText).then(() => {
            copyBtn.innerHTML = '<span class="act-icon">✓</span>';
            setTimeout(() => copyBtn.innerHTML = '<span class="act-icon">📋</span>', 1800);
          });
        };
        actionsBar.appendChild(copyBtn);

        // 2. Voice (Sunno)
        const voiceBtn = document.createElement("button");
        voiceBtn.type = "button";
        voiceBtn.className = "ai-icon-btn btn-voice-ai";
        voiceBtn.title = "Sunno (Realistic Human Voice)";
        voiceBtn.innerHTML = '<span class="act-icon">🔊</span>';
        voiceBtn.onclick = () => {
          speakText(contentBody.innerText, voiceBtn);
        };
        actionsBar.appendChild(voiceBtn);

        // 3. Regenerate
        const regenBtn = document.createElement("button");
        regenBtn.type = "button";
        regenBtn.className = "ai-icon-btn btn-regen-ai";
        regenBtn.title = "Dobara generate karein";
        regenBtn.innerHTML = '<span class="act-icon">↻</span>';
        regenBtn.onclick = () => handleRegenerate(msgDiv);
        actionsBar.appendChild(regenBtn);

        // 4. Like (Thumbs Up)
        const likeBtn = document.createElement("button");
        likeBtn.type = "button";
        likeBtn.className = "ai-icon-btn btn-like-ai";
        likeBtn.title = "Acha laga (Jalwa!)";
        likeBtn.innerHTML = '<span class="act-icon">👍</span>';
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
        dislikeBtn.innerHTML = '<span class="act-icon">👎</span>';
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
        moreBtn.innerHTML = '<span class="act-icon">⋯</span>';
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
        // User message (compact right-aligned bubble)
        msgDiv.className = "msg user";

        const bubble = document.createElement("div");
        bubble.className = "bubble";

        const footer = document.createElement("div");
        footer.className = "msg-footer";

        const timeSpan = document.createElement("span");
        timeSpan.className = "time";
        timeSpan.innerText = getTime();
        footer.appendChild(timeSpan);

        msgDiv.appendChild(bubble);
        msgDiv.appendChild(footer);

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
          const icon = attachment.isPdf ? "📄" : "📜";
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
          <div class="ai-avatar">👑</div>
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
          <span class="history-title" title="${escapeHTML(sess.title)}">💬 ${escapeHTML(sess.title)}</span>
          <button class="history-delete-btn" title="Delete">✕</button>
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
      const hero = document.createElement("div");
      hero.className = "welcome-hero";
      hero.id = "welcomeHero";
      hero.innerHTML = `
        <div class="welcome-crest">👑</div>
        <h1 class="welcome-title">Munna AI — King of AI Models</h1>
        <p class="welcome-subtitle">"Bolo bhai, kya bawal hai? Poori problem solve karke denge, hum khade hain na peeche!"</p>
        <div class="welcome-grid">
          <button type="button" class="starter-card" data-prompt="Munna Bhaiya, ek modern full-stack web application banane ka complete blueprint aur architecture batao!">
            <span class="starter-icon">💻</span>
            <div class="starter-body">
              <span class="starter-heading">Full-Stack Web App</span>
              <span class="starter-desc">React, Node, databases aur production deployment</span>
            </div>
          </button>
          <button type="button" class="starter-card" data-prompt="Bhaiya, mere code me bug aur performance issue aa raha hai, isko debug aur optimize kaise karein?">
            <span class="starter-icon">⚡</span>
            <div class="starter-body">
              <span class="starter-heading">Code & Bug Fixer</span>
              <span class="starter-desc">Error solving, refactoring aur speed optimization</span>
            </div>
          </button>
          <button type="button" class="starter-card" data-prompt="Munna Bhaiya, market me competition ko beat karke business grow karne ka solid strategy batao!">
            <span class="starter-icon">📊</span>
            <div class="starter-body">
              <span class="starter-heading">Business & Strategy</span>
              <span class="starter-desc">Mirzapur style aggressive market growth roadmap</span>
            </div>
          </button>
          <button type="button" class="starter-card" data-prompt="Photo ya file upload karke problem solve karwao">
            <span class="starter-icon">🖼️</span>
            <div class="starter-body">
              <span class="starter-heading">Multimodal Intel</span>
              <span class="starter-desc">Screenshots, documents aur PDFs ka instant analysis</span>
            </div>
          </button>
        </div>
      `;

      hero.querySelectorAll(".starter-card").forEach(card => {
        card.onclick = () => {
          const prompt = card.getAttribute("data-prompt");
          const textarea = document.getElementById("userInput");
          const fileInput = document.getElementById("fileInput");
          if (prompt === "Photo ya file upload karke problem solve karwao" && fileInput) {
            fileInput.click();
          } else if (textarea) {
            textarea.value = prompt;
            autoResizeTextarea();
            updateSendBtnState();
            window.handleSend();
          }
        };
      });

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
        activeVoiceBtn.innerHTML = '<span class="act-icon">🔊</span>';
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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const payload = {
        system_instruction: { parts: [{ text: getSystemPrompt() }] },
        contents: session.history,
        generationConfig: { temperature: 0.85, maxOutputTokens: 2500 }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 429) {
          showMunnaToast("⚠️ Google Gemini ka daily free quota poora ho gaya hai! Kripya thoda intezaar karein.");
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.replace(/^data:\s*/, "").trim();
            if (jsonStr && jsonStr !== "[DONE]") {
              try {
                const data = JSON.parse(jsonStr);
                const part = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (part) {
                  accumulatedText += part;
                  bubbleElement.innerHTML = formatMunnaMarkdown(accumulatedText, true);
                  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
                }
              } catch (e) {}
            }
          }
        }
      }

      bubbleElement.innerHTML = formatMunnaMarkdown(accumulatedText, false);
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

      session.history.push({ role: "model", parts: [{ text: accumulatedText }] });
      session.messages.push({ sender: "munna", text: accumulatedText });
      saveSessions();

      // Automatically speak in realistic voice if autoSpeak is enabled
      if (userData && userData.autoSpeak) {
        setTimeout(() => {
          const parentMsg = bubbleElement.closest(".msg.munna");
          const voiceBtn = parentMsg ? parentMsg.querySelector(".btn-voice-ai") : null;
          speakText(accumulatedText, voiceBtn);
        }, 150);
      }

      return accumulatedText;
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
        activeVoiceBtn.innerHTML = '<span class="act-icon">🔊</span>';
        activeVoiceBtn = null;
      }
      targetMsgDiv.remove();

      if (session.messages[session.messages.length - 1].sender === "munna") session.messages.pop();
      if (session.history[session.history.length - 1].role === "model") session.history.pop();
      saveSessions();

      isSending = true;
      showTyping();
      try {
        hideTyping();
        const { bubble } = createMessageElement("munna");
        bubble.innerHTML = `<span class="streaming-cursor"></span>`;
        await streamMunnaReply(lastUser.text, bubble, lastUser.attachment || null);
      } catch (e) {
        hideTyping();
        const fallback = getOfflineMunnaReply(lastUser.text, lastUser.attachment || null);
        renderMessage(fallback, "munna");
        session.messages.push({ sender: "munna", text: fallback });
        saveSessions();
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
        activeVoiceBtn.innerHTML = '<span class="act-icon">🔊</span>';
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

      const sessionDisplayTitle = text || (currentAttachment ? `📎 ${currentAttachment.name}` : "New Chat");
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
        sendBtn.innerHTML = '<span class="send-icon">⏳</span>';
      }

      try {
        hideTyping();
        const { bubble } = createMessageElement("munna");
        bubble.innerHTML = `<span class="streaming-cursor"></span>`;
        await streamMunnaReply(text, bubble, currentAttachment);
      } catch (err) {
        console.warn("AI streaming failed, using fallback:", err);
        hideTyping();
        const fallback = getOfflineMunnaReply(text, currentAttachment);
        renderMessage(fallback, "munna");
        session.messages.push({ sender: "munna", text: fallback });
        saveSessions();
      } finally {
        isSending = false;
        if (sendBtn) {
          sendBtn.classList.remove("loading");
          sendBtn.innerHTML = '<span class="send-icon">➤</span>';
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
            if (!textarea.value.includes("[🌐 Web Search]")) {
              textarea.value = "[🌐 Web Search] " + textarea.value;
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
            if (confirm("Kya aapne ₹49 UPI payment kar diya hai? 'OK' daba kar VIP Pass activate karein!")) {
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
            alert("Galat Promo Code be! Asli code daalo (MUNNA99) ya ₹49 se unlock karo!");
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

      const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
      if (cancelLogoutBtn) cancelLogoutBtn.onclick = closeLogoutModal;

      // Close modals when clicking backdrop
      const profModal = document.getElementById("profileModal");
      const setModal = document.getElementById("settingsModal");
      const hModal = document.getElementById("helpModal");
      const logModal = document.getElementById("logoutConfirmModal");
      const aModal = document.getElementById("authModal");
      [profModal, setModal, hModal, logModal, aModal].forEach(m => {
        if (m) m.onclick = (e) => { if (e.target === m) m.classList.remove("show"); };
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
        saveProfileBtn.onclick = () => {
          const nameInput = document.getElementById("profileNameInput");
          const emailInput = document.getElementById("profileEmailInput");
          const newName = nameInput ? nameInput.value.trim() : "";
          const newEmail = emailInput ? emailInput.value.trim() : "";

          userData.name = newName || "Munna User";
          userData.email = newEmail || "abhishek@mirzapur.ai";
          safeSet("munna_user_name", userData.name);
          safeSet("munna_user_email", userData.email);

          syncUserUI();
          showMunnaToast("Profile update ho gayi bhai!");
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
      const submitReportBtn = document.getElementById("submitReportBtn");
      const problemInput = document.getElementById("problemReportInput");
      if (submitReportBtn) {
        submitReportBtn.onclick = () => {
          const text = problemInput ? problemInput.value.trim() : "";
          if (!text) {
            showMunnaToast("Pehle apna masla toh likho bhai!");
            return;
          }
          if (problemInput) problemInput.value = "";
          showMunnaToast("Masla darj ho gaya bhai, jaldi hal karenge!");
          setTimeout(closeHelpModal, 1400);
        };
      }

      // Logout Confirmation Actions
      const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
      if (confirmLogoutBtn) {
        confirmLogoutBtn.onclick = async () => {
          if (supabaseClient && currentUser) {
            try { await supabaseClient.auth.signOut(); } catch (e) {}
          }
          sessionStorage.removeItem("munna_guest_mode");
          userData.name = "Munna User";
          safeSet("munna_user_name", "Munna User");
          syncUserUI();
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


      if (signInForm) {
        signInForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!supabaseClient) {
            showMunnaToast("⚠️ Supabase connect nahi ho paya.");
            return;
          }
          const email = document.getElementById("signInEmail").value.trim();
          const password = document.getElementById("signInPassword").value;
          const btn = document.getElementById("btnSubmitSignIn");
          btn.classList.add("loading");
          btn.innerHTML = '<span class="btn-text">Dakhil ho rahe hain... ⏳</span>';

          try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showMunnaToast("👑 Dakhila safal! Darbar me swagat hai.");
            closeAuthModal();
          } catch (err) {
            showMunnaToast("⚠️ " + (err.message || "Login nahi ho paya"));
          } finally {
            btn.classList.remove("loading");
            btn.innerHTML = '<span class="btn-text">Dakhil Ho (Sign In) ➔</span>';
          }
        };
      }

      if (signUpForm) {
        signUpForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!supabaseClient) {
            showMunnaToast("⚠️ Supabase connect nahi ho paya.");
            return;
          }
          const name = document.getElementById("signUpName").value.trim();
          const email = document.getElementById("signUpEmail").value.trim();
          const password = document.getElementById("signUpPassword").value;
          const btn = document.getElementById("btnSubmitSignUp");
          btn.classList.add("loading");
          btn.innerHTML = '<span class="btn-text">Khata ban raha hai... ⏳</span>';

          try {
            const { data, error } = await supabaseClient.auth.signUp({
              email,
              password,
              options: { data: { full_name: name } }
            });
            if (error) throw error;
            showMunnaToast("✅ Khata ban gaya! Ab Sign In karein.");
            if (tabSignInBtn) tabSignInBtn.click();
            const inEmail = document.getElementById("signInEmail");
            if (inEmail) inEmail.value = email;
          } catch (err) {
            showMunnaToast("⚠️ " + (err.message || "Khata nahi ban paya"));
          } finally {
            btn.classList.remove("loading");
            btn.innerHTML = '<span class="btn-text">Naya Khata Kholein (Register) ➔</span>';
          }
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

      // Google OAuth Sign-In
      const btnScreenGoogle = document.getElementById("btnScreenGoogle");
      if (btnScreenGoogle) {
        btnScreenGoogle.onclick = async () => {
          if (!supabaseClient) {
            showMunnaToast("⚠️ Supabase connection unavailable.");
            return;
          }
          btnScreenGoogle.classList.add("loading");
          const origHtml = btnScreenGoogle.innerHTML;
          btnScreenGoogle.innerHTML = '<span>Redirecting to Google... ⏳</span>';
          try {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: window.location.href.split('#')[0]
              }
            });
            if (error) throw error;
          } catch (err) {
            console.error("Google sign-in error:", err);
            showMunnaToast("⚠️ Google sign-in: " + (err.message || "Failed to initiate"));
            btnScreenGoogle.classList.remove("loading");
            btnScreenGoogle.innerHTML = origHtml;
          }
        };
      }

      if (screenSignInForm) {
        screenSignInForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!supabaseClient) {
            showMunnaToast("⚠️ Supabase connection unavailable.");
            return;
          }
          const email = document.getElementById("screenSignInEmail").value.trim();
          const password = document.getElementById("screenSignInPassword").value;
          const btn = document.getElementById("btnScreenSignIn");
          btn.classList.add("loading");
          btn.innerHTML = '<span>Signing in... ⏳</span>';

          try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            hideAuthScreen();
            showMunnaToast("👑 Welcome to Munna AI!");
          } catch (err) {
            showMunnaToast("⚠️ " + (err.message || "Unable to sign in"));
          } finally {
            btn.classList.remove("loading");
            btn.innerHTML = '<span>Sign In to Munna AI ➔</span>';
          }
        };
      }

      if (screenSignUpForm) {
        screenSignUpForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!supabaseClient) {
            showMunnaToast("⚠️ Supabase connection unavailable.");
            return;
          }
          const name = document.getElementById("screenSignUpName").value.trim();
          const email = document.getElementById("screenSignUpEmail").value.trim();
          const password = document.getElementById("screenSignUpPassword").value;
          const btn = document.getElementById("btnScreenSignUp");
          btn.classList.add("loading");
          btn.innerHTML = '<span>Creating account... ⏳</span>';

          try {
            const { data, error } = await supabaseClient.auth.signUp({
              email,
              password,
              options: { data: { full_name: name } }
            });
            if (error) throw error;
            showMunnaToast("✅ Account created successfully! Please sign in.");
            if (screenTabSignInBtn) screenTabSignInBtn.click();
            const inEmail = document.getElementById("screenSignInEmail");
            if (inEmail) inEmail.value = email;
          } catch (err) {
            showMunnaToast("⚠️ " + (err.message || "Unable to create account"));
          } finally {
            btn.classList.remove("loading");
            btn.innerHTML = '<span>Create Your Account ➔</span>';
          }
        };
      }

      // Supabase Auth State Initialization
      async function initSupabaseAuth() {
        if (!supabaseClient) {
          updateAuthUI(null);
          showAuthScreen();
          return;
        }

        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session && session.user) {
            currentUser = session.user;
            updateAuthUI(currentUser);
            loadSessionsFromCloud();
            hideAuthScreen();
          } else {
            currentUser = null;
            updateAuthUI(null);
            showAuthScreen();
          }
        } catch (e) {
          console.warn("Auth getSession error:", e);
          updateAuthUI(null);
          showAuthScreen();
        }

        supabaseClient.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            currentUser = session.user;
            updateAuthUI(currentUser);
            hideAuthScreen();
            showMunnaToast("👑 Welcome to Munna AI, " + (currentUser.user_metadata?.full_name || currentUser.email.split("@")[0]) + "!");
            loadSessionsFromCloud();
          } else if (event === "SIGNED_OUT") {
            currentUser = null;
            updateAuthUI(null);
            sessionStorage.removeItem("munna_guest_mode");
            showAuthScreen();
            showMunnaToast("You have been signed out.");
          }
        });
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
          testVoiceBtn.innerHTML = '<span>⏹️</span> Rokhein';
          showMunnaToast("🎙️ Munna Bhaiya bol rahe hain...");
          speakText("Arey bhai, hum hain Munna AI! King of AI Models! Poori duniya me jalwa hai hamara! Har masle ka pakka prabandh karte hain!", testVoiceBtn);
        };
      }

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