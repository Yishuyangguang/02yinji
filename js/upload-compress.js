/**
 * 众水不灭 · 雅歌之印
 * 文件: js/upload-compress.js
 * 作用: 上传前在浏览器端对图片做无损到高保真压缩（canvas），
 *       让大文件在进入 R2 前先被压到当前套餐单文件上限内，从而：
 *       1) 基础版也能上传 10MB 高清照片（被压进 3MB 内）；
 *       2) 节省 R2 存储用量（更耐用）；
 *       3) 减小上传体积，节省 Worker/Class A 写入开销。
 * 说明: 仅压缩图片；非图片或解码失败时原样透传，由服务端兜底校验。
 */

(function (global) {
  "use strict";

  // 按档位分级的压缩参数（与服务端 TIER_QUOTA 对齐）
  const TIER_COMPRESS = {
    basic:    { maxEdge: 1600, quality: 0.80 },
    standard: { maxEdge: 1920, quality: 0.85 },
    premium:  { maxEdge: 2560, quality: 0.90 },
    flagship: { maxEdge: 4096, quality: 0.95 },
  };

  function isImageFile(file) {
    return file && typeof file.type === "string" && file.type.indexOf("image/") === 0;
  }

  // 读取 File → 位图（跨浏览器兼容回调）
  function readBitmap(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file).catch(function () {
        return new Promise(function (resolve, reject) {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
          img.src = url;
        });
      });
    }
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  /**
   * 压缩图片到目标体积附近。
   * @param {File} file          原始文件
   * @param {object} opts        { tier, maxBytes, maxEdge, quality }
   * @returns {Promise<File|Blob>} 压缩后的文件；无法压缩时返回原文件
   */
  async function compressImage(file, opts) {
    opts = opts || {};
    if (!isImageFile(file)) return file;
    const tier = (opts.tier && TIER_COMPRESS[opts.tier]) ? opts.tier : "basic";
    const conf = TIER_COMPRESS[tier];
    const maxEdge = opts.maxEdge || conf.maxEdge;
    let quality = (typeof opts.quality === "number") ? opts.quality : conf.quality;
    const maxBytes = opts.maxBytes || Infinity;

    try {
      const bitmap = await readBitmap(file);
      const ratio = Math.min(1, maxEdge / Math.max(bitmap.width || 1, bitmap.height || 1));
      const w = Math.max(1, Math.round((bitmap.width || 1) * ratio));
      const h = Math.max(1, Math.round((bitmap.height || 1) * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      if (bitmap.close) { try { bitmap.close(); } catch (_) {} }

      // 优先 WebP，退回 JPEG（逐次降档质量，最多 2 次，直到落在 maxBytes 内）
      let blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!blob || blob.size === 0) blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob || blob.size === 0) return file;
      if (blob.size > maxBytes) {
        const q2 = Math.max(0.5, quality - 0.15);
        let blob2 = await canvasToBlob(canvas, "image/webp", q2);
        if (!blob2 || blob2.size === 0) blob2 = await canvasToBlob(canvas, "image/jpeg", q2);
        if (blob2 && blob2.size > 0 && blob2.size < blob.size) blob = blob2;
      }

      const outName = (file.name || "photo").replace(/\.\w+$/, "") + (blob.type === "image/png" ? ".png" : ".webp");
      if (typeof File !== "undefined") return new File([blob], outName, { type: blob.type || "image/webp" });
      return blob;
    } catch (_) {
      return file;
    }
  }

  // 快速估算（上传条/提示用）：按当前档位返回目标上限
  function getTierCompressConfig(tier) {
    return TIER_COMPRESS[tier] || TIER_COMPRESS.basic;
  }

  global.LoveUploadCompress = {
    compressImage: compressImage,
    getTierCompressConfig: getTierCompressConfig,
    TIER_COMPRESS: TIER_COMPRESS,
    isImageFile: isImageFile,
  };
})(typeof window !== "undefined" ? window : globalThis);
