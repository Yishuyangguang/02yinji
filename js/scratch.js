/**
 * ====================================================================
 * 众水不灭 · 恋爱时光轴 & 漫游宇宙 (Love Universe)
 * 文件名: js/scratch.js
 * 作用: 真实物理刮刮乐涂层、透明像素算法、防耍赖盖章核销系统
 * ====================================================================
 */

class ScratchCardManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG;
    this.storageKey = "love_universe_scratch_state";
    this.container = document.getElementById("scratch-container");
    this.savedState = this.loadState();
    
    // 默认阶段，跟随全局生命周期
    this.currentPhase = (this.config.lifecycle && this.config.lifecycle.currentPhase === 'married') ? 3 :
                        (this.config.lifecycle && this.config.lifecycle.currentPhase === 'engaged') ? 2 : 1;
  }

  loadState() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || {};
    } catch (_) {
      return {};
    }
  }

  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.savedState));
  }

  /**
   * 初始化入口
   */
  init() {
    if (!this.container) return;
    this.render();
  }

  /**
   * 🌟 防生命周期穿透：响应相册标签切换时的调用
   */
  switchPhase(phase) {
    this.currentPhase = parseInt(phase, 10) || 1;
    this.render(); // 切换阶段时，强制重新走一遍底层鉴权渲染
  }

  /**
   * 🌟 核心渲染引擎 (绝对物理隔离防线)
   */
  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    // 🌟 1. 嗅探最高主权：检测当前设备是否为持印者
    const isOwner = !!localStorage.getItem("love_owner_token");

    // 🌟 2. 游客物理熔断：彻底剥夺一切渲染权！直接展示 3D 锁定面板并中断执行
    if (!isOwner) {
      this.container.innerHTML = `
        <div style="text-align:center; padding:48px 24px; background:var(--bg-card, rgba(255,255,255,0.03)); border:1.5px dashed var(--border-card, rgba(255,255,255,0.15)); border-radius:24px; margin:20px 0; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          <span style="font-size:54px; display:block; margin-bottom:16px; filter:drop-shadow(0 6px 12px rgba(0,0,0,0.5));">🔒</span>
          <span style="color:var(--text-hero, #e2e8f0); font-size:18px; font-weight:900; letter-spacing:1px; display:block; margin-bottom:12px;">展览模式：同行约定清单已锁定</span>
          <span style="color:var(--text-sub, #94a3b8); font-size:14px; line-height:1.6; display:block;">
            这是属于他们最私密的独家心愿<br>
            <span style="font-size:12px; margin-top:10px; display:inline-block; opacity:0.7;">※ 仅持印者设备有权查看详情与点亮</span>
          </span>
        </div>
      `;
      return; // 💥 斩断执行：后续的卡片循环、刮涂层引擎绝对不会被载入内存
    }

    // 🌟 3. 持印者逻辑：正常筛选当前阶段的刮刮乐并渲染
    const allCards = this.config.scratchCards || [];
    let phaseCards = allCards;
    if (this.currentPhase) {
      phaseCards = allCards.filter(c => parseInt(c.phase, 10) === this.currentPhase || !c.phase);
    }

    if (phaseCards.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-sub, #94a3b8); font-size:14px;">
          该阶段暂无特权券，等待惊喜掉落...
        </div>
      `;
      return;
    }

    phaseCards.forEach((cardData) => {
      const cardState = this.savedState[cardData.id] || {
        scratched: cardData.scratched || false,
        used: cardData.used || false,
        usedTime: cardData.usedTime || "",
      };

      const cardWrapper = document.createElement("div");
      cardWrapper.className = "scratch-card";
      cardWrapper.id = `scratch-card-${cardData.id}`;

      // 完美对齐 css/scratch-card.css 的类名结构
      cardWrapper.innerHTML = `
        <div class="scratch-card__body">
          <div class="scratch-card__header-row">
            <span class="scratch-card__icon">${cardData.icon || "🎁"}</span>
            <h3 class="scratch-card__title">${this.escapeHtml(cardData.title)}</h3>
          </div>
          <p class="scratch-card__content">${this.escapeHtml(cardData.content)}</p>
          
          <div class="scratch-card__footer-row">
            <button class="scratch-card__use-btn" ${cardState.used ? "disabled" : ""}>
              ${cardState.used ? "已核销兑现" : "兑现特权"}
            </button>
          </div>
        </div>

        <!-- 初始化的拟真印章 DOM (如果已使用则直接渲染) -->
        ${cardState.used ? `
          <div class="scratch-card__stamp">
            <div class="stamp-inner">已核销<small>${cardState.usedTime}</small></div>
          </div>
        ` : `<div class="stamp-placeholder" style="display:none;"></div>`}

        <!-- 顶层 Canvas 磨砂刮奖涂层 -->
        <canvas class="scratch-card__canvas" ${cardState.scratched ? 'style="display:none;"' : ""}></canvas>
      `;

      this.container.appendChild(cardWrapper);

      // 绑定刮奖 Canvas 引擎
      if (!cardState.scratched) {
        const canvas = cardWrapper.querySelector(".scratch-card__canvas");
        this.setupCanvas(canvas, cardData.id);
      }

      // 绑定核销按钮事件
      const redeemBtn = cardWrapper.querySelector(".scratch-card__use-btn");
      if (redeemBtn) {
        redeemBtn.addEventListener("click", () => {
          this.handleRedeem(cardData.id, cardWrapper);
        });
      }
    });
  }

  escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * 构建 Canvas 物理刮除逻辑
   */
  setupCanvas(canvas, cardId) {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 180;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    // 绘制高级金属磨砂质感涂层
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#8fa3b8");
    gradient.addColorStop(0.5, "#64748b");
    gradient.addColorStop(1, "#475569");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 涂层装饰纹样与提示字
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✨ 刮开涂层 兑现特权 ✨", width / 2, height / 2);

    let isDrawing = false;
    let isFinished = false;
    let lastPoint = null;

    const getPos = (e) => {
      const cRect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - cRect.left,
        y: clientY - cRect.top,
      };
    };

    const scratch = (pos) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
      ctx.fill();

      // 平滑连线消除断点
      if (lastPoint) {
        ctx.lineWidth = 44;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      lastPoint = pos;
    };

    // 计算被刮开的透明像素百分比
    const checkPercentage = () => {
      if (isFinished) return;
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const step = 32; 
      let transparentCount = 0;
      let totalSampled = 0;

      for (let i = 3; i < data.length; i += 4 * step) {
        totalSampled++;
        if (data[i] < 128) {
          transparentCount++;
        }
      }

      const ratio = transparentCount / totalSampled;
      if (ratio > 0.45) {
        isFinished = true;
        this.revealCard(canvas, cardId);
      }
    };

    const onStart = (e) => {
      isDrawing = true;
      lastPoint = getPos(e);
      scratch(lastPoint);
      if (window.Effects) window.Effects.playAudio("scratch");
    };

    const onMove = (e) => {
      if (!isDrawing || isFinished) return;
      e.preventDefault();
      const pos = getPos(e);
      scratch(pos);
    };

    const onEnd = () => {
      if (!isDrawing) return;
      isDrawing = false;
      lastPoint = null;
      checkPercentage();
    };

    canvas.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);

    canvas.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  /**
   * 超过 45% 面积时自动完全淡出揭开
   */
  revealCard(canvas, cardId) {
    canvas.style.transition = "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    canvas.style.opacity = "0";

    setTimeout(() => {
      canvas.style.display = "none";
    }, 500);

    if (!this.savedState[cardId]) {
      this.savedState[cardId] = {};
    }
    this.savedState[cardId].scratched = true;
    this.saveState();

    if (window.Effects) {
      window.Effects.fireConfetti();
    }
  }

  /**
   * 拟真印章核销逻辑
   */
  handleRedeem(cardId, cardWrapper) {
    if (!localStorage.getItem("love_owner_token")) return;

    const cardState = this.savedState[cardId] || {};
    if (cardState.used) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

    cardState.used = true;
    cardState.usedTime = timeStr;
    this.savedState[cardId] = cardState;
    this.saveState();

    const redeemBtn = cardWrapper.querySelector(".scratch-card__use-btn");
    if (redeemBtn) {
      redeemBtn.disabled = true;
      redeemBtn.textContent = "已核销兑现";
    }

    // 动态生成印章，从而触发 CSS 中的 animation: stampPunch 动画
    const stampEl = document.createElement("div");
    stampEl.className = "scratch-card__stamp";
    stampEl.innerHTML = `<div class="stamp-inner">已核销<small>${timeStr}</small></div>`;
    cardWrapper.appendChild(stampEl);

    if (window.Effects) {
      window.Effects.playAudio("stamp");
    }
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 100]);
    }
  }
}

// 挂载至全局
window.ScratchCardManager = ScratchCardManager;
