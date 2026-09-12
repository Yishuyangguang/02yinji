/**
 * 众水不灭 · 雅歌之印
 * 文件名: js/theme-engine.js
 * 作用: 多维物理引擎、12 套男女主题切换与 12 款专属定制动态粒子交互演算
 */

class ThemeEngineCore {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrameId = null;
    this.currentPerspective = localStorage.getItem("love_user_perspective") || "boy";
    this.currentThemeId = localStorage.getItem("love_current_theme_id") || "sunset-twilight";
  }

  init() {
    this.canvas = document.getElementById("starry-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    this.ensureBackgroundLayer();
    this.resizeCanvas();
    window.removeEventListener("resize", this.handleResize);
    this.handleResize = () => this.resizeCanvas();
    window.addEventListener("resize", this.handleResize);

    this.bindCapsuleEvents();
    this.updateCapsuleUI();

    const config = window.LOVE_CONFIG || {};
    const themeCfg = config.theme || {};

    const defaultTheme = this.currentPerspective === "boy" 
      ? (themeCfg.currentThemeBoy || themeCfg.currentTheme || "sunset-twilight")
      : (themeCfg.currentThemeGirl || "french-cream");

    const customBg = this.currentPerspective === "boy"
      ? (themeCfg.customBgUrlBoy || themeCfg.customBgUrl || "")
      : (themeCfg.customBgUrlGirl || "");

    this.applyTheme(defaultTheme, customBg, false);
  }

  ensureBackgroundLayer() {
    let bgLayer = document.getElementById("universe-bg-layer");
    if (!bgLayer) {
      bgLayer = document.createElement("div");
      bgLayer.id = "universe-bg-layer";
      bgLayer.className = "universe-bg-layer";
      document.body.prepend(bgLayer);
    }
    return bgLayer;
  }

  bindCapsuleEvents() {
    const boyBtn = document.getElementById("btn-perspective-boy");
    const girlBtn = document.getElementById("btn-perspective-girl");

    if (boyBtn) {
      boyBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.switchPerspective("boy");
      };
    }
    if (girlBtn) {
      girlBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.switchPerspective("girl");
      };
    }
  }

  resizeCanvas() {
    if (!this.canvas) {
      this.canvas = document.getElementById("starry-canvas");
      this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    }
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  switchPerspective(gender) {
    this.currentPerspective = gender;
    localStorage.setItem("love_user_perspective", gender);
    this.updateCapsuleUI();

    const config = window.LOVE_CONFIG || {};
    const themeCfg = config.theme || {};

    const targetTheme = gender === "boy" 
      ? (themeCfg.currentThemeBoy || themeCfg.currentTheme || "sunset-twilight")
      : (themeCfg.currentThemeGirl || "french-cream");

    const targetBg = gender === "boy"
      ? (themeCfg.customBgUrlBoy || themeCfg.customBgUrl || "")
      : (themeCfg.customBgUrlGirl || "");

    this.applyTheme(targetTheme, targetBg, true);
  }

  updateCapsuleUI() {
    const boyBtn = document.getElementById("btn-perspective-boy");
    const girlBtn = document.getElementById("btn-perspective-girl");
    if (boyBtn && girlBtn) {
      if (this.currentPerspective === "boy") {
        boyBtn.classList.add("active");
        girlBtn.classList.remove("active");
      } else {
        girlBtn.classList.add("active");
        boyBtn.classList.remove("active");
      }
    }
  }

  applyTheme(themeId, customBgUrl = "", notify = false) {
    this.currentThemeId = themeId;
    localStorage.setItem("love_current_theme_id", themeId);
    localStorage.setItem("love_current_custom_bg", customBgUrl || "");

    const presets = window.THEME_PRESETS || { boy: [], girl: [] };
    const allThemes = [...(presets.boy || []), ...(presets.girl || [])];
    let themeMeta = allThemes.find(t => t.id === themeId) || { particleType: "meteor", themeType: "dark" };

    const themeType = themeMeta.themeType === "light" ? "light" : "dark";

    document.body.className = document.body.className.replace(/theme-[a-z0-9-]+/g, "").trim();
    document.body.classList.add(`theme-${themeId}`);
    document.body.setAttribute("data-theme-type", themeType);
    document.documentElement.setAttribute("data-theme-type", themeType);

    const bgLayer = this.ensureBackgroundLayer();
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundAttachment = "scroll";

    if (customBgUrl) {
      const scrim = themeType === "light" 
        ? "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4))"
        : "linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45))";
      bgLayer.style.backgroundImage = `${scrim}, url('${customBgUrl}')`;
    } else {
      bgLayer.style.backgroundImage = "";
    }

    // 🌟 核心修复：精准触发独立物理引擎，避免重绘与 CPU 泄漏
    this.initParticlePhysics(themeMeta.particleType);

    if (notify) {
      const msg = `✨ 已切入【${themeMeta.name || "专属"}】时空`;
      if (typeof window.showToast === "function") {
        window.showToast(msg);
      } else if (window.Effects && typeof window.Effects.showMiniToast === "function") {
        window.Effects.showMiniToast(msg);
      }
    }
  }

  // 12套物理引擎派发器：清理前序渲染栈
  initParticlePhysics(type) {
    if (!this.canvas || !this.ctx) return;
    
    // 强制截断上一主题的 RequestAnimationFrame 递归，防止渲染叠加变卡
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    this.particles = [];
    const count = window.innerWidth < 768 ? 35 : 70;

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(type));
    }

    const renderLoop = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles.forEach((p) => {
        this.updateAndDrawParticle(p, type);
      });
      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  // 构建 12 套独立的物理初态数据
  createParticle(type) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    switch (type) {
      case "meteor": // 暮色星河 (静谧繁星)
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 1.5 + 0.5, alpha: Math.random(), twinkle: Math.random() * 0.02 + 0.01 };
      
      case "cyberMatrix": // 赛博漫游 (向上升腾的黑客流)
        return { x: Math.random() * w, y: Math.random() * h, length: Math.random() * 30 + 10, speedY: -(Math.random() * 5 + 2), opacity: Math.random() * 0.6 + 0.2 };
      
      case "fireflies": // 萤火森林 (正弦波仿生飞行)
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 2 + 1, angle: Math.random() * Math.PI * 2, speed: Math.random() * 0.5 + 0.2, alpha: Math.random(), twinkle: Math.random() * 0.02 + 0.01 };
      
      case "embers": // 炽热余烬 (上升并消散)
        return { x: Math.random() * w, y: h + Math.random() * 100, radius: Math.random() * 2.5 + 1, speedY: -(Math.random() * 2 + 1), speedX: (Math.random() - 0.5) * 1, opacity: Math.random() * 0.8 + 0.2 };
      
      case "bioplankton": // 深海鲸落 (轻微洋流摇摆)
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 2 + 0.5, speedY: -(Math.random() * 0.6 + 0.2), offset: Math.random() * 100, opacity: Math.random() * 0.6 + 0.2 };
      
      case "aurora": // 极光夜幕 (横向缓慢光栅射线)
        return { x: Math.random() * w, y: Math.random() * h, length: Math.random() * 100 + 50, speedX: Math.random() * 0.5 + 0.1, opacity: Math.random() * 0.3 + 0.1 };

      case "sunDust": // 法式奶油 (柔焦金粉)
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 3 + 1, speedY: (Math.random() - 0.5) * 0.4, speedX: (Math.random() - 0.5) * 0.4, opacity: Math.random() * 0.5 + 0.1 };
      
      case "petals": // 初雪樱花 (受重力飘落与旋转)
        return { x: Math.random() * w, y: -Math.random() * h, sizeX: Math.random() * 5 + 4, sizeY: Math.random() * 3 + 2, speedY: Math.random() * 1.5 + 1, speedX: Math.random() * 1 + 0.5, rotation: Math.random() * 360, rotSpeed: Math.random() * 3 - 1.5, opacity: Math.random() * 0.7 + 0.3 };
      
      case "floralRipples": // 莫奈花园 (青绿布朗运动)
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 1.5 + 0.5, speedX: (Math.random() - 0.5) * 0.8, speedY: (Math.random() - 0.5) * 0.8, opacity: Math.random() * 0.6 + 0.2 };
      
      case "dewDrops": // 晨曦朝露 (垂直滴落)
        return { x: Math.random() * w, y: -Math.random() * h, radius: Math.random() * 2 + 1, speedY: Math.random() * 3 + 2, opacity: Math.random() * 0.8 + 0.2 };
      
      case "bubbles": // 梦幻甜梦 (粉紫空心气泡摇曳)
        return { x: Math.random() * w, y: h + Math.random() * h, radius: Math.random() * 8 + 4, speedY: -(Math.random() * 1 + 0.5), angle: Math.random() * Math.PI, opacity: Math.random() * 0.5 + 0.2 };
      
      case "seaSpray": // 橘子汽水 (金色碳酸高速翻滚)
        return { x: Math.random() * w, y: h + Math.random() * 50, radius: Math.random() * 4 + 1.5, speedY: -(Math.random() * 3 + 1), speedX: (Math.random() - 0.5) * 0.6, opacity: Math.random() * 0.7 + 0.3 };
      
      default:
        return { x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 1.5, alpha: Math.random(), twinkle: 0.02 };
    }
  }

  // 12套核心渲染画笔指令
  updateAndDrawParticle(p, type) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    switch (type) {
      case "meteor": // 白星闪烁
        p.alpha += p.twinkle;
        if (p.alpha > 1 || p.alpha < 0.1) p.twinkle = -p.twinkle;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(p.alpha)})`; ctx.fill();
        break;

      case "cyberMatrix": // 代码流线
        p.y += p.speedY;
        if (p.y < -p.length) { p.y = h; p.x = Math.random() * w; }
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.length);
        ctx.strokeStyle = `rgba(56, 189, 248, ${p.opacity})`; ctx.lineWidth = 1.5; ctx.stroke();
        break;

      case "fireflies": // 萤火虫仿生寻迹
        p.angle += 0.05;
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed - 0.2;
        p.alpha += p.twinkle;
        if (p.alpha > 1 || p.alpha < 0.2) p.twinkle = -p.twinkle;
        if (p.y < 0) p.y = h; if (p.x < 0 || p.x > w) p.x = Math.random() * w;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 243, 208, ${Math.abs(p.alpha)})`; ctx.fill();
        break;

      case "embers": // 余烬消散
        p.x += p.speedX; p.y += p.speedY;
        p.opacity -= 0.003;
        if (p.opacity <= 0 || p.y < 0) { Object.assign(p, this.createParticle(type)); }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249, 115, 22, ${p.opacity})`; ctx.fill();
        break;

      case "bioplankton": // 幽蓝浮游
        p.y += p.speedY;
        p.x += Math.sin(p.y * 0.02 + p.offset) * 0.5;
        if (p.y < 0) p.y = h;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125, 211, 252, ${p.opacity})`; ctx.fill();
        break;

      case "aurora": // 极光流线
        p.x += p.speedX;
        if (p.x > w + p.length) p.x = -p.length;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.length, p.y - p.length * 0.3);
        ctx.strokeStyle = `rgba(192, 132, 252, ${p.opacity})`; ctx.lineWidth = 2; ctx.stroke();
        break;

      case "sunDust": // 柔焦金光
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 119, 6, ${p.opacity})`; ctx.fill();
        break;

      case "petals": // 樱花飘落
        p.x += p.speedX; p.y += p.speedY; p.rotation += p.rotSpeed;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = `rgba(244, 114, 182, ${p.opacity})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.sizeX, p.sizeY, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;

      case "floralRipples": // 青绿花粉
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 163, 74, ${p.opacity})`; ctx.fill();
        break;

      case "dewDrops": // 垂直水滴
        p.y += p.speedY;
        if (p.y > h) p.y = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(14, 165, 233, ${p.opacity})`; ctx.fill();
        break;

      case "bubbles": // 梦幻空心气泡
        p.angle += 0.02; p.y += p.speedY; p.x += Math.sin(p.angle) * 0.5;
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(192, 132, 252, ${p.opacity})`; ctx.lineWidth = 1.5; ctx.stroke();
        break;

      case "seaSpray": // 橘色碳酸气泡
        p.y += p.speedY; p.x += p.speedX;
        if (p.y < -10) { Object.assign(p, this.createParticle(type)); }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234, 88, 12, ${p.opacity})`; ctx.fill();
        break;
    }
  }
}

window.ThemeEngine = new ThemeEngineCore();

document.addEventListener("DOMContentLoaded", () => {
  if (window.ThemeEngine) window.ThemeEngine.init();
});
