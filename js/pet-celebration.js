/**
 * 众水不灭 · 雅歌之印
 * 文件名: js/pet-celebration.js
 * 作用: 灵宠晋升与徽章解锁庆贺动效中枢、全站成就字典体系 (引入隐形进度阶梯)
 */

class PetCelebrationManager {
  constructor() {
    this.audioContext = null;
    this.modalEl = null;
    this.initAudioContext();
  }

  /**
   * 🌟 16 徽章全量核心元数据字典 (带有隐形进度追踪器 tracker 与目标值 target)
   */
  static get BADGE_DEFINITIONS() {
    return [
      // === 5 阶核心陪伴等级 (Level) ===
      { id: "lvl_1", name: "小小雏鸽", icon: "🐣", category: "level", level: 1, desc: "初识恩典 · 光芒值达到 0+" },
      { id: "lvl_2", name: "感恩使者", icon: "💧", category: "level", level: 2, desc: "恩典流淌 · 光芒值达到 100+" },
      { id: "lvl_3", name: "舍己守护", icon: "🍎", category: "level", level: 3, desc: "舍己之美 · 光芒值达到 300+" },
      { id: "lvl_4", name: "和平织梦", icon: "🕊️✨", category: "level", level: 4, desc: "双翼展翅 · 光芒值达到 600+" },
      { id: "lvl_5", name: "和平使者", icon: "👑🕊️", category: "level", level: 5, desc: "神圣加冕 · 光芒值达到 1000+" },

      // === 🌱 隐形阶梯 1：触手可及 (新手启程) ===
      { id: "diary_1", name: "初遇晨曦", icon: "🌅", category: "special", desc: "在日记本中写下第 1 篇专属记忆" },
      { id: "first_peace", name: "破冰之勇", icon: "🧊⚡", category: "special", desc: "首次使用破冰信号箱主动和好" },
      { id: "streak_7", name: "七日暖阳", icon: "📅☀️", category: "special", desc: "连续 7 天陪伴打卡", tracker: "streakDays", target: 7 },
      { id: "music_100", name: "治愈之音", icon: "🎵💕", category: "special", desc: "在专属背景音乐中同行守护", tracker: "playedSongsCount", target: 5 },

      // === 🌙 隐形阶梯 2：习惯养成 (中期沉淀) ===
      { id: "diary_10", name: "岁月史官", icon: "📚🕰️", category: "special", desc: "累计写下 10 篇以上的同行日记", tracker: "diaryCount", target: 10 },
      { id: "sacrifice_10", name: "包容之水", icon: "🌊🤝", category: "special", desc: "累计主动退让与包容 10 次", tracker: "sacrificeCount", target: 10 },
      { id: "streak_30", name: "月相盈亏", icon: "🌖", category: "special", desc: "连续陪伴打卡满 30 天", tracker: "streakDays", target: 30 },
      { id: "egg_hunter", name: "寻宝猎人", icon: "🥚🔍", category: "special", desc: "发现全站角落隐藏的爱意彩蛋", tracker: "foundEggsCount", target: 2 },
      { id: "photo_50", name: "时光雕刻", icon: "📸🎞️", category: "special", desc: "翻转查看时光轴回忆照片", tracker: "flippedCardsCount", target: 15 },

      // === 🌌 隐形阶梯 3：白金荣耀 (史诗羁绊) ===
      { id: "streak_100", name: "百日星辰", icon: "💯✨", category: "special", desc: "连续陪伴打卡达到 100 天", tracker: "streakDays", target: 100 },
      { id: "sacrifice_50", name: "灵魂伴侣", icon: "💞🕊️", category: "special", desc: "累计主动退让达到 50 次", tracker: "sacrificeCount", target: 50 }
    ];
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

  playLevelUpChord() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (!this.audioContext) return;

      const ctx = this.audioContext;
      if (ctx.state === "suspended") ctx.resume();

      const freqs = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 1.5);
      });
    } catch (_) {}
  }

  playBadgeUnlockChime() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (!this.audioContext) return;

      const ctx = this.audioContext;
      if (ctx.state === "suspended") ctx.resume();

      const freqs = [783.99, 1046.50, 1318.51, 1567.98];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 1.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 1.1);
      });
    } catch (_) {}
  }

  triggerLevelUp(newTier) {
    this.playLevelUpChord();

    if (window.Effects) {
      if (typeof window.Effects.fireFireworks === "function") window.Effects.fireFireworks();
      if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
    }

    if (navigator.vibrate) navigator.vibrate([100, 50, 150]);

    this.showCelebrationModal({
      tag: "SACRED EVOLUTION · 灵宠荣耀晋阶",
      icon: newTier.icon,
      title: `荣耀晋升 LV.${newTier.level} · ${newTier.title}`,
      subtitle: `✨ 达成【${newTier.stageName}】形态`,
      desc: newTier.desc,
      btnText: "领受神圣恩典 💖"
    });
  }

  triggerBadgeUnlock(badge) {
    this.playBadgeUnlockChime();

    if (window.Effects) {
      if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
    }

    if (navigator.vibrate) navigator.vibrate([80, 40, 120]);

    this.showCelebrationModal({
      tag: "ACHIEVEMENT UNLOCKED · 成就徽章解锁",
      icon: badge.icon,
      title: `解锁徽章【${badge.name}】`,
      subtitle: "🌟 铭刻一生一世的同行印记",
      desc: badge.desc,
      btnText: "荣耀收入囊中 🎖️"
    });
  }

  showCelebrationModal({ tag, icon, title, subtitle, desc, btnText }) {
    if (!this.modalEl) {
      this.modalEl = document.createElement("div");
      this.modalEl.className = "grace-celebration-modal";
      this.modalEl.id = "grace-celebration-modal";
      document.body.appendChild(this.modalEl);
    }

    this.modalEl.innerHTML = `
      <div class="grace-celebration-dialog">
        <div class="grace-celebration-glow"></div>
        <span class="grace-celebration-tag">${tag}</span>
        <div class="grace-celebration-avatar">${icon}</div>
        <h3 class="grace-celebration-title">${title}</h3>
        <div class="grace-celebration-subtitle">${subtitle}</div>
        <p class="grace-celebration-desc">${desc}</p>
        <button class="grace-celebration-btn" id="grace-celebration-close-btn">${btnText}</button>
      </div>
    `;

    this.modalEl.classList.add("active");

    const closeBtn = document.getElementById("grace-celebration-close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.closeCelebrationModal();
      };
    }
  }

  closeCelebrationModal() {
    if (this.modalEl) {
      this.modalEl.classList.remove("active");
    }
  }
}

window.PetCelebrationManager = PetCelebrationManager;
window.PetCelebration = new PetCelebrationManager();
