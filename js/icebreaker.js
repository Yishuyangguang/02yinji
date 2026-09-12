/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/icebreaker.js
 * 作用: 破冰与情感信号箱客户端主控 (动态字典映射、长文本渲染、乐观 UI 更新)
 */

class IceBreakerManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.deviceId = this.getOrCreateDeviceId();
    this.pollTimer = null;
    this.audioContext = null;
    this.currentPosterDataUrl = "";
    
    this.lastNotifiedFingerprint = null;
    this.lastFetchTime = 0;
    this.handledSignalIds = new Set();
    this.toastTimeout = null;
  }

  getOrCreateDeviceId() {
    let devId = localStorage.getItem("love_device_id");
    if (!devId) {
      devId = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      localStorage.setItem("love_device_id", devId);
    }
    return devId;
  }

  escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  decodePunycodeHost(domainStr) {
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

  showToast(msg, type = "info") {
    let toast = document.getElementById("icebreaker-toast-layer");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "icebreaker-toast-layer";
      Object.assign(toast.style, {
        position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%) translateY(-20px)",
        color: "#fff", padding: "12px 24px", borderRadius: "30px",
        fontSize: "14px", fontWeight: "800", boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        backdropFilter: "blur(12px)", zIndex: "99999", opacity: "0", pointerEvents: "none",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", whiteSpace: "nowrap"
      });
      document.body.appendChild(toast);
    }

    if (type === "error" || type === "warning") {
      toast.style.background = "rgba(220, 38, 38, 0.95)"; 
    } else if (type === "success") {
      toast.style.background = "rgba(16, 185, 129, 0.95)"; 
    } else {
      toast.style.background = "rgba(31, 41, 55, 0.95)"; 
    }

    toast.innerHTML = msg;
    void toast.offsetWidth; 
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-20px)";
    }, 3500);
  }

  init() {
    const container = document.getElementById("icebreaker-container");
    if (!container) return;

    this.renderActionButtons(container);
    this.bindGlobalEvents();
    this.bindStageLifecycle();
    this.initAudioContext();
    this.executePoll(); 
    this.fetchAndRenderHistory();
  }

  bindStageLifecycle() {
    window.addEventListener("stage:opened", (e) => {
      const stageId = e.detail && e.detail.stageId;
      if (stageId === "icebreaker") {
        this.fetchAndRenderHistory();
      }
    });
  }

  renderActionButtons(container) {
    const phase = this.config.lifecycle?.currentPhase || "dating";
    const allActions = this.config.icebreaker?.actions || {};
    const currentActions = allActions[phase] || allActions["dating"] || [];

    const section = document.getElementById("icebreaker-section");
    if (currentActions.length === 0) {
      if (section) section.style.display = "none";
      return;
    }
    if (section) section.style.display = "block";

    // 🌟 核心拦截：如果是游客（无 Token），直接展示上锁界面，杜绝乱点
    const isOwner = !!localStorage.getItem("love_owner_token");
    if (!isOwner) {
      container.innerHTML = `
        <div style="text-align:center; padding:24px; background:rgba(255,255,255,0.03); border:1.5px dashed rgba(255,255,255,0.15); border-radius:18px; margin-bottom:16px;">
          <span style="font-size:32px; display:block; margin-bottom:12px; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));">🔒</span>
          <span style="color:#e2e8f0; font-size:14px; font-weight:800; line-height:1.6; display:block;">展览模式：情感信号发射舱已锁定<br><span style="color:#94a3b8; font-size:12px;">仅持印者有权限发送破冰信笺</span></span>
        </div>
      `;
      return;
    }

    // 正常主人的渲染逻辑
    container.innerHTML = currentActions.map(action => `
      <button class="icebreaker-btn" data-action-type="${action.type}">
        <span class="icebreaker-btn__icon">${action.icon}</span>
        <span class="icebreaker-btn__label">${action.label}</span>
        <span class="icebreaker-btn__desc">${this.escapeHtml(action.desc)}</span>
      </button>
    `).join("");

    container.querySelectorAll(".icebreaker-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const actionType = btn.getAttribute("data-action-type");
        this.handleSendSignal(actionType, btn);
        
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      };
    });
  }

  async handleSendSignal(actionType, clickedBtn) {
    const phase = this.config.lifecycle?.currentPhase || "dating";
    const perspective = (window.ThemeEngine && window.ThemeEngine.currentPerspective) || "boy";

    if (navigator.vibrate) navigator.vibrate([30, 40]);

    const allBtns = document.querySelectorAll(".icebreaker-btn");
    allBtns.forEach(btn => btn.style.pointerEvents = "none"); 

    const originalHtml = clickedBtn ? clickedBtn.innerHTML : "";
    const originalBorder = clickedBtn ? clickedBtn.style.borderColor : "";
    const originalBg = clickedBtn ? clickedBtn.style.background : "";

    if (clickedBtn) {
      clickedBtn.innerHTML = `<span class="icebreaker-btn__icon">⏳</span><span class="icebreaker-btn__label" style="color:#f59e0b;">信号发射中...</span>`;
    }

    this.showToast("⏳ 正在飞向对方时空，请稍候...");

    try {
      const signalPayload = (window.LOVE_ICE_ACTIONS && window.LOVE_ICE_ACTIONS.buildSignalPayload)
        ? window.LOVE_ICE_ACTIONS.buildSignalPayload(this.config, {
            stage: phase,
            senderGender: perspective,
            senderDeviceId: this.deviceId,
            actionType
          })
        : { stage: phase, senderGender: perspective, senderDeviceId: this.deviceId, actionType, customText: "" };
      
      const res = await fetch("/api/love/signal", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          // 附带 Token，否则会被后端熔断器拒绝
          "x-member-token": localStorage.getItem("love_owner_token") || ""
        },
        body: JSON.stringify(signalPayload)
      });

      const data = await res.json();

      if (data.success) {
        this.playGentleChime();
        if (data.status === "mutual_resolved") {
          this.showMutualCelebration(data.signal);
        } else {
          this.showToast("🕊️ 发送成功！破冰信笺已送达对方。", "success");
          if (clickedBtn) {
            clickedBtn.innerHTML = `<span class="icebreaker-btn__icon">✓</span><span class="icebreaker-btn__label" style="color:#10b981;">已发送</span>`;
            clickedBtn.style.borderColor = "#10b981";
            clickedBtn.style.background = "rgba(16, 185, 129, 0.05)";
          }
          this.triggerSendingPulse();
        }
        
        if (data.signal && data.signal.signalId) {
          this.handledSignalIds.add(data.signal.signalId);
        }
        
        this.executePoll(); 
        this.fetchAndRenderHistory();
      } else if (data.code === "IN_COOLDOWN") {
        this.showToast(`⏳ 对方需要时间消化，请等待 ${data.remainingSeconds} 秒后再试`, "warning");
        if (clickedBtn) clickedBtn.innerHTML = originalHtml;
      } else {
        this.showToast(`⚠️ ${data.message || data.error}`, "error");
        if (clickedBtn) clickedBtn.innerHTML = originalHtml;
      }
    } catch (err) {
      console.warn("[信号系统] 网络异常:", err.message);
      this.showToast("⚠️ 网络异常，信号发射失败", "error");
      if (clickedBtn) clickedBtn.innerHTML = originalHtml;
    } finally {
      allBtns.forEach(btn => btn.style.pointerEvents = "auto");
      
      if (clickedBtn) {
        setTimeout(() => {
          clickedBtn.innerHTML = originalHtml;
          clickedBtn.style.borderColor = originalBorder;
          clickedBtn.style.background = originalBg;
        }, 3000);
      }
    }
  }

  async executePoll() {
    this.lastFetchTime = Date.now();
    clearTimeout(this.pollTimer);

    try {
      const res = await fetch("/api/love/signal");
      if (res.ok) {
        const data = await res.json();
        this.handleServerSignalResponse(data);
      }
    } catch (_) {}

    const nextInterval = document.hidden ? 600000 : 40000;
    this.pollTimer = setTimeout(() => this.executePoll(), nextInterval);
  }

  _getActionMeta(actionType) {
    const allActions = this.config.icebreaker?.actions || window.LOVE_CONFIG?.icebreaker?.actions || {};
    const resolver = window.LOVE_ICE_ACTIONS && window.LOVE_ICE_ACTIONS.resolveActionMeta;
    if (typeof resolver === "function") {
      return resolver(allActions, actionType);
    }
    let foundMeta = null;
    for (const stageKey in allActions) {
      if (Array.isArray(allActions[stageKey])) {
        const match = allActions[stageKey].find(a => a && a.type === actionType);
        if (match) {
          foundMeta = match;
          break;
        }
      }
    }
    return foundMeta || { 
      label: "温情信笺", 
      icon: "💌", 
      desc: "对方发来了一封破冰信笺，希望能和你和好。" 
    };
  }

  triggerSystemNotification(signal) {
    const fingerprint = `${signal.signalId}_${signal.status}`;
    if (this.lastNotifiedFingerprint === fingerprint) return;
    this.lastNotifiedFingerprint = fingerprint;

    let title = "💌 收到新的情感信号";
    let body = "对方递来了一封信笺...";
    
    if (signal.status === "mutual_resolved") {
       title = "✨ 双向奔赴的和好";
       body = "奇妙的默契！你们在同一刻选择了彼此与和好！";
    } else if (signal.status === "accepted" && signal.senderDeviceId === this.deviceId) {
       title = "🎉 破冰成功";
       body = "对方已接纳了你的信号，愿爱永不止息。";
    } else if (signal.status === "active") {
       const senderTitle = signal.senderGender === "boy" ? "他" : "她";
       const meta = this._getActionMeta(signal.actionType);
       title = `${meta.icon} ${meta.label}`;
       body = `${senderTitle} 发送了信笺：\n“${signal.content || meta.desc}”`;
    } else {
       return; 
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
         const notification = new Notification(title, { 
           body: body, 
           icon: "/favicon-32x32.png" 
         });
         notification.onclick = () => {
           window.focus();
           notification.close();
         };
      } catch(e) {}
    }
  }

  handleServerSignalResponse(data) {
    const active = data.activeSignal;

    if (!active) {
      this.hideBanner();
      return;
    }

    if (this.handledSignalIds.has(active.signalId)) {
      if (active.status === "active" || active.status === "viewed" || active.status === "cooling") {
        this.hideBanner();
        return; 
      }
    }

    if (active.status === "mutual_resolved") {
      if (!this.currentActiveSignal || this.currentActiveSignal.status !== "mutual_resolved") {
        this.currentActiveSignal = active;
        this.triggerSystemNotification(active); 
        this.showMutualCelebration(active);
        this.fetchAndRenderHistory();
      }
      return;
    }

    if (active.senderDeviceId === this.deviceId) {
      if (active.status === "accepted" && (!this.currentActiveSignal || this.currentActiveSignal.status !== "accepted")) {
        this.currentActiveSignal = active;
        this.triggerSystemNotification(active); 
        this.showAcceptedCelebration(active);
        this.fetchAndRenderHistory();
      }
      return;
    }

    if (active.status === "active" || active.status === "viewed" || active.status === "cooling") {
      if (!this.currentActiveSignal || this.currentActiveSignal.status !== active.status) {
        this.currentActiveSignal = active;
        if (active.status === "active") {
           this.triggerSystemNotification(active); 
        }
        this.showIncomingBanner(active);
      }
    }
  }

  showIncomingBanner(signal) {
    const banner = document.getElementById("icebreaker-banner");
    const textEl = document.getElementById("icebreaker-banner-text");
    if (!banner || !textEl) return;

    const senderTitle = signal.senderGender === "boy" ? "他" : "她";
    const meta = this._getActionMeta(signal.actionType);
    let actionTip = `${senderTitle} 发送了：[${meta.label}]`;

    textEl.textContent = `💌 ${actionTip}`;
    banner.classList.add("show");

    banner.onclick = (e) => {
      e.preventDefault();
      this.openReconciliationModal(signal);
      this.ackSignal("viewed", signal.signalId);
    };
  }

  hideBanner() {
    const banner = document.getElementById("icebreaker-banner");
    if (banner) banner.classList.remove("show");
  }

  openReconciliationModal(signal) {
    const modal = document.getElementById("icebreaker-modal");
    if (!modal) return;

    this.hideBanner();
    this.playGentleChime();

    const badgeEl = document.getElementById("icebreaker-modal-badge");
    const titleEl = document.getElementById("icebreaker-modal-title");
    const letterEl = document.getElementById("icebreaker-modal-letter");
    const actionsEl = document.getElementById("icebreaker-modal-actions");

    const senderTitle = signal.senderGender === "boy" ? "良人" : "佳偶";
    const meta = this._getActionMeta(signal.actionType);
    const displayDesc = signal.content || meta.desc;

    if (badgeEl) badgeEl.textContent = `SACRED COVENANT · ${senderTitle}的温情信笺`;
    if (titleEl) titleEl.textContent = "愿爱化解一切 · 我们的避风港";
    if (letterEl) {
      letterEl.textContent = `“ ${displayDesc} ”`;
      letterEl.style.lineHeight = "1.7";
      letterEl.style.textAlign = "justify";
    }

    if (actionsEl) {
      // 🌟 核心拦截：弹窗内的操作也必须验证权限
      const isOwner = !!localStorage.getItem("love_owner_token");
      
      if (!isOwner) {
        actionsEl.innerHTML = `
          <div style="text-align:center; padding:16px; margin-bottom:12px; background:rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.2); border-radius:12px;">
            <span style="color:#cbd5e1; font-size:13.5px; font-weight:800;">🔒 展览模式：此信笺仅持印者可回应</span>
          </div>
          <button class="icebreaker-btn-secondary" id="btn-close-modal"><span>收起 ✕</span></button>
        `;
        const closeBtn = document.getElementById("btn-close-modal");
        if (closeBtn) {
          closeBtn.onclick = () => { this.hideBanner(); this.closeModal(); };
        }
      } else {
        // 主人正常可见操作按钮
        actionsEl.innerHTML = `
          <button class="icebreaker-btn-primary" id="btn-accept-peace"><span>🕊️ 握住这只手 (接纳并和好)</span></button>
          <button class="icebreaker-btn-secondary" id="btn-wait-peace"><span>还在整理心情中 (稍等片刻)</span></button>
          <button class="icebreaker-btn-secondary" id="btn-close-modal"><span>收起 ✕</span></button>
        `;

        const acceptBtn = document.getElementById("btn-accept-peace");
        const waitBtn = document.getElementById("btn-wait-peace");
        const closeBtn = document.getElementById("btn-close-modal");

        if (acceptBtn) {
          acceptBtn.onclick = () => {
            this.handledSignalIds.add(signal.signalId); 
            this.hideBanner();
            this.closeModal();
            this.ackSignal("accept", signal.signalId, "我们和好吧，爱是永不止息。");
            this.showAcceptedCelebration(signal);
            this.fetchAndRenderHistory();
          };
        }
        if (waitBtn) {
          waitBtn.onclick = () => {
            this.handledSignalIds.add(signal.signalId); 
            this.hideBanner();
            this.closeModal();
            this.ackSignal("wait_a_bit", signal.signalId, "还在整理心情，很快就好。");
            this.showToast("💖 回应已送达！已通知对方你正在整理心情", "success");
          };
        }
        if (closeBtn) {
          closeBtn.onclick = () => {
            this.hideBanner();
            this.closeModal();
          };
        }
      }
    }

    modal.classList.add("active");
  }

  closeModal() {
    const modal = document.getElementById("icebreaker-modal");
    if (modal) modal.classList.remove("active");
  }

  async ackSignal(responseType, signalId, responseText = "") {
    const perspective = (window.ThemeEngine && window.ThemeEngine.currentPerspective) || "girl";
    try {
      await fetch("/api/love/signal/ack", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-member-token": localStorage.getItem("love_owner_token") || ""
        },
        body: JSON.stringify({
          signalId,
          responderGender: perspective,
          responderDeviceId: this.deviceId,
          responseType,
          responseText
        })
      });
    } catch (_) {}
  }

  showMutualCelebration(signal) {
    this.playGentleChime();
    this.showToast("✨ 奇妙的默契！你们在同一刻选择了彼此与和好！💖", "success");
    if (window.Effects) {
      if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
      if (typeof window.Effects.fireFireworks === "function") window.Effects.fireFireworks();
    }

    window.dispatchEvent(new CustomEvent("achievement:trigger", {
      detail: { type: "icebreaker_resolved" }
    }));

    const modal = document.getElementById("icebreaker-modal");
    if (modal) {
      modal.classList.add("icebreaker-modal--mutual");
      this.openReconciliationModal({
        ...signal,
        content: "众水不能熄灭爱情，大水不能淹没。在这一刻，你们同时向对方递出了和好的橄榄枝！"
      });
    }
  }

  showAcceptedCelebration(signal) {
    this.playGentleChime();
    this.showToast("🎉 破冰成功！爱是恒久忍耐又有恩慈，愿爱永不止息。", "success");
    if (window.Effects) {
      if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
      if (typeof window.Effects.fireFireworks === "function") window.Effects.fireFireworks();
    }

    window.dispatchEvent(new CustomEvent("achievement:trigger", {
      detail: { type: "icebreaker_resolved" }
    }));
  }

  triggerSendingPulse() {
    const card = document.querySelector(".icebreaker-card");
    if (card) {
      card.style.borderColor = "var(--primary-pink)";
      setTimeout(() => { card.style.borderColor = ""; }, 1200);
    }
  }

  async fetchAndRenderHistory() {
    const historyContainer = document.getElementById("icebreaker-history-container");
    if (!historyContainer) return;

    try {
      const res = await fetch("/api/love/signal/history");
      if (!res.ok) return;
      const data = await res.json();
      const historyList = data.history || [];

      if (historyList.length === 0) {
        historyContainer.innerHTML = `
          <div class="icebreaker-history-empty">
            <span>🌿 暂无破冰记录 · 愿每一次小磕绊都能化作更加坚固的爱与包容</span>
          </div>
        `;
        return;
      }

      window.dispatchEvent(new CustomEvent("achievement:trigger", {
        detail: { type: "icebreaker_resolved" }
      }));

      historyContainer.innerHTML = historyList.slice(0, 10).map((record, idx) => {
        const dateObj = new Date(record.resolvedAt || Date.now());
        const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

        const stageMap = {
          dating: "🌿 恋爱期 · 守望圣洁",
          engaged: "💍 订婚期 · 盟约预备",
          married: "🏠 结婚期 · 实体避风港"
        };
        const stageBadge = stageMap[record.stage] || "💖 恒久契约";

        return `
          <div class="icebreaker-history-item">
            <div class="icebreaker-history-item__header">
              <span class="icebreaker-history-badge">${stageBadge}</span>
              <span class="icebreaker-history-date">${dateStr}</span>
            </div>
            <p class="icebreaker-history-summary">${this.escapeHtml(record.summary || "爱是永不止息")}</p>
            <div class="icebreaker-history-item__footer">
              <button class="icebreaker-history-btn" onclick="window.IceBreakerInstance.generatePosterForRecord(${idx})">
                <span>📸 导出和好海报</span>
              </button>
            </div>
          </div>
        `;
      }).join("");
    } catch (_) {}
  }

  async generatePosterForRecord(recordIndex) {
    try {
      const res = await fetch("/api/love/signal/history");
      if (!res.ok) return;
      const data = await res.json();
      const record = (data.history || [])[recordIndex];
      if (!record) return;

      const config = window.LOVE_CONFIG || {};
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = 1080;
      canvas.height = 1680;

      const bgGradient = ctx.createLinearGradient(0, 0, 0, 1680);
      bgGradient.addColorStop(0, "#090d16");
      bgGradient.addColorStop(0.3, "#1e1b4b");
      bgGradient.addColorStop(0.7, "#0f172a");
      bgGradient.addColorStop(1, "#030712");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 1080, 1680);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let i = 0; i < 75; i++) {
        const sx = Math.sin(i * 99) * 540 + 540;
        const sy = Math.cos(i * 33) * 840 + 840;
        const sr = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
      ctx.fillRect(340, 65, 400, 38);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
      ctx.strokeRect(340, 65, 400, 38);
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ SACRED RECONCILIATION · 和好圣约 ✨", 540, 90);

      const boy = config.meta?.boyName || "良人";
      const girl = config.meta?.girlName || "佳偶";
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 48px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
      ctx.fillText(`${boy} & ${girl}`, 540, 160);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "22px sans-serif";
      ctx.fillText("爱情胜过死亡，众水不能熄灭，大水不能淹没", 540, 204);

      const cardX = 100;
      const cardY = 245;
      const cardW = 880;
      const cardH = 920;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 15;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const r = 16;
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "transparent";

      const photoPad = 24;
      const photoW = cardW - photoPad * 2;
      const photoH = 460;
      const photoX = cardX + photoPad;
      const photoY = cardY + photoPad;

      const boxGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
      boxGrad.addColorStop(0, "#1e1b4b");
      boxGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = boxGrad;
      ctx.fillRect(photoX, photoY, photoW, photoH);

      ctx.fillStyle = "#fde68a";
      ctx.font = "80px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🕊️", 540, photoY + 240);

      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 30px "Songti SC", "STSong", serif';
      ctx.fillText("爱不是讲理的地方，而是包容与舍己的地方", 540, photoY + 330);

      const textStartY = photoY + photoH + 40;
      const dateObj = new Date(record.resolvedAt || Date.now());
      const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

      ctx.fillStyle = "#9f1239";
      ctx.font = 'bold 32px "Songti SC", "STSong", "Noto Serif SC", serif';
      ctx.textAlign = "left";
      ctx.fillText("🕊️ 破冰与和好印记", photoX + 10, textStartY);

      ctx.fillStyle = "#64748b";
      ctx.font = '600 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`和好时刻: ${dateStr}`, photoX + 10, textStartY + 42);

      ctx.save();
      ctx.fillStyle = "rgba(244, 63, 94, 0.06)";
      ctx.fillRect(photoX + 6, textStartY + 64, photoW - 12, 240);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
      ctx.strokeRect(photoX + 6, textStartY + 64, photoW - 12, 240);

      ctx.fillStyle = "#374151";
      ctx.font = 'italic 22px "Songti SC", "STSong", serif';
      ctx.textAlign = "left";
      this.drawWrappedText(ctx, `“ ${record.summary || "爱是恒久忍耐又有恩慈。在漫长的一生一世里，我们选择彼此包容与理解。"} ”`, photoX + 24, textStartY + 115, photoW - 48, 38, 4);
      ctx.restore();

      ctx.restore();

      const rawDomainUrl = window.location.href.split("#")[0].split("?")[0];
      const displayHostname = this.decodePunycodeHost(window.location.hostname);
      const displayDomainUrl = rawDomainUrl.replace(window.location.hostname, displayHostname);

      const qrBoxX = 100;
      const qrBoxY = 1200;
      const qrBoxW = 880;
      const qrBoxH = 200;

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 2;
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
      ctx.strokeRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);

      this.drawDomainQrCode(ctx, 130, 1220, 160, rawDomainUrl);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("扫码见证我们的神圣契约与避风港", 320, 1275);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "20px sans-serif";
      ctx.fillText(`🔗 ${displayDomainUrl.replace(/^https?:\/\//, "")}`, 320, 1320);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px sans-serif";
      ctx.fillText("微信 / 相机扫一扫 · 爱是永不止息", 320, 1360);
      ctx.restore();

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ 众水不能熄灭爱情，大水不能淹没 · LOVE UNIVERSE ✨", 540, 1460);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      this.currentPosterDataUrl = dataUrl;
      this.showReconciliationPosterModal(dataUrl);
    } catch (_) {}
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    const words = String(text || "").split("");
    let line = "";
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        if (linesDrawn === maxLines - 1) {
          ctx.fillText(line.slice(0, -1) + "...", x, y);
          return y + lineHeight;
        }
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
        linesDrawn++;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  drawDomainQrCode(ctx, qrX, qrY, qrSize, targetUrl) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 3;
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

  showReconciliationPosterModal(dataUrl) {
    const modal = document.getElementById("icebreaker-poster-modal");
    const previewBox = document.getElementById("icebreaker-poster-preview-box");
    if (modal && previewBox) {
      previewBox.innerHTML = `<img src="${dataUrl}" style="width:100%; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.5);" alt="和好海报预览" />`;
      modal.style.display = "flex";
    }
  }

  initAudioContext() {
    const unlock = () => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
  }

  playGentleChime() {
    this.duckGlobalBgm();

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (!this.audioContext) return;

      const ctx = this.audioContext;
      if (ctx.state === "suspended") ctx.resume();

      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12);

        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 1.3);
      });
    } catch (_) {}

    setTimeout(() => {
      this.resumeGlobalBgm();
    }, 1600);
  }

  duckGlobalBgm() {
    if (window.Effects && window.Effects.bgmAudio) {
      window.Effects.bgmAudio.volume = 0.15;
    }
  }

  resumeGlobalBgm() {
    if (window.Effects && window.Effects.bgmAudio) {
      window.Effects.bgmAudio.volume = 1.0;
    }
  }

  bindGlobalEvents() {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.executePoll(); 
      }
    });

    const interactionHandler = () => {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      if (Date.now() - (this.lastFetchTime || 0) > 10000) {
         this.executePoll();
      }
    };

    document.addEventListener("click", interactionHandler, { passive: true });
    document.addEventListener("touchstart", interactionHandler, { passive: true });
  }
}

window.IceBreakerManager = IceBreakerManager;
