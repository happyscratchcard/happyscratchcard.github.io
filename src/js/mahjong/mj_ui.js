// ================= 6.2 十六轮：麻将 · 视图编排（HUD / 操作 / 结算） =================
// 与规则内核、3D 场景的分工：本文件只做「把状态翻译成 DOM」与「把点击翻译成动作」。
(function () { // 自执行：不向外暴露任何变量
  "use strict"; // 严格模式
  if (!window.MJ || !window.MJScene || typeof viewHooks === "undefined") { return; } // 依赖缺失（例如 WebGL 关闭）时不初始化

  const SEAT_LABEL = ["你", "下家", "对家", "上家"]; // 座位名
  let scene = null; // 3D 场景句柄
  let game = null; // 对局句柄
  let rafId = null; // 帧循环句柄
  let lastTs = 0; // 上一帧时间
  let started = false; // 是否已开过局

  function $(id) { return document.getElementById(id); } // 取节点

  /* ================= 一、场景懒加载 ================= */
  function ensureScene() { // 建立 3D 场景
    if (scene) { return scene; } // 已建
    const host = $("mjStage"); // 容器
    if (!host || !window.THREE) { return null; } // 缺失
    try { scene = window.MJScene.create(host); } catch (e) { console.warn("[MJ] 场景创建失败", e); return null; } // 创建
    window.__mjScene = scene; // 调试/自检出口（无头验证用）
    scene.onPick(function (kind) { // 点击手牌
      if (!game || !game.wait || !game.pending || game.pending.kind !== "discard") { return; } // 非等待出牌态忽略
      const hand = game.players[0].hand; // 玩家的手牌（具体牌编码，赤牌 34~36）
      let tile = null; // 命中牌
      for (let i = 0; i < hand.length; i++) { if (window.MJR.bk(hand[i]) === kind && !window.MJR.isRed(hand[i])) { tile = hand[i]; break; } } // 优先非赤
      if (tile == null) { for (let i = 0; i < hand.length; i++) { if (window.MJR.bk(hand[i]) === kind) { tile = hand[i]; break; } } } // 再取赤牌
      if (tile == null) { return; } // 未找到（理论上不会）
      game.act("discard", tile); // 出牌（引擎按具体牌编码从手牌移除）
    }); // 结束拾取
    const btns = document.querySelectorAll("#viewMahjong .mjViewBtn"); // 视角按钮（6.2 十八轮）
    for (let i = 0; i < btns.length; i++) { // 逐个绑定
      btns[i].addEventListener("click", function () { // 点击切换机位
        if (scene) { scene.setView(btns[i].getAttribute("data-mjview")); } // 交给场景做缓动过渡
      }); // 结束点击
    } // 结束绑定
    scene.onView(function (name) { // 视角变化 → 高亮对应按钮（手动拖动时 name 为空，全部熄灭）
      for (let i = 0; i < btns.length; i++) { btns[i].classList.toggle("on", btns[i].getAttribute("data-mjview") === name); } // 同步高亮
    }); // 结束视角回调
    return scene; // 返回
  } // 结束 ensureScene

  /* ================= 二、HUD 渲染 ================= */
  function renderHud() { // 刷新顶部信息
    if (!game) { return; } // 无对局
    const elRound = $("mjRound"); if (elRound) { elRound.textContent = "第 " + (game.handNo || 1) + " 局"; } // 局数
    const elWall = $("mjWall"); if (elWall) { elWall.textContent = "余 " + game.wall.length; } // 剩余张数
    const elHint = $("mjHint"); if (elHint) { elHint.textContent = hintText(); } // 玩家听牌/向听提示
    for (let p = 0; p < 4; p++) { // 四家点数
      const el = $("mjS" + p); // 节点
      if (el) { el.textContent = game.scores[p]; } // 点数
      const tag = $("mjT" + p); // 庄家标记
      if (tag) { tag.textContent = p === game.dealer ? "庄" : ""; } // 标记
    } // 结束四家
  } // 结束 renderHud

  const hintCache = { sig: "", text: "--" }; // 手牌状态缓存（避免每次事件都重算听牌）
  function hintText() { // 玩家手牌状态（听什么 / 还差几向听）
    if (!game || !game.players.length) { return "--"; } // 无对局
    const pl = game.players[0]; // 玩家
    const mn = pl.melds.length; // 副露组数
    const hand = pl.hand; // 手牌
    if (!hand.length) { return "--"; } // 尚未发牌
    const sig = hand.join(",") + "|" + mn; // 手牌指纹
    if (sig === hintCache.sig) { return hintCache.text; } // 命中缓存
    let text = "--"; // 结果
    if (hand.length % 3 === 2) { // 处于打牌回合（3N+2 张）
      const waits = window.MJR.waitsOf(hand, mn); // 听牌列表
      if (waits.length) { // 已听牌
        const names = waits.map(function (k) { return window.MJR.tileName(k); }); // 牌名
        text = "听 " + names.slice(0, 4).join(" ") + (names.length > 4 ? " 等" : ""); // 最多列四种
      } else { // 未听牌
        text = "向听 " + window.MJR.shanten(window.MJR.countsOf(hand), mn); // 显示向听
      } // 结束未听牌
    } else { // 尚在摸牌前（3N+1 张）
      text = "向听 " + window.MJR.shanten(window.MJR.countsOf(hand), mn); // 显示向听
    } // 结束分支
    hintCache.sig = sig; hintCache.text = text; // 写入缓存
    return text; // 返回
  } // 结束 hintText

  /* ================= 三、操作按钮 ================= */
  function clearActions() { const box = $("mjActions"); if (box) { box.innerHTML = ""; } } // 清空
  function addBtn(label, act, cls) { // 追加一个按钮
    const box = $("mjActions"); if (!box) { return; } // 容器
    const b = document.createElement("button"); // 创建
    b.className = "mjBtn" + (cls ? " " + cls : ""); // 样式
    b.textContent = label; // 文案
    b.addEventListener("click", function () { // 点击
      if (!game) { return; } // 无对局
      if (act === "claim") { game.act("claim", label); return; } // 鸣牌（按类型取）
      game.act(act); // 其余动作
      clearActions(); // 收起按钮
    }); // 结束点击
    box.appendChild(b); // 加入
  } // 结束 addBtn

  function renderSelfActions(opts) { // 摸牌后的自身动作
    clearActions(); // 清空
    if (!opts) { return; } // 无
    if (opts.canTsumo) { addBtn("胡", "tsumo", "gold"); } // 自摸和牌（国标推倒胡：能拆开就能胡）
    if (opts.ankan >= 0) { addBtn("暗杠", "ankan"); } // 暗杠
    if (opts.canKan) { addBtn("加杠", "kan"); } // 加杠
    const tip = $("mjTip"); // 提示条
    if (tip) { tip.textContent = opts.canTsumo ? "可以胡牌！点「胡」结算，也可以继续打牌做大牌型" : "点击手牌出牌 · 拖动画面转视角 · 滚轮缩放"; } // 文案
  } // 结束 renderSelfActions

  function renderClaim(opts, tile) { // 鸣牌窗口
    clearActions(); // 清空
    const tip = $("mjTip"); if (tip) { tip.textContent = "可以鸣 " + window.MJR.tileName(tile) + "：" + opts.map(function (o) { return o.kind === "ron" ? "胡" : o.kind === "pon" ? "碰" : o.kind === "kan" ? "杠" : "吃"; }).join(" / "); } // 提示
    opts.forEach(function (o) { // 逐个候选
      const label = o.kind === "ron" ? "胡" : o.kind === "pon" ? "碰" : o.kind === "kan" ? "杠" : "吃"; // 文案
      addBtn(label, "claim", o.kind === "ron" ? "gold" : ""); // 按钮
    }); // 结束候选
    addBtn("过", "pass", "ghost"); // 跳过
  } // 结束 renderClaim

  /* ================= 四、音效 ================= */
  function sfx(kind) { // 轻音效（复用全局 tickTone）
    if (typeof window.tickTone !== "function") { return; } // 无音效系统
    try { // 容错
      if (kind === "tile") { window.tickTone(420, 0.05, 0.05, "square", "ui"); } // 落牌
      else if (kind === "draw") { window.tickTone(620, 0.04, 0.035, "triangle", "ui"); } // 摸牌
      else if (kind === "claim") { window.tickTone(760, 0.07, 0.06, "square", "win"); } // 鸣牌
      else if (kind === "riichi") { window.tickTone(880, 0.16, 0.07, "sine", "win"); } // 立直
      else if (kind === "win") { [660, 880, 1100].forEach(function (f, i) { setTimeout(function () { window.tickTone(f, 0.18, 0.08, "sine", "win"); }, i * 120); }); } // 和牌
    } catch (e) {} // 静默
  } // 结束 sfx

  /* ================= 五、结算面板 ================= */
  function showResult(d) { // 展示结算
    const mask = $("mjResult"); // 遮罩
    const box = $("mjResBody"); // 内容
    if (!mask || !box) { return; } // 缺失
    if (d.ryuukyoku) { // 荒庄
      box.innerHTML = "<h3>荒庄</h3><p class='mjResSub'>" + (d.tenpai.length ? d.tenpai.map(function (p) { return SEAT_LABEL[p]; }).join("、") + " 听牌" : "全员未听") + " · 庄家连庄，不计罚符</p>"; // 文案
    } else { // 和牌
      const r = d.result; // 结果
      const yaku = r.yaku.map(function (y) { return "<span class='mjYk'>" + y.name + " <em>" + y.fan + "</em></span>"; }).join(""); // 番种标签
      const how = d.tsumo ? "自摸" : (d.chankan ? "抢杠和" : "胡牌"); // 和牌方式
      const payText = d.tsumo ? "每家付 " + r.points.each + " 分" : "放铳者付 " + r.points.total + " 分（包三家）"; // 支付说明
      box.innerHTML = "<h3>" + how + " · " + SEAT_LABEL[d.winner] + "</h3>" +
        "<div class='mjYakuList'>" + yaku + "</div>" +
        "<p class='mjResSub'>共 <b>" + r.han + "</b> 番 · " + payText + "</p>" +
        "<p class='mjResPts'>" + d.scores.map(function (v, i) { return SEAT_LABEL[i] + " " + v; }).join("　") + "</p>"; // 拼装
    } // 结束和牌
    mask.classList.add("show"); // 显示
    sfx("win"); // 音效
  } // 结束 showResult

  /* ================= 六、开局 ================= */
  function newGame() { // 开一局
    ensureScene(); // 场景
    const prev = game; // 上一局（用于继承点数与庄位）
    const prevScores = prev ? prev.scores.slice() : [25000, 25000, 25000, 25000]; // 继承点数（先取再销毁）
    const dealer = prev && prev.settleInfo ? prev.settleInfo.nextDealer : (prev ? prev.dealer : 0); // 庄家：胡牌连庄 / 荒庄连庄 / 否则轮庄
    const handNo = prev ? (prev.handNo || 1) + 1 : 1; // 局数递增
    if (prev) { prev.dispose(); } // 清理旧局
    game = window.MJ.createGame({ scores: prevScores, dealer: dealer, round: 0, handNo: handNo }); // 新局（国标推倒胡）
    window.__mjGame = game; // 调试/自检出口（无头验证用，不影响运行）
    game.emit = function (type, d) { // 事件回调
      if (scene) { scene.sync(game); } // 同步视觉
      renderHud(); // 刷新 HUD
      if (type === "wash") { scene && scene.scatter(); } // 洗牌散牌
      else if (type === "draw") { sfx("draw"); } // 摸牌音
      else if (type === "discard") { sfx("tile"); } // 落牌音
      else if (type === "pon" || type === "chi" || type === "kan") { sfx("claim"); } // 鸣牌音
      else if (type === "chankan") { sfx("claim"); } // 抢杠
      else if (type === "waitPlayer") { renderSelfActions(d.options); } // 玩家操作
      else if (type === "waitClaim") { renderClaim(d.options, d.tile); } // 鸣牌选择
      else if (type === "win") { clearActions(); showResult(d); } // 和牌结算
      else if (type === "ryuukyokuEnd") { clearActions(); showResult(d); } // 荒庄结算
      else if (type === "promptTsumo") { /* 自摸提示已由按钮承担 */ } // 预留
    }; // 结束回调
    started = true; // 标记
    const mask = $("mjResult"); if (mask) { mask.classList.remove("show"); } // 收起结算
    clearActions(); // 清按钮
    game.start(); // 开局
    if (scene) { scene.sync(game); } // 初次同步
    renderHud(); // 刷新
  } // 结束 newGame

  /* ================= 七、帧循环 ================= */
  function tickLoop(ts) { // 驱动逻辑时钟
    rafId = requestAnimationFrame(tickLoop); // 续帧
    const dt = lastTs ? Math.min(50, ts - lastTs) : 16; // 帧间隔
    lastTs = ts; // 记录
    if (!game) { return; } // 无对局
    game.tick(dt); // 推进逻辑
    if (scene) { scene.sync(game); } // 同步视觉（指纹相同会立即返回）
  } // 结束 tickLoop
  function startLoop() { if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(tickLoop); } } // 启动
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } } // 停止

  /* ================= 八、视图钩子 ================= */
  viewHooks.enter["Mahjong"] = function () { // 进入
    ensureScene(); // 建场景
    if (scene) { scene.resize(); } // 重新适配尺寸
    const over = !game || !game.running; // 未开局 / 已结束
    if (over) { // 需要「开局」按钮
      const tip = $("mjTip"); if (tip) { tip.textContent = (started ? "点「开局」再来一局" : "点「开局」开始国标推倒胡") + " · 可拖动画面转视角"; } // 提示
      const box = $("mjActions"); // 按钮区
      if (box && !box.children.length) { // 空则放开局按钮
        const b = document.createElement("button"); b.className = "mjBtn gold"; b.textContent = "开局"; // 开局按钮
        b.addEventListener("click", function () { b.remove(); newGame(); }); // 绑定
        box.appendChild(b); // 加入
      } // 结束
    } // 结束判断
    startLoop(); // 启动帧循环
    renderHud(); // 刷新
  }; // 结束进入钩子

  viewHooks.leave["Mahjong"] = function () { // 离开
    stopLoop(); // 停帧
    clearActions(); // 收按钮
  }; // 结束离开钩子

  document.addEventListener("DOMContentLoaded", function () { // DOM 就绪后绑定结算面板按钮
    const again = $("mjAgain"); // 再来一局
    const close = $("mjClose"); // 关闭
    if (again) { again.addEventListener("click", function () { newGame(); }); } // 再来
    if (close) { close.addEventListener("click", function () { const m = $("mjResult"); if (m) { m.classList.remove("show"); } }); } // 关闭
  }); // 结束绑定
})(); // 结束模块

