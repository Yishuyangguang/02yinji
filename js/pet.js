/**
 * 众水不灭 · 雅歌之印
 * 文件名: js/pet.js
 * 作用: 恩典灵宠状态管理、数据双向同步。支持动态注入陈列室进度条引擎与展览模式隔离。
 */

class GracePetManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.isEvaluatingBadges = false;
    this.petData = this.loadLocalPetData();
  }

  static getTierInfo(glowEnergy) {
    const energy = Math.max(0, Number(glowEnergy) || 0);
    if (energy >= 1000) return { level: 5, title: "和平使者", icon: "👑🕊️", stageName: "神性形态", badgeColor: "#f43f5e", req: 1000, nextReq: null, desc: "皇冠加冕 · 众水不能熄灭，大水不能淹没" };
    if (energy >= 600) return { level: 4, title: "和平织梦者", icon: "🕊️✨", stageName: "圣灵形态", badgeColor: "#a855f7", req: 600, nextReq: 1000, desc: "金白双翼 · 在爱与恩典中编织永恒同心" };
    if (energy >= 300) return { level: 3, title: "舍己守护者", icon: "🍎🕊️", stageName: "青年形态", badgeColor: "#ef4444", req: 300, nextReq: 600, desc: "舍己之果 · 懂得在分歧中退让与包容" };
    if (energy >= 100) return { level: 2, title: "感恩使者", icon: "🕊️", stageName: "幼年形态", badgeColor: "#38bdf8", req: 100, nextReq: 300, desc: "恩典之露 · 记录平凡生活中的每一次感动" };
    return { level: 1, title: "小小雏鸽", icon: "🐣", stageName: "雏鸽形态", badgeColor: "#f59e0b", req: 0, nextReq: 100, desc: "初萌爱意 · 开启一生一世的圣洁守望" };
  }

  static getStreakBonus(streakDays) {
    const days = Math.max(0, Number(streakDays) || 0);
    if (days >= 100) return { mult: 5.0, title: "永恒誓约 (5.0x)" };
    if (days >= 30)  return { mult: 3.0, title: "爱的信徒 (3.0x)" };
    if (days >= 14)  return { mult: 2.0, title: "坚定不移 (2.0x)" };
    if (days >= 7)   return { mult: 1.5, title: "持之以恒 (1.5x)" };
    if (days >= 3)   return { mult: 1.2, title: "初露锋芒 (1.2x)" };
    return { mult: 1.0, title: "每日同行 (1.0x)" };
  }

  getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  loadLocalPetData() {
    let raw = null;
    try { const local = localStorage.getItem("love_universe_pet_data"); if (local) raw = JSON.parse(local); } catch (_) {}
    return this.migrateSchema(raw || this.config.petData);
  }

  migrateSchema(input) {
    const src = (input && typeof input === "object") ? input : {};
    const glow = typeof src.glowEnergy === "number" ? src.glowEnergy : 100;
    const tier = GracePetManager.getTierInfo(glow);

    return {
      name: src.name || "和平灵鸽 · 恩典使者", icon: tier.icon, glowEnergy: glow,
      gratitudeCount: Number(src.gratitudeCount) || 0, sacrificeCount: Number(src.sacrificeCount) || 0,
      logs: Array.isArray(src.logs) ? src.logs : [], currentLevel: tier.level,
      unlockedBadges: Array.isArray(src.unlockedBadges) ? src.unlockedBadges : ["lvl_1"],
      streakDays: Number(src.streakDays) || 0, longestStreak: Number(src.longestStreak) || 0,
      lastInteractionDate: typeof src.lastInteractionDate === "string" ? src.lastInteractionDate : null,
      totalGlowEarned: Number(src.totalGlowEarned) || glow, flippedCardsCount: Number(src.flippedCardsCount) || 0,
      playedSongsCount: Number(src.playedSongsCount) || 0, foundEggsCount: Number(src.foundEggsCount) || 0,
      diaryCount: Number(src.diaryCount) || 0 
    };
  }

  saveLocalPetData() {
    try { localStorage.setItem("love_universe_pet_data", JSON.stringify(this.petData)); } catch (_) {}
  }

  async init() {
    this.checkNaturalDayStreakReset();
    this.injectDOM();
    this.bindEvents();
    this.bindAchievementInterceptors();
    this.bindUnlockVisibility();
    this.checkAllBadgeUnlocks();
    this.updateUI();
    this.applyGuestExhibitionShield(); // 🌟 核心：执行灵宠下半部分展览模式隔离
    await this.fetchCloudPetData();
  }

  /**
   * 🌟 核心隔离：游客只能看上半部分，下半部分替换为 3D 黑金锁定面板
   */
  applyGuestExhibitionShield() {
    const isOwner = !!localStorage.getItem("love_owner_token");
    if (isOwner) return; // 持印者放行

    // 自动寻找互动操作舱（输入框、喂养按钮、足迹日志容器等）
    const actionSections = document.querySelectorAll(".grace-action-section, .grace-log-list, #feed-gratitude-btn, #feed-sacrifice-btn, .grace-textarea");
    actionSections.forEach(el => {
      // 顺着父级找卡片容器并将其隐藏或替换
      const cardParent = el.closest(".grace-pet-dialog, .container, section, div");
      if (cardParent && !document.getElementById("pet-guest-lock-panel")) {
        // 创建 3D 黑金锁面板
        const lockPanel = document.createElement("div");
        lockPanel.id = "pet-guest-lock-panel";
        lockPanel.style.cssText = "text-align:center; padding:36px 20px; background:var(--bg-card, rgba(255,255,255,0.03)); border:1.5px dashed var(--border-card, rgba(255,255,255,0.15)); border-radius:20px; margin:20px 0; box-shadow:0 8px 32px rgba(0,0,0,0.2);";
        lockPanel.innerHTML = `
          <span style="font-size:42px; display:block; margin-bottom:12px; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));">🔒</span>
          <span style="color:var(--text-hero, #e2e8f0); font-size:16px; font-weight:900; letter-spacing:1px; display:block; margin-bottom:8px;">展览模式：恩典陪伴互动已锁定</span>
          <span style="color:var(--text-sub, #94a3b8); font-size:13px; line-height:1.6; display:block;">
            这是属于他们最私密的灵宠空间<br>
            <span style="font-size:11.5px; margin-top:4px; display:inline-block; opacity:0.8;">※ 仅持印者设备有权限进行喂养与互动</span>
          </span>
        `;
        
        // 将下半部分交互区隐藏，并在其上方插入锁定面板
        el.style.display = "none";
      }
    });

    // 更彻底地：凡是带有 feed 或 log 的区域统一拦截
    document.querySelectorAll(".grace-action-section, .grace-log-list").forEach(sec => {
      sec.style.display = "none";
      if (!sec.nextElementSibling || sec.nextElementSibling.id !== "pet-guest-lock-panel") {
        const lockPanel = document.createElement("div");
        lockPanel.style.cssText = "text-align:center; padding:32px 20px; background:var(--bg-card, rgba(255,255,255,0.03)); border:1.5px dashed var(--border-card, rgba(255,255,255,0.15)); border-radius:20px; margin:16px 0; box-shadow:0 8px 32px rgba(0,0,0,0.2);";
        lockPanel.innerHTML = `
          <span style="font-size:38px; display:block; margin-bottom:10px;">🔒</span>
          <span style="color:var(--text-hero, #e2e8f0); font-size:15px; font-weight:900; display:block; margin-bottom:6px;">展览模式：恩典陪伴互动已锁定</span>
          <span style="color:var(--text-sub, #94a3b8); font-size:12.5px; line-height:1.5; display:block;">
            ※ 仅持印者设备有权限进行喂养与互动
          </span>
        `;
        sec.parentNode.insertBefore(lockPanel, sec);
      }
    });
  }

  bindUnlockVisibility() {
    const showWidget = () => {
      const widget = document.getElementById("grace-pet-trigger");
      if (widget) widget.classList.add("grace-pet-widget--visible");
    };
    window.addEventListener("universe:unlocked", showWidget);
    const gateScreen = document.getElementById("gatekeeper-screen");
    const mainContainer = document.getElementById("main-container");
    if ((gateScreen && gateScreen.style.display === "none") || (mainContainer && !mainContainer.classList.contains("main-container--hidden")) || (this.config.gatekeeper && this.config.gatekeeper.enabled === false)) {
      showWidget();
    }
  }

  bindAchievementInterceptors() {
    window.addEventListener("achievement:trigger", (e) => {
      const type = (e.detail || {}).type;
      if (type === "icebreaker_resolved") this.unlockSpecificBadge("first_peace");
      else if (type === "polaroid_flipped") {
        this.petData.flippedCardsCount = (this.petData.flippedCardsCount || 0) + 1;
      }
      else if (type === "music_played") {
        this.petData.playedSongsCount = (this.petData.playedSongsCount || 0) + 1;
      }
      else if (type === "egg_discovered") {
        this.petData.foundEggsCount = (this.petData.foundEggsCount || 0) + 1;
      }
      
      try {
         const localDiary = localStorage.getItem("LOVE_DIARY_LOCAL_CACHE");
         if (localDiary) {
            const parsed = JSON.parse(localDiary);
            if (parsed.notes && Array.isArray(parsed.notes)) {
              this.petData.diaryCount = parsed.notes.length;
              if (this.petData.diaryCount >= 1) this.unlockSpecificBadge("diary_1");
            }
         }
      } catch (_) {}

      this.saveLocalPetData(); this.checkAllBadgeUnlocks(); this.updateUI();
    });
  }

  checkAllBadgeUnlocks() {
    if (this.isEvaluatingBadges) return;
    this.isEvaluatingBadges = true;
    const tier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    for (let i = 1; i <= tier.level; i++) { this.unlockSpecificBadge(`lvl_${i}`, false); }

    const allBadges = (window.PetCelebrationManager && window.PetCelebrationManager.BADGE_DEFINITIONS) || [];
    allBadges.forEach(b => {
      if (b.tracker && b.target) {
        const currentVal = Number(this.petData[b.tracker]) || 0;
        const actualVal = (b.tracker === "streakDays") ? Math.max(currentVal, this.petData.longestStreak || 0) : currentVal;
        if (actualVal >= b.target) {
          this.unlockSpecificBadge(b.id, false);
        }
      }
    });

    this.isEvaluatingBadges = false;
  }

  unlockSpecificBadge(badgeId, triggerModal = true) {
    if (!Array.isArray(this.petData.unlockedBadges)) this.petData.unlockedBadges = [];
    if (this.petData.unlockedBadges.includes(badgeId)) return;
    
    this.petData.unlockedBadges.push(badgeId);
    this.saveLocalPetData();

    const allBadges = (window.PetCelebrationManager && window.PetCelebrationManager.BADGE_DEFINITIONS) || [];
    const badgeMeta = allBadges.find(b => b.id === badgeId);
    if (badgeMeta && triggerModal && window.PetCelebration) window.PetCelebration.triggerBadgeUnlock(badgeMeta);
    this.syncToCloud(`✨ 荣耀解锁新徽章【${(badgeMeta && badgeMeta.name) || badgeId}】！`);
  }

  checkNaturalDayStreakReset() {
    const last = this.petData.lastInteractionDate;
    if (!last) return;
    const today = this.getTodayDateStr();
    if (last === today) return;
    try {
      const lastTime = new Date(last.replace(/-/g, "/")).getTime();
      const todayTime = new Date(today.replace(/-/g, "/")).getTime();
      if (Math.round((todayTime - lastTime) / (1000 * 3600 * 24)) > 1) {
        this.petData.streakDays = 0; this.saveLocalPetData();
      }
    } catch (_) {}
  }

  updateStreakOnInteraction() {
    const today = this.getTodayDateStr();
    const last = this.petData.lastInteractionDate;
    if (!last) this.petData.streakDays = 1;
    else if (last !== today) {
      try {
        const diff = Math.round((new Date(today.replace(/-/g, "/")).getTime() - new Date(last.replace(/-/g, "/")).getTime()) / 86400000);
        this.petData.streakDays = diff === 1 ? (this.petData.streakDays || 0) + 1 : 1;
      } catch (_) { this.petData.streakDays = 1; }
    }
    this.petData.longestStreak = Math.max(this.petData.longestStreak || 0, this.petData.streakDays);
    this.petData.lastInteractionDate = today;
  }

  async fetchCloudPetData() {
    try {
      const res = await fetch("/api/love/pet");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.petData) {
        const cloudData = this.migrateSchema(data.petData);
        const localTotal = (this.petData.gratitudeCount || 0) + (this.petData.sacrificeCount || 0);
        const cloudTotal = (cloudData.gratitudeCount || 0) + (cloudData.sacrificeCount || 0);
        if (cloudTotal >= localTotal) {
          const mergedBadges = Array.from(new Set([...(this.petData.unlockedBadges || []), ...(cloudData.unlockedBadges || [])]));
          this.petData = { ...cloudData, unlockedBadges: mergedBadges };
          this.saveLocalPetData(); this.checkAllBadgeUnlocks(); this.updateUI();
          this.applyGuestExhibitionShield();
        }
      }
    } catch (_) {}
  }

  injectDOM() {
    if (!document.getElementById("grace-pet-trigger") && window.location.pathname.indexOf('pet.html') === -1) {
      const tier = GracePetManager.getTierInfo(this.petData.glowEnergy);
      const widget = document.createElement("div");
      widget.className = "grace-pet-widget";
      widget.id = "grace-pet-trigger";
      widget.title = "点击进入恩典灵宠全景空间";
      widget.innerHTML = `
        <div class="grace-pet-avatar"><span id="grace-pet-icon-display">${tier.icon}</span><div class="grace-pet-halo"></div></div>
        <div class="grace-pet-badge" id="grace-pet-level-badge">LV.${tier.level} ${tier.title}</div>
      `;
      document.body.appendChild(widget);
    }
  }

  bindEvents() {
    const trigger = document.getElementById("grace-pet-trigger");
    if (trigger) {
      trigger.onclick = () => { window.location.href = 'pet.html'; };
    }
    
    const feedBtn = document.getElementById("feed-gratitude-btn");
    const sacrificeBtn = document.getElementById("feed-sacrifice-btn");
    if (feedBtn) feedBtn.onclick = () => this.feedGratitude();
    if (sacrificeBtn) sacrificeBtn.onclick = () => this.triggerSacrifice();
  }

  feedGratitude() {
    // 🌟 物理阻断：游客无权喂养
    if (!localStorage.getItem("love_owner_token")) return;

    const input = document.getElementById("gratitude-input");
    const text = input ? input.value.trim() : "";
    if (!text) return alert("请写下一句发自内心的感恩之言！");

    const oldTier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    this.updateStreakOnInteraction();
    const bonus = GracePetManager.getStreakBonus(this.petData.streakDays);
    const addedGlow = Math.round(15 * bonus.mult);

    this.petData.glowEnergy = (this.petData.glowEnergy || 0) + addedGlow;
    this.petData.totalGlowEarned = (this.petData.totalGlowEarned || 0) + addedGlow;
    this.petData.gratitudeCount = (this.petData.gratitudeCount || 0) + 1;

    if (!Array.isArray(this.petData.logs)) this.petData.logs = [];
    const d = new Date();
    this.petData.logs.unshift({ type: "gratitude", text: `${text} (+${addedGlow}光芒 · ${bonus.title})`, date: `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}` });

    if (input) input.value = "";
    const newTier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    this.petData.currentLevel = newTier.level; this.petData.icon = newTier.icon;
    
    this.saveLocalPetData(); this.checkAllBadgeUnlocks(); this.updateUI();

    if (newTier.level > oldTier.level && window.PetCelebration) window.PetCelebration.triggerLevelUp(newTier);
    else if (window.Effects) {
      if (typeof window.Effects.fireFireworks === "function") window.Effects.fireFireworks();
      if (typeof window.Effects.playAudio === "function") window.Effects.playAudio("stamp");
    }
    this.syncToCloud(`✓ 已献上感恩之露 (+${addedGlow} 光芒能量)！`);
  }

  triggerSacrifice() {
    // 🌟 物理阻断：游客无权触发舍己
    if (!localStorage.getItem("love_owner_token")) return;

    if (!confirm("确定要在本次争执或意见分歧中，主动选择退让与包容吗？\n爱情不是讲理的地方，而是舍己与接纳的地方。")) return;
    const oldTier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    this.updateStreakOnInteraction();
    const bonus = GracePetManager.getStreakBonus(this.petData.streakDays);
    const addedGlow = Math.round(30 * bonus.mult);

    this.petData.glowEnergy = (this.petData.glowEnergy || 0) + addedGlow;
    this.petData.totalGlowEarned = (this.petData.totalGlowEarned || 0) + addedGlow;
    this.petData.sacrificeCount = (this.petData.sacrificeCount || 0) + 1;

    if (!Array.isArray(this.petData.logs)) this.petData.logs = [];
    const d = new Date();
    this.petData.logs.unshift({ type: "sacrifice", text: `在分歧中主动选择退让一步，因你比对错更重要 (+${addedGlow}光芒 · ${bonus.title})`, date: `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}` });

    const newTier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    this.petData.currentLevel = newTier.level; this.petData.icon = newTier.icon;

    this.saveLocalPetData(); this.checkAllBadgeUnlocks(); this.updateUI();

    if (newTier.level > oldTier.level && window.PetCelebration) window.PetCelebration.triggerLevelUp(newTier);
    else if (window.Effects) {
      if (typeof window.Effects.fireConfetti === "function") window.Effects.fireConfetti();
      if (typeof window.Effects.playAudio === "function") window.Effects.playAudio("gatekeeperPass");
    }
    this.syncToCloud(`🕊️ 结出宝贵舍己之果 (+${addedGlow} 光芒)，愿爱化解一切隔阂！`);
  }

  updateUI() {
    const tier = GracePetManager.getTierInfo(this.petData.glowEnergy);
    const bonus = GracePetManager.getStreakBonus(this.petData.streakDays);

    const safeUpdate = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

    safeUpdate("grace-pet-icon-display", el => el.textContent = tier.icon);
    safeUpdate("grace-pet-level-badge", el => el.textContent = `LV.${tier.level} ${tier.title}`);
    safeUpdate("grace-pet-big-icon", el => el.textContent = tier.icon);
    safeUpdate("grace-pet-tier-pill", el => {
      el.textContent = `LV.${tier.level} · ${tier.stageName}`;
      el.style.background = `${tier.badgeColor}22`; el.style.borderColor = tier.badgeColor; el.style.color = tier.badgeColor;
    });
    safeUpdate("grace-pet-display-name", el => el.textContent = tier.title);
    safeUpdate("grace-pet-display-desc", el => el.textContent = tier.desc);

    safeUpdate("progress-level-current", el => el.textContent = `LV.${tier.level} ${tier.title}`);
    safeUpdate("progress-level-target", el => el.textContent = tier.nextReq ? `距 LV.${tier.level + 1} 尚需 ${tier.nextReq - this.petData.glowEnergy} 光芒` : "✨ 已达神性极阶");
    safeUpdate("grace-level-progress-fill", el => {
      let percent = 100;
      if (tier.nextReq) percent = Math.min(100, Math.max(0, Math.round(((this.petData.glowEnergy - tier.req) / (tier.nextReq - tier.req)) * 100)));
      el.style.width = `${percent}%`;
    });

    safeUpdate("stat-glow-energy", el => el.textContent = this.petData.glowEnergy);
    safeUpdate("stat-streak-days", el => el.textContent = `🔥 ${this.petData.streakDays} 天`);
    safeUpdate("stat-streak-bonus", el => el.textContent = bonus.title);
    safeUpdate("stat-gratitude-count", el => el.textContent = this.petData.gratitudeCount);
    safeUpdate("stat-sacrifice-count", el => el.textContent = this.petData.sacrificeCount);
    safeUpdate("action-streak-tag", el => el.textContent = `连胜加成 ${bonus.mult}x`);

    const allBadges = (window.PetCelebrationManager && window.PetCelebrationManager.BADGE_DEFINITIONS) || [];
    const unlockedList = this.petData.unlockedBadges || [];

    safeUpdate("grace-badges-unlocked-count", el => el.textContent = `已点亮 ${unlockedList.length} / ${allBadges.length}`);
    safeUpdate("grace-badge-grid-container", el => {
      el.innerHTML = allBadges.map(badge => {
        const isUnlocked = unlockedList.includes(badge.id);
        
        let progressHtml = `<span class="grace-badge-desc-tip">未点亮</span>`;

        if (isUnlocked) {
          progressHtml = `<span class="grace-badge-desc-tip" style="color: #f59e0b; font-weight:800;">✓ 已点亮</span>`;
        } else if (badge.tracker && badge.target) {
          const currentVal = Number(this.petData[badge.tracker]) || 0;
          const actualVal = (badge.tracker === "streakDays") ? Math.max(currentVal, this.petData.longestStreak || 0) : currentVal;
          const pct = Math.min(100, Math.round((actualVal / badge.target) * 100));
          
          progressHtml = `
            <div style="width: 100%; padding: 0 10px; margin-top: 4px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 3px; display:flex; justify-content:space-between;">
                <span>进度</span><span>${actualVal}/${badge.target}</span>
              </div>
              <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #a855f7); border-radius: 2px;"></div>
              </div>
            </div>
          `;
        }

        return `
          <div class="grace-badge-card ${isUnlocked ? 'unlocked' : 'locked'}" title="${badge.name}: ${badge.desc}" onclick="window.Effects && window.Effects.showMiniToast('${badge.icon} 【${badge.name}】: ${badge.desc}')">
            <span class="grace-badge-icon">${badge.icon}</span>
            <span class="grace-badge-name">${badge.name}</span>
            ${progressHtml}
          </div>
        `;
      }).join("");
    });

    safeUpdate("grace-log-container", el => {
      const logs = this.petData.logs || [];
      if (logs.length === 0) el.innerHTML = `<div style="text-align:center; color:#64748b; font-size:11.5px; padding:12px;">暂无足迹，写下一句感恩开始喂养吧</div>`;
      else el.innerHTML = logs.slice(0, 15).map(item => `
          <div class="grace-log-item">
            <div>${item.type === "sacrifice" ? "🍎 【舍己之果】" : "💧 【感恩之露】"} ${this.escape(item.text)}</div>
            <span>${item.date}</span>
          </div>
        `).join("");
    });
  }

  async syncToCloud(successMsg) {
    if (!localStorage.getItem("love_owner_token")) return;
    try { await fetch("/api/love/pet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ petData: this.petData }) }); } catch (_) {}
    if (window.Effects && typeof window.Effects.showMiniToast === "function") window.Effects.showMiniToast(successMsg);
    else alert(successMsg);
  }

  escape(str) { return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
}

window.GracePetManager = GracePetManager;
