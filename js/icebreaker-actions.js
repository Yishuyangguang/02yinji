/**
 * icebreaker-actions.js — 破冰和解信号的纯逻辑层（单一数据源）。
 *
 * 这是前后端共用的「缝合点」：发送端用它把所点按钮的正文装进 customText，
 * 接收端用它解析该 actionType 的标题/图标/正文。所有判断不依赖 DOM，
 * 可在 Node 中直接单测。
 *
 * 背景 bug：发送端曾固定发 customText:""，后端 getStageSafeContent 因不识别
 * 真实 action id（d_1/e_1/m_1）而回落到 break_ice 分支，永远返回
 * “今天天气很好……散散步。”，导致“点击按钮 A，对方却收到固定文案”的不匹配。
 * 本模块确保发送什么，接收端就显示那个按钮的真实标题与正文。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LOVE_ICE_ACTIONS = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FALLBACK_META = {
    label: "温情信笺",
    icon: "💌",
    desc: "对方发来了一封破冰信笺，希望能和你和好。"
  };

  /**
   * 在全量动作字典里按 actionType 查找动作元数据。
   * @param {{[stage:string]: Array<{type:string,label:string,icon:string,desc:string}>}} actions
   * @param {string} actionType
   */
  function resolveActionMeta(actions, actionType) {
    if (!actions || !actionType) return FALLBACK_META;
    for (var stageKey in actions) {
      if (Object.prototype.hasOwnProperty.call(actions, stageKey) && Array.isArray(actions[stageKey])) {
        var list = actions[stageKey];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].type === actionType) {
            return list[i];
          }
        }
      }
    }
    return FALLBACK_META;
  }

  /**
   * 构造发送端提交给 /api/love/signal 的载荷。
   * 让 customText 携带所点按钮的真实正文，从而后端透传、接收端按按钮显示对应内容。
   */
  function buildSignalPayload(config, opts) {
    opts = opts || {};
    var actions = (config && config.icebreaker && config.icebreaker.actions) || {};
    var fallbackPhase = (config && config.lifecycle && config.lifecycle.currentPhase) || "dating";
    var meta = resolveActionMeta(actions, opts.actionType);
    return {
      stage: opts.stage || fallbackPhase,
      senderGender: opts.senderGender || "boy",
      senderDeviceId: opts.senderDeviceId || "",
      actionType: opts.actionType,
      customText: (meta && meta.desc ? meta.desc : "").trim()
    };
  }

  return {
    FALLBACK_META: FALLBACK_META,
    resolveActionMeta: resolveActionMeta,
    buildSignalPayload: buildSignalPayload
  };
});
