// =============================================================
// 后端配额/tier 行为测试：存储配额强约束 + 档位升级码解析 + 配额视图
// 运行: node tests/worker-quota-tier.behavior.test.mjs
// 说明: 复用与 _worker.js 完全一致的 TIER_QUOTA / TIER_UPGRADE_CODES /
//       buildLicenseCode / resolveUpgradeTier / readQuota / writeQuota /
//       buildQuotaView / upload 配额校验 契约逻辑（含真实 WebCrypto HMAC）。
//       用内存版 fake bucket 断言。若重构后端此处代码，本测试需同步。
// =============================================================
import assert from 'node:assert/strict';

const MASTER_LICENSE_SECRET = "SACRED_UNQUENCHABLE_LOVE_2026_KEY";

// —— 复刻 _worker.js 常量 ——
const TIER_QUOTA = {
  basic:    { storageBytes: 50 * 1024 * 1024, maxFileBytes: 3 * 1024 * 1024 },
  standard: { storageBytes: 500 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024 },
  premium:  { storageBytes: 2 * 1024 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024 },
  flagship: { storageBytes: 5 * 1024 * 1024 * 1024, maxFileBytes: 50 * 1024 * 1024 },
};
const TIER_UPGRADE_CODES = { standard: "STANDARD_UPGRADE", premium: "PREMIUM_UPGRADE", flagship: "FLAGSHIP_UPGRADE" };
const TIER_RANK = { basic: 0, standard: 1, premium: 2, flagship: 3 };

// —— 复刻 HMAC 发码 / 解析 ——
async function buildLicenseCode(domain, suffix) {
  const enc = new TextEncoder();
  const keyData = enc.encode(MASTER_LICENSE_SECRET);
  const cipher = globalThis.crypto || (await import('node:crypto')).webcrypto;
  const cryptoKey = await cipher.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await cipher.subtle.sign("HMAC", cryptoKey, enc.encode(`${domain.toLowerCase()}:${suffix}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `LV-${hex.substring(0,4)}-${hex.substring(4,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}`;
}

async function resolveUpgradeTier(domain, inputCode) {
  try {
    const cleanCode = String(inputCode || "").trim().toUpperCase();
    if (!cleanCode.startsWith("LV-")) return null;
    for (const tierKey of Object.keys(TIER_UPGRADE_CODES)) {
      const expected = await buildLicenseCode(domain, TIER_UPGRADE_CODES[tierKey]);
      if (cleanCode === expected) return tierKey;
    }
  } catch (_) {}
  return null;
}
async function verifyDomainLicense(domain, inputCode) {
  try {
    const cleanCode = String(inputCode || "").trim().toUpperCase();
    if (!cleanCode.startsWith("LV-")) return false;
    return cleanCode === (await buildLicenseCode(domain, "SACRED_ETERNAL_LICENSE"));
  } catch (_) { return false; }
}

function makeBucket(rawHost) {
  const QUOTA_KEY = `${rawHost}/quota.json`;
  const store = new Map();
  return {
    QUOTA_KEY, store,
    async get(key) { const v = store.get(key); return v ? { async text() { return v; } } : null; },
    async put(key, value) { store.set(key, typeof value === "string" ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); },
  };
}

// —— 复刻 _worker.js 配额读写 + 视图 ——
async function readQuota(bucket) {
  try {
    const obj = await bucket.get(bucket.QUOTA_KEY);
    if (obj) { const q = JSON.parse(await obj.text()); return { tier: (q && q.tier && TIER_QUOTA[q.tier]) ? q.tier : "basic", usedBytes: (q && typeof q.usedBytes === "number") ? q.usedBytes : 0, updatedAt: (q && q.updatedAt) || null }; }
  } catch (_) {}
  return { tier: "basic", usedBytes: 0, updatedAt: null };
}
async function writeQuota(bucket, quota) { await bucket.put(bucket.QUOTA_KEY, JSON.stringify(quota)); }

async function buildQuotaView(bucket) {
  const q = await readQuota(bucket);
  const tier = (q && q.tier && TIER_QUOTA[q.tier]) ? q.tier : "basic";
  const limit = TIER_QUOTA[tier].storageBytes;
  const used = (q && typeof q.usedBytes === "number") ? q.usedBytes : 0;
  const percent = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
  return { tier, usedBytes: used, percent, full: used >= limit };
}

// —— 复刻 upload 配额校验核心（返回 {ok, code, usedBytes, tier}） ——
async function uploadWithQuota(bucket, { name, size }) {
  const quota = await readQuota(bucket);
  const tier = (quota && quota.tier && TIER_QUOTA[quota.tier]) ? quota.tier : "basic";
  const tierConf = TIER_QUOTA[tier];
  const fileSize = size || 0;
  if (tierConf.maxFileBytes && fileSize > tierConf.maxFileBytes) return { ok: false, code: "FILE_TOO_LARGE", tier };
  const usedBefore = (quota && typeof quota.usedBytes === "number") ? quota.usedBytes : 0;
  if (usedBefore + fileSize > tierConf.storageBytes) return { ok: false, code: "STORAGE_FULL", tier };
  await writeQuota(bucket, { tier, usedBytes: usedBefore + fileSize, updatedAt: new Date().toISOString() });
  return { ok: true, code: "OK", usedBytes: usedBefore + fileSize, tier };
}

// —— 复刻 verify-license tier 升级核心 ——
async function activateWithTier(bucket, rawHost, code) {
  const validBase = await verifyDomainLicense(rawHost, code);
  const upgradeTier = await resolveUpgradeTier(rawHost, code);
  if (!validBase && !upgradeTier) return { ok: false };
  let quota = await readQuota(bucket);
  let finalTier = (quota && quota.tier && TIER_QUOTA[quota.tier]) ? quota.tier : "basic";
  if (upgradeTier) { if (TIER_RANK[upgradeTier] > TIER_RANK[finalTier]) finalTier = upgradeTier; }
  else if (TIER_RANK[finalTier] < TIER_RANK.standard) finalTier = "standard";
  await writeQuota(bucket, { tier: finalTier, usedBytes: (quota && typeof quota.usedBytes === "number") ? quota.usedBytes : 0, updatedAt: new Date().toISOString() });
  return { ok: true, tier: finalTier, upgradeTier };
}

let passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log("  ✓", name); } catch (e) { failed++; console.error("  ✗", name, "\n    ", e.message); } }

console.log("\n[1] 基础激活码/升级码的 HMAC 生成与解析");
{
  const host = "love.domain.com";
  const base = await buildLicenseCode(host, "SACRED_ETERNAL_LICENSE");
  const std = await buildLicenseCode(host, TIER_UPGRADE_CODES.standard);
  await check("基础激活码被 verifyDomainLicense 识别", async () => assert.equal(await verifyDomainLicense(host, base), true));
  await check("标准档升级码不被误认为基础激活", async () => assert.equal(await verifyDomainLicense(host, std), false));
  await check("升级码解析出 standard", async () => assert.equal(await resolveUpgradeTier(host, std), "standard"));
  await check("无效码 -> null", async () => assert.equal(await resolveUpgradeTier(host, "LV-0000-0000-0000-0000"), null));
}

console.log("\n[2] 基础激活 => 配额升至 standard（PRO 起步）");
{
  const bucket = makeBucket("fresh.site");
  const base = await buildLicenseCode("fresh.site", "SACRED_ETERNAL_LICENSE");
  await check("激活后 tier=standard", async () => { const r = await activateWithTier(bucket, "fresh.site", base); assert.equal(r.ok, true); assert.equal(r.tier, "standard"); });
}

console.log("\n[3] 升级码自动升级配额");
{
  const bucket = makeBucket("up.site");
  const prem = await buildLicenseCode("up.site", TIER_UPGRADE_CODES.premium);
  await check("premium 升级码 -> tier=premium", async () => { const r = await activateWithTier(bucket, "up.site", prem); assert.equal(r.ok, true); assert.equal(r.tier, "premium"); });
}

console.log("\n[4] 只升不降：低档不覆盖高档");
{
  const bucket = makeBucket("nosite.com");
  const prem = await buildLicenseCode("nosite.com", TIER_UPGRADE_CODES.premium);
  await activateWithTier(bucket, "nosite.com", prem);
  const std = await buildLicenseCode("nosite.com", TIER_UPGRADE_CODES.standard);
  await check("已是 premium 再输 standard 码，tier 保持 premium", async () => { const r = await activateWithTier(bucket, "nosite.com", std); assert.equal(r.tier, "premium"); });
}

console.log("\n[5] upload 单文件上限兜底（FILE_TOO_LARGE）");
{
  const bucket = makeBucket("filebig.com");
  await writeQuota(bucket, { tier: "basic", usedBytes: 0, updatedAt: null });
  await check("basic 上传 2MB 通过", async () => { const r = await uploadWithQuota(bucket, { name: "a.jpg", size: 2 * 1024 * 1024 }); assert.equal(r.ok, true); });
  await check("basic 上传 3.5MB 被 FILE_TOO_LARGE 拦截", async () => { const r = await uploadWithQuota(bucket, { name: "big.jpg", size: 3.5 * 1024 * 1024 }); assert.equal(r.ok, false); assert.equal(r.code, "FILE_TOO_LARGE"); });
}

console.log("\n[6] upload 存储满额（STORAGE_FULL）");
{
  const bucket = makeBucket("full.com");
  await writeQuota(bucket, { tier: "basic", usedBytes: (49 * 1024 * 1024), updatedAt: null }); // 49/50MB
  await check("剩余不足时上传 2MB 被 STORAGE_FULL 拦截", async () => { const r = await uploadWithQuota(bucket, { name: "x.jpg", size: 2 * 1024 * 1024 }); assert.equal(r.ok, false); assert.equal(r.code, "STORAGE_FULL"); });
}
{
  const bucket = makeBucket("ok.com");
  await writeQuota(bucket, { tier: "standard", usedBytes: 400 * 1024 * 1024, updatedAt: null }); // 400/500MB
  // standard 单文件上限 10MB，故用 5MB 验证累计记账不违反单文件限制
  await check("standard 上传 5MB 通过且累计到 405MB", async () => { const r = await uploadWithQuota(bucket, { name: "y.jpg", size: 5 * 1024 * 1024 }); assert.equal(r.ok, true); assert.equal(r.usedBytes, 405 * 1024 * 1024); });
  // single-file limit applies per tier: standard maxFileBytes=10MB
  await check("standard 上传 12MB 被 FILE_TOO_LARGE 拦截", async () => { const r = await uploadWithQuota(bucket, { name: "big.jpg", size: 12 * 1024 * 1024 }); assert.equal(r.ok, false); assert.equal(r.code, "FILE_TOO_LARGE"); });
}

console.log("\n[7] 配额视图 不暴露精确上限（仅 percent/full/usedBytes/tier）");
{
  const bucket = makeBucket("view.com");
  await writeQuota(bucket, { tier: "standard", usedBytes: 250 * 1024 * 1024, updatedAt: null });
  const v = await buildQuotaView(bucket);
  await check("percent=50, full=false, tier=standard", async () => { assert.equal(v.tier, "standard"); assert.equal(v.percent, 50); assert.equal(v.full, false); });
  await check("不包含 storageBytes/limit 字段", async () => { assert.equal("storageBytes" in v, false); assert.equal("limit" in v, false); });
  await writeQuota(bucket, { tier: "standard", usedBytes: 500 * 1024 * 1024, updatedAt: null });
  await check("used=limit 时 full=true", async () => { const v2 = await buildQuotaView(bucket); assert.equal(v2.full, true); });
}

console.log("\n[8] 全新租户：默认 basic 配额视图");
{
  const bucket = makeBucket("brandnew.com");
  const v = await buildQuotaView(bucket);
  await check("tier=basic, usedBytes=0, full=false", async () => { assert.equal(v.tier, "basic"); assert.equal(v.usedBytes, 0); assert.equal(v.full, false); });
}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===\n`);
process.exit(failed ? 1 : 0);
