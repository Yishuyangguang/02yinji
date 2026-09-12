/**
 * 众水不灭 · 雅歌之印 (Love Universe SaaS Engine)
 * 文件名: _worker.js
 * 架构: 异步静默垃圾回收 + 破冰白名单 + 严格租户独立鉴权 + 独立日记应用 API + CD-Key短密钥高科授权
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const bucket = env.R2 || env.BUCKET || env.PAN || env.MY_BUCKET || env.FILE_BUCKET;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-auth, x-member-token, Range",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    };
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    function jsonResponse(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const rawHost = (url.hostname || "default.local").toLowerCase();
    const tenantDir = rawHost.replace(/[^a-z0-9.-]/g, "_");
    const CONFIG_KEY = `${tenantDir}/config.json`;
    const SIGNALS_KEY = `${tenantDir}/signals.json`;
    const QUOTA_KEY = `${tenantDir}/quota.json`;

    const ADMIN_PASSWORD = String(env.ADMIN_PASSWORD || env.SECRET_PWD || env.ADMIN_PWD || "").trim();
    const MASTER_LICENSE_SECRET = String(env.MASTER_LICENSE_SECRET || "SACRED_UNQUENCHABLE_LOVE_2026_KEY").trim();

    // 🌟 商业套餐容量精准定义 (严格对齐 365MB 与 520MB 商业规划)
    const TIER_QUOTA = {
      basic:    { storageBytes: 50 * 1024 * 1024, maxFileBytes: 3 * 1024 * 1024 },       // 基础免费版: 50MB (单文件3MB)
      luxury:   { storageBytes: 365 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024 },     // PRO 豪华版: 365MB (单文件10MB)
      flagship: { storageBytes: 520 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024 }      // PRO 旗舰版: 520MB (单文件20MB)
    };

    async function verifyAdminAuth(req) {
      const headerAuth = req.headers.get("x-admin-auth") || req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const queryAuth = url.searchParams.get("auth");
      const token = (headerAuth || queryAuth || "").trim();
      if (!token) return false;

      // 🌟 [新增] 全局验证万能救援密钥，保障登录后的后续保存接口权限畅通
      if (env.MASTER_RESCUE_KEY && token === String(env.MASTER_RESCUE_KEY).trim()) {
        return true;
      }

      if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD !== "521" && token === String(env.ADMIN_PASSWORD).trim()) {
        return true;
      }

      if (bucket) {
        try {
          const obj = await bucket.get(CONFIG_KEY);
          if (obj) {
            const cfg = JSON.parse(await obj.text());
            if (cfg.adminSecurity && cfg.adminSecurity.password && cfg.adminSecurity.password.trim() !== "") {
              if (token === String(cfg.adminSecurity.password).trim()) return true;
              return false; 
            }
          }
        } catch (_) {}
      }

      if (token === "521") return true;

      return false;
    }

    function sanitizeSanctity(contentString) {
      const profanityRegex = /(约炮|包养|出轨|偷情|上床|小三|色情|裸聊|淫秽|性交|做爱|操你|傻逼|贱人|去死|滚蛋|开房)/i;
      return !profanityRegex.test(contentString);
    }

    function getStageSafeContent(stage, actionType, userCustomText) {
      const standardDict = {
        dating: {
          d_1: "我刚才情绪有点急，说话有些生硬，对不起。我不应该用那种态度对待你。比起争论谁对谁错，我更在乎你的感受。你愿意跟我说说你刚才最真实的想法吗？我一定安静听。",
          d_2: "今天一天没怎么联系你，知道你肯定特别忙，也挺辛苦的。我没有别的意思，就是下班了突然很想你，只想温和地跟你打个招呼。你忙完了再回我，记得按时吃饭。",
          d_3: "刚才冷战的时候，我心里挺不好受的。我不想为了虚无的面子让我们越走越远。我们先不去想刚才的分歧，今晚去吃你最爱吃的那家店，让我们重新暖和起来，好吗？",
          d_4: "你刚才指出我的问题时，我第一反应是本能地想为自己辩解。后来我想了想，你是对的，我确实有没顾及到你的地方。谢谢你愿意对我坦诚，我想听听你现在的真实感受，这次我不打断你。",
          d_5: "今天工作上有点累，感觉能量都耗光了。我现在什么都不想理，只想安静听听你的声音，只要听到你说话，我就觉得特别踏实和治愈。",
          d_6: "今天我们来做个有温度的互动：我们轮流说一件对方最近做的、最让自己感到被爱或者感到踏实的小细节。不聊宏大的话题，只聊这些温暖的小事，我先开始好吗？",
          d_7: "看你这两天忙得不可开交，一定很辛苦。这条信息不用回，我就是想默默给你鼓个劲。按时吃饭，照顾好自己，等你不忙了，我随时都在。"
        },
        engaged: {
          e_1: "今天为了婚礼的筹备，我们两个人都有些紧绷和急躁了。这其实偏离了我们的初衷——我们要过的是一辈子，而不是仅仅为了这一天。今晚先把清单和预算放一边，我们去公园走走，只聊聊我们自己，好吗？",
          e_2: "最近我们满脑子都是流程和琐事，把生活都磨得太紧绷了。今晚我们给彼此放个假，不谈任何筹备细节和长辈意见。就点个外卖，安安静静看部搞笑电影，只享受我们两个人的时光。",
          e_3: "在刚才讨论的事情上，我太执着于‘按我的想法来’，没注意到自己的语气有些强硬。对不起，我不想用掌控的态度对待你。我想重新听听你背后的顾虑，这次我带着尊重来配合你。",
          e_4: "最近筹备的事情多，我把自己的焦虑和急躁无端发泄在你身上了，这很不应该。明明是我们一起在准备未来，我却让你承担了我的坏脾气。对不起，我会努力克制，谢谢你的包容。",
          e_5: "虽然面对两边家庭不同的习惯和要求挺不容易的，但只要一想到未来几十年，我们要一起面对人生所有的风雨，我心里就充满底气。有你做我的盟友，我什么都不怕。",
          e_6: "看到你因为要融入我的家庭、面对复杂的亲戚关系感到压力和焦虑，我心里特别心疼。我想告诉你，你不是一个人。有什么难沟通的事情，我会主动去协调和面对，我永远站在你这一边。",
          e_7: "我们来聊聊：等我们六七十岁，头发白了、戴着老花镜的时候，我们会怎么调侃今天这些让我们焦头烂额的筹备小事？一想到生命尽头依然有你陪着，现在这些琐碎都变得很有意义。"
        },
        married: {
          m_1: "刚才我没控制住情绪，说的话很伤人，现在想想特别自责。我给你倒了一杯温水，先喝口水。我知道你现在还在生气，我不急着为自己开脱，只想真诚地向你道歉：对不起，我伤害了你。",
          m_2: "我知道我们今天讨论的问题还没解决，你心里可能还没过去。但我不想今晚背对背冷战，我害怕我们心里的距离拉远。今晚你不用急着原谅我，但能不能让我轻轻握着你的手睡觉？",
          m_3: "每天的生活好像都被孩子、工作和账单塞满了，我们很久没有好好看看彼此了。今晚我不想聊家务，也不想聊压力，我只想好好看看你，对你说一声：谢谢你这些年的陪伴，我依然深深地依赖你。",
          m_4: "我们最近都太忙了，一回家就各忙各的，都快成同一屋檐下的舍友了。现在我想申请两分钟，我们把手机放下，也不聊家务繁琐，就安静地靠在一起、看着对方，好吗？",
          m_5: "我知道你在外面受委屈了，也面临了很大的压力。没关系的，就算世界对你再苛刻，或者真的把事情搞砸了，回到家，你不需要再硬撑着去扮演强者。这里是你随时可以卸下防备的避风港，有我陪你承担。",
          m_6: "今天我因为家里的各种琐事情绪失控，自己都觉得自己的脾气很难看。谢谢你刚才没有反驳我，而是温柔地接住了我的坏情绪。谢谢你的包容，在这个家里有你兜底，我真的很幸运。",
          m_7: "刚才看到你默默做家务，我心里特别温暖。谢谢你每天在这些琐碎、不易被察觉的细节里，默默爱着这个家。你为这个家所做的一切，我都看见了，辛苦了。",
          m_8: "事情已经发生了，你心里肯定比谁都自责和难过。不要再苛求自己了，钱财和损失都可以慢慢弥补，但你比这些都重要得多。只要我们两个人还坚定地站在一起，就没有迈不过去的坎。我们一起面对。",
          m_9: "看到你刚才的状态，我知道你今天真的是累到极点了。今晚照顾孩子、收拾屋子、准备明天东西的事情全交给我。你现在什么都不要操心了，去洗个热水澡，回房间躺一躺，今晚你先正式下班。",
          m_10: "今天在外面，我说话的态度有些不耐烦，甚至不合时宜地反驳了你，让你在外人面前难堪了。这很不尊重你，我心里非常愧疚。我应该永远做那个在外人面前最维护你、最支持你的人。对不起，请你原谅我。",
          m_11: "刚才我太陷在‘一定要争个对错’的态度里了，其实日子是两个人的，赢了争吵、输了感情，根本没有意义。我不想争了，在爱里没有输赢，我乐意向你认输。别生气了，我们和好吧。",
          m_12: "看你疲惫的样子，今天在外面一定受委屈或者经历难熬的事了。我不追问你，也不在这个时候打扰你。我给你倒了杯茶，你安安静静在沙发上躺一会儿。在家里你不需要紧绷，我会一直在你身边守着。",
          m_13: "因为生病，你这两天总觉得麻烦了我，一直小心翼翼地。千万不要这样想，婚姻的意义不就是在彼此最虚弱的时候，可以名正言顺、心甘情愿地去照顾对方吗？你安心养身体，有我在，你永远不是负担。",
          m_14: "今天又是极其平凡的一天。但我今晚临睡前就是想认真对你说一句：谢谢你愿意陪我组建这个家庭，谢谢你成为我每天睁眼和闭眼时看到的第一个人。生命里有你，我真的很知足。"
        }
      };
      
      const validStage = ["dating", "engaged", "married"].includes(stage) ? stage : "dating";
      
      let validAction = actionType;
      if (!standardDict[validStage][validAction]) {
        validAction = Object.keys(standardDict[validStage])[0];
      }
      
      const fallback = standardDict[validStage][validAction];
      
      if (userCustomText && typeof userCustomText === "string" && userCustomText.trim().length > 0) {
        const text = userCustomText.trim().slice(0, 150);
        if (validStage === "dating") {
          const forbiddenDatingRegex = /(同居|同房|开房)/i;
          if (forbiddenDatingRegex.test(text)) return fallback;
        }
        return text;
      }
      return fallback;
    }

    async function buildLicenseCode(domain, tierStr, secretKey) {
      const enc = new TextEncoder();
      const keyData = enc.encode(secretKey);
      const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const dataToSign = enc.encode(`${domain.toLowerCase()}:${tierStr}`);
      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataToSign);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const fullHex = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      return `LV-${fullHex.substring(0, 4)}-${fullHex.substring(4, 8)}-${fullHex.substring(8, 12)}-${fullHex.substring(12, 16)}`;
    }

    async function buildMemberToken(domain) {
      const enc = new TextEncoder();
      const keyData = enc.encode(MASTER_LICENSE_SECRET);
      const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(`${domain.toLowerCase()}:MEMBER_ACCESS`));
      return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    async function verifyMemberOrAdmin(req) {
      const headerAuth = req.headers.get("x-member-token") || req.headers.get("x-admin-auth") || req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const queryAuth = url.searchParams.get("mtoken");
      const token = (headerAuth || queryAuth || "").trim();
      
      if (!token) return null; 

      let expectedMember = null;
      try { expectedMember = await buildMemberToken(rawHost); } catch (_) {}
      if (expectedMember && token === expectedMember) return "member";

      const isAdmin = await verifyAdminAuth(req);
      if (isAdmin) return "admin";

      return null;
    }

    async function readQuota() {
      if (!bucket) return { tier: "basic", usedBytes: 0, updatedAt: null };
      try {
        const obj = await bucket.get(QUOTA_KEY);
        if (obj) {
          const q = JSON.parse(await obj.text());
          return {
            tier: (q && q.tier && TIER_QUOTA[q.tier]) ? q.tier : "basic",
            usedBytes: (q && typeof q.usedBytes === "number") ? q.usedBytes : 0,
            updatedAt: (q && q.updatedAt) || null,
          };
        }
      } catch (_) {}
      return { tier: "basic", usedBytes: 0, updatedAt: null };
    }

    async function writeQuota(quota) {
      if (!bucket) return;
      await bucket.put(QUOTA_KEY, JSON.stringify(quota), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    }

    async function buildQuotaView() {
      const q = await readQuota();
      const tier = (q && q.tier && TIER_QUOTA[q.tier]) ? q.tier : "basic";
      const limit = TIER_QUOTA[tier].storageBytes;
      const used = (q && typeof q.usedBytes === "number") ? q.usedBytes : 0;
      const percent = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
      return { tier, usedBytes: used, percent, full: used >= limit };
    }

    async function executeSilentGC(activeConfig) {
      try {
        const activeUrls = new Set();
        function extractUrls(node) {
          if (!node) return;
          if (typeof node === 'string') {
            if (node.includes(`/raw/${tenantDir}/assets/`)) activeUrls.add(node);
          } else if (typeof node === 'object') {
            for (const key in node) extractUrls(node[key]);
          }
        }
        extractUrls(activeConfig);

        const prefix = `${tenantDir}/assets/`;
        let listed = await bucket.list({ prefix });
        let truncated = listed.truncated;
        let cursor = listed.cursor;

        let realUsed = 0;
        do {
          for (const obj of listed.objects) {
            const fileUrl = `/raw/${obj.key}`;
            if (!activeUrls.has(fileUrl)) {
              const ageMinutes = (Date.now() - new Date(obj.uploaded).getTime()) / (1000 * 60);
              if (ageMinutes > 60) {
                await bucket.delete(obj.key);
              } else {
                realUsed += (obj.size || 0);
              }
            } else {
              realUsed += (obj.size || 0);
            }
          }
          if (truncated) {
            listed = await bucket.list({ prefix, cursor });
            truncated = listed.truncated;
            cursor = listed.cursor;
          } else {
            truncated = false;
          }
        } while (truncated);
        if (typeof realUsed === "number") {
          const q = await readQuota();
          await writeQuota({ tier: (q && q.tier) ? q.tier : "basic", usedBytes: realUsed, updatedAt: new Date().toISOString() });
        }
      } catch (err) {}
    }

    try {
      if (url.pathname === "/api/love/config" && request.method === "GET") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const isAdmin = await verifyAdminAuth(request);
        const headerAuth = request.headers.get("x-admin-auth");
        const queryAuth = url.searchParams.get("auth");
        const attemptedAuth = (headerAuth || queryAuth || "").trim();
        if (attemptedAuth && !isAdmin) {
          return jsonResponse({ success: false, error: "管理口令错误或未授权", isAdmin: false }, 401);
        }
        let customConfig = null;
        try {
          const obj = await bucket.get(CONFIG_KEY);
          if (obj) customConfig = JSON.parse(await obj.text());
        } catch (_) {}
        const quotaView = await buildQuotaView();
        if (customConfig) {
          if (!isAdmin) {
            if (customConfig.gatekeeper) delete customConfig.gatekeeper.correctAnswer;
            if (customConfig.adminSecurity) delete customConfig.adminSecurity.password;
          }
          return jsonResponse({ success: true, custom: true, domain: rawHost, config: customConfig, isAdmin, quota: quotaView });
        }
        return jsonResponse({ success: true, custom: false, domain: rawHost, config: null, isAdmin, quota: quotaView });
      }

      if (url.pathname === "/api/love/config" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const isAuthed = await verifyAdminAuth(request);
        if (!isAuthed) return jsonResponse({ success: false, error: "管理口令错误或未授权" }, 401);
        let reqData;
        try { reqData = await request.json(); } catch (_) { return jsonResponse({ success: false, error: "数据格式错误" }, 400); }
        const configToSave = reqData.config || {};
        const configJsonString = JSON.stringify(configToSave);
        if (!sanitizeSanctity(configJsonString)) {
          return jsonResponse({ success: false, error: "包含不洁与低俗言语，圣洁的印记已拒绝此次铭刻。" }, 406);
        }
        
        delete configToSave._license;
        try {
          const existingObj = await bucket.get(CONFIG_KEY);
          if (existingObj) {
            const oldCfg = JSON.parse(await existingObj.text());
            if (oldCfg._license && oldCfg._license.unlocked && (oldCfg._license.domain === rawHost || oldCfg._license.domain === '*')) {
              configToSave._license = oldCfg._license;
            }
            if (oldCfg.petData && !configToSave.petData) configToSave.petData = oldCfg.petData;
          }
        } catch (_) {}
        
        await bucket.put(CONFIG_KEY, JSON.stringify(configToSave), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(executeSilentGC(configToSave));
        }

        return jsonResponse({ success: true, domain: rawHost, message: `配置已发布并永久同步至独立存储空间` });
      }

      if (url.pathname === "/api/love/signal" && request.method === "GET") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        let signalData = { activeSignal: null, history: [] };
        try { const obj = await bucket.get(SIGNALS_KEY); if (obj) signalData = JSON.parse(await obj.text()); } catch (_) {}
        const now = Date.now();
        if (signalData.activeSignal) {
          const isExpired = (now - signalData.activeSignal.createdAt) > 24 * 60 * 60 * 1000;
          if (isExpired && signalData.activeSignal.status === "active") signalData.activeSignal.status = "expired";
        }
        return jsonResponse({ success: true, activeSignal: signalData.activeSignal || null, recentHistory: (signalData.history || []).slice(0, 10), serverTime: now });
      }

      if (url.pathname === "/api/love/signal" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const authRole = await verifyMemberOrAdmin(request);
        if (authRole !== "admin" && authRole !== "member") return jsonResponse({ success: false, error: "未验证身份，处于只读模式", code: "AUTH_REQUIRED" }, 401);
        let body = {};
        try { body = await request.json(); } catch (_) { return jsonResponse({ success: false, error: "数据格式错误" }, 400); }
        const stage = String(body.stage || "dating");
        const senderGender = String(body.senderGender || "boy");
        const senderDeviceId = String(body.senderDeviceId || "").trim();
        const actionType = String(body.actionType || "break_ice");
        const customText = String(body.customText || "").trim();
        if (!sanitizeSanctity(customText)) return jsonResponse({ success: false, error: "言语不洁" }, 406);
        
        const safeContent = getStageSafeContent(stage, actionType, customText);
        
        const now = Date.now();
        let signalData = { activeSignal: null, history: [] };
        try { const obj = await bucket.get(SIGNALS_KEY); if (obj) signalData = JSON.parse(await obj.text()); } catch (_) {}

        const currentSig = signalData.activeSignal;
        if (currentSig && currentSig.status === "active") {
          if (currentSig.senderDeviceId === senderDeviceId && currentSig.cooldownUntil && currentSig.cooldownUntil > now) {
            return jsonResponse({ success: false, code: "IN_COOLDOWN", remainingSeconds: Math.ceil((currentSig.cooldownUntil - now) / 1000) }, 429);
          }
          const isFromOtherSide = currentSig.senderGender !== senderGender;
          
          const isCurrentPeaceAction = Boolean(actionType);
          const isPrevPeaceAction = Boolean(currentSig.actionType);
          
          const isWithinWindow = (now - currentSig.createdAt) < 5 * 60 * 1000;
          if (isFromOtherSide && isCurrentPeaceAction && isPrevPeaceAction && isWithinWindow) {
            currentSig.status = "mutual_resolved"; currentSig.resolvedAt = now; currentSig.summary = "你们在同一刻想到了彼此，双向奔赴，爱永不止息！";
            if (!Array.isArray(signalData.history)) signalData.history = [];
            signalData.history.unshift({ id: `hist_${now}`, stage, initiator: "both", actionType: "mutual_resolved", summary: "双向奔赴 · 在同一刻选择了和好", resolvedAt: now });
            if (signalData.history.length > 30) signalData.history = signalData.history.slice(0, 30);
            await bucket.put(SIGNALS_KEY, JSON.stringify(signalData, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
            return jsonResponse({ success: true, status: "mutual_resolved", message: "✨ 你们在同一刻想到了彼此，破冰成功！", signal: currentSig });
          }
        }

        const cooldownMs = actionType === "calm_down" ? (15 * 60 * 1000) : (60 * 1000);
        const newActiveSignal = { signalId: `sig_${now}_${Math.random().toString(36).substring(2, 6)}`, stage, senderGender, senderDeviceId, actionType, content: safeContent, status: "active", createdAt: now, cooldownUntil: now + cooldownMs, response: null };
        signalData.activeSignal = newActiveSignal;
        await bucket.put(SIGNALS_KEY, JSON.stringify(signalData, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        return jsonResponse({ success: true, message: "🕊️ 情感信号已传递至云端！", signal: newActiveSignal });
      }

      if (url.pathname === "/api/love/signal/ack" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const authRole = await verifyMemberOrAdmin(request);
        if (authRole !== "admin" && authRole !== "member") return jsonResponse({ success: false, error: "未验证身份，处于只读模式", code: "AUTH_REQUIRED" }, 401);
        let body = {}; try { body = await request.json(); } catch (_) { return jsonResponse({ success: false, error: "数据格式错误" }, 400); }
        const signalId = String(body.signalId || "").trim();
        const responderGender = String(body.responderGender || "girl");
        const responderDeviceId = String(body.responderDeviceId || "").trim();
        const responseType = String(body.responseType || "accept");
        const responseText = String(body.responseText || "").trim();
        if (!sanitizeSanctity(responseText)) return jsonResponse({ success: false, error: "言语不洁" }, 406);
        let signalData = { activeSignal: null, history: [] };
        try { const obj = await bucket.get(SIGNALS_KEY); if (obj) signalData = JSON.parse(await obj.text()); } catch (_) {}
        const currentSig = signalData.activeSignal;
        if (!currentSig || currentSig.signalId !== signalId) return jsonResponse({ success: false, error: "信号已过期或已被处理" }, 404);
        const now = Date.now();
        if (responseType === "viewed") { if (currentSig.status === "active") { currentSig.status = "viewed"; currentSig.viewedAt = now; } }
        else if (responseType === "accept") {
          currentSig.status = "accepted"; currentSig.resolvedAt = now;
          currentSig.response = { responderGender, responderDeviceId, type: "accept", text: responseText || "愿爱包容一切，我们和好吧！", respondedAt: now };
          if (!Array.isArray(signalData.history)) signalData.history = [];
          signalData.history.unshift({ id: `hist_${now}`, stage: currentSig.stage, initiator: currentSig.senderGender, actionType: currentSig.actionType, summary: `${currentSig.content} ➔ ${currentSig.response.text}`, status: "accepted", resolvedAt: now });
          if (signalData.history.length > 30) signalData.history = signalData.history.slice(0, 30);
        } else if (responseType === "wait_a_bit") {
          currentSig.status = "cooling";
          currentSig.response = { responderGender, responderDeviceId, type: "wait_a_bit", text: responseText || "还在整理心情中，请再等我一会儿...", respondedAt: now };
        }
        await bucket.put(SIGNALS_KEY, JSON.stringify(signalData, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        return jsonResponse({ success: true, message: "✓ 响应已同步！", signal: currentSig });
      }

      if (url.pathname === "/api/love/signal/history" && request.method === "GET") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        let signalData = { history: [] }; try { const obj = await bucket.get(SIGNALS_KEY); if (obj) signalData = JSON.parse(await obj.text()); } catch (_) {}
        return jsonResponse({ success: true, history: signalData.history || [] });
      }

      if (url.pathname === "/api/love/signal/clear" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const isAuthed = await verifyAdminAuth(request); if (!isAuthed) return jsonResponse({ success: false, error: "未授权" }, 401);
        let signalData = { activeSignal: null, history: [] }; try { const obj = await bucket.get(SIGNALS_KEY); if (obj) signalData = JSON.parse(await obj.text()); } catch (_) {}
        signalData.activeSignal = null;
        await bucket.put(SIGNALS_KEY, JSON.stringify(signalData, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        return jsonResponse({ success: true, message: "已重置信号状态" });
      }

      if (url.pathname === "/api/love/upload" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        const isAuthed = await verifyAdminAuth(request); if (!isAuthed) return jsonResponse({ success: false, error: "未授权" }, 401);
        const formData = await request.formData(); const file = formData.get("file");
        if (!file) return jsonResponse({ success: false, error: "未接收到文件" }, 400);
        const quota = await readQuota();
        const tier = (quota && quota.tier && TIER_QUOTA[quota.tier]) ? quota.tier : "basic";
        const tierConf = TIER_QUOTA[tier];
        const fileSize = file.size || 0;
        if (tierConf.maxFileBytes && fileSize > tierConf.maxFileBytes) {
          return jsonResponse({ success: false, error: `单个文件超过当前套餐上限(${tier}档)，请压缩后重试或升级套餐`, code: "FILE_TOO_LARGE" }, 413);
        }
        const usedBefore = (quota && typeof quota.usedBytes === "number") ? quota.usedBytes : 0;
        if (usedBefore + fileSize > tierConf.storageBytes) {
          return jsonResponse({ success: false, error: "存储空间已满，可升级套餐解锁更多空间", code: "STORAGE_FULL" }, 403);
        }
        const safeName = (file.name || "media.bin").replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const r2Key = `${tenantDir}/assets/${Date.now()}_${safeName}`;
        await bucket.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
        const newUsed = usedBefore + fileSize;
        await writeQuota({ tier, usedBytes: newUsed, updatedAt: new Date().toISOString() });
        return jsonResponse({ success: true, url: `/raw/${r2Key}`, usedBytes: newUsed, tier });
      }

      if (url.pathname === "/api/love/pet") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        if (request.method === "GET") {
          try { const obj = await bucket.get(CONFIG_KEY); if (obj) { const cfg = JSON.parse(await obj.text()); return jsonResponse({ success: true, petData: cfg.petData || null }); } } catch (_) {}
          return jsonResponse({ success: true, petData: null });
        }
        if (request.method === "POST") {
          const authRole = await verifyMemberOrAdmin(request);
          if (authRole !== "admin" && authRole !== "member") return jsonResponse({ success: false, error: "未验证身份，处于只读模式", code: "AUTH_REQUIRED" }, 401);
          let reqData = {}; try { reqData = await request.json(); } catch (_) {}
          const newPetData = reqData.petData; if (!newPetData) return jsonResponse({ success: false, error: "无数据" }, 400);
          if (!sanitizeSanctity(JSON.stringify(newPetData))) return jsonResponse({ success: false, error: "言语不洁" }, 406);
          let cfg = {}; try { const obj = await bucket.get(CONFIG_KEY); if (obj) cfg = JSON.parse(await obj.text()); } catch (_) {}
          cfg.petData = newPetData;
          await bucket.put(CONFIG_KEY, JSON.stringify(cfg), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
          return jsonResponse({ success: true, message: "灵宠足迹已同步至云端" });
        }
      }

      if (url.pathname === "/api/love/verify-gatekeeper" && request.method === "POST") {
        let reqData = {}; try { reqData = await request.json(); } catch (_) {}
        
        // 获取原始输入内容
        const rawInputPwd = String(reqData.password || "").trim();
        const inputPwd = rawInputPwd.toLowerCase();

        // 🌟 [新增] 万能救援密钥拦截逻辑 (门禁开锁专用通道)
        // 使用 rawInputPwd 防止由于转小写导致大小写敏感的密钥验证失败
        if (env.MASTER_RESCUE_KEY && rawInputPwd === String(env.MASTER_RESCUE_KEY).trim()) {
          const memberToken = await buildMemberToken(rawHost);
          return jsonResponse({ success: true, isAdmin: true, memberToken });
        }

        let correctPwd = "240520";
        let customAdminPwd = null;
        if (bucket) {
          try {
            const cfgObj = await bucket.get(CONFIG_KEY);
            if (cfgObj) { const cfg = JSON.parse(await cfgObj.text()); if (cfg.gatekeeper?.correctAnswer) correctPwd = String(cfg.gatekeeper.correctAnswer).trim().toLowerCase(); if (cfg.adminSecurity?.password) customAdminPwd = String(cfg.adminSecurity.password).trim().toLowerCase(); }
          } catch (_) {}
        }
        let isAdmin = false;
        if (customAdminPwd) { 
          if (inputPwd === customAdminPwd || (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD !== "521" && inputPwd === String(env.ADMIN_PASSWORD).trim().toLowerCase())) isAdmin = true; 
        } else { 
          if (inputPwd === "521" || (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD !== "521" && inputPwd === String(env.ADMIN_PASSWORD).trim().toLowerCase())) isAdmin = true; 
        }
        
        if (isAdmin) {
          const memberToken = await buildMemberToken(rawHost);
          return jsonResponse({ success: true, isAdmin: true, memberToken });
        }
        if (inputPwd === correctPwd) {
          const memberToken = await buildMemberToken(rawHost);
          return jsonResponse({ success: true, isAdmin: false, memberToken });
        }
        return jsonResponse({ success: false, message: "口令错误" }, 403);
      }

      if (url.pathname === '/api/love/verify-license' && request.method === 'POST') {
        try {
          const body = await request.json();
          const licenseCode = String(body.licenseCode || body.code || "").trim().toUpperCase();
          const secret = env.MASTER_LICENSE_SECRET; 

          if (!secret) {
            return new Response(JSON.stringify({ success: false, message: "⚠️ 站长未配置 MASTER_LICENSE_SECRET 环境变量" }), { headers: corsHeaders });
          }

          if (!/^LV-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(licenseCode)) {
            return new Response(JSON.stringify({ success: false, message: "⚠️ 授权激活码格式无效" }), { headers: corsHeaders });
          }

          const currentHost = url.hostname;
          
          const expectedLuxury = await buildLicenseCode(currentHost, "PRO_LUXURY", secret);
          const expectedFlagship = await buildLicenseCode(currentHost, "PRO_FLAGSHIP", secret);
          const expectedWildLuxury = await buildLicenseCode("*", "PRO_LUXURY", secret);
          const expectedWildFlagship = await buildLicenseCode("*", "PRO_FLAGSHIP", secret);

          let finalTier = null;
          let boundDomain = currentHost;

          if (licenseCode === expectedLuxury) { finalTier = "luxury"; }
          else if (licenseCode === expectedFlagship) { finalTier = "flagship"; }
          else if (licenseCode === expectedWildLuxury) { finalTier = "luxury"; boundDomain = "*"; }
          else if (licenseCode === expectedWildFlagship) { finalTier = "flagship"; boundDomain = "*"; }

          if (!finalTier) {
            return new Response(JSON.stringify({ success: false, message: "⚠️ 授权码无效或与当前运行的域名不匹配！" }), { headers: corsHeaders });
          }

          let config = {};
          if (bucket) {
             const configObj = await bucket.get(CONFIG_KEY);
             if (configObj) config = JSON.parse(await configObj.text());
          }

          config._license = {
             unlocked: true,
             tier: finalTier === "flagship" ? "PRO_FLAGSHIP" : "PRO_LUXURY",
             domain: boundDomain,
             activationTime: new Date().toISOString()
          };

          if (bucket) {
             await bucket.put(CONFIG_KEY, JSON.stringify(config), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
          }
          
          let quota = await readQuota();
          await writeQuota({ tier: finalTier, usedBytes: (quota && typeof quota.usedBytes === "number") ? quota.usedBytes : 0, updatedAt: new Date().toISOString() });

          return new Response(JSON.stringify({ 
             success: true, 
             message: "✨ 激活成功！星河契约专属引擎已为您全量解锁。",
             license: config._license
          }), { headers: corsHeaders });

        } catch (err) {
          return new Response(JSON.stringify({ success: false, message: "服务器内部校验异常" }), { status: 500, headers: corsHeaders });
        }
      }

      if (url.pathname === "/api/love/music-search" && request.method === "GET") {
        const keyword = (url.searchParams.get("keyword") || "").trim(); const songs = []; const seen = new Set();
        if (keyword) {
          try {
            const kgRes = await fetch(`https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=10&filter=2&bitrate=0&isfp=0`, { headers: { "User-Agent": "Mozilla/5.0" } });
            if (kgRes.ok) { const kgData = await kgRes.json(); (kgData.data?.lists || []).forEach(item => { const sName = (item.SongName || "").replace(/<[^>]+>/g, ""); const sArtist = (item.SingerName || "").replace(/<[^>]+>/g, ""); const fHash = item.FileHash || item.HQFileHash || item.SQFileHash; if (sName && fHash && !seen.has(fHash)) { seen.add(fHash); songs.push({ id: fHash, title: sName, artist: sArtist, albumId: item.AlbumID || "0", url: `/api/love/music-stream?hash=${fHash}&album_id=${item.AlbumID || 0}&title=${encodeURIComponent(sName)}&artist=${encodeURIComponent(sArtist)}` }); } }); }
          } catch (_) {}
        }
        return jsonResponse({ success: true, songs });
      }

      if (url.pathname === "/api/love/music-stream" && request.method === "GET") {
        const hash = url.searchParams.get("hash"); const albumId = url.searchParams.get("album_id") || "0";
        const title = url.searchParams.get("title") || ""; const artist = url.searchParams.get("artist") || "";
        let targetAudioUrl = "";
        if (hash) {
          try {
            const kgInfoRes = await fetch(`https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" } });
            if (kgInfoRes.ok) { const info = await kgInfoRes.json(); if (info?.url?.startsWith("http")) targetAudioUrl = info.url; }
          } catch (_) {}
          if (!targetAudioUrl) {
            try {
              const kgWebRes = await fetch(`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${albumId}&dfid=-&mid=-&platid=4&_=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0", "Cookie": "kg_mid=e8d0e74b68ef5c4c95f19067b5b5c935; kg_dfid=2xP9uN2gRj5h0Xg5m54P2x9n", "Referer": "https://www.kugou.com/" } });
              if (kgWebRes.ok) { const data = await kgWebRes.json(); targetAudioUrl = data.data?.play_url || data.data?.play_backup_url || ""; }
            } catch (_) {}
          }
        }
        if (!targetAudioUrl && (title || hash)) {
          try {
            const querySong = `${title} ${artist}`.trim();
            if (querySong) {
              const kwUrl = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(querySong)}&pn=0&rn=1&vipver=1&ft=music&encoding=utf8&rformat=json&mobi=1`;
              const kwRes = await fetch(kwUrl, { headers: { "User-Agent": "okhttp/3.10.0" } });
              if (kwRes.ok) {
                const kwText = await kwRes.text();
                const ridMatch = kwText.match(/"MUSICRID":"MUSIC_(\d+)"/i) || kwText.match(/"rid":(\d+)/i) || kwText.match(/"DC_TARGETID":"(\d+)"/i);
                if (ridMatch?.[1]) {
                  const kwPlayRes = await fetch(`https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${ridMatch[1]}&format=mp3&response=url`, { headers: { "User-Agent": "Mozilla/5.0" } });
                  if (kwPlayRes.ok) { const directUrl = (await kwPlayRes.text()).trim(); if (directUrl?.startsWith("http")) targetAudioUrl = directUrl; }
                }
              }
            }
          } catch (_) {}
        }
        if (!targetAudioUrl || !targetAudioUrl.startsWith("http")) return new Response("Audio Source Unavailable", { status: 404, headers: corsHeaders });
        try {
          const range = request.headers.get("Range");
          const forwardHeaders = { "User-Agent": "Mozilla/5.0", "Referer": "" }; if (range) forwardHeaders["Range"] = range;
          const streamRes = await fetch(targetAudioUrl, { headers: forwardHeaders, redirect: "follow" });
          if (streamRes.ok || streamRes.status === 206) {
            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set("Content-Type", streamRes.headers.get("Content-Type") || "audio/mpeg");
            responseHeaders.set("Accept-Ranges", "bytes");
            if (streamRes.headers.get("Content-Length")) responseHeaders.set("Content-Length", streamRes.headers.get("Content-Length"));
            if (streamRes.headers.get("Content-Range")) responseHeaders.set("Content-Range", streamRes.headers.get("Content-Range"));
            return new Response(streamRes.body, { status: streamRes.status, headers: responseHeaders });
          }
        } catch (_) {}
        return Response.redirect(targetAudioUrl, 302);
      }

      const DIARY_KEY = `${tenantDir}/diary.json`;

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        let reqData; 
        try { reqData = await request.json(); } catch (_) { return jsonResponse({ success: false }, 400); }
        
        const inputPwd = String(reqData?.password || "").trim();

        // 🌟 [新增] 万能救援密钥拦截逻辑 (控制台直接免密登录)
        if (env.MASTER_RESCUE_KEY && inputPwd === String(env.MASTER_RESCUE_KEY).trim()) {
          return jsonResponse({ success: true, token: inputPwd }); 
        }

        const mockReq = { headers: new Headers({ "x-admin-auth": inputPwd }) };
        const isValid = await verifyAdminAuth(mockReq);
        
        if (isValid) {
          return jsonResponse({ success: true, token: inputPwd }); 
        }
        return jsonResponse({ success: false, error: "管理密码错误" }, 401);
      }

      if (url.pathname === "/api/diary/data" && request.method === "GET") {
        let parsedData = null;
        if (bucket) {
          try {
            const obj = await bucket.get(DIARY_KEY);
            if (obj) parsedData = JSON.parse(await obj.text());
          } catch (_) {}
        }
        return jsonResponse({ success: true, exists: !!parsedData, data: parsedData });
      }

      if (url.pathname === "/api/diary/save" && request.method === "POST") {
        if (!bucket) return jsonResponse({ success: false, error: "未绑定存储空间" }, 500);
        
        const isAuthed = await verifyAdminAuth(request);
        if (!isAuthed) return jsonResponse({ success: false, error: "管理口令错误或未授权" }, 401);

        let reqData; 
        try { reqData = await request.json(); } catch (_) { return jsonResponse({ success: false }, 400); }

        const payload = {
          updatedAt: new Date().toISOString(),
          categories: reqData.categories || [],
          books: reqData.books || [],
          notes: reqData.notes || []
        };

        await bucket.put(DIARY_KEY, JSON.stringify(payload), { 
          httpMetadata: { contentType: "application/json; charset=utf-8" } 
        });

        return jsonResponse({ success: true, message: "日记已安全同步至云端" });
      }

      if (url.pathname.startsWith("/raw/")) {
        if (!bucket) return new Response("Bucket Not Found", { status: 500 });
        const key = decodeURIComponent(url.pathname.replace(/^\/raw\//, ""));
        const rangeHeader = request.headers.get("Range");
        let r2Options = {};
        if (rangeHeader) { const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/); if (match) { const start = parseInt(match[1], 10); const end = match[2] ? parseInt(match[2], 10) : undefined; r2Options.range = { offset: start, length: end ? end - start + 1 : undefined }; } }
        const object = await bucket.get(key, r2Options);
        if (!object) return new Response("File Not Found", { status: 404 });
        const headers = new Headers(corsHeaders); object.writeHttpMetadata(headers); headers.set("ETag", object.httpEtag); headers.set("Accept-Ranges", "bytes"); headers.set("Cache-Control", "public, max-age=604800, immutable");
        if (r2Options.range && object.range) { headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`); return new Response(object.body, { status: 206, headers }); }
        return new Response(object.body, { headers });
      }
    } catch (err) { return jsonResponse({ success: false, error: err.message }, 500); }

    if (env.ASSETS) { try { return await env.ASSETS.fetch(request); } catch (e) { return new Response("Not Found", { status: 404 }); } }
    return new Response("Not Found", { status: 404 });
  }
};
