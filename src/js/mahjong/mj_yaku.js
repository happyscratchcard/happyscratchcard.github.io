// ================= 6.2 十六轮：麻将 · 役种 / 国标番种（推倒胡） =================
// 6.2 十九轮重写：日式立直役种 → 国标麻将番种（推倒胡）。
// 规则界定（本文件即唯一裁判口径）：
//   1) 136 张牌，无花牌、无赤宝牌；不设「立直 / 宝牌 / 符 / 振听」，凑齐 4 副 + 1 将即可和牌；
//   2) 番种按《中国麻将竞赛规则》番值累加（88 / 64 / 48 / 32 / 24 / 16 / 12 / 8 / 6 / 4 / 2 / 1）；
//   3) 不做 8 番起和（推倒即胡），零番牌型按「平胡 1 番」保底；
//   4) 计分走国标换算档：1~7 番逐番翻倍（8→512），8 番以上分档封顶（1024 / 2048 / 4096 / 6144 / 8192 / 12288 / 16384）；
//   5) 自摸三家各付一份，点炮由放铳者包三家（推倒胡通行口径）。
// 纯计算模块：不碰 DOM、不碰 THREE，可在 Node 里直接单测。
(function (root) { // 自执行作用域
  "use strict"; // 严格模式
  const R = root.MJR; // 规则内核引用
  if (!R) { return; } // 内核缺失时退出（构建顺序错误保护）

  const DRAGON = [31, 32, 33]; // 箭牌牌种：白 / 发 / 中
  const GREEN_K = [19, 20, 21, 23, 25, 32]; // 绿一色允许的牌：2/3/4/6/8 条 + 发

  /* ================= 一、计分档（国标换算分） ================= */
  function scoreOf(fan) { // 番数 → 单家分值
    const f = Math.max(1, Math.min(88, fan | 0)); // 至少 1 番（平胡保底），至多 88 番（封顶）
    if (f >= 88) { return 16384; } // 88 番
    if (f >= 64) { return 12288; } // 64 番档
    if (f >= 48) { return 8192; } // 48 番档
    if (f >= 32) { return 6144; } // 32 番档
    if (f >= 24) { return 4096; } // 24 番档
    if (f >= 16) { return 2048; } // 16 番档
    if (f >= 8) { return 1024; } // 8 番档
    return 8 * Math.pow(2, f - 1); // 1~7 番：8 / 16 / 32 / 64 / 128 / 256 / 512
  } // 结束 scoreOf

  function pointsOf(score, tsumo) { // 支付结构：自摸三家各付 / 点炮者包三家
    if (tsumo) { return { kind: "tsumo", each: score, total: score * 3 }; } // 自摸：三家各一份
    return { kind: "ron", total: score * 3, each: score }; // 点炮：放铳者付三份（包三家）
  } // 结束 pointsOf

  /* ================= 二、拆解 → 统一面子 + 和牌张归属 ================= */
  // 返回 { sets, winIdx, winPos }：winPos = low/mid/high（顺子内位置）/ kou（刻子）/ pair（单钓将）
  function buildSets(decomp, winTile, tsumo) { // decomp: 规则内核拆解；winTile: 和牌张
    const w = R.bk(winTile); // 和牌牌种
    const sets = decomp.sets.map(function (s) { // 转统一结构
      return { t: s.t, k: s.k, open: false, kan: false, tiles: s.t === "k" ? [s.k, s.k, s.k] : [s.k, s.k + 1, s.k + 2] }; // 手牌面子默认全暗
    }); // 结束映射
    let winIdx = -1, winPos = ""; // 和牌张所在面子与位置
    for (let i = 0; i < sets.length; i++) { // 先找顺子（便于判边张 / 坎张 / 两面）
      const s = sets[i]; // 当前面子
      if (s.t !== "s") { continue; } // 只看顺子
      if (w >= s.k && w <= s.k + 2) { winIdx = i; winPos = w === s.k ? "low" : (w === s.k + 1 ? "mid" : "high"); break; } // 命中
    } // 结束顺子扫描
    if (winIdx < 0) { // 顺子里没有 → 找刻子
      for (let i = 0; i < sets.length; i++) { // 遍历
        if (sets[i].t === "k" && sets[i].k === w) { winIdx = i; winPos = "kou"; break; } // 命中刻子
      } // 结束遍历
    } // 结束刻子扫描
    if (winIdx < 0) { winPos = "pair"; } // 面子都不含 → 和牌张只能在雀头（单钓将）
    if (winIdx >= 0 && !tsumo && sets[winIdx].t === "k") { sets[winIdx].open = true; } // 荣和的刻子不算暗刻（国标口径）
    return { sets: sets, winIdx: winIdx, winPos: winPos }; // 返回
  } // 结束 buildSets

  /* ================= 三、番种判定（单一拆解） ================= */
  function fanOf(ctx, sets, pair, type, winInfo) { // 返回 [{name, fan}]
    const out = []; // 番种收集器
    const add = function (name, fan) { out.push({ name: name, fan: fan }); }; // 追加番种
    const menzen = !!ctx.menzen; // 是否门清（无吃碰明杠）
    const meldN = (ctx.melds || []).length; // 副露组数（暗杠也计入）
    const allTiles = ctx.allTiles; // 全部牌（含副露展开）
    const tsumo = !!ctx.tsumo; // 是否自摸
    const winPos = winInfo ? winInfo.winPos : "pair"; // 和牌张位置

    // ---- 基础分类 ----
    const shuns = sets.filter(function (s) { return s.t === "s"; }); // 顺子
    const kous = sets.filter(function (s) { return s.t === "k"; }); // 刻子（含杠）
    const kans = kous.filter(function (s) { return s.kan; }); // 杠子
    const ankans = kans.filter(function (s) { return !s.open; }); // 暗杠
    const minkans = kans.filter(function (s) { return s.open; }); // 明杠
    const ankous = kous.filter(function (s) { return !s.open; }); // 暗刻 + 暗杠
    const dragonKou = kous.filter(function (s) { return DRAGON.indexOf(s.k) >= 0; }); // 箭刻
    const windKou = kous.filter(function (s) { return s.k >= 27 && s.k <= 30; }); // 风刻
    const windPair = pair >= 27 && pair <= 30; // 风牌将
    const dragonPair = DRAGON.indexOf(pair) >= 0; // 箭牌将

    // ---- 牌面属性 ----
    const allYaochu = allTiles.every(function (k) { return R.isYaochu(k); }); // 全部幺九
    const allTerminal = allTiles.every(function (k) { return R.isTerminal(k); }); // 全部 1/9 数牌
    const allHonor = allTiles.every(function (k) { return R.isHonor(k); }); // 全字牌
    const noYaochu = allTiles.every(function (k) { return !R.isYaochu(k); }); // 断幺（无幺九无字）
    const allGreen = allTiles.every(function (k) { return GREEN_K.indexOf(R.bk(k)) >= 0; }); // 绿一色
    const suitSet = {}; // 数牌花色集合
    let hasHonor = false; // 是否有字牌
    allTiles.forEach(function (k) { if (R.isHonor(k)) { hasHonor = true; } else { suitSet[R.suitOf(k)] = 1; } }); // 统计
    const suitN = Object.keys(suitSet).length; // 花色数（0~3）
    const hasWind = allTiles.some(function (k) { return R.bk(k) >= 27 && R.bk(k) <= 30; }); // 有风牌
    const hasDragon = allTiles.some(function (k) { return DRAGON.indexOf(R.bk(k)) >= 0; }); // 有箭牌

    // ---- 结构判定 ----
    const isChiitoi = type === "chiitoi"; // 七对
    const isKokushi = type === "kokushi"; // 十三幺
    const allKou = !isChiitoi && !isKokushi && kous.length === 4; // 碰碰和（全刻）
    const pinhu = !isChiitoi && !isKokushi && shuns.length === 4 && R.isHonor(pair) === false && // 平和：四顺 + 数牌将
      (winPos === "low" || winPos === "high") && !isBianZhang(sets, winInfo, winPos); // 且为两面听（非边张）

    /* ---------- 3.1 役满 / 高档位（命中后只取最高一项，国标不叠加计分） ---------- */
    const big = []; // 高档位候选 [名称, 番]
    if (isKokushi) { big.push(["十三幺", 88]); } // 十三幺
    if (isChiitoi && isLianQiDui(ctx.tiles)) { big.push(["连七对", 88]); } // 连七对
    if (dragonKou.length === 3) { big.push(["大三元", 88]); } // 大三元
    if (windKou.length === 4) { big.push(["大四喜", 88]); } // 大四喜
    if (kans.length === 4) { big.push(["四杠", 88]); } // 四杠
    if (allGreen) { big.push(["绿一色", 88]); } // 绿一色
    if (menzen && isChuuren(ctx.tiles, ctx.winTile)) { big.push(["九莲宝灯", 88]); } // 九莲宝灯
    if (allHonor) { big.push(["字一色", 64]); } // 字一色
    if (allTerminal) { big.push(["清幺九", 64]); } // 清幺九（全 1/9 数牌）
    if (windKou.length === 3 && windPair) { big.push(["小四喜", 64]); } // 小四喜
    if (dragonKou.length === 2 && dragonPair) { big.push(["小三元", 64]); } // 小三元
    if (!isChiitoi && !isKokushi && ankous.length === 4) { big.push(["四暗刻", 64]); } // 四暗刻
    if (kans.length === 3) { big.push(["三杠", 32]); } // 三杠
    if (allYaochu && !allTerminal && !allHonor) { big.push(["混幺九", 32]); } // 混幺九

    if (big.length) { // 有高档位：取番值最高的一项
      big.sort(function (a, b) { return b[1] - a[1]; }); // 番值降序
      return { list: [{ name: big[0][0], fan: big[0][1] }], top: true }; // 直接返回
    } // 结束高档位

    /* ---------- 3.2 牌型与门清 ---------- */
    if (isChiitoi) { add("七对", 24); } // 七对
    if (allKou) { add("碰碰和", 6); } // 碰碰和
    if (menzen && tsumo) { add("不求人", 4); } // 门清自摸（含门前清与自摸，不再叠加）
    else if (menzen) { add("门前清", 2); } // 门清荣和
    else if (tsumo) { add("自摸", 1); } // 副露自摸
    if (!isChiitoi && !isKokushi && meldN === 4 && winPos === "pair") { add("全求人", 6); } // 全求人（四副露单钓）

    /* ---------- 3.3 花色构成 ---------- */
    if (suitN === 1 && !hasHonor) { add("清一色", 24); } // 清一色
    else if (suitN === 1 && hasHonor) { add("混一色", 6); } // 混一色
    if (suitN === 3 && hasWind && hasDragon) { add("五门齐", 6); } // 五门齐
    if (hasHonor && suitN < 3) { add("缺一门", 1); } // 缺一门（有字且少一种花色；清一色/混一色时按国标不重复计）
    if (!hasHonor) { add("无字", 1); } // 无字

    /* ---------- 3.4 顺子系 ---------- */
    const fQingLong = !!shuns.length && hasQingLong(shuns); // 清龙
    const fHuaLong = !!shuns.length && hasHuaLong(shuns); // 花龙
    const fSanSeTong = !!shuns.length && hasSanSeTongShun(shuns); // 三色三同顺
    const fYiSeSanTong = !!shuns.length && hasYiSeSanTongShun(shuns); // 一色三同顺
    const fYiSeSanJie = !!shuns.length && hasYiSeSanJieGao(shuns); // 一色三节高
    if (fQingLong) { add("清龙", 16); } // 清龙（同色 123+456+789）
    if (fHuaLong) { add("花龙", 8); } // 花龙（三色各一段）
    if (fSanSeTong) { add("三色三同顺", 8); } // 三色三同顺
    if (fYiSeSanTong) { add("一色三同顺", 24); } // 一色三同顺
    if (fYiSeSanJie) { add("一色三节高", 24); } // 一色三节高
    if (!!shuns.length && hasYiBanGao(shuns)) { add("一般高", 1); } // 一般高
    if (!!shuns.length && hasXiXiangFeng(shuns)) { add("喜相逢", 1); } // 喜相逢
    if (!!shuns.length && hasLianLiu(shuns)) { add("连六", 1); } // 连六
    if (!!shuns.length && hasLaoShaoFu(shuns)) { add("老少副", 1); } // 老少副
    if (pinhu) { add("平和", 2); } // 平和

    /* ---------- 3.5 刻子系 ---------- */
    if (!isChiitoi && !isKokushi) { // 刻子类只在标准型判定
      if (dragonKou.length === 2) { add("双箭刻", 6); } // 双箭刻（双箭刻优先于单箭刻）
      else if (dragonKou.length === 1) { add("箭刻", 2); } // 箭刻
      if (windKou.length === 3) { add("三风刻", 12); } // 三风刻
      if (hasSanTongKe(kous)) { add("三同刻", 16); } // 三同刻（三色同数字刻）
      if (ankous.length === 3) { add("三暗刻", 16); } // 三暗刻
      else if (ankous.length === 2) { add("双暗刻", 6); } // 双暗刻
      if (ankans.length >= 2) { add("双暗杠", 8); } // 双暗杠
      else if (ankans.length === 1) { add("暗杠", 2); } // 暗杠
      if (minkans.length >= 2) { add("双明杠", 4); } // 双明杠
      else if (minkans.length === 1) { add("明杠", 1); } // 明杠
      // 圈风刻 / 门风刻
      kous.forEach(function (s) { // 逐刻子
        if (s.k === 27 + (ctx.roundWind || 0)) { add("圈风刻", 2); } // 圈风
        if (s.k === 27 + (ctx.seatWind || 0)) { add("门风刻", 2); } // 门风
        if (R.isYaochu(s.k) && DRAGON.indexOf(s.k) < 0) { add("幺九刻", 1); } // 幺九刻（1/9 与风牌）
      }); // 结束逐刻子
    } // 结束刻子类

    /* ---------- 3.6 特殊牌型 ---------- */
    if (!isChiitoi && !isKokushi && allDaiYao(sets, pair)) { add("全带幺", 4); } // 全带幺（每副含幺九）
    if (ctx.haitei) { add("海底捞月", 8); } // 最后一张自摸
    if (ctx.rinshan) { add("杠上开花", 8); } // 杠上开花
    if (ctx.chankan) { add("抢杠和", 8); } // 抢杠和
    if (ctx.seen && ctx.seen[R.bk(ctx.winTile)] >= 3) { add("和绝张", 4); } // 和绝张（该牌场上已见三张）
    if (!isChiitoi && !isKokushi) { // 听牌形态（只影响 1 番）
      if (winPos === "pair") { add("单钓将", 1); } // 单钓将
      else if (winPos === "mid") { add("坎张", 1); } // 坎张
      else if (isBianZhang(sets, winInfo, winPos)) { add("边张", 1); } // 边张
    } // 结束听牌形态

    /* ---------- 3.7 去重（国标不重复原则的简化实现） ---------- */
    const drop = {}; // 需要剔除的番种
    if (allKou) { drop["单钓将"] = 1; } // 碰碰和已含刻子形态，不再计单钓（简化）
    if (suitN === 1 && !hasHonor) { drop["缺一门"] = 1; drop["无字"] = 1; } // 清一色不重复计
    if (allYaochu) { drop["全带幺"] = 1; } // 混幺九/清幺九已含幺九构成
    if (allHonor) { drop["缺一门"] = 1; drop["无字"] = 1; } // 字一色不重复计
    if (dragonKou.length >= 2) { drop["箭刻"] = 1; } // 双箭刻覆盖单箭刻
    if (windKou.length >= 3) { drop["幺九刻"] = 1; } // 三风刻覆盖风牌幺九刻
    if (fQingLong) { drop["连六"] = 1; drop["老少副"] = 1; } // 清龙已含同色连三段，不重复计
    if (fYiSeSanTong) { drop["一般高"] = 1; } // 一色三同顺已含一般高
    if (fYiSeSanJie) { drop["连六"] = 1; } // 一色三节高已含连六
    if (fSanSeTong) { drop["喜相逢"] = 1; } // 三色三同顺覆盖喜相逢

    const final = out.filter(function (y) { return !drop[y.name]; }); // 过滤
    if (!final.length) { final.push({ name: "平胡", fan: 1 }); } // 推倒胡保底：零番牌型按平胡 1 番
    const merged = []; // 同名番种合并（如两个幺九刻各 1 番 → 幺九刻 2 番）
    final.forEach(function (y) { // 逐项
      const hit = merged.filter(function (m) { return m.name === y.name; })[0]; // 找同名
      if (hit) { hit.fan += y.fan; } else { merged.push({ name: y.name, fan: y.fan }); } // 累加或新增
    }); // 结束合并
    return { list: merged, top: false }; // 返回
  } // 结束 fanOf

  /* ================= 四、各类结构判定 ================= */
  function isBianZhang(sets, winInfo, winPos) { // 边张：123 听 3 / 789 听 7
    if (!winInfo || winInfo.winIdx < 0) { return false; } // 无归属面子
    const s = sets[winInfo.winIdx]; // 和牌张所在面子
    if (!s || s.t !== "s") { return false; } // 非顺子
    const n = R.numOf(s.k); // 顺子起点数字
    if (winPos === "high" && n === 1) { return true; } // 12 听 3
    if (winPos === "low" && n === 7) { return true; } // 89 听 7
    return false; // 其余为两面
  } // 结束 isBianZhang

  function isLianQiDui(tiles) { // 连七对：七对且七种牌同花色连续
    const c = R.countsOf(tiles); // 计数
    const kinds = []; // 对子牌种
    for (let i = 0; i < 34; i++) { if (c[i] === 2) { kinds.push(i); } else if (c[i] !== 0) { return false; } } // 必须恰好七种各两张
    if (kinds.length !== 7) { return false; } // 数量校验
    const s = R.suitOf(kinds[0]); // 花色
    if (kinds.some(function (k) { return R.isHonor(k) || R.suitOf(k) !== s; })) { return false; } // 必须同花色
    for (let i = 1; i < 7; i++) { if (kinds[i] !== kinds[i - 1] + 1) { return false; } } // 必须连续
    return true; // 命中
  } // 结束 isLianQiDui

  function isChuuren(tiles, winTile) { // 九莲宝灯：门清、清一色、1112345678999 + 任意同花色一张
    const w = R.bk(winTile); // 和牌张
    if (R.isHonor(w)) { return false; } // 必须数牌
    const suit = R.suitOf(w); // 花色
    if (!tiles.every(function (k) { return R.suitOf(k) === suit; })) { return false; } // 必须同一花色
    const c = new Array(9).fill(0); // 点数计数
    tiles.forEach(function (k) { c[R.numOf(k) - 1]++; }); // 累加
    if (c[0] < 3 || c[8] < 3) { return false; } // 前后各至少三张
    for (let i = 1; i < 8; i++) { if (c[i] < 1) { return false; } } // 中间七种各至少一张
    return tiles.length === 14; // 总张数
  } // 结束 isChuuren

  function startOf(s) { return s.k % 9; } // 顺子起点（0~6）
  function suitOfStart(s) { return R.suitOf(s.k); } // 顺子花色

  function hasQingLong(shuns) { // 清龙：同花色 123 + 456 + 789
    for (let su = 0; su < 3; su++) { // 三种花色
      const has = function (n) { return shuns.some(function (s) { return suitOfStart(s) === su && startOf(s) === n; }); }; // 判断某段
      if (has(0) && has(3) && has(6)) { return true; } // 齐三段
    } // 结束花色遍历
    return false; // 未命中
  } // 结束 hasQingLong

  function hasHuaLong(shuns) { // 花龙：三色各取 123 / 456 / 789 且三色不重复、三段不同
    const segs = [0, 3, 6]; // 三段起点
    const used = {}; // 已用花色/段位
    const pick = function (i, segUsed) { // 逐段回溯选择
      if (i === 3) { return true; } // 选满三段
      for (let s = 0; s < 3; s++) { // 三种花色
        if (used["s" + s] || segUsed["g" + segs[i]]) { continue; } // 花色或段位重复
        const ok = shuns.some(function (x) { return suitOfStart(x) === s && startOf(x) === segs[i]; }); // 是否有该段
        if (!ok) { continue; } // 无则跳过
        used["s" + s] = 1; const copy = Object.assign({}, segUsed, { ["g" + segs[i]]: 1 }); // 标记
        if (pick(i + 1, copy)) { return true; } // 递归
        used["s" + s] = 0; // 回溯
      } // 结束花色遍历
      return false; // 无解
    }; // 结束 pick
    return pick(0, {}); // 从第一段开始
  } // 结束 hasHuaLong

  function hasSanSeTongShun(shuns) { // 三色三同顺：三花色同起点
    for (let n = 0; n < 7; n++) { // 起点 0~6
      const suits = new Set(); // 花色集合
      shuns.forEach(function (s) { if (startOf(s) === n) { suits.add(suitOfStart(s)); } }); // 收集
      if (suits.size === 3) { return true; } // 三色齐
    } // 结束遍历
    return false; // 未命中
  } // 结束 hasSanSeTongShun

  function countShun(shuns, su, st) { // 某花色某起点的顺子数量
    return shuns.filter(function (s) { return suitOfStart(s) === su && startOf(s) === st; }).length; // 计数
  } // 结束 countShun

  function hasYiSeSanTongShun(shuns) { // 一色三同顺：同一花色三组相同顺子
    for (let su = 0; su < 3; su++) { for (let st = 0; st < 7; st++) { if (countShun(shuns, su, st) >= 3) { return true; } } } // 枚举
    return false; // 未命中
  } // 结束 hasYiSeSanTongShun

  function hasYiSeSanJieGao(shuns) { // 一色三节高：同一花色三组起点连续递增的顺子
    for (let su = 0; su < 3; su++) { // 花色
      for (let st = 0; st <= 4; st++) { // 起点
        if (countShun(shuns, su, st) >= 1 && countShun(shuns, su, st + 1) >= 1 && countShun(shuns, su, st + 2) >= 1) { return true; } // 连续三段
      } // 结束起点
    } // 结束花色
    return false; // 未命中
  } // 结束 hasYiSeSanJieGao

  function hasYiBanGao(shuns) { // 一般高：存在两组完全相同的顺子
    for (let su = 0; su < 3; su++) { for (let st = 0; st < 7; st++) { if (countShun(shuns, su, st) >= 2) { return true; } } } // 枚举
    return false; // 未命中
  } // 结束 hasYiBanGao

  function hasXiXiangFeng(shuns) { // 喜相逢：两种花色同起点的顺子
    for (let st = 0; st < 7; st++) { // 起点
      const suits = new Set(); // 花色集合
      shuns.forEach(function (s) { if (startOf(s) === st) { suits.add(suitOfStart(s)); } }); // 收集
      if (suits.size >= 2) { return true; } // 至少两色
    } // 结束遍历
    return false; // 未命中
  } // 结束 hasXiXiangFeng

  function hasLianLiu(shuns) { // 连六：同花色两组顺子起点相差 3（如 123 + 456）
    for (let su = 0; su < 3; su++) { // 花色
      for (let st = 0; st <= 3; st++) { // 起点
        if (countShun(shuns, su, st) >= 1 && countShun(shuns, su, st + 3) >= 1) { return true; } // 相差 3
      } // 结束起点
    } // 结束花色
    return false; // 未命中
  } // 结束 hasLianLiu

  function hasLaoShaoFu(shuns) { // 老少副：同花色 123 + 789
    for (let su = 0; su < 3; su++) { // 花色
      if (countShun(shuns, su, 0) >= 1 && countShun(shuns, su, 6) >= 1) { return true; } // 首尾两段
    } // 结束花色
    return false; // 未命中
  } // 结束 hasLaoShaoFu

  function hasSanTongKe(kous) { // 三同刻：三种花色同数字刻子
    for (let n = 0; n < 9; n++) { // 数字 1~9
      const suits = new Set(); // 花色集合
      kous.forEach(function (s) { if (!R.isHonor(s.k) && R.numOf(s.k) === n + 1) { suits.add(R.suitOf(s.k)); } }); // 收集
      if (suits.size === 3) { return true; } // 三色齐
    } // 结束遍历
    return false; // 未命中
  } // 结束 hasSanTongKe

  function allDaiYao(sets, pair) { // 全带幺：每副面子与雀头都含幺九
    if (!R.isYaochu(pair)) { return false; } // 雀头必须是幺九
    return sets.every(function (s) { // 逐面子
      if (s.t === "k") { return R.isYaochu(s.k); } // 刻子：牌本身是幺九
      return R.isYaochu(s.k) || R.isYaochu(s.k + 2); // 顺子：首尾之一是幺九
    }); // 结束逐面子
  } // 结束 allDaiYao

  /* ================= 五、主入口（高点法：取分值最高的拆解） ================= */
  function solve(opt) { // 求解一手和牌
    const counts = R.countsOf(opt.tiles); // 手牌计数
    const meldN = (opt.melds || []).length; // 副露组数
    const need = 4 - meldN; // 手牌还需要的面子数
    const cands = []; // 候选拆解

    if (counts.reduce(function (a, b) { return a + b; }, 0) === need * 3 + 2) { // 张数吻合才拆
      R.decompose(counts, need).forEach(function (d) { cands.push({ type: "std", decomp: d }); }); // 标准型全部拆解
    } // 结束标准型
    if (meldN === 0) { // 门清才可能七对 / 十三幺
      if (R.isChiitoi(counts)) { cands.push({ type: "chiitoi", decomp: { pair: -1, sets: [] } }); } // 七对
      if (R.isKokushi(counts)) { cands.push({ type: "kokushi", decomp: { pair: -1, sets: [] } }); } // 十三幺
    } // 结束门清
    if (!cands.length) { return null; } // 未和

    const allMelds = (opt.melds || []).map(function (m) { // 副露统一化
      return { t: m.type === "chi" ? "s" : "k", k: m.k, open: m.open !== false, kan: m.type === "kan", tiles: m.tiles || [] }; // 顺子记起点
    }); // 结束映射

    let best = null; // 最优解

    cands.forEach(function (cd) { // 逐候选
      let sets, pair, winInfo = null; // 面子 / 雀头 / 和牌张归属
      if (cd.type === "std") { // 标准型
        const built = buildSets(cd.decomp, opt.winTile, opt.tsumo); // 构建面子
        sets = allMelds.concat(built.sets); // 合并副露
        pair = cd.decomp.pair; // 雀头
        winInfo = built; // 和牌张归属
      } else { // 七对 / 十三幺
        sets = allMelds.slice(); // 无手牌面子
        pair = -1; // 无雀头（按对子集合处理）
      } // 结束分支

      const allTiles = []; // 全部牌（含副露展开）
      opt.tiles.forEach(function (k) { allTiles.push(k); }); // 手牌
      (opt.melds || []).forEach(function (m) { (m.tiles || []).forEach(function (k) { allTiles.push(k); }); }); // 副露

      const ctx = Object.assign({}, opt, { menzen: meldN === 0, allTiles: allTiles }); // 上下文
      const res = fanOf(ctx, sets, pair, cd.type, winInfo); // 番种
      const fan = res.list.reduce(function (a, b) { return a + b.fan; }, 0); // 总番
      const score = scoreOf(fan); // 单家分值
      const pts = pointsOf(score, !!opt.tsumo); // 支付结构
      const item = { type: cd.type, yaku: res.list, han: fan, top: res.top, fu: 0, dora: 0, score: score, points: pts, sets: sets, pair: pair }; // 结果项
      if (!best || item.points.total > best.points.total || (item.points.total === best.points.total && item.han > best.han)) { best = item; } // 高点法（同分取番高）
    }); // 结束候选遍历

    return best; // 返回最优
  } // 结束 solve

  function canWin(opt) { return !!solve(opt); } // 是否能和（推倒胡无役种门槛，能拆开即可）

  function waitList(handTiles, melds, ctx) { // 听牌 + 每种听的番数提示（供 UI 显示）
    const m = melds || []; // 副露
    const base = R.countsOf(handTiles); // 计数
    const out = []; // 结果
    for (let k = 0; k < 34; k++) { // 枚举 34 种
      if (base[k] >= 4) { continue; } // 已握满
      const tiles = handTiles.concat([k]); // 试加
      const res = solve(Object.assign({}, ctx, { tiles: tiles, winTile: k, melds: m })); // 求解
      if (res) { out.push({ k: k, han: res.han, yaku: res.yaku.map(function (y) { return y.name; }).join("·"), points: res.points }); } // 收集
    } // 结束枚举
    return out; // 返回
  } // 结束 waitList

  const API = { solve: solve, canWin: canWin, waitList: waitList, scoreOf: scoreOf, pointsOf: pointsOf }; // 导出
  root.MJY = API; // 挂全局
  if (typeof module !== "undefined" && module.exports) { module.exports = API; } // Node 出口
})(typeof window !== "undefined" ? window : globalThis); // 作用域根

