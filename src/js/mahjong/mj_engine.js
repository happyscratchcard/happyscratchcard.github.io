// ================= 6.2 十六轮：麻将 · 对局状态机 =================
// 6.2 十九轮改写：日式立直 → 国标推倒胡。去掉立直 / 宝牌 / 振听 / 罚符，补上抢杠和、连庄与荒庄。
// 职责：牌山、配牌、摸打、鸣牌优先级、杠（含抢杠）、和牌结算、荒庄。
// 与渲染完全解耦：状态变化通过 emit 通知外部播动画，外部通过 discard()/act() 回传玩家操作。
(function (root) { // 自执行作用域
  "use strict"; // 严格模式
  const R = root.MJR, Y = root.MJY, AI = root.MJAI; // 依赖三个内核
  if (!R || !Y || !AI) { return; } // 保护

  const SEAT = ["你", "下家", "对家", "上家"]; // 座位名（0 玩家 / 1 下家 / 2 对家 / 3 上家）
  const STYLE = [1.15, 1.0, 0.85]; // AI 三家性格：激进 / 均衡 / 保守（鸣牌倾向系数）
  const DEAD_N = 14; // 底牌张数（杠后补牌从这里取）

  function shuffle(arr) { // Fisher-Yates 洗牌
    for (let i = arr.length - 1; i > 0; i--) { // 从尾到头
      const j = Math.floor(Math.random() * (i + 1)); // 随机位
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t; // 交换
    } // 结束循环
    return arr; // 返回
  } // 结束 shuffle

  function buildWall(useRed) { // 构建 136 张牌山（国标：无花牌；默认不掺赤宝牌）
    const w = []; // 容器
    for (let k = 0; k < 34; k++) { for (let i = 0; i < 4; i++) { w.push(k); } } // 每种四张
    if (useRed === true) { // 仅显式要求时才掺赤宝牌（国标玩法不用）
      [4, 13, 22].forEach(function (k, i) { const idx = w.lastIndexOf(k); if (idx >= 0) { w[idx] = 34 + i; } }); // 各替换一张为赤
    } // 结束赤牌
    return shuffle(w); // 洗匀
  } // 结束 buildWall

  function createGame(opts) { // 创建一局
    opts = opts || {}; // 默认
    const g = { // 对局对象
      human: 0, // 玩家座位（0 南家视角）
      dealer: opts.dealer || 0, // 庄家座位
      round: opts.round || 0, // 圈风（0 东）
      handNo: opts.handNo || 1, // 本圈第几局（仅用于显示）
      scores: opts.scores || [25000, 25000, 25000, 25000], // 点数
      players: [], // 四家状态
      wall: [], // 牌山（可摸）
      dead: [], // 底牌（杠后补牌）
      turn: 0, // 当前行动者
      phase: "idle", // idle / draw / discard / claim / end
      lastDiscard: null, // 最近一张打出的牌 {tile, from}
      pending: null, // 玩家待决策 {kind:'claim'|'discard', options:[...]}
      wait: false, // 是否在等玩家操作
      timer: null, // 内部计时器
      running: false, // 是否进行中
      log: [], // 对局日志（供 UI 显示）
      emit: function () {}, // 事件回调（外部覆盖）
      settleInfo: null, // 结算信息
      _haitei: false // 本巡摸的是否为最后一张（海底捞月）
    }; // 结束对象

    for (let i = 0; i < 4; i++) { // 初始化四家
      g.players.push({ // 玩家状态
        seat: i, // 座位
        hand: [], // 手牌
        melds: [], // 副露
        river: [], // 牌河
        drawn: null, // 本次摸到的牌（用于分离显示）
        style: i === 0 ? 1 : STYLE[(i - 1) % 3] // 性格系数
      }); // 结束单个
    } // 结束四家

    const SPD = opts.speed == null ? 1 : opts.speed; // 全局节奏倍率（测试时调小，正常 1）
    g.clock = 0; // 逻辑时钟（毫秒），由 tick 推进
    g.queue = []; // 调度队列 [{ at, fn }]，按时间升序
    g.schedule = function (ms, fn) { // 排定延迟动作（替代 setTimeout，可整体暂停与快放）
      const item = { at: g.clock + Math.max(0, ms * SPD), fn: fn }; // 目标时刻
      let i = g.queue.length; // 插入位从末尾找
      while (i > 0 && g.queue[i - 1].at > item.at) { i--; } // 保持升序
      g.queue.splice(i, 0, item); // 插入
      return item; // 返回句柄
    }; // 结束 schedule
    g.tick = function (dt) { // 由渲染帧驱动：推进时钟并执行到期动作
      if (!g.queue.length && !g.running) { return; } // 空闲直接返回
      g.clock += Math.max(0, dt || 16); // 推进时钟
      let n = 0; // 本帧执行计数
      while (g.queue.length && g.queue[0].at <= g.clock) { // 到期即执行
        if (g.wait) { return; } // 等待玩家时整体暂停
        const item = g.queue.shift(); // 取出
        try { item.fn(); } catch (e) { if (root.console) { root.console.error("[MJ]", e); } } // 单步异常不中断整局
        if (++n >= 24) { return; } // 单帧上限，防爆炸
      } // 结束循环
    }; // 结束 tick
    const ev = function (type, data) { try { g.emit(type, data || {}); } catch (e) {} }; // 发事件（吞异常，避免动画层拖垮逻辑）

    function meldN(p) { return g.players[p].melds.length; } // 副露组数（杠也算一组）
    function isDealer(p) { return p === g.dealer; } // 是否庄家
    function seatWind(p) { return (p - g.dealer + 4) % 4; } // 门风（庄家为东）
    function liveWall() { return g.wall.length; } // 剩余可摸张数

    function seenCounts() { // 场上已见牌（牌河 + 副露），供「和绝张」判定
      const c = new Array(34).fill(0); // 计数表
      for (let p = 0; p < 4; p++) { // 四家
        g.players[p].river.forEach(function (k) { c[R.bk(k)]++; }); // 牌河
        g.players[p].melds.forEach(function (m) { (m.tiles || []).forEach(function (k) { c[R.bk(k)]++; }); }); // 副露
      } // 结束四家
      return c; // 返回
    } // 结束 seenCounts

    function ctxOf(p, extra) { // 统一构造和牌判定上下文（国标：只要门风/圈风/牌况）
      const pl = g.players[p]; // 状态
      const base = { // 公共上下文
        seatWind: seatWind(p), // 门风
        roundWind: g.round, // 圈风
        isDealer: isDealer(p), // 是否庄家
        melds: pl.melds, // 副露
        seen: seenCounts() // 已见牌（和绝张）
      }; // 结束公共
      return extra ? Object.assign(base, extra) : base; // 合并附加项
    } // 结束 ctxOf

    /* ================= 一、开局 ================= */
    g.start = function () { // 开始新一局
      g.players.forEach(function (p) { p.hand = []; p.melds = []; p.river = []; p.drawn = null; }); // 重置四家
      const all = buildWall(false); // 洗牌（国标：无赤宝牌）
      g.dead = all.splice(all.length - DEAD_N, DEAD_N); // 留 14 张底牌（杠后补牌）
      g.wall = all; // 剩余为可摸牌山
      g.pending = null; g.wait = false; g.settleInfo = null; g.log = []; g._haitei = false; // 清状态
      ev("wash", {}); // 洗牌事件（3D 播洗牌动画）
      for (let r = 0; r < 3; r++) { // 三轮发牌
        for (let p = 0; p < 4; p++) { for (let i = 0; i < 4; i++) { g.players[(g.dealer + p) % 4].hand.push(g.wall.shift()); } } // 每人 4 张
      } // 结束三轮
      for (let p = 0; p < 4; p++) { g.players[(g.dealer + p) % 4].hand.push(g.wall.shift()); } // 每人再 1 张（合计 13）
      g.players.forEach(function (p) { p.hand = R.sortTiles(p.hand); }); // 理牌
      g.turn = g.dealer; // 庄家先手
      g.running = true; g.phase = "draw"; // 进入摸牌阶段
      ev("deal", { dealer: g.dealer }); // 发牌事件
      g.schedule(520, function () { drawPhase(); }); // 稍作停顿后庄家摸牌
    }; // 结束 start

    /* ================= 二、摸牌 ================= */
    function drawPhase(rinshan) { // 当前玩家摸牌
      if (!g.running) { return; } // 已结束
      const p = g.turn; // 行动者
      if (liveWall() <= 0) { // 牌山摸完
        ev("ryuukyoku", { reason: "荒庄" }); // 荒庄事件
        doRyuukyoku(); // 结算
        return; // 结束
      } // 结束牌山判断
      const tile = rinshan ? g.dead.shift() : g.wall.shift(); // 摸牌（杠后从底牌取）
      g.players[p].hand.push(tile); // 入手
      g.players[p].drawn = tile; // 记录本次摸牌
      g.players[p].hand = R.sortTiles(g.players[p].hand); // 理牌
      g.phase = "discard"; // 进入打牌阶段
      g._haitei = !rinshan && liveWall() === 0; // 摸完这张牌山空了 → 海底捞月
      ev("draw", { p: p, tile: tile, rinshan: !!rinshan, left: liveWall() }); // 摸牌事件
      if (p === g.human) { // 玩家
        const self = selfOptions(p); // 可执行动作
        g.wait = true; // 等待操作
        g.pending = { kind: "discard", options: self }; // 打包
        ev("waitPlayer", { p: p, options: self }); // 通知 UI
        if (self.canTsumo) { g.schedule(120, function () { ev("promptTsumo", { result: self.tsumoResult }); }); } // 自摸提示
        return; // 结束
      } // 结束玩家
      g.timer = g.schedule(520 + Math.random() * 260, function () { aiDiscard(p); }); // AI 思考延迟
    } // 结束 drawPhase

    function selfOptions(p) { // 玩家自身可执行动作
      const pl = g.players[p]; // 状态
      const hand = pl.hand; // 手牌
      const ctx = ctxOf(p, { tsumo: true, haitei: g._haitei }); // 上下文
      const win = Y.solve(Object.assign({}, ctx, { tiles: hand, winTile: pl.drawn })); // 自摸判定
      const ank = AI.chooseAnkan(hand, meldN(p)); // 暗杠候选
      const canKan = pl.melds.some(function (m) { return m.type === "pon" && hand.some(function (t) { return R.bk(t) === m.k; }); }); // 加杠候选
      return { canTsumo: !!win, tsumoResult: win, ankan: ank, canKan: canKan }; // 返回
    } // 结束 selfOptions

    /* ================= 三、AI 打牌 ================= */
    function aiDiscard(p) { // AI 出牌
      if (!g.running || g.turn !== p) { return; } // 状态保护
      const pl = g.players[p]; // 状态
      const mn = meldN(p); // 副露
      const ctx = ctxOf(p, { tsumo: true, haitei: g._haitei }); // 上下文
      const win = Y.solve(Object.assign({}, ctx, { tiles: pl.hand, winTile: pl.drawn })); // 自摸
      if (win) { doWin(p, -1, win, true); return; } // 自摸和牌（推倒胡：能胡就胡）
      const ank = AI.chooseAnkan(pl.hand, mn); // 暗杠
      if (ank >= 0) { doKan(p, ank, "ankan", null); return; } // 暗杠
      const vis = AI.visibleCounts({ rivers: g.players.map(function (x) { return x.river; }), melds: g.players.map(function (x) { return x.melds; }) }); // 可见牌
      const threats = g.players.filter(function (x) { return x.seat !== p && x.melds.length >= 2; }); // 做大牌的对手（两副露以上）
      const ctx2 = { // 决策上下文
        visible: vis, // 可见牌
        threat: threats.length > 0, // 是否有威胁
        defense: threats.length > 0 ? 1 : 0, // 防守权重
        style: pl.style, // 性格
        riichiRivers: [].concat.apply([], threats.map(function (x) { return x.river; })) // 对手牌河（现物判断）
      }; // 结束上下文
      const pickK = AI.chooseDiscard(pl.hand, mn, ctx2); // 选择要打的牌种
      doDiscard(p, findTile(pl.hand, pickK)); // 执行打牌
    } // 结束 aiDiscard

    function findTile(hand, kind) { // 在手中找一张指定牌种
      for (let i = 0; i < hand.length; i++) { if (R.bk(hand[i]) === kind) { return hand[i]; } } // 找到即返回
      return hand[hand.length - 1]; // 兜底
    } // 结束 findTile

    /* ================= 四、打牌与鸣牌窗口 ================= */
    function doDiscard(p, tile) { // 出牌
      const pl = g.players[p]; // 状态
      const idx = pl.hand.indexOf(tile); // 定位
      if (idx >= 0) { pl.hand.splice(idx, 1); } else { pl.hand.pop(); } // 移除
      pl.hand = R.sortTiles(pl.hand); // 理牌
      pl.drawn = null; // 清摸牌标记
      pl.river.push(tile); // 进牌河
      g.lastDiscard = { tile: tile, from: p }; // 记录
      g.log.push(SEAT[p] + " 打 " + R.tileName(tile)); // 记日志
      ev("discard", { p: p, tile: tile }); // 事件
      g.phase = "claim"; // 进入鸣牌窗口
      g.timer = g.schedule(220, function () { openClaim(p, tile); }); // 稍作停顿再判定鸣牌
    } // 结束 doDiscard

    function openClaim(from, tile) { // 鸣牌窗口
      if (!g.running) { return; } // 已结束
      const cands = []; // 候选动作
      for (let i = 1; i < 4; i++) { // 遍历其他三家
        const p = (from + i) % 4; // 座位
        const pl = g.players[p]; // 状态
        const mn = meldN(p); // 副露
        const ctx = ctxOf(p); // 上下文
        const win = Y.solve(Object.assign({}, ctx, { tiles: pl.hand.concat([tile]), winTile: tile, tsumo: false })); // 荣和判定
        if (win) { cands.push({ p: p, kind: "ron", result: win, pri: 3, from: from, tile: tile }); } // 荣和优先级最高（推倒胡不振听）
        const c = R.countsOf(pl.hand); // 计数
        const tk = R.bk(tile); // 牌种
        if (c[tk] >= 3 && AI.wantKan(pl.hand, mn, tile, {})) { cands.push({ p: p, kind: "kan", pri: 2, from: from, tile: tile }); } // 大明杠
        else if (c[tk] >= 2) { cands.push({ p: p, kind: "pon", pri: 2, from: from, tile: tile }); } // 碰
        if (p === (from + 1) % 4 && tk < 27) { // 仅下家可吃
          const n = R.numOf(tk), s = R.suitOf(tk) * 9; // 点数与基址
          [[n - 2, n - 1], [n - 1, n + 1], [n + 1, n + 2]].forEach(function (pair) { // 三种吃法
            const a = s + pair[0] - 1, b = s + pair[1] - 1; // 搭档牌种
            if (pair[0] < 1 || pair[1] > 9) { return; } // 越界
            if (c[a] > 0 && c[b] > 0) { cands.push({ p: p, kind: "chi", pri: 1, from: from, tile: tile, pair: [a, b] }); } // 可吃
          }); // 结束吃法
        } // 结束吃
      } // 结束遍历

      if (!cands.length) { nextTurn(from); return; } // 无人鸣牌 → 下家
      cands.sort(function (a, b) { return b.pri - a.pri; }); // 按优先级
      const top = cands[0]; // 最高优先
      const humanCands = cands.filter(function (x) { return x.p === g.human; }); // 玩家候选
      if (humanCands.length && humanCands[0].pri === top.pri) { // 玩家有机会
        g.wait = true; // 等玩家
        g.pending = { kind: "claim", options: humanCands, all: cands, from: from, tile: tile }; // 打包
        ev("waitClaim", { options: humanCands, tile: tile, from: from }); // 通知 UI
        return; // 结束
      } // 结束玩家优先
      resolveClaim(top); // AI 直接执行
    } // 结束 openClaim

    function resolveClaim(c) { // 执行鸣牌/和牌
      if (c.kind === "ron") { doWin(c.p, c.from, c.result, false); return; } // 荣和
      if (c.kind === "kan") { doKan(c.p, c.tile, "open", c.from); return; } // 大明杠
      if (c.kind === "pon") { doPon(c.p, c.tile, c.from); return; } // 碰
      if (c.kind === "chi") { doChi(c.p, c.tile, c.pair, c.from); return; } // 吃
    } // 结束 resolveClaim

    /* ================= 五、鸣牌执行 ================= */
    function removeFromHand(p, kind, n) { // 从手牌移除 n 张指定牌种
      const pl = g.players[p]; // 状态
      for (let i = 0; i < n; i++) { // 逐张
        const idx = pl.hand.map(R.bk).indexOf(kind); // 定位
        if (idx >= 0) { pl.hand.splice(idx, 1); } // 移除
      } // 结束
      pl.drawn = null; // 鸣牌后摸牌标记失效
    } // 结束 removeFromHand

    function doPon(p, tile, from) { // 碰
      removeFromHand(p, R.bk(tile), 2); // 移除两张
      const pl = g.players[p]; // 状态
      pl.melds.push({ type: "pon", k: R.bk(tile), open: true, tiles: [R.bk(tile), R.bk(tile), R.bk(tile)], from: from }); // 记录副露
      takeFromRiver(from); // 从放铳者牌河移走该牌
      pl.hand = R.sortTiles(pl.hand); // 理牌
      g.log.push(SEAT[p] + " 碰 " + R.tileName(tile)); // 日志
      ev("pon", { p: p, tile: tile, from: from }); // 事件
      g.turn = p; g.phase = "discard"; // 轮到鸣牌者打牌（不摸）
      afterMeld(p, true); // 进入打牌流程
    } // 结束 doPon

    function doChi(p, tile, pair, from) { // 吃
      removeFromHand(p, pair[0], 1); removeFromHand(p, pair[1], 1); // 移除两张
      const pl = g.players[p]; // 状态
      const tiles = [R.bk(pair[0]), R.bk(tile), R.bk(pair[1])].sort(function (a, b) { return R.bk(a) - R.bk(b); }); // 组成顺子
      pl.melds.push({ type: "chi", k: R.bk(tiles[0]), open: true, tiles: tiles, from: from }); // 记录
      takeFromRiver(from); // 移走该牌
      pl.hand = R.sortTiles(pl.hand); // 理牌
      g.log.push(SEAT[p] + " 吃 " + R.tileName(tile)); // 日志
      ev("chi", { p: p, tile: tile, pair: pair, from: from }); // 事件
      g.turn = p; g.phase = "discard"; // 轮到打牌
      afterMeld(p, false); // 进入打牌流程
    } // 结束 doChi

    function afterMeld(p, canKan) { // 鸣牌后的打牌流程（玩家等待 / AI 自动）
      if (p === g.human) { // 玩家
        g.wait = true; // 等待
        g.pending = { kind: "discard", options: { canTsumo: false, tsumoResult: null, ankan: -1, canKan: !!canKan } }; // 只能打牌
        ev("waitPlayer", { p: p, options: g.pending.options }); // 通知
        return; // 结束
      } // 结束玩家
      g.timer = g.schedule(420, function () { aiAfterMeld(p); }); // AI 自动打牌
    } // 结束 afterMeld

    function doKan(p, tile, type, from) { // 杠（open 大明杠 / ankan 暗杠 / added 加杠）
      const pl = g.players[p]; // 状态
      const k = R.bk(tile); // 牌种
      if (type === "added") { // 加杠：先查抢杠和（国标 8 番）
        const rob = findChankan(p, k); // 三家能否荣和这张加杠牌
        if (rob) { // 有抢杠
          removeFromHand(p, k, 1); // 加杠的那张离手
          ev("chankan", { p: rob.p, from: p, tile: k }); // 抢杠事件
          doWin(rob.p, p, rob.result, false, { chankan: true }); // 按抢杠和结算
          return; // 结束
        } // 结束抢杠
      } // 结束加杠检查
      if (type === "open") { removeFromHand(p, k, 3); takeFromRiver(from); } // 大明杠：移三张 + 收牌
      else if (type === "ankan") { removeFromHand(p, k, 4); } // 暗杠：移四张
      else { // 加杠：已有碰，补一张
        const m = pl.melds.filter(function (x) { return x.type === "pon" && x.k === k; })[0]; // 找碰
        if (m) { m.type = "kan"; m.kanType = "added"; m.tiles = [k, k, k, k]; } // 升级为杠
        removeFromHand(p, k, 1); // 移除手牌一张
      } // 结束加杠
      if (type !== "added") { // 新建杠组
        pl.melds.push({ type: "kan", k: k, open: type === "open", kanType: type, tiles: [k, k, k, k], from: from }); // 记录
      } // 结束
      pl.hand = R.sortTiles(pl.hand); // 理牌
      g.log.push(SEAT[p] + (type === "ankan" ? " 暗杠 " : type === "added" ? " 加杠 " : " 大明杠 ") + R.tileName(tile)); // 日志
      ev("kan", { p: p, tile: tile, type: type }); // 事件
      g.turn = p; // 仍是同一家
      g.phase = "draw"; // 补摸底牌
      g.timer = g.schedule(460, function () { drawPhase(true); }); // 稍后补牌
    } // 结束 doKan

    function findChankan(p, k) { // 抢杠和：其他三家能否荣和这张加杠牌
      for (let i = 1; i < 4; i++) { // 按打牌顺序找
        const q = (p + i) % 4; // 座位
        const pl = g.players[q]; // 状态
        const ctx = ctxOf(q, { chankan: true }); // 上下文
        const win = Y.solve(Object.assign({}, ctx, { tiles: pl.hand.concat([k]), winTile: k, tsumo: false })); // 判定
        if (win) { return { p: q, result: win }; } // 命中即返回（按顺序最近者优先）
      } // 结束遍历
      return null; // 无人抢杠
    } // 结束 findChankan

    function takeFromRiver(from) { // 从牌河移除被鸣走的那张
      const rv = g.players[from].river; // 牌河
      if (rv.length) { rv.pop(); } // 去掉最后一张（刚打出的）
    } // 结束 takeFromRiver

    function aiAfterMeld(p) { // AI 鸣牌后的打牌
      const pl = g.players[p]; // 状态
      const vis = AI.visibleCounts({ rivers: g.players.map(function (x) { return x.river; }), melds: g.players.map(function (x) { return x.melds; }) }); // 可见牌
      const threats = g.players.filter(function (x) { return x.seat !== p && x.melds.length >= 2; }); // 威胁家
      const ctx2 = { visible: vis, threat: threats.length > 0, defense: threats.length > 0 ? 1 : 0, style: pl.style, riichiRivers: [].concat.apply([], threats.map(function (x) { return x.river; })) }; // 上下文
      const k = AI.chooseDiscard(pl.hand, meldN(p), ctx2); // 选择
      doDiscard(p, findTile(pl.hand, k)); // 打出
    } // 结束 aiAfterMeld

    function nextTurn(from) { // 轮到下一家
      if (!g.running) { return; } // 已结束
      g.turn = (from + 1) % 4; // 下家
      g.phase = "draw"; // 摸牌阶段
      g.timer = g.schedule(200, function () { drawPhase(false); }); // 稍作停顿
    } // 结束 nextTurn

    /* ================= 六、和牌 ================= */
    function doWin(p, from, result, tsumo, extra) { // 结算和牌
      g.running = false; g.phase = "end"; // 停表
      const pts = result.points; // 支付结构 {kind, each, total}
      if (tsumo) { // 自摸：三家各付一份
        for (let i = 0; i < 4; i++) { // 逐家
          if (i === p) { continue; } // 跳过自己
          g.scores[i] -= pts.each; g.scores[p] += pts.each; // 移动
        } // 结束
      } else { // 点炮：放铳者包三家
        g.scores[from] -= pts.total; // 放铳者付
        g.scores[p] += pts.total; // 和牌者收
      } // 结束荣和
      const nextDealer = (p === g.dealer) ? g.dealer : (g.dealer + 1) % 4; // 庄家胡牌连庄，否则轮庄
      g.settleInfo = { winner: p, from: from, tsumo: tsumo, result: result, scores: g.scores.slice(), nextDealer: nextDealer, chankan: !!(extra && extra.chankan) }; // 结算信息
      g.log.push(SEAT[p] + (tsumo ? " 自摸" : (extra && extra.chankan ? " 抢杠和" : " 和牌")) + "：" + result.yaku.map(function (y) { return y.name; }).join("·") + " " + result.han + " 番"); // 日志
      ev("win", g.settleInfo); // 事件
    } // 结束 doWin

    /* ================= 七、荒庄 ================= */
    function doRyuukyoku() { // 牌山摸完 → 荒庄（国标不发罚符）
      g.running = false; g.phase = "end"; // 停表
      const tenpai = []; // 听牌者（仅供展示）
      for (let p = 0; p < 4; p++) { // 逐家
        const hand = g.players[p].hand; // 手牌
        if (R.waitsOf(hand, meldN(p)).length > 0) { tenpai.push(p); } // 听牌
      } // 结束
      g.settleInfo = { ryuukyoku: true, tenpai: tenpai, scores: g.scores.slice(), nextDealer: g.dealer }; // 荒庄连庄（国标口径）
      g.log.push("荒庄：" + (tenpai.length ? tenpai.map(function (p) { return SEAT[p]; }).join("·") + " 听牌" : "全员未听")); // 日志
      ev("ryuukyokuEnd", g.settleInfo); // 事件
    } // 结束 doRyuukyoku

    /* ================= 八、玩家操作接口 ================= */
    g.act = function (type, payload) { // 玩家动作入口
      if (!g.wait) { return false; } // 非等待态忽略
      const p = g.human; // 玩家座位
      const pl = g.players[p]; // 状态
      if (type === "discard") { // 打牌
        g.wait = false; // 解除等待
        g.pending = null; // 清待决
        doDiscard(p, payload); // 执行
        return true; // 成功
      } // 结束打牌
      if (type === "tsumo") { // 自摸
        const opts = g.pending && g.pending.options; // 待决
        if (!opts || !opts.canTsumo) { return false; } // 不可
        g.wait = false; g.pending = null; // 清
        doWin(p, -1, opts.tsumoResult, true); // 结算
        return true; // 成功
      } // 结束自摸
      if (type === "ankan") { // 暗杠
        const opts = g.pending && g.pending.options; // 待决
        if (!opts || opts.ankan < 0) { return false; } // 不可
        g.wait = false; g.pending = null; // 清
        doKan(p, opts.ankan, "ankan", null); // 执行
        return true; // 成功
      } // 结束暗杠
      if (type === "pass") { // 放弃鸣牌
        const pend = g.pending; // 待决
        g.wait = false; g.pending = null; // 清
        if (pend && pend.kind === "claim") { // 鸣牌窗口
          const rest = pend.all.filter(function (c) { return c.p !== p; }); // 其他家的候选
          if (rest.length) { resolveClaim(rest.sort(function (a, b) { return b.pri - a.pri; })[0]); } // 让 AI 继续
          else { nextTurn(pend.from); } // 无人鸣牌 → 下家
        } // 结束
        return true; // 成功
      } // 结束放弃
      if (type === "claim") { // 执行鸣牌
        const pend = g.pending; // 待决
        if (!pend || pend.kind !== "claim") { return false; } // 不可
        const opt = pend.options.filter(function (c) { return c.kind === payload; })[0] || pend.options[0]; // 选择动作
        g.wait = false; g.pending = null; // 清
        resolveClaim(opt); // 执行
        return true; // 成功
      } // 结束鸣牌
      if (type === "kan") { // 加杠（手里有碰且摸到第四张）
        const opts = g.pending && g.pending.options; // 待决
        if (!opts || !opts.canKan) { return false; } // 不可
        const cand = pl.melds.filter(function (m) { return m.type === "pon" && pl.hand.some(function (t) { return R.bk(t) === m.k; }); })[0]; // 找可加杠的碰
        if (!cand) { return false; } // 无
        g.wait = false; g.pending = null; // 清
        doKan(p, cand.k, "added", null); // 执行
        return true; // 成功
      } // 结束加杠
      return false; // 未识别
    }; // 结束 act

    g.dispose = function () { // 销毁（离开视图）
      g.running = false; g.wait = false; // 停表
      g.queue.length = 0; g.timer = null; // 清空调度队列
    }; // 结束 dispose

    g.helper = { meldN: meldN, seatWind: seatWind, isDealer: isDealer, liveWall: liveWall, SEAT: SEAT }; // 暴露小工具给 UI
    return g; // 返回对局对象
  } // 结束 createGame

  root.MJ = { createGame: createGame, buildWall: buildWall, SEAT: SEAT, STYLE: STYLE }; // 导出
  if (typeof module !== "undefined" && module.exports) { module.exports = root.MJ; } // Node 出口
})(typeof window !== "undefined" ? window : globalThis); // 作用域根

