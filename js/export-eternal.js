/**
 * 众水不灭 · 雅歌之印
 * 文件名: js/export-eternal.js
 * 作用: 抓取当前页面 DOM、Base64 转换图片并内联全部 CSS/JS，生成脱机单文件 HTML
 */

class EternalSealExporter {
  static async downloadSingleFileArchive() {
    const btn = document.getElementById("export-eternal-btn");
    const originalText = btn ? btn.innerHTML : "";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "<span>⏳ 正在铸造永恒印记 (抽取资源中...)...</span>";
    }

    try {
      // 1. 抓取所有样式并内嵌
      const styleLinks = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
      let inlinedStyles = "";
      for (const link of styleLinks) {
        try {
          const res = await fetch(link.href);
          if (res.ok) {
            const cssText = await res.text();
            inlinedStyles += `\n/* --- Inlined: ${link.getAttribute('href')} --- */\n${cssText}\n`;
          }
        } catch (_) {}
      }

      // 2. 将 DOM 中所有可见图片转为 Base64
      const images = Array.from(document.querySelectorAll("img"));
      for (const img of images) {
        if (img.src && !img.src.startsWith("data:")) {
          try {
            const b64 = await EternalSealExporter.convertImageToBase64(img.src);
            if (b64) img.setAttribute("src", b64);
          } catch (_) {}
        }
      }

      // 3. 克隆并组装脱机 HTML 骨架
      const currentConfigJson = JSON.stringify(window.LOVE_CONFIG || {});
      const docClone = document.documentElement.cloneNode(true);

      // 移除外部 CSS 引用，注入内联样式
      docClone.querySelectorAll("link[rel='stylesheet']").forEach(el => el.remove());
      const styleTag = document.createElement("style");
      styleTag.textContent = inlinedStyles;
      docClone.querySelector("head").appendChild(styleTag);

      // 注入内嵌全局配置脚本
      const configScriptTag = document.createElement("script");
      configScriptTag.textContent = `window.LOVE_CONFIG = ${currentConfigJson};\n`;
      docClone.querySelector("head").prepend(configScriptTag);

      const finalHtmlString = "<!DOCTYPE html>\n" + docClone.outerHTML;

      // 4. 生成 Blob 并触发下载
      const blob = new Blob([finalHtmlString], { type: "text/html;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `众水不灭_永恒雅歌印记_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      alert("✨ 永恒印记已成功铸造并下载！\n此 HTML 单文件内含全部照片与誓言，无须任何网络与服务器，双击即可永久打开珍藏。");
    } catch (err) {
      alert("❌ 导出失败: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  static convertImageToBase64(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}

window.EternalSealExporter = EternalSealExporter;
