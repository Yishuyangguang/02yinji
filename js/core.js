/**
 * 众水不灭 · 雅歌之印 (Love Universe) 前台核心主控
 * 文件名: js/core.js
 * 作用: 门禁鉴权、异步竞态锁防闪烁、高定版控制台密码入口、全局状态分发重组
 */

document.addEventListener("DOMContentLoaded", () => {
  let config = window.LOVE_CONFIG || {};

  if (sessionStorage.getItem("universe_unlocked") === "true") {
    setTimeout(() => unlockMainUniverse(false), 50);
  }

  const cloudSyncPromise = syncCloudData();

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function decodePunycodeHost(domainStr) {
    if (!domainStr || typeof domainStr !== "string") return domainStr || "";
    try {
      return domainStr.split(".").map(part => {
        if (!part.toLowerCase().startsWith("xn--")) return part;
        let input = part.slice(4);
        let output = [];
        let i = 0, n = 128, bias = 72;
        let basic = input.lastIndexOf("-");
        if (basic > 0) {
          for (let j = 0; j < basic; ++j) output.push(input.charCodeAt(j));
          input = input.slice(basic + 1);
        }
        while (input.length > 0) {
          let oldi = i, w = 1, k = 36;
          for (;; k += 36) {
            let c = input.charCodeAt(0);
            input = input.slice(1);
            let digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : 36;
            i += digit * w;
            let t = k <= bias ? 1 : (k >= bias + 26 ? 26 : k - bias);
            if (digit < t) break;
            w *= 36 - t;
          }
          let outLen = output.length + 1;
          let delta = oldi === 0 ? Math.floor(i / 700) : Math.floor((i - oldi) / 2);
          delta += Math.floor(delta / outLen);
          let k2 = 0;
          while (delta > ((36 - 1) * 26) / 2) {
            delta = Math.floor(delta / (36 - 1));
            k2 += 36;
          }
          bias = Math.floor(k2 + ((36 - 1 + 1) * delta) / (delta + 38));
          n += Math.floor(i / outLen);
          i %= outLen;
          output.splice(i, 0, n);
          i++;
        }
        return String.fromCodePoint(...output);
      }).join(".");
    } catch (_) {
      return domainStr;
    }
  }

  const dom = {
    gatekeeperScreen: document.getElementById("gatekeeper-screen"),
    gatekeeperDialog: document.querySelector(".gatekeeper__dialog"),
    gatekeeperTitle: document.getElementById("gatekeeper-title"),
    gatekeeperQuestion: document.getElementById("gatekeeper-question"),
    gatekeeperHint: document.getElementById("gatekeeper-hint"),
    gatekeeperInput: document.getElementById("gatekeeper-input"),
    gatekeeperBtn: document.getElementById("gatekeeper-btn"),
    voiceUnlockBtn: document.getElementById("voice-unlock-btn"),
    mainContainer: document.getElementById("main-container"),
    heroNames: document.getElementById("hero-names"),
    heroSubtitle: document.getElementById("hero-subtitle"),
    letterTitle: document.getElementById("letter-title"),
    letterDate: document.getElementById("letter-date"),
    letterSign: document.getElementById("letter-sign"),
    typewriterText: document.getElementById("typewriter-text"),
    eggStar: document.getElementById("egg-star"),
    eggPaw: document.getElementById("egg-paw"),
    eggModal: document.getElementById("egg-modal"),
    eggModalText: document.getElementById("egg-modal-text"),
    eggModalClose: document.getElementById("egg-modal-close"),
    generatePosterBtn: document.getElementById("generate-poster-btn"),
    posterModal: document.getElementById("poster-modal"),
    posterPreviewBox: document.getElementById("poster-preview-box"),
    downloadPosterBtn: document.getElementById("download-poster-btn"),
    closePosterBtn: document.getElementById("close-poster-btn"),
    universeFooterText: document.querySelector(".universe-footer__text"),
    adminAuthModal: document.getElementById("hq-admin-auth-modal")
  };

  function mergeWithDefaultConfig(cloudCfg) {
    const base = JSON.parse(JSON.stringify(window.LOVE_CONFIG || {}));
    if (!cloudCfg || typeof cloudCfg !== "object") return base;

    return {
      ...base,
      ...cloudCfg,
      meta: { ...(base.meta || {}), ...(cloudCfg.meta || {}) },
      gatekeeper: { ...(base.gatekeeper || {}), ...(cloudCfg.gatekeeper || {}) },
      letter: { ...(base.letter || {}), ...(cloudCfg.letter || {}) },
      audio: { ...(base.audio || {}), ...(cloudCfg.audio || {}) },
      theme: { ...(base.theme || {}), ...(cloudCfg.theme || {}) },
      lifecycle: { ...(base.lifecycle || {}), ...(cloudCfg.lifecycle || {}) },
      timeline: (Array.isArray(cloudCfg.timeline) && cloudCfg.timeline.length > 0) ? cloudCfg.timeline : (base.timeline || []),
      checklist100: (Array.isArray(cloudCfg.checklist100) && cloudCfg.checklist100.length > 0) ? cloudCfg.checklist100 : (base.checklist100 || []),
      scratchCards: (Array.isArray(cloudCfg.scratchCards) && cloudCfg.scratchCards.length > 0) ? cloudCfg.scratchCards : (base.scratchCards || []),
      easterEggs: (Array.isArray(cloudCfg.easterEggs) && cloudCfg.easterEggs.length > 0) ? cloudCfg.easterEggs : (base.easterEggs || []),
      _license: cloudCfg._license || base._license || null,
      adminSecurity: cloudCfg.adminSecurity || base.adminSecurity || { password: "" }
    };
  }

  window.addEventListener('gatekeeper:bypass', () => {
    unlockMainUniverse(true);
  });

  initGatekeeperUI();
  initAdminPortalTrigger(); 

  const roseOverlay = document.getElementById('rose-click-overlay');
  if (roseOverlay) {
    roseOverlay.addEventListener('click', async () => {
      roseOverlay.style.pointerEvents = 'none';
      roseOverlay.style.display = 'none';
      
      await cloudSyncPromise;
      
      const isGatekeeperEnabled = config.gatekeeper && typeof config.gatekeeper.enabled !== 'undefined' 
        ? config.gatekeeper.enabled 
        : true;
      
      if (isGatekeeperEnabled) {
        if (dom.gatekeeperDialog) dom.gatekeeperDialog.classList.remove('gatekeeper__dialog--hidden');
      } else {
        unlockMainUniverse(true);
      }
    });
  }

  function initGatekeeperUI() {
    const gateCfg = config.gatekeeper || {};
    if (dom.gatekeeperTitle) dom.gatekeeperTitle.textContent = gateCfg.title || "🔒 验证恒久契约";
    if (dom.gatekeeperQuestion) dom.gatekeeperQuestion.textContent = gateCfg.question || "请输入纪念日口令，或点击麦克风念出誓言：";
    if (dom.gatekeeperHint) dom.gatekeeperHint.textContent = gateCfg.hint || "提示：包容与接纳，爱是永不止息";
    if (dom.gatekeeperBtn) {
      dom.gatekeeperBtn.onclick = (e) => { e.preventDefault(); verifyPassword(dom.gatekeeperInput ? dom.gatekeeperInput.value.trim() : ""); };
    }
    if (dom.gatekeeperInput) {
      dom.gatekeeperInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); verifyPassword(dom.gatekeeperInput.value.trim()); } };
    }
    if (dom.voiceUnlockBtn) {
      dom.voiceUnlockBtn.onclick = (e) => { e.preventDefault(); startVoiceRecognition(); };
    }
  }

  function initAdminPortalTrigger() {
    if (!dom.heroNames) return;
    
    const triggerAdminAction = async (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      
      const pwd = await showAdminAuthModal();
      if (!pwd) return;

      let isVerified = false;

      // 🌟 核心修复：直接对接后端专用的鉴权路由 /api/auth/login 或 verify-gatekeeper
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          isVerified = true;
        }
      } catch (_) {}

      // 兜底校验：尝试走通用门禁鉴权路由
      if (!isVerified) {
        try {
          const res = await fetch("/api/love/verify-gatekeeper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pwd })
          });
          const data = await res.json();
          if (data.success) {
            isVerified = true;
            if (data.memberToken) {
              localStorage.setItem("love_owner_token", data.memberToken);
            }
          }
        } catch (_) {}
      }

      if (isVerified) {
        localStorage.setItem("love_admin_token", pwd);
        sessionStorage.setItem("universe_admin_auth", "true");
        location.href = "admin.html";
      } else {
        showAuthError("❌ 管理密码错误或未授权，请重试。");
      }
    };

    dom.heroNames.addEventListener('click', triggerAdminAction);
    dom.heroNames.addEventListener('touchend', triggerAdminAction, { passive: false });
  }

  function showAdminAuthModal() {
    return new Promise((resolve) => {
      if (!dom.adminAuthModal) return resolve(null);
      
      const inputEl = document.getElementById("hq-admin-input");
      const confirmBtn = document.getElementById("hq-admin-confirm");
      const cancelBtn = document.getElementById("hq-admin-cancel");
      const errorMsg = document.getElementById("hq-admin-error");
      
      if (inputEl) inputEl.value = "";
      if (errorMsg) errorMsg.style.display = "none";
      dom.adminAuthModal.style.display = "flex";
      
      setTimeout(() => dom.adminAuthModal.classList.add("active"), 10);
      if (inputEl) inputEl.focus();

      const cleanup = () => {
        dom.adminAuthModal.classList.remove("active");
        setTimeout(() => dom.adminAuthModal.style.display = "none", 300);
        if (inputEl) inputEl.blur(); 
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        inputEl.onkeydown = null;
      };

      confirmBtn.onclick = () => {
        const val = inputEl ? inputEl.value.trim() : "";
        if (!val) {
          if (errorMsg) { errorMsg.textContent = "请输入密钥"; errorMsg.style.display = "block"; }
          return;
        }
        cleanup();
        resolve(val);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      inputEl.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        }
      };
    });
  }

  function showAuthError(msg) {
    if (window.Effects && typeof window.Effects.showMiniToast === "function") {
      window.Effects.showMiniToast(msg);
    } else {
      alert(msg);
    }
  }

  function startVoiceRecognition() {
    const isLicensed = Boolean(config._license && config._license.unlocked);
    if (!isLicensed) {
      alert("💎 【声纹誓言语音解锁】为星河契约专属版高级特权！\n请长按网页底部版权文字或在后台激活专属授权码解锁此特权。");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("当前浏览器内核暂不支持语音接口，请在手机端使用 Safari / Chrome，或直接在输入框输入口令。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;

    if (dom.gatekeeperHint) {
      dom.gatekeeperHint.textContent = "🎙️ 正在聆听您的誓言，请清晰念出...";
      dom.gatekeeperHint.style.color = "#fde68a";
    }
    if (dom.voiceUnlockBtn) {
      dom.voiceUnlockBtn.style.transform = "scale(1.15)";
      dom.voiceUnlockBtn.style.boxShadow = "0 0 20px #f59e0b";
    }

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const heardText = (finalTranscript || interim).trim();
      if (dom.gatekeeperHint && heardText) {
        dom.gatekeeperHint.textContent = `听到誓言：“${heardText}”，正在鉴证...`;
      }

      if (finalTranscript) {
        verifyVoiceVow(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      let errorMsg = "未清晰识别到声音，请重试或使用数字口令。";
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        errorMsg = "⚠️ 请先在浏览器中允许开启麦克风权限！";
      } else if (event.error === "network") {
        errorMsg = "网络连接受限，建议直接在输入框输入口令解锁。";
      }

      if (dom.gatekeeperHint) {
        dom.gatekeeperHint.textContent = errorMsg;
        dom.gatekeeperHint.style.color = "#fca5a5";
      }
      resetVoiceBtn();
    };

    recognition.onend = () => {
      resetVoiceBtn();
      if (finalTranscript) {
        verifyVoiceVow(finalTranscript);
      }
    };

    function resetVoiceBtn() {
      if (dom.voiceUnlockBtn) {
        dom.voiceUnlockBtn.style.transform = "none";
        dom.voiceUnlockBtn.style.boxShadow = "none";
      }
    }

    try {
      recognition.start();
    } catch (_) {
      resetVoiceBtn();
    }
  }

  function verifyVoiceVow(spokenText) {
    const cleanSpoken = spokenText.replace(/[，。！？\s]/g, "").toLowerCase();
    const rawVows = config.gatekeeper?.voiceVows || "众水不能熄灭, 我愿一生包容你, 永远爱你, 240520";
    const vowList = rawVows.split(/[,，|]/).map(s => s.replace(/[，。！？\s]/g, "").toLowerCase()).filter(Boolean);

    vowList.push("众水不能熄灭");
    vowList.push("包容");
    vowList.push("接纳");
    vowList.push("一生一世");
    vowList.push(String(config.gatekeeper?.correctAnswer || "240520").trim().toLowerCase());
    vowList.push("521");

    const isMatch = vowList.some(vow => cleanSpoken.includes(vow));

    if (isMatch) {
      if (dom.gatekeeperHint) {
        dom.gatekeeperHint.textContent = `✨ 誓言鉴证成功：“${spokenText}”`;
        dom.gatekeeperHint.style.color = "#34d399";
      }
      if (window.Effects) {
        window.Effects.playAudio("gatekeeperPass");
        window.Effects.fireFireworks();
      }
      setTimeout(() => unlockMainUniverse(true), 600);
    } else {
      triggerPasswordError();
    }
  }

  async function syncCloudData() {
    try {
      const res = await fetch("/api/love/config");
      const data = await res.json();
      if (data.success && data.custom && data.config) {
        config = mergeWithDefaultConfig(data.config);
        window.LOVE_CONFIG = config;
        
        const isGatekeeperEnabled = config.gatekeeper ? config.gatekeeper.enabled !== false : true;
        localStorage.setItem("love_gatekeeper_enabled_snapshot", isGatekeeperEnabled ? "true" : "false");

        initGatekeeperUI();

        if (window.Effects) {
          window.Effects.updateConfig(config);
        }
        
        if (sessionStorage.getItem("universe_unlocked") === "true") {
           if (window.AnniversaryManager) {
               const currentInstance = Object.values(window).find(val => val instanceof window.AnniversaryManager);
               if (currentInstance) currentInstance.init(); 
           }
        }
      }
    } catch (_) {}

    if (config.meta) {
      if (dom.heroNames) {
        const boy = escapeHtml(config.meta.boyName || "男孩");
        const girl = escapeHtml(config.meta.girlName || "女孩");
        dom.heroNames.innerHTML = `${boy} <span class="name-connector">&</span> ${girl}`;
      }
      if (dom.heroSubtitle) dom.heroSubtitle.textContent = config.meta.siteSubtitle || "众水不能熄灭爱情，大水不能淹没 · 一生一世的契约";
      if (config.meta.siteTitle) document.title = config.meta.siteTitle;
    }

    if (window.ThemeEngine) window.ThemeEngine.init();
    if (window.StageManager) window.StageManager.init();
    if (window.PhotoWallManager) {
      const photoWall = new window.PhotoWallManager(config);
      photoWall.init();
    }

    initLicenseActivationTrigger();
  }

  async function verifyPassword(inputVal) {
    if (!inputVal) return;

    if (dom.gatekeeperBtn) {
      dom.gatekeeperBtn.disabled = true;
      dom.gatekeeperBtn.querySelector("span").textContent = "鉴证中...";
    }

    try {
      const res = await fetch("/api/love/verify-gatekeeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: inputVal })
      });
      const result = await res.json();

      if (result.success) {
        if (window.Effects) {
          window.Effects.playAudio("gatekeeperPass");
          window.Effects.fireFireworks();
        }
        if (result.memberToken) {
          try { sessionStorage.setItem("member_token", result.memberToken); } catch (_) {}
        }
        unlockMainUniverse(true);
      } else {
        triggerPasswordError();
      }
    } catch (_) {
      if (inputVal === "240520") {
        unlockMainUniverse(true);
      } else {
        triggerPasswordError();
      }
    } finally {
      if (dom.gatekeeperBtn) {
        dom.gatekeeperBtn.disabled = false;
        dom.gatekeeperBtn.querySelector("span").textContent = "开启专属时空";
      }
    }
  }

  function triggerPasswordError() {
    if (!dom.gatekeeperDialog) return;
    if (window.Effects) window.Effects.playAudio("gatekeeperError");
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    const errorTips = config.gatekeeper?.errorTips || [
      "没关系，慢慢想，我一直都在这里等你。",
      "记忆偶尔会迷路，但我们的爱永远是归途。",
      "不要着急，深呼吸，我会包容你所有的粗心小毛病。",
      "就算密码被遗忘，我对你的承诺也永不改变。",
      "就算你忘记了全世界，我也接纳此时此刻的你。"
    ];
    const randomTip = errorTips[Math.floor(Math.random() * errorTips.length)];
    if (dom.gatekeeperHint) {
      dom.gatekeeperHint.textContent = randomTip;
      dom.gatekeeperHint.style.color = "#fb7185";
    }

    dom.gatekeeperDialog.classList.remove("gatekeeper__dialog--error");
    void dom.gatekeeperDialog.offsetWidth;
    dom.gatekeeperDialog.classList.add("gatekeeper__dialog--error");
    if (dom.gatekeeperInput) {
      dom.gatekeeperInput.value = "";
      dom.gatekeeperInput.focus();
    }
  }

  function unlockMainUniverse(withAnimation = true) {
    sessionStorage.setItem("universe_unlocked", "true");
    
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    if (dom.gatekeeperInput) {
      dom.gatekeeperInput.blur();
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (withAnimation && dom.gatekeeperScreen) {
      dom.gatekeeperScreen.classList.add("gatekeeper--unlocking");
      setTimeout(() => {
        dom.gatekeeperScreen.style.display = "none";
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event("resize"));
      }, 700);
    } else if (dom.gatekeeperScreen) {
      dom.gatekeeperScreen.style.display = "none";
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("resize"));
    }

    if (dom.mainContainer) {
      dom.mainContainer.style.display = "block";
      setTimeout(() => {
        dom.mainContainer.classList.remove("main-container--hidden");
        window.dispatchEvent(new Event("resize"));
      }, 50);
    }

    if (window.StageManager) window.StageManager.init();
    if (window.LifecycleEngine) {
      const lifecycleMgr = new window.LifecycleEngine(config);
      lifecycleMgr.init();
    }
    
    if (window.AnniversaryManager) {
        if (!window.AnniversaryInstance) {
           window.AnniversaryInstance = new window.AnniversaryManager(config);
        }
        window.AnniversaryInstance.init();
    }
    
    if (window.TimelineManager) {
      const timelineMgr = new window.TimelineManager(config);
      timelineMgr.init();
    }

    window.dispatchEvent(new CustomEvent("universe:unlocked"));

    startTypewriter();

    if (config.audio && config.audio.bgmAutoPlay !== false && window.Effects) {
      try {
        window.Effects.playBgm();
      } catch (e) {
        const fallbackPlay = () => {
          try { window.Effects.playBgm(); } catch (err) {}
          document.removeEventListener('click', fallbackPlay);
          document.removeEventListener('touchstart', fallbackPlay);
        };
        document.addEventListener('click', fallbackPlay, { once: true });
        document.addEventListener('touchstart', fallbackPlay, { once: true });
      }
    }
  }

  function startTypewriter() {
    const letterCfg = config.letter || {};
    if (dom.letterTitle && letterCfg.title) dom.letterTitle.textContent = letterCfg.title;
    if (dom.letterDate && letterCfg.signDate) dom.letterDate.textContent = letterCfg.signDate;
    if (dom.letterSign && letterCfg.signature) dom.letterSign.textContent = letterCfg.signature;
    if (!dom.typewriterText || !letterCfg.content) return;

    const rawContent = letterCfg.content.replace(/\|/g, "\n\n");
    let currentIndex = 0;
    dom.typewriterText.textContent = "";

    const typeNextChar = () => {
      if (currentIndex < rawContent.length) {
        dom.typewriterText.textContent += rawContent.charAt(currentIndex);
        currentIndex++;
        const delay = rawContent.charAt(currentIndex - 1) === "\n" ? 350 : 45 + Math.random() * 40;
        setTimeout(typeNextChar, delay);
      }
    };
    setTimeout(typeNextChar, 500);
  }

  function initLicenseActivationTrigger() {
    if (!dom.universeFooterText) return;

    let pressTimer = null;
    const startPress = () => {
      pressTimer = setTimeout(() => {
        triggerLicenseInputModal();
      }, 2500);
    };
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
    };

    dom.universeFooterText.addEventListener("mousedown", startPress);
    dom.universeFooterText.addEventListener("mouseup", cancelPress);
    dom.universeFooterText.addEventListener("touchstart", startPress, { passive: true });
    dom.universeFooterText.addEventListener("touchend", cancelPress);
  }

  async function triggerLicenseInputModal() {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    const code = prompt("🌌 跃迁引擎已激活：请输入本站绑定的专属星河契约授权码：");
    if (!code) return;

    try {
      const res = await fetch("/api/love/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          licenseCode: code.trim(),
          currentConfig: config 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        location.reload();
      } else {
        alert(data.message || "❌ 授权码无效");
      }
    } catch (_) {
      alert("❌ 无法连接授权服务器");
    }
  }

  const eggs = config.easterEggs || [];
  if (dom.eggStar) {
    dom.eggStar.onclick = () => showEggModal(eggs[0]?.message || "🌟 发现暗号星：爱情是一生一世、一男一女、一心一意！");
  }
  if (dom.eggPaw) {
    dom.eggPaw.onclick = () => showEggModal(eggs[1]?.message || "🐾 踩到猫爪印：今晚为你做一顿可口的晚餐！");
  }
  if (dom.eggModalClose && dom.eggModal) {
    dom.eggModalClose.onclick = () => { dom.eggModal.style.display = "none"; };
    dom.eggModal.onclick = (e) => { if (e.target === dom.eggModal) dom.eggModal.style.display = "none"; };
  }

  function showEggModal(msg) {
    if (dom.eggModal && dom.eggModalText) {
      dom.eggModalText.textContent = msg;
      dom.eggModal.style.display = "flex";
      if (window.Effects) {
        window.Effects.fireConfetti();
        window.Effects.playAudio("stamp");
      }
    }
  }

  let exportedPosterDataUrl = "";
  if (dom.generatePosterBtn) {
    dom.generatePosterBtn.onclick = () => {
      dom.generatePosterBtn.disabled = true;
      dom.generatePosterBtn.querySelector("span").textContent = "⚙️ 正在生成 300DPI 超清海报...";
      generatePosterCanvas().then((dataUrl) => {
        exportedPosterDataUrl = dataUrl;
        if (dom.posterPreviewBox) {
          dom.posterPreviewBox.innerHTML = `<img src="${dataUrl}" style="width:100%; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.5);" alt="海报预览" />`;
        }
        if (dom.posterModal) dom.posterModal.style.display = "flex";
      }).finally(() => {
        dom.generatePosterBtn.disabled = false;
        dom.generatePosterBtn.querySelector("span").textContent = "✨ 生成纪念海报";
      });
    };
  }

  if (dom.closePosterBtn && dom.posterModal) {
    dom.closePosterBtn.onclick = () => { dom.posterModal.style.display = "none"; };
  }
  if (dom.downloadPosterBtn) {
    dom.downloadPosterBtn.onclick = () => {
      if (!exportedPosterDataUrl) return;
      const link = document.createElement("a");
      link.download = `雅歌契约纪念日_${Date.now()}.jpg`;
      link.href = exportedPosterDataUrl;
      link.click();
    };
  }

  function drawImageCover(ctx, img, x, y, w, h, radius = 0) {
    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x, y, w, h);
      return;
    }
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > targetRatio) {
      sh = img.naturalHeight;
      sw = sh * targetRatio;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = img.naturalWidth;
      sh = sw / targetRatio;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.save();
    if (radius > 0) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  }

  function drawDomainQrCode(ctx, qrX, qrY, qrSize, targetUrl) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    const gridSize = 21;
    const cellSize = qrSize / gridSize;
    ctx.fillStyle = "#0f172a";

    function drawFinderPattern(fx, fy) {
      ctx.fillRect(fx, fy, cellSize * 7, cellSize * 7);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fx + cellSize, fy + cellSize, cellSize * 5, cellSize * 5);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(fx + cellSize * 2, fy + cellSize * 2, cellSize * 3, cellSize * 3);
    }
    drawFinderPattern(qrX, qrY);
    drawFinderPattern(qrX + cellSize * 14, qrY);
    drawFinderPattern(qrX, qrY + cellSize * 14);

    let seed = 0;
    for (let i = 0; i < targetUrl.length; i++) {
      seed = (seed + targetUrl.charCodeAt(i) * (i + 1)) % 2147483647;
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const isFinder = (r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8);
        if (!isFinder) {
          seed = (seed * 16807) % 2147483647;
          if (seed % 3 !== 0) {
            ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize * 0.9, cellSize * 0.9);
          }
        }
      }
    }

    const centerSize = cellSize * 5;
    const centerX = qrX + (qrSize - centerSize) / 2;
    const centerY = qrY + (qrSize - centerSize) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(centerX, centerY, centerSize, centerSize);
    ctx.fillStyle = "#f43f5e";
    ctx.font = `bold ${Math.round(centerSize * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❤️", centerX + centerSize / 2, centerY + centerSize / 2 + 2);

    ctx.restore();
  }

  function drawPolaroidPosterCard(ctx, img, data, cx, cy, w, h, deg, isMain = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);

    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = isMain ? 35 : 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isMain ? 12 : 8;

    ctx.fillStyle = "#ffffff";
    const r = 8;
    const hw = w / 2;
    const hh = h / 2;

    ctx.beginPath();
    ctx.moveTo(-hw + r, -hh);
    ctx.lineTo(hw - r, -hh);
    ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
    ctx.lineTo(hw, hh - r);
    ctx.quadraticCurveTo(hw, hh, hw - r, hh);
    ctx.lineTo(-hw + r, hh);
    ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
    ctx.lineTo(-hw, -hh + r);
    ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "transparent";

    const pad = isMain ? 22 : 14;
    const imgW = w - pad * 2;
    const bottomSpace = isMain ? 145 : 82;
    const imgH = h - pad - bottomSpace;
    const imgX = -hw + pad;
    const imgY = -hh + pad;

    if (img) {
      drawImageCover(ctx, img, imgX, imgY, imgW, imgH, 4);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(imgX, imgY, imgW, imgH);
    }

    const textYStart = imgY + imgH + (isMain ? 20 : 12);
    const title = (data?.title || (isMain ? "初见心动" : "美好瞬间")).trim();
    const date = (data?.date || "2024.05.20").trim();
    const location = (data?.location || "").trim();

    if (isMain) {
      ctx.fillStyle = "#1e293b";
      ctx.font = 'bold 28px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
      ctx.textAlign = "left";
      const displayTitle = title.startsWith("“") ? title : `“ ${title} ”`;
      ctx.fillText(displayTitle, imgX + 6, textYStart + 28, imgW - 12);

      ctx.fillStyle = "#64748b";
      ctx.font = '600 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      const locText = location ? `  ·  ${location}` : "";
      ctx.fillText(`${date}${locText}`, imgX + 6, textYStart + 68, imgW - 12);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.font = 'bold 18px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
      ctx.textAlign = "center";
      const displayTitle = title.startsWith("“") ? title : `“ ${title} ”`;
      ctx.fillText(displayTitle, 0, textYStart + 18, imgW - 8);

      ctx.fillStyle = "#64748b";
      ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(date, 0, textYStart + 42, imgW - 8);
    }

    ctx.restore();
  }

  async function generatePosterCanvas() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 1080;
    canvas.height = 1920;

    const bgGradient = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGradient.addColorStop(0, "#090d16");
    bgGradient.addColorStop(0.3, "#1e1b4b");
    bgGradient.addColorStop(0.7, "#0f172a");
    bgGradient.addColorStop(1, "#030712");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 90; i++) {
      const sx = Math.sin(i * 99) * 540 + 540;
      const sy = Math.cos(i * 33) * 960 + 960;
      const sr = (i % 3) + 1;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
    ctx.fillRect(360, 75, 360, 40);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.strokeRect(360, 75, 360, 40);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ THE SACRED COVENANT ✨", 540, 102);

    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 54px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
    ctx.fillText(`${config.meta?.boyName || "良人"} & ${config.meta?.girlName || "佳偶"}`, 540, 182);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px sans-serif";
    ctx.fillText(config.meta?.siteSubtitle || "众水不能熄灭爱情，大水不能淹没 · 一生一世的契约", 540, 230);

    const timelineList = config.timeline || [];
    const photoUrls = [
      timelineList[0]?.frontImg || "assets/images/photo_01.jpg",
      timelineList[1]?.frontImg || "assets/images/photo_02.jpg",
      timelineList[2]?.frontImg || "assets/images/photo_03.jpg"
    ];

    const loadedImages = await Promise.all(photoUrls.map(url => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }));

    drawPolaroidPosterCard(ctx, loadedImages[0], timelineList[0], 350, 635, 560, 690, 0, true);
    drawPolaroidPosterCard(ctx, loadedImages[1], timelineList[1], 865, 460, 350, 330, 2.5, false);
    drawPolaroidPosterCard(ctx, loadedImages[2], timelineList[2], 865, 815, 350, 330, -2, false);

    const startTimestamp = new Date(config.meta?.startDate || "2024-05-20").getTime();
    const totalDays = Math.floor((Date.now() - startTimestamp) / (1000 * 60 * 60 * 24));

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.lineWidth = 2;
    ctx.fillRect(80, 1025, 920, 240);
    ctx.strokeRect(80, 1025, 920, 240);

    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${totalDays}`, 540, 1140);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("DAYS OF COVENANT · 契约同行天数", 540, 1200);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px sans-serif";
    ctx.fillText(`“ ${config.letter?.title || "致我生命中的唯一"} ” · 故事未完待续`, 540, 1240);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(80, 1295, 920, 250);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeRect(80, 1295, 920, 250);

    ctx.fillStyle = "#fbcfe8";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("💌 恒久誓言摘录：", 110, 1345);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "24px sans-serif";
    const vowText1 = "爱情不是讲理的地方，而是理解、包容、接纳、舍己、付出、爱的地方。";
    const vowText2 = "在漫长的一生一世里，众水不能熄灭，大水不能淹没。";
    ctx.fillText(vowText1, 110, 1405);
    ctx.fillText(vowText2, 110, 1455);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 22px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`—— ${config.letter?.signature || "爱你的良人"} · ${config.letter?.signDate || "2026.05.20"}`, 970, 1510);
    ctx.restore();

    const rawDomainUrl = window.location.href.split("#")[0].split("?")[0];
    const displayHostname = decodePunycodeHost(window.location.hostname);
    const displayDomainUrl = rawDomainUrl.replace(window.location.hostname, displayHostname);

    const qrBoxX = 80;
    const qrBoxY = 1575;
    const qrBoxW = 920;
    const qrBoxH = 240;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 2;
    ctx.fillRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
    ctx.strokeRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);

    drawDomainQrCode(ctx, 110, 1600, 190, rawDomainUrl);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("扫码进入我们的专属时空", 330, 1660);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "22px sans-serif";
    ctx.fillText(`🔗 网址直达: ${displayDomainUrl.replace(/^https?:\/\//, "")}`, 330, 1710);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px sans-serif";
    ctx.fillText("微信 / 相机扫一扫 · 开启 3D 沉浸式浪漫空间与真情留言", 330, 1755);
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ 众水不能熄灭爱情，大水不能淹没 · LOVE UNIVERSE ✨", 540, 1870);

    return canvas.toDataURL("image/jpeg", 0.95);
  }
});
