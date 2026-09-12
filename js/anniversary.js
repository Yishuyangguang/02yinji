/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/anniversary.js
 * 作用: 倒数日与恒久纪念日渲染控制器 (视口懒加载、SVG 流转环计算、长按浮现暗纹、折叠情书、声纹播放、头部计时器联动与工具链)
 */

class AnniversaryManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.currentAudio = null;
    this.playingVoiceId = null;
    this.ghostTimer = null;
    this.hasCelebratedToday = false;

    // 🌟 核心修复1：将钩子绑定提升到构造函数中，且只绑定一次，防止重复绑定引发雪崩
    this.bindStageEvents();
  }

  escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  bindStageEvents() {
    window.addEventListener("stage:opened", (e) => {
      // 🌟 核心修复2：当弹窗被打开时，强制读取最新云端配置并重绘
      if (e.detail && e.detail.stageId === "anniversary") {
        this.config = window.LOVE_CONFIG || {};
        this.renderAll();
      }
    });

    window.addEventListener("stage:closed", () => {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
        this.resumeGlobalBgm();
      }
    });
  }

  // 供外部初次加载或全局强制刷新的入口
  init() {
    this.config = window.LOVE_CONFIG || {};
    this.renderAll();
  }

  renderAll() {
    const container = document.getElementById("anniversary-container");
    if (!container) return;

    const list = this.config.anniversaries;
    if (!Array.isArray(list) || list.length === 0) {
      const section = document.getElementById("anniversary-section");
      if (section) section.style.display = "none";
      container.innerHTML = `<div style="text-align:center; padding:36px; color:#94a3b8; font-size:13.5px;">暂无专属纪念日数据，请前往控制台添加。</div>`;
      return;
    }

    const section = document.getElementById("anniversary-section");
    if (section) section.style.display = "block";

    this.renderCards(container, list);
    this.updateHeroTimerLinkage(list);
    this.setupIntersectionObserver();
    this.bindCardInteractions(list);
  }

  /**
   * 🌟 头部同行计时器 (Hero Timer) 主打倒数日联动
   */
  updateHeroTimerLinkage(list) {
    const milestoneEl = document.getElementById("timer-milestone");
    if (!milestoneEl || !window.AnniversaryEngine) return;

    const pinnedItem = list.find(item => Boolean(item.pinToHero)) || list[0];
    if (!pinnedItem) return;

    const metrics = window.AnniversaryEngine.calculateAnniversaryMetrics(pinnedItem);
    if (!metrics) return;

    const title = this.escapeHtml(pinnedItem.title || "契约纪念日");

    if (metrics.mode === "countup") {
      milestoneEl.innerHTML = `已同行守护【${title}】<span class="love-timer__milestone-days" id="milestone-days">${metrics.totalDays}</span> 天`;
    } else if (metrics.isToday) {
      milestoneEl.innerHTML = `🎉 今天正是【${title}】· 愿爱永不止息！`;
    } else {
      milestoneEl.innerHTML = `距离【${title}】还有 <span class="love-timer__milestone-days" id="milestone-days">${metrics.daysRemaining}</span> 天`;
    }
  }

  /**
   * 渲染纪念日卡片流
   */
  renderCards(container, rawList) {
    container.innerHTML = "";

    const computedItems = rawList.map(item => {
      const metrics = window.AnniversaryEngine 
        ? window.AnniversaryEngine.calculateAnniversaryMetrics(item) 
        : null;
      return { item, metrics };
    }).filter(entry => Boolean(entry.metrics));

    computedItems.sort((a, b) => {
      if (a.metrics.isToday && !b.metrics.isToday) return -1;
      if (!a.metrics.isToday && b.metrics.isToday) return 1;

      if (a.metrics.mode === "annual" && b.metrics.mode === "annual") {
        return a.metrics.daysRemaining - b.metrics.daysRemaining;
      }
      if (a.metrics.mode === "annual") return -1;
      if (b.metrics.mode === "annual") return 1;

      return 0;
    });

    const startDateStr = this.config.meta?.startDate || "2024-05-20";
    let hasTodayEvent = false;

    const cardsHtml = computedItems.map(({ item, metrics }, index) => {
      const isToday = Boolean(metrics.isToday);
      const isMilestone = Boolean(metrics.isMilestone);
      if (isToday) hasTodayEvent = true;

      const cardClass = [
        "anniversary-card",
        isToday ? "anniversary-card--today" : "",
        isMilestone ? "anniversary-card--milestone" : ""
      ].filter(Boolean).join(" ");

      const icon = item.icon || "💖";
      const title = this.escapeHtml(item.title || "契约纪念日");
      const isMarriage = this.config.lifecycle?.currentPhase === "married";
      const pastYears = metrics.pastYears || metrics.years || 0;
      const stageBadge = window.AnniversaryEngine 
        ? window.AnniversaryEngine.getAnniversaryStageBadge(pastYears, isMarriage)
        : (item.tag || "恒久契约");

      let orbitHtml = "";
      if (metrics.mode === "annual") {
        const percent = metrics.orbitPercent || 0;
        const strokeOffset = ((100 - percent) / 100) * 138.23;
        orbitHtml = `
          <div class="anniversary-orbit-box" title="今年已同行 ${metrics.passedCycleDays || 0} / ${metrics.totalCycleDays || 365} 天">
            <svg class="anniversary-orbit-svg" viewBox="0 0 52 52">
              <circle class="anniversary-orbit-bg" cx="26" cy="26" r="22"></circle>
              <circle class="anniversary-orbit-progress" cx="26" cy="26" r="22" data-offset="${strokeOffset}"></circle>
            </svg>
            <span class="anniversary-orbit-text">${percent}%</span>
          </div>
        `;
      }

      let daysLabel = "距离下一次还有";
      let daysNum = metrics.daysRemaining || 0;
      let daysUnit = "天";
      let dateMeta = item.date;

      if (metrics.mode === "countup") {
        daysLabel = "已经同行并守护了";
        daysNum = metrics.totalDays || 0;
        daysUnit = "天";
        dateMeta = `起始于 ${item.date}`;
      } else if (metrics.mode === "target") {
        daysLabel = metrics.isPassed ? "目标日期已达成" : "距离目标日期还有";
        daysNum = metrics.isPassed ? metrics.passedDays : metrics.daysRemaining;
        daysUnit = "天";
        dateMeta = `约定于 ${item.date}`;
      } else if (metrics.mode === "annual") {
        if (isToday) {
          daysLabel = "🎉 正是今天 · 岁岁常欢愉";
          daysNum = 0;
          dateMeta = `${metrics.targetSolarDate} (${metrics.formattedLunarDate || "公历"})`;
        } else {
          daysLabel = `距离${pastYears > 0 ? `第 ${pastYears + 1} 个` : "下一次"}${item.tag || "纪念日"}还有`;
          dateMeta = `下一次目标: ${metrics.targetSolarDate} ${metrics.formattedLunarDate ? `(${metrics.formattedLunarDate})` : ""}`;
        }
      }

      let lifeBondHtml = "";
      if (item.type === "countdown" && (item.tag?.includes("生日") || item.tag?.includes("诞辰") || item.title?.includes("生日"))) {
        const bond = window.AnniversaryEngine 
          ? window.AnniversaryEngine.calculateLifeBond(item.date, startDateStr, item.isLunar)
          : null;
        if (bond) {
          lifeBondHtml = `
            <div class="anniversary-life-bond">
              <span>🌱 降临世界的第 <strong>${bond.totalLifeDays}</strong> 天 · 其中 <strong>${bond.togetherDays}</strong> 天与你同行 (${bond.bondPercent}%)</span>
            </div>
          `;
        }
      }

      const ghostStyle = item.bgImg ? `style="background-image: url('${item.bgImg}');"` : "";

      let voicePillHtml = "";
      if (item.voiceAudio) {
        voicePillHtml = `
          <button class="anniversary-voice-pill" data-voice-url="${encodeURI(item.voiceAudio)}" data-item-id="${item.id || index}">
            <span class="anniversary-voice-icon">🎙️</span>
            <span class="anniversary-voice-text">专属语音</span>
          </button>
        `;
      }

      const hasMemo = Boolean(item.memo && item.memo.trim());
      let memoBtnHtml = "";
      let memoBoxHtml = "";

      if (hasMemo) {
        memoBtnHtml = `
          <button class="anniversary-action-btn btn-toggle-memo" data-target="memo-${item.id || index}">
            <span>💌 寄语</span>
          </button>
        `;
        memoBoxHtml = `
          <div class="anniversary-memo-box" id="memo-${item.id || index}">
            <div class="anniversary-memo-inner">
              <p>${this.escapeHtml(item.memo)}</p>
            </div>
          </div>
        `;
      }

      const toolsBtnHtml = `
        <button class="anniversary-action-btn btn-add-calendar" data-idx="${index}" title="一键导入手机系统日历 (提前3天+当天闹钟提醒)">
          <span>📅 日历</span>
        </button>
        <button class="anniversary-action-btn btn-card-poster" data-idx="${index}" title="生成 300DPI 超清卡片拍立得海报">
          <span>📸 海报</span>
        </button>
      `;

      return `
        <div class="${cardClass}" data-bg="${item.bgImg || ''}" data-is-today="${isToday}">
          <div class="anniversary-ghost-bg" ${ghostStyle}></div>

          <div class="anniversary-card__header">
            <div class="anniversary-card__title-wrap">
              <div class="anniversary-card__icon-box">${icon}</div>
              <div class="anniversary-card__titles">
                <h4 class="anniversary-card__title">${title}</h4>
                <span class="anniversary-card__stage-badge">✨ ${stageBadge}</span>
              </div>
            </div>
            ${orbitHtml}
          </div>

          <div class="anniversary-card__body">
            <div class="anniversary-days__left">
              <span class="anniversary-days__label">${daysLabel}</span>
              <span class="anniversary-days__date-meta">${dateMeta}</span>
            </div>
            <div class="anniversary-days__num-wrap">
              <span class="anniversary-days__num">${daysNum}</span>
              <span class="anniversary-days__unit">${daysUnit}</span>
            </div>
          </div>

          ${lifeBondHtml}

          <div class="anniversary-card__footer">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              ${memoBtnHtml}
              ${toolsBtnHtml}
            </div>
            ${voicePillHtml}
          </div>

          ${memoBoxHtml}
        </div>
      `;
    }).join("");

    container.innerHTML = cardsHtml;

    if (hasTodayEvent && !this.hasCelebratedToday) {
      this.triggerTodayCelebration();
    }
  }

  setupIntersectionObserver() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".anniversary-orbit-progress").forEach(el => {
        el.style.strokeDashoffset = el.getAttribute("data-offset") || "0";
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const orbit = card.querySelector(".anniversary-orbit-progress");
          if (orbit) {
            const offset = orbit.getAttribute("data-offset") || "0";
            orbit.style.strokeDashoffset = offset;
          }
          observer.unobserve(card);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll(".anniversary-card").forEach(card => {
      observer.observe(card);
    });
  }

  bindCardInteractions(list) {
    document.querySelectorAll(".btn-toggle-memo").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-target");
        const memoBox = document.getElementById(targetId);
        if (memoBox) {
          const isExpanded = memoBox.classList.contains("expanded");
          memoBox.classList.toggle("expanded");
          btn.innerHTML = isExpanded ? "<span>💌 寄语</span>" : "<span>收起 ✕</span>";
        }
      };
    });

    document.querySelectorAll(".anniversary-voice-pill").forEach(pill => {
      pill.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const voiceUrl = pill.getAttribute("data-voice-url");
        const itemId = pill.getAttribute("data-item-id");
        this.toggleVoiceAudio(voiceUrl, itemId, pill);
      };
    });

    document.querySelectorAll(".btn-add-calendar").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        const targetItem = list[idx];
        if (targetItem && window.AnniversaryTools) {
          window.AnniversaryTools.exportIcsCalendar(targetItem, `${targetItem.title || "契约纪念日"}`);
        }
      };
    });

    document.querySelectorAll(".btn-card-poster").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        const targetItem = list[idx];
        if (targetItem && window.AnniversaryTools && window.AnniversaryEngine) {
          const metrics = window.AnniversaryEngine.calculateAnniversaryMetrics(targetItem);
          btn.disabled = true;
          btn.innerHTML = "<span>⚙️ 生成中...</span>";

          window.AnniversaryTools.generateSingleCardPoster(targetItem, metrics).then(dataUrl => {
            window.AnniversaryTools.showPosterModal(dataUrl);
          }).finally(() => {
            btn.disabled = false;
            btn.innerHTML = "<span>📸 海报</span>";
          });
        }
      };
    });

    document.querySelectorAll(".anniversary-card").forEach(card => {
      const hasBg = card.getAttribute("data-bg");
      if (!hasBg) return;

      const startGhost = () => {
        this.ghostTimer = setTimeout(() => {
          card.classList.add("ghost-active");
          if (navigator.vibrate) navigator.vibrate([25, 20]);
        }, 250);
      };

      const stopGhost = () => {
        clearTimeout(this.ghostTimer);
        card.classList.remove("ghost-active");
      };

      card.addEventListener("touchstart", startGhost, { passive: true });
      card.addEventListener("touchend", stopGhost);
      card.addEventListener("touchcancel", stopGhost);
    });
  }

  toggleVoiceAudio(url, id, pillElement) {
    if (!url) return;

    if (this.currentAudio && this.playingVoiceId === id) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.playingVoiceId = null;
      pillElement.classList.remove("playing");
      this.resumeGlobalBgm();
      return;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      document.querySelectorAll(".anniversary-voice-pill").forEach(p => p.classList.remove("playing"));
    }

    this.duckGlobalBgm();
    this.currentAudio = new Audio(url);
    this.playingVoiceId = id;
    pillElement.classList.add("playing");

    this.currentAudio.play().catch(() => {
      pillElement.classList.remove("playing");
      this.resumeGlobalBgm();
    });

    this.currentAudio.onended = () => {
      pillElement.classList.remove("playing");
      this.currentAudio = null;
      this.playingVoiceId = null;
      this.resumeGlobalBgm();
    };
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

  triggerTodayCelebration() {
    this.hasCelebratedToday = true;
    setTimeout(() => {
      if (window.Effects) {
        window.Effects.fireConfetti();
        if (typeof window.Effects.fireFireworks === "function") {
          window.Effects.fireFireworks();
        }
        window.Effects.showMiniToast("🎉 愿爱如初！今天是你们专属的神圣纪念日 ✨");
      }
    }, 1200);
  }
}

window.AnniversaryManager = AnniversaryManager;
