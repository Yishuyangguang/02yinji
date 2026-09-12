/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/birthday.js
 * 作用: 星轨生辰 3D 盲盒、时间锁测试穿透、陀螺仪视差与 300DPI 极清高定海报渲染
 */

class BirthdayManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.capsules = this.config.birthdayCapsules || [];
    this.timerId = null;
    this.currentPerspective = localStorage.getItem("love_user_perspective") || "boy";
    this.tiltHandler = this.handleDeviceTilt.bind(this);
    this.audioObj = null;
    this.isPlaying = false;
  }

  init() {
    this.renderCapsuleList();
    window.addEventListener("stage:opened", (e) => {
      if (e.detail && e.detail.stageId === "birthday") {
        this.renderCapsuleList();
        this.startCountdownLoop();
      }
    });
    window.addEventListener("stage:closed", () => {
      this.stopCountdownLoop();
      this.closeCardModal();
    });
  }

  startCountdownLoop() {
    this.stopCountdownLoop();
    this.timerId = setInterval(() => {
      this.renderCapsuleList();
    }, 1000);
  }

  stopCountdownLoop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  renderCapsuleList() {
    const container = document.getElementById("birthday-capsule-container");
    if (!container) return;

    this.capsules = (window.LOVE_CONFIG && window.LOVE_CONFIG.birthdayCapsules) || [];
    const myCapsules = this.capsules.filter(c => c.target === this.currentPerspective);

    if (myCapsules.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <div style="font-size:40px; margin-bottom:12px; opacity:0.8;">🌌</div>
          <div style="color:#fde68a; font-size:15px; font-weight:800; margin-bottom:8px;">当前时空暂无生辰胶囊</div>
          <div style="color:#94a3b8; font-size:12.5px; line-height:1.6;">
            等待对方在控制台为你封装专属惊喜吧...
          </div>
        </div>`;
      return;
    }

    const now = Date.now();
    
    container.innerHTML = `<div class="bd-capsule-grid">` + myCapsules.map((cap, idx) => {
      const targetTime = new Date(cap.date).getTime();
      const isUnlocked = now >= targetTime;
      const isToday = isUnlocked && (now - targetTime < 24 * 60 * 60 * 1000);

      if (isUnlocked) {
        return `
          <div class="bd-capsule-card unlocked" onclick="window.BirthdayInstance.openCardModal('${cap.id}')">
            <div class="bd-capsule-icon">✨</div>
            <div class="bd-capsule-title">专属时空贺卡已解锁</div>
            <div class="bd-capsule-subtitle">${isToday ? '🎉 祝你生日快乐！点击拆开惊喜' : '💌 包含着满满的爱意与祝福'}</div>
            <div class="bd-capsule-btn">立即开启 ➔</div>
          </div>
        `;
      } else {
        const diff = targetTime - now;
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        return `
          <div class="bd-capsule-card locked">
            <div class="bd-capsule-icon">🔒</div>
            <div class="bd-capsule-title" style="color:#94a3b8;">时空胶囊尚未解锁</div>
            <div class="bd-capsule-subtitle">神秘的生日礼物正在路上...</div>
            <div class="bd-countdown-box" style="margin-bottom:14px;">
              <div class="bd-cd-item"><span>${d}</span><small>天</small></div>:
              <div class="bd-cd-item"><span>${String(h).padStart(2, '0')}</span><small>时</small></div>:
              <div class="bd-cd-item"><span>${String(m).padStart(2, '0')}</span><small>分</small></div>:
              <div class="bd-cd-item"><span>${String(s).padStart(2, '0')}</span><small>秒</small></div>
            </div>
            <button class="btn-universe btn-universe--secondary" style="font-size:11.5px; padding:6px 14px; border-radius:12px;" onclick="window.BirthdayInstance.openCardModal('${cap.id}')">
              🔍 提前预览 (测试)
            </button>
          </div>
        `;
      }
    }).join("") + `</div>`;
  }

  openCardModal(id) {
    const cap = this.capsules.find(c => c.id === id);
    if (!cap) return;

    let modal = document.getElementById("bd-3d-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bd-3d-modal";
      modal.className = "bd-3d-modal";
      document.body.appendChild(modal);
    }

    if (window.Effects) {
      window.Effects.playAudio("gatekeeperPass");
      window.Effects.fireConfetti();
    }

    const tplClass = `bd-tpl-${cap.template || 'A'}`;
    const escapedMsg = this.escapeHtml(cap.message || "").replace(/\n/g, "<br>");
    
    // 🌟 全息卡片 DOM 重塑：照片与文字区完全解耦，引入内部粒子容器
    modal.innerHTML = `
      <div class="bd-3d-overlay" onclick="window.BirthdayInstance.closeCardModal()"></div>
      <div class="bd-3d-scene">
        <button class="bd-close-btn" onclick="window.BirthdayInstance.closeCardModal()">✕</button>
        <div class="bd-card-wrapper" id="bd-card-wrapper">
          <div class="bd-card ${tplClass}">
            <div class="bd-card-glare"></div>
            <!-- 照片与特效层 -->
            <div class="bd-card-photo-box">
              ${cap.photo ? `<img src="${cap.photo}" class="bd-card-img" alt="回忆" crossorigin="anonymous">` : `<div class="bd-card-img-placeholder">🌌</div>`}
              <div class="bd-card-particles"></div>
            </div>
            <!-- 文字与语音舱 -->
            <div class="bd-card-content">
              <div class="bd-card-title">Happy Birthday</div>
              <div class="bd-card-msg">${escapedMsg}</div>
              
              ${cap.voiceAudio ? `
                <div class="bd-audio-capsule">
                  <button class="bd-play-btn" id="bd-play-voice-btn" onclick="window.BirthdayInstance.toggleAudio('${cap.voiceAudio}')">
                    <span class="icon">▶</span> 收听时空密语
                  </button>
                </div>
              ` : ''}
              
            </div>
            ${cap.template === 'D' ? `<div class="bd-card-stamp">LOVE</div>` : ''}
          </div>
        </div>
        <button class="bd-export-btn" id="bd-export-btn" onclick="window.BirthdayInstance.exportPoster('${cap.id}')">✨ 生成极清画廊海报并分享</button>
      </div>
    `;

    setTimeout(() => modal.classList.add("active"), 50);

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", this.tiltHandler, true);
    }
    const scene = modal.querySelector(".bd-3d-scene");
    if (scene) {
      scene.addEventListener("mousemove", (e) => {
        const wrapper = document.getElementById("bd-card-wrapper");
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotateX = -(y / rect.height) * 20;
        const rotateY = (x / rect.width) * 20;
        wrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        
        const glare = wrapper.querySelector(".bd-card-glare");
        if (glare) {
          glare.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
          glare.style.opacity = "0.6";
        }
      });
      scene.addEventListener("mouseleave", () => {
        const wrapper = document.getElementById("bd-card-wrapper");
        if (wrapper) wrapper.style.transform = `rotateX(0deg) rotateY(0deg)`;
      });
    }
  }

  toggleAudio(url) {
    const btn = document.getElementById("bd-play-voice-btn");
    
    if (this.isPlaying && this.audioObj) {
      this.audioObj.pause();
      this.isPlaying = false;
      if (btn) {
        btn.classList.remove("playing");
        btn.innerHTML = `<span class="icon">▶</span> 收听时空密语`;
      }
      return;
    }

    if (!this.audioObj) {
      this.audioObj = new Audio(url);
      this.audioObj.onended = () => {
        this.isPlaying = false;
        if (btn) {
          btn.classList.remove("playing");
          btn.innerHTML = `<span class="icon">▶</span> 收听时空密语`;
        }
      };
    }

    if (btn) {
      btn.classList.add("playing");
      btn.innerHTML = `<span class="icon">🎶</span> 密语解读中...`;
    }

    this.audioObj.play().then(() => {
      this.isPlaying = true;
    }).catch(err => {
      alert("⚠️ 无法播放语音：" + err.message);
      if (btn) {
        btn.classList.remove("playing");
        btn.innerHTML = `<span class="icon">▶</span> 收听时空密语`;
      }
    });
  }

  handleDeviceTilt(e) {
    const wrapper = document.getElementById("bd-card-wrapper");
    if (!wrapper || !e.gamma || !e.beta) return;
    let x = e.gamma; 
    let y = e.beta;
    if (x > 30) x = 30; if (x < -30) x = -30;
    if (y > 60) y = 60; if (y < 0) y = 0; 
    
    const rotateY = x * 0.6;
    const rotateX = (y - 30) * -0.6;
    
    wrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  closeCardModal() {
    if (this.audioObj) {
      this.audioObj.pause();
      this.audioObj = null;
      this.isPlaying = false;
    }

    const modal = document.getElementById("bd-3d-modal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => { if(modal.parentNode) modal.remove(); }, 400);
    }
    window.removeEventListener("deviceorientation", this.tiltHandler, true);
  }

  // 🌟 导出极清海报：画廊级排版与胶片噪点渲染
  async exportPoster(id) {
    const cap = this.capsules.find(c => c.id === id);
    if (!cap) return;

    const btn = document.getElementById("bd-export-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⚙️ 正在渲染极清数字艺术品...";
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      // 提升至 1200x1800 呈现更修长的高级画廊比例
      canvas.width = 1200;
      canvas.height = 1800;

      // 1. 画廊级背景框
      this.drawPosterBackground(ctx, cap.template || 'A');

      // 2. 嵌入带相框质感的照片
      if (cap.photo) {
        const img = await this.loadImage(cap.photo);
        this.drawPosterPhoto(ctx, img, cap.template || 'A');
      }

      // 3. 高级层次文字渲染
      this.drawPosterText(ctx, cap, cap.template || 'A');

      // 4. ✨ 注入灵魂：全屏胶片噪点纹理 (Film Grain)
      this.addFilmGrain(ctx, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.98); // 最高画质
      
      const link = document.createElement("a");
      link.download = `雅歌生辰_数字艺术品_${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      alert("⚠️ 生成海报失败: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "✨ 生成极清画廊海报并分享";
      }
    }
  }

  drawPosterBackground(ctx, tpl) {
    const w = 1200, h = 1800;
    
    // 统一底层纸张颜色，打造实体贺卡感
    if (tpl === 'A' || tpl === 'B') {
      ctx.fillStyle = "#0a0a0a";
    } else {
      ctx.fillStyle = "#faf9f6"; // 博物馆复古白纸
    }
    ctx.fillRect(0, 0, w, h);

    // 内部边框 (Mat Board Passepartout)
    ctx.save();
    if (tpl === 'A') {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.5)"; ctx.lineWidth = 4;
      ctx.strokeRect(60, 60, w - 120, h - 120);
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)"; ctx.fillRect(80, 80, w - 160, h - 160);
    } 
    else if (tpl === 'B') {
      ctx.strokeStyle = "#b45309"; ctx.lineWidth = 6;
      ctx.strokeRect(70, 70, w - 140, h - 140);
      ctx.fillStyle = "#171717"; ctx.fillRect(80, 80, w - 160, h - 160);
    }
    else if (tpl === 'C') {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.06)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
      ctx.fillRect(80, 80, w - 160, h - 160);
    }
    else if (tpl === 'D') {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 15;
      ctx.fillRect(100, 100, w - 200, h - 200);
    }
    ctx.restore();
  }

  drawPosterPhoto(ctx, img, tpl) {
    if (!img) return;
    // 精调画廊级留白比例 (照片不贴边)
    let px, py, pw, ph;

    if (tpl === 'D') {
      // 拍立得比例：顶部留白少，底部留白多
      px = 140; py = 140; pw = 920; ph = 920;
    } else {
      // 经典画册比例
      px = 140; py = 140; pw = 920; ph = 1000;
    }
    
    ctx.save();
    // 圆角裁剪
    if (tpl === 'C') {
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 30) : ctx.rect(px, py, pw, ph); ctx.clip();
    } else if (tpl === 'A' || tpl === 'B') {
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 12) : ctx.rect(px, py, pw, ph); ctx.clip();
    } else {
      ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    }
    
    // Object-fit: cover 算法
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = pw / ph;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
      sh = img.naturalHeight; sw = sh * boxRatio; sx = (img.naturalWidth - sw) / 2; sy = 0;
    } else {
      sw = img.naturalWidth; sh = sw / boxRatio; sx = 0; sy = (img.naturalHeight - sh) / 2;
    }
    
    // 渲染图片
    if (tpl === 'D') {
      ctx.filter = "sepia(0.3) contrast(1.1) saturate(1.1)";
    }
    ctx.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);
    ctx.restore();

    // 加内边框增强实体感
    ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
  }

  drawPosterText(ctx, cap, tpl) {
    const textX = 140;
    // 根据照片高度动态计算文字起始Y轴
    let startY = tpl === 'D' ? 1200 : 1280; 
    
    ctx.textAlign = "left";
    
    // 顶部专属印记
    ctx.fillStyle = (tpl === 'A' || tpl === 'B') ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
    ctx.font = "bold 16px sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("ETERNAL COVENANT · LOVE UNIVERSE", textX, 100);
    ctx.letterSpacing = "0px"; // 重置
    
    // 标题层
    if (tpl === 'A') {
      ctx.fillStyle = "#38bdf8"; ctx.font = "bold 60px monospace"; ctx.fillText("SYSTEM.BIRTHDAY_UNLOCKED", textX, startY);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "36px sans-serif";
    } else if (tpl === 'B') {
      ctx.fillStyle = "#fcd34d"; ctx.font = "bold 65px serif"; ctx.fillText("Happy Birthday", textX, startY);
      ctx.fillStyle = "#d1d5db"; ctx.font = "36px serif";
    } else if (tpl === 'C') {
      ctx.fillStyle = "#9f1239"; ctx.font = "bold 70px serif"; ctx.fillText("Joyeux Anniversaire", textX, startY);
      ctx.fillStyle = "#4b5563"; ctx.font = "36px serif";
    } else if (tpl === 'D') {
      ctx.fillStyle = "#111827"; ctx.font = "bold 75px monospace"; ctx.fillText("Happy Birthday.", textX, startY);
      ctx.fillStyle = "#374151"; ctx.font = "italic 36px monospace";
    }

    const lines = (cap.message || "愿你一生被爱，眼里常有星辰大海。").split('\n');
    let currentY = startY + 80;
    lines.forEach(line => {
      currentY = this.wrapCanvasText(ctx, line, textX, currentY, 920, 56);
    });

    // 底部日期戳与图章
    const dateStr = cap.date ? cap.date.replace(/-/g, '.') : "2026.05.20";
    ctx.textAlign = "right";
    ctx.fillStyle = (tpl === 'A' || tpl === 'B') ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
    ctx.font = "bold 24px monospace";
    ctx.fillText(dateStr, 1060, 1660);

    if (tpl === 'D') {
      ctx.fillStyle = "rgba(225, 29, 72, 0.85)"; ctx.font = "bold 55px sans-serif";
      ctx.save(); ctx.translate(950, 1450); ctx.rotate(-15 * Math.PI / 180);
      ctx.fillText("♥ LOVE", 0, 0); ctx.restore();
    }
  }

  // ✨ 加入胶片噪点算法，提升海报高级质感
  addFilmGrain(ctx, w, h) {
    const grainCanvas = document.createElement("canvas");
    grainCanvas.width = w; grainCanvas.height = h;
    const gCtx = grainCanvas.getContext("2d");
    
    // 生成噪点数据
    const imgData = gCtx.createImageData(w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.random() * 255;
      data[i] = val; data[i+1] = val; data[i+2] = val;
      data[i+3] = 12; // 极低的透明度，只保留微弱颗粒感
    }
    gCtx.putImageData(imgData, 0, 0);
    
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.drawImage(grainCanvas, 0, 0);
    ctx.restore();
  }

  wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    let words = text.split(''); let line = '';
    for(let n = 0; n < words.length; n++) {
      let testLine = line + words[n];
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n]; y += lineHeight;
      } else { line = testLine; }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = url;
    });
  }

  escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

window.BirthdayInstance = new BirthdayManager();
