// ================= 6.0 新增：新玩法战绩（scratch-play-history，独立于 scratch-history） =================
function loadPlayHist() { // 读取新玩法战绩
  try { const v = JSON.parse(localStorage.getItem("scratch-play-history")); if (Array.isArray(v)) { return v; } } catch (e) {} // 容错
  return []; // 无存档返回空数组
} // 结束 loadPlayHist
function pushPlayHist(game, cost, prize, detail) { // 写一条战绩（最新在前，上限 50 条）
  const arr = loadPlayHist(); // 读旧档
  arr.unshift({ time: Date.now(), game: game, cost: cost, prize: prize, detail: detail }); // 头插新记录
  if (arr.length > 50) { arr.length = 50; } // 截断到 50 条
  localStorage.setItem("scratch-play-history", JSON.stringify(arr)); // 持久化
  renderPlayHist(); // 立即刷新历史页卡片（若在渲染）
} // 结束 pushPlayHist
const GAME_NAMES = { slot: "老虎机", gacha: "扭蛋机", claw: "娃娃机" }; // 玩法中文名表
function renderPlayHist() { // 渲染历史页顶部的新玩法战绩卡
  const card = $("playHistCard"); if (!card) { return; } // 节点不存在（兼容旧结构）直接退出
  const arr = loadPlayHist(); // 读战绩
  if (!arr.length) { card.style.display = "none"; return; } // 无记录隐藏卡片
  const html = arr.map(function (h) { // 逐条渲染
    const net = h.prize - h.cost; // 净盈亏
    const t = new Date(h.time); // 时间对象
    const hh = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0"); // 时:分
    return '<div class="phRow"><span>' + (GAME_NAMES[h.game] || h.game) + " · " + hh + (h.detail ? " · " + h.detail : "") + '</span><span class="phNet ' + (net > 0 ? "pos" : net < 0 ? "neg" : "") + '">' + (net >= 0 ? "+" : "-") + "¥" + Math.abs(net).toFixed(2) + "</span></div>"; // 行结构
  }).join(""); // 拼接
  $("playHistList").innerHTML = html; // 注入列表
  card.style.display = "block"; // 显示卡片
} // 结束 renderPlayHist

