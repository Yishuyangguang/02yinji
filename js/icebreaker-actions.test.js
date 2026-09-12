"use strict";
const test = require("node:test");
const assert = require("node:assert");

// config.js 通过 window.LOVE_CONFIG 暴露全站配置。
global.window = {};
require("../js/config.js");
const LOVE = require("../js/icebreaker-actions.js");

const actions = global.window.LOVE_CONFIG.icebreaker.actions;

// 后端 _worker.js 的校验正则（与源码一致，用于安全回归断言）。
const PROFANITY = /(约炮|包养|出轨|偷情|小三|色情|裸聊|淫秽|性交|做爱|操你|傻逼|贱人|去死|滚蛋|妓女|嫖娼|嫖客|大保健|开房|一夜情)/i;
const DATING_FORBID = /(同居|睡觉|同房|开房|上床|床头|我家|你家|家里|做饭|切水果|洗碗|家务|同睡|书房)/i;
const HARDCODED_FALLBACK = "今天天气很好，我们不吵了好不好？待会儿一起去散散步。";

test("配置字典完整性：三个阶段均有动作，且每个动作有 type/label/icon/desc", () => {
  assert.ok(actions, "config.js 应暴露 icebreaker.actions");
  assert.ok(actions.dating && actions.dating.length > 0, "dating 阶段应有动作");
  assert.ok(actions.engaged && actions.engaged.length > 0, "engaged 阶段应有动作");
  assert.ok(actions.married && actions.married.length > 0, "married 阶段应有动作");

  let count = 0;
  for (const stage of Object.keys(actions)) {
    for (const a of actions[stage]) {
      count++;
      assert.ok(a.type, `${stage} 动作缺少 type`);
      assert.ok(a.label, `${stage}/${a.id} 缺少 label`);
      assert.ok(a.icon, `${stage}/${a.id} 缺少 icon`);
      assert.ok(a.desc, `${stage}/${a.id} 缺少 desc`);
    }
  }
  assert.strictEqual(count, 28, "总共应有 28 个破冰动作");
});

test("核心场景：点击每个按钮 → resolveActionMeta 返回该按钮自身的 meta（标题/图标/正文）", () => {
  for (const stage of Object.keys(actions)) {
    for (const a of actions[stage]) {
      const meta = LOVE.resolveActionMeta(actions, a.type);
      assert.strictEqual(meta.label, a.label, `${a.type} 标题应一致`);
      assert.strictEqual(meta.icon, a.icon, `${a.type} 图标应一致`);
      assert.strictEqual(meta.desc, a.desc, `${a.type} 正文应一致`);
    }
  }
});

test("核心场景：发送端载荷 customText = 所点按钮的真实正文，绝不落回固定文案", () => {
  for (const stage of Object.keys(actions)) {
    for (const a of actions[stage]) {
      const payload = LOVE.buildSignalPayload(global.window.LOVE_CONFIG, {
        stage,
        senderGender: "girl",
        senderDeviceId: "dev-test",
        actionType: a.type,
      });
      assert.strictEqual(payload.actionType, a.type, "actionType 应透传");
      assert.strictEqual(payload.customText, a.desc, `${a.type} customText 应等于该按钮正文`);
      assert.notStrictEqual(payload.customText, HARDCODED_FALLBACK,
        `${a.type} 不应发送写死的"散散步"固定文案`);
    }
  }
});

test("回归：任何已知按钮都不应产出写死的“今天天气很好……散散步。”", () => {
  for (const stage of Object.keys(actions)) {
    for (const a of actions[stage]) {
      const meta = LOVE.resolveActionMeta(actions, a.type);
      assert.notStrictEqual(meta.desc, HARDCODED_FALLBACK, `${a.type} 不应命中写死文案`);
    }
  }
});

test("安全性：所有动作正文应 ≤150 字且不与后端校验正则冲突", () => {
  for (const stage of Object.keys(actions)) {
    for (const a of actions[stage]) {
      const len = [...a.desc].length; // 按码点计长
      assert.ok(len <= 150, `${a.type} 正文长度 ${len} 超过 150`);
      assert.ok(!PROFANITY.test(a.desc), `${a.type} 命中不洁词正则`);
      if (stage === "dating") {
        assert.ok(!DATING_FORBID.test(a.desc), `${a.type} 命中 dating 禁用词正则`);
      }
    }
  }
});

test("兜底：未知 actionType 返回温情信笺兜底 meta 且不崩溃", () => {
  const meta = LOVE.resolveActionMeta(actions, "no_such_action");
  assert.strictEqual(meta.label, LOVE.FALLBACK_META.label);
  assert.strictEqual(meta.icon, LOVE.FALLBACK_META.icon);
  assert.ok(meta.desc && meta.desc.length > 0, "兜底正文不应为空");

  const payload = LOVE.buildSignalPayload(global.window.LOVE_CONFIG, {
    stage: "dating",
    actionType: "no_such_action",
  });
  assert.strictEqual(payload.customText, meta.desc, "未知按钮也应发出一条非空信笺");
});

test("缺省保护：空配置/缺动作时不崩溃，用默认阶段 dating", () => {
  const payload = LOVE.buildSignalPayload({}, { actionType: "d_1" });
  assert.strictEqual(payload.stage, "dating");
  assert.strictEqual(payload.customText, LOVE.FALLBACK_META.desc, "无配置时使用兜底正文");

  const payload2 = LOVE.buildSignalPayload(null, {});
  assert.strictEqual(payload2.stage, "dating");
  assert.strictEqual(payload2.actionType, undefined);
  assert.strictEqual(payload2.customText, LOVE.FALLBACK_META.desc);
});

test("阶段透传：payload 正确携带当前阶段与发送方信息", () => {
  const payload = LOVE.buildSignalPayload(global.window.LOVE_CONFIG, {
    stage: "engaged",
    senderGender: "boy",
    senderDeviceId: "dev-boy",
    actionType: "e_1",
  });
  assert.strictEqual(payload.stage, "engaged");
  assert.strictEqual(payload.senderGender, "boy");
  assert.strictEqual(payload.senderDeviceId, "dev-boy");
});
