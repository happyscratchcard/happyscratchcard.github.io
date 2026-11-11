// ================= 6.2 十六轮：麻将 · AI 决策（牌效率 + 基础防守） =================
// 单机三家用同一套策略，按座次注入不同性格系数（激进/均衡/保守），避免三家行为完全一致。
(function (root) { // 自执行作用域
  "use strict"; // 严格模式
  const R = root.MJR; // 规则内核
  if (!R) { return; } // 保护

  /* ================= 一、可见牌统计（剩余枚数估算） ================= */
  function visibleCounts(view) { // view: { rivers:[[k...]], melds:[[{tiles}]], dora:[[k...]] }
    const c = new Array(34).fill(0); // 计数表
    const eat = function (arr) { for (let i = 0; i < arr.length; i++) { c[R.bk(arr[i])]++; } }; // 累加器
    (view.rivers || []).forEach(eat); // 各家电牌河
    (view.melds || []).forEach(function (list) { (list || []).forEach(function (m) { eat(m.tiles || []); }); }); // 副露
    (view.dora || []).forEach(eat); // 预留：额外已见牌（国标无宝牌，保持接口兼容）
    return c; // 返回
  } // 结束 visibleCounts

  function remainOf(kind, vis, ownCounts) { // 某种牌的剩余枚数（4 - 已见 - 自己手里）
    return Math.max(0, 4 - (vis[kind] || 0) - (ownCounts[kind] || 0)); // 下限 0
  } // 结束 remainOf

  /* ================= 二、打牌评估 ================= */
  // 打分维度：向听数（主）→ 有效牌总枚数（次）→ 安全度（对手立直时）→ 孤张幺九（尾）
  function chooseDiscard(hand, meldN, ctx) { // hand: 手牌 kind 数组（含摸到的牌）
    ctx = ctx || {}; // 默认上下文
    const uniq = []; // 去重后的候选牌
    const seen = {}; // 去重表
    for (let i = 0; i < hand.length; i++) { const k = R.bk(hand[i]); if (!seen[k]) { seen[k] = 1; uniq.push(k); } } // 收集
    const vis = ctx.visible || new Array(34).fill(0); // 可见牌
    const baseCounts = R.countsOf(hand); // 当前计数
    let best = null; // 最优候选

    for (let i = 0; i < uniq.length; i++) { // 逐张试打
      const k = uniq[i]; // 候选牌种
      const rest = hand.slice(); // 复制手牌
      const idx = rest.map(function (x) { return R.bk(x); }).lastIndexOf(k); // 找最后一张（优先打普通牌而非赤牌）
      if (idx < 0) { continue; } // 理论不会发生
      rest.splice(idx, 1); // 移除
      const c = R.countsOf(rest); // 打后计数
      const sh = R.shanten(c, meldN || 0); // 打后向听
      let gain = 0; // 有效牌枚数
      if (sh >= 0) { // 未和牌
        const useful = R.usefulKinds(rest, meldN || 0); // 有效牌
        for (let j = 0; j < useful.length; j++) { gain += remainOf(useful[j].k, vis, c) * useful[j].gain; } // 按剩余枚数加权
      } // 结束有效牌
      const danger = ctx.threat ? dangerOf(k, ctx) : 0; // 危险度（对手做大牌时）
      const yaoPenalty = (R.isYaochu(k) ? 1 : 0) * 0.4; // 幺九孤张略微优先打出（牌效率兜底）
      // 综合分：向听越低越好、有效牌越多越好、危险度越低越好
      const score = sh * 1000 - gain * 2 + danger * (ctx.defense || 0) * 60 + yaoPenalty; // 分数（越小越优）
      if (!best || score < best.score) { best = { k: k, score: score, sh: sh, gain: gain, danger: danger }; } // 记录最优
    } // 结束逐张

    return best ? best.k : R.bk(hand[0]); // 兜底：打第一张
  } // 结束 chooseDiscard

  function dangerOf(kind, ctx) { // 危险度：0 安全 → 1 极危（简化版：现物 0 / 筋 0.35 / 字牌 0.5 / 中张 0.9）
    const riv = ctx.riichiRivers || []; // 对手牌河（现物判断用）
    for (let i = 0; i < riv.length; i++) { if (R.bk(riv[i]) === kind) { return 0; } } // 现物：绝对安全
    if (kind >= 27) { // 字牌
      const seen = (ctx.visible && ctx.visible[kind]) || 0; // 已见枚数
      return seen >= 2 ? 0.15 : 0.5; // 字牌越少越安全
    } // 结束字牌
    const num = R.numOf(kind); // 点数
    const suit = R.suitOf(kind); // 花色
    let suji = false; // 是否筋牌
    for (let i = 0; i < riv.length; i++) { // 遍历立直者牌河
      const b = R.bk(riv[i]); // 牌种
      if (R.suitOf(b) === suit && Math.abs(R.numOf(b) - num) === 3) { suji = true; break; } // 相差 3 视为筋
    } // 结束遍历
    if (suji) { return 0.3; } // 筋牌较安全
    return num >= 4 && num <= 6 ? 0.95 : 0.7; // 中张最危险
  } // 结束 dangerOf

  /* ================= 三、鸣牌判断 ================= */
  // 返回 null 或 {type:'chi'|'pon'|'kan', tiles:[...]}；ctx.allow 为可用鸣牌列表
  function chooseClaim(hand, meldN, tile, ctx) { // 针对别人打出的 tile
    ctx = ctx || {}; // 默认
    const opts = []; // 候选动作
    const k = R.bk(tile); // 牌种
    const c = R.countsOf(hand); // 手牌计数
    const curSh = R.shanten(c, meldN); // 当前向听
    const style = ctx.style || 1; // 性格系数（>1 更爱鸣牌）

    if (c[k] >= 2 && ctx.canPon) { // 可碰
      const rest = hand.slice(); // 复制
      for (let i = 0; i < 2; i++) { rest.splice(rest.map(R.bk).indexOf(k), 1); } // 移除两张
      const sh = R.shanten(R.countsOf(rest), meldN + 1); // 碰后向听
      if (sh < curSh) { opts.push({ type: "pon", tiles: [k, k, k], sh: sh, value: (curSh - sh) * 10 }); } // 提升向听才碰
    } // 结束碰

    if (ctx.canChi && k < 27) { // 可吃（仅上家）
      const n = R.numOf(k), s = R.suitOf(k) * 9; // 点数与花色基址
      const patterns = [[n - 2, n - 1], [n - 1, n + 1], [n + 1, n + 2]]; // 三种吃法（相对点数）
      patterns.forEach(function (p) { // 逐个检查
        const a = s + p[0] - 1, b = s + p[1] - 1; // 两张搭档牌种
        if (p[0] < 1 || p[1] > 9) { return; } // 越界
        if (c[a] > 0 && c[b] > 0) { // 手上有
          const rest = hand.slice(); // 复制
          rest.splice(rest.map(R.bk).indexOf(a), 1); rest.splice(rest.map(R.bk).indexOf(b), 1); // 移除两张
          const sh = R.shanten(R.countsOf(rest), meldN + 1); // 吃后向听
          if (sh < curSh) { opts.push({ type: "chi", tiles: [a, k, b].sort(function (x, y) { return R.bk(x) - R.bk(y); }), sh: sh, value: (curSh - sh) * 10 - 2 }); } // 吃稍微降权（破坏门清）
        } // 结束可用判断
      }); // 结束三种吃法
    } // 结束吃

    if (!opts.length) { return null; } // 无候选
    opts.sort(function (a, b) { return b.value - a.value; }); // 取最优
    const top = opts[0]; // 最优动作
    if (top.value * style < 8) { return null; } // 性格保守时放过（收益不足）
    if (ctx.threat && style < 1) { return null; } // 有人立直且性格保守：不鸣牌
    return top; // 返回动作
  } // 结束 chooseClaim

  function wantKan(hand, meldN, tile, ctx) { // 是否杠（暗杠由调用方直接问）
    const k = R.bk(tile); // 牌种
    const c = R.countsOf(hand); // 计数
    if (c[k] < 3) { return false; } // 不足三张
    const rest = hand.slice(); // 复制
    for (let i = 0; i < 3; i++) { rest.splice(rest.map(R.bk).indexOf(k), 1); } // 移除三张
    const shBefore = R.shanten(c, meldN); // 杠前向听
    const shAfter = R.shanten(R.countsOf(rest), meldN + 1); // 杠后向听
    return shAfter <= shBefore; // 不让牌型变差就杠
  } // 结束 wantKan

  /* ================= 四、和牌与杠 ================= */
  function wantWinByRon(ctx) { // 荣和判断：推倒胡能拆成 4 副 1 将就和（不做见逃）
    return !!ctx.canWin; // 由调用方用规则内核算好
  } // 结束 wantWinByRon

  function chooseAnkan(hand, meldN) { // 暗杠候选：返回可杠牌种或 -1
    const c = R.countsOf(hand); // 计数
    for (let k = 0; k < 34; k++) { // 遍历
      if (c[k] !== 4) { continue; } // 只考虑四张全在手
      const rest = hand.filter(function (x) { return R.bk(x) !== k; }); // 移除四张
      const shBefore = R.shanten(c, meldN); // 杠前
      const shAfter = R.shanten(R.countsOf(rest), meldN + 1); // 杠后
      if (shAfter <= shBefore) { return k; } // 不影响牌型就杠
    } // 结束遍历
    return -1; // 无
  } // 结束 chooseAnkan

  const API = { visibleCounts: visibleCounts, chooseDiscard: chooseDiscard, chooseClaim: chooseClaim, wantKan: wantKan, wantWinByRon: wantWinByRon, chooseAnkan: chooseAnkan, dangerOf: dangerOf }; // 导出
  root.MJAI = API; // 挂全局
  if (typeof module !== "undefined" && module.exports) { module.exports = API; } // Node 出口
})(typeof window !== "undefined" ? window : globalThis); // 作用域根

