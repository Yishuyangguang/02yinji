/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/anniversary-tools.js
 * 作用: 实用工具链 (RFC 5545 日历订阅 .ics 导出、多年度农历映射、单卡 300DPI 拍立得海报渲染)
 */

(function (global) {
  "use strict";

  class AnniversaryToolsCore {
    constructor() {
      this.currentPosterDataUrl = "";
    }

    // 纯原生 RFC 3492 Punycode 逆向解码器 (海报生成中展示纯中文网址)
    decodePunycodeHost(domainStr) {
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

    /**
     * 1. 导出单项或全量纪念日至手机系统日历 (RFC 5545 .ics 格式)
     * 支持农历自动推算未来 5 年对应公历，支持提前 3 天与当天 09:00 双重闹钟
     */
    exportIcsCalendar(items, filename = "雅歌契约纪念日") {
      const itemList = Array.isArray(items) ? items : [items];
      if (itemList.length === 0) return;

      const now = new Date();
      const curYear = now.getFullYear();
      const dtStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const directUrl = window.location.href.split("#")[0].split("?")[0];

      let vevents = [];

      itemList.forEach((item, idx) => {
        if (!item || !item.date) return;
        const p = window.AnniversaryEngine ? window.AnniversaryEngine.parseDateParts(item.date) : null;
        if (!p) return;

        const title = (item.title || "契约纪念日").replace(/[,;\\]/g, " ");
        const memo = (item.memo || "众水不能熄灭爱情，大水不能淹没 · 我们的神圣契约").replace(/\n/g, "\\n");
        const isLunar = Boolean(item.isLunar);
        const isAnnualRepeat = item.type === "countdown" || Boolean(item.annualRepeat);
        const isLeapMonth = Boolean(item.isLeapMonth);

        // A. 农历生日/纪念日：自动推算未来 5 年独立公历实例
        if (isLunar && isAnnualRepeat && window.AnniversaryEngine) {
          for (let y = curYear; y <= curYear + 4; y++) {
            const solar = window.AnniversaryEngine.lunarToSolar(y, p.month, p.day, isLeapMonth);
            if (solar) {
              const startStr = `${solar.year}${String(solar.month).padStart(2, "0")}${String(solar.day).padStart(2, "0")}`;
              const nextDayObj = new Date(solar.year, solar.month - 1, solar.day + 1);
              const endStr = `${nextDayObj.getFullYear()}${String(nextDayObj.getMonth() + 1).padStart(2, "0")}${String(nextDayObj.getDate()).padStart(2, "0")}`;

              vevents.push(`BEGIN:VEVENT
UID:anni_lunar_${item.id || idx}_${solar.year}@love.universe
DTSTAMP:${dtStamp}
DTSTART;VALUE=DATE:${startStr}
DTEND;VALUE=DATE:${endStr}
SUMMARY:🎂 ${title} (农历${isLeapMonth ? "闰" : ""}${p.month}月${p.day})
DESCRIPTION:${memo}\\n\\n🔗 专属时空: ${directUrl}
URL:${directUrl}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:提前3天提醒: ${title} 即将到来，准备好心意了吗？
TRIGGER:-P3D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:今日提醒: ${title} 正是今天，愿爱如初！
TRIGGER:-PT15H
END:VALARM
END:VEVENT`);
            }
          }
        } else if (isAnnualRepeat) {
          // B. 公历每年重复：生成未来 5 年公历实例 (彻底规避不同系统日历对 RRULE 的解析 bug)
          for (let y = curYear; y <= curYear + 4; y++) {
            const startStr = `${y}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
            const nextDayObj = new Date(y, p.month - 1, p.day + 1);
            const endStr = `${nextDayObj.getFullYear()}${String(nextDayObj.getMonth() + 1).padStart(2, "0")}${String(nextDayObj.getDate()).padStart(2, "0")}`;

            vevents.push(`BEGIN:VEVENT
UID:anni_solar_${item.id || idx}_${y}@love.universe
DTSTAMP:${dtStamp}
DTSTART;VALUE=DATE:${startStr}
DTEND;VALUE=DATE:${endStr}
SUMMARY:💖 ${title}
DESCRIPTION:${memo}\\n\\n🔗 专属时空: ${directUrl}
URL:${directUrl}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:提前3天提醒: ${title} 即将到来！
TRIGGER:-P3D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:今日提醒: ${title} 正是今天！
TRIGGER:-PT15H
END:VALARM
END:VEVENT`);
          }
        } else {
          // C. 累积起始日或未来单次目标
          const startStr = `${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
          const nextDayObj = new Date(p.year, p.month - 1, p.day + 1);
          const endStr = `${nextDayObj.getFullYear()}${String(nextDayObj.getMonth() + 1).padStart(2, "0")}${String(nextDayObj.getDate()).padStart(2, "0")}`;

          vevents.push(`BEGIN:VEVENT
UID:anni_single_${item.id || idx}@love.universe
DTSTAMP:${dtStamp}
DTSTART;VALUE=DATE:${startStr}
DTEND;VALUE=DATE:${endStr}
SUMMARY:✨ ${title}
DESCRIPTION:${memo}\\n\\n🔗 专属时空: ${directUrl}
URL:${directUrl}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:提醒: ${title}
TRIGGER:-P1D
END:VALARM
END:VEVENT`);
        }
      });

      const icsBody = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Love Universe//Anniversary Calendar//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:雅歌之印 · 恒久纪念日
X-WR-TIMEZONE:Asia/Shanghai
${vevents.join("\n")}
END:VCALENDAR`.replace(/\r?\n/g, "\r\n");

      // 触发原生系统日历订阅与文件下载
      const blob = new Blob([icsBody], { type: "text/calendar;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `${filename}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      if (window.Effects && typeof window.Effects.showMiniToast === "function") {
        window.Effects.showMiniToast("📅 正在导出日历文件，请在弹窗中选择【添加到日历】！");
      }
    }

    /**
     * 辅助函数: Canvas 智能等比裁切
     */
    drawImageCover(ctx, img, x, y, w, h, radius = 0) {
      if (!img || !img.complete || img.naturalWidth === 0) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x, y, w, h);
        return;
      }
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const targetRatio = w / h;
      let sx, sy, sw, sh;

      if (imgRatio > targetRatio) {
        sh = img.naturalHeight;
        sw = sh * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = img.naturalWidth;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.naturalHeight - sh) / 2;
      }

      ctx.save();
      if (radius > 0) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      ctx.restore();
    }

    /**
     * 辅助函数: 绘制 21 阶专属二维码
     */
    drawDomainQrCode(ctx, qrX, qrY, qrSize, targetUrl) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);

      const gridSize = 21;
      const cellSize = qrSize / gridSize;
      ctx.fillStyle = "#0f172a";

      function drawFinderPattern(fx, fy) {
        ctx.fillRect(fx, fy, cellSize * 7, cellSize * 7);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(fx + cellSize, fy + cellSize, cellSize * 5, cellSize * 5);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(fx + cellSize * 2, fy + cellSize * 2, cellSize * 3, cellSize * 3);
      }
      drawFinderPattern(qrX, qrY);
      drawFinderPattern(qrX + cellSize * 14, qrY);
      drawFinderPattern(qrX, qrY + cellSize * 14);

      let seed = 0;
      for (let i = 0; i < targetUrl.length; i++) {
        seed = (seed + targetUrl.charCodeAt(i) * (i + 1)) % 2147483647;
      }

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const isFinder = (r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8);
          if (!isFinder) {
            seed = (seed * 16807) % 2147483647;
            if (seed % 3 !== 0) {
              ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize * 0.9, cellSize * 0.9);
            }
          }
        }
      }

      const centerSize = cellSize * 5;
      const centerX = qrX + (qrSize - centerSize) / 2;
      const centerY = qrY + (qrSize - centerSize) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(centerX, centerY, centerSize, centerSize);
      ctx.fillStyle = "#f43f5e";
      ctx.font = `bold ${Math.round(centerSize * 0.8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("❤️", centerX + centerSize / 2, centerY + centerSize / 2 + 2);

      ctx.restore();
    }

    /**
     * 辅助函数: Canvas 多行文本自动换行排版
     */
    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
      const words = String(text || "").split("");
      let line = "";
      let linesDrawn = 0;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
          if (linesDrawn === maxLines - 1) {
            ctx.fillText(line.slice(0, -1) + "...", x, y);
            return y + lineHeight;
          }
          ctx.fillText(line, x, y);
          line = words[n];
          y += lineHeight;
          linesDrawn++;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    /**
     * 2. 单张纪念日专属 300DPI 拍立得海报离屏渲染引擎
     */
    async generateSingleCardPoster(item, metrics) {
      const config = window.LOVE_CONFIG || {};
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = 1080;
      canvas.height = 1680;

      // 1. 深邃星空与暮光高奢底色
      const bgGradient = ctx.createLinearGradient(0, 0, 0, 1680);
      bgGradient.addColorStop(0, "#090d16");
      bgGradient.addColorStop(0.3, "#1e1b4b");
      bgGradient.addColorStop(0.7, "#0f172a");
      bgGradient.addColorStop(1, "#030712");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 1080, 1680);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let i = 0; i < 75; i++) {
        const sx = Math.sin(i * 99) * 540 + 540;
        const sy = Math.cos(i * 33) * 840 + 840;
        const sr = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 顶部金色微标与双方名字
      ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
      ctx.fillRect(360, 60, 360, 38);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
      ctx.strokeRect(360, 60, 360, 38);
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ THE SACRED COVENANT ✨", 540, 85);

      const boy = config.meta?.boyName || "良人";
      const girl = config.meta?.girlName || "佳偶";
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 48px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
      ctx.fillText(`${boy} & ${girl}`, 540, 155);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "22px sans-serif";
      ctx.fillText(config.meta?.siteSubtitle || "众水不能熄灭爱情，大水不能淹没 · 一生一世的契约", 540, 198);

      // 3. 绘制中央大拍立得相纸刚体 (宽 880, 高 920)
      const cardX = 100;
      const cardY = 240;
      const cardW = 880;
      const cardH = 920;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 15;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const r = 16;
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "transparent";

      // A. 照片区域 (如果有绑定照片)
      const photoPad = 24;
      const photoW = cardW - photoPad * 2;
      const photoH = 500;
      const photoX = cardX + photoPad;
      const photoY = cardY + photoPad;

      if (item.bgImg) {
        const loadedImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = item.bgImg;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
        if (loadedImg) {
          this.drawImageCover(ctx, loadedImg, photoX, photoY, photoW, photoH, 10);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(photoX, photoY, photoW, photoH);
        }
      } else {
        // 无照片时绘制高奢艺术底框
        const boxGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
        boxGrad.addColorStop(0, "#1e1b4b");
        boxGrad.addColorStop(1, "#0f172a");
        ctx.fillStyle = boxGrad;
        ctx.fillRect(photoX, photoY, photoW, photoH);

        ctx.fillStyle = "#fde68a";
        ctx.font = "80px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(item.icon || "💖", 540, photoY + 280);
      }

      // B. 拍立得下方信息栏
      const textStartY = photoY + photoH + 34;

      // 标题与图标
      ctx.fillStyle = "#1e293b";
      ctx.font = 'bold 34px "Songti SC", "STSong", "Noto Serif SC", serif, sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(`${item.icon || "💖"} ${item.title || "契约纪念日"}`, photoX + 10, textStartY);

      // 日期与阶段徽章
      const stageBadge = window.AnniversaryEngine
        ? window.AnniversaryEngine.getAnniversaryStageBadge(metrics?.pastYears || metrics?.years || 0)
        : (item.tag || "恒久契约");
      ctx.fillStyle = "#d97706";
      ctx.font = 'bold 22px "Songti SC", "STSong", serif';
      ctx.fillText(`✨ ${stageBadge} · ${item.date}${metrics?.formattedLunarDate ? ` (${metrics.formattedLunarDate})` : ""}`, photoX + 10, textStartY + 42);

      // 巨幅天数
      const daysNum = metrics?.mode === "countup" ? (metrics?.totalDays || 0) : (metrics?.daysRemaining || 0);
      const daysLabel = metrics?.mode === "countup" ? "同行天数" : (metrics?.isToday ? "正是今天" : "倒数天数");

      ctx.save();
      ctx.fillStyle = "#9f1239";
      ctx.font = 'bold 64px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = "right";
      ctx.fillText(`${daysNum}`, photoX + photoW - 10, textStartY + 36);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(daysLabel, photoX + photoW - 10, textStartY + 68);
      ctx.restore();

      // C. 专属情书留言多行排版
      if (item.memo) {
        ctx.save();
        ctx.fillStyle = "rgba(244, 63, 94, 0.06)";
        ctx.fillRect(photoX + 6, textStartY + 90, photoW - 12, 180);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
        ctx.strokeRect(photoX + 6, textStartY + 90, photoW - 12, 180);

        ctx.fillStyle = "#374151";
        ctx.font = 'italic 22px "Songti SC", "STSong", serif';
        ctx.textAlign = "left";
        this.drawWrappedText(ctx, `“ ${item.memo} ”`, photoX + 24, textStartY + 135, photoW - 48, 38, 3);
        ctx.restore();
      }

      ctx.restore();

      // 4. 底部二维码直达区
      const rawDomainUrl = window.location.href.split("#")[0].split("?")[0];
      const displayHostname = this.decodePunycodeHost(window.location.hostname);
      const displayDomainUrl = rawDomainUrl.replace(window.location.hostname, displayHostname);

      const qrBoxX = 100;
      const qrBoxY = 1200;
      const qrBoxW = 880;
      const qrBoxH = 200;

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 2;
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
      ctx.strokeRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);

      this.drawDomainQrCode(ctx, 130, 1220, 160, rawDomainUrl);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("扫码直达我们的专属时空", 320, 1275);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "20px sans-serif";
      ctx.fillText(`🔗 ${displayDomainUrl.replace(/^https?:\/\//, "")}`, 320, 1320);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px sans-serif";
      ctx.fillText("微信 / 相机扫一扫 · 见证一生一世的爱情契约", 320, 1360);
      ctx.restore();

      // 5. 底部版权标记
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ 众水不能熄灭爱情，大水不能淹没 · LOVE UNIVERSE ✨", 540, 1460);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      this.currentPosterDataUrl = dataUrl;
      return dataUrl;
    }

    /**
     * 3. 弹出海报预览弹窗
     */
    showPosterModal(dataUrl) {
      const modal = document.getElementById("single-poster-modal");
      const previewBox = document.getElementById("single-poster-preview-box");
      if (modal && previewBox) {
        previewBox.innerHTML = `<img src="${dataUrl}" style="width:100%; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.5);" alt="卡片海报预览" />`;
        modal.style.display = "flex";
      }
    }
  }

  global.AnniversaryTools = new AnniversaryToolsCore();
})(typeof window !== "undefined" ? window : globalThis);
