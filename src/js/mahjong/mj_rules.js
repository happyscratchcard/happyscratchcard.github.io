// ================= 6.2 十六轮：麻将 · 规则内核（牌 / 分解 / 听牌 / 向听） =================
// 设计说明：本文件只做纯计算，不碰 DOM、不碰 THREE，可在 Node 里直接单测。
// 牌种编码：0-8 万(1-9) / 9-17 筒(1-9) / 18-26 条(1-9) / 27-33 字(东南西北白发中)
// 34/35/36 为历史赤牌编号位，国标推倒胡不使用（不设赤宝牌），bk() 仍保留映射以免编号空洞。
(function (root) { // 自执行作用域，避免污染全局
  "use strict"; // 严格模式，尽早暴露笔误

  /* ================= 一、基础常量与工具 ================= */
  const HONOR = ["东", "南", "西", "北", "白", "发", "中"]; // 七种字牌名称（27-33 顺序）
  const RED_BASE = { 34: 4, 35: 13, 36: 22 }; // 赤牌编号 → 基础牌种（4=5万 / 13=5筒 / 22=5条）
  const YAOCHU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; // 十三种幺九牌（老头牌 + 字牌）

  function bk(k) { return k < 34 ? k : (RED_BASE[k] !== undefined ? RED_BASE[k] : k); } // 取基础牌种（赤牌归一）
  function isRed(k) { return k >= 34; } // 是否赤宝牌
  function isHonor(k) { k = bk(k); return k >= 27; } // 是否字牌
  function isTerminal(k) { k = bk(k); return k < 27 && (k % 9 === 0 || k % 9 === 8); } // 是否老头牌（1/9 数牌）
  function isYaochu(k) { return isHonor(k) || isTerminal(k); } // 是否幺九牌
  function suitOf(k) { k = bk(k); return k < 27 ? Math.floor(k / 9) : 3; } // 花色：0万 1筒 2条 3字
  function numOf(k) { k = bk(k); return k < 27 ? (k % 9) + 1 : 0; } // 数牌点数（1-9），字牌返回 0

  function tileName(k) { // 牌的中文名（用于日志、结算、牌河提示）
    k = bk(k); // 赤牌先归一
    if (k < 9) { return (k + 1) + "万"; } // 万子
    if (k < 18) { return (k - 8) + "筒"; } // 筒子
    if (k < 27) { return (k - 17) + "条"; } // 条子
    return HONOR[k - 27]; // 字牌
  } // 结束 tileName

  function tileCode(k) { // 紧凑编码（"1m"/"5p"/"1s"/"E"），便于调试与断言
    k = bk(k); // 赤牌归一
    if (k < 9) { return (k + 1) + "m"; } // 万
    if (k < 18) { return (k - 8) + "p"; } // 筒
    if (k < 27) { return (k - 17) + "s"; } // 条
    return "ESWNPFC"[k - 27]; // 字牌首字母（东E 南S 西W 北N 白P 发F 中C）
  } // 结束 tileCode

  function countsOf(tiles) { // 牌数组 → 34 长度计数表（赤牌自动归一）
    const c = new Array(34).fill(0); // 初始化计数表
    for (let i = 0; i < tiles.length; i++) { c[bk(tiles[i])]++; } // 逐张累加
    return c; // 返回计数表
  } // 结束 countsOf

  function sortTiles(tiles) { // 手牌排序：先按牌种，赤牌排在同种普通牌之后（视觉上赤 5 紧跟 5）
    return tiles.slice().sort(function (a, b) { // 复制后排序，避免改动原数组
      const ka = bk(a), kb2 = bk(b); // 基础牌种
      if (ka !== kb2) { return ka - kb2; } // 牌种升序
      return (isRed(a) ? 1 : 0) - (isRed(b) ? 1 : 0); // 同种牌中赤牌靠后
    }); // 结束排序回调
  } // 结束 sortTiles

  function doraKind(indicator) { // 宝牌指示牌 → 实际宝牌（数牌顺延，字牌循环，9→1 / 中→白）
    const k = bk(indicator); // 指示牌牌种
    if (k < 27) { // 数牌：同花色顺延一位
      const base = Math.floor(k / 9) * 9; // 该花色起点
      return base + ((k - base + 1) % 9); // 9 的下一张回到 1
    } // 结束数牌分支
    if (k >= 27 && k <= 30) { return 27 + ((k - 27 + 1) % 4); } // 风牌：东→南→西→北→东
    return 31 + ((k - 31 + 1) % 3); // 三元牌：白→发→中→白
  } // 结束 doraKind

  /* ================= 二、和牌分解（标准型） ================= */
  // 返回所有可行拆解：{ pair, sets:[{t:'s'|'k', k}] }，t=s 顺子 t=k 刻子；sets 内 k 为起始牌种
  function decompose(counts, needSets) { // counts: 34 计数表；needSets: 还需要的面子数（4 - 副露面子数）
    const res = []; // 结果集
    for (let p = 0; p < 34; p++) { // 枚举雀头
      if (counts[p] < 2) { continue; } // 不足两张跳过
      const c = counts.slice(); // 复制计数表
      c[p] -= 2; // 扣掉雀头
      const sets = []; // 当前面子收集器
      (function go(i, left) { // 递归拆面子
        while (i < 34 && c[i] === 0) { i++; } // 跳过空位
        if (left === 0) { // 面子凑满
          for (let j = i; j < 34; j++) { if (c[j] > 0) { return; } } // 必须一张不剩
          res.push({ pair: p, sets: sets.slice() }); // 记录一种拆解
          return; // 结束本条分支
        } // 结束凑满判断
        if (i >= 34) { return; } // 牌用完了但面子不够
        if (c[i] >= 3) { // 尝试刻子
          c[i] -= 3; sets.push({ t: "k", k: i }); // 扣牌并记录
          go(i, left - 1); // 继续
          sets.pop(); c[i] += 3; // 回溯
        } // 结束刻子分支
        if (i < 27 && (i % 9) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { // 尝试顺子（字牌不可）
          c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ t: "s", k: i }); // 扣牌并记录
          go(i, left - 1); // 继续
          sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++; // 回溯
        } // 结束顺子分支
      })(0, needSets); // 从牌种 0 开始
    } // 结束雀头枚举
    return res; // 返回全部拆解
  } // 结束 decompose

  function isChiitoi(counts) { // 七对子：七组对子（四张同种按两组对子计，日麻规则允许）
    let pairs = 0; // 对子数
    for (let i = 0; i < 34; i++) { // 遍历牌种
      if (counts[i] === 0) { continue; } // 空位跳过
      if (counts[i] % 2 !== 0) { return false; } // 出现单张即不成立
      pairs += counts[i] / 2; // 两张算一对，四张算两对
    } // 结束遍历
    return pairs === 7; // 必须恰好七对
  } // 结束 isChiitoi

  function isKokushi(counts) { // 国士无双：十三种幺九各一张 + 任一种成对
    let total = 0, pairs = 0; // 总张数与对子数
    for (let i = 0; i < 34; i++) { // 遍历全部牌种
      if (!YAOCHU.includes(i)) { if (counts[i] > 0) { return false; } continue; } // 出现幺九以外的牌即失败
      if (counts[i] === 0) { return false; } // 缺一种幺九
      if (counts[i] === 2) { pairs++; } else if (counts[i] > 2) { return false; } // 成对计数，超过两张失败
      total += counts[i]; // 累计
    } // 结束遍历
    return total === 14 && pairs === 1; // 14 张且仅一对
  } // 结束 isKokushi

  function isKokushi13(counts) { // 国士十三面：十三种幺九各一张（13 张听牌态）
    let total = 0; // 总张数
    for (let i = 0; i < 34; i++) { // 遍历
      if (!YAOCHU.includes(i)) { if (counts[i] > 0) { return false; } continue; } // 非幺九不得出现
      if (counts[i] > 1) { return false; } // 不得成对
      total += counts[i]; // 累计
    } // 结束遍历
    return total === 13; // 十三张
  } // 结束 isKokushi13

  // 和牌判定：返回 null 或 { type:'std'|'chiitoi'|'kokushi', pair, sets }
  function winCheck(counts, meldSets) { // meldSets：副露面子数（不含雀头）
    const need = 4 - (meldSets || 0); // 手牌还需凑的面子数
    if (meldsOK(counts, need)) { // 标准型
      const list = decompose(counts, need); // 全部拆解
      if (list.length) { return { type: "std", pair: list[0].pair, sets: list[0].sets, all: list }; } // 命中（all 供高点法选优）
    } // 结束标准型
    if ((meldSets || 0) === 0 && isChiitoi(counts)) { // 七对子（必须门清）
      const pairs = []; // 对子列表
      for (let i = 0; i < 34; i++) { if (counts[i] === 2) { pairs.push(i); } } // 收集对子
      return { type: "chiitoi", pair: -1, sets: [], pairs: pairs }; // 返回
    } // 结束七对子
    if ((meldSets || 0) === 0 && isKokushi(counts)) { // 国士无双（必须门清）
      return { type: "kokushi", pair: -1, sets: [] }; // 返回
    } // 结束国士
    return null; // 未和
  } // 结束 winCheck

  function meldsOK(counts, need) { // 快速可行性预判（总数必须刚好等于 need*3+2）
    let n = 0; // 张数
    for (let i = 0; i < 34; i++) { n += counts[i]; } // 累加
    return n === need * 3 + 2; // 张数吻合才继续分解
  } // 结束 meldsOK

  /* ================= 三、听牌与向听 ================= */
  // 13 张手牌（含副露后的手牌）听哪些牌：返回牌种数组（如 [3,4] 表示听 4万/5万）
  function waitsOf(tiles, meldSets) { // tiles：手牌（不含副露），meldSets：副露面子数
    const base = countsOf(tiles); // 基础计数
    const out = []; // 结果
    for (let k = 0; k < 34; k++) { // 枚举 34 种牌
      if (base[k] >= 4) { continue; } // 四张已尽，不可能再摸到（牌山已无此牌）
      base[k]++; // 试加一张
      if (winCheck(base, meldSets)) { out.push(k); } // 能和则记入
      base[k]--; // 还原
    } // 结束枚举
    return out; // 返回听牌列表
  } // 结束 waitsOf

  function shantenNormal(counts, meldN) { // 标准型向听数：8 - 2×面子 - 搭子 - 雀头
    let best = 99; // 最优向听
    for (let p = -1; p < 34; p++) { // 枚举雀头（-1 表示无雀头）
      const c = counts.slice(); // 复制
      let pair = 0; // 雀头标记
      if (p >= 0) { if (c[p] < 2) { continue; } c[p] -= 2; pair = 1; } // 取雀头
      const r = maxMenTa(c, 0, 0, 0, 4 - meldN); // 求最多面子 + 搭子
      const sh = 8 - 2 * (r[0] + meldN) - r[1] - pair; // 向听公式
      if (sh < best) { best = sh; } // 取最小
    } // 结束雀头枚举
    return best; // 返回
  } // 结束 shantenNormal

  function maxMenTa(c, i, men, ta, cap) { // 递归求 (面子, 搭子) 最优组合，men+ta ≤ cap
    while (i < 34 && c[i] === 0) { i++; } // 跳过空位
    if (i >= 34 || men + ta >= cap) { return [men, ta]; } // 无牌可拆或已满
    let best = [men, ta]; // 当前最优
    if (c[i] >= 3) { // 刻子
      c[i] -= 3; const r = maxMenTa(c, i, men + 1, ta, cap); c[i] += 3; // 递归
      if (r[0] * 2 + r[1] > best[0] * 2 + best[1]) { best = r; } // 更新（面子权重 2，优先面子）
    } // 结束刻子
    if (i < 27 && (i % 9) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { // 顺子
      c[i]--; c[i + 1]--; c[i + 2]--; const r = maxMenTa(c, i, men + 1, ta, cap); c[i]++; c[i + 1]++; c[i + 2]++; // 递归
      if (r[0] * 2 + r[1] > best[0] * 2 + best[1]) { best = r; } // 更新
    } // 结束顺子
    if (c[i] >= 2) { // 对子当搭子（雀头以外的对子）
      c[i] -= 2; const r = maxMenTa(c, i, men, ta + 1, cap); c[i] += 2; // 递归
      if (r[0] * 2 + r[1] > best[0] * 2 + best[1]) { best = r; } // 更新
    } // 结束对子
    if (i < 27 && (i % 9) <= 7 && c[i + 1] > 0) { // 两面/边张搭子
      c[i]--; c[i + 1]--; const r = maxMenTa(c, i, men, ta + 1, cap); c[i]++; c[i + 1]++; // 递归
      if (r[0] * 2 + r[1] > best[0] * 2 + best[1]) { best = r; } // 更新
    } // 结束两面
    if (i < 27 && (i % 9) <= 6 && c[i + 2] > 0) { // 嵌张搭子
      c[i]--; c[i + 2]--; const r = maxMenTa(c, i, men, ta + 1, cap); c[i]++; c[i + 2]++; // 递归
      if (r[0] * 2 + r[1] > best[0] * 2 + best[1]) { best = r; } // 更新
    } // 结束嵌张
    const r2 = maxMenTa(c, i + 1, men, ta, cap); // 舍弃当前这张（当孤立牌）
    if (r2[0] * 2 + r2[1] > best[0] * 2 + best[1]) { best = r2; } // 更新
    return best; // 返回最优
  } // 结束 maxMenTa

  function shantenChiitoi(counts) { // 七对子向听：6 - 对子数 + max(0, 7 - 种类数)
    let pairs = 0, kinds = 0; // 对子、种类
    for (let i = 0; i < 34; i++) { // 遍历
      if (counts[i] >= 1) { kinds++; } // 有牌即算一种
      if (counts[i] >= 2) { pairs++; } // 两张以上算一对
    } // 结束遍历
    return 6 - pairs + Math.max(0, 7 - kinds); // 标准公式
  } // 结束 shantenChiitoi

  function shantenKokushi(counts) { // 国士向听：13 - 幺九种类 - (有对子 ? 1 : 0)
    let kinds = 0, hasPair = 0; // 种类与对子
    for (let i = 0; i < YAOCHU.length; i++) { // 遍历幺九
      if (counts[YAOCHU[i]] >= 1) { kinds++; } // 有即算一种
      if (counts[YAOCHU[i]] >= 2) { hasPair = 1; } // 有对子
    } // 结束遍历
    return 13 - kinds - hasPair; // 标准公式
  } // 结束 shantenKokushi

  function shanten(counts, meldN) { // 综合向听（取三种型最小；有副露时七对/国士不成立）
    const s1 = shantenNormal(counts, meldN || 0); // 标准型
    if (meldN > 0) { return s1; } // 副露后只看标准型
    return Math.min(s1, shantenChiitoi(counts), shantenKokushi(counts)); // 门清取最小
  } // 结束 shanten

  function shantenOfTiles(tiles, meldN) { return shanten(countsOf(tiles), meldN || 0); } // 便捷封装

  // 有效牌：摸到后能让向听数下降的牌种（AI 牌效率核心）
  function usefulKinds(tiles, meldN) { // 返回 [{k, left}]，left 为理论上剩余枚数（不含场况）
    const base = countsOf(tiles); // 计数
    const cur = shanten(base, meldN || 0); // 当前向听
    const out = []; // 结果
    for (let k = 0; k < 34; k++) { // 枚举牌种
      if (base[k] >= 4) { continue; } // 自己已握满四张
      base[k]++; // 试摸
      const s = shanten(base, meldN || 0); // 新向听
      base[k]--; // 还原
      if (s < cur) { out.push({ k: k, gain: cur - s }); } // 下降即为有效牌
    } // 结束枚举
    return out; // 返回
  } // 结束 usefulKinds

  const API = { // 对外导出的只读接口
    HONOR: HONOR, YAOCHU: YAOCHU, // 常量
    bk: bk, isRed: isRed, isHonor: isHonor, isTerminal: isTerminal, isYaochu: isYaochu, // 牌性判断
    suitOf: suitOf, numOf: numOf, tileName: tileName, tileCode: tileCode, // 牌名工具
    countsOf: countsOf, sortTiles: sortTiles, doraKind: doraKind, // 计数与排序
    decompose: decompose, winCheck: winCheck, isChiitoi: isChiitoi, isKokushi: isKokushi, isKokushi13: isKokushi13, // 和牌
    waitsOf: waitsOf, shanten: shanten, shantenOfTiles: shantenOfTiles, usefulKinds: usefulKinds // 听牌与向听
  }; // 结束导出表

  root.MJR = API; // 挂到全局（浏览器 / 小程序 / Node 通用）
  if (typeof module !== "undefined" && module.exports) { module.exports = API; } // Node 单测出口
})(typeof window !== "undefined" ? window : globalThis); // 浏览器取 window，Node 取 globalThis

