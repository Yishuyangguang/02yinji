/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/timeline.js
 * 作用: 恋爱同行计时器、3D 翻转拍立得相册、阶段待办清单引擎、全息 3D 心形照片流转引擎
 */

class TimelineManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.checklistStorageKey = "love_universe_checklist_state";
    this.currentPlayingAudio = null;
    this.currentActivePillEl = null;
    this.currentPhase = (this.config.lifecycle && this.config.lifecycle.currentPhase) || "dating";

    this.dom = {
      years: document.getElementById("timer-years"),
      days: document.getElementById("timer-days"),
      hours: document.getElementById("timer-hours"),
      minutes: document.getElementById("timer-minutes"),
      seconds: document.getElementById("timer-seconds"),
      milestoneDays: document.getElementById("milestone-days"),
      timelineFlow: document.getElementById("timeline-flow"),
      checklistContainer: document.getElementById("checklist-container"),
      checklistProgressFill: document.getElementById("checklist-progress-fill"),
      checklistStats: document.getElementById("checklist-stats"),
      checklistTitle: document.getElementById("checklist-section-title"),
      checklistDesc: document.getElementById("checklist-section-desc")
    };
  }

  init() {
    this.injectLayoutFixes(); 
    this.initLoveTimer();
    this.renderTimeline();
    this.initChecklist(this.currentPhase);
    this.bindPhaseTabs();
    this.bindStageLifecycle();
    this.initHeartEngine();
  }

  /**
   * 🌟 设计师级修正盾：动态注入最高优先级的 CSS
   * 确保按钮宏大醒目且绝对居中，确保 3D 原点精准定位于屏幕中心
   */
  injectLayoutFixes() {
    if (document.getElementById("timeline-layout-fixes")) return;
    const style = document.createElement("style");
    style.id = "timeline-layout-fixes";
    style.innerHTML = `
      /* 强制 3D 引擎启动按钮居中且大方美观 */
      .heart-engine-launch {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        margin: 32px 0 24px 0 !important;
        text-align: center !important;
      }
      .heart-engine-btn {
        background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255,255,255,0.4) !important;
        box-shadow: 0 8px 24px rgba(244,63,94,0.4), inset 0 1px 2px rgba(255,255,255,0.3) !important;
        border-radius: 30px !important;
        padding: 16px 36px !important;
        font-size: 17px !important;
        font-weight: 900 !important;
        letter-spacing: 1px !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        white-space: nowrap !important;
      }
      .heart-engine-btn:hover {
        transform: translateY(-3px) scale(1.03) !important;
        box-shadow: 0 12px 32px rgba(244,63,94,0.5), inset 0 1px 2px rgba(255,255,255,0.4) !important;
      }
      .heart-engine-btn:active {
        transform: translateY(1px) scale(0.98) !important;
      }
      /* 强制 3D 舞台与心形绝对居中对齐 */
      .heart-engine-stage {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
      }
      .heart-engine-scene {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        width: 0 !important;
        height: 0 !important;
        display: block !important;
      }
    `;
    document.head.appendChild(style);
  }

  bindStageLifecycle() {
    window.addEventListener("stage:opened", (e) => {
      const stageId = e.detail && e.detail.stageId;
      if (stageId === "timeline") {
        this.renderTimeline();
      } else if (stageId === "checklist") {
        this.initChecklist(this.currentPhase);
      }
    });

    window.addEventListener("stage:closing", () => {
      if (this.currentPlayingAudio) {
        this.currentPlayingAudio.pause();
        this.currentPlayingAudio = null;
        if (this.currentActivePillEl) {
          this.currentActivePillEl.classList.remove("playing");
          const ic = this.currentActivePillEl.querySelector(".polaroid-voice-icon");
          if (ic) ic.textContent = "▶";
        }
      }
    });
  }

  bindPhaseTabs() {
    document.querySelectorAll(".phase-tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const phase = btn.getAttribute("data-phase");
        if (!phase || phase === this.currentPhase) return;

        document.querySelectorAll(".phase-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(`.phase-tab-btn[data-phase="${phase}"]`).forEach(b => b.classList.add("active"));

        this.currentPhase = phase;
        this.initChecklist(phase);

        if (window.ScratchCardInstance) {
          window.ScratchCardInstance.switchPhase(phase);
        }
      });
    });
  }

  initLoveTimer() {
    const startDateStr = (this.config.meta && this.config.meta.startDate) || "2024-05-20";
    const startDate = new Date(startDateStr).getTime();
    const milestoneDateStr = (this.config.meta && this.config.meta.nextMilestoneDate) || "2026-05-20";
    const milestoneDate = new Date(milestoneDateStr).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = now - startDate;

      if (diff > 0) {
        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);

        const years = Math.floor(totalDays / 365);
        const remainingDays = totalDays % 365;
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;

        if (this.dom.years) this.dom.years.textContent = years;
        if (this.dom.days) this.dom.days.textContent = String(remainingDays).padStart(3, "0");
        if (this.dom.hours) this.dom.hours.textContent = String(hours).padStart(2, "0");
        if (this.dom.minutes) this.dom.minutes.textContent = String(minutes).padStart(2, "0");
        if (this.dom.seconds) this.dom.seconds.textContent = String(seconds).padStart(2, "0");
      }

      if (this.dom.milestoneDays && milestoneDate) {
        const milestoneDiff = milestoneDate - now;
        const daysLeft = Math.max(0, Math.ceil(milestoneDiff / (1000 * 60 * 60 * 24)));
        this.dom.milestoneDays.textContent = daysLeft;
      }
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  formatAudioTime(sec) {
    if (isNaN(sec) || sec <= 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  renderTimeline() {
    const container = this.dom.timelineFlow;
    if (!container) return;

    const timelineData = this.config.timeline || [];
    container.innerHTML = "";

    timelineData.forEach((item, index) => {
      const nodeEl = document.createElement("article");
      nodeEl.className = "timeline-node";
      nodeEl.setAttribute("data-index", index);

      const nodeId = item.id || `node_${index}`;

      const extractedImgSrc = item.frontImg || item.image || item.photo || item.imgUrl || item.img || "";
      const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%230f172a'/%3E%3Ccircle cx='200' cy='220' r='40' fill='%231e293b'/%3E%3Cpath d='M175 220l15 15 35-35' fill='none' stroke='%23334155' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='50%25' y='320' dominant-baseline='middle' text-anchor='middle' font-size='18' fill='%2364748b' font-family='sans-serif'%3E等待记忆上传...%3C/text%3E%3C/svg%3E";
      const finalImgSrc = extractedImgSrc ? extractedImgSrc : fallbackSvg;

      nodeEl.innerHTML = `
        <div class="timeline-node__time">${item.date}</div>
        <div class="polaroid-card" id="polaroid-${nodeId}">
          <div class="polaroid-card__inner">
            <div class="polaroid-card__front">
              <div class="polaroid-card__photo-box">
                <img class="polaroid-card__img" src="${finalImgSrc}" alt="${item.title || '时光记忆'}" loading="lazy" />
                <span class="polaroid-card__tag">${item.tag || '契约时刻'}</span>
              </div>
              <div class="polaroid-card__caption">
                <h3 class="polaroid-card__title">${item.title || ''}</h3>
                <p class="polaroid-card__desc">${item.desc || ''}</p>
                <div class="polaroid-card__meta">
                  <span class="polaroid-card__location">${item.location || '📍 契约圣地'}</span>
                  <span class="polaroid-card__hint">👆 点击翻转</span>
                </div>
              </div>
            </div>

            <div class="polaroid-card__back">
              <div class="polaroid-card__back-content">
                <div class="polaroid-card__stamp">LOVE MEMORY</div>
                <h4 class="polaroid-card__back-title">💌 专属记忆</h4>
                <p class="polaroid-card__back-text">${item.backText || '众水不能熄灭，大水不能淹没。'}</p>
                ${
                  item.voiceAudio
                    ? `
                  <div class="polaroid-card__voice-box">
                    <div class="polaroid-voice-pill" id="voice-pill-${nodeId}" data-audio="${item.voiceAudio}">
                      <div class="polaroid-voice-icon">▶</div>
                      <div class="polaroid-voice-waves">
                        <span class="polaroid-wave-bar"></span>
                        <span class="polaroid-wave-bar"></span>
                        <span class="polaroid-wave-bar"></span>
                        <span class="polaroid-wave-bar"></span>
                        <span class="polaroid-wave-bar"></span>
                      </div>
                      <div class="polaroid-voice-info">
                        <span class="polaroid-voice-title">独家语音记忆</span>
                        <span class="polaroid-voice-duration" id="voice-dur-${nodeId}">点击聆听</span>
                      </div>
                    </div>
                  </div>`
                    : ""
                }
              </div>
              <div class="polaroid-card__back-footer">
                <span>${item.date}</span>
                <span>Tap to flip ↩</span>
              </div>
            </div>
          </div>
        </div>
      `;

      const cardInner = nodeEl.querySelector(".polaroid-card__inner");
      nodeEl.querySelector(".polaroid-card").addEventListener("click", (e) => {
        if (e.target.closest(".polaroid-voice-pill")) return;

        cardInner.classList.toggle("polaroid-card__inner--flipped");
        if (window.Effects && typeof window.Effects.playAudio === "function") {
          window.Effects.playAudio("flip");
        }

        window.dispatchEvent(new CustomEvent("achievement:trigger", {
          detail: { type: "polaroid_flipped" }
        }));
      });

      const voicePill = nodeEl.querySelector(".polaroid-voice-pill");
      if (voicePill) {
        voicePill.addEventListener("click", (e) => {
          e.stopPropagation();
          this.handleVoicePlayback(voicePill, item.voiceAudio);
        });
      }

      container.appendChild(nodeEl);
    });
  }

  handleVoicePlayback(pillEl, audioUrl) {
    const iconEl = pillEl.querySelector(".polaroid-voice-icon");
    const durEl = pillEl.querySelector(".polaroid-voice-duration");

    if (this.currentPlayingAudio && !this.currentPlayingAudio.paused && this.currentActivePillEl === pillEl) {
      this.currentPlayingAudio.pause();
      pillEl.classList.remove("playing");
      if (iconEl) iconEl.textContent = "▶";
      if (durEl) durEl.textContent = "已暂停";
      return;
    }

    if (this.currentPlayingAudio) {
      this.currentPlayingAudio.pause();
      this.currentPlayingAudio = null;
    }
    document.querySelectorAll(".polaroid-voice-pill").forEach((pill) => {
      pill.classList.remove("playing");
      const ic = pill.querySelector(".polaroid-voice-icon");
      const dur = pill.querySelector(".polaroid-voice-duration");
      if (ic) ic.textContent = "▶";
      if (dur && dur.textContent.includes("播放")) dur.textContent = "点击聆听";
    });

    const audio = new Audio(audioUrl);
    this.currentPlayingAudio = audio;
    this.currentActivePillEl = pillEl;

    pillEl.classList.add("playing");
    if (iconEl) iconEl.textContent = "⏸";
    if (durEl) durEl.textContent = "缓冲中...";

    audio.addEventListener("timeupdate", () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const remaining = Math.max(0, audio.duration - audio.currentTime);
        if (durEl) durEl.textContent = `播放中 ${this.formatAudioTime(remaining)}`;
      }
    });

    audio.play().catch(() => {
      pillEl.classList.remove("playing");
      if (iconEl) iconEl.textContent = "▶";
      if (durEl) durEl.textContent = "播放失败";
    });

    audio.onended = () => {
      pillEl.classList.remove("playing");
      if (iconEl) iconEl.textContent = "▶";
      if (durEl) durEl.textContent = "重播记忆";
      this.currentPlayingAudio = null;
      this.currentActivePillEl = null;
    };
  }

  initChecklist(phase = "dating") {
    const container = this.dom.checklistContainer;
    if (!container) return;

    let targetData = null;
    if (window.STAGE_CONTENT && window.STAGE_CONTENT[phase]) {
      targetData = window.STAGE_CONTENT[phase];
    }

    const defaultList = (targetData && targetData.checklist) || this.config.checklist100 || [];
    
    if (this.dom.checklistTitle && targetData) {
      this.dom.checklistTitle.textContent = targetData.title;
    }
    if (this.dom.checklistDesc && targetData) {
      this.dom.checklistDesc.textContent = targetData.subtitle;
    }

    let savedState = {};
    try {
      savedState = JSON.parse(localStorage.getItem(`${this.checklistStorageKey}_${phase}`)) || {};
    } catch (_) {
      savedState = {};
    }

    container.innerHTML = "";
    
    const isOwner = !!localStorage.getItem("love_owner_token");

    defaultList.forEach((item) => {
      const isCompleted = savedState.hasOwnProperty(item.id) ? savedState[item.id] : item.completed;
      const itemEl = document.createElement("div");
      
      itemEl.className = `checklist-item ${isCompleted ? "checklist-item--checked" : ""}`;
      itemEl.setAttribute("data-id", item.id);
      itemEl.style.position = "relative"; 

      itemEl.innerHTML = `
        <label class="checklist-item__label">
          <input type="checkbox" class="checklist-item__checkbox" ${isCompleted ? "checked" : ""} ${isOwner ? "" : "disabled"} />
          <span class="checklist-item__custom-box"></span>
          <span class="checklist-item__text">${item.title}</span>
        </label>
        ${isOwner ? "" : `<div class="guest-physical-shield" style="position:absolute; inset:0; z-index:10; cursor:pointer;" onclick="typeof showGuestAlert === 'function' && showGuestAlert()"></div>`}
      `;

      const checkbox = itemEl.querySelector(".checklist-item__checkbox");
      
      if (isOwner) {
        checkbox.addEventListener("change", (e) => {
          const checked = e.target.checked;
          savedState[item.id] = checked;
          localStorage.setItem(`${this.checklistStorageKey}_${phase}`, JSON.stringify(savedState));

          itemEl.classList.toggle("checklist-item--checked", checked);
          const doneCount = this.updateChecklistProgress(defaultList, savedState);

          if (checked && window.Effects) {
            if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
            if (typeof window.Effects.playAudio === "function") window.Effects.playAudio("stamp");
          }

          window.dispatchEvent(new CustomEvent("achievement:trigger", {
            detail: { type: "checklist_updated", completedCount: doneCount }
          }));
        });
      }

      container.appendChild(itemEl);
    });

    this.updateChecklistProgress(defaultList, savedState);
  }

  updateChecklistProgress(defaultList, savedState) {
    const total = defaultList.length;
    let completedCount = 0;

    defaultList.forEach((item) => {
      const isCompleted = savedState.hasOwnProperty(item.id) ? savedState[item.id] : item.completed;
      if (isCompleted) completedCount++;
    });

    const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    if (this.dom.checklistProgressFill) {
      this.dom.checklistProgressFill.style.width = `${percentage}%`;
    }
    if (this.dom.checklistStats) {
      this.dom.checklistStats.textContent = `已达成心愿 ${completedCount} / ${total} 项 (${percentage}%)`;
    }

    return completedCount;
  }

  // ===================== 🌟 3D 全息心形照片宇宙引擎 =====================
  initHeartEngine() {
    this.heartBaseAngle = 0;
    this.heartTargetSpeed = 0.0035;
    this.heartCurrentSpeed = 0.0035;
    this.heartAuto = false;
    this.heartDragging = false;
    this.heartStartX = 0;
    this.heartLastDeltaX = 0;
    this.heartRaf = null;

    const btn = document.getElementById("heartEngineBtn");
    if (btn) btn.addEventListener("click", () => this.openHeartEngine());

    const closeBtn = document.getElementById("heartEngineClose");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeHeartEngine());

    this.bindHeartDrag();
  }

  getTimelinePhotos() {
    const photos = [];
    (this.config.timeline || []).forEach((item) => {
      const src = item.frontImg || item.image || item.photo || item.imgUrl || item.img || '';
      if (src) photos.push(src);
    });
    return photos;
  }

  injectCosmicBackground() {
    const overlayInner = document.querySelector('.heart-engine-overlay__inner');
    if (!overlayInner) return;

    if (!document.getElementById('ambient-top')) {
      const ambientTop = document.createElement('div');
      ambientTop.id = 'ambient-top'; ambientTop.className = 'ambient-light-top';
      overlayInner.insertBefore(ambientTop, overlayInner.firstChild);
    }
    if (!document.getElementById('ambient-bottom')) {
      const ambientBottom = document.createElement('div');
      ambientBottom.id = 'ambient-bottom'; ambientBottom.className = 'ambient-light-bottom';
      overlayInner.insertBefore(ambientBottom, overlayInner.firstChild);
    }

    let pu = document.getElementById('particleUniverse');
    if (!pu) {
      pu = document.createElement('div');
      pu.id = 'particleUniverse'; pu.className = 'particle-universe';
      overlayInner.insertBefore(pu, overlayInner.firstChild);
    }

    const isMobile = window.innerWidth < 640;
    let html = '';

    const heartSvg = `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0 6"/></svg>`;
    const colors = ['#fde68a', '#fbcfe8', '#7dd3fc', '#ffffff'];
    const shapeCount = isMobile ? 18 : 30;

    for (let i = 0; i < shapeCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 90 + 5; 
      const top = Math.random() * 90 + 5;  
      const size = Math.random() * 12 + 10; 
      const blinkDur = Math.random() * 2 + 1.5; 
      const delay = -Math.random() * 10;        

      html += `<div class="constellation-shape" style="
        left: ${left}vw; top: ${top}vh; width: ${size}px; height: ${size}px;
        color: ${color}; animation-duration: 25s, ${blinkDur}s; animation-delay: 0s, ${delay}s;
      ">${heartSvg}</div>`;
    }

    const meteorCount = isMobile ? 15 : 25;
    for (let j = 0; j < meteorCount; j++) {
      const left = Math.random() * 120 - 20; 
      const top = Math.random() * -50;
      const length = Math.random() * 80 + 60; 
      const duration = Math.random() * 2.5 + 2.5; 
      const delay = Math.random() * 4; 

      html += `<div class="meteor" style="
        left: ${left}vw; top: ${top}vh; height: ${length}px;
        animation-delay: ${delay}s; animation-duration: ${duration}s;
      "></div>`;
    }
    pu.innerHTML = html;
  }

  openHeartEngine() {
    const overlay = document.getElementById("heartEngineOverlay");
    if (!overlay) return;

    const hintEl = document.querySelector('.heart-engine-hint');
    if (hintEl) hintEl.remove();

    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }

    const scene = document.getElementById("heartEngineScene");
    this.injectCosmicBackground();

    if (scene) {
      scene.innerHTML = "";
      this.buildHeartScene(this.getTimelinePhotos(), scene);
    }
    
    overlay.classList.add("heart-engine-overlay--open");
    overlay.setAttribute("aria-hidden", "false");
    if (document.body) document.body.classList.add("heart-engine-lock");
    
    this.heartBaseAngle = 0;
    this.heartTargetSpeed = 0.0035;
    this.heartCurrentSpeed = 0.0035;
    this.heartAuto = true;
    if (this.heartRaf) cancelAnimationFrame(this.heartRaf);
    this.heartStartFlow();
  }

  closeHeartEngine() {
    const overlay = document.getElementById("heartEngineOverlay");
    
    if (document.activeElement) document.activeElement.blur();
    
    if (overlay) {
      overlay.classList.remove("heart-engine-overlay--open");
      setTimeout(() => overlay.setAttribute("aria-hidden", "true"), 300);
    }
    if (document.body) document.body.classList.remove("heart-engine-lock");
    
    this.heartAuto = false;
    if (this.heartRaf) cancelAnimationFrame(this.heartRaf);
    const pu = document.getElementById('particleUniverse');
    if (pu) pu.innerHTML = ''; 
    const scene = document.getElementById("heartEngineScene");
    if (scene) scene.innerHTML = '';
  }

  buildHeartScene(photos, scene) {
    let list = [...photos];

    if (list.length > 0 && list.length < 15) {
      const orig = [...list];
      while (list.length < 15) list = list.concat(orig);
    } else if (list.length === 0) {
      const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%230f172a'/%3E%3Ccircle cx='200' cy='220' r='40' fill='%231e293b'/%3E%3Cpath d='M175 220l15 15 35-35' fill='none' stroke='%23334155' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='50%25' y='320' dominant-baseline='middle' text-anchor='middle' font-size='18' fill='%2364748b' font-family='sans-serif'%3E等待记忆上传...%3C/text%3E%3C/svg%3E";
      list = [fallbackSvg];
      while(list.length < 15) list = list.concat([fallbackSvg]);
    }
    
    list = list.slice(0, 60);

    const frag = document.createDocumentFragment();
    list.forEach((src) => {
      const card = document.createElement("div");
      card.className = "heart-photo-card";
      card.innerHTML = `<img src="${src}" alt="" loading="lazy" /><div class="photo-glare"></div>`;
      frag.appendChild(card);
    });
    scene.appendChild(frag);
  }

  bindHeartDrag() {
    const stage = document.querySelector(".heart-engine-stage");
    if (!stage || stage.dataset.heartBound) return;
    stage.dataset.heartBound = "1";

    const onDown = (x) => {
      this.heartDragging = true;
      this.heartTargetSpeed = 0; 
      this.heartStartX = x;
      stage.style.cursor = 'grabbing';
    };
    const onMove = (x) => {
      if (!this.heartDragging) return;
      this.heartLastDeltaX = x - this.heartStartX;
      this.heartBaseAngle += this.heartLastDeltaX * 0.005;
      this.heartStartX = x;
    };
    const onUp = () => {
      if (!this.heartDragging) return;
      this.heartDragging = false;
      stage.style.cursor = 'grab';
      this.heartCurrentSpeed = -this.heartLastDeltaX * 0.0015;
      this.heartTargetSpeed = 0.0035;
    };

    stage.addEventListener("mousedown", (e) => { e.preventDefault(); onDown(e.clientX); });
    stage.addEventListener("mousemove", (e) => onMove(e.clientX));
    stage.addEventListener("mouseup", () => onUp());
    stage.addEventListener("mouseleave", () => onUp());

    stage.addEventListener("touchstart", (e) => { if (e.touches[0]) onDown(e.touches[0].clientX); }, { passive: true });
    stage.addEventListener("touchmove", (e) => { if (e.touches[0]) onMove(e.touches[0].clientX); }, { passive: true });
    stage.addEventListener("touchend", () => onUp());
  }

  heartStartFlow() {
    const scene = document.getElementById("heartEngineScene");
    if (!scene) return;
    const cards = scene.querySelectorAll('.heart-photo-card');
    const count = cards.length;

    const tick = () => {
      if (!this.heartAuto) return; 

      this.heartCurrentSpeed += (this.heartTargetSpeed - this.heartCurrentSpeed) * 0.05;
      this.heartBaseAngle -= this.heartCurrentSpeed; 
      
      const isMobile = window.innerWidth < 640;
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      
      // 🌟 核心修正 1：形态更扁平、宽阔舒展
      const baseScale = isMobile ? (minDim * 0.014) : (minDim * 0.016); 
      const spreadX = isMobile ? 2.6 : 3.2; // 增加X轴拉伸，使得整体变宽
      const spreadY = isMobile ? 1.05 : 1.15; // 压缩Y轴高度，消除高耸圆润感
      
      // 🌟 核心修正 2：心尖黄金定位与底部承托感
      // 心形数学方程本身是“底重顶轻”（往下延伸长），所以必须给一个负值(向上的偏移)
      // 这能把陷入屏幕外的心尖彻底“拔”出来，悬浮在距离底边有一点点空隙的绝佳位置。
      const vh = window.innerHeight;
      const yOffset = -(vh * (isMobile ? 0.08 : 0.12)); 
      const breathY = Math.sin(Date.now() * 0.0015) * 10;

      cards.forEach((card, index) => {
        const t = this.heartBaseAngle + (index / count) * Math.PI * 2;

        const mathX = 16 * Math.pow(Math.sin(t), 3);
        const mathY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        
        // 渲染坐标系：mathY 取负值意味着心形图像是正向展示的
        const posX = mathX * baseScale * spreadX;
        const posY = -mathY * baseScale * spreadY + yOffset + breathY; 
        
        const mathZ = -Math.cos(t); 
        const depthMultiplier = isMobile ? 240 : 450; 
        const posZ = mathZ * depthMultiplier;

        const zNorm = (mathZ + 1) / 2; 

        const scale = 0.45 + (zNorm * 0.7);          
        const opacity = 0.4 + (zNorm * 0.6);        
        const blur = Math.max(0, (1 - zNorm) * 5);  
        const brightness = 0.4 + (zNorm * 0.6);

        // 这里的 translate(-50%, -50%) 配合父级的绝对居中 CSS，保证了数学原点的精确居中
        card.style.transform = `translate(-50%, -50%) translate3d(${posX}px, ${posY}px, ${posZ}px) scale(${scale})`;
        card.style.zIndex = Math.round(zNorm * 1000);
        card.style.opacity = opacity;
        
        const imgEl = card.querySelector('img');
        if (imgEl && zNorm <= 0.98) {
          imgEl.style.filter = `blur(${blur}px) brightness(${brightness})`;
        }

        if (zNorm > 0.98) {
          if (!card.classList.contains('c-position')) card.classList.add('c-position');
        } else {
          if (card.classList.contains('c-position')) card.classList.remove('c-position');
        }
      });

      this.heartRaf = requestAnimationFrame(tick);
    };
    
    this.heartRaf = requestAnimationFrame(tick);
  }
}

window.TimelineManager = TimelineManager;
document.addEventListener("DOMContentLoaded", () => {
  if (window.LOVE_CONFIG) {
    window.TimelineInstance = new TimelineManager(window.LOVE_CONFIG);
    window.TimelineInstance.init();
  }
});
