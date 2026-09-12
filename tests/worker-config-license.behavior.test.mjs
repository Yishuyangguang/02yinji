// =============================================================
// 后端安全修复：/api/love/config POST 授权注入绕过 的行为测试
// 运行: node tests/worker-config-license.behavior.test.mjs
// 说明: 直接复用与 _worker.js 完全一致的“剥除 + 条件恢复”逻辑，
//       用内存版 fake bucket 断言契约。若后续重构此处代码，本测试需同步。
// =============================================================
import assert from 'node:assert/strict';

function buildHandler(rawHost) {
  const CONFIG_KEY = `${rawHost}/config.json`;
  const store = new Map(); // key -> string

  function makeBucket() {
    return {
      async get(key) {
        const v = store.get(key);
        if (!v) return null;
        return { async text() { return v; } };
      },
      async put(key, value) {
        store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      },
      async delete(key) { store.delete(key); },
    };
  }

  // 复刻 _worker.js 中已加固的 config POST 核心逻辑
  async function sanitizeConfigSave(configToSave, bucket) {
    delete configToSave._license;
    try {
      const existingObj = await bucket.get(CONFIG_KEY);
      if (existingObj) {
        const oldCfg = JSON.parse(await existingObj.text());
        if (oldCfg._license && oldCfg._license.unlocked && oldCfg._license.boundDomain === rawHost) {
          configToSave._license = oldCfg._license;
        }
        if (oldCfg.petData && !configToSave.petData) configToSave.petData = oldCfg.petData;
      }
    } catch (_) {}
    await bucket.put(CONFIG_KEY, JSON.stringify(configToSave));
    return configToSave;
  }

  return { makeBucket, sanitizeConfigSave, store };
}

let passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.error('  ✗', name, '\n    ', e.message); }
}

console.log('\n[1] 未授权注入绕过：前端上传的 _license 必须被剥除');
{
  const { makeBucket, sanitizeConfigSave } = buildHandler('marry.love.test');
  const bucket = makeBucket();
  let saved;
  await check('非法注入 _license 被移除', async () => {
    const cfg = { theme: 'aurora', _license: { unlocked: true, tier: 'HACKED' } };
    saved = await sanitizeConfigSave(cfg, bucket);
    assert.equal(saved._license, undefined, '注入的 _license 应被删除');
  });
  await check('其余配置字段保留', async () => {
    assert.equal(saved.theme, 'aurora');
  });
}

console.log('\n[2] 已激活租户升级/覆盖配置：授权应被恢复(不丢数据)');
{
  const { makeBucket, sanitizeConfigSave, store } = buildHandler('love.domain.com');
  const bucket = makeBucket();
  store.set('love.domain.com/config.json', JSON.stringify({
    _license: { unlocked: true, unlockedAt: '2026-01-01T00:00:00Z', tier: 'SACRED_ETERNAL_PERPETUAL', boundDomain: 'love.domain.com' },
    petData: { name: '灵鸽' },
  }));
  let saved;
  await check('同域名已激活：前端覆盖配置后授权保留', async () => {
    const cfg = { theme: 'rose', petData: { name: 'new' } };
    saved = await sanitizeConfigSave(cfg, bucket);
    assert.equal(saved._license.unlocked, true);
    assert.equal(saved._license.boundDomain, 'love.domain.com');
  });
  // 独立 store 验证 petData 保留契约（避免被上一断言写入的数据污染）
  const { makeBucket: mk2, sanitizeConfigSave: sc2, store: st2 } = buildHandler('love.domain.com');
  st2.set('love.domain.com/config.json', JSON.stringify({ petData: { name: '灵鸽' } }));
  const bucket2 = mk2();
  await check('未提供的 petData 从旧配置恢复', async () => {
    const s2 = await sc2({ theme: 'rose' }, bucket2);
    assert.equal(s2.petData.name, '灵鸽');
  });
}

console.log('\n[3] 跨域绑定：即使旧配置激活,但绑定域名不同也不得冒用');
{
  const { makeBucket, sanitizeConfigSave, store } = buildHandler('other.evil.com');
  const bucket = makeBucket();
  store.set('other.evil.com/config.json', JSON.stringify({
    _license: { unlocked: true, boundDomain: 'legit.victim.com' },
  }));
  let saved;
  await check('绑定的域名不一致 -> 授权不恢复', async () => {
    saved = await sanitizeConfigSave({ theme: 'x' }, bucket);
    assert.equal(saved._license, undefined);
  });
}

console.log('\n[4] 无任何历史配置：全新租户保存,无授权');
{
  const { makeBucket, sanitizeConfigSave } = buildHandler('fresh.site');
  const bucket = makeBucket();
  let saved;
  await check('全新租户保存 config 不产生授权字段', async () => {
    saved = await sanitizeConfigSave({ theme: 'mint' }, bucket);
    assert.equal(saved._license, undefined);
  });
}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===\n`);
process.exit(failed ? 1 : 0);
