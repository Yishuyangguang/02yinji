/**
 * 众水不灭 · 雅歌之印
 * 文件名: js/romantic-rose.js
 * 作用: 门禁专属 3D 粒子流体引擎 (繁花生命之树、流动溪水与极客代码屏)
 * 防护: 注入宽向锁定算法，彻底隔绝移动端键盘弹起导致的画布畸变
 */

class RomanticRoseEngine {
  constructor() {
    this.codeCanvas = document.getElementById('rose-code-canvas');
    this.particleCanvas = document.getElementById('rose-particle-canvas');
    this.container = document.getElementById('romantic-rose-container');
    
    this.codeCtx = null;
    this.particleCtx = null;
    
    this.animationFrameId = null;
    this.isRendering = false;
    
    // 移动端防畸变鉴权锁
    this.lastWidth = window.innerWidth;
    this.isMobile = window.innerWidth <= 768;
    
    // 3D 粒子系统
    this.particles = [];
    this.angleY = 0;
    this.fov = 320;
    this.time = 0; // 用于驱动溪水流动
    
    // 极客代码滚动参数
    this.codeLines = [];
    this.codeOffset = 0;
    this.pythonSnippets = [
      "def grow_tree(self, season_frame):",
      "    x = random.randint(-14, 14)",
      "    z = random.randint(-14, 14)",
      "    flower_size = random.choice((1, 2, 2))",
      "    branches.append((x, z, flower_size))",
      "for node in self.roots.nodes:",
      "    radius = calc_hyperbolic(node.y)",
      "    water_flow = math.sin(time + node.x)",
      "    stream.append((node.x, water_flow, size))",
      "def render_life(self, canvas, frame):",
      "    for pt in self.tree.all_points[frame]:",
      "        if pt.type == 'flower':",
      "            canvas.draw_petal(pt.x, pt.y)",
      "if __name__ == '__main__':",
      "    universe = Space()",
      "    universe.title('Tree of Life')",
      "    canvas = Canvas(universe, bg='void')",
      "    tree = BloomingTree(stream=True)",
      "    render(universe, canvas, tree)",
      "    universe.simulate_eternity()"
    ];

    this.resizeHandler = this.resize.bind(this);
  }

  init() {
    if (!this.codeCanvas || !this.particleCanvas || !this.container) {
      console.warn("[RoseEngine] 缺少必要的 DOM 容器，引擎初始化中止。");
      return;
    }

    try {
      this.codeCtx = this.codeCanvas.getContext('2d', { alpha: true });
      this.particleCtx = this.particleCanvas.getContext('2d', { alpha: true });
      
      window.addEventListener('resize', this.resizeHandler);
      this.forceResize(); // 初始强制计算
      
      this.generateTreeAndStream(); 
      
      for (let i = 0; i < 45; i++) {
        this.codeLines.push({
          text: this.pythonSnippets[Math.floor(Math.random() * this.pythonSnippets.length)],
          opacity: Math.random() * 0.4 + 0.1
        });
      }

      this.isRendering = true;
      this.container.style.opacity = '1';
      this.render();

    } catch (e) {
      console.error("[RoseEngine] 引擎初始化失败，已安全降级:", e);
      this.destroy();
    }
  }

  resize() {
    // 物理隔离防御：如果仅仅是高度变化（例如手机端弹出了软键盘），严格阻断画布重置，防止画面向上乱跳和畸变
    if (this.isMobile && Math.abs(window.innerWidth - this.lastWidth) < 10) {
      return; 
    }
    this.forceResize();
  }

  forceResize() {
    try {
      this.lastWidth = window.innerWidth;
      this.isMobile = window.innerWidth <= 768;
      const dpr = window.devicePixelRatio || 1;
      
      const codeRect = this.codeCanvas.parentElement.getBoundingClientRect();
      this.codeCanvas.width = codeRect.width * dpr;
      this.codeCanvas.height = codeRect.height * dpr;
      this.codeCtx.scale(dpr, dpr);

      const particleRect = this.particleCanvas.parentElement.getBoundingClientRect();
      this.particleCanvas.width = particleRect.width * dpr;
      this.particleCanvas.height = particleRect.height * dpr;
      this.particleCtx.scale(dpr, dpr);

      // 移动端动态调整景深，保证整棵树完整处于视口内
      this.fov = particleRect.width < 500 ? 180 : 320;
    } catch (e) {}
  }

  generateTreeAndStream() {
    this.particles = [];
    
    // ====== 1. 繁花树冠 (非标准球极坐标，加入高斯噪声偏移) ======
    const canopyCount = 5500;
    for (let i = 0; i < canopyCount; i++) {
      // 树冠体积分布规律
      const r = 95 * Math.cbrt(Math.random()); 
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi) * 0.75 + 50; // 树冠中心偏上，并且做轻微压扁处理
      let z = r * Math.sin(phi) * Math.sin(theta);
      
      // 注入空间噪点，使树冠呈现真实的枝桠不规则集群感
      const noise = () => (Math.random() - 0.5) * 18;
      x += noise(); y += noise(); z += noise();

      // 花朵色彩：粉白交织，暗部透绿灰，亮部粉嫩
      let color = '#fbcfe8'; // 默认亮粉
      if (Math.random() > 0.5) color = '#f43f5e'; // 樱桃粉红
      if (Math.random() > 0.8) color = '#ffffff'; // 高光白
      if (y < 40 && Math.random() > 0.7) color = '#a7f3d0'; // 底层透出一点叶片的灰青色

      this.particles.push({ x, y, baseY: y, z, size: Math.random() * 1.5 + 0.6, color, type: 'flower' });
    }

    // ====== 2. 树干与盘根 (双曲面抛物线方程) ======
    const trunkCount = 2000;
    for (let i = 0; i < trunkCount; i++) {
      const y = Math.random() * 110 - 60; // 树干高度范围：-60 到 50
      // 抛物线公式计算树干半径：中间细，底部根系散开，顶部枝干散开
      const radius = 6 + Math.pow(y - 10, 2) / 75; 
      const theta = Math.random() * Math.PI * 2;
      
      // 添加树皮纹理噪点
      let x = radius * Math.cos(theta) + (Math.random() - 0.5) * 6;
      let z = radius * Math.sin(theta) + (Math.random() - 0.5) * 6;

      // 树干色彩：顶部偏白灰，底部根系变为暗红色
      let color = y < -20 ? '#881337' : '#e2e8f0'; 
      if (y > -20 && Math.random() > 0.7) color = '#cbd5e1'; 

      this.particles.push({ x, y, baseY: y, z, size: Math.random() * 1.2 + 0.5, color, type: 'trunk' });
    }

    // ====== 3. 潺潺溪水 (波光粼粼流体) ======
    const streamCount = 1200;
    for (let i = 0; i < streamCount; i++) {
      const x = (Math.random() - 0.5) * 400; // 溪流的长度
      const zOffset = (Math.random() - 0.5) * 40; // 溪流的宽度
      const z = 70 + zOffset; // 溪水位置，放在树的侧前方
      const y = -55 + (Math.random() - 0.5) * 6; // 紧贴树根的地平面

      // 溪水色彩：青蓝、浅蓝与泛起的白色水花
      let color = Math.random() > 0.5 ? '#22d3ee' : '#7dd3fc';
      if (Math.random() > 0.85) color = '#ffffff';

      this.particles.push({ 
        x, y, baseY: y, z, 
        size: Math.random() * 1.4 + 0.6, 
        color, 
        type: 'water',
        speedX: Math.random() * 0.8 + 0.2, // 每颗水滴独有的流速
        phase: Math.random() * Math.PI * 2  // 波浪初相
      });
    }
  }

  render() {
    if (!this.isRendering) return;
    try {
      this.time += 0.03; // 时间常量推进
      this.drawCode();
      this.drawNature();
    } catch (e) {
      console.warn("[RoseEngine] 渲染异常截获:", e);
    }
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  drawCode() {
    const w = this.codeCanvas.width / (window.devicePixelRatio || 1);
    const h = this.codeCanvas.height / (window.devicePixelRatio || 1);
    
    this.codeCtx.clearRect(0, 0, w, h);
    this.codeCtx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
    this.codeCtx.textAlign = 'left';
    
    const lineHeight = 22;
    this.codeOffset -= 0.6; 
    
    if (this.codeOffset < -lineHeight) {
      this.codeOffset = 0;
      this.codeLines.shift();
      this.codeLines.push({
        text: this.pythonSnippets[Math.floor(Math.random() * this.pythonSnippets.length)],
        opacity: Math.random() * 0.4 + 0.1
      });
    }

    for (let i = 0; i < this.codeLines.length; i++) {
      const line = this.codeLines[i];
      const y = i * lineHeight + this.codeOffset;
      
      if (y > 0 && y < h + lineHeight) {
        // 使用暗粉/灰白色搭配，契合极客氛围
        this.codeCtx.fillStyle = `rgba(244, 63, 94, ${line.opacity})`; 
        this.codeCtx.fillText(line.text, 20, y);
      }
    }
  }

  drawNature() {
    const w = this.particleCanvas.width / (window.devicePixelRatio || 1);
    const h = this.particleCanvas.height / (window.devicePixelRatio || 1);
    const centerX = w / 2;
    const centerY = h / 2 + 10; 

    this.particleCtx.clearRect(0, 0, w, h);

    this.angleY += 0.005; // 树木非常缓慢地旋转
    const cosY = Math.cos(this.angleY);
    const sinY = Math.sin(this.angleY);

    const projected = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      // ====== 溪水流动物理模拟 ======
      if (p.type === 'water') {
        p.x -= p.speedX; // 水流向左侧平移
        if (p.x < -200) p.x = 200; // 超出边界后从右侧循环重生
        
        // 正弦波形波动，模拟水流涟漪
        p.y = p.baseY + Math.sin(p.x * 0.03 + this.time + p.phase) * 4; 
      }
      
      // Y轴旋转矩阵
      const rotX = p.x * cosY - p.z * sinY;
      const rotZ = p.x * sinY + p.z * cosY;
      
      // 3D 投影至 2D 屏幕 (将 Y 轴反转，因为 Canvas 的 Y 是向下的)
      const scale = this.fov / (this.fov + rotZ);
      const screenX = centerX + rotX * scale;
      const screenY = centerY - p.y * scale; 
      
      // 视口边界剔除优化
      if (screenX > -50 && screenX < w + 50 && screenY > -50 && screenY < h + 50) {
        projected.push({
          x: screenX,
          y: screenY,
          size: p.size * scale,
          color: p.color,
          z: rotZ
        });
      }
    }

    // 画家算法深度排序 (Z-buffer)，远处的粒子先画，近处后画
    projected.sort((a, b) => b.z - a.z);

    // 批量执行渲染
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      this.particleCtx.fillStyle = p.color;
      this.particleCtx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  destroy() {
    this.isRendering = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resizeHandler);
    
    if (this.container) this.container.style.opacity = '0';
    if (this.codeCtx && this.codeCanvas) this.codeCtx.clearRect(0, 0, this.codeCanvas.width, this.codeCanvas.height);
    if (this.particleCtx && this.particleCanvas) this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
    
    this.particles = [];
    this.codeLines = [];
  }
}

window.RomanticRoseEngine = RomanticRoseEngine;
