/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/photo-wall.js
 * 架构重构: 绝对网格隔离(防重叠)、统一星座视差(防追尾)、FIFO公平轮询调度(寿命均等)
 */

class PhotoWallManager {
  constructor(config) {
    this.config = config || window.LOVE_CONFIG || {};
    this.itemsData = []; // 挂载在安全区上的节点数据
    this.photoPool = []; // 待展示的内存照片池
    this.ticking = false;
    this.lastScrollY = -1;
    this.resizeTimer = null;
    this.breathingTimer = null;
    
    // 🌟 核心修复 2：公平轮询指针，替代失忆的随机数
    this.breathIndex = 0; 
  }

  init() {
    const container = document.getElementById("parallax-photo-wall");
    if (!container) return;

    if (this.breathingTimer) clearInterval(this.breathingTimer);

    const timeline = this.config.timeline || [];
    const photoNodes = timeline.filter(item => Boolean(item.frontImg));

    if (photoNodes.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    this.itemsData = [];
    this.breathIndex = 0;

    // ================= 1. 绝对特权隔离：首张照片固定头像 =================
    const avatarNode = photoNodes[0];
    if (avatarNode && avatarNode.frontImg) {
      const avatarItem = document.createElement("div");
      avatarItem.className = "wall-polaroid-avatar";
      avatarItem.innerHTML = `
        <div class="wall-polaroid-inner">
          <img src="${avatarNode.frontImg}" alt="专属头像" loading="eager" decoding="async" onerror="this.parentElement.parentElement.style.display='none'">
        </div>
        <div class="wall-polaroid-caption">${avatarNode.tag || "恒久契约"}</div>
      `;
      container.appendChild(avatarItem);
    }

    // ================= 2. 获取严格网格安全区 =================
    this.photoPool = photoNodes.slice(1);
    
    if (this.photoPool.length > 0) {
      const isMobile = window.innerWidth <= 640;
      const safeZones = this.getSafeZones(isMobile);
      
      // 按可用的安全网格数量，截断初始渲染的照片
      const initialRenderCount = Math.min(this.photoPool.length, safeZones.length);
      
      for (let i = 0; i < initialRenderCount; i++) {
        const node = this.photoPool[i];
        const zone = safeZones[i];
        this.createAndAppendPolaroid(container, node, zone);
      }

      this.updateParallax(true);

      // ================= 3. 开启 FIFO 公平呼吸轮换 =================
      if (this.photoPool.length > 0 && safeZones.length > 0) {
        this.startBreathingCarousel();
      }
    }

    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        // 重绘时重新初始化以适配新视口
        this.init(); 
      }, 300);
    }, { passive: true });

    window.addEventListener("scroll", () => {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          this.updateParallax();
          this.ticking = false;
        });
        this.ticking = true;
      }
    }, { passive: true });
  }

  /**
   * 🌟 核心修复 1：绝对网格隔离 (Absolute Sector Zoning)
   * 划分互不干涉的独立区块。左上角始终留空给 1 号头像使用。
   */
  getSafeZones(isMobile) {
    if (isMobile) {
      return [
        { side: 'right', topMin: 15, topMax: 35, xMin: 2, xMax: 6 }, // 右上
        { side: 'right', topMin: 55, topMax: 80, xMin: 2, xMax: 6 }, // 右下
        { side: 'left',  topMin: 55, topMax: 80, xMin: 2, xMax: 6 }  // 左下
      ];
    } else {
      return [
        { side: 'right', topMin: 10, topMax: 30, xMin: 3, xMax: 12 }, // 右上
        { side: 'right', topMin: 40, topMax: 60, xMin: 3, xMax: 12 }, // 右中
        { side: 'right', topMin: 70, topMax: 85, xMin: 3, xMax: 12 }, // 右下
        { side: 'left',  topMin: 45, topMax: 65, xMin: 3, xMax: 12 }, // 左中 (避开左上的头像)
        { side: 'left',  topMin: 75, topMax: 90, xMin: 3, xMax: 12 }  // 左下
      ];
    }
  }

  /**
   * 将照片注入指定的网格安全区
   */
  createAndAppendPolaroid(container, node, zone) {
    const isMobile = window.innerWidth <= 640;
    const item = document.createElement("div");
    item.className = "wall-polaroid-item";

    // 在网格的安全范围内，加入微小的随机抖动，避免排版过于死板
    const randomY = zone.topMin + Math.random() * (zone.topMax - zone.topMin);
    const randomX = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
    const baseTop = (randomY / 100) * window.innerHeight;
    
    // 限制旋转角度，防止视觉盒膨胀互相打架
    const baseRot = (Math.random() - 0.5) * (isMobile ? 12 : 20);
    
    // 🌟 核心修复 3：统一的星座视差速度，坚决杜绝滑动时轨迹追尾重叠
    const unifiedSpeed = -0.035;

    item.style.top = `${baseTop}px`;
    if (zone.side === 'left') {
      item.style.left = `${randomX}%`;
      item.style.right = "auto";
    } else {
      item.style.right = `${randomX}%`;
      item.style.left = "auto";
    }
    
    item.style.transform = `translate3d(0, 0, 0) rotate(${baseRot}deg)`;
    item.style.opacity = isMobile ? '0.75' : '0.85';

    item.innerHTML = `
      <div class="wall-polaroid-inner">
        <img src="${node.frontImg}" alt="${node.title || "时光碎片"}" loading="lazy" decoding="async" onerror="this.parentElement.parentElement.style.display='none'">
      </div>
    `;

    container.appendChild(item);

    this.itemsData.push({
      element: item,
      node: node,
      zone: zone, // 绑定专属领域，不可越界
      baseTop: baseTop,
      baseRot: baseRot,
      speed: unifiedSpeed, // 所有照片速度一致
      isAnimating: false
    });
  }

  /**
   * 🌟 核心修复 4：FIFO 公平呼吸轮询
   * 抛弃 Math.random，采用按顺序点名，确保每张照片寿命绝对均等
   */
  startBreathingCarousel() {
    const isMobile = window.innerWidth <= 640;

    this.breathingTimer = setInterval(() => {
      if (this.itemsData.length === 0) return;

      // 顺序选取当前该轮换的槽位，选取后指针 +1
      const slot = this.itemsData[this.breathIndex];
      this.breathIndex = (this.breathIndex + 1) % this.itemsData.length;

      if (slot.isAnimating) return;
      slot.isAnimating = true;

      // 1. 缓缓隐去
      slot.element.style.opacity = '0';

      // 2. DOM 退场期间更换资源，并且【仅在自己的安全区内】重算抖动坐标
      setTimeout(() => {
        let nextNode = slot.node;
        
        // 获取所有未在屏幕上展示的照片
        const inactivePool = this.photoPool.filter(p => !this.itemsData.some(a => a.node === p));
        if (inactivePool.length > 0) {
          nextNode = inactivePool[Math.floor(Math.random() * inactivePool.length)];
        }

        // 仅在自己专属的 Zone 内重新随机，绝对不会越界去抢别人的地盘
        const zone = slot.zone;
        const randomY = zone.topMin + Math.random() * (zone.topMax - zone.topMin);
        const randomX = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
        const newTop = (randomY / 100) * window.innerHeight;
        const newRot = (Math.random() - 0.5) * (isMobile ? 12 : 20);

        slot.node = nextNode;
        slot.baseTop = newTop;
        slot.baseRot = newRot;

        if (zone.side === 'left') {
          slot.element.style.left = `${randomX}%`;
        } else {
          slot.element.style.right = `${randomX}%`;
        }
        slot.element.style.top = `${slot.baseTop}px`;

        const img = slot.element.querySelector('img');
        if (img) img.src = nextNode.frontImg;

        // 立刻校准滑动视差
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const offsetY = Math.round(scrollY * slot.speed);
        slot.element.style.transform = `translate3d(0, ${offsetY}px, 0) rotate(${slot.baseRot}deg)`;

        // 3. 缓缓亮起
        setTimeout(() => {
          slot.element.style.opacity = isMobile ? '0.75' : '0.85';
          setTimeout(() => { slot.isAnimating = false; }, 1200);
        }, 100);

      }, 1200); 

    }, 4500); // 公平间隔：每 4.5 秒轮换一张
  }

  updateParallax(force = false) {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    if (!force && Math.abs(scrollY - this.lastScrollY) < 0.5) return;
    this.lastScrollY = scrollY;

    for (let i = 0; i < this.itemsData.length; i++) {
      const data = this.itemsData[i];
      if (data.element && !data.isAnimating) {
        // 由于所有照片的 speed 一致，它们就像同一块玻璃板上的水滴，绝对不会相撞
        const offsetY = Math.round(scrollY * data.speed);
        data.element.style.transform = `translate3d(0, ${offsetY}px, 0) rotate(${data.baseRot}deg)`;
      }
    }
  }
}

// 自动挂载并在 DOM 就绪后启动
window.PhotoWallManager = PhotoWallManager;

document.addEventListener("DOMContentLoaded", () => {
  if (window.LOVE_CONFIG) {
    const photoWall = new PhotoWallManager(window.LOVE_CONFIG);
    photoWall.init();
  }
});
