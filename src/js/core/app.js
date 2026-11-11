
// ================= 数据与常量 =================
const MERCHANTS = [ // 三档商家（页面只显示描述；奖池与中奖率由管理员系统掌控）
  { name: "黑心商家", desc: "😈 黑心商家：奖池保密，能不赔就不赔。", short: "黑心" }, // 黑心
  { name: "普通商家", desc: "😐 普通商家：奖池保密，中不中全看手气。", short: "普通" }, // 普通
  { name: "良心商家", desc: "😇 良心商家：奖池保密，出手相对大方。", short: "良心" } // 良心
]; // 结束商家表
const TIERS = [ // 价位表（不标注奖池）
  { name: "福卡", price: 2 }, // 低价
  { name: "吉卡", price: 5 }, // 中价
  { name: "鸿运卡", price: 10 } // 高价
]; // 结束价位表
const BORROW_STEP = 5; // 每次借款
const ADMIN_PWD = "370802"; // 管理员密码（仅本机自用）
const FAST_QTY_LIMIT = 30; // 爽刮快进阈值：购买数量超过它时刮开过程加速
function defaultPool(m, t) { // 返回一组默认奖池深拷贝：POOL[m][t] = [{amt:金额, w:占100张百分比}...]
  const D = [ // D[m][t]：商家风气 × 卡类型（黑心·福卡为用户示范概率）
    [ [ {amt:0,w:30},{amt:0.5,w:25},{amt:1,w:20},{amt:2,w:10},{amt:5,w:10},{amt:10,w:5} ],   // 黑心·福卡（示范：0:30% 0.5:25% 1:20% 2:10% 5:10% 10:5%）
      [ {amt:0,w:45},{amt:1,w:20},{amt:2,w:14},{amt:5,w:12},{amt:20,w:7},{amt:50,w:2} ],     // 黑心·吉卡
      [ {amt:0,w:73},{amt:2,w:12},{amt:5,w:8},{amt:10,w:4},{amt:66,w:1.5},{amt:100,w:0.8},{amt:666,w:0.4},{amt:888,w:0.3} ] ], // 黑心·鸿运卡
    [ [ {amt:0,w:38},{amt:0.5,w:18},{amt:1,w:16},{amt:2,w:12},{amt:5,w:9},{amt:10,w:7} ],    // 普通·福卡
      [ {amt:0,w:45},{amt:1,w:18},{amt:2,w:14},{amt:5,w:11},{amt:20,w:8},{amt:50,w:4} ],     // 普通·吉卡
      [ {amt:0,w:57},{amt:2,w:16},{amt:5,w:13},{amt:10,w:9},{amt:66,w:3},{amt:100,w:1.5},{amt:666,w:0.4},{amt:888,w:0.2} ] ], // 普通·鸿运卡
    [ [ {amt:0,w:25},{amt:0.5,w:16},{amt:1,w:15},{amt:2,w:14},{amt:5,w:12},{amt:10,w:18} ],  // 良心·福卡
      [ {amt:0,w:35},{amt:1,w:15},{amt:2,w:14},{amt:5,w:14},{amt:20,w:14},{amt:50,w:8} ],    // 良心·吉卡
      [ {amt:0,w:61},{amt:2,w:14},{amt:5,w:10},{amt:10,w:8},{amt:66,w:4},{amt:100,w:2},{amt:666,w:0.8},{amt:888,w:0.4} ] ]  // 良心·鸿运卡
  ]; // 结束默认表
  return D[m][t].map(function (p) { return { amt: p.amt, w: p.w }; }); // 深拷贝，防止污染默认值
} // 结束 defaultPool
let adminCfg = { pools: null, maxDebt: 10 }; // 管理员配置：9 组奖池 + 借款上限
try { const c = JSON.parse(localStorage.getItem("scratch-admin")); if (c && typeof c.maxDebt === "number") { adminCfg = c; } } catch (e) {} // 读取存档（结构合法才采用）
if (!adminCfg.pools || typeof adminCfg.maxDebt !== "number") { // 字段缺失兜底
  if (typeof adminCfg.maxDebt !== "number") { adminCfg.maxDebt = 10; } // 借款上限兜底
  if (!adminCfg.pools) { adminCfg.pools = null; } // 奖池标记待初始化
} // 结束兜底
adminCfg.maxDebt = Math.max(0, adminCfg.maxDebt); // 借款上限非负
if (!adminCfg.pools) { // 无奖池存档时初始化
  adminCfg.pools = []; // 三维表：[商家][卡] = 奖池
  for (let m = 0; m < 3; m++) { adminCfg.pools[m] = []; for (let t = 0; t < 3; t++) { adminCfg.pools[m][t] = defaultPool(m, t); } } // 全部取默认
} // 结束初始化
function saveAdminCfg() { localStorage.setItem("scratch-admin", JSON.stringify(adminCfg)); } // 持久化管理员配置
function getPool(m, t) { return adminCfg.pools[m][t]; } // 取某组奖池
let MAX_DEBT = (typeof adminCfg.maxDebt === "number" && adminCfg.maxDebt >= 0) ? adminCfg.maxDebt : 10; // 借款上限（管理员可调）

// ================= 库存系统（福利/体育两家独立） =================
function loadStock() { // 读两家库存
  try { const s = JSON.parse(localStorage.getItem("scratch-stock")); if (s && typeof s["0"] === "number" && typeof s["1"] === "number") { return s; } } catch (e) {} // 结构合法才采用
  return { "0": 100000, "1": 100000 }; // 初始各 10 万张
} // 结束 loadStock
function saveStock(s) { localStorage.setItem("scratch-stock", JSON.stringify(s)); } // 持久化库存
function getStock() { return loadStock()[String(issuerIdx)]; } // 当前发行方库存
function deductStock(n) { // 购买扣减当前发行方库存
  const s = loadStock(); // 读库存
  s[String(issuerIdx)] = Math.max(0, s[String(issuerIdx)] - n); // 扣减（不为负）
  saveStock(s); // 存档
  refreshStock(); // 刷新商店显示
} // 结束 deductStock
function refreshStock() { // 刷新商店页库存显示
  const s = loadStock(); // 读库存
  $("stockIssuer").textContent = ISSUERS[issuerIdx].name; // 发行方名
  $("stockNum").textContent = s[String(issuerIdx)].toLocaleString("zh-CN"); // 千分位数字
} // 结束 refreshStock
function refreshAdminStock() { // 刷新管理员面板库存显示
  const s = loadStock(); // 读库存
  $("admStock0").textContent = s["0"].toLocaleString("zh-CN"); // 福利
  $("admStock1").textContent = s["1"].toLocaleString("zh-CN"); // 体育
} // 结束 refreshAdminStock
const REVEAL_AT = 0.55; // 刮开 55% 才揭晓
const THRESHOLDS = Array.from({ length: 50 }, function (_, i) { return +(0.5 * Math.pow(2000, i / 49)).toFixed(2); }); // 徽章门槛 0.5 → 1000
const LEVEL_NAMES = ["铜叶", "铁星", "银月", "金辉", "翡翠", "蓝宝", "紫晶", "红玉", "钻曜", "彩虹"]; // 十级名
const LEVEL_COLORS = ["#a4713d", "#7c8794", "#c8ccd4", "#e6b84c", "#3fae7a", "#3f7fd1", "#8b5fd1", "#d15a72", "#7fd1e8", "#f6c775"]; // 十级色

// ================= 可变状态 =================
let balance = parseFloat(localStorage.getItem("scratch-balance")); // 余额
if (isNaN(balance)) { balance = 20; } // 首访赠送
let debt = parseFloat(localStorage.getItem("scratch-debt")) || 0; // 欠款
let totalWin = parseFloat(localStorage.getItem("scratch-total")) || 0; // 累计刮出
let badges = {}; // 徽章表
try { badges = JSON.parse(localStorage.getItem("scratch-badges")) || {}; } catch (e) { badges = {}; } // 容错
let serial = parseInt(localStorage.getItem("scratch-serial"), 10) || 1; // 流水号
let merchantIdx = 1; // 当前商家（默认普通）
let tierIdx = 0; // 当前价位
let qty = 1; // 购买数量（默认 1，可用 ＋ 调大）
let batch = []; // 本批彩票
let drawnCount = 0; // 已抽数
let zTop = 100; // 叠放最高层（刮奖页用）
let savedBatch = null; // 未完成批次存档（修复：抽卡/刮卡阶段退出后票与钱可找回）
let autoScratch = false; // 爽刮标记：进入刮奖页后自动开刮
// ================= 玩法状态：滚存头奖 / 连击转运 / 碎票回收 =================
let jackpot = parseFloat(localStorage.getItem("scratch-jackpot")) || 0; // 滚存头奖池（每张票票价 2% 滚入，刮出 ≥888 清空带走）
let streakW = parseInt(localStorage.getItem("scratch-streakw"), 10) || 0; // 当前连中奖数
let streakL = parseInt(localStorage.getItem("scratch-streakl"), 10) || 0; // 当前连不中数
let luckyCharge = parseFloat(localStorage.getItem("scratch-lucky")) || 0; // 转运条蓄力 0~100（每张不中 +17，6 张蓄满）
let shards = parseInt(localStorage.getItem("scratch-shards"), 10) || 0; // 废票碎片（每张未中奖票 +1，100 片合成免费福卡）

// ================= DOM 引用 =================
const $ = function (id) { return document.getElementById(id); }; // 简写
const balNum = $("balNum"), balPill = $("balPill"); // 余额
const toastEl = $("toast"); // 提示条

// ================= 通用工具 =================
function save() { // 持久化
  balance = Math.round(balance * 100) / 100; // 消浮点
  debt = Math.round(debt * 100) / 100; // 同上
  localStorage.setItem("scratch-balance", balance); // 余额
  localStorage.setItem("scratch-debt", debt); // 欠款
  localStorage.setItem("scratch-total", totalWin); // 累计
  localStorage.setItem("scratch-badges", JSON.stringify(badges)); // 徽章
  localStorage.setItem("scratch-serial", serial); // 流水号
  localStorage.setItem("scratch-jackpot", jackpot); // 滚存头奖池
  localStorage.setItem("scratch-streakw", streakW); // 连中奖数
  localStorage.setItem("scratch-streakl", streakL); // 连不中数
  localStorage.setItem("scratch-lucky", luckyCharge); // 转运条蓄力
  localStorage.setItem("scratch-shards", shards); // 废票碎片
} // 结束 save

let toastTimer = null; // 提示定时
function toast(msg) { // 弹提示
  toastEl.textContent = msg; // 文字
  toastEl.classList.add("show"); // 显示
  clearTimeout(toastTimer); // 重置
  toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400); // 隐藏
} // 结束 toast

// ================= 数字滚动（余额/欠款连续趋近动画） =================
const numAnim = { bal: null, balT: 0, debt: null, debtT: 0, jack: null, jackT: 0, raf: 0 }; // 当前显示值与目标值（bal/jack 为 null 表示尚未初始化）
function stepNum() { // 单帧趋近：显示值以缓动追赶目标值（高频入账时数字连续滚动追赶，不再瞬间跳变）
  const r = 0.16; // 每帧趋近比例（约 20 帧收敛）
  numAnim.bal += (numAnim.balT - numAnim.bal) * r; // 余额插值
  numAnim.debt += (numAnim.debtT - numAnim.debt) * r; // 欠款插值
  numAnim.jack += (numAnim.jackT - numAnim.jack) * r; // 滚存插值
  if (Math.abs(numAnim.balT - numAnim.bal) < 0.005) { numAnim.bal = numAnim.balT; } // 差值过小直接吸附
  if (Math.abs(numAnim.debtT - numAnim.debt) < 0.005) { numAnim.debt = numAnim.debtT; } // 欠款吸附
  if (Math.abs(numAnim.jackT - numAnim.jack) < 0.005) { numAnim.jack = numAnim.jackT; } // 滚存吸附
  balNum.textContent = numAnim.bal.toFixed(2); // 余额滚动显示
  $("debtVal").textContent = numAnim.debt.toFixed(2); // 欠款滚动显示
  $("jackNum").textContent = numAnim.jack.toFixed(2); // 滚存滚动显示
  if (numAnim.bal === numAnim.balT && numAnim.debt === numAnim.debtT && numAnim.jack === numAnim.jackT) { numAnim.raf = 0; return; } // 全部到位：停循环
  numAnim.raf = requestAnimationFrame(stepNum); // 未到位：下一帧继续
} // 结束 stepNum
function requestNum() { // 启动滚动循环（已在跑则复用，避免多循环叠跑）
  if (!numAnim.raf) { numAnim.raf = requestAnimationFrame(stepNum); } // 空闲才排队
} // 结束 requestNum

function renderBalance(dir) { // 刷新余额（pay 下滑脉冲 / gain 上滑脉冲 / 空 静默；数字本身滚动趋近）
  if (numAnim.bal === null) { numAnim.bal = balance; numAnim.debt = debt; numAnim.jack = jackpot; } // 首次调用：从真实值起步（不播滚动）
  balNum.classList.remove("roll-pay", "roll-gain"); // 清动画
  if (dir) { // 有方向播滚轮脉冲
    void balNum.offsetWidth; // 强制回流
    balNum.classList.add(dir === "pay" ? "roll-pay" : "roll-gain"); // 播方向
  } // 结束方向脉冲
  numAnim.balT = balance; numAnim.debtT = debt; numAnim.jackT = jackpot; // 更新滚动目标
  requestNum(); // 启动/续跑滚动循环
  $("debtPill").classList.toggle("show", debt > 0); // 欠款显示
  $("debtFill").style.width = ((MAX_DEBT - debt) / MAX_DEBT * 100) + "%"; // 还债进度
  $("btnBorrow").disabled = !(debt + BORROW_STEP <= MAX_DEBT && balance < TIERS[tierIdx].price * qty); // 借钱可用性
} // 结束 renderBalance

function refreshJack() { // 刷新滚存头奖池显示（滚动趋近）
  if (numAnim.jack === null) { return; } // 尚未初始化：交给 renderBalance 首帧
  numAnim.jackT = jackpot; // 更新目标
  requestNum(); // 续跑滚动
} // 结束 refreshJack

function refreshStreak() { // 刷新转运条显示（蓄力进度 + 满槽状态）
  const row = $("streakRow"); // 行容器
  $("sfill").style.width = luckyCharge + "%"; // 蓄力宽度
  if (luckyCharge >= 100) { row.classList.add("full"); $("stext").textContent = "已蓄满！下一张保底必中"; } // 满槽金色
  else { row.classList.remove("full"); $("stext").textContent = Math.floor(luckyCharge) + "%（蓄满后下一张必中）"; } // 常态
} // 结束 refreshStreak

function refreshShards() { // 刷新碎片显示与合成按钮可用性
  $("shardNum").textContent = shards; // 片数
  $("btnSynth").disabled = shards < 100; // 满 100 片才可合成
} // 结束 refreshShards

function floatDelta(v, dir) { // 浮动增减额
  const s = document.createElement("span"); // 元素
  s.className = "fdelta " + dir; // 方向
  s.textContent = (dir === "gain" ? "+" : "−") + Math.abs(v).toFixed(2); // 文案
  balPill.appendChild(s); // 挂载
  setTimeout(function () { s.remove(); }, 1200); // 移除
} // 结束 floatDelta

function payMoney(cost) { // 扣款（滚轮下滑）
  balance -= cost; // 扣钱
  save(); // 存档
  renderBalance("pay"); // 下滑
  floatDelta(cost, "pay"); // 红字下飘
} // 结束 payMoney

function gainMoney(prize) { // 进账（优先还债 + 滚轮上滑）
  const repaid = Math.min(debt, prize); // 还债额
  debt -= repaid; // 冲抵
  const into = Math.round((prize - repaid) * 100) / 100; // 入账
  balance += into; // 加钱
  totalWin += prize; // 累计
  save(); // 存档
  renderBalance("gain"); // 上滑
  floatDelta(prize, "gain"); // 绿字上飘
  checkBadges(); // 徽章检查
  return repaid; // 返回还债额
} // 结束 gainMoney

// ================= 批次持久化（修复：抽卡/刮卡阶段退出丢票丢钱） =================
function slimTicket(t) { return { no: t.no, tierName: t.tierName, price: t.price, prize: t.prize, revealed: !!t.revealed }; } // 抽取票据纯数据（剥离 DOM 引用便于序列化）
function saveBatch(stage) { // 持久化当前批次（抽卡与刮卡阶段都会调用）
  savedBatch = { stage: stage, qty: qty, tierIdx: tierIdx, merchantIdx: merchantIdx, remain: remainBuy, seq: batchSeq, cnt: batchCount, stack: stack.map(slimTicket), picked: picked.map(slimTicket) }; // 打包快照（remain/seq/cnt 支持分批恢复）
  localStorage.setItem("scratch-batch", JSON.stringify(savedBatch)); // 写入本地
  refreshResumable(); // 同步商店页的暂存提示条
} // 结束 saveBatch
function clearBatch() { // 清除批次存档（全部刮完或主动作废）
  savedBatch = null; // 清内存
  localStorage.removeItem("scratch-batch"); // 清本地
  refreshResumable(); // 刷新提示条
} // 结束 clearBatch
function refreshResumable() { // 刷新商店页"继续上批"提示条
  const bar = $("resumableBar"); // 提示条
  if (!savedBatch) { bar.classList.remove("show"); return; } // 无存档：隐藏
  const stageName = savedBatch.stage === "wheel" ? "抽取" : "刮奖"; // 阶段名
  const remain = savedBatch.stage === "wheel" // 剩余未完成张数（含分批排队量）
    ? (savedBatch.stack.length + savedBatch.picked.length + (savedBatch.remain || 0)) // 抽卡阶段：没抽的 + 已抽未刮的 + 还没开批的
    : (savedBatch.picked.filter(function (t) { return !t.revealed; }).length + (savedBatch.remain || 0)); // 刮卡阶段：没刮开的 + 还没开批的
  $("resumeText").textContent = "📦 上批还有 " + remain + " 张未完成（阶段：" + stageName + "），钱已付、票还在。"; // 文案
  bar.classList.add("show"); // 显示
} // 结束 refreshResumable
function restoreBatch() { // 从存档恢复未完成批次（刷新 / 关闭后重进，或商店点"继续这批"）
  if (!savedBatch) return; // 无存档忽略
  qty = savedBatch.qty; // 恢复购买数量（整单总量）
  remainBuy = savedBatch.remain || 0; // 恢复待洗余量（旧存档无此字段按 0 处理，即单批行为）
  batchSeq = savedBatch.seq || 1; // 恢复当前批号
  batchCount = savedBatch.cnt || 1; // 恢复总批数
  setTier(savedBatch.tierIdx); // 恢复价位选择
  setMerchant(savedBatch.merchantIdx); // 恢复商家选择
  stack = savedBatch.stack.map(function (t) { return { no: t.no, tierName: t.tierName, price: t.price, prize: t.prize, revealed: false }; }); // 恢复剩余叠票
  picked = savedBatch.picked.map(function (t) { return { no: t.no, tierName: t.tierName, price: t.price, prize: t.prize, revealed: !!t.revealed }; }); // 恢复已抽票（含已刮标记）
  zTop = 100; // 复位层级
  if (savedBatch.stage === "wheel") { // 抽卡阶段恢复
    buildWheelUI(); // 重建叠票舞台（不重洗票据）
    showView("Wheel"); // 回到抽卡页
    toast("已恢复上批：本批已抽 " + picked.length + " / " + batchTotal() + " 张" + (remainBuy > 0 ? "，另有 " + remainBuy + " 张排队中" : "")); // 提示（含分批信息）
  } else { // 刮卡阶段恢复
    batch = picked; // 本批即已抽票
    const allDone = batch.length > 0 && batch.every(function (t) { return t.revealed; }); // 极端现场：存档瞬间本批恰好全刮完（还没来得及续批/结算）
    if (allDone) { // 全刮完的现场不重建刮奖堆（避免重复记历史/重复续批）
      if (remainBuy > 0) { batchSeq++; nextBatch(); return; } // 还有排队张数：直接续批
      clearBatch(); showView("Shop"); refreshResumable(); return; // 整单完成：清档回商店
    } // 结束极端现场
    buildPile(); // 重建刮卡堆（已刮的保持揭晓态，不再入账）
    showView("Scratch"); // 回到刮奖页
    toast("已恢复上批：还有 " + batch.filter(function (t) { return !t.revealed; }).length + " 张没刮" + (remainBuy > 0 ? "，另有 " + remainBuy + " 张排队中" : "")); // 提示（含分批信息）
  } // 结束分支
} // 结束 restoreBatch

// ================= 果冻商家开关 =================
function setMerchant(i) { // 切到第 i 档
  merchantIdx = i; // 记录
  const knob = $("knob"); // 滑块
  knob.style.left = "calc(4px + " + i + " * (100% - 8px) / 3)"; // 移到目标档（回弹由 transition 完成）
  knob.classList.remove("squish"); // 清旧挤压
  void knob.offsetWidth; // 强制回流
  knob.classList.add("squish"); // 播果冻挤压动画
  document.querySelectorAll("#mswitch .mlabel").forEach(function (el) { el.classList.toggle("on", +el.dataset.i === i); }); // 高亮商家标签（限定作用域，防止波及价位开关）
  $("mDesc").textContent = MERCHANTS[i].desc; // 更新描述（无中奖率字样）
} // 结束 setMerchant
document.querySelectorAll("#mswitch .mlabel").forEach(function (el) { // 绑定标签点击（只在商家开关内查找，避免误绑价位标签）
  el.addEventListener("click", function () { setMerchant(+el.dataset.i); }); // 切档
}); // 结束绑定
setMerchant(1); // 默认普通档

// ================= 价位 / 数量 =================
function setTier(i) { // 切到第 i 档价位
  tierIdx = i; // 记录选择
  const knob = $("tknob"); // 价位滑块
  knob.style.left = "calc(4px + " + i + " * (100% - 8px) / 3)"; // 移到目标档（果冻回弹由 transition 完成）
  knob.classList.remove("squish"); // 清旧挤压
  void knob.offsetWidth; // 强制回流
  knob.classList.add("squish"); // 播果冻挤压动画
  document.querySelectorAll(".tlabel").forEach(function (el) { el.classList.toggle("on", +el.dataset.i === i); }); // 高亮标签
  if (i === 2) { knob.classList.add("rainbow"); } else { knob.classList.remove("rainbow"); } // 滑到鸿运卡：彩虹渐变光晕缓缓流动；离开则恢复白底
  renderQty(); // 刷新合计与借钱按钮
} // 结束 setTier
document.querySelectorAll(".tlabel").forEach(function (el) { // 绑定价位标签点击
  el.addEventListener("click", function () { setTier(+el.dataset.i); }); // 切档
}); // 结束绑定

function renderQty() { // 刷新数量
  const box = $("qtyVal"); // 数量显示节点
  if (box && !box.querySelector(".qtyInput")) { box.textContent = qty; } // 编辑中不覆盖输入框（6.2 十七轮）
  $("costPreview").textContent = "合计 ¥" + (TIERS[tierIdx].price * qty); // 合计
  renderBalance(); // 同步借钱按钮
} // 结束 renderQty
$("qtyMinus").addEventListener("click", function () { qty = Math.max(1, qty - 1); renderQty(); }); // 减
// ================= 6.2 十七轮：购买数量支持键盘手动输入（右键 / 双击数量） =================
(function () { // 闭包封装，不污染全局
  const span = $("qtyVal"); // 数量显示节点
  if (!span) { return; } // 容错：找不到节点直接跳过
  let editing = false; // 是否正在编辑（防重复进入）
  function apply(v) { // 提交输入值
    const n = Math.floor(Number(String(v).replace(/[^0-9]/g, ""))); // 只保留数字字符
    if (!isFinite(n) || n < 1) { toast("⚠ 数量至少 1 张"); renderQty(); return; } // 非法输入：回退并提示
    qty = Math.min(9999, n); // 上限 9999（实际仍受余额与库存约束）
    renderQty(); // 刷新数量与合计
  } // 结束 apply
  function startEdit() { // 进入编辑态
    if (editing) { return; } // 已在编辑
    editing = true; // 上锁
    const input = document.createElement("input"); // 新建输入框
    input.type = "text"; // 文本类型（避免数字框上下箭头与小键盘误触）
    input.className = "qtyInput"; // 样式挂钩
    input.setAttribute("inputmode", "numeric"); // 移动端弹数字键盘
    input.setAttribute("maxlength", "4"); // 最多 4 位
    input.value = String(qty); // 回显当前数量
    span.textContent = ""; // 清掉原文字
    span.appendChild(input); // 放进数量位
    input.focus(); // 聚焦
    input.select(); // 全选：直接打字即可覆盖
    let closed = false; // 防重入标记
    function finish(ok) { // 结束编辑
      if (closed) { return; } // 已结束
      closed = true; editing = false; // 解锁
      const v = input.value; // 先取值（移除后读不到）
      if (input.parentNode) { input.parentNode.removeChild(input); } // 移除输入框
      span.textContent = String(qty); // 先回填旧值，避免闪空
      if (ok) { apply(v); } else { renderQty(); } // 提交 / 撤销
    } // 结束 finish
    input.addEventListener("keydown", function (e) { // 键盘输入
      e.stopPropagation(); // 关键：阻断冒泡，避免触发全局 1~9 切玩法与 M 静音
      if (e.key === "Enter") { e.preventDefault(); finish(true); } // 回车：确认
      else if (e.key === "Escape") { e.preventDefault(); finish(false); } // Esc：撤销
      else if (e.key === "ArrowUp") { e.preventDefault(); input.value = String(Math.min(9999, (parseInt(input.value, 10) || 0) + 1)); } // ↑ 加一
      else if (e.key === "ArrowDown") { e.preventDefault(); input.value = String(Math.max(1, (parseInt(input.value, 10) || 1) - 1)); } // ↓ 减一
    }); // 结束键盘
    input.addEventListener("keyup", function (e) { e.stopPropagation(); }); // keyup 一并阻断
    input.addEventListener("blur", function () { finish(true); }); // 失焦即确认
    input.addEventListener("contextmenu", function (e) { e.preventDefault(); }); // 屏蔽右键菜单
    toast("⌨ 直接输入数量，回车确认（Esc 取消）"); // 操作提示
  } // 结束 startEdit
  span.addEventListener("contextmenu", function (e) { e.preventDefault(); startEdit(); }); // 右键唤起编辑
  span.addEventListener("dblclick", function (e) { e.preventDefault(); startEdit(); }); // 双击也能改（更易发现）
  span.title = "右键或双击可直接输入购买数量"; // 悬停提示
})(); // 结束数量手动输入

(function () { // 数量加号：单击 +1，长按连加（越按越快）——用闭包封装，不污染全局
  let holdTimer = null; // 长按判定延时器（按住 400ms 后进入连发）
  let stepTimer = null; // 连发步进延时器（递归 setTimeout，便于动态调速）
  let ticks = 0; // 连发已加张数（用于分档提速）
  let fired = false; // 长按是否已触发过（抑制松开后 click 的多余 +1）
  const plus = $("qtyPlus"); // 加号按钮
  function stopHold() { // 统一停止：清掉两个延时器
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } // 清长按判定
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; } // 清连发步进
  } // 结束 stopHold
  function burst() { // 连发一步：加 1 刷新，再按当前档速排下一步
    qty = qty + 1; // 数量加 1（无上限，受余额与库存约束）
    renderQty(); // 刷新数量与合计
    ticks++; // 累计连发张数
    const delay = ticks < 10 ? 90 : ticks < 25 ? 40 : 16; // 三档速度：0~9 张 90ms、10~24 张 40ms、之后 16ms（越按越快）
    stepTimer = setTimeout(burst, delay); // 排下一步
  } // 结束 burst
  plus.addEventListener("click", function () { // 单击：加 1
    if (fired) { fired = false; return; } // 长按结束后的那次 click 属于多余触发：吞掉并复位标志
    qty = qty + 1; // 正常单击加 1
    renderQty(); // 刷新数量与合计
  }); // 结束单击
  plus.addEventListener("pointerdown", function (e) { // 按下即开始计时（鼠标/触屏统一走 pointer 事件）
    if (e.button !== undefined && e.button !== 0) { return; } // 仅响应主键/主指针（忽略右键）
    fired = false; // 新一轮按压复位标志
    ticks = 0; // 连发计数归零
    holdTimer = setTimeout(function () { // 按住 400ms 仍未松开：
      fired = true; // 标记长按已触发（吞掉松开后的 click）
      burst(); // 立即加 1 并进入连发
    }, 400); // 长按判定阈值 400ms
  }); // 结束按下
  ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { // 松开/滑出按钮/系统打断都停止
    plus.addEventListener(ev, stopHold); // 停止连发
  }); // 结束绑定
  plus.addEventListener("contextmenu", function (e) { e.preventDefault(); }); // 屏蔽长按右键菜单（移动端长按会呼出，必须拦掉）
  window.addEventListener("blur", stopHold); // 窗口失焦兜底停止（防止切窗后定时器还在跑）
})(); // 结束加号长按封装
setTier(0); // 初始化价位档（内部会调 renderQty 刷新合计）

// ================= 彩票发行方开关（纯玩乐） =================
const ISSUERS = [ // 两档发行方（仅展示文案，与奖池、概率、结果完全无关）
  { name: "中国福利彩票", desc: "❤️ 中国福利彩票：扶老 · 助残 · 救孤 · 济困。选它图个好意头～" }, // 福利
  { name: "中国体育彩票", desc: "🏅 中国体育彩票：公益体彩 · 乐善人生。选它冲个好运～" } // 体育
]; // 结束发行方表
let issuerIdx = parseInt(localStorage.getItem("scratch-issuer"), 10); // 记住上次选择
if (isNaN(issuerIdx) || issuerIdx < 0 || issuerIdx > 1) { issuerIdx = 0; } // 默认福利
function setIssuer(i) { // 切到第 i 档发行方
  issuerIdx = i; // 记录
  localStorage.setItem("scratch-issuer", i); // 记住偏好（纯玩乐）
  const knob = $("iknob"); // 滑块
  knob.style.left = "calc(4px + " + i + " * (100% - 8px) / 2)"; // 两档定位（果冻回弹由 transition 完成）
  knob.classList.remove("squish"); // 清旧挤压
  void knob.offsetWidth; // 强制回流
  knob.classList.add("squish"); // 播果冻挤压动画
  document.querySelectorAll("#iswitch .mlabel").forEach(function (el) { el.classList.toggle("on", +el.dataset.i === i); }); // 高亮标签
  $("iDesc").textContent = ISSUERS[i].desc; // 更新描述
  refreshStock(); // 同步商店页库存显示（两家库存各自独立）
} // 结束 setIssuer
document.querySelectorAll("#iswitch .mlabel").forEach(function (el) { // 绑定发行方标签点击
  el.addEventListener("click", function () { setIssuer(+el.dataset.i); }); // 切档（无任何逻辑影响）
}); // 结束绑定

// ================= 磁力购买按钮 =================
const btnBuy = $("btnBuy"); // 按钮
document.addEventListener("mousemove", function (e) { // 光标监听
  const r = btnBuy.getBoundingClientRect(); // 包围盒
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); // 向量
  const dist = Math.hypot(dx, dy); // 距离
  if (dist < 150) { btnBuy.style.transform = "translate(" + dx * 0.28 + "px," + dy * 0.28 + "px) scale(1.06)"; } // 磁吸
  else { btnBuy.style.transform = ""; } // 归位
}); // 结束监听

// ================= 中奖概率（奖池抽样） =================
function pickPrize(tier, merch) { // 按管理员奖池随机奖额（tier 卡下标、merch 商家下标）
  const pool = getPool(merch, tier); // 取该组奖池 [{amt,w}...]
  let total = 0; // 权重总和
  for (let i = 0; i < pool.length; i++) { total += (+pool[i].w || 0); } // 累加所有档位权重
  if (total <= 0) { return 0; } // 权重全零兜底：不中奖
  let r = Math.random() * total; // 骰子落在总权重区间
  for (let i = 0; i < pool.length; i++) { // 逐档扣减命中
    r -= (+pool[i].w || 0); // 扣当前档权重
    if (r < 0) { return +pool[i].amt || 0; } // 命中返回金额（0 也合法）
  } // 结束遍历
  return +pool[pool.length - 1].amt || 0; // 浮点误差兜底：返回最后一档
} // 结束 pickPrize

// ================= 视图切换 =================
function showView(name) { // 切视图（6.0：新增 Slot/Gacha/Claw/Pet/Settings 五视图与生命周期钩子；6.2 七轮再加 Lucky/Dice；十六轮再加 Mahjong）
  ["viewShop", "viewWheel", "viewScratch", "viewAdmin", "viewHall", "viewHistory", "viewWithdraw", "viewSlot", "viewGacha", "viewClaw", "viewLucky", "viewDice", "viewMahjong", "viewPet", "viewSettings"].forEach(function (id) { $(id).classList.remove("show"); }); // 隐藏全部（含新视图）
  const prevView = document.querySelector(".view.show"); // 记录切出前的视图（供离开钩子）
  $("view" + name).classList.add("show"); // 显示目标
  const navMap = { Shop: 0, Wheel: 0, Scratch: 0, Gacha: 0, Claw: 0, Slot: 0, Lucky: 0, Dice: 0, Mahjong: 0, Pet: 1, History: 2, Hall: 3, Withdraw: 4, Settings: 5, Admin: 5 }; // 视图 → Tab 索引映射（6 Tab 版）
  const idx = navMap[name] !== undefined ? navMap[name] : 0; // 兜底：未定义的视图回落到第一个 Tab
  document.querySelectorAll("#mainNav .navItem").forEach(function (el) { // 遍历全部 Tab
    const on = +el.dataset.v === idx; // 判断是否命中当前索引
    el.classList.toggle("on", on); // 切换选中样式
    el.setAttribute("aria-selected", on ? "true" : "false"); // 同步无障碍选中状态
  }); // 结束 Tab 同步
  const dock = $("mainNav"); // 取底部悬浮 Tab 容器
  dock.style.setProperty("--dockIdx", idx); // 写入索引，驱动液体指示器滑到目标格
  dock.classList.remove("dockBump"); // 先移除类名，确保连续点击时动画可重放
  void dock.offsetWidth; // 读取布局属性强制回流，重置动画状态
  dock.classList.add("dockBump"); // 触发整体挤压回弹（物理质感）
  const glow = dock.querySelector(".dockGlow"); // 取液体指示器节点
  if (glow) { // 节点存在才操作，避免报错
    glow.classList.remove("pop"); // 移除旧动画类，保证连续切换也能重放
    void glow.offsetWidth; // 强制回流，重置动画播放状态
    glow.classList.add("pop"); // 触发指示器的液体挤压弹性
  } // 结束指示器弹性
  window.scrollTo(0, 0); // 回顶
  if (prevView && prevView.id) { const pl = prevView.id.replace("view", ""); if (viewHooks.leave[pl]) { try { viewHooks.leave[pl](); } catch (e) {} } } // 触发上一视图离开钩子（3D 暂停等）
  if (viewHooks.enter[name]) { try { viewHooks.enter[name](); } catch (e) {} } // 触发当前视图进入钩子（3D 恢复等）
  if (name === "History") { renderHistory(); renderPlayHist(); renderWeekBills(); renderLifeDashboard(); renderStubList(); } // 进历史页刷新统计、新玩法战绩、周账单、生涯看板与票根收藏（6.2 六轮）
  if (name === "Hall") { renderHall(); } // 进殿堂页刷新
} // 结束 showView
document.querySelectorAll("#mainNav .navItem").forEach(function (el) { // 绑定导航点击
  el.addEventListener("click", function () { showView(el.dataset.view); }); // 切换目标视图
  el.addEventListener("keydown", function (e) { // 键盘无障碍支持
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showView(el.dataset.view); } // 回车或空格等同点击
  }); // 结束键盘绑定
}); // 结束绑定

// ================= 底部 Tab 滚动感知（iOS 26 边缘效果） =================
(function dockScrollTuck() { // 自执行函数，隔离作用域避免污染全局
  const dock = $("mainNav"); // 取底部悬浮 Tab 容器
  if (!dock) { return; } // 节点缺失时直接退出，避免报错
  let lastY = window.scrollY; // 记录上一次滚动位置
  let restTimer = null; // 停止滚动的复位计时器
  window.addEventListener("scroll", function () { // 监听页面滚动
    const y = window.scrollY; // 当前滚动位置
    if (Math.abs(y - lastY) > 3) { dock.classList.add("dockTuck"); } // 有效位移才收缩，避免抖动
    lastY = y; // 更新记录
    clearTimeout(restTimer); // 清除上一轮计时器
    restTimer = setTimeout(function () { dock.classList.remove("dockTuck"); }, 220); // 停手 220ms 后复位
  }, { passive: true }); // 被动监听，不阻塞滚动性能
})(); // 立即执行

// ================= 购买 =================
btnBuy.addEventListener("click", function () { // 立即购买
  const cost = TIERS[tierIdx].price * qty + pickNumExtra(); // 总价（6.2：含付费选号加价 +2 / 豹子 +4）
  if (balance < cost) { toast("余额不足，先借钱或换个便宜的～"); return; } // 校验
  if (getStock() < qty) { toast("📦 " + ISSUERS[issuerIdx].name + "库存不足（剩 " + getStock().toLocaleString("zh-CN") + " 张），暂时售罄咯～"); return; } // 库存校验：售罄禁购
  if (savedBatch && !confirm("上一批还有未完成的票，购买新批次将作废旧票（已付款不退），继续吗？")) { return; } // 有暂存批次先确认覆盖
  payMoney(cost); // 扣款（滚轮下滑）
  deductStock(qty); // 扣减当前发行方库存
  remainBuy = qty; batchSeq = 1; batchCount = Math.ceil(qty / 100); // 分批参数：每 100 张一批，共拆 N 批
  batch = []; drawnCount = 0; zTop = 100; // 重置本批（票由 buildStack 统一生成）
  save(); // 存流水号
  buildStack(); // 洗出第一批叠票（每批最多 100 张，剩余自动排队）
  applyPickNum(); // 6.2：付费选号印号（若有）
  setTimeout(function () { showView("Wheel"); }, 650); // 停顿后切视图
}); // 结束购买

// ================= 一键爽刮 =================
$("btnHappy").addEventListener("click", function () { // 一键爽刮：快进抽卡 → 自动刮奖
  const cost = TIERS[tierIdx].price * qty + pickNumExtra(); // 总价（6.2：含付费选号加价）
  if (balance < cost) { toast("余额不足，先借钱或换个便宜的～"); return; } // 校验
  if (getStock() < qty) { toast("📦 " + ISSUERS[issuerIdx].name + "库存不足（剩 " + getStock().toLocaleString("zh-CN") + " 张），暂时售罄咯～"); return; } // 库存校验：售罄禁购
  if (savedBatch && !confirm("上一批还有未完成的票，爽刮新批次将作废旧票（已付款不退），继续吗？")) { return; } // 覆盖确认
  payMoney(cost); // 扣款
  deductStock(qty); // 扣减当前发行方库存
  remainBuy = qty; batchSeq = 1; batchCount = Math.ceil(qty / 100); // 分批参数：与普通购买一致
  batch = []; drawnCount = 0; zTop = 100; autoScratch = true; // 标记爽刮：进入刮奖页后自动开刮
  save(); // 存流水号
  if (happySpeedIdx >= 50) { startSkipSettle(cost); return; } // 滑杆最右=跳过模式：不进抽票/刮票页，直接白底等待页结算
  buildStack(); // 洗票铺台（写入 wheel 存档）
  applyPickNum(); // 6.2：付费选号印号（若有）
  showView("Wheel"); // 切到抽卡页
  fastForwardWheel(); // 快进抽卡环节
}); // 结束爽刮

// ================= 跳过模式：白底等待页 + 固定 30 秒进度条 + 收益汇总 =================
function startSkipSettle(cost) { // 跳过模式入口：生成全部票 → 展示 30 秒等待页
  batch = []; // 一次性生成整单全部票（不走分批抽卡）
  for (let i = 0; i < qty; i++) { batch.push({ no: serial++, tierName: TIERS[tierIdx].name, price: TIERS[tierIdx].price, prize: pickPrize(tierIdx, merchantIdx), revealed: false }); } // 逐张预配奖金（与管理员奖池抽样一致）
  applyPickNum(); // 6.2：付费选号印号（跳过模式同样生效）
  remainBuy = 0; batchCount = 1; // 全部并入本批，无排队
  save(); // 存流水号
  $("waitResult").style.display = "none"; $("waitDone").style.display = "none"; // 复位汇总与完成按钮
  $("waitFill").style.width = "0%"; $("waitPct").textContent = "0%"; // 复位进度条
  $("waitPage").classList.add("show"); // 显示白底等待页
  const start = Date.now(); // 记录起始时刻
  const totalMs = Math.min(Math.max(3000, +SKIP_CFG.capMs || 60000), Math.max(3000, batch.length * (+SKIP_CFG.msPerTicket || 950))); // 进度总时长 = min(上限, max(3s, 张数 × 每张计时))
  const timer = setInterval(function () { // 进度循环：按正常刮票时长走满（不因跳过加速）
    const pct = Math.min(100, Math.round((Date.now() - start) / totalMs * 100)); // 计算百分比
    $("waitFill").style.width = pct + "%"; // 刷新进度条
    $("waitPct").textContent = pct + "%"; // 刷新百分比
    if (pct < 100) { return; } // 未走满继续等待
    clearInterval(timer); // 走满停表
    finishSkipSettle(cost); // 结算并显示收益
  }, 100); // 100ms 步进刷新
} // 结束 startSkipSettle
function finishSkipSettle(cost) { // 跳过模式结算：按 reveal 状态机静默入账（无卡片无动画），随后展示收益
  let sum = 0, best = 0, jpWin = 0; // 中奖合计 / 单张最佳 / 头奖池清空金额
  const n = batch.length; // 张数（结算前快照，clearBatch 不动 batch 数组，但保险起见）
  batch.forEach(function (t) { // 逐张入账（逻辑与 reveal() 一致，仅无 DOM 演出）
    t.revealed = true; // 标记已揭晓
    if (t.prize === 0 && luckyCharge >= 100) { // 转运保底：蓄满后白票改写为最小非零档
      const nz = getPool(merchantIdx, tierIdx).filter(function (p) { return (+p.amt || 0) > 0; }); // 非零档集合
      t.prize = nz.length ? Math.min.apply(null, nz.map(function (p) { return +p.amt; })) : 0.5; // 取最小非零奖额
      t.lucky = true; luckyCharge = 0; // 保底标记与消耗
    } // 结束保底
    jackpot = Math.round((jackpot + t.price * 0.02) * 100) / 100; // 滚存抽成：每张票价 2% 入池
    if (t.prize > 0) { // 中奖
      streakW++; streakL = 0; sum += t.prize; if (t.prize > best) { best = t.prize; } // 连击与统计
      gainMoney(t.prize); // 入账（含优先还债/徽章/滚轮）
      if (t.prize >= 888) { const jp = Math.round(jackpot * 100) / 100; jackpot = 0; if (jp > 0) { gainMoney(jp); jpWin += jp; sum += jp; } } // 刮出 888：清空头奖池全部带走
    } else { streakW = 0; streakL++; luckyCharge = Math.min(100, luckyCharge + 17); shards += 1; } // 未中：连败推进/转运蓄力/碎片回收
  }); // 结束遍历
  save(); // 状态持久化
  saveHistoryRecord(); // 整单写入历史（投入/奖金/张数完整）
  autoScratch = false; clearBatch(); // 复位爽刮标记并清除暂存
  refreshJack(); refreshStreak(); refreshShards(); // 同步滚存牌/转运条/碎片行
  const net = sum - cost; // 净盈亏
  $("waitResult").innerHTML = "<h4>🎉 本批收益</h4>" + // 汇总卡内容
    '<div class="wRow"><span>张数</span><b>' + n + " 张</b></div>" + // 张数
    '<div class="wRow"><span>投入</span><b>¥' + cost.toFixed(2) + "</b></div>" + // 投入
    '<div class="wRow"><span>中奖合计</span><b>¥' + sum.toFixed(2) + "</b></div>" + // 中奖合计（含头奖池）
    (jpWin > 0 ? '<div class="wRow"><span>🎁 头奖池清空</span><b>¥' + jpWin.toFixed(2) + "</b></div>" : "") + // 头奖池明细（有才显示）
    '<div class="wRow"><span>单张最佳</span><b>¥' + best.toFixed(2) + "</b></div>" + // 单张最佳
    '<div class="wRow"><span>净盈亏</span><b class="netWin ' + (net > 0 ? "pos" : net < 0 ? "neg" : "") + '">' + (net > 0 ? "+" : net < 0 ? "-" : "") + "¥" + Math.abs(net).toFixed(2) + "</b></div>"; // 净盈亏（红涨绿跌按 A 股惯例：赚绿亏红）
  $("waitResult").style.display = "block"; // 显示汇总
  $("waitDone").style.display = "inline-block"; // 显示完成按钮
} // 结束 finishSkipSettle
$("waitDone").addEventListener("click", function () { // 完成按钮：关闭等待页回商店
  $("waitPage").classList.remove("show"); // 隐藏等待页
  batch = []; // 清空内存批次
  showView("Shop"); refreshResumable(); // 回商店并刷新暂存条
}); // 结束完成按钮
// ================= 爽刮速度滑杆（左=原速1.0x，中=1.1x~5.9x，右=跳过刮票过程） =================
let happySpeedIdx = parseInt(localStorage.getItem("scratch-happy-speed"), 10) || 0; // 速度档位（持久化）：0=原速，1~49=1.1x~5.9x，50=跳过
function happySpeedLabel(v) { // 按档位生成显示文案
  if (v >= 50) { return "跳过"; } // 最右档：直接跳过刮票过程
  if (v <= 0) { return "1.0x"; } // 最左档：原速
  return (1.1 + (v - 1) * 0.1).toFixed(1) + "x"; // 中段：1.1x ~ 5.9x（0.1 步进）
} // 结束 happySpeedLabel
$("happySpeed").addEventListener("input", function () { // 拖动滑杆实时响应
  happySpeedIdx = parseInt(this.value, 10); // 读取当前档位
  $("happySpeedVal").textContent = happySpeedLabel(happySpeedIdx); // 刷新速度显示
  localStorage.setItem("scratch-happy-speed", happySpeedIdx); // 持久化到本地
}); // 结束滑杆监听
function fastForwardWheel() { // 快进抽卡：每 36ms 抽一张，托盘编号片快速长出
  const timer = setInterval(function () { // 快进循环器
    if (picked.length >= batchTotal() || !stack.length) { // 本批抽满或没票
      clearInterval(timer); // 停止循环
      setTimeout(function () { donePick(); }, 420); // 稍停进刮奖页
      return; // 结束
    } // 结束判断
    const t = stack.shift(); // 顶票出栈
    picked.push(t); // 进本批
    const chip = document.createElement("span"); // 托盘编号片
    chip.className = "chip"; chip.textContent = "No." + padNo(t.no); // 内容（chipIn 入场动画自动播放）
    $("tray").appendChild(chip); // 上托盘
    if (stack.length) { mountTop(); } else { updateStackInfo(); } // 有剩票刷新顶票，否则刷进度
  }, 36); // 36ms/张的快进节奏
} // 结束 fastForwardWheel

// ================= 百张叠票 =================
let stack = []; // 待抽的本批票（叠在一起，每批最多 100 张）
let picked = []; // 本批已抽出的票
let busy = false; // 抽票动画锁（防连点）
let remainBuy = 0; // 本次购买还没洗出票的剩余张数（>100 张自动分批的关键）
let batchSeq = 1, batchCount = 1; // 当前批号 / 总批数（每 100 张一批）
function padNo(n) { return String(n).padStart(4, "0"); } // 编号补零

function batchTotal() { // 本批总张数 = 未抽 + 已抽（分批后每批 ≤100，与整单 qty 区分）
  return stack.length + picked.length; // 相加即本批量
} // 结束 batchTotal

function buildStack() { // 洗一批新票并铺叠（购买 >100 张时自动分批，每批最多 100 张）
  stack = []; picked = []; busy = false; // 复位状态
  const n = Math.min(100, remainBuy); // 本批张数：不超过叠票池 100 张上限，也不超过本次购买余量
  for (let i = 0; i < n; i++) { // 生成本批票据
    stack.push({ no: serial++, tierName: TIERS[tierIdx].name, price: TIERS[tierIdx].price, prize: pickPrize(tierIdx, merchantIdx), revealed: false }); // 每张预配奖金（按管理员奖池抽样）
  } // 结束生成
  remainBuy -= n; // 扣减本次购买余量（存档随 saveBatch 持久化）
  for (let i = stack.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = stack[i]; stack[i] = stack[j]; stack[j] = tmp; } // 洗牌：顶票即随机
  save(); // 存流水号
  saveBatch("wheel"); // 写入批次存档（抽卡阶段，退出可恢复）
  buildWheelUI(); // 铺抽卡页 UI（与恢复场景共用）
} // 结束 buildStack

function buildWheelUI() { // 依据现有 stack/picked 重建抽卡页 UI（不重洗票据）
  busy = false; // 解锁
  $("tray").innerHTML = ""; // 清空编号托盘
  picked.forEach(function (t) { // 重建已抽编号片
    const chip = document.createElement("span"); // 编号片
    chip.className = "chip"; chip.textContent = "No." + padNo(t.no); // 内容
    $("tray").appendChild(chip); // 上托盘
  }); // 结束遍历
  const stage = $("stackStage"); // 舞台
  stage.querySelectorAll(".slayer").forEach(function (el) { el.remove(); }); // 清旧票背层
  for (let i = 0; i < 7; i++) { // 铺 7 层票背示意厚度
    const l = document.createElement("div"); // 层元素
    l.className = "slayer"; // 样式
    l.style.transform = "translateX(-50%) translateY(" + ((i + 1) * 5) + "px) rotate(" + ((i - 3) * 2) + "deg)"; // 错落微旋堆叠
    stage.appendChild(l); // 上台
  } // 结束铺层
  if (stack.length) { mountTop(); } // 有剩票：挂顶票
  else { const old = $("topTicket"); if (old) old.remove(); updateStackInfo(); } // 无剩票：清顶票只刷进度
} // 结束 buildWheelUI

function mountTop() { // 把当前顶票装上舞台
  const old = $("topTicket"); // 旧顶票
  if (old) old.remove(); // 移除
  const t = stack[0]; // 新顶票（已洗匀）
  const el = document.createElement("div"); // 票元素
  el.id = "topTicket"; // 供引用
  el.innerHTML = '<span class="band">刮刮乐</span><div class="nozone"><span class="no">No.' + padNo(t.no) + '</span><span class="tp">' + t.tierName + ' · ¥' + t.price + '</span><div class="cover">?</div></div><i class="dash"></i><i class="barcode"></i>'; // 票面（编号被银灰涂层盖住）
  el.addEventListener("click", pickTop); // 单击抽取
  $("stackStage").appendChild(el); // 上台
  updateStackInfo(); // 刷新进度
} // 结束 mountTop

function updateStackInfo() { // 刷新叠票进度
  const tag = batchCount > 1 ? "第 " + batchSeq + " / " + batchCount + " 批 · " : ""; // 分批时显示批号
  $("stackInfo").textContent = tag + "共 " + batchTotal() + " 张 · 已选 " + picked.length + " / " + batchTotal(); // 文案（本批口径，不再误用整单 qty）
  $("btnRandom").disabled = busy || picked.length >= batchTotal(); // 本批抽满或动画中禁用
} // 结束 updateStackInfo

function pickTop() { // 抽出顶票：上滑亮编号，再飞入托盘
  if (busy || picked.length >= batchTotal()) return; // 本批抽满或动画中忽略
  busy = true; // 上锁
  const el = $("topTicket"); // 顶票
  el.style.pointerEvents = "none"; // 防连点
  el.classList.add("cover-off"); // 涂层滑开亮出编号
  el.style.transform = "translateX(-50%) translateY(-88px) scale(1.07)"; // 往上滑并微放大
  setTimeout(function () { // 停顿让用户看清编号
    const t = stack.shift(); // 顶票出栈
    picked.push(t); // 进本批
    const chip = document.createElement("span"); // 托盘编号片
    chip.className = "chip"; chip.textContent = "No." + padNo(t.no); // 内容
    $("tray").appendChild(chip); // 上托盘
    el.animate([ // 缩小飞向托盘方向
      { transform: "translateX(-50%) translateY(-88px) scale(1.07)", opacity: 1 },
      { transform: "translateX(-50%) translateY(-26px) scale(.32)", opacity: 0 }
    ], { duration: 420, easing: "ease-in" }).onfinish = function () { // 动画结束
      el.remove(); // 移除旧顶票
      busy = false; // 解锁
      updateStackInfo(); // 刷新进度
      if (picked.length < batchTotal()) { mountTop(); } // 本批未抽满：换下一张
      else { setTimeout(donePick, 480); } // 本批抽满：稍停进刮奖
    }; // 结束动画回调
  }, 620); // 编号展示时长（毫秒）
} // 结束 pickTop

function donePick() { // 抽满：进入刮奖页
  batch = picked; // 本批即已抽出的票
  buildPile(); // 叠牌
  showView("Scratch"); // 切视图
  saveBatch("scratch"); // 记录批次进入刮卡阶段（中途退出可恢复）
  if (autoScratch) { scratchAll(qty > FAST_QTY_LIMIT); } // 爽刮：自动开刮（>30 张快进；标记保留至整单刮完，分批续刮依赖它）
} // 结束 donePick

$("btnRandom").addEventListener("click", pickTop); // 随机抽出：顶票已洗匀，直接抽
$("btnBackShop1").addEventListener("click", function () { showView("Shop"); refreshResumable(); }); // 回商店（批次暂存不销毁，可从商店继续）

// ================= 刮奖叠放区 =================
function buildPile() { // 叠牌堆
  const pile = $("pile"); // 容器
  pile.innerHTML = ""; // 清空
  const drawn = batch; // 本批全部是要刮的票（抽满才进来）
  drawn.forEach(function (t, i) { // 逐张建卡
    const card = document.createElement("div"); // 卡
    card.className = "scard"; // 样式
    const ox = ((i % 6) - 2.5) * 34; // 横向错位
    const oy = Math.floor(i / 6) * 10; // 纵向错位
    const rr = (Math.sin(i * 7.3) * 4).toFixed(1); // 伪随机角度
    card.style.transform = "translate(calc(-50% + " + ox + "px), " + oy + "px) rotate(" + rr + "deg)"; // 位姿
    card.style.zIndex = i + 1; // 层级
    card.innerHTML = // 票面
      '<div class="shead"><span>No.' + String(t.no).padStart(4, "0") + " · " + t.tierName + '</span><span>¥' + t.price + '</span></div>' + // 票头
      '<div class="szone"><div class="amt">?</div><canvas width="252" height="110"></canvas></div>' + // 涂层盖问号
      '<div class="sdone"></div>'; // 结果行
    pile.appendChild(card); // 上堆
    t.card = card; // 引用
    t.amtEl = card.querySelector(".amt"); // 金额元素
    t.doneEl = card.querySelector(".sdone"); // 结果元素
    card.addEventListener("click", function (e) { bringTop(t, card); e.stopPropagation(); }); // 顶到最前
    initCoat(t); // 铺涂层
    if (t.revealed) { // 恢复场景：已刮过的票直接呈现结果（不重复入账、不播动画）
      t.coat.classList.add("cleared"); // 涂层保持淡出
      if (t.prize > 0) { // 中奖态
        t.amtEl.textContent = "¥" + t.prize.toFixed(2); // 金额
        if (t.prize >= t.price * 4) { t.amtEl.classList.add("big"); } // 大奖字号
        t.doneEl.textContent = "¥" + t.prize.toFixed(2) + " 已到账"; // 结果
      } else { // 未中奖态
        t.amtEl.textContent = "未中奖"; // 文字
        t.doneEl.textContent = "谢谢惠顾，再刮下一张试试"; // 文案
      } // 结束分支
    } // 结束恢复分支
  }); // 结束遍历
  updateScratchInfo(); // 刷新进度
  $("btnShopAgain").style.display = "none"; // 隐藏再买
  $("btnScratchAll").style.display = "inline-block"; // 显示一键刮开
} // 结束 buildPile

function scratchAll(fast) { // 一键刮开：剧场式逐张进行（fast=true 快进节奏，动画保留；速度由爽刮滑杆控制）
  const left = batch.filter(function (t) { return !t.revealed; }); // 未揭晓的票
  if (!left.length) return; // 全刮完忽略
  $("btnScratchAll").disabled = true; // 防连点
  if (happySpeedIdx >= 50) { // 滑杆拉到最右：跳过模式，不播过程瞬间全部揭晓
    left.forEach(function (t) { bringTop(t, t.card); reveal(t); }); // 逐张置顶并直接揭晓（状态与动画结果照常入账）
    $("btnScratchAll").disabled = false; // 立即恢复按钮（整单刮完时 reveal 内部已切换界面）
    return; // 结束，无需排队
  } // 结束跳过分支
  const mult = happySpeedIdx > 0 ? (1.1 + (happySpeedIdx - 1) * 0.1) : 1; // 速度倍率：1.0（原速）~ 5.9
  const base = (fast && mult <= 1) ? 170 : 950; // 基准节奏：原速档沿用旧规则（>30 张快进 170ms，否则 950ms）
  const STEP = Math.max(60, Math.round(base / mult)); // 每张节奏 = 基准 ÷ 倍率（下限 60ms，保证置顶动画不至于完全失效）
  left.forEach(function (t, i) { // 逐张排队
    setTimeout(function () { // 错峰执行
      bringTop(t, t.card); // 先把这一张顶到最前并摆正
      reveal(t); // 再揭晓它（涂层淡出显示金额，中奖则金币飞向余额）
    }, i * STEP); // 一张接一张
  }); // 结束排队
  setTimeout(function () { $("btnScratchAll").disabled = false; }, left.length * STEP + 200); // 全部揭晓后恢复按钮
} // 结束 scratchAll
$("btnScratchAll").addEventListener("click", function () { scratchAll(false); }); // 手动一键刮开：原速

function bringTop(t, card) { // 顶到最前
  card.style.zIndex = ++zTop; // 置顶
  card.classList.add("top"); // 投影
  card.style.transform = "translate(-50%, 8px) rotate(0deg) scale(1.03)"; // 摆正
} // 结束 bringTop

function initCoat(t) { // 铺涂层
  const cv = t.card.querySelector("canvas"); // 画布
  t.coat = cv; t.cctx = cv.getContext("2d"); // 引用
  const c = t.cctx; // 简写
  c.fillStyle = "#9aa0ad"; c.fillRect(0, 0, cv.width, cv.height); // 银灰底
  c.strokeStyle = "#a6acb9"; c.lineWidth = 9; // 条纹
  for (let x = -cv.height; x < cv.width; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + cv.height, cv.height); c.stroke(); } // 斜纹
  c.fillStyle = "rgba(255,255,255,.9)"; // 问号色
  c.font = "600 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; // 字体
  c.fillText("?", cv.width / 2, cv.height / 2); // 大问号（刮少只看到它）
  c.font = "500 13px sans-serif"; c.fillText("刮开涂层揭晓", cv.width / 2, cv.height / 2 + 38); // 小提示
  let scratching = false, moves = 0; // 状态
  function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; } // 坐标
  cv.addEventListener("pointerdown", function (e) { // 开刮
    e.preventDefault(); e.stopPropagation(); cv.setPointerCapture(e.pointerId); scratching = true; // 锁指针
    const p = pos(e); c.globalCompositeOperation = "destination-out"; c.lineWidth = 26; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 0.1, p[1] + 0.1); c.stroke(); // 擦一点
  }); // 结束按下
  cv.addEventListener("pointermove", function (e) { // 持续刮
    if (!scratching) return; // 未按忽略
    const p = pos(e); c.lineTo(p[0], p[1]); c.stroke(); // 擦除
    moves++; // 计步（拆分自增便于两路限流）
    if (moves % 10 === 0) { checkRatio(t); } // 周期检测刮开比例（原逻辑）
    if (moves % 5 === 0) { const g = cv.getBoundingClientRect(); sprayFlecks(g.left + p[0], g.top + p[1], 3); } // 每 5 步从刮点喷 3 片刮屑
  }); // 结束移动
  window.addEventListener("pointerup", function () { if (scratching) { scratching = false; checkRatio(t); } }); // 松手检测
} // 结束 initCoat

function checkRatio(t) { // 刮开比例
  if (t.revealed) return; // 已揭晓
  const cv = t.coat, c = t.cctx; // 引用
  const data = c.getImageData(0, 0, cv.width, cv.height).data; // 像素
  let clear = 0, total = 0; // 统计
  for (let i = 3; i < data.length; i += 64) { total++; if (data[i] < 40) clear++; } // 采样
  if (clear / total >= REVEAL_AT) { reveal(t); } // 达标揭晓
} // 结束 checkRatio

function reveal(t) { // 揭晓（含连击/转运/滚存/碎片状态机）
  t.revealed = true; // 标记
  if (t.prize === 0 && luckyCharge >= 100) { // 转运保底：蓄满后白票强制改写为奖池最小非零档
    const nz = getPool(merchantIdx, tierIdx).filter(function (p) { return (+p.amt || 0) > 0; }); // 非零档集合
    t.prize = nz.length ? Math.min.apply(null, nz.map(function (p) { return +p.amt; })) : 0.5; // 取最小非零奖额（空池兜底 0.5）
    t.lucky = true; // 保底标记（演出用）
    luckyCharge = 0; // 消耗转运
    toast("🍀 转运保底触发！这张必有奖"); // 提示
  } // 结束保底改写
  saveBatch("scratch"); // 每刮一张立即存档（改写后的奖额随存档持久化）
  kachaDrop(t); // 6.2 七轮：集字卡掉落判定（35% 概率掉一张字牌，优先补缺字）
  t.coat.classList.add("cleared"); // 淡出禁刮
  jackpot = Math.round((jackpot + t.price * 0.02) * 100) / 100; // 滚存抽成：每张票票价 2% 入池
  if (t.prize > 0) { // 中奖
    streakW++; streakL = 0; // 连击推进、连败清零
    t.amtEl.textContent = "¥" + t.prize.toFixed(2); // 金额（可非整数）
    if (t.prize >= t.price * 4 || t.lucky) { t.amtEl.classList.add("big"); } // 大奖字号（保底也醒目）
    const repaid = gainMoney(t.prize); // 入账（含滚轮/还债/徽章）
    t.doneEl.textContent = (t.lucky ? "🍀 转运保底 · " : "") + (repaid > 0 ? "还债 ¥" + repaid.toFixed(2) + " · " : "") + "¥" + t.prize.toFixed(2) + " 已到账"; // 文案
    if (fxOn) { flyCoins(t.card, t.prize, streakW >= 2 ? Math.min(3, streakW) : 1); } // 金币飞向余额（连击加量，×3 封顶；动画开关关闭时跳过）
    if (navigator.vibrate) { navigator.vibrate(t.prize >= 666 ? [40, 60, 40] : 22); } // 刮中震动反馈（大奖节奏震，桌面端无效无害）
    if (t.prize >= 888) { // 刮出 888：清空滚存头奖池全部带走
      const jp = Math.round(jackpot * 100) / 100; // 池内金额
      jackpot = 0; // 清池重滚
      if (jp > 0) { gainMoney(jp); t.doneEl.textContent += " · 🎁 头奖池 ¥" + jp.toFixed(2) + " 已清空入账"; } // 池内有钱才二次入账（顺带还债/徽章）
      if (fxOn) { bigWin(t.prize, true); } // 头奖池专属演出（大字报 + 双倍彩带；动画开关关闭时跳过）
    } else if (t.prize >= 666) { if (fxOn) { bigWin(t.prize); } } // 头奖/至尊大奖：全屏彩带 + 大字报演出（受动画开关控制）
    if (streakW >= 2 && !autoScratch) { toast("🔥 连中 " + streakW + " 张！手气正旺"); } // 连击提示（爽刮模式不刷屏）
  } else { // 未中
    streakW = 0; streakL++; // 连击归零、连败推进
    luckyCharge = Math.min(100, luckyCharge + 17); // 转运蓄力（约 6 张蓄满）
    shards += 1; // 废票回收：+1 碎片
    t.amtEl.textContent = "未中奖"; // 文字
    t.doneEl.textContent = "谢谢惠顾 · 🧩 碎片 +1"; // 文案
    if (luckyCharge >= 100 && streakL >= 6) { toast("🍀 转运条已蓄满！下一张保底必中"); } // 恰好蓄满提示
  } // 结束分支
  save(); // 状态持久化（连击/转运/滚存/碎片随每张落盘）
  refreshJack(); refreshStreak(); refreshShards(); // 同步滚存牌/转运条/碎片行
  updateScratchInfo(); // 进度
} // 结束 reveal

function updateScratchInfo() { // 进度信息
  const done = batch.filter(function (t) { return t.revealed; }).length; // 已揭晓
  const sum = batch.filter(function (t) { return t.revealed; }).reduce(function (s, t) { return s + t.prize; }, 0); // 合计
  const tag = batchCount > 1 ? "第 " + batchSeq + " / " + batchCount + " 批 · " : ""; // 分批购买时显示批号
  $("scratchInfo").textContent = tag + "已刮 " + done + " / " + batch.length + " · 本批共刮出 ¥" + sum.toFixed(2) + (streakW >= 2 ? " · 🔥连中×" + streakW : ""); // 文案（连击附注）
  if (done === batch.length && batch.length > 0) { // 本批全刮完
    saveHistoryRecord(); // 每批刮完各自记入历史（整单分批各成一条，投入/奖金/编号独立完整）
    if (remainBuy > 0) { batchSeq++; setTimeout(nextBatch, 600); return; } // 还有排队张数：稍停 600ms 自动无缝开下一批
    $("btnShopAgain").style.display = "inline-block"; $("btnScratchAll").style.display = "none"; autoScratch = false; clearBatch(); // 整单全部刮完：显示再买、隐藏一键刮开、复位爽刮标记并清除批次存档
  } // 结束完成分支
} // 结束 updateScratchInfo

function nextBatch() { // 自动无缝续开下一批（购买 >100 张自动分批的续批入口）
  if (!$("viewScratch").classList.contains("show")) { return; } // 用户已离开刮奖页（600ms 窗口内点了回商店等）：放弃自动续批
  batch = []; zTop = 100; // 重置本批容器与层级
  buildStack(); // 洗下一批票（内部扣 remainBuy 并写入 wheel 存档）
  batch = stack; stack = []; // 本批 = 刚洗出的票（续批跳过抽卡环节，直接上桌）
  saveBatch("scratch"); // 以刮卡阶段重新存档（stage 与现场一致，中途退出可恢复）
  buildPile(); // 铺刮奖堆
  showView("Scratch"); // 切到刮奖页
  toast("🧾 第 " + batchSeq + " / " + batchCount + " 批已上桌" + (remainBuy > 0 ? "，还剩 " + remainBuy + " 张排队中" : "")); // 提示
  if (autoScratch) { scratchAll(qty > FAST_QTY_LIMIT); } // 爽刮模式：本批也自动开刮（标记保留至整单刮完才复位）
} // 结束 nextBatch

// ================= 刮票历史 =================
const MSG_LOSE = [ // 亏损鼓励语（随机取用）
  "开奖不如意，好运正在路上 💪", "小亏怡情，下一批翻盘回来！", "破财免灾，好运马上就到～", "别灰心，大奖正在酝酿之中！", "权当娱乐，明天继续冲！"
]; // 结束鼓励语
const MSG_WIN = [ // 盈利祝福语（随机取用）
  "财源滚滚，鸿运当头 🎉", "手气爆棚，见者沾光！", "恭喜发财，大吉大利！", "欧气满满，建议乘胜追击！", "今日宜刮票，诸事皆宜！"
]; // 结束祝福语
const MSG_EVEN = [ "不亏不赚，稳稳当当 😎", "打平也是一种实力！" ]; // 打平语
function pickMsg(arr) { return arr[Math.floor(Math.random() * arr.length)]; } // 随机取一条
function loadHistory() { // 读取历史存档
  try { return JSON.parse(localStorage.getItem("scratch-history")) || []; } catch (e) { return []; } // 容错
} // 结束 loadHistory
function saveHistoryRecord() { // 一批刮完：写入历史
  const hist = loadHistory(); // 读旧档
  const cost = batch.reduce(function (s, t) { return s + t.price; }, 0); // 本批成本（票价 × 数量）
  const prize = batch.reduce(function (s, t) { return s + t.prize; }, 0); // 本批总中奖
  hist.unshift({ // 新记录放最前
    time: Date.now(), // 时间戳
    merchant: MERCHANTS[merchantIdx].name, // 商家名称
    tier: batch[0] ? batch[0].tierName : TIERS[tierIdx].name, // 彩票种类
    qty: batch.length, // 购买数量
    cost: Math.round(cost * 100) / 100, // 本身数额（投入）
    prize: Math.round(prize * 100) / 100, // 中奖数额
    nos: batch.map(function (t) { return t.no; }) // 全部彩票编号
  }); // 结束记录
  while (hist.length > 300) { hist.pop(); } // 上限 300 条，防止无限膨胀
  localStorage.setItem("scratch-history", JSON.stringify(hist)); // 写回
} // 结束 saveHistoryRecord
function renderCareer(hist, tc, tp) { // 刮票生涯统计卡（最欧一刮 / 最长连亏 / 总回报率 / 徽章进度）
  const card = $("careerCard"); // 容器引用
  if (!hist.length) { card.style.display = "none"; return; } // 无记录：整卡隐藏
  card.style.display = ""; // 有记录：显示
  const best = hist.reduce(function (b, h) { return (h.prize - h.cost) > (b.prize - b.cost) ? h : b; }, hist[0]); // 最欧一刮（单批净利最高）
  let cur = 0, maxLose = 0; // 当前连亏计数 / 最长连亏
  for (let i = hist.length - 1; i >= 0; i--) { const netOne = hist[i].prize - hist[i].cost; if (netOne < 0) { cur++; if (cur > maxLose) { maxLose = cur; } } else { cur = 0; } } // 存档新记录在前，倒序遍历即按时间正序数连亏
  const roi = tc > 0 ? Math.round(tp / tc * 1000) / 10 : 0; // 总回报率（%）
  const bestNet = Math.round((best.prize - best.cost) * 100) / 100; // 最欧一刮净利
  const bestCls = bestNet > 0 ? "cGood" : (bestNet < 0 ? "cBad" : ""); // 最欧配色（负值也要如实显示）
  const nextIdx = THRESHOLDS.findIndex(function (t) { return totalWin < t; }); // 下一个未达门槛下标
  let barHtml; // 徽章进度片段
  if (nextIdx < 0) { barHtml = '<div class="cItem cBar">徽章殿堂<b>50 枚全点亮 · 满贯！</b></div>'; } // 已满贯
  else { // 还有徽章没点亮
    const th = THRESHOLDS[nextIdx], prev = nextIdx > 0 ? THRESHOLDS[nextIdx - 1] : 0; // 目标门槛与区间下限
    const pct = Math.min(100, Math.max(0, (totalWin - prev) / (th - prev) * 100)); // 区间内进度百分比
    const lv = levelOf(nextIdx); // 下一枚徽章等级
    barHtml = '<div class="cItem cBar">距下一枚徽章 Lv' + (lv + 1) + ' ' + LEVEL_NAMES[lv] + '（累计刮出 ¥' + totalWin.toFixed(2) + ' / 门槛 ¥' + fmtTH(th) + '）' + // 进度说明
      '<div class="cBarTrack"><div class="cBarFill" style="width:' + pct.toFixed(1) + '%;background:' + LEVEL_COLORS[lv] + '"></div></div></div>'; // 色条随等级
  } // 结束徽章分支
  card.innerHTML = '<h4>刮票生涯</h4><div class="cGrid">' + // 卡内容
    '<div class="cItem">最欧一刮<b class="' + bestCls + '">+¥' + bestNet.toFixed(2) + '</b><span class="cSub">' + best.merchant + ' · ' + best.tier + '</span></div>' + // 最欧一刮（含出处）
    '<div class="cItem">最长连亏<b>' + maxLose + ' 批</b><span class="cSub">' + (maxLose >= 5 ? "风雨之后见彩虹" : "手气曲线记录") + '</span></div>' + // 连亏（配一句调侃）
    '<div class="cItem">总回报率<b>' + roi.toFixed(1) + '%</b><span class="cSub">每投 100 元刮回 ' + roi.toFixed(1) + ' 元</span></div>' + // 回报率（通俗解释）
    '<div class="cItem">累计刮出<b>¥' + totalWin.toFixed(2) + '</b><span class="cSub">' + hist.length + ' 批战绩</span></div>' + // 累计刮出
    barHtml + '</div>'; // 徽章进度条收尾
} // 结束 renderCareer

function renderHistory() { // 渲染历史页（汇总 + 逐批记录）
  const hist = loadHistory(); // 读取
  const sumEl = $("hSummary"), list = $("hlist"); // 引用
  let tc = 0, tp = 0; // 总投入 / 总中奖
  hist.forEach(function (h) { tc += h.cost; tp += h.prize; }); // 累加
  const net = Math.round((tp - tc) * 100) / 100; // 净盈亏
  const cls = net > 0 ? "win" : (net < 0 ? "lose" : "even"); // 汇总配色
  sumEl.className = cls; // 套色
  const tip = net > 0 ? pickMsg(MSG_WIN) : (net < 0 ? pickMsg(MSG_LOSE) : pickMsg(MSG_EVEN)); // 汇总语
  sumEl.innerHTML = '<span style="font-size:13px;color:#6f6a5c">总共刮了 ' + hist.length + ' 批 · 总投入 ¥' + tc.toFixed(2) + ' · 总中奖 ¥' + tp.toFixed(2) + '</span>' + // 统计行
    '<div class="net">' + (net > 0 ? "目前赚了 ¥" : net < 0 ? "目前亏了 ¥" : "目前不亏不赚 ") + Math.abs(net).toFixed(2) + '</div>' + // 净盈亏
    '<div class="msg">' + tip + '</div>'; // 汇总语
  renderCareer(hist, tc, tp); // 渲染刮票生涯统计卡
  if (!hist.length) { list.innerHTML = '<div class="hempty">还没有刮票记录，去大厅买一批试试手气吧～</div>'; return; } // 空状态
  list.innerHTML = ""; // 清列表
  hist.forEach(function (h) { // 逐批渲染
    const netOne = Math.round((h.prize - h.cost) * 100) / 100; // 本批盈亏
    const clsOne = netOne > 0 ? "win" : (netOne < 0 ? "lose" : "even"); // 本批配色
    const msgOne = netOne > 0 ? pickMsg(MSG_WIN) : (netOne < 0 ? pickMsg(MSG_LOSE) : pickMsg(MSG_EVEN)); // 本批语
    const d = document.createElement("div"); // 卡
    d.className = "hrec " + clsOne; // 红绿条
    const dt = new Date(h.time); // 时间
    const noText = "No." + h.nos.map(function (n) { return String(n).padStart(4, "0"); }).join("、No."); // 编号全文（容器内滚动）
    d.innerHTML = '<div class="top"><span>' + (dt.getMonth() + 1) + '月' + dt.getDate() + '日 ' + String(dt.getHours()).padStart(2, "0") + ':' + String(dt.getMinutes()).padStart(2, "0") + '</span><span>' + h.merchant + ' · ' + h.tier + '</span><span>买了 ' + h.qty + ' 张</span></div>' + // 概要行
      '<div class="amounts"><span>投入 ¥' + h.cost.toFixed(2) + '</span><span>中奖 ¥' + h.prize.toFixed(2) + '</span><span class="profit">' + (netOne > 0 ? "赚 ¥" : netOne < 0 ? "亏 ¥" : "平 ¥") + Math.abs(netOne).toFixed(2) + '</span></div>' + // 金额行
      '<div class="nos">' + noText + '</div>' + // 编号区
      '<div class="msg">' + msgOne + '</div>'; // 鼓励/祝福语
    list.appendChild(d); // 上列表
  }); // 结束遍历
} // 结束 renderHistory

$("btnShopAgain").addEventListener("click", function () { showView("Shop"); refreshResumable(); }); // 再买：回商店（批次已刮完自动清档）

// ================= 金币飞行 =================
function flyCoins(card, amount, mult) { // 奖金化金币飞向余额（mult 连击倍数，金币数量加成）
  mult = mult || 1; // 未传按 1
  const r = card.getBoundingClientRect(); // 起点
  const target = balPill.getBoundingClientRect(); // 终点
  const sx = r.left + r.width / 2, sy = r.top + r.height / 2; // 起点中心
  const ex = target.left + target.width / 2, ey = target.top + target.height / 2; // 终点中心
  const n = Math.min(24, Math.max(6, Math.round(amount) + 4)) * mult; // 数量（连击乘数，封顶 24 防卡顿）
  for (let i = 0; i < n; i++) { // 逐颗
    const coin = document.createElement("div"); // 金币
    coin.className = "coin"; coin.textContent = "¥"; // 样式
    const jx = (Math.random() - 0.5) * 60, jy = (Math.random() - 0.5) * 40; // 抖动
    coin.style.left = (sx + jx) + "px"; coin.style.top = (sy + jy) + "px"; // 初始位
    document.body.appendChild(coin); // 上屏
    coin.animate([ // 弧线飞行
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + (ex - sx - jx) * 0.5 + "px," + (ey - sy - jy - 90) * 0.5 + "px) scale(1.15)", opacity: 1, offset: 0.5 },
      { transform: "translate(" + (ex - sx - jx) + "px," + (ey - sy - jy) + "px) scale(0.5)", opacity: 0.9 }
    ], { duration: 900, delay: i * 70, easing: "cubic-bezier(.4,.1,.3,1)", fill: "forwards" }).onfinish = (function (c) { return function () { c.remove(); }; })(coin); // 移除
  } // 结束循环
} // 结束 flyCoins

// ================= 大奖时刻（666/888 专属演出） =================
function bigWin(prize, isJack) { // 全屏彩带喷发 + 大字报定格（isJack = 头奖池清空专属演出）
  if (navigator.vibrate) { navigator.vibrate(isJack ? [60, 40, 60, 40, 90] : [40, 60, 40]); } // 移动端震动（头奖池更隆重）
  const old = $("bigWinBanner"); if (old) { old.remove(); } // 防重入：清掉上一场演出
  const bn = document.createElement("div"); // 大字报容器
  bn.id = "bigWinBanner"; // 样式挂钩
  bn.innerHTML = isJack // 头奖池模式换标题与配色
    ? '<div class="bwT bwJ">头 奖 池 清 空</div><div class="bwM">¥ ' + prize.toFixed(2) + ' 全部带走</div>' // 标题与金额
    : '<div class="bwT">' + (prize >= 888 ? "至 尊 大 奖" : "头 奖 开 出") + '</div><div class="bwM">¥ ' + prize.toFixed(2) + '</div>'; // 普通大奖
  document.body.appendChild(bn); // 上屏
  requestAnimationFrame(function () { bn.classList.add("play"); }); // 下一帧播动画（保证过渡生效）
  setTimeout(function () { bn.remove(); }, 2300); // 播完自毁
  const colors = isJack ? ["#f6c775", "#e8b23a", "#fffdf8", "#e0862f", "#d64541", "#b98a1c"] : ["#d64541", "#e0862f", "#f6c775", "#3fae7a", "#3f7fd1", "#8b5fd1"]; // 色盘（头奖池金系）
  const per = isJack ? 72 : 48; // 每侧纸屑数（头奖池翻倍）
  for (let side = 0; side < 2; side++) { // 左右两个喷口
    for (let i = 0; i < per; i++) { // 逐片彩纸
      const cf = document.createElement("div"); // 纸屑元素
      cf.className = "confetti"; // 样式挂钩
      cf.style.width = (6 + Math.random() * 6) + "px"; cf.style.height = (8 + Math.random() * 8) + "px"; // 随机尺寸
      cf.style.background = colors[Math.floor(Math.random() * colors.length)]; // 随机颜色
      cf.style.left = (side ? innerWidth - 6 : 6) + "px"; cf.style.top = innerHeight * 0.62 + "px"; // 左右下角起喷
      document.body.appendChild(cf); // 上屏
      const dir = side ? -1 : 1; // 喷射方向（左右互指）
      const dx = dir * (innerWidth * (0.3 + Math.random() * 0.45)); // 横向抛程
      const dy = -innerHeight * (0.5 + Math.random() * 0.35); // 纵向上抛高度
      cf.animate([ // 三段近似抛物线：起喷 → 抛物顶点 → 落地淡出
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px," + dy + "px) rotate(" + dir * (300 + Math.random() * 400) + "deg)", opacity: 1, offset: 0.45 },
        { transform: "translate(" + dx + "px," + innerHeight * 0.55 + "px) rotate(" + dir * (600 + Math.random() * 500) + "deg)", opacity: 0 }
      ], { duration: 1900 + Math.random() * 900, easing: "cubic-bezier(.15,.6,.4,1)" }).onfinish = function () { cf.remove(); }; // 播完回收
    } // 结束逐片
  } // 结束左右喷口
} // 结束 bigWin

// ================= 刮屑粒子层（刮涂层时掉银灰碎屑） =================
const fleckCv = document.createElement("canvas"); // 动态创建粒子画布
fleckCv.id = "fleckCanvas"; // 样式挂钩
document.body.appendChild(fleckCv); // 上屏
const fctx = fleckCv.getContext("2d"); // 2D 上下文
let flecks = [], fleckRaf = 0; // 粒子池与循环锁
function fleckResize() { fleckCv.width = innerWidth; fleckCv.height = innerHeight; } // 画布尺寸随视口
fleckResize(); window.addEventListener("resize", fleckResize); // 初始化并监听窗口变化
const FLECK_COLS = ["#9aa0ad", "#a6acb9", "#c8ccd4", "#8d93a1"]; // 刮屑色盘（涂层同系银灰）
function sprayFlecks(x, y, n) { // 从屏幕坐标 (x,y) 喷出 n 片刮屑
  for (let i = 0; i < n; i++) { // 逐片生成
    if (flecks.length > 220) { return; } // 粒子上限：连续快刮不卡顿
    const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 3; // 随机喷出方向与初速
    flecks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.6, s: 2 + Math.random() * 3, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 1, col: FLECK_COLS[Math.floor(Math.random() * FLECK_COLS.length)] }); // 小矩形屑（带旋转与寿命）
  } // 结束生成
  if (!fleckRaf) { fleckRaf = requestAnimationFrame(fleckStep); } // 空闲才启动循环
} // 结束 sprayFlecks
function fleckStep() { // 粒子单帧：重力下落 + 落底微弹 + 透明消散
  fctx.clearRect(0, 0, fleckCv.width, fleckCv.height); // 清屏
  for (let i = flecks.length - 1; i >= 0; i--) { // 倒序遍历便于即时回收
    const p = flecks[i]; // 当前粒子
    p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.011; // 物理积分
    if (p.y > innerHeight - 8 && p.vy > 0) { p.vy *= -0.35; p.vx *= 0.6; } // 触底一次衰减弹跳
    if (p.life <= 0 || p.y > innerHeight + 24) { flecks.splice(i, 1); continue; } // 出界或寿命尽：回收
    fctx.save(); // 保存画布态
    fctx.translate(p.x, p.y); fctx.rotate(p.rot); // 位姿
    fctx.globalAlpha = Math.max(0, p.life); // 淡出
    fctx.fillStyle = p.col; fctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6); // 绘制小矩形屑
    fctx.restore(); // 恢复画布态
  } // 结束遍历
  if (flecks.length) { fleckRaf = requestAnimationFrame(fleckStep); } else { fleckRaf = 0; fctx.clearRect(0, 0, fleckCv.width, fleckCv.height); } // 池空停循环并清残影
} // 结束 fleckStep

// ================= 借钱 / 重置 =================
$("btnBorrow").addEventListener("click", function () { // 借钱
  if (debt + BORROW_STEP > MAX_DEBT) { toast("借款已达上限 " + MAX_DEBT + " 元"); return; } // 上限
  debt += BORROW_STEP; balance += BORROW_STEP; // 到账
  save(); renderBalance("gain"); floatDelta(BORROW_STEP, "gain"); // 上滑
  toast("借到 " + BORROW_STEP + " 元，记得刮票还债～"); // 提示
}); // 结束借钱
$("btnSynth").addEventListener("click", function () { // 碎片合成：100 片换一张免费福卡
  if (shards < 100) { toast("碎片还不够 100 片，继续刮～"); return; } // 片数校验
  if (savedBatch && !confirm("上一批还有未完成的票，合成新票将作废旧票（已付款不退），继续吗？")) { return; } // 覆盖确认与购买一致
  if (!confirm("用 100 片碎片合成一张免费福卡？")) { return; } // 二次确认
  shards -= 100; // 扣碎片
  save(); // 存档
  refreshShards(); // 刷新碎片行
  setTier(0); // 合成的是免费福卡（价位滑块同步归位）
  remainBuy = 1; batchSeq = 1; batchCount = 1; qty = 1; // 单张单批（不扣款不扣库存）
  batch = []; drawnCount = 0; zTop = 100; // 重置本批
  renderQty(); // 数量面板同步为 1
  buildStack(); // 洗出 1 张免费福卡（正常进奖池抽样）
  showView("Wheel"); // 切到抽卡页
  toast("🧩 合成成功！免费福卡已上桌，抽出开刮～"); // 提示
}); // 结束碎片合成
$("btnReset").addEventListener("click", function () { // 重置
  if (!confirm("确定重置账本吗？余额回 20 元、欠款清零，徽章保留。")) return; // 确认
  balance = 20; debt = 0; // 复位
  batch = []; drawnCount = 0; // 清批
  clearBatch(); // 清除未完成批次存档
  save(); renderBalance(); // 存档
  showView("Shop"); // 回商店
  toast("账本已重置，徽章与荣誉保留 ✨"); // 提示
}); // 结束重置

// ================= 管理员系统 =================
// 6.0：顶栏管理员入口已移除，验证弹窗改由设置页「进入高级设置」按钮唤起（绑定见新增模块）
$("pwdCancel").addEventListener("click", function () { $("pwdMask").classList.remove("show"); }); // 取消验证
$("pwdOk").addEventListener("click", tryAdmin); // 确认进入
$("pwdInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { tryAdmin(); } }); // 支持回车提交
function tryAdmin() { // 尝试进入管理员系统
  if ($("pwdInput").value === ADMIN_PWD) { // 密码正确
    $("pwdMask").classList.remove("show"); // 关闭遮罩
    openAdmin(); // 打开管理面板
  } else { toast("密码错误，无法进入管理员系统"); } // 密码错误提示
} // 结束 tryAdmin
$("btnAdminBack").addEventListener("click", function () { showView("Settings"); }); // 返回设置（6.0：入口迁至设置页）
$("admBalSet").addEventListener("click", function () { // 设置本地余额
  const v = parseFloat($("admBal").value); // 读取输入
  if (isNaN(v) || v < 0) { toast("请输入合法金额"); return; } // 校验
  balance = v; save(); renderBalance(); // 生效
  toast("余额已设为 ¥" + v.toFixed(2)); // 提示
}); // 结束设置余额
$("admDebtSet").addEventListener("click", function () { // 设置最多借钱数
  const v = parseInt($("admDebt").value, 10); // 读取输入
  if (isNaN(v) || v < 0) { toast("请输入合法金额"); return; } // 校验
  MAX_DEBT = v; adminCfg.maxDebt = v; saveAdminCfg(); // 生效并持久化
  $("maxDebtNum").textContent = v; // 顶栏提示同步
  renderBalance(); // 刷新借钱按钮可用性
  toast("借款上限已设为 ¥" + v); // 提示
}); // 结束设置上限
$("admJackSet").addEventListener("click", function () { // 管理员：设置头奖池滚存金额
  const v = parseFloat($("admJack").value); // 读取输入
  if (isNaN(v) || v < 0) { toast("请输入合法金额"); return; } // 校验
  jackpot = Math.round(v * 100) / 100; // 生效
  save(); // 存档
  refreshJack(); // 顶栏滚存牌滚动到新值
  $("admJackNum").textContent = jackpot.toFixed(2); // 管理员面板同步
  toast("🎁 头奖池已设为 ¥" + jackpot.toFixed(2)); // 提示
}); // 结束设置滚存
$("admStockAdd0").addEventListener("click", function () { // 管理员：福利彩票补仓
  const v = parseInt($("admAdd0").value, 10); // 读取补仓张数
  if (isNaN(v) || v < 1) { toast("请输入大于 0 的整数张数"); return; } // 校验
  const s = loadStock(); // 读两家库存
  s["0"] += v; // 福利入库
  saveStock(s); // 持久化
  refreshAdminStock(); // 刷新管理员面板显示
  refreshStock(); // 同步商店页显示（若当前在福利家）
  toast("📦 中国福利彩票已补仓 " + v.toLocaleString("zh-CN") + " 张，现有 " + s["0"].toLocaleString("zh-CN") + " 张"); // 提示
}); // 结束福利补仓
$("admStockAdd1").addEventListener("click", function () { // 管理员：体育彩票补仓
  const v = parseInt($("admAdd1").value, 10); // 读取补仓张数
  if (isNaN(v) || v < 1) { toast("请输入大于 0 的整数张数"); return; } // 校验
  const s = loadStock(); // 读两家库存
  s["1"] += v; // 体育入库
  saveStock(s); // 持久化
  refreshAdminStock(); // 刷新管理员面板显示
  refreshStock(); // 同步商店页显示（若当前在体育家）
  toast("📦 中国体育彩票已补仓 " + v.toLocaleString("zh-CN") + " 张，现有 " + s["1"].toLocaleString("zh-CN") + " 张"); // 提示
}); // 结束体育补仓
let admMerSel = 0, admTierSel = 0; // 当前编辑的商家/卡类型下标
function initAdminSelectors() { // 填充两个下拉并绑定切换
  const ms = $("admMer"), ts = $("admTier"); // 下拉引用
  ms.innerHTML = ""; ts.innerHTML = ""; // 清空
  MERCHANTS.forEach(function (m, i) { const o = document.createElement("option"); o.value = i; o.textContent = m.name; ms.appendChild(o); }); // 商家选项
  TIERS.forEach(function (t, i) { const o = document.createElement("option"); o.value = i; o.textContent = t.name + "（¥" + t.price + "/张）"; ts.appendChild(o); }); // 卡类型选项
  ms.value = admMerSel; ts.value = admTierSel; // 恢复上次选择
  ms.onchange = function () { admMerSel = +ms.value; renderPoolEditor(); }; // 切商家重渲表
  ts.onchange = function () { admTierSel = +ts.value; renderPoolEditor(); }; // 切卡重渲表
} // 结束 initAdminSelectors
function renderPoolEditor() { // 渲染当前组奖池编辑表
  const pool = getPool(admMerSel, admTierSel); // 当前组奖池
  const total = pool.reduce(function (s, p) { return s + (+p.w || 0); }, 0); // 占比总和（理想值 100 = 每刮 100 张）
  const tb = $("admPool"); // 表格容器
  tb.innerHTML = "<tr><th>金额（¥）</th><th>占 100 张（%）</th><th>实际中奖率</th><th></th></tr>"; // 表头
  pool.forEach(function (p, i) { // 逐档渲染
    const tr = document.createElement("tr"); // 行
    const pct = total > 0 ? ((+p.w || 0) / total * 100).toFixed(1) + "%" : "—"; // 归一化实际中奖率
    tr.innerHTML = '<td><input type="number" step="0.01" min="0" value="' + p.amt + '" data-k="amt" data-i="' + i + '"></td>' + // 金额编辑
      '<td><input type="number" step="0.1" min="0" value="' + p.w + '" data-k="w" data-i="' + i + '"></td>' + // 占 100 张百分比编辑
      '<td class="pct">' + pct + '</td>' + // 实际率展示
      '<td><button class="delRow" data-del="' + i + '">✕</button></td>'; // 删除档位
    tb.appendChild(tr); // 上表
  }); // 结束遍历
  tb.querySelectorAll("input").forEach(function (inp) { // 绑定输入框
    inp.addEventListener("change", function () { // 改动即时生效
      const v = parseFloat(inp.value); // 新值
      if (isNaN(v) || v < 0) { renderPoolEditor(); return; } // 非法输入回滚
      pool[+inp.dataset.i][inp.dataset.k] = v; // 写入配置
      saveAdminCfg(); // 持久化
      renderPoolEditor(); // 重渲染刷新百分比列
    }); // 结束绑定
  }); // 结束遍历
  tb.querySelectorAll(".delRow").forEach(function (btn) { // 绑定删除按钮
    btn.addEventListener("click", function () { pool.splice(+btn.dataset.del, 1); saveAdminCfg(); renderPoolEditor(); }); // 删档存刷
  }); // 结束绑定
} // 结束 renderPoolEditor
$("admAddRow").addEventListener("click", function () { // 添加金额档
  getPool(admMerSel, admTierSel).push({ amt: 0, w: 5 }); // 新档默认金额 0、占 100 张 5%
  saveAdminCfg(); renderPoolEditor(); // 存与刷
}); // 结束添加
$("admResetOne").addEventListener("click", function () { // 恢复本组默认
  if (!confirm("恢复「" + MERCHANTS[admMerSel].name + " · " + TIERS[admTierSel].name + "」的默认奖池？")) return; // 确认
  adminCfg.pools[admMerSel][admTierSel] = defaultPool(admMerSel, admTierSel); // 还原本组
  saveAdminCfg(); renderPoolEditor(); // 存与刷
  toast("已恢复本组默认奖池"); // 提示
}); // 结束恢复本组
$("admResetAll").addEventListener("click", function () { // 恢复全部默认
  if (!confirm("确定恢复全部 9 组奖池为默认配置？")) return; // 确认
  for (let m = 0; m < 3; m++) { for (let t = 0; t < 3; t++) { adminCfg.pools[m][t] = defaultPool(m, t); } } // 全部还原
  saveAdminCfg(); renderPoolEditor(); // 存与刷
  toast("已恢复全部默认奖池"); // 提示
}); // 结束恢复全部
$("btnResume").addEventListener("click", function () { restoreBatch(); }); // 商店：继续上批
$("btnAbandon").addEventListener("click", function () { // 商店：作废上批
  if (!confirm("确定作废这批票吗？已付款不退，票也无法找回。")) return; // 确认
  clearBatch(); // 清存档
  toast("已作废上批票"); // 提示
}); // 结束作废
function openAdmin() { // 打开管理面板
  $("admBal").value = balance.toFixed(2); // 填当前余额
  $("admDebt").value = MAX_DEBT; // 填当前借款上限
  $("admJackNum").textContent = jackpot.toFixed(2); // 填当前头奖池滚存
  refreshAdminStock(); // 填两家最新库存
  initAdminSelectors(); // 初始化下拉
  renderPoolEditor(); // 渲染奖池编辑表
  openAdminExt(); // 同步老虎机/扭蛋/娃娃/桌宠/跳过五张配置卡（6.0 新增）
  showView("Admin"); // 切到管理员视图
} // 结束 openAdmin

// ================= 徽章殿堂 =================
function levelOf(i) { return Math.min(9, Math.floor(i / 5)); } // 等级
function fmtTH(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); } // 门槛格式
function checkBadges() { // 检查点亮
  let lit = 0; // 新亮数
  for (let i = 0; i < 50; i++) { // 遍历
    if (!badges[i] && totalWin >= THRESHOLDS[i]) { badges[i] = Date.now(); lit++; toast("🎉 点亮徽章：Lv" + (levelOf(i) + 1) + " " + LEVEL_NAMES[levelOf(i)] + " · 门槛 ¥" + fmtTH(THRESHOLDS[i])); } // 点亮
  } // 结束遍历
  if (lit) { save(); } // 存档
  renderHall(); // 刷新
} // 结束 checkBadges
function renderHall() { // 渲染殿堂
  $("hallStats").textContent = "已点亮 " + Object.keys(badges).length + " / 50 · 累计刮出 ¥" + totalWin.toFixed(2); // 统计
  const grid = $("bgrid"); grid.innerHTML = ""; // 清空
  for (let i = 0; i < 50; i++) { // 逐枚
    const lv = levelOf(i); // 等级
    const on = !!badges[i]; // 点亮否
    const d = document.createElement("div"); // 卡
    d.className = "badge" + (on ? " on" : "") + (lv === 9 ? " rainbow" : ""); // 状态
    const ts = on ? new Date(badges[i]) : null; // 时间
    d.title = on ? ("点亮于 " + ts.toLocaleString("zh-CN")) : ("累计刮出 ¥" + fmtTH(THRESHOLDS[i]) + " 点亮"); // 悬停
    d.innerHTML = '<div class="core" style="' + (on && lv < 9 ? "background:" + LEVEL_COLORS[lv] : "") + '">¥' + fmtTH(THRESHOLDS[i]) + "</div>" + // 核心
      "<p>Lv" + (lv + 1) + " " + LEVEL_NAMES[lv] + "</p>" + // 等级
      (on ? "<time>" + (ts.getMonth() + 1) + "-" + String(ts.getDate()).padStart(2, "0") + " " + String(ts.getHours()).padStart(2, "0") + ":" + String(ts.getMinutes()).padStart(2, "0") + "</time>" : "<time>未点亮</time>"); // 时间
    grid.appendChild(d); // 上板
  } // 结束遍历
} // 结束 renderHall

// ================= 全局锁定 / 解锁 =================
$("btnLock").addEventListener("click", function () { // 顶栏锁定按钮：点击锁定全局，再点同一按钮解锁
  const locked = document.body.classList.toggle("locked"); // 切换 body 锁定态（CSS 据此禁点内容区/底部导航/顶栏其余控件）
  $("lockOverlay").classList.toggle("show", locked); // 同步全屏磨砂遮罩显隐
  this.textContent = locked ? "🔒" : "🔓"; // 锁图标随状态切换
  this.title = locked ? "已锁定 · 再点一次解锁" : "锁定全局（再点一次解锁）"; // 悬停提示语
  if (locked) { toast("🔒 已锁定，点击右上角按钮解锁"); } else { toast("🔓 已解锁"); } // 操作反馈
}); // 结束锁定按钮

// ================= 金币与大奖动画开关 =================
let fxOn = localStorage.getItem("scratch-fx") !== "0"; // 动画总开关（默认开；存 "0" 为关）
$("fxToggle").checked = fxOn; // 恢复上次选择
$("fxToggle").addEventListener("change", function () { // 拨动开关
  fxOn = this.checked; // 更新状态
  localStorage.setItem("scratch-fx", fxOn ? "1" : "0"); // 持久化
  toast(fxOn ? "✨ 金币与大奖动画已开启" : "🔇 金币与大奖动画已关闭"); // 反馈
}); // 结束动画开关

// ================= 主题色切换（gold / green / red，持久化） =================
(function initTheme() { // 启动即恢复上次主题
  const th = localStorage.getItem("scratch-theme") || "gold"; // 默认金（当前配色）
  document.documentElement.dataset.theme = th; // 写到根元素驱动 CSS 覆盖（gold 不匹配任何覆盖规则即原配色）
  const radio = document.querySelector('#themeGroup input[value="' + th + '"]'); // 找对应单选
  if (radio) { radio.checked = true; } // 回显选中
})(); // 结束初始化
document.querySelectorAll('#themeGroup input[name="theme"]').forEach(function (r) { // 绑定主题单选
  r.addEventListener("change", function () { // 切换主题
    if (!this.checked) { return; } // 只响应选中
    document.documentElement.dataset.theme = this.value; // 应用主题
    localStorage.setItem("scratch-theme", this.value); // 持久化
    toast("🎨 主题色已切换为 " + (this.value === "gold" ? "Gold 金" : this.value === "green" ? "Green 绿" : "西瓜红 Red")); // 反馈
  }); // 结束监听
}); // 结束绑定

// ================= 液态玻璃 Beta（桌面壁纸跟随 + 全模块磨砂悬浮） =================
const LIQUID_KEY = "scratch-liquid-glass"; // 开关状态的持久化键
const WP_DB = "scratch-wallpaper"; // 壁纸来源的 IndexedDB 库名
let liquidOn = localStorage.getItem(LIQUID_KEY) === "1"; // 当前是否开启（默认关）
let wpUrl = ""; // 当前壁纸的 objectURL（用于切换时释放内存）
let wpStamp = 0; // 上次壁纸文件的修改时间，用于判断是否换图
let wpHandle = null; // File System Access 文件句柄（可反复读取，实现自动跟随）
let wpTimer = null; // 壁纸轮询计时器
let nativeBridge = null; // 检测到的桌面外壳桥接对象（Electron / pywebview）
let nativeTransparent = false; // 外壳是否为真透明窗口（是则不再画壁纸，直接透桌面）

/* ---------- IndexedDB 极简读写：保存壁纸句柄或图片文件 ---------- */
function idbOpen() { // 打开（必要时创建）数据库
  return new Promise(function (resolve, reject) { // 返回 Promise 便于 async/await
    const req = indexedDB.open(WP_DB, 1); // 打开版本 1
    req.onupgradeneeded = function () { req.result.createObjectStore("kv"); }; // 首次建键值表
    req.onsuccess = function () { resolve(req.result); }; // 成功回调
    req.onerror = function () { reject(req.error); }; // 失败回调
  }); // 结束 Promise
} // 结束 idbOpen
function idbSet(key, val) { // 写入一条记录（val 可以为 File / FileSystemFileHandle 等结构化克隆对象）
  return idbOpen().then(function (db) { // 先拿到库
    return new Promise(function (resolve, reject) { // 事务 Promise
      const tx = db.transaction("kv", "readwrite"); // 读写事务
      tx.objectStore("kv").put(val, key); // 存值
      tx.oncomplete = function () { resolve(); }; // 提交完成
      tx.onerror = function () { reject(tx.error); }; // 提交失败
    }); // 结束内部 Promise
  }); // 结束链式调用
} // 结束 idbSet
function idbGet(key) { // 读取一条记录
  return idbOpen().then(function (db) { // 先拿到库
    return new Promise(function (resolve) { // 查询 Promise
      const tx = db.transaction("kv", "readonly"); // 只读事务
      const r = tx.objectStore("kv").get(key); // 发起取值
      r.onsuccess = function () { resolve(r.result || null); }; // 成功（无值返回 null）
      r.onerror = function () { resolve(null); }; // 失败按空处理，不打断流程
    }); // 结束内部 Promise
  }); // 结束链式调用
} // 结束 idbGet

/* ---------- 壁纸渲染与状态提示 ---------- */
function setLiquidStatus(text, level) { // 更新设置卡里的状态文案
  const el = $("liquidStatus"); // 状态元素
  if (!el) { return; } // 防御：元素不存在直接返回
  el.textContent = text; // 写入文案
  el.className = level || ""; // 附带颜色级别（ok / warn）
} // 结束 setLiquidStatus
function applyWallpaper(src) { // 把图片（Blob 或 dataURL 字符串）画到背景层
  const layer = $("wpLayer"); // 背景层元素
  if (!layer) { return; } // 防御
  if (wpUrl && wpUrl.indexOf("blob:") === 0) { URL.revokeObjectURL(wpUrl); } // 释放上一张壁纸占用的内存
  wpUrl = (typeof src === "string") ? src : URL.createObjectURL(src); // 字符串直接用，Blob 转成本地 URL
  layer.style.backgroundImage = 'url("' + wpUrl + '")'; // 注入背景图
  layer.classList.toggle("on", liquidOn && !nativeTransparent); // 仅在液态模式且非真透明外壳时显示
} // 结束 applyWallpaper

/* ---------- 桌面外壳桥接检测（打包后自动生效，浏览器下为空） ---------- */
function detectBridge() { // 依次探测常见桌面外壳暴露的接口
  if (window.electronAPI && typeof window.electronAPI.getWallpaper === "function") { return { type: "electron", api: window.electronAPI }; } // Electron（preload 暴露）
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_wallpaper === "function") { return { type: "pywebview", api: window.pywebview.api }; } // Python pywebview
  return null; // 纯浏览器环境
} // 结束 detectBridge
async function readBridgeWallpaper(force) { // 向外壳要当前桌面壁纸
  if (!nativeBridge) { nativeBridge = detectBridge(); } // 每次取图前重新探测：pywebview 等外壳的接口注入晚于页面脚本，启动瞬间可能还没就绪
  if (!nativeBridge) { return false; } // 仍无桥接直接返回
  try { // 桥接调用可能抛错，全部兜住
    let res = null; // 原始返回
    if (nativeBridge.type === "electron") { res = await nativeBridge.api.getWallpaper(); } // 调 Electron（外壳自行决定是否带缓存）
    else if (nativeBridge.type === "pywebview") { res = await nativeBridge.api.get_wallpaper(force ? "" : String(wpStamp || "")); } // 调 pywebview：带上已知指纹，壁纸没变时外壳只回指纹不回图片（省流量）
    if (!res) { return false; } // 空返回视为失败
    const src = (typeof res === "string") ? res : (res.dataUrl || res.dataURL || res.path || ""); // 兼容字符串 / 对象两种约定
    const stamp = (typeof res === "object") ? (res.stamp || res.lastModified || 0) : 0; // 取出时间戳
    if (!src) { return !!(stamp && stamp === wpStamp); } // 外壳只回指纹说明壁纸没变：视为成功（无需重绘），否则算失败
    if (!force && stamp && stamp === wpStamp) { return true; } // 壁纸没换，跳过重绘（省性能）
    wpStamp = stamp || Date.now(); // 记录本次时间戳
    applyWallpaper(src); // 上墙
    setLiquidStatus("🖥 已连接桌面壁纸 · 持续跟随中", "ok"); // 状态提示
    return true; // 成功
  } catch (e) { return false; } // 出错按失败处理
} // 结束 readBridgeWallpaper

/* ---------- 浏览器模式：文件句柄 + 定时重读，实现“换壁纸自动跟上” ---------- */
async function refreshFromHandle(force) { // 重新读取句柄指向的图片
  if (!wpHandle) { return false; } // 没有句柄
  try { // 读取可能因权限失效而失败
    if (wpHandle.queryPermission) { // 支持权限查询的浏览器
      let p = await wpHandle.queryPermission({ mode: "read" }); // 查询读权限
      if (p !== "granted") { p = await wpHandle.requestPermission({ mode: "read" }); } // 需要用户手势时才可能通过
      if (p !== "granted") { setLiquidStatus("需要重新授权才能继续跟随壁纸 · 点「选择壁纸」再授权一次", "warn"); return false; } // 未授权则提示
    } // 结束权限判断
    const file = await wpHandle.getFile(); // 取出最新文件（壁纸被替换时这里会拿到新内容）
    if (!force && file.lastModified === wpStamp) { return true; } // 修改时间未变 → 无需重绘
    wpStamp = file.lastModified; // 记录时间戳
    applyWallpaper(file); // 上墙
    setLiquidStatus("🖼 已连接壁纸文件 · " + file.name + " · 持续监测中", "ok"); // 状态提示
    return true; // 成功
  } catch (e) { return false; } // 失败兜底
} // 结束 refreshFromHandle
async function pickWallpaper() { // 让用户指定壁纸图片（一次授权，之后自动跟随替换）
  if (window.showOpenFilePicker) { // 支持文件系统访问 API（Chromium 内核 / 打包后的 WebView）
    try { // 用户可能取消选择
      const arr = await window.showOpenFilePicker({ // 打开系统选择框
        multiple: false, // 只选一张
        types: [{ description: "图片", accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"] } }] // 限定图片类型
      }); // 结束选择框
      wpHandle = arr[0]; // 保存句柄（可反复读取）
      await idbSet("handle", wpHandle); // 持久化句柄，下次启动免再选
      await idbSet("file", null); // 清掉旧的 Blob 备份，避免来源混乱
      await refreshFromHandle(true); // 立刻读取并上墙
      return; // 结束
    } catch (e) { if (e && e.name === "AbortError") { return; } } // 用户取消就不做兜底
  } // 结束 API 分支
  const inp = document.createElement("input"); // 兜底：传统文件选择
  inp.type = "file"; // 文件类型
  inp.accept = "image/*"; // 只选图片
  inp.onchange = async function () { // 选中后处理
    const f = inp.files && inp.files[0]; // 取文件
    if (!f) { return; } // 没选就退出
    await idbSet("file", f); // 存 Blob 备份
    await idbSet("handle", null); // 清掉句柄来源
    wpHandle = null; // 内存同步
    wpStamp = f.lastModified; // 记录时间戳
    applyWallpaper(f); // 上墙
    setLiquidStatus("已应用本地图片 · 该方式不会自动跟随壁纸更换", "warn"); // 说明局限
  }; // 结束 onchange
  inp.click(); // 弹出选择框
} // 结束 pickWallpaper

/* ---------- 轮询：持续监测壁纸变化 ---------- */
async function refreshWallpaper(force) { // 一次完整的“取壁纸”尝试
  if (await readBridgeWallpaper(force)) { return true; } // 优先走外壳
  if (await refreshFromHandle(force)) { return true; } // 其次走文件句柄
  return false; // 都没有
} // 结束 refreshWallpaper
function startWatch() { // 开启轮询
  stopWatch(); // 先清掉旧计时器
  wpTimer = setInterval(function () { if (liquidOn) { refreshWallpaper(false); } }, 2000); // 每 2 秒检测一次
} // 结束 startWatch
function stopWatch() { // 停止轮询
  if (wpTimer) { clearInterval(wpTimer); wpTimer = null; } // 清计时器
} // 结束 stopWatch

/* ---------- 开关与初始化 ---------- */
function setLiquid(on, silent) { // 应用开关状态
  liquidOn = !!on; // 记录状态
  localStorage.setItem(LIQUID_KEY, liquidOn ? "1" : "0"); // 持久化
  document.documentElement.dataset.liquid = liquidOn ? "on" : "off"; // 驱动 CSS 磨砂体系
  const tg = $("liquidToggle"); // 开关元素
  if (tg) { tg.checked = liquidOn; } // 回显勾选
  const layer = $("wpLayer"); // 壁纸层
  if (layer) { layer.classList.toggle("on", liquidOn && !nativeTransparent); } // 真透明外壳下不显示壁纸层
  if (liquidOn) { startWatch(); refreshWallpaper(true); } else { stopWatch(); } // 开启则开始轮询并立即取图
  if (!silent) { toast(liquidOn ? "🌫 液态玻璃已开启 · 模块磨砂悬浮" : "已关闭液态玻璃，恢复原背景"); } // 反馈
} // 结束 setLiquid

/* ---------- 事件绑定 ---------- */
$("liquidToggle").addEventListener("change", function () { // 拨动开关
  if (this.checked) { // 开启
    const hasSource = !!wpHandle || !!nativeBridge; // 是否已有可用壁纸源
    setLiquid(true); // 立即开启（无源时用当前背景继续可读）
    if (!hasSource) { setLiquidStatus("还没有壁纸源 · 点「选择壁纸」授权一次即可自动跟随", "warn"); } // 提示补充授权
  } else { setLiquid(false); } // 关闭
}); // 结束开关监听
$("liquidPick").addEventListener("click", function () { pickWallpaper(); }); // 选壁纸
$("liquidRescan").addEventListener("click", async function () { // 手动重新检测
  if (!liquidOn) { setLiquid(true, true); } // 未开启则顺手开启
  const ok = await refreshWallpaper(true); // 强制重取
  if (!ok) { setLiquidStatus("仍无壁纸源 · 点「选择壁纸」授权一次", "warn"); toast("未检测到壁纸源，先选一张壁纸吧"); } // 失败提示
  else { toast("🖼 壁纸已更新"); } // 成功提示
}); // 结束手动检测
document.addEventListener("dragover", function (e) { if (liquidOn) { e.preventDefault(); } }); // 液态模式下允许拖入图片
document.addEventListener("drop", async function (e) { // 拖入图片直接当壁纸
  if (!liquidOn) { return; } // 未开启不处理
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; // 取第一个文件
  if (!f || f.type.indexOf("image/") !== 0) { return; } // 非图片忽略
  e.preventDefault(); // 阻止浏览器默认打开文件
  await idbSet("file", f); // 存备份
  await idbSet("handle", null); // 清句柄来源
  wpHandle = null; // 内存同步
  wpStamp = f.lastModified; // 记录时间戳
  applyWallpaper(f); // 上墙
  setLiquidStatus("已应用拖入的图片 · " + f.name, "ok"); // 状态提示
  toast("🖼 壁纸已更换"); // 反馈
}); // 结束拖放
(async function initLiquid() { // 启动恢复
  nativeBridge = detectBridge(); // 探测外壳
  if (nativeBridge) { // 有桥接
    try { // 外壳可能提供透明窗口标记
      const flag = (nativeBridge.type === "electron" && nativeBridge.api.isTransparent) ? await nativeBridge.api.isTransparent() : false; // 查询是否透明窗口
      nativeTransparent = !!flag; // 记录
    } catch (e) { nativeTransparent = false; } // 查询失败按非透明处理
    if (nativeTransparent) { document.documentElement.dataset.nativeTransparent = "on"; } // 真透明：隐藏所有背景层
  } // 结束桥接分支
  const h = await idbGet("handle"); // 取上次的句柄
  if (h) { wpHandle = h; } // 恢复句柄
  const f = await idbGet("file"); // 取上次的图片备份
  if (!wpHandle && f) { wpStamp = f.lastModified; applyWallpaper(f); } // 无句柄时用备份图直接上墙
  if (liquidOn) { setLiquid(true, true); } // 恢复开关
  const ok = await refreshWallpaper(false); // 首次取图
  if (ok) { return; } // 成功就不用再提示
  if (nativeTransparent) { setLiquidStatus("🖥 外壳为透明窗口 · 已直接透出真实桌面", "ok"); } // 真透明场景说明
  else { setLiquidStatus("未找到壁纸源 · 点「选择壁纸」授权一次即可自动跟随", "warn"); } // 浏览器场景说明
})(); // 结束启动

