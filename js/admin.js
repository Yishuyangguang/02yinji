/**
 * 众水不灭 · 雅歌之印 (Love Universe) 控制中心主控
 * 文件名: js/admin.js
 */

let currentConfig = null;
let currentQuota = null; 
let currentAdminToken = "";
let currentDomainHost = "";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function getAuthToken() {
  return (currentAdminToken || localStorage.getItem("love_admin_token") || "").trim();
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function getLocalSongCount() {
  const list = currentConfig?.audio?.playlist || [];
  return list.filter(s => s && s.url && (s.url.startsWith("/raw/") || s.url.includes("/assets/"))).length;
}

function parseSongFilename(filename) {
  const clean = filename.replace(/\.[^/.]+$/, "").trim();
  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  } else if (clean.includes("-")) {
    const parts = clean.split("-");
    return { artist: parts[0].trim(), title: parts.slice(1).join("-").trim() };
  } else if (clean.includes("_")) {
    const parts = clean.split("_");
    return { artist: parts[0].trim(), title: parts.slice(1).join("_").trim() };
  }
  return { artist: "本地上传", title: clean };
}

function mergeWithDefaultConfig(cloudCfg) {
  const base = JSON.parse(JSON.stringify(window.LOVE_CONFIG || {}));
  if (!cloudCfg || typeof cloudCfg !== "object") return base;

  return {
    ...base,
    ...cloudCfg,
    meta: { ...(base.meta || {}), ...(cloudCfg.meta || {}) },
    gatekeeper: { ...(base.gatekeeper || {}), ...(cloudCfg.gatekeeper || {}) },
    letter: { ...(base.letter || {}), ...(cloudCfg.letter || {}) },
    audio: {
      playlist: [],
      ...(base.audio || {}),
      ...(cloudCfg.audio || {}),
      playlist: Array.isArray(cloudCfg.audio?.playlist) ? cloudCfg.audio.playlist : (base.audio?.playlist || [])
    },
    theme: { ...(base.theme || {}), ...(cloudCfg.theme || {}) },
    lifecycle: { ...(base.lifecycle || {}), ...(cloudCfg.lifecycle || {}) },
    anniversaries: (Array.isArray(cloudCfg.anniversaries) && cloudCfg.anniversaries.length > 0) ? cloudCfg.anniversaries : (base.anniversaries || []),
    icebreaker: {
      enabled: cloudCfg.icebreaker?.enabled !== false,
      cooldownMinutes: cloudCfg.icebreaker?.cooldownMinutes || base.icebreaker?.cooldownMinutes || 15,
      soundEnabled: cloudCfg.icebreaker?.soundEnabled !== false,
      actions: cloudCfg.icebreaker?.actions || base.icebreaker?.actions || {}
    },
    timeline: (Array.isArray(cloudCfg.timeline) && cloudCfg.timeline.length > 0) ? cloudCfg.timeline : (base.timeline || []),
    checklist100: (Array.isArray(cloudCfg.checklist100) && cloudCfg.checklist100.length > 0) ? cloudCfg.checklist100 : (base.checklist100 || []),
    scratchCards: (Array.isArray(cloudCfg.scratchCards) && cloudCfg.scratchCards.length > 0) ? cloudCfg.scratchCards : (base.scratchCards || []),
    easterEggs: (Array.isArray(cloudCfg.easterEggs) && cloudCfg.easterEggs.length > 0) ? cloudCfg.easterEggs : (base.easterEggs || []),
    birthdayCapsules: (Array.isArray(cloudCfg.birthdayCapsules) && cloudCfg.birthdayCapsules.length > 0) ? cloudCfg.birthdayCapsules : (base.birthdayCapsules || []),
    
    _license: cloudCfg._license || base._license || null,
    adminSecurity: cloudCfg.adminSecurity || base.adminSecurity || { password: "" }
  };
}

function syncAdminBackgroundTheme() {
  if (!currentConfig || !currentConfig.theme) return;
  
  const perspective = localStorage.getItem('love_perspective') || 'boy';
  let themeId = 'sunset-twilight';
  let customBg = '';

  if (perspective === 'girl') {
    themeId = currentConfig.theme.currentThemeGirl || 'french-cream';
    customBg = currentConfig.theme.customBgUrlGirl || '';
  } else {
    themeId = currentConfig.theme.currentThemeBoy || currentConfig.theme.currentTheme || 'sunset-twilight';
    customBg = currentConfig.theme.customBgUrlBoy || currentConfig.theme.customBgUrl || '';
  }

  let themeType = 'dark';
  const presets = window.THEME_PRESETS || { boy: [], girl: [] };
  const allPresets = [...presets.boy, ...presets.girl];
  const foundTheme = allPresets.find(t => t.id === themeId);
  if (foundTheme) {
    themeType = foundTheme.themeType || 'dark';
  }

  document.body.className = `theme-${themeId}`;
  document.body.setAttribute('data-theme-type', themeType);

  const bgLayer = document.getElementById('universe-bg-layer');
  if (bgLayer) {
    if (customBg) {
      bgLayer.style.backgroundImage = `url('${customBg}')`;
      bgLayer.style.backgroundSize = 'cover';
      bgLayer.style.backgroundPosition = 'center';
    } else {
      bgLayer.style.backgroundImage = 'var(--theme-bg-gradient)';
    }
  }
}

async function fetchConfigFromCloud(tokenOverride) {
  const token = (tokenOverride || getAuthToken()).trim();
  if (!token) return false;

  try {
    const res = await fetch(`/api/love/config?auth=${encodeURIComponent(token)}`, {
      headers: { "x-admin-auth": token, "Authorization": `Bearer ${token}` }
    });
    
    if (!res.ok) {
      return fallbackLocalAuth(token);
    }
    
    const data = await res.json();
    if (data.success) {
      currentDomainHost = data.domain || window.location.hostname;
      currentQuota = data.quota || null;
      const displayDomain = decodePunycodeHost(currentDomainHost);
      const domainBadge = document.getElementById("adminDomainBadge");
      if (domainBadge) domainBadge.textContent = `我的网址: ${displayDomain}`;

      if (data.custom && data.config) {
        currentConfig = mergeWithDefaultConfig(data.config);
      } else {
        currentConfig = JSON.parse(JSON.stringify(window.LOVE_CONFIG || {}));
      }

      const activePwd = (currentConfig.adminSecurity?.password || "").trim();
      if (data.isAdmin || (activePwd && token === activePwd)) {
        currentAdminToken = token;
        localStorage.setItem("love_admin_token", token);
        renderAllForms();
        syncAdminBackgroundTheme(); 
        return true;
      }
    }
    return false;
  } catch (_) {
    return fallbackLocalAuth(token);
  }
}

function fallbackLocalAuth(token) {
  currentConfig = JSON.parse(JSON.stringify(window.LOVE_CONFIG || {}));
  currentQuota = null;
  const activePwd = (currentConfig.adminSecurity?.password || "").trim();
  if (activePwd && token === activePwd) {
    currentAdminToken = token;
    localStorage.setItem("love_admin_token", token);
    renderAllForms();
    syncAdminBackgroundTheme(); 
    return true;
  }
  return false;
}

// 🌟 核心修复区：严格控制数据提交时序与阻塞弹窗
async function modifyAdminPasswordWithOld() {
  const oldPwdInput = document.getElementById("admin_oldPassword");
  const newPwdInput = document.getElementById("admin_newPassword");
  const confirmPwdInput = document.getElementById("admin_confirmPassword");

  const oldPwd = oldPwdInput ? oldPwdInput.value.trim() : "";
  const newPwd = newPwdInput ? newPwdInput.value.trim() : "";
  const confirmPwd = confirmPwdInput ? confirmPwdInput.value.trim() : "";

  const activePwd = (currentConfig?.adminSecurity?.password || "").trim();
  const isFirstSetup = !activePwd; 

  if (!isFirstSetup) {
    if (!oldPwd) {
      alert("⚠️ 请输入当前的原管理密码（旧密码）！");
      if (oldPwdInput) oldPwdInput.focus();
      return;
    }
    if (oldPwd !== activePwd) {
      alert("❌ 原管理密码验证失败！旧密码错误，无法修改。");
      if (oldPwdInput) { oldPwdInput.value = ""; oldPwdInput.focus(); }
      return;
    }
  }

  if (!newPwd) {
    alert("⚠️ 请输入新管理密码！");
    if (newPwdInput) newPwdInput.focus();
    return;
  }

  if (newPwd.length < 3) {
    alert("⚠️ 新管理密码长度建议不少于 3 位！");
    if (newPwdInput) newPwdInput.focus();
    return;
  }

  if (newPwd !== confirmPwd) {
    alert("❌ 两次输入的新管理密码不一致，请重新核对！");
    if (confirmPwdInput) { confirmPwdInput.value = ""; confirmPwdInput.focus(); }
    return;
  }

  if (!isFirstSetup && newPwd === oldPwd) {
    alert("💡 新管理密码与原密码完全一致，无需修改。");
    return;
  }

  if (!confirm(isFirstSetup
    ? `首次设置后台管理密码为【${newPwd}】吗？\n\n设置后请务必牢记，之后只能用该密码登录管理后台。`
    : `确认将后台管理密码修改为【${newPwd}】吗？\n\n请务必牢记新密码，修改后旧密码将立即失效！`)) return;

  // 1. 暂存旧密码以防网络请求失败回滚
  const backupPwd = currentConfig.adminSecurity ? currentConfig.adminSecurity.password : "";

  if (!currentConfig.adminSecurity) currentConfig.adminSecurity = {};
  currentConfig.adminSecurity.password = newPwd;
  currentConfig.adminSecurity.updatedAt = new Date().toISOString();

  const hiddenCustomPwd = document.getElementById("admin_customPassword");
  if (hiddenCustomPwd) hiddenCustomPwd.value = newPwd;

  // 2. 只有在此处等待云端 200 OK 确认返回 success 后，才能弹出成功弹窗
  const success = await saveAllConfigToCloud(newPwd);
  
  if (success) {
    if (oldPwdInput) oldPwdInput.value = "";
    if (newPwdInput) newPwdInput.value = "";
    if (confirmPwdInput) confirmPwdInput.value = "";
    alert("🎉 管理密码修改成功！新密码已生效并同步云端。");
  } else {
    // 3. 请求失败时，自动将内存里的配置数据回滚至旧密码，防止下次点击错误发布
    currentConfig.adminSecurity.password = backupPwd;
    if (hiddenCustomPwd) hiddenCustomPwd.value = backupPwd;
  }
}

function renderAllForms() {
  if (!currentConfig) return;

  try {
    const sec = currentConfig.adminSecurity || {};
    const hiddenCustomPwd = document.getElementById("admin_customPassword");
    if (hiddenCustomPwd) hiddenCustomPwd.value = sec.password || "";

    const lifecycle = currentConfig.lifecycle || {};
    document.getElementById("lifecycle_phase").value = lifecycle.currentPhase || "dating";

    const meta = currentConfig.meta || {};
    document.getElementById("meta_boyName").value = meta.boyName || "";
    document.getElementById("meta_girlName").value = meta.girlName || "";
    document.getElementById("meta_startDate").value = meta.startDate || "";
    document.getElementById("meta_nextMilestoneTitle").value = meta.nextMilestoneTitle || "";
    document.getElementById("meta_nextMilestoneDate").value = meta.nextMilestoneDate || "";
    document.getElementById("meta_siteTitle").value = meta.siteTitle || "";
    document.getElementById("meta_siteSubtitle").value = meta.siteSubtitle || "";

    const gate = currentConfig.gatekeeper || {};
    document.getElementById("gatekeeper_enabled").value = String(gate.enabled !== false);
    document.getElementById("gatekeeper_title").value = gate.title || "";
    document.getElementById("gatekeeper_question").value = gate.question || "";
    document.getElementById("gatekeeper_hint").value = gate.hint || "";
    document.getElementById("gatekeeper_correctAnswer").value = gate.correctAnswer || "";
    document.getElementById("gatekeeper_voiceVows").value = gate.voiceVows || "";
    document.getElementById("gatekeeper_errorTips").value = (gate.errorTips || []).join("\n");

    const letter = currentConfig.letter || {};
    document.getElementById("letter_title").value = letter.title || "";
    document.getElementById("letter_signDate").value = letter.signDate || "";
    document.getElementById("letter_signature").value = letter.signature || "";
    document.getElementById("letter_content").value = letter.content || "";

    renderTimelineList();
    renderAnniversariesList();
    renderIcebreakerSettings();
    renderChecklist();
    renderScratchCards();
    renderBirthdayCapsules(); 

    const audio = currentConfig.audio || {};
    document.getElementById("audio_bgmAutoPlay").value = String(audio.bgmAutoPlay !== false);
    document.getElementById("audio_playMode").value = audio.playMode || "list-loop";
    document.getElementById("audio_bgmTitle").value = audio.bgmTitle || "";
    document.getElementById("audio_bgmArtist").value = audio.bgmArtist || "";
    document.getElementById("audio_bgmUrl").value = audio.bgmUrl || "";
    document.getElementById("audio_vinylCover").value = audio.vinylCover || "";

    renderPlaylist();

    const eggs = currentConfig.easterEggs || [];
    document.getElementById("egg_1_message").value = eggs[0]?.message || "";
    document.getElementById("egg_2_message").value = eggs[1]?.message || "";

    renderThemeShowroom();
    renderLicenseStatus();
    renderQuotaStatus();
  } catch (err) {
    console.warn("表单渲染兼容模式：", err);
  }
}

function renderLicenseStatus() {
  const badge = document.getElementById("licenseStatusBadge");
  if (!badge) return;
  const displayHost = decodePunycodeHost(currentConfig._license?.boundDomain || currentDomainHost);
  
  const tierLabel = { basic: "基础免费版", luxury: "PRO豪华版", flagship: "PRO旗舰版" };
  
  const currentTierKey = currentQuota?.tier || "basic";
  const displayTierName = tierLabel[currentTierKey] || "基础免费版";

  if (currentConfig._license && currentConfig._license.unlocked) {
    badge.innerHTML = `<span style="color:#34d399;">✨ 已永久激活【${displayTierName}】 (绑定网址: ${displayHost})</span>`;
  } else {
    badge.innerHTML = `<span style="color:#f59e0b;">⏳ 基础免费版 (未输入专属激活码)</span>`;
  }
}

function renderQuotaStatus() {
  const box = document.getElementById("quotaStatusBox");
  const proBadge = document.getElementById("adminProBadge");

  if (!currentQuota) {
    if (box) box.innerHTML = `<div style="color:#94a3b8;">暂无配额信息（本地模式或未加载云端配置）</div>`;
    if (proBadge) proBadge.style.display = "none";
    return;
  }
  
  const tier = currentQuota.tier || "basic";
  
  if (proBadge) {
    if (tier !== "basic") {
      proBadge.style.display = "inline-flex";
      if (tier === "flagship") {
        proBadge.innerHTML = "👑 PRO 旗舰"; 
      } else {
        proBadge.innerHTML = "PRO"; 
      }
    } else {
      proBadge.style.display = "none";
    }
  }

  if (!box) return;

  const percent = currentQuota.percent || 0;
  const full = !!currentQuota.full;
  const pctText = percent >= 100 ? "已满" : percent + "%";
  
  let quotaText = "基础免费版 (未激活)";
  if (tier === "luxury") quotaText = "PRO豪华版";
  if (tier === "flagship") quotaText = "PRO旗舰版";

  let hintText = "基础版有存储与单文件限制，可输入升级码解锁更大空间。";
  if (tier === "luxury") hintText = "✨ 存储空间已扩容至 PRO 豪华版标准。";
  if (tier === "flagship") hintText = "✨ 存储空间已扩容至 PRO 旗舰版最高标准。";
  
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
      <span>💾 存储用量：<span class="highlight-text">${quotaText}</span></span>
      <span style="color:${full ? "#ef4444" : "#f59e0b"};">${pctText}</span>
    </div>
    <div style="height:12px;background:#1e293b;border-radius:999px;overflow:hidden;margin-bottom:10px;">
      <div style="height:100%;width:${percent}%;background:${full ? "#ef4444" : "linear-gradient(90deg,#818cf8,#c084fc)"};transition:width .4s;"></div>
    </div>
    ${full ? `<div style="color:#ef4444;margin-bottom:8px;">⚠️ 存储空间已满，新的文件将无法上传。请联系卖家购买升级码扩容。</div>
      <button class="btn-upload" onclick="document.getElementById('inputLicenseCode').focus()">🚀 升级套餐（输入升级码）</button>`
    : `<div style="color:#94a3b8;font-size:13px;">${hintText}</div>`}
  `;
}

async function submitDomainLicense() {
  const codeInput = document.getElementById("inputLicenseCode");
  const code = codeInput ? codeInput.value.trim() : "";
  if (!code) return alert("请输入授权兑换码！");
  showToast("⏳ 正在验证...");
  try {
    const res = await fetch("/api/love/verify-license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseCode: code, currentConfig })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.message}`);
      await fetchConfigFromCloud();
    } else {
      alert(`❌ 激活失败: ${data.message}`);
    }
  } catch (err) {
    alert("❌ 请求异常: " + err.message);
  }
}

function renderBirthdayCapsules() {
  const container = document.getElementById("birthdayCapsulesContainer");
  if (!container) return;
  container.innerHTML = "";
  (currentConfig.birthdayCapsules || []).forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">🎁 时空盲盒 #${idx + 1}</span>
        <div><button class="btn-del" onclick="deleteBirthdayCapsule(${idx})">🗑️ 删除</button></div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>送给谁？</label>
          <select class="admin-select" id="bd_target_${idx}" onchange="currentConfig.birthdayCapsules[${idx}].target=this.value">
            <option value="girl" ${item.target==='girl'?'selected':''}>送给她 (女孩视角)</option>
            <option value="boy" ${item.target==='boy'?'selected':''}>送给他 (男孩视角)</option>
          </select>
        </div>
        <div class="form-group"><label>解锁日期 (如: 2026-05-20)</label><input type="text" class="admin-input" id="bd_date_${idx}" value="${escapeHtml(item.date || "")}"></div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>高定 3D 模版选项 (自动适配屏幕尺寸引擎)</label>
          <select class="admin-select highlight-text" id="bd_tpl_${idx}" onchange="currentConfig.birthdayCapsules[${idx}].template=this.value">
            <option value="A" ${item.template==='A'?'selected':''}>🪐 模版 A · 深空机甲 (男·炫酷科幻闪烁)</option>
            <option value="B" ${item.template==='B'?'selected':''}>👑 模版 B · 黑金岁月 (男·高奢镭射反光)</option>
            <option value="C" ${item.template==='C'?'selected':''}>❄️ 模版 C · 法式初雪 (女·清透毛玻璃冰晶)</option>
            <option value="D" ${item.template==='D'?'selected':''}>📸 模版 D · 复古相纸 (女·浪漫打字机滤镜)</option>
          </select>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>贺卡中心照片直链</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="bd_photo_${idx}" value="${escapeHtml(item.photo || "")}">
            <button class="btn-upload" onclick="triggerDirectUpload('bd_photo_${idx}', 'image/*')">🖼️ 上传照片</button>
          </div>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>🎙️ 专属录音音频直链（时长不限，仍受套餐存储上限约束）</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="bd_voice_${idx}" value="${escapeHtml(item.voiceAudio || "")}">
            <button class="btn-upload" onclick="triggerDirectUpload('bd_voice_${idx}', 'audio/*')">🎙️ 上传录音</button>
            <button class="btn-upload" onclick="toggleDirectRecord(this, 'bd_voice_${idx}')">🎙️ 点按直接录音</button>
          </div>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>贺卡祝福语 (支持换行，建议 50 字以内)</label>
          <textarea class="admin-textarea" id="bd_msg_${idx}" rows="3">${escapeHtml(item.message || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function addBirthdayCapsule() { 
  if (!currentConfig.birthdayCapsules) currentConfig.birthdayCapsules = []; 
  currentConfig.birthdayCapsules.push({ id: "bd_" + Date.now(), target: "girl", date: "2026-05-20", template: "C", photo: "", voiceAudio: "", message: "生日快乐，我的唯一！\n\n在漫长的一生一世里，我愿将最纯洁的爱全部毫无保留地交给你。" }); 
  renderBirthdayCapsules(); 
}

function deleteBirthdayCapsule(idx) { 
  if (confirm("⚠️ 确定要删除该生日盲盒胶囊吗？")) { currentConfig.birthdayCapsules.splice(idx, 1); renderBirthdayCapsules(); } 
}

function renderAnniversariesList() {
  const container = document.getElementById("anniversariesListContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!currentConfig.anniversaries) currentConfig.anniversaries = [];
  const list = currentConfig.anniversaries;

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:18px;">🍃 暂无纪念日数据，可点击上方快捷模板一键添加，或点击【➕ 自定义新增】。</div>`;
    return;
  }

  list.forEach((item, idx) => {
    const isCountup = item.type === "countup";
    const isTarget = item.type === "target";
    const isCountdown = item.type === "countdown" || (!isCountup && !isTarget);
    const isLunar = Boolean(item.isLunar);
    const isLeap = Boolean(item.isLeapMonth);
    const isPinned = Boolean(item.pinToHero);

    let previewMetrics = "";
    if (window.AnniversaryEngine) {
      const m = window.AnniversaryEngine.calculateAnniversaryMetrics(item);
      if (m) {
        if (m.mode === "countup") {
          previewMetrics = `已同行守护 ${m.totalDays} 天 (${m.summaryText})`;
        } else if (m.isToday) {
          previewMetrics = `🎉 正宣今天 · 岁岁常相伴`;
        } else {
          previewMetrics = `距离下一次还有 ${m.daysRemaining} 天 (${m.targetSolarDate})`;
        }
      }
    }

    const card = document.createElement("div");
    card.className = "item-card";
    if (isPinned) card.classList.add("theme-card--selected");

    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">
          ${escapeHtml(item.icon || "💖")} #${idx + 1} - ${escapeHtml(item.title || "未命名纪念日")}
          ${isPinned ? '<span class="highlight-text" style="font-size:10.5px; padding:2px 8px; border-radius:10px; margin-left:6px;">👑 首页主打倒数</span>' : ''}
          ${previewMetrics ? `<span style="font-size:11px; margin-left:8px;">[ ${previewMetrics} ]</span>` : ''}
        </span>
        <div>
          <button class="btn-tool" onclick="togglePinAnniversaryToHero(${idx})">${isPinned ? '★ 已主打' : '☆ 设为主打'}</button>
          <button class="btn-tool" onclick="moveAnniversaryItem(${idx}, -1)" ${idx === 0 ? "disabled" : ""}>⬆️</button>
          <button class="btn-tool" onclick="moveAnniversaryItem(${idx}, 1)" ${idx === list.length - 1 ? "disabled" : ""}>⬇️</button>
          <button class="btn-del" onclick="deleteAnniversaryItem(${idx})">🗑️ 删除</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>纪念日名称</label><input type="text" class="admin-input" id="anni_title_${idx}" value="${escapeHtml(item.title || "")}" oninput="currentConfig.anniversaries[${idx}].title=this.value"></div>
        <div class="form-group"><label>图标 Emoji</label><input type="text" class="admin-input" id="anni_icon_${idx}" value="${escapeHtml(item.icon || "💖")}" oninput="currentConfig.anniversaries[${idx}].icon=this.value"></div>
        <div class="form-group"><label>分类标签</label><input type="text" class="admin-input" id="anni_tag_${idx}" value="${escapeHtml(item.tag || "")}" oninput="currentConfig.anniversaries[${idx}].tag=this.value"></div>
        
        <div class="form-group">
          <label>度量模式</label>
          <select class="admin-select" id="anni_type_${idx}" onchange="currentConfig.anniversaries[${idx}].type=this.value; renderAnniversariesList();">
            <option value="countdown" ${isCountdown ? 'selected' : ''}>🔁 每年重复倒数 (生日/周年)</option>
            <option value="countup" ${isCountup ? 'selected' : ''}>⏳ 累积同行天数 (恋爱/领证)</option>
            <option value="target" ${isTarget ? 'selected' : ''}>🎯 未来单次目标 (求婚/预定)</option>
          </select>
        </div>

        <div class="form-group">
          <label>历法系统</label>
          <select class="admin-select" id="anni_islunar_${idx}" onchange="currentConfig.anniversaries[${idx}].isLunar=(this.value==='true'); renderAnniversariesList();">
            <option value="false" ${!isLunar ? 'selected' : ''}>☀️ 公历 (阳历)</option>
            <option value="true" ${isLunar ? 'selected' : ''}>🌙 农历 (阴历)</option>
          </select>
        </div>

        <div class="form-group" style="${isLunar ? '' : 'display:none;'}">
          <label>农历闰月属性</label>
          <select class="admin-select" id="anni_isleap_${idx}" onchange="currentConfig.anniversaries[${idx}].isLeapMonth=(this.value==='true'); renderAnniversariesList();">
            <option value="false" ${!isLeap ? 'selected' : ''}>平月 (正常月份)</option>
            <option value="true" ${isLeap ? 'selected' : ''}>闰月 (如闰四月)</option>
          </select>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>设定日期 (格式: YYYY-MM-DD)</label>
          <input type="text" class="admin-input" id="anni_date_${idx}" value="${escapeHtml(item.date || "")}" oninput="currentConfig.anniversaries[${idx}].date=this.value">
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>专属情书寄语</label>
          <textarea class="admin-textarea" rows="2" id="anni_memo_${idx}" oninput="currentConfig.anniversaries[${idx}].memo=this.value">${escapeHtml(item.memo || "")}</textarea>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>专属回忆照片直链</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="anni_bg_${idx}" value="${escapeHtml(item.bgImg || "")}" oninput="currentConfig.anniversaries[${idx}].bgImg=this.value">
            <button class="btn-upload" onclick="triggerDirectUpload('anni_bg_${idx}', 'image/*', (url)=>{ currentConfig.anniversaries[${idx}].bgImg=url; })">🖼️ 上传照片</button>
          </div>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>🎙️ 专属录音音频直链（时长不限，仍受套餐存储上限约束）</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="anni_voice_${idx}" value="${escapeHtml(item.voiceAudio || "")}" oninput="currentConfig.anniversaries[${idx}].voiceAudio=this.value">
            <button class="btn-upload" onclick="triggerDirectUpload('anni_voice_${idx}', 'audio/*', (url)=>{ currentConfig.anniversaries[${idx}].voiceAudio=url; })">🎙️ 上传录音</button>
            <button class="btn-upload" onclick="toggleDirectRecord(this, 'anni_voice_${idx}', (url)=>{ currentConfig.anniversaries[${idx}].voiceAudio=url; })">🎙️ 点按直接录音</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function addCustomAnniversaryItem() {
  if (!currentConfig.anniversaries) currentConfig.anniversaries = [];
  currentConfig.anniversaries.push({
    id: "anni_" + Date.now(), title: "新美好纪念日", type: "countdown", isLunar: false, isLeapMonth: false,
    date: "2026-05-20", annualRepeat: true, icon: "💖", tag: "专属印记", memo: "每一刻都值得铭记。", bgImg: "", voiceAudio: "", pinToHero: false
  });
  renderAnniversariesList();
  showToast("✓ 已添加自定义纪念日");
}

function addPresetAnniversaryTemplate(templateKey) {
  if (!currentConfig.anniversaries) currentConfig.anniversaries = [];
  const templates = {
    birthday_girl: { title: "她的农历生日", type: "countdown", isLunar: true, isLeapMonth: false, date: "1998-04-15", annualRepeat: true, icon: "🎂", tag: "专属诞辰", memo: "愿你一生被爱，眼里常有星辰大海。", bgImg: "", voiceAudio: "", pinToHero: false },
    birthday_boy: { title: "他的公历生日", type: "countdown", isLunar: false, isLeapMonth: false, date: "1996-10-24", annualRepeat: true, icon: "🪐", tag: "先生生辰", memo: "做我们小家庭永远遮风挡雨的港湾。", bgImg: "", voiceAudio: "", pinToHero: false },
    love_start: { title: "初次牵手 · 恋爱起点", type: "countup", isLunar: false, isLeapMonth: false, date: "2024-05-20", annualRepeat: false, icon: "💖", tag: "恋爱起点", memo: "牵起你手的那一刻，我知道余生有了归宿。", bgImg: "", voiceAudio: "", pinToHero: true },
    engaged: { title: "神圣订婚盟约之日", type: "countup", isLunar: false, isLeapMonth: false, date: "2025-05-20", annualRepeat: false, icon: "💍", tag: "盟约确立", memo: "愿得一人心，白首不相离。", bgImg: "", voiceAudio: "", pinToHero: false },
    married: { title: "领证结婚 · 合为一体", type: "countup", isLunar: false, isLeapMonth: false, date: "2026-10-01", annualRepeat: false, icon: "🏠", tag: "神圣婚典", memo: "缔结一生一世不可分开的神圣盟约。", bgImg: "", voiceAudio: "", pinToHero: false },
    travel: { title: "旅行之约", type: "target", isLunar: false, isLeapMonth: false, date: "2026-12-25", annualRepeat: false, icon: "✈️", tag: "浪漫之约", memo: "一起去向往的远方。", bgImg: "", voiceAudio: "", pinToHero: false }
  };
  const chosen = templates[templateKey];
  if (!chosen) return;
  currentConfig.anniversaries.push({ id: "anni_" + Date.now(), ...chosen });
  renderAnniversariesList();
  showToast(`✓ 已成功添加【${chosen.title}】`);
}

function togglePinAnniversaryToHero(idx) {
  if (!currentConfig.anniversaries) return;
  const targetState = !currentConfig.anniversaries[idx].pinToHero;
  currentConfig.anniversaries.forEach((item, i) => { item.pinToHero = (i === idx) ? targetState : false; });
  renderAnniversariesList();
  showToast(targetState ? `✓ 已设为首页主打倒数` : "✓ 已取消首页主打");
}

function deleteAnniversaryItem(idx) {
  if (confirm("确定删除该纪念日事件吗？")) { currentConfig.anniversaries.splice(idx, 1); renderAnniversariesList(); }
}

function moveAnniversaryItem(idx, direction) {
  const targetIdx = idx + direction;
  const list = currentConfig.anniversaries;
  if (targetIdx < 0 || targetIdx >= list.length) return;
  const temp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = temp;
  renderAnniversariesList();
}

function renderIcebreakerSettings() {
  if (!currentConfig) return;
  const ib = currentConfig.icebreaker || {};
  document.getElementById("icebreaker_enabled").value = String(ib.enabled !== false);
  document.getElementById("icebreaker_cooldownMinutes").value = ib.cooldownMinutes || 15;
  document.getElementById("icebreaker_cooldown_val").textContent = `${ib.cooldownMinutes || 15} 分钟`;
  document.getElementById("icebreaker_soundEnabled").value = String(ib.soundEnabled !== false);

  const container = document.getElementById("icebreakerActionsContainer");
  if (!container) return;

  const stages = [
    { key: "dating", name: "🌿 恋爱期 (严禁越界)" },
    { key: "engaged", name: "💍 订婚期 (盟约预备)" },
    { key: "married", name: "🏠 结婚期 (合为一体)" }
  ];

  const actionsData = ib.actions || window.LOVE_CONFIG?.icebreaker?.actions || {};

  container.innerHTML = stages.map(st => {
    const list = actionsData[st.key] || [];
    return `
      <div class="item-card highlight-panel" style="margin-bottom:14px; padding:16px;">
        <div class="highlight-text" style="font-size:14px; margin-bottom:12px;">${st.name}</div>
        <div style="display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto; padding-right:8px; scrollbar-width:thin;">
          ${list.map((act, actIdx) => `
            <div style="background:rgba(0,0,0,0.1); border:1px solid var(--timer-unit-border); border-radius:12px; padding:12px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <span style="font-size:18px;">${act.icon || "💖"}</span>
                <span style="font-size:13px; font-weight:800;">${escapeHtml(act.label || "动作名称")}</span>
                <span style="font-size:11px; margin-left:auto;">[类型: ${act.type}]</span>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:11px;">自定义台阶文案</label>
                <textarea class="admin-textarea" rows="3" oninput="updateIcebreakerActionText('${st.key}', '${act.type}', this.value)">${escapeHtml(act.desc || "")}</textarea>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function updateIcebreakerActionText(stageKey, actionType, val) {
  if (!currentConfig.icebreaker) currentConfig.icebreaker = {};
  if (!currentConfig.icebreaker.actions) currentConfig.icebreaker.actions = {};
  if (!Array.isArray(currentConfig.icebreaker.actions[stageKey])) {
    const baseActions = window.LOVE_CONFIG?.icebreaker?.actions?.[stageKey] || [];
    currentConfig.icebreaker.actions[stageKey] = JSON.parse(JSON.stringify(baseActions));
  }
  const target = currentConfig.icebreaker.actions[stageKey].find(a => a.type === actionType);
  if (target) target.desc = val;
}

async function clearIcebreakerHistory() {
  if (!confirm("⚠️ 确定要清空历史和好足迹与当前未决信号吗？此操作不可撤销。")) return;
  showToast("⏳ 正在重置...");
  try {
    const token = getAuthToken();
    const res = await fetch("/api/love/signal/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-auth": token, "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      alert("✨ 已成功清空历史信号与和好足迹！");
    } else {
      alert("❌ 操作失败: " + (data.error || "服务端异常"));
    }
  } catch (err) {
    alert("❌ 请求异常: " + err.message);
  }
}

function quickSearchTag(tagText) {
  document.getElementById("musicSearchKeyword").value = tagText;
  executeOnlineMusicSearch();
}

async function executeOnlineMusicSearch() {
  const kw = document.getElementById("musicSearchKeyword").value.trim();
  const listContainer = document.getElementById("onlineSearchResultList");
  if (!kw) return alert("请输入要搜索的歌名或歌手！");

  listContainer.innerHTML = `<div style="text-align:center; padding:10px;">⏳ 正在检索全网高保真音频流...</div>`;

  try {
    const res = await fetch(`/api/love/music-search?keyword=${encodeURIComponent(kw)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
      listContainer.innerHTML = data.songs.map((song, idx) => `
        <div class="item-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; margin-bottom:8px;">
          <div style="flex:1; overflow:hidden; margin-right:10px;">
            <div style="font-size:13.5px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(song.title)}</div>
            <div style="font-size:11.5px;">${escapeHtml(song.artist)}</div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn-tool preview-play-btn" id="prev_btn_${idx}" onclick="testPreviewAudio('${song.url}', 'prev_btn_${idx}', '${escapeHtml(song.title)}')">🎧 试听</button>
            <button class="btn-tool" onclick="addSongToPlaylist('${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', '${song.url}', '')">➕ 加歌单</button>
            <button class="btn-tool" onclick="setAsSingleBGM('${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', '${song.url}')">👑 主打</button>
          </div>
        </div>
      `).join("");
    } else {
      listContainer.innerHTML = `<div style="text-align:center; padding:10px;">🍃 未找到可用音频，建议直传MP3文件</div>`;
    }
  } catch (_) {
    listContainer.innerHTML = `<div style="text-align:center; padding:10px;">❌ 检索超时，请检查网络</div>`;
  }
}

function setAsSingleBGM(title, artist, url) {
  document.getElementById("audio_bgmTitle").value = title;
  document.getElementById("audio_bgmArtist").value = artist;
  document.getElementById("audio_bgmUrl").value = url;
  
  if (!currentConfig.audio) currentConfig.audio = {};
  if (!Array.isArray(currentConfig.audio.playlist)) currentConfig.audio.playlist = [];
  
  const exists = currentConfig.audio.playlist.some(s => s.url === url);
  if (!exists && currentConfig.audio.playlist.length < 50) {
    currentConfig.audio.playlist.unshift({ id: "song_" + Date.now(), title, artist, url, cover: "" });
    renderPlaylist();
  }
  showToast(`✓ 已将《${title}》设为主打歌，请点击立即发布生效！`);
}

function addSongToPlaylist(title, artist, url, cover) {
  if (!currentConfig.audio) currentConfig.audio = {};
  if (!Array.isArray(currentConfig.audio.playlist)) currentConfig.audio.playlist = [];
  if (currentConfig.audio.playlist.length >= 50) return alert("⚠️ 播放列表最多可添加 50 首音乐！");

  currentConfig.audio.playlist.push({ id: "song_" + Date.now(), title: title || "新添加曲目", artist: artist || "精选歌手", url: url || "", cover: cover || "" });
  renderPlaylist();
  showToast(`✓ 已将《${title}》加入播放列表`);
}

function renderPlaylist() {
  const container = document.getElementById("playlistContainer");
  const countBadge = document.getElementById("playlistCountBadge");
  if (!container) return;
  container.innerHTML = "";

  const list = currentConfig?.audio?.playlist || [];
  const localCount = getLocalSongCount();

  if (countBadge) countBadge.textContent = `(${list.length} / 50 首 · 本地已传 ${localCount})`;

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:18px;">🍃 暂无曲目，请先搜索或上传。</div>`;
    return;
  }

  list.forEach((song, idx) => {
    const isLocal = song.url && (song.url.startsWith("/raw/") || song.url.includes("/assets/"));
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.marginBottom = "10px";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">
          🎵 #${idx + 1} - ${escapeHtml(song.title || "未命名曲目")}
          ${isLocal ? '<span class="highlight-text" style="font-size:10px; padding:2px 6px; border-radius:8px; margin-left:6px;">本地文件</span>' : ''}
        </span>
        <div>
          <button class="btn-tool preview-play-btn" id="pl_prev_${idx}" onclick="testPreviewAudio('${song.url}', 'pl_prev_${idx}', '${escapeHtml(song.title)}')">🎧 试听</button>
          <button class="btn-tool" onclick="movePlaylistSong(${idx}, -1)" ${idx === 0 ? "disabled" : ""}>⬆️</button>
          <button class="btn-tool" onclick="movePlaylistSong(${idx}, 1)" ${idx === list.length - 1 ? "disabled" : ""}>⬇️</button>
          <button class="btn-del" onclick="deletePlaylistSong(${idx})">🗑️ 删除</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>歌名</label><input type="text" class="admin-input" id="pl_title_${idx}" value="${escapeHtml(song.title || "")}" oninput="currentConfig.audio.playlist[${idx}].title=this.value"></div>
        <div class="form-group"><label>歌手</label><input type="text" class="admin-input" id="pl_artist_${idx}" value="${escapeHtml(song.artist || "")}" oninput="currentConfig.audio.playlist[${idx}].artist=this.value"></div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>音频直链地址</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="pl_url_${idx}" value="${escapeHtml(song.url || "")}" oninput="currentConfig.audio.playlist[${idx}].url=this.value">
            <button class="btn-upload" onclick="triggerDirectUploadSongItem(${idx})">📤 上传MP3</button>
          </div>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>专属黑胶中心封面 (可选)</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="pl_cover_${idx}" value="${escapeHtml(song.cover || "")}" oninput="currentConfig.audio.playlist[${idx}].cover=this.value">
            <button class="btn-upload" onclick="triggerDirectUpload('pl_cover_${idx}', 'image/*', (url)=>{ currentConfig.audio.playlist[${idx}].cover=url; })">🖼️ 上传封面</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function addCustomPlaylistItem() {
  if (!currentConfig.audio) currentConfig.audio = {};
  if (!Array.isArray(currentConfig.audio.playlist)) currentConfig.audio.playlist = [];
  if (currentConfig.audio.playlist.length >= 50) return alert("⚠️ 播放列表已满！");
  currentConfig.audio.playlist.push({ id: "song_" + Date.now(), title: "新音乐", artist: "歌手", url: "", cover: "" });
  renderPlaylist();
}

function triggerDirectUploadLocalSong() {
  if (!currentConfig.audio) currentConfig.audio = {};
  if (!Array.isArray(currentConfig.audio.playlist)) currentConfig.audio.playlist = [];
  if (currentConfig.audio.playlist.length >= 50) return alert("⚠️ 播放列表最多容纳 50 首！");

  triggerDirectUpload(null, "audio/*", (url, file) => {
    const meta = parseSongFilename(file.name);
    currentConfig.audio.playlist.push({ id: "song_" + Date.now(), title: meta.title, artist: meta.artist, url: url, cover: "" });
    renderPlaylist();
    showToast(`✓ 已成功上传《${meta.title}》`);
  });
}

function triggerDirectUploadSongItem(idx) {
  const currentUrl = currentConfig.audio.playlist[idx]?.url || "";
  const isAlreadyLocal = currentUrl.startsWith("/raw/") || currentUrl.includes("/assets/");

  triggerDirectUpload(`pl_url_${idx}`, "audio/*", (url, file) => {
    currentConfig.audio.playlist[idx].url = url;
    const titleInput = document.getElementById(`pl_title_${idx}`);
    const artistInput = document.getElementById(`pl_artist_${idx}`);
    if (titleInput && (!titleInput.value || titleInput.value === "新音乐")) {
      const meta = parseSongFilename(file.name);
      titleInput.value = meta.title; currentConfig.audio.playlist[idx].title = meta.title;
      if (artistInput) { artistInput.value = meta.artist; currentConfig.audio.playlist[idx].artist = meta.artist; }
    }
    renderPlaylist();
  });
}

function triggerDirectUploadSingleBgm() {
  triggerDirectUpload("audio_bgmUrl", "audio/*", (url, file) => {
    const meta = parseSongFilename(file.name);
    if (document.getElementById("audio_bgmTitle")) document.getElementById("audio_bgmTitle").value = meta.title;
    if (document.getElementById("audio_bgmArtist")) document.getElementById("audio_bgmArtist").value = meta.artist;
    showToast(`✓ 主打歌音频已上传，解析为《${meta.title}》`);
  });
}

function clearCustomBg(gender) {
  if (!currentConfig) return;
  if (!currentConfig.theme) currentConfig.theme = {};
  if (gender === 'boy') {
    if (document.getElementById("theme_customBgUrlBoy")) document.getElementById("theme_customBgUrlBoy").value = "";
    currentConfig.theme.customBgUrlBoy = "";
    currentConfig.theme.customBgUrl = "";
    localStorage.setItem('love_perspective', 'boy');
    syncAdminBackgroundTheme();
    showToast("✓ 已清除男生视角壁纸！");
  } else if (gender === 'girl') {
    if (document.getElementById("theme_customBgUrlGirl")) document.getElementById("theme_customBgUrlGirl").value = "";
    currentConfig.theme.customBgUrlGirl = "";
    localStorage.setItem('love_perspective', 'girl');
    syncAdminBackgroundTheme();
    showToast("✓ 已清除女生视角壁纸！");
  }
}

function deletePlaylistSong(idx) {
  if (confirm("确定移除该歌曲吗？")) { currentConfig.audio.playlist.splice(idx, 1); renderPlaylist(); }
}

function movePlaylistSong(idx, direction) {
  const targetIdx = idx + direction;
  const list = currentConfig.audio.playlist;
  if (targetIdx < 0 || targetIdx >= list.length) return;
  const temp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = temp;
  renderPlaylist();
}

let previewAudioObj = null;
let currentPreviewBtnId = null;

function testPreviewAudio(url, btnId, songTitle) {
  const currentBtn = document.getElementById(btnId);
  if (previewAudioObj && currentPreviewBtnId === btnId && !previewAudioObj.paused) {
    previewAudioObj.pause();
    if (currentBtn) currentBtn.textContent = "🎧 试听";
    showToast("⏸️ 已暂停试听");
    return;
  }
  document.querySelectorAll(".preview-play-btn").forEach(b => b.textContent = "🎧 试听");
  if (previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; }
  currentPreviewBtnId = btnId;
  if (currentBtn) currentBtn.textContent = "⏳ 缓冲中";

  previewAudioObj = new Audio(url);
  previewAudioObj.play().then(() => {
    if (currentBtn) currentBtn.textContent = "⏸️ 暂停";
    showToast(`🎵 正在试听: ${songTitle || "选定曲目"}`);
  }).catch(() => {
    if (currentBtn) currentBtn.textContent = "🎧 试听";
    alert(`⚠️ 《${songTitle}》无法在线解析，建议上传本地MP3文件。`);
  });
  previewAudioObj.onended = () => { if (currentBtn) currentBtn.textContent = "🎧 试听"; };
}

function renderThemeShowroom() {
  const boyBox = document.getElementById("boyThemesContainer");
  const girlBox = document.getElementById("girlThemesContainer");
  const presets = window.THEME_PRESETS || { boy: [], girl: [] };

  const curBoy = currentConfig.theme?.currentThemeBoy || currentConfig.theme?.currentTheme || "sunset-twilight";
  const curGirl = currentConfig.theme?.currentThemeGirl || "french-cream";

  const isPro = !!(currentConfig._license && currentConfig._license.unlocked);

  if (boyBox) {
    boyBox.innerHTML = presets.boy.map(item => {
      const isSel = item.id === curBoy;
      const isDefault = item.id === "sunset-twilight";
      const isLocked = !isPro && !isDefault;

      return `
        <div class="theme-card ${isSel ? 'theme-card--selected' : ''}" style="position:relative;" onclick="${isLocked ? `showToast('🔒 此为 PRO 版专属高定主题，请先在底侧输入专属激活码解锁')` : `selectBoyTheme('${item.id}')`}">
          <div class="theme-card-body">
            <div class="theme-card-top">
              <span class="theme-name">${escapeHtml(item.name)}</span>
              <span class="theme-tag">${escapeHtml(item.tag)}</span>
            </div>
            <p class="theme-desc">${escapeHtml(item.desc)}</p>
          </div>
          <div class="theme-card-footer">
            ${isSel ? '✨ 当前选定' : (isLocked ? '🔒 PRO 专属' : '点击选定')}
          </div>
          ${isLocked ? `
            <div style="position:absolute; inset:0; background: rgba(15,23,42,0.6); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display:flex; justify-content:center; align-items:center; z-index:10; border-radius:inherit;">
              <span style="background: linear-gradient(135deg, #0f172a 0%, #020617 100%); color: #fde68a; border: 1px solid #f59e0b; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 900; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); letter-spacing: 1px;">PRO 专属</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join("");
  }

  if (girlBox) {
    girlBox.innerHTML = presets.girl.map(item => {
      const isSel = item.id === curGirl;
      const isDefault = item.id === "french-cream";
      const isLocked = !isPro && !isDefault;

      return `
        <div class="theme-card ${isSel ? 'theme-card--selected' : ''}" style="position:relative;" onclick="${isLocked ? `showToast('🔒 此为 PRO 版专属高定主题，请先在底侧输入专属激活码解锁')` : `selectGirlTheme('${item.id}')`}">
          <div class="theme-card-body">
            <div class="theme-card-top">
              <span class="theme-name">${escapeHtml(item.name)}</span>
              <span class="theme-tag">${escapeHtml(item.tag)}</span>
            </div>
            <p class="theme-desc">${escapeHtml(item.desc)}</p>
          </div>
          <div class="theme-card-footer">
            ${isSel ? '✨ 当前选定' : (isLocked ? '🔒 PRO 专属' : '点击选定')}
          </div>
          ${isLocked ? `
            <div style="position:absolute; inset:0; background: rgba(255,255,255,0.4); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display:flex; justify-content:center; align-items:center; z-index:10; border-radius:inherit;">
              <span style="background: linear-gradient(135deg, #0f172a 0%, #020617 100%); color: #fde68a; border: 1px solid #f59e0b; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 900; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); letter-spacing: 1px;">PRO 专属</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join("");
  }

  if (document.getElementById("theme_customBgUrlBoy")) document.getElementById("theme_customBgUrlBoy").value = currentConfig.theme?.customBgUrlBoy || currentConfig.theme?.customBgUrl || "";
  if (document.getElementById("theme_customBgUrlGirl")) document.getElementById("theme_customBgUrlGirl").value = currentConfig.theme?.customBgUrlGirl || "";
}

function selectBoyTheme(themeId) { 
  if (!currentConfig.theme) currentConfig.theme = {}; 
  currentConfig.theme.currentThemeBoy = themeId; 
  currentConfig.theme.currentTheme = themeId; 
  localStorage.setItem('love_perspective', 'boy');
  renderThemeShowroom(); 
  syncAdminBackgroundTheme();
  showToast(`✓ 已选定男生主题【${themeId}】`); 
}
function selectGirlTheme(themeId) { 
  if (!currentConfig.theme) currentConfig.theme = {}; 
  currentConfig.theme.currentThemeGirl = themeId; 
  localStorage.setItem('love_perspective', 'girl');
  renderThemeShowroom(); 
  syncAdminBackgroundTheme();
  showToast(`✓ 已选定女生主题【${themeId}】`); 
}

function renderTimelineList() {
  const container = document.getElementById("timelineListContainer");
  if (!container) return;
  container.innerHTML = "";
  (currentConfig.timeline || []).forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">节点 #${idx + 1} - ${escapeHtml(item.title || "未命名")}</span>
        <div><button class="btn-del" onclick="deleteTimelineNode(${idx})">🗑️ 删除</button></div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>日期</label>
          <input type="text" class="admin-input" id="tl_date_${idx}" value="${escapeHtml(item.date || "")}" oninput="currentConfig.timeline[${idx}].date=this.value">
        </div>
        <div class="form-group">
          <label>标签</label>
          <input type="text" class="admin-input" id="tl_tag_${idx}" value="${escapeHtml(item.tag || "")}" oninput="currentConfig.timeline[${idx}].tag=this.value">
        </div>
        <div class="form-group">
          <label>故事标题</label>
          <input type="text" class="admin-input" id="tl_title_${idx}" value="${escapeHtml(item.title || "")}" oninput="currentConfig.timeline[${idx}].title=this.value">
        </div>
        <div class="form-group">
          <label>地点</label>
          <input type="text" class="admin-input" id="tl_loc_${idx}" value="${escapeHtml(item.location || "")}" oninput="currentConfig.timeline[${idx}].location=this.value">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>正面描述</label>
          <textarea class="admin-textarea" id="tl_desc_${idx}" rows="2" oninput="currentConfig.timeline[${idx}].desc=this.value">${escapeHtml(item.desc || "")}</textarea>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>背面留言</label>
          <textarea class="admin-textarea" id="tl_back_${idx}" rows="2" oninput="currentConfig.timeline[${idx}].backText=this.value">${escapeHtml(item.backText || "")}</textarea>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>🎙️ 背面专属录音直链（时长不限，仍受套餐存储上限约束）</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="tl_voice_${idx}" value="${escapeHtml(item.voiceAudio || "")}" oninput="currentConfig.timeline[${idx}].voiceAudio=this.value">
            <button class="btn-upload" onclick="triggerDirectUpload('tl_voice_${idx}', 'audio/*', (url)=>{ currentConfig.timeline[${idx}].voiceAudio=url; })">🎙️ 上传录音</button>
            <button class="btn-upload" onclick="toggleDirectRecord(this, 'tl_voice_${idx}', (url)=>{ currentConfig.timeline[${idx}].voiceAudio=url; })">🎙️ 点按直接录音</button>
          </div>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>正面照片直链</label>
          <div class="upload-input-group">
            <input type="text" class="admin-input" id="tl_img_${idx}" value="${escapeHtml(item.frontImg || "")}" oninput="currentConfig.timeline[${idx}].frontImg=this.value">
            <button class="btn-upload" onclick="triggerDirectUpload('tl_img_${idx}', 'image/*', (url)=>{ currentConfig.timeline[${idx}].frontImg=url; })">🖼️ 上传照片</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
function addTimelineNode() { if (!currentConfig.timeline) currentConfig.timeline = []; currentConfig.timeline.push({ id: "node_" + Date.now(), date: "2026.05.20", tag: "甜蜜日常", title: "新瞬间", desc: "记录下这一天...", location: "📍 幸福角落", frontImg: "assets/images/photo_01.jpg", backText: "独家留言...", voiceAudio: "" }); renderTimelineList(); }
function deleteTimelineNode(idx) { if (confirm("确定删除该节点吗？")) { currentConfig.timeline.splice(idx, 1); renderTimelineList(); } }

function renderChecklist() {
  const container = document.getElementById("checklistItemsContainer");
  if (!container) return;
  container.innerHTML = "";
  (currentConfig.checklist100 || []).forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">小事 #${item.id || (idx + 1)}</span>
        <div><button class="btn-del" onclick="deleteChecklistItem(${idx})">🗑️ 删除</button></div>
      </div>
      <div class="form-grid">
        <div class="form-group" style="grid-column: 1 / 3;"><label>名称</label><input type="text" class="admin-input" value="${escapeHtml(item.title || "")}" oninput="currentConfig.checklist100[${idx}].title=this.value"></div>
        <div class="form-group">
          <label>阶段</label>
          <select class="admin-select" onchange="currentConfig.checklist100[${idx}].phase=parseInt(this.value,10)">
            <option value="1" ${item.phase===1?'selected':''}>❤️ 恋爱期</option>
            <option value="2" ${item.phase===2?'selected':''}>💍 订婚期</option>
            <option value="3" ${item.phase===3?'selected':''}>🏠 结婚期</option>
            <option value="4" ${item.phase===4?'selected':''}>🍼 孕期前后</option>
            <option value="5" ${item.phase===5?'selected':''}>🚀 婚后进阶</option>
          </select>
        </div>
        <div class="form-group"><label>状态</label><select class="admin-select" onchange="currentConfig.checklist100[${idx}].completed=(this.value==='true')"><option value="false" ${!item.completed?'selected':''}>未完成</option><option value="true" ${item.completed?'selected':''}>已完成</option></select></div>
      </div>
    `;
    container.appendChild(card);
  });
}
function addChecklistItem() { if (!currentConfig.checklist100) currentConfig.checklist100 = []; currentConfig.checklist100.push({ id: currentConfig.checklist100.length + 1, phase: 1, title: "一起去做一件浪漫的事", completed: false }); renderChecklist(); }
function deleteChecklistItem(idx) { currentConfig.checklist100.splice(idx, 1); renderChecklist(); }

function renderScratchCards() {
  const container = document.getElementById("scratchCardsContainer");
  if (!container) return;
  container.innerHTML = "";
  (currentConfig.scratchCards || []).forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">${escapeHtml(item.icon||"🎁")} ${escapeHtml(item.title||"特权券")}</span>
        <div><button class="btn-del" onclick="deleteScratchCard(${idx})">🗑️</button></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>图标</label><input type="text" class="admin-input" value="${escapeHtml(item.icon||"🎁")}" oninput="currentConfig.scratchCards[${idx}].icon=this.value"></div>
        <div class="form-group"><label>名称</label><input type="text" class="admin-input" value="${escapeHtml(item.title||"")}" oninput="currentConfig.scratchCards[${idx}].title=this.value"></div>
        <div class="form-group">
          <label>阶段</label>
          <select class="admin-select" onchange="currentConfig.scratchCards[${idx}].phase=parseInt(this.value,10)">
            <option value="1" ${item.phase===1?'selected':''}>❤️ 恋爱期</option>
            <option value="2" ${item.phase===2?'selected':''}>💍 订婚期</option>
            <option value="3" ${item.phase===3?'selected':''}>🏠 结婚期</option>
            <option value="4" ${item.phase===4?'selected':''}>🍼 孕期前后</option>
            <option value="5" ${item.phase===5?'selected':''}>🚀 婚后进阶</option>
          </select>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;"><label>说明</label><textarea class="admin-textarea" rows="2" oninput="currentConfig.scratchCards[${idx}].content=this.value">${escapeHtml(item.content||"")}</textarea></div>
      </div>
    `;
    container.appendChild(card);
  });
}
function addScratchCard() { if (!currentConfig.scratchCards) currentConfig.scratchCards = []; currentConfig.scratchCards.push({ id: "card_" + Date.now(), phase: 1, title: "专属心愿卡", content: "无条件兑现一次！", icon: "✨", scratched: false, used: false, usedTime: "" }); renderScratchCards(); }
function deleteScratchCard(idx) { currentConfig.scratchCards.splice(idx, 1); renderScratchCards(); }

let activeUploadCallback = null;
let activeUploadInputId = null;

function triggerDirectUpload(targetInputId, acceptType, callback) {
  activeUploadInputId = targetInputId;
  activeUploadCallback = callback;
  const uploader = document.getElementById("globalUploader");
  uploader.accept = acceptType || "*/*";
  uploader.click();
}

document.getElementById("globalUploader").addEventListener("change", async (e) => {
  let file = e.target.files[0];
  if (!file) return;
  const hardLimitBytes = 50 * 1024 * 1024;
  if (file.size > hardLimitBytes) {
    e.target.value = "";
    return alert(`⚠️ 文件过大！请控制在 50 MB 以内。`);
  }
  if (window.LoveUploadCompress && file.type && file.type.indexOf("image/") === 0) {
    const tier = (currentConfig && currentConfig._license && currentConfig._license.unlocked) ? "standard" : "basic";
    try {
      showToast("🖼️ 正在压缩图片...");
      const compressed = await LoveUploadCompress.compressImage(file, { tier });
      if (compressed && (compressed.size || 0) > 0 && (compressed.size || 0) < file.size) file = compressed;
    } catch (_) {}
  }
  showToast("⏳ 极速上传中...");
  const formData = new FormData(); formData.append("file", file);

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/love/upload?auth=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "x-admin-auth": token, "Authorization": `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success && data.url) {
      if (activeUploadInputId) {
        const targetInput = document.getElementById(activeUploadInputId);
        if (targetInput) { targetInput.value = data.url; targetInput.dispatchEvent(new Event("input")); }
      }
      if (activeUploadCallback) activeUploadCallback(data.url, file);
      if (activeUploadInputId === "theme_customBgUrlBoy" && currentConfig) {
        if (!currentConfig.theme) currentConfig.theme = {};
        currentConfig.theme.customBgUrlBoy = data.url;
        localStorage.setItem('love_perspective', 'boy');
        syncAdminBackgroundTheme();
      }
      if (activeUploadInputId === "theme_customBgUrlGirl" && currentConfig) {
        if (!currentConfig.theme) currentConfig.theme = {};
        currentConfig.theme.customBgUrlGirl = data.url;
        localStorage.setItem('love_perspective', 'girl');
        syncAdminBackgroundTheme();
      }
      showToast("✓ 上传成功！直链已同步");
    } else {
      alert("❌ 上传失败: " + (data.error || "服务端拒绝"));
    }
  } catch (err) { alert("❌ 上传异常: " + err.message); } finally { e.target.value = ""; }
});

let _recMediaRecorder = null, _recChunks = [], _recStream = null;
let _recTargetInputId = null, _recCallback = null, _recEl = null, _recTimer = null, _recSecs = 0;

async function startDirectRecord(btnEl, targetInputId, callback) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _recStream = stream;
    _recChunks = [];
    _recTargetInputId = targetInputId || null;
    _recCallback = callback || null;
    _recEl = btnEl || null;
    _recSecs = 0;
    const mime = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(t => (window.MediaRecorder && MediaRecorder.isTypeSupported(t))) || '';
    _recMediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    _recMediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) _recChunks.push(e.data); };
    _recMediaRecorder.onstop = async () => {
      try {
        const type = (_recMediaRecorder.mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(_recChunks, { type });
        const ext = type.includes('mp4') ? 'm4a' : (type.includes('ogg') ? 'ogg' : 'webm');
        const file = new File([blob], `rec_${Date.now()}.${ext}`, { type });
        if (_recEl) { _recEl.textContent = '🎙️ 上传中…'; _recEl.classList.remove('recording'); }
        const formData = new FormData(); formData.append('file', file);
        const token = getAuthToken();
        const res = await fetch(`/api/love/upload?auth=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'x-admin-auth': token, 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (data.success && data.url) {
          if (_recTargetInputId) { const t = document.getElementById(_recTargetInputId); if (t) { t.value = data.url; t.dispatchEvent(new Event('input')); } }
          if (_recCallback) _recCallback(data.url, file);
          showToast('✓ 录音已直传！');
        } else { alert('❌ 录音上传失败: ' + (data.error || '服务端拒绝')); }
      } catch (err) { alert('❌ 录音上传异常: ' + err.message); }
      finally {
        if (_recEl) _recEl.textContent = '🎙️ 点按直接录音';
        _recEl = null; _recTargetInputId = null; _recCallback = null; _recMediaRecorder = null;
        if (_recStream) { _recStream.getTracks().forEach(t => t.stop()); _recStream = null; }
        clearInterval(_recTimer);
      }
    };
    _recMediaRecorder.start();
    if (_recEl) { _recEl.textContent = '⏹ 停止录音 (0s)'; _recEl.classList.add('recording'); }
    _recTimer = setInterval(() => { _recSecs++; if (_recEl) _recEl.textContent = `⏹ 停止录音 (${_recSecs}s)`; }, 1000);
  } catch (err) {
    alert('❌ 无法访问麦克风: ' + err.message + '。请检查浏览器麦克风权限后重试。');
    if (_recEl) { _recEl.textContent = '🎙️ 点按直接录音'; _recEl.classList.remove('recording'); }
    _recEl = null; _recStream = null; _recMediaRecorder = null;
  }
}
function stopDirectRecord() {
  if (_recMediaRecorder && _recMediaRecorder.state === 'recording') _recMediaRecorder.stop();
}
function toggleDirectRecord(btnEl, targetInputId, callback) {
  if (_recMediaRecorder && _recMediaRecorder.state === 'recording') { stopDirectRecord(); }
  else { startDirectRecord(btnEl, targetInputId, callback); }
}

// 🌟 核心修复区：彻底分离鉴权凭证与新密码，确保数据精准同步
async function saveAllConfigToCloud(overrideToken) {
  if (!currentConfig) return false;
  const activePassword = overrideToken || (currentConfig.adminSecurity?.password || "").trim();
  
  currentConfig.adminSecurity = { password: activePassword, updatedAt: new Date().toISOString() };
  currentConfig.lifecycle = { currentPhase: document.getElementById("lifecycle_phase").value };
  currentConfig.meta = {
    boyName: document.getElementById("meta_boyName").value.trim(),
    girlName: document.getElementById("meta_girlName").value.trim(),
    startDate: document.getElementById("meta_startDate").value.trim(),
    nextMilestoneTitle: document.getElementById("meta_nextMilestoneTitle").value.trim(),
    nextMilestoneDate: document.getElementById("meta_nextMilestoneDate").value.trim(),
    siteTitle: document.getElementById("meta_siteTitle").value.trim(),
    siteSubtitle: document.getElementById("meta_siteSubtitle").value.trim()
  };
  const errorTipsRaw = document.getElementById("gatekeeper_errorTips").value.split("\n").map(s => s.trim()).filter(Boolean);
  currentConfig.gatekeeper = {
    enabled: document.getElementById("gatekeeper_enabled").value === "true",
    title: document.getElementById("gatekeeper_title").value.trim(),
    question: document.getElementById("gatekeeper_question").value.trim(),
    hint: document.getElementById("gatekeeper_hint").value.trim(),
    correctAnswer: document.getElementById("gatekeeper_correctAnswer").value.trim(),
    voiceVows: document.getElementById("gatekeeper_voiceVows").value.trim(),
    errorTips: errorTipsRaw.length > 0 ? errorTipsRaw : ["没关系，慢慢想。"]
  };
  currentConfig.letter = {
    title: document.getElementById("letter_title").value.trim(),
    signDate: document.getElementById("letter_signDate").value.trim(),
    signature: document.getElementById("letter_signature").value.trim(),
    content: document.getElementById("letter_content").value.trim()
  };
  currentConfig.easterEggs = [
    { id: "egg_1", selector: "#egg-star", message: document.getElementById("egg_1_message").value.trim() },
    { id: "egg_2", selector: "#egg-paw", message: document.getElementById("egg_2_message").value.trim() }
  ];
  currentConfig.theme = {
    ...(currentConfig.theme || {}),
    currentThemeBoy: currentConfig.theme?.currentThemeBoy || "sunset-twilight",
    currentThemeGirl: currentConfig.theme?.currentThemeGirl || "french-cream",
    customBgUrlBoy: document.getElementById("theme_customBgUrlBoy")?.value.trim() || "",
    customBgUrlGirl: document.getElementById("theme_customBgUrlGirl")?.value.trim() || ""
  };

  (currentConfig.timeline || []).forEach((node, idx) => {
    node.date = document.getElementById(`tl_date_${idx}`)?.value || ""; node.tag = document.getElementById(`tl_tag_${idx}`)?.value || "";
    node.title = document.getElementById(`tl_title_${idx}`)?.value || ""; node.location = document.getElementById(`tl_loc_${idx}`)?.value || "";
    node.desc = document.getElementById(`tl_desc_${idx}`)?.value || ""; node.backText = document.getElementById(`tl_back_${idx}`)?.value || "";
    node.voiceAudio = document.getElementById(`tl_voice_${idx}`)?.value?.trim() || ""; node.frontImg = document.getElementById(`tl_img_${idx}`)?.value || "";
  });

  (currentConfig.anniversaries || []).forEach((item, idx) => {
    item.title = document.getElementById(`anni_title_${idx}`)?.value.trim() || item.title || "纪念日";
    item.icon = document.getElementById(`anni_icon_${idx}`)?.value.trim() || item.icon || "💖";
    item.tag = document.getElementById(`anni_tag_${idx}`)?.value.trim() || item.tag || "";
    item.type = document.getElementById(`anni_type_${idx}`)?.value || item.type || "countdown";
    item.isLunar = document.getElementById(`anni_islunar_${idx}`)?.value === "true";
    item.isLeapMonth = document.getElementById(`anni_isleap_${idx}`)?.value === "true";
    item.date = document.getElementById(`anni_date_${idx}`)?.value.trim() || item.date || "2026-05-20";
    item.memo = document.getElementById(`anni_memo_${idx}`)?.value.trim() || item.memo || "";
    item.bgImg = document.getElementById(`anni_bg_${idx}`)?.value.trim() || item.bgImg || "";
    item.voiceAudio = document.getElementById(`anni_voice_${idx}`)?.value.trim() || item.voiceAudio || "";
  });

  const ibCooldownVal = parseInt(document.getElementById("icebreaker_cooldownMinutes")?.value, 10) || 15;
  currentConfig.icebreaker = {
    enabled: document.getElementById("icebreaker_enabled")?.value === "true",
    cooldownMinutes: ibCooldownVal,
    soundEnabled: document.getElementById("icebreaker_soundEnabled")?.value === "true",
    actions: currentConfig.icebreaker?.actions || window.LOVE_CONFIG?.icebreaker?.actions || {}
  };

  const playlistToSave = (currentConfig.audio?.playlist || []).map((song, idx) => ({
    id: song.id || ("song_" + idx),
    title: document.getElementById(`pl_title_${idx}`)?.value.trim() || song.title || "音乐",
    artist: document.getElementById(`pl_artist_${idx}`)?.value.trim() || song.artist || "歌手",
    url: document.getElementById(`pl_url_${idx}`)?.value.trim() || song.url || "",
    cover: document.getElementById(`pl_cover_${idx}`)?.value.trim() || song.cover || ""
  }));

  currentConfig.audio = {
    ...(currentConfig.audio || {}),
    bgmAutoPlay: document.getElementById("audio_bgmAutoPlay").value === "true",
    playMode: document.getElementById("audio_playMode").value || "list-loop",
    bgmTitle: document.getElementById("audio_bgmTitle").value.trim(),
    bgmArtist: document.getElementById("audio_bgmArtist").value.trim(),
    bgmUrl: document.getElementById("audio_bgmUrl").value.trim(),
    vinylCover: document.getElementById("audio_vinylCover").value.trim(),
    playlist: playlistToSave
  };

  (currentConfig.birthdayCapsules || []).forEach((item, idx) => {
    item.target = document.getElementById(`bd_target_${idx}`)?.value || "girl";
    item.date = document.getElementById(`bd_date_${idx}`)?.value.trim() || "";
    item.template = document.getElementById(`bd_tpl_${idx}`)?.value || "A";
    item.photo = document.getElementById(`bd_photo_${idx}`)?.value.trim() || "";
    item.message = document.getElementById(`bd_msg_${idx}`)?.value.trim() || "";
    item.voiceAudio = document.getElementById(`bd_voice_${idx}`)?.value.trim() || "";
  });

  showToast("⏳ 正在发布到独立存储空间...");
  
  // 🔥 核心：发送网络请求时，必须使用当前仍然有效的凭证（不能用未生效的新密码）
  const authHeaderToken = getAuthToken(); 
  
  try {
    const res = await fetch(`/api/love/config?auth=${encodeURIComponent(authHeaderToken)}`, {
      method: "POST", 
      headers: { "Content-Type": "application/json", "x-admin-auth": authHeaderToken, "Authorization": `Bearer ${authHeaderToken}` }, 
      body: JSON.stringify({ config: currentConfig })
    });
    const data = await res.json();
    if (data.success) {
      // 只有在云端返回 200 成功响应后，才把本地缓存刷新为新密码
      currentAdminToken = activePassword;
      localStorage.setItem("love_admin_token", activePassword);
      sessionStorage.setItem("universe_admin_auth", "true");
      showToast("✨ 全部配置发布并生效！");
      return true;
    } else { 
      alert("❌ 保存失败: " + (data.error || "未授权")); 
      return false; 
    }
  } catch (err) { 
    alert("❌ 保存失败: " + err.message); 
    return false; 
  }
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab)?.classList.add("active");
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const token = getAuthToken();
  const layout = document.getElementById("adminLayout");

  if (!token) { alert("⚠️ 未授权访问"); location.href = "index.html"; return; }

  const success = await fetchConfigFromCloud(token);
  if (success) {
    if (layout) layout.style.display = "block";
    showToast("✓ 验证成功，已连接控制中心");
  } else {
    localStorage.removeItem("love_admin_token");
    sessionStorage.removeItem("universe_admin_auth");
    alert("❌ 口令失效或未授权！"); location.href = "index.html";
  }
});
