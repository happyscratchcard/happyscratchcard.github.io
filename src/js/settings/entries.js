// ================= 6.0 新增：三大玩法入口与切出暂停挂钩 =================
// 6.1：商店页「更多玩法」选择面板已删除，三玩法入口纯靠左下角悬浮球（orbTab）；以下仅保留切出暂停挂钩
viewHooks.enter["Slot"] = function () { slotEnsure(); $("slotCostView").textContent = ((+SLOT_CFG.cost || 1) * slotBet).toFixed(2); $("slotBalView").textContent = balance.toFixed(2); if (slotScene) { slotScene.renderer.setAnimationLoop(slotScene.loop); } }; // 进入老虎机：建场景并恢复循环（单注按押注档位显示）
viewHooks.leave["Slot"] = function () { if (slotScene) { slotScene.renderer.setAnimationLoop(null); } }; // 离开：暂停渲染（规格 4）
viewHooks.enter["Gacha"] = function () { gachaEnsure(); $("gachaCostView").textContent = (+GACHA_CFG.cost || 2).toFixed(2); $("gachaBalView").textContent = balance.toFixed(2); if (gachaScene) { gachaScene.renderer.setAnimationLoop(gachaScene.loop); } }; // 进入扭蛋机
viewHooks.leave["Gacha"] = function () { if (gachaScene) { gachaScene.renderer.setAnimationLoop(null); } }; // 离开暂停
viewHooks.enter["Claw"] = function () { clawEnsure(); renderClawShelf(); $("clawCostView").textContent = (+CLAW_CFG.cost || 3).toFixed(2); $("clawBalView").textContent = balance.toFixed(2); if (clawScene) { clawScene.renderer.setAnimationLoop(clawScene.loop); } }; // 进入娃娃机
viewHooks.leave["Claw"] = function () { if (clawScene) { clawScene.renderer.setAnimationLoop(null); } }; // 离开暂停
viewHooks.enter["Pet"] = petInit; // 进入桌宠：初始化渲染
viewHooks.leave["Pet"] = function () { if (petEmoTimer) { clearInterval(petEmoTimer); petEmoTimer = null; } if (petEmoMode === "random") { petSetMode("random"); } }; // 离开桌宠：暂停随机器（进入时恢复）

// ================= 6.0 启动补充：桌宠/展示架/战绩 首刷 =================
renderClawShelf(); // 展示架（历史进页也能取到计数）
renderPlayHist(); // 新玩法战绩卡

// ================= 6.2 新增：娃娃机金爪时段引擎 =================
function clawGoldTick() { // 每帧调用：灯箱金光脉动 + 倒计时徽章刷新
  const s = clawScene; if (!s || !s.marquee) { return; } // 无 3D 场景直接跳过（徽章在下方单独兜底刷新）
  const on = Date.now() < clawGoldUntil; // 是否处于金爪时段
  if (on) { // 金光模式
    s.marquee.material.color.setHex(0xd4a017); // 灯箱转金
    s.marquee.material.emissive.setHex(0x8a6a10); // 自发光底色
    s.marquee.material.emissiveIntensity = 0.45 + 0.4 * Math.sin(s.t * 6); // 呼吸脉动
  } else { // 常规模式
    s.marquee.material.color.setHex(0xe74c3c); // 恢复红
    s.marquee.material.emissive.setHex(0x000000); // 关自发光
    s.marquee.material.emissiveIntensity = 0; // 归零
  } // 结束模式分支
  const chip = $("clawGoldChip"); // 倒计时徽章节点
  if (chip) { // 节点保护
    chip.classList.toggle("on", on); // 激活态切换（CSS 控制显隐）
    if (on) { $("clawGoldSec").textContent = Math.ceil((clawGoldUntil - Date.now()) / 1000); } // 秒数取上整
  } // 结束徽章刷新
} // 结束 clawGoldTick
function clawGoldAfterDrop() { // 每次下爪结算后调用：推进计数并可能开启金爪时段
  if (Date.now() < clawGoldUntil) { return; } // 时段进行中不推进计数
  clawGoldNext -= 1; // 递减
  if (clawGoldNext <= 0) { // 触发
    clawGoldUntil = Date.now() + 60000; // 开启 60 秒
    clawGoldNext = 9 + Math.floor(Math.random() * 7); // 下一轮 9~15 次后
    toast("🌟 金爪时段开启 60 秒：成功率翻倍！"); // 全局提示
    try { wx_vibrate(); } catch (e) {} // 震动反馈（浏览器环境空实现兜底）
  } // 结束触发
} // 结束 clawGoldAfterDrop
setInterval(function () { // 无 3D 场景时也刷新徽章倒计时（降级兜底）
  if (clawScene && clawScene.marquee) { return; } // 有场景交给每帧 tick
  const chip = $("clawGoldChip"); if (!chip) { return; } // 节点保护
  const on = Date.now() < clawGoldUntil; // 激活判定
  chip.classList.toggle("on", on); // 显隐
  if (on) { $("clawGoldSec").textContent = Math.ceil((clawGoldUntil - Date.now()) / 1000); } // 秒数
}, 500); // 500ms 步进足够

// ================= 6.2 新增：今日运势（悬浮球第五项 · 三数字滚动） =================
const FORTUNE_KEY = "scratch-fortune"; // 运势存档键
const FORTUNE_LEVELS = [ // 数字和 mod 5 → 运势等级与签语
  { name: "大吉", tip: "今天手气爆棚，适合多刮两张、摇一把金爪！", cls: "daji" }, // 0
  { name: "中吉", tip: "稳中有升，小额投入也会有惊喜回报。", cls: "" }, // 1
  { name: "小吉", tip: "细水长流，见好就收是今天的最优策略。", cls: "" }, // 2
  { name: "平", tip: "平平淡淡才是真，攒攒保底也不错。", cls: "" }, // 3
  { name: "末吉", tip: "稍缓一缓，明天运势回档再来！", cls: "" } // 4
]; // 结束等级表
function fortuneToday() { // 读取今日运势（日期不符返回 null）
  try { const f = JSON.parse(localStorage.getItem(FORTUNE_KEY)); // 解析存档
    if (f && f.date === new Date().toDateString()) { return f; } // 同一天命中
  } catch (e) {} // 损坏容错
  return null; // 无今日记录
} // 结束 fortuneToday
function fortuneRender(f) { // 渲染已确定的运势（无动画）
  const win = $("fortuneWin"); win.innerHTML = ""; // 清空数字窗
  f.digits.forEach(function (d) { // 三个数字格静态呈现
    const col = document.createElement("span"); col.className = "rollCol"; // 复用滚动窗格样式
    col.innerHTML = '<span class="rollStrip"><span class="rollItem">' + d + "</span></span>"; // 单行定格
    win.appendChild(col); // 入窗
  }); // 结束遍历
  const lv = FORTUNE_LEVELS[f.sum % 5]; // 取等级
  $("fortuneLevel").textContent = lv.name; // 等级大字
  $("fortuneLevel").className = lv.cls; // 大吉发光类
  const buff = f.sum % 5 === 0 ? "（🔥 Buff 生效中：全玩法收益 +10%）" : f.sum % 5 === 4 ? "（🛒 Buff 生效中：全场购买 9 折）" : ""; // 6.2 五轮：Buff 状态后缀
  $("fortuneTip").textContent = lv.tip + buff; // 签语 + Buff 提示
  // 6.2 取消次数限制：按钮不再收缴，随时可重抽
} // 结束 fortuneRender
function fortuneBuffGain() { // 6.2 五轮：大吉收益倍率（今日运势为大吉 → 1.10，否则 1）
  const f = fortuneToday(); // 今日记录
  return f && f.sum % 5 === 0 ? 1.10 : 1; // 大吉 ×1.1
} // 结束 fortuneBuffGain
function fortuneBuffPay() { // 6.2 五轮：末吉消费折扣（今日运势为末吉 → 0.90，否则 1）
  const f = fortuneToday(); // 今日记录
  return f && f.sum % 5 === 4 ? 0.90 : 1; // 末吉 9 折
} // 结束 fortuneBuffPay
(function wrapMoneyBuff() { // 6.2 五轮：运势 Buff 接线——包装全局收付款函数（基线函数声明为全局绑定，重赋值对所有调用方生效）
  const gain0 = gainMoney, pay0 = payMoney; // 保留原实现
  gainMoney = function (prize) { return gain0(Math.round(prize * fortuneBuffGain() * 100) / 100); }; // 大吉：入账 ×1.1（四舍五入到分）
  payMoney = function (cost) { return pay0(Math.round(cost * fortuneBuffPay() * 100) / 100); }; // 末吉：扣款 ×0.9（全场购买 9 折）
})(); // 结束 wrapMoneyBuff
function fortuneRollAnim(done) { // 三列滚动动画（复用老虎机逐列停的节奏感）
  const win = $("fortuneWin"); win.innerHTML = ""; // 清空
  const digits = [0, 1, 2].map(function () { return Math.floor(Math.random() * 10); }); // 抽三个数字
  const cols = []; // 列引用
  for (let c = 0; c < 3; c++) { // 建三列滚动条带
    const col = document.createElement("span"); col.className = "rollCol"; // 列容器
    const strip = document.createElement("span"); strip.className = "rollStrip"; // 条带
    const seq = []; // 条带数字序列：前两圈随机 + 末位定格目标
    for (let i = 0; i < 20; i++) { seq.push('<span class="rollItem">' + Math.floor(Math.random() * 10) + "</span>"); } // 两圈随机数
    seq.push('<span class="rollItem">' + digits[c] + "</span>"); // 末位定格
    strip.innerHTML = seq.join(""); strip.style.display = "block"; // 条带纵向
    col.appendChild(strip); win.appendChild(col); cols.push(strip); // 入窗
  } // 结束建列
  const STEP = 56; // 行高步长（与 CSS .rollItem 高一致）
  cols.forEach(function (strip, c) { // 逐列动画（右侧→左侧依次停的期待感）
    strip.animate([ // WAAPI：从 0 滚到末位
      { transform: "translateY(0)" }, // 起点
      { transform: "translateY(-" + 20 * STEP + "px)" } // 21 行的末位（20 × 步长）
    ], { duration: 1200 + c * 550, easing: "cubic-bezier(.15,.85,.28,1)", fill: "forwards" }); // 逐列加时
    setTimeout(function () { tickTone(520 + c * 160, 0.09, 0.08, "triangle", "amb"); }, 1200 + c * 550); // 6.2 三轮：每列停稳一声（音调逐列升高，与老虎机同体系）
  }); // 结束动画
  setTimeout(done, 1200 + 2 * 550 + 60); // 全部停稳后回调
  return digits; // 返回结果（调用方在 done 里用）
} // 结束 fortuneRollAnim
(function initFortune() { // 运势模块：绑定 + 弹窗逻辑
  const mask = $("fortuneMask"); if (!mask) { return; } // 节点保护
  function fortuneOpen() { // 打开弹窗
    mask.classList.add("show"); // 显示
    const f = fortuneToday(); // 上一次抽取记录（仅作展示，不再限制次数）
    if (f) { fortuneRender(f); } // 有记录：先定格上次结果（按钮仍可重抽）
    else { // 无记录：复位等待态
      $("fortuneWin").innerHTML = '<span class="rollCol"><span class="rollStrip"><span class="rollItem">?</span></span></span>'.repeat(3); // 三个问号格
      $("fortuneLevel").textContent = "—"; $("fortuneLevel").className = ""; // 等级复位
      $("fortuneTip").textContent = "点击下方按钮，滚动抽取今日运势"; // 提示复位
      $("fortuneGo").disabled = false; $("fortuneGo").innerHTML = "开抽今日运势"; // 按钮复位
    } // 结束分支
  } // 结束 fortuneOpen
  document.querySelectorAll('#orbTab .orbItem[data-act="fortune"]').forEach(function (it) { it.addEventListener("click", fortuneOpen); }); // 悬浮球入口绑定
  $("fortuneClose").addEventListener("click", function () { mask.classList.remove("show"); }); // 关闭按钮
  mask.addEventListener("click", function (e) { if (e.target === mask) { mask.classList.remove("show"); } }); // 点空白关闭
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { mask.classList.remove("show"); } }); // Esc 关闭
  $("fortuneGo").addEventListener("click", function () { // 抽取按钮（6.2：不限次数，每按一次重抽）
    if (this.disabled) { return; } // 滚动中防连点
    this.disabled = true; $("fortuneTip").textContent = "滚动中…"; // 锁按钮
    const digits = fortuneRollAnim(); // 起滚（返回结果数字）
    setTimeout(function () { // 停稳后结算
      const sum = digits[0] + digits[1] + digits[2]; // 数字和
      const rec = { date: new Date().toDateString(), digits: digits, sum: sum }; // 存档记录（覆盖为最近一次）
      localStorage.setItem(FORTUNE_KEY, JSON.stringify(rec)); // 持久化
      fortuneRender(rec); // 渲染结果
      $("fortuneGo").disabled = false; $("fortuneGo").innerHTML = "再抽一次"; // 6.2：解锁按钮，允许反复抽取
      toast("🔮 运势已生成：" + FORTUNE_LEVELS[sum % 5].name + "（再点可重抽）"); // 全局提示
    }, 1200 + 2 * 550 + 80); // 与动画总时长对齐
  }); // 结束抽取
})(); // 结束 initFortune

// ================= 6.2 新增：存档导出 / 导入 =================
(function initSaveIO() { // 存档管理模块
  const btnE = $("btnSaveExport"), btnI = $("btnSaveImport"), fileI = $("saveFileInput"); // 三节点
  if (!btnE || !btnI || !fileI) { return; } // 节点保护
  btnE.addEventListener("click", function () { // 导出：全部 localStorage 打包 JSON 下载
    const data = {}; // 收集容器
    for (let i = 0; i < localStorage.length; i++) { // 遍历全部键
      const k = localStorage.key(i); data[k] = localStorage.getItem(k); // 逐键收编
    } // 结束遍历
    const payload = { __meta: { app: "刮彩票模拟器", ver: "6.2", schemaVersion: SAVE_SCHEMA, time: new Date().toISOString(), keys: Object.keys(data).length }, data: data }; // 带元信息（6.2 五轮：schemaVersion 供导入端迁移）
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" }); // 序列化
    const a = document.createElement("a"); // 下载链
    a.href = URL.createObjectURL(blob); // 对象地址
    a.download = "刮彩票存档_" + new Date().toISOString().slice(0, 10) + ".json"; // 文件名带日期
    a.click(); // 触发下载
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); // 释放
    toast("💾 存档已导出（" + Object.keys(data).length + " 项）"); // 反馈
  }); // 结束导出
  btnI.addEventListener("click", function () { fileI.click(); }); // 导入：先唤起文件选择
  fileI.addEventListener("change", function () { // 选中文件后
    const f = fileI.files[0]; if (!f) { return; } // 无文件退出
    const rd = new FileReader(); // 读取器
    rd.onload = function () { // 读取完成
      try { // 解析容错
        const p = JSON.parse(rd.result); // 解析
        const data = migrateSave(p && p.data ? p.data : p, p && p.__meta && p.__meta.schemaVersion); // 兼容裸键值格式 + 6.2 五轮按来源版本迁移
        if (!confirm("导入将覆盖当前全部存档（余额/欠款/好感度/配置等），且不可恢复。确定继续吗？")) { return; } // 覆盖确认
        let n = 0; // 计数
        Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); n += 1; }); // 全量写回
        toast("✅ 已导入 " + n + " 项，即将刷新页面…"); // 反馈
        setTimeout(function () { location.reload(); }, 900); // 刷新生效
      } catch (e) { toast("❌ 存档文件损坏或格式不对"); } // 损坏提示
    }; // 结束读取
    rd.readAsText(f, "utf-8"); // UTF-8 读
    fileI.value = ""; // 复位（同文件可重复选）
  }); // 结束文件监听
})(); // 结束 initSaveIO

// ================= 6.2 新增：液态玻璃指针高光（interactive 反馈，rAF 节流） =================
(function initGlassGlow() { // 指针跟随高光：为最近的 .liquid-glass 写入 --mx/--my
  let pending = null; // 待处理事件（rAF 合帧）
  document.addEventListener("pointermove", function (e) { // 全局委托
    pending = e; // 只记最新
    if (initGlassGlow._raf) { return; } // 已有帧任务
    initGlassGlow._raf = requestAnimationFrame(function () { // 帧内统一处理
      initGlassGlow._raf = 0; // 清标记
      const el = pending && pending.target && pending.target.closest ? pending.target.closest(".liquid-glass") : null; // 最近玻璃容器
      if (!el) { return; } // 不在玻璃上跳过
      const r = el.getBoundingClientRect(); // 容器矩形
      el.style.setProperty("--mx", ((pending.clientX - r.left) / r.width * 100).toFixed(1) + "%"); // X 百分比
      el.style.setProperty("--my", ((pending.clientY - r.top) / r.height * 100).toFixed(1) + "%"); // Y 百分比
    }); // 结束帧任务
  }, { passive: true }); // 被动监听
})(); // 结束 initGlassGlow

// ================= 6.2 新增：付费选号（选号 +¥2，豹子号再 +¥2；本批第一张印号） =================
function pickNumActive() { // 选号开关是否有效开启（含号码合法性）
  const t = $("pickNumToggle"), inp = $("pickNumInput"); // 两节点
  return !!(t && t.checked && inp && /^\d{3}$/.test(inp.value)); // 勾选且为三位数字
} // 结束 pickNumActive
function pickNumIsBaozi(v) { // 豹子号判定：三位全同（111/888…）
  return v.length === 3 && v[0] === v[1] && v[1] === v[2]; // 全同即豹子
} // 结束 pickNumIsBaozi
function pickNumExtra() { // 选号加价（购买/爽刮扣款前调用）
  if (!pickNumActive()) { return 0; } // 未启用不 加价
  return pickNumIsBaozi($("pickNumInput").value) ? 4 : 2; // 豹子 +4，普通 +2
} // 结束 pickNumExtra
function applyPickNum() { // 批次生成后：把所选号码印在本批第一张票上（6.2 修正：抽卡阶段票在已洗牌的 stack 里，batch 要到抽满才赋值，原实现改 batch[0] 永远落空）
  if (!pickNumActive()) { return; } // 未启用跳过
  const v = parseInt($("pickNumInput").value, 10); // 所选号码（文本 → 整数）
  if (isNaN(v) || v < 0) { return; } // 非法号码不印（输入框旁提示已标红）
  const t0 = (stack && stack.length) ? stack[0] : (batch && batch.length ? batch[0] : null); // 抽卡阶段取洗牌后的顶票 stack[0]（= 第一张抽出）；跳过模式取 batch 首张
  if (!t0) { return; } // 无票可印跳过
  t0.no = v; // 覆盖票号（仅展示用，不影响奖额抽样与流水号 serial）
  if (stack && stack.length && $("topTicket")) { mountTop(); } // 抽卡页顶票可能已渲染（buildStack 内部已挂）：重挂刷新编号显示
  if (stack && stack.length) { saveBatch("wheel"); } // 抽卡阶段：同步批次存档（中途退出恢复后靓号不丢）
  toast("🎫 靓号已印：No." + padNo(v) + "（加价 ¥" + pickNumExtra() + "）"); // 反馈
} // 结束 applyPickNum
(function initPickNum() { // 选号控件绑定
  const t = $("pickNumToggle"), inp = $("pickNumInput"), hint = $("pickNumHint"); if (!t || !inp) { return; } // 节点保护
  t.addEventListener("change", function () { // 开关联动输入框
    inp.disabled = !t.checked; // 未勾选禁用输入
    if (!t.checked) { inp.value = ""; } // 取消时清号
    pickNumHintRefresh(); // 刷新提示
  }); // 结束开关
  inp.addEventListener("input", function () { // 输入过滤：仅数字，最多 3 位
    this.value = this.value.replace(/\D/g, "").slice(0, 3); // 清洗
    pickNumHintRefresh(); // 实时提示
  }); // 结束输入
  inp.addEventListener("change", function () { // 失焦校验：非法号码自动退回（避免少收钱）
    if (this.value && !/^\d{3}$/.test(this.value)) { this.value = ""; t.checked = false; inp.disabled = true; toast("选号需为三位数字，已取消选号"); } // 非法清空
    pickNumHintRefresh(); // 刷新
  }); // 结束校验
  function pickNumHintRefresh() { // 提示文案联动
    if (!t.checked) { hint.textContent = "本批第一张票印你所选号码"; return; } // 默认说明
    if (!/^\d{3}$/.test(inp.value)) { hint.textContent = "请输入三位数字（0-9）"; return; } // 输入中
    hint.textContent = pickNumIsBaozi(inp.value) ? "豹子号！加价 ¥4 已计入" : "普通靓号，加价 ¥2 已计入"; // 合法说明
  } // 结束提示刷新
})(); // 结束 initPickNum

// ================= 6.2 三轮：音效引擎（WebAudio 合成机械滴答，无音频文件；受动画开关 fxOn 总闸控制） =================
function sfxCtx() { // 懒建 AudioContext（首次用户交互后才能出声，浏览器策略）
  if (!sfxCtx._c) { try { sfxCtx._c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } // 单例
  if (sfxCtx._c.state === "suspended") { try { sfxCtx._c.resume(); } catch (e) {} } // 自动恢复挂起的上下文
  return sfxCtx._c; // 返回单例
} // 结束 sfxCtx
// ---- 6.2 九轮：音效总线（界面 / 中奖 / 环境三路 + 总音量 + M 键静音） ----
const AUD_KEY = "scratch-audio-bus"; // 音效配置存储键
const AUD_DEF = { ui: 0.8, win: 1, amb: 0.55, master: 1 }; // 三路默认增益（0~1）
let audioBus = (function () { // 读取持久化配置（坏数据回退默认）
  try { // 容错解析
    const d = JSON.parse(localStorage.getItem(AUD_KEY) || "{}"); // 原始对象
    return { ui: d.ui >= 0 ? +d.ui : AUD_DEF.ui, win: d.win >= 0 ? +d.win : AUD_DEF.win, amb: d.amb >= 0 ? +d.amb : AUD_DEF.amb, master: d.master >= 0 ? +d.master : AUD_DEF.master }; // 逐路校验
  } catch (e) { return { ui: AUD_DEF.ui, win: AUD_DEF.win, amb: AUD_DEF.amb, master: AUD_DEF.master }; } // 回退默认
})(); // 结束读取
let audioMutePrev = audioBus.master > 0 ? audioBus.master : 0.8; // 静音前的总音量（恢复用）
function audioSave() { try { localStorage.setItem(AUD_KEY, JSON.stringify(audioBus)); } catch (e) {} } // 持久化配置
function audioGain(bus) { // 某一路的最终增益（总线 × 总音量）
  const v = audioBus[bus] != null ? audioBus[bus] : 1; // 未定义按满增益
  return Math.max(0, Math.min(1, v)) * Math.max(0, Math.min(1, audioBus.master)); // 双重钳制
} // 结束 audioGain
function audioSet(bus, v) { // 设置某一路（0~1）
  audioBus[bus] = Math.max(0, Math.min(1, v)); // 钳制写入
  if (bus === "master" && audioBus.master > 0) { audioMutePrev = audioBus.master; } // 记录恢复值
  audioSave(); renderAudioUI(); // 持久化 + 刷新界面
  if (bus !== "master" || audioBus.master > 0) { tickTone(680, 0.05, 0.05, "square", "ui"); } // 调节试听（静音时不响）
} // 结束 audioSet
function audioToggleMute() { // 一键静音 / 恢复（M 键与按钮共用）
  if (audioBus.master > 0) { audioMutePrev = audioBus.master; audioBus.master = 0; toast("🔇 已静音 · 按 M 或再点一次恢复"); } // 静音
  else { audioBus.master = audioMutePrev || 0.8; toast("🔊 音效已恢复"); tickTone(880, 0.08, 0.06, "triangle", "ui"); } // 恢复
  audioSave(); renderAudioUI(); // 持久化 + 刷新
} // 结束 audioToggleMute
function renderAudioUI() { // 把总线数值刷到设置页控件
  [["volUi", "ui"], ["volWin", "win"], ["volAmb", "amb"]].forEach(function (pair) { // 三路滑杆
    const el = $(pair[0]), lab = $(pair[0] + "V"); // 控件与数值
    if (el) { el.value = String(Math.round(audioBus[pair[1]] * 100)); } // 滑杆位置
    if (lab) { lab.textContent = Math.round(audioBus[pair[1]] * 100) + "%"; } // 百分比
  }); // 结束三路
  const btn = $("btnMuteAll"), st = $("muteState"); // 静音按钮与状态
  if (btn) { btn.textContent = audioBus.master > 0 ? "🔇 全部静音（M）" : "🔊 恢复音效（M）"; } // 按钮文案
  if (st) { st.textContent = audioBus.master > 0 ? "总音量 " + Math.round(audioBus.master * 100) + "%" : "已静音"; st.classList.toggle("off", audioBus.master <= 0); } // 状态文字
} // 结束 renderAudioUI
(function initAudioUI() { // 自执行：绑定滑杆与 M 键
  ["volUi", "volWin", "volAmb"].forEach(function (id) { // 三路滑杆
    const el = $(id); if (!el) { return; } // 节点保护
    const key = id === "volUi" ? "ui" : id === "volWin" ? "win" : "amb"; // 对应总线
    el.addEventListener("input", function () { audioSet(key, (+el.value || 0) / 100); }); // 拖动实时生效
  }); // 结束绑定
  const btn = $("btnMuteAll"); if (btn) { btn.addEventListener("click", audioToggleMute); } // 静音按钮
  document.addEventListener("keydown", function (e) { // 全局键盘
    if (e.key !== "m" && e.key !== "M") { return; } // 只认 M
    const t = e.target; // 焦点元素
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) { return; } // 输入中不劫持
    if (e.ctrlKey || e.altKey || e.metaKey) { return; } // 修饰键组合放行
    audioToggleMute(); // 切换静音
  }); // 结束键盘绑定
  renderAudioUI(); // 首帧同步
})(); // 结束 initAudioUI
function tickTone(freq, dur, vol, type, bus) { // 单声短音：机械滴答/停轮音共用（fxOn 关闭时静默；bus 为总线：ui/win/amb）
  if (!fxOn) { return; } // 动画总开关关闭 → 连声音一起关（跳过动画不显示也不响）
  const gain = audioGain(bus || "ui"); // 6.2 九轮：取对应总线 × 总音量
  if (gain <= 0.002) { return; } // 静音或极低音量直接跳过（省 CPU）
  const c = sfxCtx(); if (!c) { return; } // 上下文不可用静默退出
  try { // 播放容错
    const o = c.createOscillator(), g = c.createGain(); // 振荡器 + 增益
    o.type = type || "square"; o.frequency.value = freq; // 波形与频率（square=机械滴答，triangle=停轮柔和音）
    const t0 = c.currentTime; // 起播时刻
    g.gain.setValueAtTime((vol || 0.06) * gain, t0); // 起始音量（乘总线增益）
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.06)); // 指数衰减（短促不拖尾）
    o.connect(g); g.connect(c.destination); // 链路
    o.start(t0); o.stop(t0 + (dur || 0.06) + 0.02); // 起播与停止
  } catch (e) {} // 任何音频异常静默
} // 结束 tickTone
function slotReelStopSound(r) { // 老虎机单轮停稳音：音调随列序升高（左→右 520/680/840Hz）
  if (!slotScene) { return; } // 无场景静默
  const i = slotScene.reels.indexOf(r); // 列序
  tickTone(520 + Math.max(0, i) * 160, 0.09, 0.09, "triangle", "amb"); // 逐列升调
} // 结束 slotReelStopSound

// ================= 6.2 三轮：中奖撒花（全屏彩纸喷发，独立于 bigWin 大字报；跳过动画时不显示） =================
function confettiBurst(per) { // 左右下角双喷口彩纸（与 bigWin 同视觉语言，但不弹大字报不震动）
  const colors = ["#d64541", "#e0862f", "#f6c775", "#3fae7a", "#3f7fd1", "#8b5fd1"]; // 常规色盘
  const n = Math.max(8, per || 40); // 每侧片数
  for (let side = 0; side < 2; side++) { // 左右两个喷口
    for (let i = 0; i < n; i++) { // 逐片彩纸
      const cf = document.createElement("div"); // 纸屑元素
      cf.className = "confetti"; // 样式挂钩
      cf.style.width = (6 + Math.random() * 6) + "px"; cf.style.height = (8 + Math.random() * 8) + "px"; // 随机尺寸
      cf.style.background = colors[Math.floor(Math.random() * colors.length)]; // 随机颜色
      cf.style.left = (side ? innerWidth - 6 : 6) + "px"; cf.style.top = innerHeight * 0.62 + "px"; // 左右下角起喷
      document.body.appendChild(cf); // 上屏
      const dir = side ? -1 : 1; // 喷射方向（左右互指）
      const dx = dir * (innerWidth * (0.3 + Math.random() * 0.45)); // 横向抛程
      const dy = -innerHeight * (0.5 + Math.random() * 0.35); // 纵向上抛高度
      cf.animate([ // 三段近似抛物线：起喷 → 顶点 → 落地淡出
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px," + dy + "px) rotate(" + dir * (300 + Math.random() * 400) + "deg)", opacity: 1, offset: 0.45 },
        { transform: "translate(" + dx + "px," + innerHeight * 0.55 + "px) rotate(" + dir * (600 + Math.random() * 500) + "deg)", opacity: 0 }
      ], { duration: 1900 + Math.random() * 900, easing: "cubic-bezier(.15,.6,.4,1)" }).onfinish = function () { cf.remove(); }; // 播完回收
    } // 结束逐片
  } // 结束左右喷口
} // 结束 confettiBurst

// ================= 6.2 三轮：滚存头奖音量条指示灯（电平表条数随池额递进，近满池红闪） =================
(function initJackMeter() { // 自执行：建 12 根电平条 + 轮询同步（跟 numAnim 滚动插值同频跳动）
  const m = $("jackMeter"); if (!m) { return; } // 节点保护
  for (let i = 0; i < 12; i++) { m.appendChild(document.createElement("i")); } // 建 12 根竖条
  const PK_KEY = "scratch-jack-peak"; // 6.2 五轮：历史峰值存档键
  let peak = parseFloat(localStorage.getItem(PK_KEY)) || 0; // 历史最高池额
  const line = document.createElement("b"); line.className = "peak"; m.appendChild(line); // 峰值细金线（横在电平条上方对应高度）
  let last = null; // 上次点亮数（去抖）
  const FULL = 888; // 满池基准（刮出 ≥888 全清带走，条满即临界）
  setInterval(function () { // 120ms 轮询：与数字滚动动画同频（入账时条随插值逐格爬升）
    const v = (typeof numAnim !== "undefined" && numAnim.jack != null) ? numAnim.jack : 0; // 当前显示值（滚动中的插值）
    const lit = Math.max(0, Math.min(12, Math.round(Math.min(v, FULL) / FULL * 12))); // 点亮条数
    if (lit !== last) { // 变化才刷（省 DOM）
      last = lit; // 记忆
      m.querySelectorAll("i").forEach(function (b, i) { b.classList.toggle("lit", i < lit); }); // 逐条点亮/熄灭
    } // 结束去抖
    if (v > peak + 0.01) { // 6.2 五轮：破历史峰值
      peak = v; // 更新峰值
      localStorage.setItem(PK_KEY, String(peak)); // 持久化
      line.style.bottom = (Math.min(peak, FULL) / FULL * 88 + 4) + "%"; // 金线位置随峰值上移（4%~92% 映射）
      m.classList.remove("newrec"); void m.offsetWidth; m.classList.add("newrec"); // 重触发破纪录金色闪光（一次）
    } // 结束破纪录
    m.classList.toggle("hot", v >= 666); // ≥666（清池临门档）：整体红闪
  }, 120); // 结束轮询
  line.style.bottom = (Math.min(peak, FULL) / FULL * 88 + 4) + "%"; // 启动时按历史峰值定位金线
})(); // 结束 initJackMeter

// ================= 6.2 三轮：周结算账单（每周一自动为上一周生成收支小票，存历史页可翻阅） =================
function loadWeekBills() { // 读取已生成账单
  try { const v = JSON.parse(localStorage.getItem("scratch-weekbills")); if (Array.isArray(v)) { return v; } } catch (e) {} // 容错
  return []; // 无存档返回空
} // 结束 loadWeekBills
function weekBillEnsure() { // 补齐缺失账单：检查上一自然周（周一~周日）是否已出账，未出则生成
  const now = new Date(); // 当前时刻
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)); // 本周一 0 点（周一为一周之首）
  const start = new Date(mon.getTime() - 7 * 864e5); // 上周一 0 点
  const end = mon.getTime(); // 上周日 24 点（= 本周一 0 点）
  const wk = start.toISOString().slice(0, 10); // 周键（周一起始日，全局唯一）
  const bills = loadWeekBills(); // 已有账单
  if (bills.some(function (b) { return b.wk === wk; })) { return; } // 已出账直接返回
  const scratch = loadHistory().filter(function (h) { return h.time >= start.getTime() && h.time < end; }); // 上周刮票批次
  const plays = loadPlayHist().filter(function (h) { return h.time >= start.getTime() && h.time < end; }); // 上周三玩法战绩
  if (!scratch.length && !plays.length) { return; } // 整周无任何活动：不出账（避免空票堆积）
  const spend = scratch.reduce(function (s, h) { return s + (+h.cost || 0); }, 0) + plays.reduce(function (s, h) { return s + (+h.cost || 0); }, 0); // 总投入（刮票 + 三玩法）
  const income = scratch.reduce(function (s, h) { return s + (+h.prize || 0); }, 0) + plays.reduce(function (s, h) { return s + (+h.prize || 0); }, 0); // 总回报
  const tickets = scratch.reduce(function (s, h) { return s + (+h.qty || 0); }, 0); // 刮票张数
  let best = null, worst = null; // 最欧一批 / 最非一批
  scratch.forEach(function (h) { // 逐批比较净利
    if (!best || (h.prize - h.cost) > (best.prize - best.cost)) { best = h; } // 最欧
    if (!worst || (h.prize - h.cost) < (worst.prize - worst.cost)) { worst = h; } // 最非
  }); // 结束遍历
  const fmt = function (d) { return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }; // 月日格式
  const bill = { // 账单对象
    wk: wk, // 周键
    label: fmt(start) + " ~ " + fmt(new Date(end - 864e5)), // 周区间文案
    spend: Math.round(spend * 100) / 100, // 总投入
    income: Math.round(income * 100) / 100, // 总回报
    tickets: tickets, // 刮票张数
    best: best ? (best.merchant + " " + best.tier + " 净赚 ¥" + Math.round((best.prize - best.cost) * 100) / 100) : "—", // 最欧一刻
    worst: worst ? (worst.merchant + " " + worst.tier + " 净亏 ¥" + Math.round((worst.cost - worst.prize) * 100) / 100) : (plays.length ? "刮票零投入" : "—") // 最非时刻
  }; // 结束账单
  bills.unshift(bill); // 最新在前
  if (bills.length > 26) { bills.length = 26; } // 上限半年
  localStorage.setItem("scratch-weekbills", JSON.stringify(bills)); // 持久化
} // 结束 weekBillEnsure
function renderWeekBills() { // 渲染周账单卡（进历史页时刷新）
  const card = $("weekBillCard"), list = $("weekBillList"); if (!card || !list) { return; } // 节点保护
  const bills = loadWeekBills(); // 读账单
  if (!bills.length) { card.style.display = "none"; return; } // 无账单隐藏
  list.innerHTML = bills.map(function (b) { // 逐张小票
    const net = Math.round((b.income - b.spend) * 100) / 100; // 周净盈亏
    const cls = net > 0 ? "pos" : net < 0 ? "neg" : "zero"; // 配色类
    return '<div class="wbRow"><div class="wbMain"><div class="wbWeek">🧾 ' + b.label + "</div>" +
      '<div class="wbSub">投入 ¥' + b.spend.toFixed(2) + " · 回报 ¥" + b.income.toFixed(2) + " · 刮票 " + b.tickets + " 张" +
      "<br>最欧：" + b.best + " · 最非：" + b.worst + "</div></div>" +
      '<div class="wbNet ' + cls + '">' + (net >= 0 ? "+" : "-") + "¥" + Math.abs(net).toFixed(2) + '</div>' +
      '<button class="wbExp" data-wk="' + b.wk + '" title="导出这张小票为 PNG">⬇ PNG</button></div>'; // 小票结构（6.2 五轮：附导出按钮）
  }).join(""); // 拼接
  list.querySelectorAll(".wbExp").forEach(function (btn) { // 逐按钮绑定导出
    btn.addEventListener("click", function () { // 点击导出
      const b = bills.filter(function (x) { return x.wk === btn.dataset.wk; })[0]; // 找回对应账单
      if (b) { drawBillPng(b); } // 绘制并下载
    }); // 结束绑定
  }); // 结束遍历
  card.style.display = "block"; // 显示卡片
} // 结束 renderWeekBills
function drawBillPng(b) { // 6.2 五轮：把单张周账单绘制成玻璃质感小票 PNG 并下载
  const W = 380, H = 470; // 画布尺寸
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; // 离屏画布
  const g = cv.getContext("2d"); // 绘图句柄
  g.fillStyle = "#fdfaf1"; g.fillRect(0, 0, W, H); // 米白票底
  g.fillStyle = "#f3e6c2"; // 锯齿色（与票底同色系三角齿）
  for (let x = 0; x < W; x += 16) { // 顶部锯齿
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 10); g.lineTo(x + 16, 0); g.fill(); // 上三角
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + 8, H - 10); g.lineTo(x + 16, H); g.fill(); // 下三角
  } // 结束锯齿
  g.strokeStyle = "rgba(122,90,16,.25)"; g.setLineDash([5, 4]); g.strokeRect(14, 24, W - 28, H - 48); g.setLineDash([]); // 虚线撕票内框
  g.textAlign = "center"; // 居中排版
  g.fillStyle = "#7a5a10"; g.font = "800 22px 'Microsoft YaHei', sans-serif"; // 标题字体
  const _wt = "周结算账单", _ww = g.measureText(_wt).width; // 标题文字与宽度（用于把图标摆到左侧居中）
  icoPaint(g, "receipt", W / 2 - _ww / 2 - 25, 49, 19, "#7a5a10"); g.fillText(_wt, W / 2 + 10, 66); // 线条小票图标 + 标题
  g.fillStyle = "#8a8474"; g.font = "13px 'Microsoft YaHei', sans-serif"; g.fillText(b.label, W / 2, 92); // 周区间
  g.strokeStyle = "rgba(122,90,16,.3)"; g.beginPath(); g.moveTo(40, 108); g.lineTo(W - 40, 108); g.stroke(); // 分隔线
  const rows = [ // 明细行
    ["总投入", "¥" + b.spend.toFixed(2)], // 投入
    ["总回报", "¥" + b.income.toFixed(2)], // 回报
    ["刮票张数", String(b.tickets) + " 张"] // 张数
  ]; // 结束明细
  g.textAlign = "left"; g.font = "15px 'Microsoft YaHei', sans-serif"; // 左对齐明细
  rows.forEach(function (r, i) { // 逐行绘制
    const y = 142 + i * 30; // 行高
    g.fillStyle = "#6b6353"; g.fillText(r[0], 40, y); // 左侧名
    g.textAlign = "right"; g.fillStyle = "#3a362e"; g.font = "700 15px 'Microsoft YaHei', sans-serif"; g.fillText(r[1], W - 40, y); g.textAlign = "left"; g.font = "15px 'Microsoft YaHei', sans-serif"; // 右侧值
  }); // 结束明细绘制
  const net = Math.round((b.income - b.spend) * 100) / 100; // 周净盈亏
  g.textAlign = "center"; // 居中
  g.fillStyle = net >= 0 ? "#1e9e5a" : "#c0392b"; // 盈亏配色
  g.font = "800 30px 'Microsoft YaHei', sans-serif"; g.fillText((net >= 0 ? "+" : "-") + "¥" + Math.abs(net).toFixed(2), W / 2, 252); // 净盈亏大字
  g.fillStyle = "#8a8474"; g.font = "12px 'Microsoft YaHei', sans-serif"; g.fillText("本周净盈亏", W / 2, 272); // 小注
  g.textAlign = "left"; g.font = "13px 'Microsoft YaHei', sans-serif"; g.fillStyle = "#6b6353"; // 欧非两行
  icoPaint(g, "clover", 40, 300, 15, "#3f9a53"); wrapText(g, "最欧：" + b.best, 60, 308, W - 100, 20); // 最欧（线条四叶草 + 自动换行）
  const _ny = b.best.length + b.worst.length > 30 ? 350 : 332; // 最非行纵坐标（按上行是否换行错位）
  icoPaint(g, "droplet", 40, _ny - 8, 15, "#5b8fb9"); wrapText(g, "最非：" + b.worst, 60, _ny, W - 100, 20); // 最非（线条水滴 + 自动换行）
  g.textAlign = "center"; g.fillStyle = "#b0a88f"; g.font = "11px 'Microsoft YaHei', sans-serif"; // 页脚
  g.fillText("刮彩票模拟器 6.2 · " + new Date().toLocaleString("zh-CN"), W / 2, H - 34); // 落款
  const a = document.createElement("a"); // 下载链
  a.href = cv.toDataURL("image/png"); // PNG 数据地址
  a.download = "周账单_" + b.wk + ".png"; // 文件名（周键即周一起始日）
  a.click(); // 触发下载
  toast("🧾 账单小票已导出 PNG"); // 反馈
} // 结束 drawBillPng
function wrapText(g, text, x, y, maxW, lh) { // Canvas 中文自动换行（账单导出辅助）
  let line = "", yy = y; // 行缓冲与纵坐标
  for (const ch of text) { // 逐字符
    if (g.measureText(line + ch).width > maxW) { g.fillText(line, x, yy); line = ch; yy += lh; } // 超宽换行
    else { line += ch; } // 续行
  } // 结束遍历
  if (line) { g.fillText(line, x, yy); } // 收尾行
} // 结束 wrapText
weekBillEnsure(); // 启动即补账（周日全天没打开，周一首开也补上）

// ================= 6.2 三轮：娃娃机挑战赛（¥20 入场 · 60 秒免费连抓 · 抓满 5 只返双倍） =================
const clawChal = { active: false, endAt: 0, caught: 0, target: 5, entry: 20, timer: null }; // 挑战赛状态（target=达标只数，entry=入场费）
function clawChalRender() { // 刷新挑战赛徽章与按钮
  const chip = $("clawChalChip"), btn = $("btnClawChal"); if (!chip || !btn) { return; } // 节点保护
  chip.classList.toggle("on", clawChal.active); // 徽章显隐
  btn.classList.toggle("on", clawChal.active); // 按钮进行中变红呼吸
  if (clawChal.active) { // 进行中：倒计时 + 进度
    $("clawChalSec").textContent = Math.max(0, Math.ceil((clawChal.endAt - Date.now()) / 1000)); // 剩余秒
    $("clawChalGot").textContent = clawChal.caught; // 已抓数
    btn.textContent = "⏹ 结束挑战"; // 按钮变提前结束
  } else { // 未进行
    btn.textContent = "🎯 挑战赛 ¥" + clawChal.entry; // 按钮复位
  } // 结束分支
} // 结束 clawChalRender
function clawChalFinish(early) { // 结束挑战并结算返券
  if (!clawChal.active) { return; } // 防重入
  clawChal.active = false; // 关闭
  if (clawChal.timer) { clearInterval(clawChal.timer); clawChal.timer = null; } // 停计时器
  const got = clawChal.caught; // 本场战果
  let payout = 0, msg = ""; // 返券与文案
  if (got >= clawChal.target) { payout = clawChal.entry * 2; msg = "🎉 挑战达标（" + got + " 只）！返双倍 ¥" + payout; } // 抓满 5 只：翻倍返券
  else if (got >= 3) { payout = clawChal.entry; msg = "🤝 抓到 " + got + " 只，退还入场费 ¥" + payout; } // 3~4 只：保本
  else { msg = early ? "💨 提前结束，抓到 " + got + " 只，入场费不退" : "💨 只抓到 " + got + " 只，入场费不退（3 只保本 / 5 只双倍）"; } // <3 只：不退
  if (payout > 0) { gainMoney(payout); pushPlayHist("claw", clawChal.entry, payout, "挑战赛 ×" + got); } // 战绩（返券才算收益）
  else { pushPlayHist("claw", clawChal.entry, 0, "挑战赛 ×" + got); } // 战绩（亏损）
  toast(msg); // 全局提示
  if (got >= clawChal.target && fxOn) { confettiBurst(56); } // 达标撒花庆祝（动画开关关闭时跳过）
  clawChalRender(); // 复位 UI
} // 结束 clawChalFinish
(function initClawChal() { // 挑战赛绑定
  const btn = $("btnClawChal"); if (!btn) { return; } // 节点保护
  btn.addEventListener("click", function () { // 点击：开赛 / 提前结束
    if (clawChal.active) { // 进行中 → 确认后提前结算
      if (confirm("提前结束挑战？按当前战果结算返券。")) { clawChalFinish(true); } // 确认结束
      return; // 出口
    } // 结束进行中分支
    if (balance < clawChal.entry) { toast("入场费 ¥" + clawChal.entry + " 不够，先回大厅刮两张～"); return; } // 余额校验
    if (!confirm("挑战赛：付 ¥" + clawChal.entry + " 入场，60 秒内免费连抓！\\n抓满 " + clawChal.target + " 只 → 返双倍 ¥" + (clawChal.entry * 2) + "；抓到 3~4 只 → 退入场费。\\n开赛？")) { return; } // 规则确认
    payMoney(clawChal.entry); // 扣入场费
    clawChal.active = true; clawChal.caught = 0; clawChal.endAt = Date.now() + 60000; // 初始化状态
    clawChalRender(); // 立即刷 UI
    clawChal.timer = setInterval(function () { // 250ms 轮询：倒计时刷新 + 到点结算
      if (!clawChal.active) { clearInterval(clawChal.timer); clawChal.timer = null; return; } // 已结束防御
      clawChalRender(); // 刷倒计时
      if (Date.now() >= clawChal.endAt) { clawChalFinish(false); } // 时间到：正常结算
    }, 250); // 结束轮询
    toast("🎯 挑战赛开始！60 秒免费连抓，目标 " + clawChal.target + " 只"); // 开赛提示
  }); // 结束绑定
  clawChalRender(); // 初始复位 UI
})(); // 结束 initClawChal

// ================= 6.2 三轮：悬浮球形态（闲置 90 秒休眠呼吸 / 好感满级金壳） =================
(function initOrbMood() { // 自执行：状态外化（不打扰交互，纯视觉层）
  const orb = $("orb"); if (!orb) { return; } // 节点保护
  let idleT = null; // 休眠定时器句柄
  function wake() { // 唤醒：清休眠态并重置计时
    orb.classList.remove("sleep"); // 脱离休眠
    if (idleT) { clearTimeout(idleT); } // 重置旧计时
    idleT = setTimeout(function () { orb.classList.add("sleep"); }, 90000); // 90 秒无操作 → 休眠呼吸
  } // 结束 wake
  ["pointermove", "pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, wake, { passive: true }); }); // 全局活动监听（任一交互即唤醒）
  wake(); // 启动计时
  function goldSync() { // 好感满级金壳同步（桌宠最高配饰门槛 = 满级）
    let cap = 100; // 兜底阈值
    try { cap = PET_CFG.accessories.reduce(function (m, a) { return Math.max(m, +a.minAffinity || 0); }, 0); } catch (e) {} // 动态取最高配饰门槛（皇冠 100）
    orb.classList.toggle("gold", (typeof petAffinity === "number") && petAffinity >= cap); // 达标挂金壳
  } // 结束 goldSync
  goldSync(); // 首次
  setInterval(goldSync, 4000); // 4 秒轮询（喂食涨好感后自动点亮）
})(); // 结束 initOrbMood

// ================= 6.2 五轮：存档 schemaVersion 与迁移（一批⑩：未来版本读旧档不失效） =================
const SAVE_SCHEMA = 3; // 当前存档结构版本（v1 初版 / v2 补周账单键 / v3 补运势键清洗）
function migrateSave(data, fromVer) { // 迁移旧版本存档数据体到当前结构（就地修改并返回）
  let v = +fromVer || 1; // 来源版本（缺省按最旧处理）
  if (v < 2) { // v1 → v2：确保周账单键存在且为数组
    try { if (!Array.isArray(JSON.parse(data["scratch-weekbills"]))) { data["scratch-weekbills"] = "[]"; } } catch (e) { data["scratch-weekbills"] = "[]"; } // 修复损坏账单
  } // 结束 v2
  if (v < 3) { // v2 → v3：运势/战绩等 JSON 键损坏则剔除（读取端已有容错，但清掉脏数据更稳）
    ["scratch-fortune", "scratch-playhist", "scratch-play-history"].forEach(function (k) { // 逐一校验
      if (k in data) { try { JSON.parse(data[k]); } catch (e) { delete data[k]; } } // 解析失败即删
    }); // 结束校验
  } // 结束 v3
  return data; // 迁移完成
} // 结束 migrateSave

// ================= 6.2 四轮：硬盘存档座（3D 方盒插拔模型：插入=载入为当前进度(绿灯)；弹出=进度收进硬盘(红灯驻留)；右键删除/导入/新建） =================
(function initHddBay() { // 自执行：渲染三块硬盘 + 插拔/右键交互
  const wrap = $("baySlots"), menu = $("bayMenu"), fileI = $("bayFileInput"); if (!wrap) { return; } // 节点保护
  function snapshot() { // 全量快照（与文件导出同一份数据）
    const data = {}; // 收集容器
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === "scratch-hdd-active" || k.indexOf("scratch-slot-") === 0) { continue; } data[k] = localStorage.getItem(k); } // 逐键收编（硬盘自身与激活标记不带入）
    return data; // 返回快照
  } // 结束 snapshot
  function bayPkg(data) { // 打包为带元信息的槽内档案（6.2 五轮：携带 schemaVersion 供迁移）
    return { __meta: { app: "刮彩票模拟器", ver: "6.2", schemaVersion: SAVE_SCHEMA, time: new Date().toISOString(), keys: Object.keys(data).length }, data: data }; // 元信息 + 数据体
  } // 结束 bayPkg
  function hddSnd(kind) { // 6.2 五轮：硬盘插拔音效（插入=双击咔哒+落座闷响；弹出=滑轨下滑音；受 fxOn 总闸）
    if (!fxOn) { return; } // 动画开关关闭 → 静音
    const c = sfxCtx(); if (!c) { return; } // 上下文不可用静默
    try { // 播放容错
      if (kind === "in") { // 插入：两声短咔哒 + 低频落座
        tickTone(1500, 0.025, 0.07, "square", "amb"); // 第一声咔
        setTimeout(function () { tickTone(1050, 0.03, 0.07, "square", "amb"); }, 70); // 第二声哒
        setTimeout(function () { tickTone(210, 0.07, 0.06, "sine", "amb"); }, 120); // 落座闷响
      } else { // 弹出：滑轨下滑音（频率下扫的锯齿波）
        const o = c.createOscillator(), g = c.createGain(); // 振荡器 + 增益
        o.type = "sawtooth"; // 锯齿波（机械摩擦感）
        const t0 = c.currentTime; // 起播
        o.frequency.setValueAtTime(360, t0); // 起始频率
        o.frequency.exponentialRampToValueAtTime(110, t0 + 0.20); // 200ms 下扫（滑出导轨）
        g.gain.setValueAtTime(0.045, t0); // 音量
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22); // 衰减
        o.connect(g); g.connect(c.destination); // 链路
        o.start(t0); o.stop(t0 + 0.24); // 起止
        setTimeout(function () { tickTone(880, 0.03, 0.06, "square", "amb"); }, 210); // 末端脱扣轻响
      } // 结束音色分支
    } catch (e) {} // 异常静默
  } // 结束 hddSnd
  function slotData(n) { // 读槽内档案（无效返回 null）
    try { const p = JSON.parse(localStorage.getItem("scratch-slot-" + n)); return p && p.data ? p : null; } catch (e) { return null; } // 解析容错
  } // 结束 slotData
  function activeNow() { // 当前插入的硬盘号（0 = 无插入）
    const v = parseInt(localStorage.getItem("scratch-hdd-active"), 10); // 读激活标记
    return v >= 1 && v <= 3 ? v : 0; // 合法性夹取
  } // 结束 activeNow
  function fmtMeta(d) { // 元信息文案（时间 · 项数）
    const t = new Date(d.__meta.time); // 时间对象
    return (t.getMonth() + 1) + "月" + t.getDate() + "日 " + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") + " · " + (d.__meta.keys || Object.keys(d.data || {}).length) + " 项"; // 拼
  } // 结束 fmtMeta
  function render() { // 渲染三块硬盘（姿态由激活标记驱动）
    const act = activeNow(); // 当前插入槽
    let html = ""; // 拼接缓冲
    for (let n = 1; n <= 3; n++) { // 默认三块硬盘
      const d = slotData(n); // 槽内档案
      const isIn = act === n; // 是否插入态（绿灯）
      const meta = d ? fmtMeta(d) : "空硬盘 · 右键导入或新建"; // 元信息文案
      let cap = ""; // 6.2 五轮：容量灯 HTML（8 格，按存档体量点亮，快满转琥珀）
      if (d) { // 有档才画容量表
        const keys = d.__meta.keys || Object.keys(d.data || {}).length; // 存档项数
        const lit = Math.max(1, Math.min(8, Math.ceil(keys / 6))); // 每 6 项点亮一格（1~8 格）
        const hot = keys >= 40 ? " hot" : ""; // ≥40 项：接近容量上限转琥珀提示
        cap = '<span class="hddCap' + hot + '" title="存档体量 ' + keys + ' 项">' + "<i class=\"on\"></i>".repeat(lit) + "<i></i>".repeat(8 - lit) + "</span>"; // 容量格（点亮 + 熄灭）
      } // 结束容量表
      html += '<div class="baySlot"><div class="hdd ' + (isIn ? "in" : "out") + '" data-slot="' + n + '">' +
        '<span class="hddLed" aria-hidden="true"></span><span class="hddTag">DISK ' + n + '</span>' + cap + '<span class="hddGrip" aria-hidden="true"></span><span class="hddMeta">' + meta + "</span></div></div>"; // 硬盘结构（LED/编号/容量灯/把手/信息）
    } // 结束三盘
    wrap.innerHTML = html; // 注入
    wrap.querySelectorAll(".hdd").forEach(function (h) { // 逐盘绑定
      h.addEventListener("click", function () { hddToggle(+h.dataset.slot); }); // 单击插拔
      h.addEventListener("contextmenu", function (e) { e.preventDefault(); openMenu(+h.dataset.slot, e.clientX, e.clientY); }); // 右键菜单
    }); // 结束绑定
  } // 结束 render
  function fxOnce(n, cls) { // 渲染后给指定硬盘补一次性物理动画类（drop=插入下落回弹 / pop=弹出弹跳）
    const el = wrap.querySelector('.hdd[data-slot="' + n + '"]'); // 目标硬盘
    if (!el) { return; } // 保护
    void el.offsetWidth; // 强制回流（保证动画重触发）
    el.classList.add(cls); // 挂动画类
    setTimeout(function () { el.classList.remove(cls); }, 420); // 播完摘除
  } // 结束 fxOnce
  function hddToggle(n) { // 单击硬盘：插入 ↔ 弹出
    const act = activeNow(); // 当前插入槽
    if (act === n) { // 已插入 → 弹出：先把当前进度收进这块硬盘（弹出的硬盘里装的就是当前存档，红灯驻留数据不丢）
      localStorage.setItem("scratch-slot-" + n, JSON.stringify(bayPkg(snapshot()))); // 进度落盘
      localStorage.removeItem("scratch-hdd-active"); // 取消激活
      hddSnd("out"); // 6.2 五轮：滑轨下滑音
      toast("⛔ 硬盘 " + n + " 已弹出（红灯）· 当前进度已收进这块硬盘"); // 反馈
      render(); // 重渲染姿态
      fxOnce(n, "pop"); // 弹出弹跳物理动画
      return; // 出口
    } // 结束弹出分支
    const p = slotData(n); // 目标槽档案
    if (p) { // 有档 → 装入（读取该存档覆盖当前进度）
      if (!confirm("装入硬盘 " + n + "？将读取其中存档覆盖当前全部进度（余额/欠款/好感度/配置等），且不可恢复。")) { return; } // 覆盖确认
      if (act) { localStorage.setItem("scratch-slot-" + act, JSON.stringify(bayPkg(snapshot()))); } // 当前插着别的盘：先把进度收回那块（防丢）
      const loaded = migrateSave(JSON.parse(JSON.stringify(p.data)), p.__meta && p.__meta.schemaVersion); // 6.2 五轮：按来源版本迁移到当前结构
      Object.keys(loaded).forEach(function (k) { localStorage.setItem(k, loaded[k]); }); // 装入写回
      localStorage.setItem("scratch-hdd-active", n); // 激活（绿灯）
      hddSnd("in"); // 6.2 五轮：插入咔哒 + 落座音
      toast("💚 硬盘 " + n + " 已插入，绿灯亮起 · 即将刷新读取存档"); // 反馈
      setTimeout(function () { location.reload(); }, 800); // 刷新生效
    } else { // 空盘 → 新建：把当前进度装入这块空硬盘并激活
      localStorage.setItem("scratch-slot-" + n, JSON.stringify(bayPkg(snapshot()))); // 进度落盘
      localStorage.setItem("scratch-hdd-active", n); // 激活（绿灯）
      hddSnd("in"); // 6.2 五轮：插入咔哒 + 落座音
      toast("✨ 当前进度已装入硬盘 " + n + "，绿灯亮起"); // 反馈
      render(); // 重渲染姿态
      fxOnce(n, "drop"); // 插入下落回弹物理动画
    } // 结束装入/新建分支
  } // 结束 hddToggle
  function closeMenu() { if (menu) { menu.classList.remove("show"); } } // 收菜单
  function openMenu(n, x, y) { // 右键菜单：有档=删除；空盘=导入/新建
    if (!menu) { return; } // 节点保护
    const has = !!slotData(n); // 是否有档
    menu.innerHTML = '<div class="bayMenuT">DISK ' + n + (has ? " · 已有存档" : " · 空硬盘") + "</div>" +
      (has ? '<button data-act="del">🗑 删除存档</button>' : "") +
      '<button data-act="import">📥 导入文件到硬盘</button>' +
      (!has ? '<button data-act="new">✨ 新建：装入当前进度</button>' : "") + // 菜单项（按档况增减）
      '<button data-act="cancel">取消</button>'; // 取消项兜底
    menu.classList.add("show"); // 显示
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth - 186)) + "px"; menu.style.top = Math.max(6, Math.min(y, window.innerHeight - 130)) + "px"; // 定位（防溢出屏幕）
    menu.querySelectorAll("button").forEach(function (b) { // 绑定菜单动作
      b.addEventListener("click", function () { // 点击执行
        closeMenu(); // 先收菜单
        const act = b.dataset.act; // 动作类型
        if (act === "cancel") { return; } // 取消无操作
        if (act === "del") { // 删除存档
          if (!confirm("删除硬盘 " + n + " 中的存档？此操作不可恢复。")) { return; } // 删除确认
          localStorage.removeItem("scratch-slot-" + n); // 清槽
          if (activeNow() === n) { localStorage.removeItem("scratch-hdd-active"); } // 删的是激活盘则一并取消激活
          toast("🗑 硬盘 " + n + " 存档已删除"); // 反馈
          render(); // 重渲染
        } else if (act === "new") { // 新建：当前进度入槽
          localStorage.setItem("scratch-slot-" + n, JSON.stringify(bayPkg(snapshot()))); // 落盘
          toast("✨ 当前进度已存入硬盘 " + n); // 反馈
          render(); // 重渲染
        } else if (act === "import") { // 导入文件到该硬盘（只入槽，不动当前进度）
          fileI.value = ""; fileI.click(); // 唤起文件选择
          fileI.onchange = function () { // 选中后
            const f = fileI.files[0]; if (!f) { return; } // 无文件退出
            const rd = new FileReader(); // 读取器
            rd.onload = function () { // 读取完成
              try { // 解析容错
                const pj = JSON.parse(rd.result); const data = migrateSave(pj && pj.data ? pj.data : pj, pj && pj.__meta && pj.__meta.schemaVersion); // 兼容裸键值格式 + 6.2 五轮按版本迁移
                localStorage.setItem("scratch-slot-" + n, JSON.stringify(bayPkg(data))); // 仅存入槽
                hddSnd("in"); // 6.2 五轮：落盘咔哒音
                toast("📥 已导入到硬盘 " + n + "（" + Object.keys(data).length + " 项）· 单击硬盘即可装入"); // 提示
                render(); // 重渲染
              } catch (e) { toast("❌ 存档文件损坏或格式不对"); } // 损坏提示
            }; // 结束读取
            rd.readAsText(f, "utf-8"); // UTF-8 读
          }; // 结束选择监听
        } // 结束导入分支
      }); // 结束动作绑定
    }); // 结束遍历
  } // 结束 openMenu
  document.addEventListener("pointerdown", function (e) { if (menu && menu.classList.contains("show") && !menu.contains(e.target)) { closeMenu(); } }); // 点击空白收菜单
  render(); // 首次渲染
})(); // 结束 initHddBay

// ================= 6.2 六轮：老虎机押注档位（×1/×2/×5，单注与奖额同倍放大，持久化） =================
let slotBet = 1; // 当前押注档位（从存档恢复）
(function initBetSwitch() { // 押注档位模块：绑定 + 恢复
  const sw = $("betSwitch"); if (!sw) { return; } // 节点保护
  const saved = parseInt(localStorage.getItem("scratch-slot-bet"), 10); // 读档位存档
  if (saved === 1 || saved === 2 || saved === 5) { slotBet = saved; } // 合法档位恢复
  function paint() { sw.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", +b.dataset.bet === slotBet); }); } // 高亮当前档
  sw.querySelectorAll("button").forEach(function (b) { // 逐按钮绑定
    b.addEventListener("click", function () { // 切换档位
      slotBet = +b.dataset.bet; // 更新档位
      localStorage.setItem("scratch-slot-bet", String(slotBet)); // 持久化
      $("slotCostView").textContent = ((+SLOT_CFG.cost || 1) * slotBet).toFixed(2); // 刷新单注显示
      toast("🎰 押注档位 ×" + slotBet + "（单注与奖额同倍放大）"); // 反馈
      paint(); // 刷高亮
    }); // 结束绑定
  }); // 结束遍历
  paint(); // 首刷高亮
})(); // 结束 initBetSwitch

// ================= 6.2 六轮：生涯数据看板（近 30 天每日盈亏柱状 + 累计收益曲线） =================
function renderLifeDashboard() { // 进历史页时刷新看板（数据由刮票历史 + 三玩法战绩推导）
  const card = $("lifeCard"), cv = $("lifeCv"); if (!card || !cv) { return; } // 节点保护
  const now0 = new Date(); now0.setHours(0, 0, 0, 0); // 今天 0 点
  const days = []; // 30 天桶（旧 → 新）
  for (let i = 29; i >= 0; i--) { const d = new Date(now0.getTime() - i * 864e5); days.push({ t: d.getTime(), net: 0, n: 0 }); } // 逐日建桶
  const all = loadHistory().concat(loadPlayHist()).filter(function (h) { return h.time >= days[0].t; }); // 合并两路流水并只取近 30 天（刮票批次 + 三玩法战绩）
  let spend = 0, income = 0; // 汇总
  all.forEach(function (h) { // 逐条归桶
    const day = days.filter(function (d) { return h.time >= d.t && h.time < d.t + 864e5; })[0]; // 命中日桶
    if (day) { day.net += (+h.prize || 0) - (+h.cost || 0); day.n += 1; } // 净盈亏累加
    spend += (+h.cost || 0); income += (+h.prize || 0); // 窗口内汇总
  }); // 结束归桶
  let acc = 0; days.forEach(function (d) { acc += d.net; }); // 累计净盈亏（6.2 八轮：折线图已移除，仅保留数值）
  const W = cv.width, H = cv.height, padL = 90, padR = 30, padT = 30, padB = 46; // 画布内边距（2x 分辨率）
  const g = cv.getContext("2d"); g.clearRect(0, 0, W, H); // 清画布
  g.fillStyle = "rgba(255,255,255,.42)"; g.strokeStyle = "rgba(122,90,16,.3)"; // 票面底与轴线色
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 18) : g.rect(0, 0, W, H); g.fill(); // 圆角底
  const maxAbs = Math.max(10, Math.max.apply(null, days.map(function (d) { return Math.abs(d.net); }))); // 纵轴对称量程（按柱高取）
  const plotW = W - padL - padR, plotH = H - padT - padB, y0 = padT + plotH / 2; // 绘图区与零轴
  const bw = plotW / 30; // 每日柱宽
  g.strokeStyle = "rgba(122,90,16,.25)"; g.beginPath(); g.moveTo(padL, y0); g.lineTo(W - padR, y0); g.stroke(); // 零轴线
  days.forEach(function (d, i) { // 逐日柱
    const h = d.net / maxAbs * (plotH / 2 - 8); // 柱高
    g.fillStyle = d.net > 0 ? "rgba(53,180,110,.75)" : d.net < 0 ? "rgba(214,84,64,.75)" : "rgba(150,145,130,.4)"; // 盈亏配色
    g.fillRect(padL + i * bw + bw * 0.18, d.net >= 0 ? y0 - h : y0, bw * 0.64, Math.max(1, Math.abs(h))); // 柱体
  }); // 结束柱状
  g.fillStyle = "#8a8474"; g.font = "16px 'Microsoft YaHei', sans-serif"; g.textAlign = "center"; // 横轴刻度（每 7 天一档）
  days.forEach(function (d, i) { const dt = new Date(d.t); if (i % 7 === 0 || i === 29) { g.fillText((dt.getMonth() + 1) + "/" + dt.getDate(), padL + i * bw + bw / 2, H - 20); } }); // 日期标签
  g.save(); g.translate(20, padT + plotH / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("净盈亏（¥）", 0, 0); g.restore(); // 纵轴标题
  const best = days.reduce(function (m, d) { return d.net > (m ? m.net : -Infinity) ? d : m; }, null); // 最旺一天
  const bd = best && best.n ? new Date(best.t) : null; // 最旺一天日期对象
  $("lifeSummary").innerHTML = "近 30 天：投入 <b>¥" + spend.toFixed(2) + "</b> · 回报 <b>¥" + income.toFixed(2) + "</b> · 累计净 <b style='color:" + (acc >= 0 ? "#1e9e5a" : "#c0392b") + "'>" + (acc >= 0 ? "+" : "") + "¥" + acc.toFixed(2) + "</b>" + (bd ? " · 最旺一天 " + (bd.getMonth() + 1) + "/" + bd.getDate() + " 净赚 ¥" + best.net.toFixed(2) : ""); // 汇总行
  card.style.display = "block"; // 显示卡片
} // 结束 renderLifeDashboard

// ================= 6.2 六轮：中奖票根收藏（老虎机三同 ≥ ¥88 自动机打，可导出 PNG） =================
const STUB_KEY = "scratch-ticket-stubs"; // 票根存档键
function loadStubs() { // 读票根列表
  try { const v = JSON.parse(localStorage.getItem(STUB_KEY)); if (Array.isArray(v)) { return v; } } catch (e) {} // 容错
  return []; // 空表
} // 结束 loadStubs
function saveStub(sym, amt, kind, note, force) { // 6.2 九轮：票根入库（默认 ≥¥88 触发；force=true 可强制收纪念票，如转盘头彩）
  if (!force && amt < 88) { return; } // 阈值以下不收藏
  const arr = loadStubs(); // 现有票根
  arr.unshift({ time: Date.now(), sym: String(sym), amt: Math.round(amt * 100) / 100, kind: kind || "slot", note: note || "" }); // 新票根置顶（带玩法与备注）
  if (arr.length > 120) { arr.length = 120; } // 上限 120 张（约 10 页册子）
  localStorage.setItem(STUB_KEY, JSON.stringify(arr)); // 持久化
} // 结束 saveStub
let stubKind = "all", stubPage = 0; // 册子状态：筛选分类与当前页码
const STUB_PER_PAGE = 12; // 每页 12 格（3 列 × 4 行）
const STUB_KINDS = [["all", "全部"], ["slot", "🎰 老虎机"], ["lucky", "🎡 大转盘"], ["dice", "🎲 骰子台"], ["misc", "🎫 其他"]]; // 筛选定义
function stubKindOf(s) { // 票根归类（旧票根无 kind → 老虎机）
  const k = s && s.kind ? s.kind : "slot"; // 取 kind
  return (k === "slot" || k === "lucky" || k === "dice") ? k : "misc"; // 未知归其它
} // 结束 stubKindOf
function stubKindLabel(k) { // 分类短名（票面左下角用）
  const m = { slot: "老虎机", lucky: "大转盘", dice: "骰子台", misc: "其他" }; return m[k] || "票根"; // 映射
} // 结束 stubKindLabel
function stubFiltered() { // 当前筛选下的票根
  const arr = loadStubs(); // 全部
  return stubKind === "all" ? arr : arr.filter(function (s) { return stubKindOf(s) === stubKind; }); // 过滤
} // 结束 stubFiltered
function stubFmtTime(ts) { // 票面时间短格式
  const d = new Date(ts); // 时间对象
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); // 月/日 时:分
} // 结束 stubFmtTime
function renderStubList() { // 6.2 九轮：渲染票根册（玩法筛选 + 每页 12 格 + 满页钢印）
  const card = $("stubCard"), grid = $("stubPageGrid"); if (!card || !grid) { return; } // 节点保护
  const all = loadStubs(); // 全部票根
  const arr = stubFiltered(); // 当前筛选
  const pages = Math.max(1, Math.ceil(arr.length / STUB_PER_PAGE)); // 总页数
  if (stubPage >= pages) { stubPage = pages - 1; } // 页码越界回退
  if (stubPage < 0) { stubPage = 0; } // 下限保护
  const tabs = $("stubTabs"); // 筛选条
  if (tabs) { // 渲染筛选药丸
    tabs.innerHTML = STUB_KINDS.map(function (k) { // 逐类
      const n = k[0] === "all" ? all.length : all.filter(function (s) { return stubKindOf(s) === k[0]; }).length; // 该类数量
      return '<button class="stubTab' + (stubKind === k[0] ? " on" : "") + '" data-k="' + k[0] + '">' + k[1] + " " + n + "</button>"; // 药丸
    }).join(""); // 拼接
    tabs.querySelectorAll(".stubTab").forEach(function (b) { // 逐按钮绑定
      b.addEventListener("click", function () { stubKind = b.dataset.k; stubPage = 0; renderStubList(); }); // 切分类回首 0 页
    }); // 结束绑定
  } // 结束筛选
  const start = stubPage * STUB_PER_PAGE; // 当前页起点
  let html = ""; // 拼接容器
  for (let i = 0; i < STUB_PER_PAGE; i++) { // 固定 12 格（不足补空位）
    const s = arr[start + i]; // 该格票根
    if (!s) { html += '<div class="stubCell"><span class="stubEmpty">待 · 机 · 打</span></div>'; continue; } // 空位
    html += '<div class="stubCell filled" data-i="' + (start + i) + '">' +
      '<span class="sbNo">NO.' + String(start + i + 1).padStart(3, "0") + "</span>" + // 册内编号
      '<span class="sbSym">' + s.sym + "</span>" + // 号码大字
      '<span class="sbAmt">¥' + (+s.amt || 0).toFixed(2) + "</span>" + // 金额
      '<span class="sbKind">' + stubKindLabel(stubKindOf(s)) + "</span>" + // 玩法
      '<span class="sbTime">' + stubFmtTime(s.time) + "</span>" + // 时间
      "</div>"; // 有票格
  } // 结束 12 格
  grid.innerHTML = html; // 落盘
  grid.querySelectorAll(".stubCell.filled").forEach(function (c) { // 点格导出单张
    c.addEventListener("click", function () { const one = stubFiltered()[+c.dataset.i]; if (one) { drawStubPng(one); } }); // 单张 PNG
  }); // 结束绑定
  const st = $("stubStamp"); // 满页钢印
  if (st) { st.classList.toggle("show", arr.length > 0 && arr.length - start >= STUB_PER_PAGE); } // 满 12 张才盖
  const pv = $("stubPageView"); if (pv) { pv.textContent = (stubPage + 1) + " / " + pages + " · " + arr.length + " 张"; } // 页码与张数
  card.style.display = "block"; // 显示卡片
} // 结束 renderStubList
function drawStubBookPng() { // 6.2 九轮：当前筛选下的整册导出为竖长 PNG（每页一屏拼接）
  const arr = stubFiltered(); // 当前筛选
  const pages = Math.min(12, Math.max(1, Math.ceil(arr.length / STUB_PER_PAGE))); // 页数（上限 12 页防画布过大）
  const PW = 1080, PH = 1400, m = 56, gap = 18; // 页宽高、页边距、格间距
  const cv = document.createElement("canvas"); cv.width = PW; cv.height = PH * pages; // 整册画布
  const g = cv.getContext("2d"); // 绘图句柄
  const cw = (PW - m * 2 - gap * 2) / 3; // 格宽
  const ch = cw * 0.66; // 格高
  for (let p = 0; p < pages; p++) { // 逐页绘制
    const oy = p * PH; // 该页纵向偏移
    const grd = g.createLinearGradient(0, oy, 0, oy + PH); // 页底渐变
    grd.addColorStop(0, "#221d17"); grd.addColorStop(1, "#14110e"); // 深棕票册底
    g.fillStyle = grd; g.fillRect(0, oy, PW, PH); // 铺页
    g.strokeStyle = "rgba(246,199,117,.35)"; g.lineWidth = 4; g.strokeRect(m / 2, oy + m / 2, PW - m, PH - m); // 金色内框
    g.textAlign = "left"; g.fillStyle = "#f6c775"; g.font = "800 30px Consolas, monospace"; // 页眉
    g.fillText("★ GAMING TIME · TICKET BOOK ★", m, oy + m + 34); // 抬头
    g.textAlign = "right"; g.fillStyle = "#8a8474"; g.font = "20px 'Microsoft YaHei', sans-serif"; // 页码
    g.fillText("PAGE " + (p + 1) + " / " + pages, PW - m, oy + m + 34); // 页码文字
    g.textAlign = "left"; g.fillStyle = "#a9a292"; g.font = "19px 'Microsoft YaHei', sans-serif"; // 副标题
    g.fillText("分类：" + (stubKind === "all" ? "全部票根" : stubKindLabel(stubKind)) + " · 本册共 " + arr.length + " 张", m, oy + m + 68); // 分类与数量
    for (let i = 0; i < STUB_PER_PAGE; i++) { // 逐格
      const idx = p * STUB_PER_PAGE + i; // 全局序号
      const s = arr[idx]; // 票根
      const col = i % 3, row = Math.floor(i / 3); // 行列
      const x = m + col * (cw + gap), y = oy + m + 96 + row * (ch + gap); // 格位置
      if (!s) { // 空位虚线框
        g.setLineDash([10, 8]); g.strokeStyle = "rgba(246,199,117,.22)"; g.lineWidth = 3; g.strokeRect(x, y, cw, ch); g.setLineDash([]); // 空框
        g.fillStyle = "rgba(255,253,248,.22)"; g.font = "22px 'Microsoft YaHei', sans-serif"; g.textAlign = "center"; // 占位字
        g.fillText("待 · 机 · 打", x + cw / 2, y + ch / 2 + 8); continue; // 空位提示后跳下一格
      } // 结束空位
      const gd = g.createLinearGradient(x, y, x + cw, y + ch); // 票面渐变
      gd.addColorStop(0, "#2c2620"); gd.addColorStop(1, "#1a1713"); // 深棕
      g.fillStyle = gd; g.fillRect(x, y, cw, ch); // 票底
      g.fillStyle = "#14110e"; for (let k = 0; k < cw - 16; k += 16) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 8, y + 9); g.lineTo(x + k + 16, y); g.fill(); g.beginPath(); g.moveTo(x + k, y + ch); g.lineTo(x + k + 8, y + ch - 9); g.lineTo(x + k + 16, y + ch); g.fill(); } // 上下锯齿
      g.strokeStyle = "rgba(246,199,117,.5)"; g.lineWidth = 2; g.strokeRect(x, y, cw, ch); // 金边
      g.textAlign = "left"; g.fillStyle = "rgba(246,199,117,.65)"; g.font = "16px Consolas, monospace"; // 编号
      g.fillText("NO." + String(idx + 1).padStart(3, "0"), x + 14, y + 30); // 编号文字
      g.textAlign = "center"; g.fillStyle = "#fffdf8"; g.font = "900 " + Math.round(ch * 0.32) + "px Consolas, monospace"; // 号码大字
      g.fillText(String(s.sym), x + cw / 2, y + ch * 0.52); // 画号码
      g.fillStyle = "#f6c775"; g.font = "900 " + Math.round(ch * 0.19) + "px 'Microsoft YaHei', sans-serif"; // 金额
      g.fillText("¥" + (+s.amt || 0).toFixed(2), x + cw / 2, y + ch * 0.79); // 金额文字
      g.textAlign = "left"; g.fillStyle = "rgba(255,253,248,.45)"; g.font = "15px 'Microsoft YaHei', sans-serif"; // 左下
      g.fillText(stubKindLabel(stubKindOf(s)), x + 14, y + ch - 14); // 玩法
      g.textAlign = "right"; g.fillText(stubFmtTime(s.time), x + cw - 14, y + ch - 14); // 时间
    } // 结束逐格
    if (arr.length - p * STUB_PER_PAGE >= STUB_PER_PAGE) { // 满页盖章
      g.save(); g.translate(PW - m - 130, oy + PH - m - 80); g.rotate(-0.22); // 定位并旋转
      g.strokeStyle = "rgba(214,84,64,.85)"; g.lineWidth = 5; g.strokeRect(-78, -34, 156, 68); // 章框
      g.fillStyle = "rgba(214,84,64,.85)"; g.font = "900 40px Consolas, monospace"; g.textAlign = "center"; // 章字
      g.fillText("FULL", 0, 14); g.restore(); // 盖印
    } // 结束钢印
    g.textAlign = "center"; g.fillStyle = "#6f6858"; g.font = "17px 'Microsoft YaHei', sans-serif"; // 页脚
    g.fillText("刮彩票模拟器 · 票根册 · 导出于 " + new Date().toLocaleString("zh-CN"), PW / 2, oy + PH - 26); // 落款
  } // 结束逐页
  const a = document.createElement("a"); // 下载链
  a.href = cv.toDataURL("image/png"); // PNG 数据
  a.download = "票根册_" + (stubKind === "all" ? "全部" : stubKindLabel(stubKind)) + "_" + arr.length + "张.png"; // 文件名
  a.click(); // 触发下载
  toast("📖 票根册已导出（" + pages + " 页 · " + arr.length + " 张）"); // 反馈
} // 结束 drawStubBookPng
(function initStubPager() { // 6.2 九轮：册子翻页与整册导出绑定
  const prev = $("stubPrev"), next = $("stubNext"), exp = $("stubExportAll"); // 三个按钮
  if (prev) { prev.addEventListener("click", function () { if (stubPage > 0) { stubPage -= 1; renderStubList(); } }); } // 上一页
  if (next) { next.addEventListener("click", function () { const pages = Math.max(1, Math.ceil(stubFiltered().length / STUB_PER_PAGE)); if (stubPage < pages - 1) { stubPage += 1; renderStubList(); } }); } // 下一页
  if (exp) { exp.addEventListener("click", drawStubBookPng); } // 导出整册
})(); // 结束 initStubPager
function drawStubPng(s) { // 6.2 六轮：票根导出 PNG（金色机打小票风格）
  if (!s) { return; } // 保护
  const W = 360, H = 240; // 画布尺寸
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; // 离屏画布
  const g = cv.getContext("2d"); // 绘图句柄
  g.fillStyle = "#1f1b15"; g.fillRect(0, 0, W, H); // 深色票底（呼应灯箱）
  g.fillStyle = "#26211a"; // 锯齿色
  for (let x = 0; x < W; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 7, 8); g.lineTo(x + 14, 0); g.fill(); g.beginPath(); g.moveTo(x, H); g.lineTo(x + 7, H - 8); g.lineTo(x + 14, H); g.fill(); } // 上下锯齿
  g.strokeStyle = "rgba(246,199,117,.4)"; g.setLineDash([5, 4]); g.strokeRect(14, 20, W - 28, H - 40); g.setLineDash([]); // 金色虚线内框
  g.textAlign = "center"; // 居中排版
  g.fillStyle = "#f6c775"; g.font = "800 17px Consolas, monospace"; g.fillText("★ GAMING TIME · WIN TICKET ★", W / 2, 48); // 机打抬头
  g.fillStyle = "#fffdf8"; g.font = "800 56px Consolas, monospace"; g.fillText(s.sym, W / 2, 112); // 三同数字大字
  g.fillStyle = "#f6c775"; g.font = "800 30px 'Microsoft YaHei', sans-serif"; g.fillText("¥" + s.amt.toFixed(2), W / 2, 152); // 奖额
  g.fillStyle = "#8a8474"; g.font = "13px 'Microsoft YaHei', sans-serif"; // 页脚
  const d = new Date(s.time); // 时间对象
  g.fillText("刮彩票模拟器 · " + d.toLocaleString("zh-CN"), W / 2, H - 32); // 落款时间
  const a = document.createElement("a"); // 下载链
  a.href = cv.toDataURL("image/png"); // PNG 地址
  a.download = "中奖票根_" + s.sym + "_" + s.amt.toFixed(0) + ".png"; // 文件名
  a.click(); // 触发下载
  toast("🎟 票根已导出 PNG"); // 反馈
} // 结束 drawStubPng

// ================= 6.2 六轮：存档自动快照环（每天首启自动快照，7 天轮换，可回溯恢复） =================
(function initSnapRing() { // 自执行：首启快照 + 恢复 UI
  const TODAY = new Date().toDateString(); // 今日标识
  const last = localStorage.getItem("scratch-snap-last"); // 上次快照日
  function snapData() { // 快照数据体（排除硬盘槽与快照自身键）
    const data = {}; // 收集容器
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf("scratch-slot-") === 0 || k.indexOf("scratch-snap-") === 0 || k === "scratch-hdd-active") { continue; } data[k] = localStorage.getItem(k); } // 逐键收编
    return data; // 返回
  } // 结束 snapData
  if (last !== TODAY) { // 今日尚未快照
    const idx = Math.floor(Date.now() / 864e5) % 7; // 天序号轮换（0~6 槽循环覆盖）
    const data = snapData(); // 快照
    if (Object.keys(data).length > 3) { localStorage.setItem("scratch-snap-" + idx, JSON.stringify({ __meta: { date: TODAY, time: new Date().toISOString(), keys: Object.keys(data).length }, data: data })); } // 有内容才写
    localStorage.setItem("scratch-snap-last", TODAY); // 标记今日已快照
  } // 结束首启分支
  const sel = $("snapSel"), btn = $("btnSnapRestore"); // 恢复 UI 节点
  if (!sel || !btn) { return; } // 无节点（老存档兼容）退出
  function fillSel() { // 填充快照下拉
    let html = '<option value="">— 选择自动快照 —</option>'; // 默认项
    for (let i = 0; i < 7; i++) { // 七个轮换槽
      try { const p = JSON.parse(localStorage.getItem("scratch-snap-" + i)); if (p && p.__meta) { const d = new Date(p.__meta.time); html += '<option value="' + i + '">' + (d.getMonth() + 1) + "月" + d.getDate() + "日 快照 · " + (p.__meta.keys || Object.keys(p.data || {}).length) + " 项</option>"; } } catch (e) {} // 有档才列
    } // 结束七槽
    sel.innerHTML = html; // 注入
  } // 结束 fillSel
  fillSel(); // 首次填充
  btn.addEventListener("click", function () { // 恢复按钮
    const i = sel.value; // 选中槽
    if (i === "") { toast("请先在下拉框选择要恢复的自动快照"); return; } // 未选择提示
    let p = null; // 槽内档案
    try { p = JSON.parse(localStorage.getItem("scratch-snap-" + i)); } catch (e) {} // 解析容错
    const data = p && p.data; // 数据体
    if (!data) { toast("❌ 该快照已失效（被新快照轮换覆盖）"); fillSel(); return; } // 失效防御
    if (!confirm("恢复该自动快照将覆盖当前全部进度（余额/欠款/好感度/配置等），且不可恢复。确定继续吗？")) { return; } // 覆盖确认
    Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); }); // 全量写回
    toast("⏪ 自动快照已恢复，即将刷新页面…"); // 反馈
    setTimeout(function () { location.reload(); }, 900); // 刷新生效
  }); // 结束恢复绑定
})(); // 结束 initSnapRing

// ================= 6.2 七轮：幸运大转盘（第 4 个 3D 玩法，八格 + 指针 + 灯泡跑马） =================
const LUCKY_SEGS = [ // 八格配置（顺时针，0 号格中心在正上方）
  { label: "¥0.5", amt: 0.5, w: 20, color: "#2f6fe0" }, // 小额保底
  { label: "¥1", amt: 1, w: 20, color: "#3f7fd1" }, // 小额
  { label: "再来一次", amt: 0, w: 12, color: "#8b5fd1", free: true }, // 免费续转
  { label: "¥2", amt: 2, w: 18, color: "#1e9e5a" }, // 回本
  { label: "¥5", amt: 5, w: 12, color: "#e0862f" }, // 小奖
  { label: "谢谢惠顾", amt: 0, w: 12, color: "#7a7266" }, // 空奖
  { label: "¥10", amt: 10, w: 5, color: "#d64541" }, // 大奖
  { label: "×10 头彩", amt: 20, w: 1, color: "#f6c775" } // 头彩（¥20）
];
let luckyScene = null; // 场景句柄
let luckySpinning = false; // 转动中标记
let luckyFree = false; // 免费续转（转到「再来一次」）
let luckyGuess = -1; // 6.2 九轮：押注格下标（-1 = 未押注；押 ¥1 命中返 ¥5）
let luckyCostBase = 2; // 单次费用
function luckyPickSeg() { // 按权重抽一格
  let total = 0; LUCKY_SEGS.forEach(function (s) { total += s.w; }); // 权重和
  let r = Math.random() * total; // 随机落点
  for (let i = 0; i < LUCKY_SEGS.length; i++) { r -= LUCKY_SEGS[i].w; if (r < 0) { return i; } } // 命中
  return 0; // 兜底
} // 结束 luckyPickSeg
function luckyPointerIdx(rot) { // 反算：给定盘面旋转角，返回当前停在顶部指针正下方的那一格下标（自检 + 纠偏用）
  const step = Math.PI / 4; // 每格 45°
  return ((Math.round(rot / step) % 8) + 8) % 8; // 第 i 格中心初始在数学角 (90° - 45°i)，旋转 rot 后对准顶部 90° 的条件即 rot ≡ 45°·i
} // 结束 luckyPointerIdx
function luckyFixRot(to, segIdx) { // 纠偏：把落点角校正到「segIdx 格中心正对指针」的最近等价角（圈数保持不变，绝不改变滚动圈数观感）
  const step = Math.PI / 4; // 每格 45°
  const want = segIdx * step; // 该格对准指针时的基准角（mod 2π 的等价类）
  const k = Math.round((to - want) / (Math.PI * 2)); // 保留当前圈数
  return want + k * Math.PI * 2; // 等价角（与 to 相差不超过半圈）
} // 结束 luckyFixRot
function luckyTexture() { // 绘制转盘盘面贴图（八扇形 + 文字 + 金边）
  const cv = document.createElement("canvas"); cv.width = cv.height = 1024; // 高清画布
  const g = cv.getContext("2d"); // 上下文
  const cx = 512, cy = 512, R = 496; // 圆心与半径
  g.clearRect(0, 0, 1024, 1024); // 清空
  for (let i = 0; i < 8; i++) { // 八个扇形
    const mid = (i * 45 - 90) * Math.PI / 180; // 扇形中心角（-90° 为顶部）
    const a0 = mid - Math.PI / 8, a1 = mid + Math.PI / 8; // 起止角
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); // 扇形路径
    const grd = g.createRadialGradient(cx, cy, 60, cx, cy, R); // 径向渐变
    grd.addColorStop(0, "#fffdf8"); grd.addColorStop(0.32, LUCKY_SEGS[i].color); grd.addColorStop(1, LUCKY_SEGS[i].color); // 内白外色
    g.fillStyle = grd; g.fill(); // 填充
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5; g.stroke(); // 分隔白线
    g.save(); g.translate(cx, cy); g.rotate(mid); g.translate(R * 0.66, 0); // 移到扇形标签位
    const flip = Math.cos(mid) < 0; // 左侧扇形文字翻转 180° 保证正向可读
    g.rotate(flip ? Math.PI / 2 + Math.PI : Math.PI / 2); // 文字沿切线方向
    g.textAlign = "center"; g.textBaseline = "middle"; // 居中
    g.fillStyle = i === 7 ? "#5a3b06" : "#ffffff"; // 头彩深棕字，其余白字
    g.font = "700 " + (LUCKY_SEGS[i].label.length > 2 ? 58 : 78) + "px 'PingFang SC', 'Microsoft YaHei', sans-serif"; // 字号按字数
    g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 8; // 阴影
    g.fillText(LUCKY_SEGS[i].label, 0, 0); // 画标签
    g.restore(); // 结束标签
  } // 结束八格
  g.beginPath(); g.arc(cx, cy, 96, 0, Math.PI * 2); g.fillStyle = "rgba(255,253,248,.96)"; g.fill(); // 中心白盘
  g.strokeStyle = "#d9c07a"; g.lineWidth = 8; g.stroke(); // 中心金边
  const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; return tx; // 生成纹理
} // 结束 luckyTexture
function luckyEnsure() { // 懒建转盘场景
  if (luckyScene || !window.THREE || !webglOK()) { if (!luckyScene) { noWebglFallback("luckyStage", "🎡"); } return; } // 已建或不可用
  const stage = $("luckyStage"); if (!stage) { return; } // 容器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // 渲染器
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); // 像素比
  stage.appendChild(renderer.domElement); // 挂画布
  const scene = new THREE.Scene(); // 场景
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100); camera.position.set(0, 0, 7.2); camera.lookAt(0, 0, 0); // 相机正视
  scene.add(new THREE.AmbientLight(0xffffff, 0.9)); // 环境光
  const dir = new THREE.DirectionalLight(0xfff2cc, 0.8); dir.position.set(3, 5, 6); scene.add(dir); // 主光
  const back = new THREE.Mesh(new THREE.CircleGeometry(2.34, 72), new THREE.MeshBasicMaterial({ color: 0x241f19 })); back.position.z = -0.06; scene.add(back); // 背板
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(2.16, 128), new THREE.MeshBasicMaterial({ map: luckyTexture() })); scene.add(wheel); // 盘面（Basic 保证文字清晰）
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 32), new THREE.MeshStandardMaterial({ color: 0xf6c775, metalness: 0.7, roughness: 0.28 })); hub.rotation.x = Math.PI / 2; hub.position.z = 0.1; scene.add(hub); // 中心金帽
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.26, 0.075, 16, 100), new THREE.MeshStandardMaterial({ color: 0xd9b25e, metalness: 0.8, roughness: 0.3 })); scene.add(rim); // 金色外环
  const bulbs = []; // 灯泡材质组（跑马）
  for (let i = 0; i < 16; i++) { // 16 颗灯泡
    const a = i / 16 * Math.PI * 2; // 角度
    const bm = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffc86b, emissiveIntensity: 0.4, roughness: 0.4 }); // 自发光材质
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), bm); // 小球
    b.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.05); scene.add(b); bulbs.push(bm); // 环绕排布
  } // 结束灯泡
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.46, 4), new THREE.MeshStandardMaterial({ color: 0xf6c775, metalness: 0.85, roughness: 0.22 })); pointer.position.set(0, 2.3, 0.32); pointer.rotation.z = Math.PI; scene.add(pointer); // 顶部指针（尖朝下）
  luckyScene = { renderer: renderer, scene: scene, camera: camera, wheel: wheel, bulbs: bulbs, stage: stage, spin: null, clock: new THREE.Clock(), phase: 0, lastIdx: 0 }; // 存句柄
  function resize() { // 自适应
    const w = stage.clientWidth, h = stage.clientHeight; // 实测
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); // 更新
  } // 结束 resize
  resize(); if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); } // 观察尺寸
  luckyScene.loop = function () { // 渲染循环
    const dt = Math.min(0.05, luckyScene.clock.getDelta()); // 帧间隔
    const sp = luckyScene.spin; // 转动状态
    if (sp) { // 转动中
      sp.t += dt * 1000; // 累计毫秒
      const p = Math.min(1, sp.t / sp.dur); // 进度
      const e = 1 - Math.pow(1 - p, 4); // easeOutQuart（快起慢收）
      const v = sp.from + (sp.to - sp.from) * e; // 当前角度
      wheel.rotation.z = v; // 应用
      const idx = Math.floor(v / (Math.PI / 4)); // 跨格计数
      if (idx !== luckyScene.lastIdx) { luckyScene.lastIdx = idx; tickTone(560 - p * 260, 0.028, Math.max(0.012, 0.055 * (1 - p)), "square", "amb"); } // 跨格滴答（越慢越轻越低）
      if (p >= 1) { luckyScene.spin = null; wheel.rotation.z = sp.to; luckySettle(sp.segIdx, sp.cost, sp.guess); } // 停稳结算（带上本次费用与押注格）
    } // 结束转动
    luckyScene.phase += dt; // 灯泡相位
    for (let i = 0; i < bulbs.length; i++) { // 灯泡跑马
      const wave = sp ? (Math.sin(luckyScene.phase * 9 - i * 0.7) * 0.5 + 0.5) : (i % 2 ? 0.18 : 0.55); // 转=跑马，停=交替
      bulbs[i].emissiveIntensity = sp ? (0.25 + wave * 1.5) : wave; // 自发光强度
    } // 结束灯泡
    renderer.render(scene, camera); // 绘制
  }; // 结束 loop
  renderer.setAnimationLoop(luckyScene.loop); // 启动
} // 结束 luckyEnsure
function luckySpin() { // 开转（按钮入口）
  luckyEnsure(); // 场景就绪
  if (luckySpinning) { return; } // 防连点
  const cost = luckyFree ? 0 : luckyCostBase; // 本次费用（免费续转为 0）
  if (cost > 0 && balance < cost) { toast("余额不足，先去大厅刮两张回回血～"); return; } // 余额校验
  if (cost > 0) { payMoney(cost); } // 扣费
  luckyFree = false; // 消耗免费次数
  luckySpinning = true; // 标记
  $("luckyBalView").textContent = balance.toFixed(2); // 刷新余额
  const guessNow = luckyGuess; // 6.2 九轮：本次押注格（开转即锁定）
  const segIdx = luckyPickSeg(); // 抽落点
  if (!luckyScene) { // 无 3D：直接结算（保底可玩）
    setTimeout(function () { luckySettle(segIdx, cost, guessNow); }, 600); return; // 延迟一下给按钮反馈
  } // 结束无场景
  const base = luckyScene.wheel.rotation.z; // 起始角
  const targetMod = segIdx * Math.PI / 4; // 目标角（6.2 八轮修正：顺时针第 segIdx 格 = 旋转 +45°·segIdx 才对得准顶部指针，原写法取负号导致镜像错位）
  let delta = ((targetMod - base) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); // 归一正向补角
  const to = luckyFixRot(base + Math.PI * 2 * 5 + delta, segIdx); // 五圈 + 定位（3.4 秒），再做一次反算纠偏，确保停稳后指针与结算格绝对一致
  luckyScene.spin = { from: base, to: to, t: 0, dur: 3400, segIdx: segIdx, cost: cost, guess: guessNow }; // 写入转动状态（含押注格）
  if (luckyPointerIdx(to) !== segIdx) { luckySettle(segIdx, cost, guessNow); return; } // 极端状态下（画面被缩放/外部改写角度）兜底：角度无法自洽时直接按抽中格结算，不出现「看 A 赔 B」
  $("luckyResult").classList.remove("show"); // 收起旧结果
} // 结束 luckySpin
function luckySettle(segIdx, costIn, guessIdx) { // 停稳结算（6.2 九轮：新增押注格判定）
  const seg = LUCKY_SEGS[segIdx] || LUCKY_SEGS[0]; // 命中格
  const cost = costIn != null ? costIn : (luckyScene && luckyScene.spin && luckyScene.spin.cost) || 0; // 本次费用
  const res = $("luckyResult"); // 结果横幅
  const guessHit = guessIdx != null && guessIdx >= 0 && guessIdx === segIdx; // 6.2 九轮：押注是否命中（押注时已扣 ¥1，命中返 ¥5）
  const guessTip = guessHit ? ' · <b style="color:#f6c775">押中 +¥5</b>' : (guessIdx != null && guessIdx >= 0 ? " · 押注未中" : ""); // 押注结果后缀
  if (guessHit) { gainMoney(5); } // 押中额外入账 ¥5
  if (seg.free) { // 再来一次
    luckyFree = true; // 记一次免费
    res.innerHTML = '<span class="grBig">🎡 再来一次！免费续转</span>' + guessTip; // 文案（附押注结果）
    res.classList.add("show"); // 显示
    pushPlayHist("lucky", (cost || luckyCostBase) + (guessIdx >= 0 ? 1 : 0), guessHit ? 5 : 0, "再来一次" + (guessHit ? "·押中" : "")); // 战绩（含押注）
    tickTone(880, 0.12, 0.08, "triangle", "win"); // 提示音
  } else if (seg.amt > 0) { // 中奖
    gainMoney(seg.amt); // 入账
    res.innerHTML = '<span class="grBig">🎉 指针停在 ' + seg.label + " → ¥" + seg.amt.toFixed(2) + "</span>" + guessTip; // 文案（附押注结果）
    res.classList.add("show"); // 显示
    pushPlayHist("lucky", cost + (guessIdx >= 0 ? 1 : 0), seg.amt + (guessHit ? 5 : 0), seg.label + (guessHit ? "·押中" : "")); // 战绩（含押注）
    if (seg.amt >= 20) { saveStub("×10", seg.amt, "lucky", "头彩 · 指针停在该格", true); } // 6.2 九轮：头彩强制打一张纪念票入册
    if (seg.amt >= 10) { if (fxOn) { confettiBurst(60); } bigWin(seg.amt); } // 大奖演出
    else if (fxOn) { confettiBurst(26); } // 小奖撒花
    [659, 784, 988].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.1, 0.07, "triangle", "win"); }, k * 90); }); // 三连音
  } else { // 空奖
    res.innerHTML = "💨 谢谢惠顾，再转一次试试手气" + guessTip; // 文案（附押注结果）
    res.classList.add("show"); // 显示
    pushPlayHist("lucky", cost + (guessIdx >= 0 ? 1 : 0), guessHit ? 5 : 0, "谢谢惠顾" + (guessHit ? "·押中" : "")); // 战绩（含押注）
    tickTone(220, 0.14, 0.06, "sawtooth", "win"); // 失落音
  } // 结束分支
  $("luckyBalView").textContent = balance.toFixed(2); // 刷新余额
  luckySpinning = false; // 解锁
  luckyGuess = -1; luckyGuessRender(); // 6.2 九轮：清空本轮押注并解锁按钮
} // 结束 luckySettle
function luckyGuessRender() { // 6.2 九轮：渲染八格押注按钮（颜色/文字与盘面一致，转动中禁用）
  const row = $("luckyGuessRow"), st = $("luckyGuessView"); // 节点句柄
  if (row) { // 有容器才渲染
    row.innerHTML = LUCKY_SEGS.map(function (s, i) { // 逐格生成
      return '<button class="guessChip' + (i === luckyGuess ? " on" : "") + '" data-gi="' + i + '" style="--gc:' + s.color + '"' + (luckySpinning ? " disabled" : "") + ">" + s.label + "</button>"; // 格按钮（背景用盘面同色）
    }).join(""); // 拼成一行
    row.querySelectorAll(".guessChip").forEach(function (b) { // 逐按钮绑定
      b.addEventListener("click", function () { luckyGuessToggle(+b.dataset.gi); }); // 点击押注/取消
    }); // 结束绑定
  } // 结束渲染
  if (st) { // 状态文字
    st.textContent = luckyGuess < 0 ? "未押注" : "已押 " + LUCKY_SEGS[luckyGuess].label + " · 命中返 ¥5"; // 文案
    st.classList.toggle("on", luckyGuess >= 0); // 已押高亮
  } // 结束状态更新
} // 结束 luckyGuessRender
function luckyGuessToggle(i) { // 6.2 九轮：押注 / 同格取消退款 / 换格先退旧注
  if (luckySpinning) { toast("转盘还在转，等它停稳再押～"); return; } // 转动中锁定
  if (luckyGuess === i) { luckyGuess = -1; gainMoney(1); toast("已取消押注，退回 ¥1"); luckyGuessRender(); return; } // 同格取消
  if (luckyGuess >= 0) { gainMoney(1); luckyGuess = -1; } // 换格：先退旧注
  if (balance < 1) { toast("余额不足，押注需要 ¥1"); luckyGuessRender(); return; } // 余额校验
  payMoney(1); luckyGuess = i; // 扣 ¥1 并记下押注格
  tickTone(760, 0.05, 0.05, "square", "ui"); // 押注提示音
  toast("🎯 已押「" + LUCKY_SEGS[i].label + "」，指针停在它上面返 ¥5"); // 反馈
  luckyGuessRender(); // 重绘高亮
} // 结束 luckyGuessToggle
(function initLucky() { // 自执行：按钮绑定 + 初始显示
  const btn = $("btnLuckySpin"); if (btn) { btn.addEventListener("click", luckySpin); } // 开转
  if ($("luckyCostView")) { $("luckyCostView").textContent = luckyCostBase.toFixed(2); } // 单次费用
  if ($("luckyBalView")) { $("luckyBalView").textContent = balance.toFixed(2); } // 余额
  luckyGuessRender(); // 6.2 九轮：首次渲染八格押注按钮
})(); // 结束 initLucky

// ================= 6.2 七轮：幸运骰子台（三颗 3D 骰子 · 押大/小/豹子） =================
const DICE_FACE_ORDER = [1, 6, 2, 5, 3, 4]; // BoxGeometry 六面材质顺序（+x,-x,+y,-y,+z,-z）
const DICE_TARGET_ROT = { // 各点数朝上所需的欧拉角（度 → 弧度在函数内换算）
  1: [0, 0, Math.PI / 2], // +x 面朝上（绕 z 轴 +90°）
  6: [0, 0, -Math.PI / 2], // -x 面朝上
  2: [0, 0, 0], // +y 面朝上（默认）
  5: [Math.PI, 0, 0], // -y 面朝上（翻转 180°）
  3: [-Math.PI / 2, 0, 0], // +z 面朝上
  4: [Math.PI / 2, 0, 0] // -z 面朝上
};
let diceScene = null; // 骰子台场景
let diceRolling = false; // 摇动中
let diceBet = 2; // 当前押注额
let dicePickKind = null; // 本次押注类型（big/small/triple）
function diceFaceTex(n) { // 生成单面点数贴图
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; // 画布
  const g = cv.getContext("2d"); // 上下文
  const grd = g.createLinearGradient(0, 0, 128, 128); grd.addColorStop(0, "#fffdf8"); grd.addColorStop(1, "#e6dfd0"); // 象牙白渐变
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); // 底
  g.strokeStyle = "rgba(120,100,60,.35)"; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122); // 内框
  const P = { // 六种点数布局（128 网格）
    1: [[64, 64]],
    2: [[40, 40], [88, 88]],
    3: [[40, 40], [64, 64], [88, 88]],
    4: [[40, 40], [88, 40], [40, 88], [88, 88]],
    5: [[40, 40], [88, 40], [64, 64], [40, 88], [88, 88]],
    6: [[40, 34], [88, 34], [40, 64], [88, 64], [40, 94], [88, 94]]
  }[n] || []; // 取布局
  P.forEach(function (p) { // 逐点
    const rg = g.createRadialGradient(p[0] - 3, p[1] - 3, 2, p[0], p[1], 13); // 点高光
    rg.addColorStop(0, "#5a5344"); rg.addColorStop(1, "#211d17"); // 深色点
    g.fillStyle = rg; g.beginPath(); g.arc(p[0], p[1], 13, 0, Math.PI * 2); g.fill(); // 圆点
  }); // 结束逐点
  return new THREE.CanvasTexture(cv); // 纹理
} // 结束 diceFaceTex
function diceMakeMesh() { // 造一颗骰子
  const mats = DICE_FACE_ORDER.map(function (n) { // 六面材质
    return new THREE.MeshStandardMaterial({ map: diceFaceTex(n), roughness: 0.42, metalness: 0.05 }); // 每面贴对应点数
  }); // 结束六面
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats); // 立方体骰子
} // 结束 diceMakeMesh
function diceEnsure() { // 懒建骰子台
  if (diceScene || !window.THREE || !webglOK()) { if (!diceScene) { noWebglFallback("diceStage", "🎲"); } return; } // 已建/不可用
  const stage = $("diceStage"); if (!stage) { return; } // 容器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // 渲染器
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); // 像素比
  stage.appendChild(renderer.domElement); // 挂画布
  const scene = new THREE.Scene(); // 场景
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100); camera.position.set(0, 3.4, 5.8); camera.lookAt(0, 0.35, 0); // 俯视相机
  scene.add(new THREE.AmbientLight(0xffffff, 0.9)); // 环境光
  const dir = new THREE.DirectionalLight(0xfff2cc, 1.0); dir.position.set(3, 6, 4); scene.add(dir); // 主光
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0x1e5c3a, roughness: 0.85 })); table.position.y = -0.18; scene.add(table); // 绿色赌台
  const edge = new THREE.Mesh(new THREE.TorusGeometry(3.58, 0.09, 12, 80), new THREE.MeshStandardMaterial({ color: 0xd9b25e, metalness: 0.75, roughness: 0.3 })); edge.rotation.x = Math.PI / 2; edge.position.y = -0.03; scene.add(edge); // 金边
  const dice = []; // 三颗骰子
  for (let i = 0; i < 3; i++) { // 依次创建
    const m = diceMakeMesh(); m.position.set(-1.5 + i * 1.5, 0.5, 0); scene.add(m); // 横排摆放
    dice.push({ mesh: m, mode: "idle", vy: 0, h: 0, sx: 0, sy: 0, sz: 0, t: 0, from: null, to: null, val: 2 }); // 状态句柄
  } // 结束三颗
  diceScene = { renderer: renderer, scene: scene, camera: camera, dice: dice, stage: stage, clock: new THREE.Clock() }; // 存句柄
  function resize() { // 自适应
    const w = stage.clientWidth, h = stage.clientHeight; // 实测
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); // 更新
  } // 结束 resize
  resize(); if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); } // 观察
  diceScene.loop = function () { // 渲染循环
    const dt = Math.min(0.05, diceScene.clock.getDelta()); // 帧间隔
    diceScene.dice.forEach(function (d) { // 逐颗
      if (d.mode === "roll") { // 摇动段：上抛 + 快旋
        d.vy -= 22 * dt; d.h += d.vy * dt; // 重力
        if (d.h <= 0) { d.h = 0; d.vy = Math.abs(d.vy) * 0.52; if (d.vy < 1.1) { d.vy = 1.1; } } // 落地弹跳
        d.mesh.position.y = 0.5 + d.h; // 位置
        d.mesh.rotation.x += d.sx * dt; d.mesh.rotation.y += d.sy * dt; d.mesh.rotation.z += d.sz * dt; // 快旋
      } else if (d.mode === "settle") { // 吸附段
        d.t += dt * 1000; // 累计
        const p = Math.min(1, d.t / 720); const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        d.mesh.rotation.x = d.from.x + (d.to.x - d.from.x) * e; // 三轴插值
        d.mesh.rotation.y = d.from.y + (d.to.y - d.from.y) * e;
        d.mesh.rotation.z = d.from.z + (d.to.z - d.from.z) * e;
        d.mesh.position.y = 0.5 + (d.from.y0 != null ? (1 - e) * d.from.y0 : 0); // 落地收尾
        if (p >= 1) { d.mode = "idle"; d.mesh.position.y = 0.5; } // 定格
      } // 结束吸附
    }); // 结束逐颗
    renderer.render(scene, camera); // 绘制
  }; // 结束 loop
  renderer.setAnimationLoop(diceScene.loop); // 启动
} // 结束 diceEnsure
function diceNearAngle(cur, target) { // 取与当前角最接近的等价目标角（避免绕远路）
  const TWO = Math.PI * 2; let t = target; // 起点
  while (t - cur > Math.PI) { t -= TWO; } // 拉近
  while (cur - t > Math.PI) { t += TWO; } // 拉近
  return t; // 返回
} // 结束 diceNearAngle
function diceRoll(kind) { // 摇骰（kind: big/small/triple）
  diceEnsure(); // 场景就绪
  if (diceRolling) { return; } // 防连点
  if (balance < diceBet) { toast("余额不足，先回大厅刮两张～"); return; } // 余额校验
  payMoney(diceBet); // 扣注
  diceRolling = true; dicePickKind = kind; // 标记
  if ($("diceBalView")) { $("diceBalView").textContent = balance.toFixed(2); } // 刷新余额
  $("diceResult").classList.remove("show"); // 收起旧结果
  const vals = [0, 0, 0].map(function () { return 1 + Math.floor(Math.random() * 6); }); // 开奖点数（公平随机）
  [523, 587, 659].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.06, 0.05, "square", "amb"); }, k * 70); }); // 摇骰起手音
  if (!diceScene) { setTimeout(function () { diceSettle(vals); }, 900); return; } // 无 3D 兜底
  diceScene.dice.forEach(function (d, i) { // 逐颗起摇
    d.mode = "roll"; d.vy = 6.5 + Math.random() * 2.5; d.h = 0; // 上抛
    d.sx = (6 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1); // 三轴角速度
    d.sy = (5 + Math.random() * 7) * (Math.random() < 0.5 ? -1 : 1);
    d.sz = (4 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
    d.val = vals[i]; // 记目标点数
  }); // 结束起摇
  setTimeout(function () { // 一秒后进入吸附
    if (!diceScene) { return; } // 已销毁
    diceScene.dice.forEach(function (d) { // 逐颗
      const tr = DICE_TARGET_ROT[d.val] || [0, 0, 0]; // 目标朝向
      d.mode = "settle"; d.t = 0; // 切段
      d.from = { x: d.mesh.rotation.x, y: d.mesh.rotation.y, z: d.mesh.rotation.z, y0: d.h }; // 当前值
      d.to = { // 目标值（各轴取最近等价角；6.2 八轮修正：原写在 x 轴额外 +π，等于把朝上的面翻到朝下，导致「朝上面 = 7 − 结算点数」）
        x: diceNearAngle(d.mesh.rotation.x, tr[0]), // x（严格对齐目标角，绝不再叠加半圈）
        y: diceNearAngle(d.mesh.rotation.y, tr[1]), // y
        z: diceNearAngle(d.mesh.rotation.z, tr[2]) // z
      }; // 结束目标
    }); // 结束逐颗
  }, 1000); // 1.0 秒后停
  setTimeout(function () { diceSettle(vals); }, 1780); // 1.78 秒结算（吸附 720ms 后）
} // 结束 diceRoll
function diceSettle(vals) { // 结算
  const sum = vals[0] + vals[1] + vals[2]; // 点数和
  const triple = vals[0] === vals[1] && vals[1] === vals[2]; // 是否豹子
  let win = 0, note = ""; // 奖金与说明
  if (dicePickKind === "triple") { // 押豹子
    if (triple) { win = diceBet * 30; note = "豹子 " + vals.join("-") + " · 30 倍！"; } // 中
    else { note = "不是豹子（" + vals.join("-") + " · " + sum + " 点）"; } // 未中
  } else if (triple) { // 押大小遇到豹子：通吃
    note = "开出豹子 " + vals.join("-") + " · 押大小通吃"; // 说明
  } else if (dicePickKind === "big") { // 押大
    if (sum >= 11) { win = diceBet * 1.8; note = "大 · " + sum + " 点"; } else { note = "小 · " + sum + " 点"; } // 判定
  } else { // 押小
    if (sum <= 10) { win = diceBet * 1.8; note = "小 · " + sum + " 点"; } else { note = "大 · " + sum + " 点"; } // 判定
  } // 结束判定
  win = Math.round(win * 100) / 100; // 消浮点
  const res = $("diceResult"); // 结果横幅
  if (win > 0) { // 中奖
    gainMoney(win); // 入账
    if (triple && win >= 88) { saveStub(vals.join(""), win, "dice", "豹子 " + vals.join("-")); } // 6.2 九轮：豹子大奖机打票根入册
    res.innerHTML = '<span class="grBig">🎉 ' + vals.join(" · ") + " → " + note + " 赢得 ¥" + win.toFixed(2) + "</span>"; // 文案
    if (win >= 30) { if (fxOn) { confettiBurst(70); } bigWin(win); } else if (fxOn) { confettiBurst(34); } // 演出
    [659, 784, 1046].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.1, 0.075, "triangle", "win"); }, k * 100); }); // 三连音
  } else { // 未中
    res.innerHTML = "🎲 " + vals.join(" · ") + " → " + note + " · 再摇一把？"; // 文案
    tickTone(200, 0.16, 0.055, "sawtooth", "win"); // 失落音
  } // 结束分支
  res.classList.add("show"); // 显示
  pushPlayHist("dice", diceBet, win, (dicePickKind === "big" ? "押大" : dicePickKind === "small" ? "押小" : "押豹子") + " · " + note); // 战绩
  if ($("diceBalView")) { $("diceBalView").textContent = balance.toFixed(2); } // 刷新余额
  diceRolling = false; // 解锁
} // 结束 diceSettle
(function initDice() { // 自执行：押注档位与三个投注口绑定
  const sw = $("diceBetSwitch"); // 档位组
  if (sw) { // 有节点
    sw.querySelectorAll("button").forEach(function (b) { // 逐档
      b.addEventListener("click", function () { // 切换押注额
        diceBet = +b.dataset.dbet || 2; // 记录
        sw.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); // 选中态
        if ($("diceBetView")) { $("diceBetView").textContent = diceBet.toFixed(2); } // 显示
        tickTone(660, 0.03, 0.04, "square", "amb"); // 轻响
      }); // 结束点击
    }); // 结束遍历
  } // 结束档位
  const map = { btnDiceBig: "big", btnDiceSmall: "small", btnDiceTriple: "triple" }; // 按钮 → 类型
  Object.keys(map).forEach(function (id) { // 逐按钮
    const b = $(id); if (!b) { return; } // 节点保护
    b.addEventListener("click", function () { diceRoll(map[id]); }); // 投注
  }); // 结束逐按钮
  if ($("diceBalView")) { $("diceBalView").textContent = balance.toFixed(2); } // 余额
})(); // 结束 initDice

// ================= 6.2 七轮：集字卡活动（刮票掉「刮出大奖！」五字，集齐清欠款 + ¥888） =================
const KACHA_KEY = "scratch-kacha"; // 存档键
const KACHA_CHARS = ["刮", "出", "大", "奖", "！"]; // 五个字
const KACHA_BONUS = 888; // 集齐奖金
function kachaState() { // 读取状态
  try { const o = JSON.parse(localStorage.getItem(KACHA_KEY)); if (o && o.got) { return o; } } catch (e) {} // 解析容错
  return { got: {}, total: 0, rounds: 0 }; // 默认空
} // 结束 kachaState
function kachaRender() { // 渲染五个字格
  const row = $("kachaRow"); if (!row) { return; } // 节点保护
  const st = kachaState(); // 状态
  let n = 0; // 已集字数
  row.innerHTML = KACHA_CHARS.map(function (ch) { // 逐字
    const has = !!st.got[ch]; if (has) { n++; } // 命中计数
    return '<span class="kachaCell' + (has ? " got" : "") + '"><i>' + (has ? ch : "?") + "</i>" + (has && st.got[ch] > 1 ? "<b>×" + st.got[ch] + "</b>" : "") + "</span>"; // 字格
  }).join('<span class="kachaSep">·</span>'); // 拼接（分隔点）
  const cnt = $("kachaCount"); if (cnt) { cnt.textContent = n + " / 5"; } // 计数
  const card = $("kachaCard"); if (card) { card.classList.toggle("full", n === 5); } // 集齐态高亮
} // 结束 kachaRender
function kachaDrop(t) { // 每张票揭晓时调用：35% 概率掉字牌
  if (Math.random() > 0.35) { return; } // 未掉落
  const st = kachaState(); // 状态
  const miss = KACHA_CHARS.filter(function (c) { return !st.got[c]; }); // 缺的字
  const pool = miss.length ? miss : KACHA_CHARS; // 优先补缺（集齐后随机重复）
  const ch = pool[Math.floor(Math.random() * pool.length)]; // 抽一张
  st.got[ch] = (st.got[ch] || 0) + 1; st.total = (st.total || 0) + 1; // 累加
  localStorage.setItem(KACHA_KEY, JSON.stringify(st)); // 持久化
  kachaRender(); // 刷新 UI
  const got = KACHA_CHARS.filter(function (c) { return st.got[c]; }).length; // 当前集字进度
  if (got < 5) { // 未集齐
    if (!autoScratch) { toast("🎴 集字卡：捡到「" + ch + "」字牌（" + got + "/5）"); } // 非爽刮才单独提示（防刷屏）
    else if (t && t.doneEl) { t.doneEl.textContent += " · 🎴 捡到「" + ch + "」"; } // 爽刮时并入票面说明
    tickTone(880 + got * 40, 0.05, 0.05, "triangle"); // 拾取音
  } else { // 集齐五个
    st.got = {}; st.rounds = (st.rounds || 0) + 1; // 重置开始下一轮
    localStorage.setItem(KACHA_KEY, JSON.stringify(st)); // 落盘
    const cleared = Math.round(debt * 100) / 100; // 记录清掉的欠款
    debt = 0; save(); renderBalance("gain"); // 清空欠款并刷新
    gainMoney(KACHA_BONUS); // 发放集字奖金
    kachaRender(); // 刷新（回到 0/5）
    toast("🎴 集齐「刮出大奖！」· 欠款已清 ¥" + cleared.toFixed(2) + " · 额外奖励 ¥" + KACHA_BONUS); // 提示
    if (fxOn) { confettiBurst(80); } bigWin(KACHA_BONUS); // 全屏演出
    [523, 659, 784, 1046, 1318].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.12, 0.08, "triangle", "win"); }, k * 110); }); // 上行音阶
  } // 结束集齐分支
} // 结束 kachaDrop
kachaRender(); // 启动渲染一次（页面加载即显示进度）

// ================= 6.2 七轮：桌宠打工（30 分 / 1 时 / 4 时，回来带金币与纸条） =================
const JOB_KEY = "scratch-pet-job"; // 打工存档键
const JOB_TIERS = [ // 三档时长
  { min: 30, pay: 3, label: "30 分钟" }, // 短工
  { min: 60, pay: 7, label: "1 小时" }, // 中工
  { min: 240, pay: 32, label: "4 小时" } // 长工
];
const JOB_NOTES = [ // 回来带回的小纸条（随机趣味文案）
  "「今天的风很甜，就是工资有点少。」", "「老板说我很能干，然后给了我一枚硬币。」", "「路上遇到一只猫，我们聊了很久。」",
  "「搬砖路上捡到五毛，上交了。」", "「客户说我笑起来像招财猫。」", "「偷偷在仓库睡了一觉，没人发现。」",
  "「学会了一句新口令：加钱！」", "「同事请我吃了根油条，很香。」"
];
function jobLoad() { // 读打工状态
  try { const o = JSON.parse(localStorage.getItem(JOB_KEY)); if (o && o.end) { return o; } } catch (e) {} // 容错
  return null; // 无
} // 结束 jobLoad
function jobRender() { // 渲染打工人面板
  const row = $("jobRow"), tip = $("jobTip"), badge = $("petJobBadge"); // 节点
  const j = jobLoad(); // 状态
  if (row) { // 档位按钮
    if (j) { // 打工中：禁用按钮
      row.innerHTML = JOB_TIERS.map(function (t) { return '<button disabled>' + t.label + " · ¥" + t.pay + "</button>"; }).join(""); // 灰态
    } else { // 空闲：可点
      row.innerHTML = JOB_TIERS.map(function (t, i) { return '<button data-job="' + i + '">' + t.label + " · 约 ¥" + t.pay + "</button>"; }).join(""); // 可选
      row.querySelectorAll("[data-job]").forEach(function (b) { // 绑定
        b.addEventListener("click", function () { jobStart(+b.dataset.job); }); // 开工
      }); // 结束绑定
    } // 结束分支
  } // 结束按钮
  if (j) { // 打工中显示倒计时
    const left = Math.max(0, j.end - Date.now()); // 剩余毫秒
    const mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000); // 分秒
    if (tip) { tip.textContent = "💼 打工人正在外面忙… 还需 " + mm + " 分 " + String(ss).padStart(2, "0") + " 秒"; } // 文案
    if (badge) { badge.classList.add("show"); $("petJobLeft").textContent = mm + ":" + String(ss).padStart(2, "0"); } // 舞台徽章
  } else { // 空闲
    if (tip) { tip.textContent = "派桌宠出门打工，到点回来带回金币和一张小纸条。"; } // 默认文案
    if (badge) { badge.classList.remove("show"); } // 收起徽章
  } // 结束分支
} // 结束 jobRender
function jobStart(i) { // 开始打工
  const t = JOB_TIERS[i]; if (!t) { return; } // 档位校验
  if (jobLoad()) { return; } // 已在打工
  localStorage.setItem(JOB_KEY, JSON.stringify({ end: Date.now() + t.min * 60000, pay: t.pay, label: t.label, start: Date.now() })); // 落盘
  toast("💼 桌宠出发打工啦（" + t.label + "），到点记得回来看看～"); // 提示
  tickTone(587, 0.1, 0.06, "triangle"); // 出门音
  jobRender(); // 刷新
} // 结束 jobStart
function jobTick() { // 每秒检查
  const j = jobLoad(); // 状态
  if (!j) { return; } // 未打工
  if (Date.now() >= j.end) { // 到点结算
    const pay = Math.round(j.pay * (0.75 + Math.random() * 0.6) * 100) / 100; // 实际工资（±25% 浮动）
    gainMoney(pay); // 入账
    const note = JOB_NOTES[Math.floor(Math.random() * JOB_NOTES.length)]; // 随机纸条
    localStorage.removeItem(JOB_KEY); // 清状态
    toast("💼 桌宠打工回来啦！带回 ¥" + pay.toFixed(2) + " · " + note); // 提示
    if (fxOn) { confettiBurst(22); } // 小庆祝
    tickTone(784, 0.12, 0.07, "triangle"); // 回家音
  } // 结束到点
  jobRender(); // 刷新倒计时
} // 结束 jobTick
jobRender(); // 启动渲染
setInterval(jobTick, 1000); // 每秒心跳

// ================= 6.2 七轮：新视图生命周期钩子（大转盘 / 骰子台） =================
viewHooks.enter["Lucky"] = function () { luckyEnsure(); if ($("luckyBalView")) { $("luckyBalView").textContent = balance.toFixed(2); } if (luckyScene) { luckyScene.renderer.setAnimationLoop(luckyScene.loop); } }; // 进入转盘：建场景并恢复循环
viewHooks.leave["Lucky"] = function () { if (luckyScene) { luckyScene.renderer.setAnimationLoop(null); } }; // 离开暂停
viewHooks.enter["Dice"] = function () { diceEnsure(); if ($("diceBalView")) { $("diceBalView").textContent = balance.toFixed(2); } if (diceScene) { diceScene.renderer.setAnimationLoop(diceScene.loop); } }; // 进入骰子台
viewHooks.leave["Dice"] = function () { if (diceScene) { diceScene.renderer.setAnimationLoop(null); } }; // 离开暂停

// ================= 6.2 十二轮：键盘一键操作（Tab 执行当前玩法主操作 · 1~9 切玩法 · ? 看帮助） =================
const KBD_VIEWS = [ // 九个玩法视图（顺序即数字键位，btn 为该玩法的主操作按钮）
  { key: "Shop", label: "商店", btn: "btnHappy" }, // 1 商店：Tab = 一键爽刮（买票并自动刮完）
  { key: "Wheel", label: "抽卡", btn: "btnRandom" }, // 2 抽卡页：Tab = 随机抽一张
  { key: "Scratch", label: "刮擦", btn: "btnScratchAll" }, // 3 刮擦页：Tab = 一键刮开
  { key: "Slot", label: "老虎机", btn: "btnSlotSpin" }, // 4 老虎机：Tab = 摇一把
  { key: "Gacha", label: "扭蛋", btn: "btnGachaTurn" }, // 5 扭蛋：Tab = 扭一颗
  { key: "Claw", label: "娃娃机", btn: "btnClawDrop" }, // 6 娃娃机：Tab = 下爪
  { key: "Lucky", label: "大转盘", btn: "btnLuckySpin" }, // 7 大转盘：Tab = 转一次
  { key: "Dice", label: "骰子台", btn: "btnDiceBig" }, // 8 骰子台：Tab = 沿用上次押注掷一把
  { key: "Mahjong", label: "麻将", btn: "" } // 9 麻将：Tab = 执行首个可用动作（开局 / 自摸 / 碰杠…）
]; // 结束玩法视图表
let kbdTipAt = 0; // 上次提示时间戳（防止连按刷屏）
function kbdViewNow() { // 读取当前显示的视图名（去掉 view 前缀）
  const v = document.querySelector(".view.show"); // 当前显示的视图节点
  return v && v.id ? v.id.replace(/^view/, "") : ""; // 返回 Shop/Wheel/Slot… 等
} // 结束 kbdViewNow
function kbdTip(msg) { // 快捷键轻提示（复用全局 toast，带 260ms 节流）
  const now = Date.now(); // 当前时间
  if (now - kbdTipAt < 260) { return; } // 节流窗口内直接返回
  kbdTipAt = now; // 记录本次时间
  if (typeof toast === "function") { toast(msg); } // 弹出提示
} // 结束 kbdTip
function kbdHit(el) { // 给被替代的按钮一次按压脉冲（让用户看见快捷键点到了谁）
  if (!el || !el.classList) { return; } // 节点保护
  el.classList.remove("kbdHit"); // 先移除，保证动画可重播
  void el.offsetWidth; // 强制回流以重启 CSS 动画
  el.classList.add("kbdHit"); // 播放按压 + 金色脉冲
  setTimeout(function () { el.classList.remove("kbdHit"); }, 340); // 动画结束后清理
} // 结束 kbdHit
function kbdBusy() { // 是否应放行默认键盘行为（输入框内 / 管理员密码弹窗）
  const a = document.activeElement; // 当前焦点元素
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) { return true; } // 输入中不劫持
  if (document.querySelector("#pwdMask.show")) { return true; } // 密码弹窗期间不响应
  if (document.querySelector("#rcptMask.show")) { return true; } // 6.2 十五轮：机打小票展示期间不响应
  return false; // 允许响应
} // 结束 kbdBusy
function kbdVisible(el) { // 元素是否有布局尺寸（判断「一键刮开」是否已出现）
  if (!el) { return false; } // 不存在
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); // 有尺寸即视为可见
} // 结束 kbdVisible
function kbdAction() { // Tab 主操作分派：严格按当前视图执行，绝不跨玩法误触
  const view = kbdViewNow(); // 当前视图名
  if (view === "Shop") { // 商店页 → 一键爽刮
    const b = $("btnHappy"); // 主操作按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 一键爽刮（买票并自动刮完）"); } // 点击并提示
    return; // 结束
  } // 结束商店
  if (view === "Wheel") { // 抽卡页 → 随机抽一张
    const b = $("btnRandom"); // 主操作按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 随机抽一张"); } // 点击并提示
    return; // 结束
  } // 结束抽卡
  if (view === "Scratch") { // 刮擦页 → 一键刮开全部
    const b = $("btnScratchAll"); // 一键刮开按钮（展开票后才显示）
    if (!kbdVisible(b)) { kbdTip("⌨ Tab · 先在抽卡页抽一张票上台，再按 Tab 一键刮开"); return; } // 未就绪提示
    kbdHit(b); b.click(); kbdTip("⌨ Tab · 一键刮开"); // 点击并提示
    return; // 结束
  } // 结束刮擦
  if (view === "Slot") { // 老虎机 → 摇一把
    const b = $("btnSlotSpin"); // 拉杆按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 摇老虎机"); } // 点击并提示
    return; // 结束
  } // 结束老虎机
  if (view === "Gacha") { // 扭蛋 → 扭一颗
    const b = $("btnGachaTurn"); // 投币按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 扭一颗蛋"); } // 点击并提示
    return; // 结束
  } // 结束扭蛋
  if (view === "Claw") { // 娃娃机 → 下爪
    const b = $("btnClawDrop"); // 下爪按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 下爪"); } // 点击并提示
    return; // 结束
  } // 结束娃娃机
  if (view === "Lucky") { // 大转盘 → 转一次
    const b = $("btnLuckySpin"); // 开转按钮
    if (b) { kbdHit(b); b.click(); kbdTip("⌨ Tab · 转动大转盘"); } // 点击并提示
    return; // 结束
  } // 结束大转盘
  if (view === "Mahjong") { // 麻将 → 执行操作区首个可用按钮（开局 / 自摸 / 立直 / 碰 / 跳过）
    const box = $("mjActions"); // 操作区
    const first = box && box.querySelector("button"); // 首个按钮
    if (first) { kbdHit(first); first.click(); kbdTip("⌨ Tab · " + first.textContent); } // 执行
    else { kbdTip("⌨ 点击手牌出牌"); } // 无可用动作时提示
    return; // 结束
  } // 结束麻将
  if (view === "Dice") { // 骰子台 → 沿用上次押注类型掷一把
    const kind = dicePickKind || "big"; // 上次押注类型（首次默认押大）
    const map = { big: "btnDiceBig", small: "btnDiceSmall", triple: "btnDiceTriple" }; // 类型 → 按钮 id
    const b = $(map[kind]); // 对应押注按钮
    if (b) { kbdHit(b); } // 高亮提示押的是哪一档
    diceRoll(kind); // 直接掷骰（内部含余额校验与防重入）
    kbdTip("⌨ Tab · 掷骰子（" + (kind === "big" ? "押大" : kind === "small" ? "押小" : "押豹子") + "）"); // 提示押注类型
  } // 结束骰子
} // 结束 kbdAction
document.addEventListener("keydown", function (e) { // 全局快捷键监听
  if (e.ctrlKey || e.altKey || e.metaKey) { return; } // 组合键一律放行（Ctrl+Tab / Alt+Tab 等系统操作）
  if (kbdBusy()) { return; } // 输入框内或密码弹窗时保留默认行为
  if (e.key === "Tab") { // Tab：一键执行当前玩法主操作
    if (e.shiftKey) { return; } // Shift+Tab 保留默认反向焦点导航
    const view = kbdViewNow(); // 当前视图
    const inGame = KBD_VIEWS.some(function (v) { return v.key === view; }); // 是否位于八个玩法视图之一
    if (!inGame) { return; } // 历史/大厅/设置/桌宠页保留默认 Tab 导航
    e.preventDefault(); // 阻止焦点跳到下一个控件
    if (e.repeat) { return; } // 长按不连发
    kbdAction(); // 执行主操作
    return; // 结束
  } // 结束 Tab
  if (e.key === "?" || (e.key === "/" && e.shiftKey)) { // ? 查看快捷键帮助
    e.preventDefault(); // 阻止浏览器快速查找
    kbdTip("⌨ Tab=一键操作 · 1~9=切玩法 · M=静音 · ?=本提示"); // 帮助文案
    return; // 结束
  } // 结束帮助
  const code = e.key.length === 1 ? e.key.charCodeAt(0) - 48 : -1; // 数字键 1~9
  if (code >= 1 && code <= KBD_VIEWS.length && !e.shiftKey) { // 命中数字且未按 Shift
    e.preventDefault(); // 阻止数字输入
    showView(KBD_VIEWS[code - 1].key); // 直接切到对应玩法
    kbdTip("⌨ " + code + " · " + KBD_VIEWS[code - 1].label); // 提示当前玩法
  } // 结束数字键
}); // 结束快捷键监听
(function kbdFirstTip() { // 首次使用时提示一次快捷键（记住后不再打扰）
  try { if (localStorage.getItem("scratch-kbd-tip") === "1") { return; } } catch (e) { return; } // 已提示过或存储不可用
  setTimeout(function () { // 等首页渲染稳定
    try { localStorage.setItem("scratch-kbd-tip", "1"); } catch (e) {} // 写入标记
    kbdTip("⌨ 快捷键：Tab＝当前玩法一键操作 · 1~9＝切玩法 · ?＝帮助"); // 首次说明
  }, 3600); // 3.6 秒后弹出
})(); // 结束首启提示

// ================= 6.2 十三轮：道具商店（透视道具）+ 彩票 95% 转让 + 每日救济券 =================
/* ---------- 存储键与状态 ---------- */
const ITEM_BAG_KEY = "scratch-item-bag"; // 道具库存（手电筒充电次数 / 紫外灯 / 硬币）
const ITEM_XRAY_KEY = "scratch-xray"; // 本批透视记录：{ amt:{票号:1}, hint:{票号:1} }
const ITEM_SOLD_KEY = "scratch-sold"; // 本批转让记录：{ 票号: 回收金额 }
const RELIEF_CFG_KEY = "scratch-relief-cfg"; // 救济券配置（管理员可调）
const RELIEF_ST_KEY = "scratch-relief"; // 救济券使用记录（日期 + 已用次数）
const ITEM_SELL_RATE = 0.95; // 票据转让回收比例（票面 95%，用户指定）
let itemBag = { torch: 0, uv: 0, coin: 0 }; // 三种道具的库存（护身符已下线，旧存档里的键自动忽略）
let itemXray = { amt: {}, hint: {} }; // 透视记录（金额级 / 有无级）
let itemSold = {}; // 转让记录（票号 → 回收金额，用于刷新后重绘）
let reliefCfg = { perDay: 1, thresh: 5, target: 30 }; // 救济券：每日次数 / 触发阈值 / 补给金额
let reliefSt = { date: "", used: 0 }; // 救济券：当日日期与已用次数

/* ---------- 读写（损坏即回退默认，绝不抛错） ---------- */
function itemInt(v, dft) { const n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : dft; } // 非负整数清洗
function itemNum(v, dft) { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : dft; } // 非负小数清洗
function itemLoad() { // 启动读取全部道具/救济相关存档
  try { const b = JSON.parse(localStorage.getItem(ITEM_BAG_KEY)); if (b && typeof b === "object") { ["torch", "uv", "coin"].forEach(function (k) { itemBag[k] = itemInt(b[k], 0); }); } } catch (e) {} // 库存
  try { const x = JSON.parse(localStorage.getItem(ITEM_XRAY_KEY)); if (x && typeof x === "object") { itemXray.amt = x.amt && typeof x.amt === "object" ? x.amt : {}; itemXray.hint = x.hint && typeof x.hint === "object" ? x.hint : {}; } } catch (e) {} // 透视
  try { const s = JSON.parse(localStorage.getItem(ITEM_SOLD_KEY)); if (s && typeof s === "object") { itemSold = s; } } catch (e) {} // 转让
  try { const c = JSON.parse(localStorage.getItem(RELIEF_CFG_KEY)); if (c && typeof c === "object") { reliefCfg.perDay = Math.min(99, itemInt(c.perDay, 1)); reliefCfg.thresh = itemNum(c.thresh, 5); reliefCfg.target = Math.max(1, itemNum(c.target, 30)); } } catch (e) {} // 救济配置
  try { const r = JSON.parse(localStorage.getItem(RELIEF_ST_KEY)); if (r && typeof r === "object") { reliefSt.date = String(r.date || ""); reliefSt.used = itemInt(r.used, 0); } } catch (e) {} // 救济记录
} // 结束 itemLoad
function itemSaveBag() { try { localStorage.setItem(ITEM_BAG_KEY, JSON.stringify(itemBag)); } catch (e) {} } // 库存落盘
function itemSaveXray() { try { localStorage.setItem(ITEM_XRAY_KEY, JSON.stringify(itemXray)); } catch (e) {} } // 透视落盘
function itemSaveSold() { try { localStorage.setItem(ITEM_SOLD_KEY, JSON.stringify(itemSold)); } catch (e) {} } // 转让落盘
function reliefSaveCfg() { try { localStorage.setItem(RELIEF_CFG_KEY, JSON.stringify(reliefCfg)); } catch (e) {} } // 救济配置落盘
function reliefSaveSt() { try { localStorage.setItem(RELIEF_ST_KEY, JSON.stringify(reliefSt)); } catch (e) {} } // 救济记录落盘
itemLoad(); // 立即读取

/* ---------- 线条图标与道具定义 ---------- */
function itemSvg(inner) { return '<svg class="icoSvg itemIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; } // 生成一条线条图标
const ITEM_ICONS = { // 三件道具的图形（全部线条，无外部资源）
  torch: itemSvg('<path d="M9.2 3.4h5.6l1.3 3.1a3 3 0 0 1 .2 1.1v3.9H7.7V7.6a3 3 0 0 1 .2-1.1z"/><path d="M7.7 11.5h8.6v2.2H7.7z"/><path d="M9.6 13.7l-.8 6.1a1.3 1.3 0 0 0 1.3 1.5h4.4a1.3 1.3 0 0 0 1.3-1.5l-.8-6.1"/><path d="M10.9 6.6h2.2"/>'), // 手电筒：筒身 + 光杯 + 手柄
  uv: itemSvg('<path d="M12 2.8v3M4.4 6l2.2 2.2M19.6 6l-2.2 2.2M2.4 13.6h3M18.6 13.6h3"/><path d="M7.9 11.6h8.2l1 5.9a2.7 2.7 0 0 1-2.7 3.1H9.6a2.7 2.7 0 0 1-2.7-3.1z"/><path d="M9.4 15.4h5.2"/>'), // 紫外灯：灯管 + 四散光线
  coin: itemSvg('<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="3.3"/><path d="M12 5.3v1.5M12 17.2v1.5M5.3 12h1.5M17.2 12h1.5"/>'), // 幸运硬币：双环 + 刻度
}; // 结束图标表
const ITEM_DEF = [ // 三件道具（rate = 按当前票价的比例定价，用户指定手电筒 60%）
  { id: "torch", name: "手电筒", rate: 0.6, tag: "看金额", desc: "照一张未刮票的涂层下面：金额一照就知道。买一次＝一次充电，到刮奖页点票面「照一张」使用。" }, // 60% 票价 / 次
  { id: "uv", name: "紫外灯", rate: 0.25, tag: "看有无", desc: "本批全部未刮票标出「有奖 / 空票」，只说有没有、不说有多少；批量验票的便宜方案。" }, // 25% 票价
  { id: "coin", name: "幸运硬币", rate: 2, tag: "赌一把", desc: "随机挑本批一张未刮票重掷奖额：可能翻出大奖，也可能变空；手气背时用来换命。" }, // 200% 票价
]; // 结束道具表

/* ---------- 道具商店渲染 ---------- */
function itemPrice(it) { const base = TIERS[tierIdx] ? TIERS[tierIdx].price : 2; return Math.round(base * it.rate * 100) / 100; } // 按当前价位算价
function itemStateText() { // 商店标题右侧的本批状态
  if (!batch || !batch.length) { return itemBag.torch + itemBag.uv + itemBag.coin > 0 ? "背包有货 · 进刮奖页自动生效" : "暂无武装 · 买一件试试水"; } // 无批次
  const amtN = Object.keys(itemXray.amt).length, hintN = Object.keys(itemXray.hint).length; // 已透视张数
  const parts = []; // 片段
  if (amtN) { parts.push("已透视 " + amtN + " 张"); } // 金额级
  if (hintN) { parts.push("已标记 " + hintN + " 张"); } // 有无级
  if (itemBag.torch) { parts.push("手电余 " + itemBag.torch + " 次"); } // 手电余量
  return parts.length ? "本批：" + parts.join(" · ") : "本批未用道具"; // 合成文案
} // 结束 itemStateText
function itemRender() { // 渲染道具商店（价格随价位、库存随购买）
  const grid = $("itemGrid"); if (!grid) { return; } // 保护
  grid.innerHTML = ITEM_DEF.map(function (it) { // 逐件生成卡片
    const price = itemPrice(it); // 当前价
    const afford = balance >= price; // 买得起
    const owned = itemBag[it.id] || 0; // 库存
    return '<div class="itemCard">' + // 卡片
      '<div class="icTop">' + ITEM_ICONS[it.id] + '<h4>' + it.name + '</h4><span class="itag">' + it.tag + '</span><span class="iprice">¥' + price.toFixed(2) + '</span></div>' + // 图标 + 名 + 标 + 价
      '<p>' + it.desc + '</p>' + // 说明
      '<button class="buyItem' + (afford ? '' : ' poor') + '" data-item="' + it.id + '"' + (afford ? '' : ' disabled') + '>' + (afford ? '买入 ¥' + price.toFixed(2) : '余额差 ¥' + (price - balance).toFixed(2)) + (owned > 0 ? ' · 持有 ' + owned : '') + '</button>' + // 购买按钮
    '</div>'; // 结束卡片
  }).join(""); // 拼接
  const bag = $("itemBag"); // 背包行
  if (bag) { // 有容器才渲染
    const chips = []; // 片段
    if (itemBag.torch) { chips.push('<span class="bagChip">🔦 手电筒 ×' + itemBag.torch + '</span>'); } // 手电
    if (itemBag.uv) { chips.push('<span class="bagChip">🔮 紫外灯 ×' + itemBag.uv + '</span>'); } // 紫外
    if (itemBag.coin) { chips.push('<span class="bagChip">🪙 硬币 ×' + itemBag.coin + '</span>'); } // 硬币
    bag.innerHTML = chips.length ? chips.join("") : '<span class="bagEmpty">背包空空的 · 道具买下后进入刮奖页自动生效</span>'; // 空态提示
  } // 结束背包
  const st = $("itemShopState"); if (st) { st.textContent = itemStateText(); } // 状态文案
} // 结束 itemRender
$("itemGrid") && $("itemGrid").addEventListener("click", function (e) { // 委托：点击买入
  const b = e.target && e.target.closest ? e.target.closest(".buyItem") : null; // 目标按钮
  if (!b || b.disabled) { return; } // 非按钮或禁用
  itemBuy(b.dataset.item); // 购买
}); // 结束委托
document.addEventListener("click", function (e) { // 价位切换后刷新道具价格（捕获阶段，先于其它回调排队）
  const el = e.target && e.target.closest ? e.target.closest("#tswitch .tlabel") : null; // 价位标签
  if (el) { setTimeout(itemRender, 90); } // 等价位状态落定再重算
}, true); // 捕获阶段监听

/* ---------- 购买 ---------- */
function itemBuy(id) { // 买一件道具
  const it = ITEM_DEF.filter(function (x) { return x.id === id; })[0]; // 找定义
  if (!it) { return; } // 未知道具
  const cost = itemPrice(it); // 当前价
  if (balance < cost) { toast("余额不足：" + it.name + " 需 ¥" + cost.toFixed(2) + "，先攒一点再来"); return; } // 余额校验
  payMoney(cost); // 扣款（含存档与滚轮动画）
  itemBag[id] = (itemBag[id] || 0) + 1; // 入库
  itemSaveBag(); // 落盘
  itemRender(); // 刷新商店
  tickTone(760, 0.07, 0.05, "triangle", "ui"); // 购买音
  toast("已购入 " + it.name + " ¥" + cost.toFixed(2) + (id === "torch" ? " · 到刮奖页点票面「照一张」" : " · 进入刮奖页自动生效")); // 提示
  itemApplyBatch(); // 已有在刮的批次：立即生效
} // 结束 itemBuy

/* ---------- 透视与批次装饰 ---------- */
function itemPaint(t) { // 给单张票补透视层与状态文案
  if (!t || !t.card || !t.card.querySelector) { return; } // 保护
  const zone = t.card.querySelector(".szone"); if (!zone) { return; } // 无刮区
  let xr = zone.querySelector(".xr"); // 已有透视层
  if (!xr) { xr = document.createElement("div"); xr.className = "xr off"; zone.appendChild(xr); } // 新建
  const sold = !!itemSold[t.no]; // 已转让
  const byAmt = !t.revealed && !!itemXray.amt[t.no]; // 金额级透视
  const byHint = !t.revealed && !!itemXray.hint[t.no]; // 有无级透视
  if (byAmt) { xr.className = "xr amt"; xr.textContent = (+t.prize > 0 ? "¥" + (+t.prize).toFixed(2) : "空票"); } // 显示真实金额
  else if (byHint) { xr.className = "xr hint " + (+t.prize > 0 ? "win" : "lose"); xr.textContent = +t.prize > 0 ? "有奖" : "空票"; } // 只显示有无
  else if (sold) { xr.className = "xr sold"; xr.textContent = "已转让 ¥" + (+itemSold[t.no]).toFixed(2); } // 转让水印
  else { xr.className = "xr off"; xr.textContent = ""; } // 不显示
  if (sold) { // 刷新后恢复：把"未中奖"改回转让文案
    t.card.classList.add("sold"); // 卡片置灰
    if (t.amtEl) { t.amtEl.textContent = "已转让"; t.amtEl.classList.remove("big"); } // 金额位
    if (t.doneEl) { t.doneEl.textContent = "↩ 已按 95% 转让 · 回收 ¥" + (+itemSold[t.no]).toFixed(2); } // 结果位
  } // 结束转让态
} // 结束 itemPaint
function itemOps(t) { // 给单张票加操作条（照一张 / 转让）
  if (!t || !t.card || !t.card.querySelector) { return; } // 保护
  let ops = t.card.querySelector(".scardOps"); // 操作条
  if (!ops) { // 没有则建
    ops = document.createElement("div"); ops.className = "scardOps"; // 容器
    ops.addEventListener("click", function (e) { e.stopPropagation(); }); // 阻止冒泡到卡片（避免顺带顶票）
    t.card.appendChild(ops); // 挂在票底
  } // 结束新建
  ops.innerHTML = ""; // 清空重建
  if (t.revealed) { ops.style.display = "none"; return; } // 已结算：整条隐藏
  ops.style.display = "flex"; // 显示
  if (itemBag.torch > 0 && !itemXray.amt[t.no]) { // 有手电且这张还没照
    const b = document.createElement("button"); b.className = "opTorch"; b.textContent = "🔦 照一张（剩 " + itemBag.torch + "）"; // 照亮按钮
    b.addEventListener("click", function (e) { e.stopPropagation(); itemTorch(t); }); // 绑定
    ops.appendChild(b); // 上条
  } // 结束手电按钮
  const s = document.createElement("button"); s.className = "opSell"; s.textContent = "↩ 转让 ¥" + (t.price * ITEM_SELL_RATE).toFixed(2); // 转让按钮
  s.addEventListener("click", function (e) { e.stopPropagation(); itemSell(t); }); // 绑定
  ops.appendChild(s); // 上条
} // 结束 itemOps
function itemTorch(t) { // 用手电筒照一张（消耗一次充电）
  if (itemBag.torch <= 0) { toast("手电筒没电了，去大厅道具商店再买一个"); return; } // 无电
  if (!t || t.revealed || itemSold[t.no]) { return; } // 已结算
  itemBag.torch -= 1; itemSaveBag(); // 扣一次充电
  itemXray.amt[t.no] = 1; itemSaveXray(); // 记录透视
  itemPaint(t); itemOps(t); itemRender(); itemRefreshSellAll(); // 重绘
  tickTone(920, 0.08, 0.05, "triangle", "ui"); // 手电音
  toast("🔦 No." + padNo(t.no) + "：" + (+t.prize > 0 ? "¥" + (+t.prize).toFixed(2) : "空票") + "（可以决定刮开还是按 95% 转让）"); // 结果提示
} // 结束 itemTorch
function itemSell(t, silent) { // 按票面 95% 转让一张未刮票
  if (!t || t.revealed || itemSold[t.no]) { return 0; } // 不可转让
  const back = Math.round(t.price * ITEM_SELL_RATE * 100) / 100; // 回收额
  t.sold = true; t.revealed = true; t.prize = 0; // 标记已结算（同时让"全刮完"判定正常推进）
  itemSold[t.no] = back; itemSaveSold(); // 落盘
  balance = Math.round((balance + back) * 100) / 100; // 直接进余额（不计入"累计刮出"）
  save(); renderBalance("gain"); floatDelta(back, "gain"); // 存档 + 数字滚动 + 飘字
  itemPaint(t); itemOps(t); // 重绘这张
  saveBatch("scratch"); // 票据状态落盘（退出重进不会复活成未刮票）
  updateScratchInfo(); // 刷新进度（可能触发本批结束）
  itemRefreshSellAll(); itemRender(); // 刷新批量按钮与商店状态
  if (!silent) { tickTone(560, 0.08, 0.05, "triangle", "ui"); toast("↩ 已转让 No." + padNo(t.no) + " · 回收 ¥" + back.toFixed(2)); } // 提示
  return back; // 返回回收额
} // 结束 itemSell
function itemSellable() { // 本批"已识别为空的未刮票"
  return (batch || []).filter(function (t) { return !t.revealed && !itemSold[t.no] && +t.prize === 0 && (itemXray.amt[t.no] || itemXray.hint[t.no]); }); // 需先透视过
} // 结束 itemSellable
function itemSellAllEmpty() { // 一键转让全部已识别的空票
  const list = itemSellable(); // 候选
  if (!list.length) { toast("没有已识别的空票：先用紫外灯或手电筒照一下"); return; } // 无候选
  let sum = 0; // 合计
  list.forEach(function (t) { sum += itemSell(t, true); }); // 逐张转让（静默）
  toast("↩ 已转让 " + list.length + " 张空票 · 共回收 ¥" + sum.toFixed(2)); // 汇总提示
} // 结束 itemSellAllEmpty
function itemRefreshSellAll() { // 刷新"转让全部空票"按钮
  const anchor = $("btnScratchAll"); // 一键刮开按钮
  if (!anchor || !anchor.parentNode) { return; } // 无锚点
  let b = $("btnSellEmpty"); // 已有按钮
  if (!b) { // 新建一次
    b = document.createElement("button"); b.id = "btnSellEmpty"; b.className = "sellEmptyBtn"; // 元素
    b.addEventListener("click", itemSellAllEmpty); // 绑定
    anchor.parentNode.insertBefore(b, anchor); // 插在一键刮开之前
  } // 结束新建
  const n = itemSellable().length; // 可卖张数
  b.style.display = n > 0 ? "inline-block" : "none"; // 无候选时隐藏
  b.textContent = "↩ 转让 " + n + " 张空票"; // 文案
} // 结束 itemRefreshSellAll
function itemApplyBatch(force) { // 应用袋中"批次类"道具（硬币 → 紫外灯）
  if (!batch || !batch.length) { itemRender(); return; } // 无批次：留在袋里等下一批
  const left = function () { return batch.filter(function (t) { return !t.revealed && !itemSold[t.no]; }); }; // 未刮集合
  if (itemBag.coin > 0 && left().length) { // 硬币：随机重掷一张未刮票
    const pool = left(); // 候选（全部未刮票）
    const t = pool[Math.floor(Math.random() * pool.length)]; // 随机一张
    t.prize = pickPrize(tierIdx, merchantIdx); // 重掷奖额
    itemBag.coin -= 1; itemSaveBag(); // 消耗
    itemPaint(t); // 重绘（若已透视则金额同步刷新）
    toast("🪙 硬币重掷：No." + padNo(t.no) + " → " + (+t.prize > 0 ? "¥" + (+t.prize).toFixed(2) : "空票")); // 提示
  } // 结束硬币
  if (itemBag.uv > 0 && left().length) { // 紫外灯：本批标记有无奖
    const pool = left(); // 未刮集合
    pool.forEach(function (t) { itemXray.hint[t.no] = 1; }); // 全部标记
    itemBag.uv -= 1; itemSaveBag(); itemSaveXray(); // 消耗并落盘
    pool.forEach(itemPaint); // 逐张重绘
    toast("🔮 紫外灯：本批 " + pool.length + " 张已标出有奖 / 空票"); // 提示
  } // 结束紫外灯
  itemRefreshSellAll(); itemRender(); // 刷新按钮与商店
} // 结束 itemApplyBatch
function itemAfterPile() { // 刮奖页铺好票后的统一装饰钩子
  if (!batch || !batch.length) { itemRender(); return; } // 无批次
  itemApplyBatch(true); // 先消费袋中批次道具（可能改写奖额）
  batch.forEach(function (t) { itemPaint(t); itemOps(t); }); // 逐张补透视层与操作条
  itemRefreshSellAll(); // 批量转让按钮
  itemRender(); // 商店状态
} // 结束 itemAfterPile
function itemResetBatch() { // 批次结束：清空本批透视与转让记录
  itemXray = { amt: {}, hint: {} }; itemSold = {}; // 复位内存
  itemSaveXray(); itemSaveSold(); // 复位存档
  itemRefreshSellAll(); // 隐藏批量按钮
} // 结束 itemResetBatch

/* ---------- 接管批次构建与结束（不改基线源码，只挂后置钩子） ---------- */
const __itemBuildPile = buildPile; // 保存原实现
buildPile = function () { // 铺票：原逻辑 + 道具装饰
  __itemBuildPile.apply(this, arguments); // 先跑原逻辑（含恢复场景）
  try { itemAfterPile(); } catch (e) {} // 后置钩子（出错不影响主流程）
}; // 结束接管
const __itemClearBatch = clearBatch; // 保存原实现
clearBatch = function () { // 清批：原逻辑 + 清空本批道具记录
  __itemClearBatch.apply(this, arguments); // 先跑原逻辑
  try { itemResetBatch(); } catch (e) {} // 后置清理
}; // 结束接管
const __itemUpdateInfo = updateScratchInfo; // 保存原实现
updateScratchInfo = function () { // 进度文案：追加"已转让"计数（卖票也算已结算）
  __itemUpdateInfo.apply(this, arguments); // 先跑原逻辑
  try { // 追加后缀
    const n = (batch || []).filter(function (t) { return !!itemSold[t.no]; }).length; // 已转让张数
    if (n > 0 && $("scratchInfo")) { $("scratchInfo").textContent += " · ↩ 已转让 " + n + " 张"; } // 追加
  } catch (e) {} // 静默
}; // 结束接管
const __itemAdminExt = openAdminExt; // 保存原实现
openAdminExt = function () { // 打开高级设置：追加救济券配置回填
  __itemAdminExt.apply(this, arguments); // 先跑原逻辑
  try { renderReliefCfg(); } catch (e) {} // 后置回填
}; // 结束接管

/* ---------- 每日救济券 ---------- */
function reliefToday() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); } // 今日日期串（本地时区）
function reliefSync() { // 跨自然日自动重置
  const today = reliefToday(); // 今天
  if (reliefSt.date !== today) { reliefSt.date = today; reliefSt.used = 0; reliefSaveSt(); } // 换天清零
} // 结束 reliefSync
function reliefLeft() { reliefSync(); return Math.max(0, (reliefCfg.perDay | 0) - (reliefSt.used | 0)); } // 今日剩余次数
function reliefCanTake() { return reliefCfg.perDay > 0 && reliefLeft() > 0 && balance < reliefCfg.thresh; } // 是否可领
function reliefTake() { // 领取救济券
  reliefSync(); // 先校准日期
  if (reliefCfg.perDay <= 0) { toast("救济券已被管理员关闭"); return; } // 已关闭
  if (reliefLeft() <= 0) { toast("今日救济券已用完（每日 " + reliefCfg.perDay + " 次，明天 0 点重置）"); return; } // 次数用尽
  if (balance >= reliefCfg.thresh) { toast("当前余额 ¥" + balance.toFixed(2) + " 不低于 ¥" + reliefCfg.thresh.toFixed(2) + "，还不能领救济"); return; } // 余额尚可
  balance = Math.round(reliefCfg.target * 100) / 100; // 一次性补到目标余额（不是加钱）
  reliefSt.used += 1; reliefSaveSt(); // 记一次
  save(); renderBalance("gain"); // 存档 + 滚动
  tickTone(680, 0.1, 0.07, "triangle", "win"); setTimeout(function () { tickTone(900, 0.12, 0.07, "triangle", "win"); }, 110); // 两声上行音
  toast("🆘 救济券到账：余额补到 ¥" + balance.toFixed(2) + " · 今日还剩 " + reliefLeft() + " 次"); // 提示
  renderRelief(); // 刷新面板
} // 结束 reliefTake
function renderRelief() { // 设置页救济面板渲染
  const btn = $("btnRelief"); if (!btn) { return; } // 保护
  reliefSync(); // 校准日期
  const left = reliefLeft(), can = reliefCanTake(); // 余量与可用性
  const desc = $("reliefDesc"); // 说明文字
  if (desc) { desc.innerHTML = "余额低于 ¥<b>" + reliefCfg.thresh.toFixed(2) + "</b> 时可领取一张救济券，一次性把余额补到 ¥<b>" + reliefCfg.target.toFixed(2) + "</b>；每日 <b>" + reliefCfg.perDay + "</b> 次，自然日 0 点重置。"; } // 动态规则
  btn.disabled = !can; // 按钮可用性
  btn.textContent = reliefCfg.perDay <= 0 ? "🎟 救济券已关闭" : (left <= 0 ? "🎟 今日已领完" : (balance >= reliefCfg.thresh ? "🎟 余额充足 · 暂不可领" : "🎟 领取救济券（补到 ¥" + reliefCfg.target.toFixed(0) + "）")); // 按钮文案
  const st = $("reliefState"); // 状态
  if (st) { st.textContent = "今日剩余 " + left + " / " + reliefCfg.perDay + " 次 · 当前余额 ¥" + balance.toFixed(2); } // 状态文案
  const dots = $("reliefDots"); // 次数灯
  if (dots) { // 有容器才画
    dots.innerHTML = ""; // 清空
    const total = Math.min(12, Math.max(1, reliefCfg.perDay)); // 最多画 12 颗
    for (let i = 0; i < total; i++) { const d = document.createElement("i"); d.className = "rdot" + (i < reliefSt.used ? " used" : ""); dots.appendChild(d); } // 逐颗
  } // 结束指示灯
} // 结束 renderRelief
$("btnRelief") && $("btnRelief").addEventListener("click", reliefTake); // 领取绑定
function renderReliefCfg() { // 管理员救济配置回填
  const t = $("admReliefTimes"); if (!t) { return; } // 保护
  t.value = reliefCfg.perDay; // 次数
  $("admReliefThresh").value = reliefCfg.thresh; // 阈值
  $("admReliefAmt").value = reliefCfg.target; // 补给金额
  reliefSync(); // 校准日期
  $("admReliefUsed").textContent = reliefSt.used; // 今日已用
} // 结束 renderReliefCfg
$("admReliefSet") && $("admReliefSet").addEventListener("click", function () { // 保存救济配置
  reliefCfg.perDay = Math.max(0, Math.min(99, Math.round(cfgNum($("admReliefTimes").value, 0, 1)))); // 每日次数（0 = 关闭）
  reliefCfg.thresh = Math.max(0, cfgNum($("admReliefThresh").value, 0, 5)); // 触发阈值
  reliefCfg.target = Math.max(1, cfgNum($("admReliefAmt").value, 1, 30)); // 补给金额
  reliefSaveCfg(); // 落盘
  renderReliefCfg(); renderRelief(); // 双向刷新
  toast("救济券：每日 " + reliefCfg.perDay + " 次 · 余额低于 ¥" + reliefCfg.thresh.toFixed(2) + " 可领 · 补到 ¥" + reliefCfg.target.toFixed(2)); // 提示
}); // 结束保存
$("admReliefReset") && $("admReliefReset").addEventListener("click", function () { // 重置今日次数
  reliefSync(); reliefSt.used = 0; reliefSaveSt(); // 清零
  renderReliefCfg(); renderRelief(); // 刷新
  toast("今日救济次数已重置"); // 提示
}); // 结束重置

/* ---------- 视图钩子与首帧 ---------- */
(function itemHooks() { // 进入商店/设置时刷新对应面板
  const oldShop = viewHooks.enter["Shop"]; // 原商店钩子
  viewHooks.enter["Shop"] = function () { if (oldShop) { try { oldShop(); } catch (e) {} } itemRender(); }; // 商店：刷新道具价格与库存
  const oldSet = viewHooks.enter["Settings"]; // 原设置钩子
  viewHooks.enter["Settings"] = function () { if (oldSet) { try { oldSet(); } catch (e) {} } renderRelief(); }; // 设置：刷新救济面板
  const oldScratch = viewHooks.enter["Scratch"]; // 原刮奖钩子
  viewHooks.enter["Scratch"] = function () { if (oldScratch) { try { oldScratch(); } catch (e) {} } itemRefreshSellAll(); renderRelief(); }; // 刮奖：刷新转让按钮
})(); // 结束钩子
setTimeout(function () { itemRender(); renderRelief(); }, 260); // 首帧兜底渲染（等主脚本初始化完毕）

// ================= 6.2 十四轮：表情包线条化（运行时） =================
const ICO_PATHS = {"receipt": ["M5.8 3.4h12.4v17.2l-2.1-1.4-2 1.4-2.1-1.4-2 1.4-2.1-1.4-2.1 1.4z", "M9 8h6M9 11.4h6M9 14.8h3.6"], "clover": ["M12 12c-1.4-4.4-4.6-5.4-5.6-4.2S5.4 12 12 12zM12 12c4.4-1.4 5.4-4.6 4.2-5.6S12 5.4 12 12zM12 12c1.4 4.4 4.6 5.4 5.6 4.2S18.6 12 12 12zM12 12c-4.4 1.4-5.4 4.6-4.2 5.6S12 18.6 12 12z", "M12 12v9.4"], "droplet": ["M12 3.2c3.2 4.2 5.8 6.8 5.8 9.8a5.8 5.8 0 0 1-11.6 0c0-3 2.6-5.6 5.8-9.8z"], "star": ["M12 3.4l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.8l6-.9z"], "printer": ["M7.4 8.2V4.4h9.2v3.8", "M4 10.2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M7.4 13.2h9.2v6.4H7.4z"]}; // canvas 用矢量路径（与 sprite 同源，导出 PNG 也保持线条风）
function icoPaint(g, name, x, y, size, color) { // 在 2D 上下文里描一个线条图标（x,y 为左上角）
  const ds = ICO_PATHS[name]; // 取路径集合
  if (!ds || !ds.length) { return; } // 无数据则不画
  g.save(); // 保存画笔状态
  const k = size / 24; // 24 网格 → 目标尺寸的缩放比
  g.translate(x, y); g.scale(k, k); // 定位并缩放
  g.strokeStyle = color; g.lineWidth = 1.8; g.lineCap = "round"; g.lineJoin = "round"; // 与页面图标完全同一套描边参数
  for (let i = 0; i < ds.length; i++) { g.stroke(new Path2D(ds[i])); } // 逐条路径描边
  g.restore(); // 还原画笔状态
} // 结束 icoPaint
const ICO_MAP = {"⌨": "keyboard", "↩": "undo", "★": "starFill", "✨": "sparkle", "✕": "cross", "✓": "check", "❌": "crossCircle", "✅": "checkCircle", "⛔": "ban", "⏱": "timer", "⏪": "rewind", "⏭": "skip", "⏹": "stop", "⬇": "download", "📥": "inbox", "🗑": "trash", "💾": "save", "📦": "box", "🧩": "puzzle", "📖": "book", "📜": "scroll", "📈": "chart", "🖥": "monitor", "🪟": "window", "🖼": "image", "💬": "chat", "🔄": "refresh", "↔": "arrowsH", "🔒": "lock", "🔓": "unlock", "🔐": "lockKey", "⚙": "gear", "🆘": "lifebuoy", "🔊": "volume", "🔇": "volumeOff", "🛒": "cart", "💼": "briefcase", "🏦": "bank", "🧰": "toolbox", "🕹": "joystick", "🦾": "robotArm", "🏮": "lantern", "🔻": "caretDown", "🎨": "palette", "❤": "heart", "💚": "heart", "🎁": "gift", "🎀": "bow", "🌟": "starGlow", "💰": "moneyBag", "⚡": "bolt", "🔥": "flame", "🍀": "clover", "💧": "droplet", "🌫": "fog", "😊": "smile", "😈": "devil", "😐": "neutral", "😇": "angel", "😎": "cool", "😨": "fear", "💪": "muscle", "🐾": "paw", "🧸": "bear", "🥚": "egg", "🍖": "meat", "🍗": "drumstick", "🥛": "milk", "🍪": "cookie", "🍰": "cake", "🍱": "bento", "🐰": "rabbit", "🐧": "penguin", "🦄": "unicorn", "🐲": "dragon", "👑": "crown", "🎩": "hat", "🧣": "scarf", "🎰": "slot", "🎡": "wheel", "🎲": "dice", "🀄": "mahjong", "🎴": "cards", "🎟": "ticket", "🎫": "ticket", "🎯": "target", "🎉": "party", "💨": "dash", "🤝": "handshake", "🔦": "flashlight", "🔮": "crystalBall", "🪙": "coin", "🧿": "amulet", "🧾": "receipt", "🏅": "medal", "🎮": "gamepad"}; // emoji → 线条图标名（构建时由 pkg_icons.py 注入，与静态替换同源）
const ICO_RE = /([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}])\uFE0F?[ ]?/gu; // 单个 emoji（含变体符与紧随的一个半角空格）
const ICO_NS = "http://www.w3.org/2000/svg"; // SVG 命名空间
const ICO_XLINK = "http://www.w3.org/1999/xlink"; // xlink 命名空间（旧内核兜底）
const ICO_SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, OPTION: 1, CODE: 1, PRE: 1, SVG: 1, PATH: 1, USE: 1, SYMBOL: 1, CIRCLE: 1, RECT: 1, ELLIPSE: 1 }; // 不参与替换的标签（含图标自身内部）

function icoNode(name) { // 生成一个线条图标元素（引用 sprite 中的 symbol）
  const s = document.createElementNS(ICO_NS, "svg"); // 创建 svg 容器
  s.setAttribute("class", "lnIco"); // 复用统一样式
  s.setAttribute("aria-hidden", "true"); // 装饰性，读屏忽略
  const u = document.createElementNS(ICO_NS, "use"); // 创建 use 引用
  u.setAttribute("href", "#li-" + name); // SVG2 写法（Chromium/WebView2）
  u.setAttributeNS(ICO_XLINK, "xlink:href", "#li-" + name); // 旧内核兜底
  s.appendChild(u); // 挂载引用
  return s; // 返回图标节点
} // 结束 icoNode

function icoLineifyText(tn) { // 把单个文本节点里的 emoji 拆成内联图标
  const s = tn.nodeValue; // 原始文字
  if (!s || s.length < 1) { return; } // 空节点直接跳过
  ICO_RE.lastIndex = 0; // 复位正则游标
  let m = ICO_RE.exec(s); // 先探一次，绝大多数文本走到这里就返回（零开销）
  if (!m) { return; } // 没有 emoji
  const frag = document.createDocumentFragment(); // 结果片段（一次替换，减少重排）
  let last = 0; // 已消费到的位置
  let changed = false; // 是否真的替换过
  while (m) { // 逐个匹配
    const name = ICO_MAP[m[1]]; // 查映射表
    if (name) { // 有对应线条图标
      if (m.index > last) { frag.appendChild(document.createTextNode(s.slice(last, m.index))); } // 图标前的文字
      frag.appendChild(icoNode(name)); // 图标本体
      last = m.index + m[0].length; // 推进到本次匹配末尾（含被吞掉的空格）
      changed = true; // 标记已改
    }
    m = ICO_RE.exec(s); // 继续找下一个
  }
  if (!changed) { return; } // 全都没登记 → 保持原样
  if (last < s.length) { frag.appendChild(document.createTextNode(s.slice(last))); } // 尾段文字
  if (tn.parentNode) { tn.parentNode.replaceChild(frag, tn); } // 用片段替换原文本节点
} // 结束 icoLineifyText

function icoLineify(root) { // 对一棵子树做全量线条化
  if (!root) { return; } // 空节点跳过
  if (root.nodeType === 3) { icoLineifyText(root); return; } // 文本节点直接处理
  if (root.nodeType !== 1) { return; } // 非元素节点不处理
  if (ICO_SKIP[String(root.tagName || "").toUpperCase()]) { return; } // 跳过脚本/样式/图标内部
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { // 只遍历文本节点
    acceptNode: function (n) { // 过滤：父元素不可处理则拒绝
      const p = n.parentNode; // 父节点
      if (!p || p.nodeType !== 1) { return NodeFilter.FILTER_REJECT; } // 无父元素
      if (ICO_SKIP[String(p.tagName || "").toUpperCase()]) { return NodeFilter.FILTER_REJECT; } // 父元素在跳过区
      return NodeFilter.FILTER_ACCEPT; // 可处理
    }
  }); // 结束 TreeWalker
  const list = []; // 先收集再改（边遍历边改会打乱游标）
  while (w.nextNode()) { list.push(w.currentNode); } // 收集全部文本节点
  for (let i = 0; i < list.length; i++) { icoLineifyText(list[i]); } // 逐个替换
} // 结束 icoLineify

let icoQueued = false; // 是否已排队刷新
const icoPool = []; // 待处理节点池
function icoFlush() { // 帧内统一处理（合并高频 DOM 变更）
  icoQueued = false; // 复位排队标记
  const arr = icoPool.splice(0, icoPool.length); // 取走当前池
  for (let i = 0; i < arr.length; i++) { icoLineify(arr[i]); } // 逐个线条化
} // 结束 icoFlush
function icoQueue(n) { // 投递一个节点
  if (!n) { return; } // 空跳过
  if (n.nodeType === 1 && String(n.tagName || "").toUpperCase() === "SVG") { return; } // 自己插入的图标不再处理
  icoPool.push(n); // 入池
  if (icoQueued) { return; } // 已排队
  icoQueued = true; // 标记排队
  setTimeout(icoFlush, 16); // 下一帧统一处理（用定时器而非 rAF：页面隐藏/无头环境下 rAF 可能不推进）
} // 结束 icoQueue

let icoMO = null; // 观察器常驻引用（局部变量会被 GC 回收导致监听失效）
function initIcoLine() { // 启动：先全量扫一遍，再持续监听
  icoLineify(document.body); // 首帧全量线条化（补齐脚本内模板生成的文字）
  if (icoMO) { return; } // 幂等：避免重复注册
  icoMO = new MutationObserver(function (recs) { // 监听后续 DOM 变更
    for (let i = 0; i < recs.length; i++) { // 逐条记录
      const r = recs[i]; // 当前记录
      if (r.type === "characterData") { icoQueue(r.target); } // 文字被整体改写（textContent = ...）
      else { for (let j = 0; j < r.addedNodes.length; j++) { icoQueue(r.addedNodes[j]); } } // 新增节点（toast/弹窗/结果条）
    }
  }); // 结束回调
  icoMO.observe(document.body, { childList: true, subtree: true, characterData: true }); // 全文档监听
} // 结束 initIcoLine

if (document.body) { initIcoLine(); } else { document.addEventListener("DOMContentLoaded", initIcoLine); } // 脚本在 body 末尾，通常立即执行

// ================= 6.2 十五轮：机打小票（每批刮完自动出票 + 保存 PNG） =================
const RCPT_MAX_ROWS = 12; // 明细最多 12 行（超出折叠为「前 6 + 后 6」）
const RCPT_KEEP = 6; // 折叠时首尾各保留行数
let rcptData = null; // 当前小票数据（保存 PNG 用）
let rcptFastNext = false; // 下一次出票是否跳过打印动画（跳过刮票过程）
let rcptPending = null; // 批次完成瞬间快照（在 clearBatch 之前抓，转让记录才不会被清）
let rcptTypeTimer = null; // 打印音定时器
let rcptDoneTimer = null; // 打印完成定时器

/* ---------- 小工具 ---------- */
function rcptMoney(v) { return "¥" + Math.abs(+v || 0).toFixed(2); } // 金额文本（符号单独处理）
function rcptPad(n) { return String(n).padStart(4, "0"); } // 票号补零
function rcptTimeStr(t) { // YYYY-MM-DD HH:MM:SS
  const p = function (n) { return String(n).padStart(2, "0"); }; // 两位补零
  return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()) + " " + p(t.getHours()) + ":" + p(t.getMinutes()) + ":" + p(t.getSeconds()); // 拼接
} // 结束 rcptTimeStr
function rcptStamp(t) { // 文件名时间戳 YYYYMMDD_HHMMSS
  const p = function (n) { return String(n).padStart(2, "0"); }; // 两位补零
  return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()) + "_" + p(t.getHours()) + p(t.getMinutes()) + p(t.getSeconds()); // 拼接
} // 结束 rcptStamp
function rcptCode() { // 6 位十六进制单号
  const A = "0123456789ABCDEF"; let s = ""; // 字符集与结果
  for (let i = 0; i < 6; i++) { s += A.charAt(Math.floor(Math.random() * A.length)); } // 逐位随机
  return s; // 返回
} // 结束 rcptCode

/* ---------- 抓取本批数据 ---------- */
function rcptSnap() { // 把当前 batch 拍成小票数据（必须在 clearBatch 之前调用）
  const list = (batch || []).map(function (t) { // 逐张
    const sold = (itemSold && itemSold[t.no]) ? +itemSold[t.no] : 0; // 转让回收额
    return { no: +t.no || 0, price: +t.price || 0, prize: sold > 0 ? 0 : (+t.prize || 0), sold: sold, boost: !!t.lucky }; // 单张明细
  }); // 结束逐张
  list.sort(function (a, b) { return a.no - b.no; }); // 按票号升序（与真实小票一致）
  const cost = list.reduce(function (s, it) { return s + it.price; }, 0); // 票面合计
  const win = list.reduce(function (s, it) { return s + it.prize; }, 0); // 中奖合计
  const back = list.reduce(function (s, it) { return s + it.sold; }, 0); // 转让合计
  return { at: Date.now(), time: new Date(), code: rcptCode(), items: list, cost: Math.round(cost * 100) / 100, win: Math.round(win * 100) / 100, back: Math.round(back * 100) / 100, net: Math.round((win + back - cost) * 100) / 100, seq: batchSeq || 1, cnt: batchCount || 1 }; // 返回整单
} // 结束 rcptSnap

/* ---------- 明细行裁剪 ---------- */
function rcptRowPlan(d) { // 计算要打印的明细行（超长折叠中间）
  const all = d.items || []; // 全部
  if (all.length <= RCPT_MAX_ROWS) { return { rows: all, more: 0, midAt: -1 }; } // 不长：全打
  return { rows: all.slice(0, RCPT_KEEP).concat(all.slice(all.length - RCPT_KEEP)), more: all.length - RCPT_MAX_ROWS, midAt: RCPT_KEEP }; // 折叠
} // 结束 rcptRowPlan

/* ---------- 条形码 ---------- */
function rcptBars() { // 生成条码竖条 HTML（伪随机但每次一致）
  let h = ""; // 结果
  for (let i = 0; i < 44; i++) { // 固定条数
    const w = 1 + ((i * 5 + 3) % 3); // 1~3px 宽
    const hh = 58 + ((i * 17 + 11) % 43); // 高度 58%~100%
    h += '<i style="width:' + w + 'px;height:' + hh + '%"></i>'; // 单条
  } // 结束循环
  return h; // 返回
} // 结束 rcptBars

/* ---------- 小票 HTML ---------- */
function rcptRenderHTML(d) { // 渲染小票纸面
  const plan = rcptRowPlan(d); // 行计划
  const rows = plan.rows.map(function (it, i) { // 逐行
    let cls = "lose", txt = "—"; // 默认空票
    if (it.sold > 0) { cls = "sold"; txt = "↩ " + rcptMoney(it.sold); } // 转让回收
    else if (it.prize > 0) { cls = "win"; txt = rcptMoney(it.prize) + (it.boost ? " ★" : ""); } // 中奖（★=转运保底）
    const sep = (i === plan.midAt) ? '<div class="rcptMore">· 中间 ' + plan.more + ' 张略 ·</div>' : ""; // 折叠提示
    return sep + '<div class="rcptRow"><span class="no">No.' + rcptPad(it.no) + '</span><span class="tier">¥' + it.price + '</span><span class="val ' + cls + '">' + txt + '</span></div>'; // 一行
  }).join(""); // 拼接
  const noFrom = d.items.length ? rcptPad(d.items[0].no) : "----"; // 起票号
  const noTo = d.items.length ? rcptPad(d.items[d.items.length - 1].no) : "----"; // 止票号
  const netCls = d.net > 0.004 ? "plus" : (d.net < -0.004 ? "minus" : "even"); // 净额配色
  const netTxt = (d.net > 0.004 ? "+" : (d.net < -0.004 ? "-" : "")) + rcptMoney(Math.abs(d.net)); // 净额文本
  const batchTxt = d.cnt > 1 ? ("第 " + d.seq + " / " + d.cnt + " 批") : "整单"; // 分批信息
  return '' + // 开始
    '<div class="rcptHead"><div class="rcptBrand"><svg class="lnIco" viewBox="0 0 24 24" aria-hidden="true"><use href="#li-printer"/></svg>幸运刮刮乐</div><div class="rcptSub">Lucky Scratch · Cash Receipt</div></div>' + // 票头
    '<div class="rcptRule"></div>' + // 分隔
    '<div class="rcptMetaRow"><span>日期</span><b>' + rcptTimeStr(d.time) + '</b></div>' + // 日期
    '<div class="rcptMetaRow"><span>票号</span><b>No.' + noFrom + ' – No.' + noTo + '</b></div>' + // 票号区间
    '<div class="rcptMetaRow"><span>单号</span><b>#' + d.code + ' · ' + batchTxt + '</b></div>' + // 单号与批号
    '<div class="rcptRule cut"></div>' + // 裁切线
    '<div class="rcptTh"><span>票号 / 价位</span><span>本张结果</span></div>' + // 表头
    rows + // 明细
    '<div class="rcptRule"></div>' + // 分隔
    '<div class="rcptSum"><span>张数</span><b>' + d.items.length + ' 张</b></div>' + // 张数
    '<div class="rcptSum"><span>票面合计</span><b>' + rcptMoney(d.cost) + '</b></div>' + // 成本
    '<div class="rcptSum"><span>中奖合计</span><b>' + rcptMoney(d.win) + '</b></div>' + // 中奖
    '<div class="rcptSum"><span>转让回收</span><b>' + rcptMoney(d.back) + '</b></div>' + // 转让
    '<div class="rcptTotal"><span>本批净额</span><span class="net ' + netCls + '">' + netTxt + '</span></div>' + // 净额
    '<div class="rcptBarcode">' + rcptBars() + '</div>' + // 条码
    '<div class="rcptCode">SCR ' + rcptStamp(d.time).replace("_", " ") + ' ' + d.code + '</div>' + // 条码号
    '<div class="rcptFoot">谢谢惠顾 · 好运常在<br>小票可保存留念，祝你下一把中大奖</div>' + // 票脚
    '<div class="rcptTeeth"></div>'; // 锯齿断口
} // 结束 rcptRenderHTML

/* ---------- 打印音 ---------- */
function rcptTypeSound(dur) { // 吐纸期间连续"哒哒"声
  if (rcptTypeTimer) { clearInterval(rcptTypeTimer); } // 先清旧的
  let n = 0; const total = Math.max(4, Math.round(dur / 110)); // 总声数
  rcptTypeTimer = setInterval(function () { // 定时
    if (n++ > total) { clearInterval(rcptTypeTimer); rcptTypeTimer = null; return; } // 结束
    tickTone(150 + Math.random() * 130, 0.022, 0.03, "square", "ui"); // 机械走纸声
  }, 110); // 110ms 一声
} // 结束 rcptTypeSound

/* ---------- 展示 ---------- */
function rcptShow(d, fast) { // 出票（fast=true 跳过打印动画，直接整张展示）
  const mask = $("rcptMask"), roll = $("rcptRoll"), paper = $("rcptPaper"), mach = $("rcptMachine"), st = $("rcptState"), sv = $("rcptSave"); // 元素
  if (!mask || !roll || !paper) { return; } // 保护
  if (rcptTypeTimer) { clearInterval(rcptTypeTimer); rcptTypeTimer = null; } // 清旧音
  if (rcptDoneTimer) { clearTimeout(rcptDoneTimer); rcptDoneTimer = null; } // 清旧定时
  rcptData = d; // 记下当前小票
  paper.innerHTML = rcptRenderHTML(d); // 铺票面
  roll.classList.remove("done"); // 先禁滚
  roll.classList.toggle("instant", !!fast); // 跳过模式：无高度过渡
  roll.style.height = "0px"; // 归零
  if (mach) { mach.classList.remove("printing", "done"); } // 复位机器灯
  mask.classList.add("show"); // 亮遮罩
  mask.setAttribute("aria-hidden", "false"); // 无障碍
  if (sv) { sv.disabled = true; } // 打印中不许保存
  const maxH = Math.round(Math.max(300, window.innerHeight * 0.5)); // 吐纸区最大高度
  const full = Math.min(paper.offsetHeight, maxH); // 目标高度
  if (fast) { // 跳过刮票过程 → 直接整张展示
    if (st) { st.textContent = "已出票 · 跳过打印"; } // 状态
    roll.style.height = full + "px"; // 直接到位
    if (mach) { mach.classList.add("done"); } // 灯常亮
    roll.classList.add("done"); // 允许滚动
    if (sv) { sv.disabled = false; } // 可保存
    tickTone(780, 0.06, 0.04, "triangle", "ui"); // 出票提示音
    return; // 结束
  } // 结束跳过分支
  if (st) { st.textContent = "打印中…"; } // 状态
  if (mach) { mach.classList.add("printing"); } // 指示灯闪
  const dur = Math.min(2600, Math.max(1100, 700 + d.items.length * 150)); // 张数越多打印越久
  roll.style.transitionDuration = dur + "ms"; // 本次时长
  void roll.offsetHeight; // 强制回流（确保从 0 开始过渡）
  setTimeout(function () { roll.style.height = full + "px"; }, 30); // 稍后启动高度动画
  rcptTypeSound(dur); // 走纸声
  rcptDoneTimer = setTimeout(rcptFinishPrint, dur + 130); // 完成回调
} // 结束 rcptShow

function rcptFinishPrint() { // 打印完成
  if (rcptTypeTimer) { clearInterval(rcptTypeTimer); rcptTypeTimer = null; } // 停走纸声
  const mach = $("rcptMachine"), roll = $("rcptRoll"), st = $("rcptState"), sv = $("rcptSave"); // 元素
  if (mach) { mach.classList.remove("printing"); mach.classList.add("done"); } // 灯常亮
  if (roll) { roll.classList.add("done"); } // 允许滚动
  if (st) { st.textContent = "已出票 · 可保存留念"; } // 状态
  if (sv) { sv.disabled = false; } // 可保存
  tickTone(880, 0.07, 0.05, "triangle", "win"); // 完成两连音
  setTimeout(function () { tickTone(1180, 0.08, 0.045, "triangle", "win"); }, 92); // 第二声
} // 结束 rcptFinishPrint

function rcptClose() { // 收好（关闭）
  const mask = $("rcptMask"), roll = $("rcptRoll"), paper = $("rcptPaper"), mach = $("rcptMachine"); // 元素
  if (!mask) { return; } // 保护
  if (rcptTypeTimer) { clearInterval(rcptTypeTimer); rcptTypeTimer = null; } // 停音
  if (rcptDoneTimer) { clearTimeout(rcptDoneTimer); rcptDoneTimer = null; } // 停定时
  mask.classList.remove("show"); // 收遮罩
  mask.setAttribute("aria-hidden", "true"); // 无障碍
  if (mach) { mach.classList.remove("printing", "done"); } // 熄灯
  tickTone(420, 0.06, 0.035, "triangle", "ui"); // 收起音
  setTimeout(function () { // 等淡出再清内容
    if (!mask.classList.contains("show")) { // 期间没有重新打开
      if (roll) { roll.style.height = "0px"; roll.classList.remove("done", "instant"); } // 归零
      if (paper) { paper.innerHTML = ""; } // 清票面
    } // 结束判断
  }, 240); // 240ms
} // 结束 rcptClose

/* ---------- 保存 PNG ---------- */
function rcptSeed(code) { // 由单号生成的确定性随机数（条码每次一致）
  let s = 0; for (let i = 0; i < code.length; i++) { s = (s * 31 + code.charCodeAt(i)) % 99991; } // 简单散列
  return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; // LCG
} // 结束 rcptSeed
function rcptTeethCut(g, W, H, th) { // 上下锯齿断口（裁掉三角）
  g.save(); g.globalCompositeOperation = "destination-out"; // 挖空模式
  g.beginPath(); g.moveTo(0, 0); for (let x = 0; x < W; x += 12) { g.lineTo(x + 6, th); g.lineTo(x + 12, 0); } g.lineTo(W, 0); g.closePath(); // 顶部
  g.moveTo(0, H); for (let x = 0; x < W; x += 12) { g.lineTo(x + 6, H - th); g.lineTo(x + 12, H); } g.lineTo(W, H); g.closePath(); // 底部
  g.fill(); g.restore(); // 执行挖空
} // 结束 rcptTeethCut
function rcptPaint(g, d, W, pad, measure) { // 绘制小票（measure=true 只算高度）
  const plan = rcptRowPlan(d); // 行计划
  const th = 12; // 锯齿高度
  const topH = 34 + 22 + 26 + 24 * 3 + 26 + 24 + 24; // 票头 + 分隔 + 元信息 + 表头
  const bodyH = plan.rows.length * 24 + (plan.more ? 22 : 0); // 明细
  const footH = 26 + 24 * 4 + 48 + 54 + 24 + 22 * 2 + 26; // 汇总 + 净额 + 条码 + 票脚
  const H = Math.round(th + topH + bodyH + footH + th); // 总高
  if (measure) { return H; } // 仅测量
  const grd = g.createLinearGradient(0, 0, 0, H); // 纸面渐变
  grd.addColorStop(0, "#fffef9"); grd.addColorStop(1, "#f6efdf"); // 上白下米
  g.fillStyle = grd; g.fillRect(0, 0, W, H); // 铺纸
  let y = th + 34; // 起始纵坐标
  g.textAlign = "center"; g.textBaseline = "alphabetic"; // 居中
  g.fillStyle = "#2f2a22"; g.font = "800 30px 'Microsoft YaHei', sans-serif"; // 品牌字体
  const brand = "幸运刮刮乐", bw = g.measureText(brand).width; // 品牌与宽度
  g.fillText(brand, W / 2 + 14, y); // 品牌文字
  g.save(); g.translate(W / 2 - bw / 2 - 30, y - 26); g.scale(1.35, 1.35); g.strokeStyle = "#2f2a22"; g.lineWidth = 1.8; g.lineCap = "round"; g.lineJoin = "round"; // 打印机图标（与页面同源线条）
  const pp = ICO_PATHS.printer || []; for (let pi = 0; pi < pp.length; pi++) { g.stroke(new Path2D(pp[pi])); } // 机身（多条路径逐一描边）
  g.restore(); // 还原
  y += 22; g.fillStyle = "#9a907c"; g.font = "12px Consolas, monospace"; g.fillText("LUCKY  SCRATCH  ·  CASH  RECEIPT", W / 2, y); // 英文副标
  y += 26; g.setLineDash([7, 6]); g.strokeStyle = "#cabfa5"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke(); g.setLineDash([]); // 虚线
  y += 24; g.textAlign = "left"; g.font = "15px Consolas, monospace"; // 元信息
  const meta = [["日期", rcptTimeStr(d.time)], ["票号", "No." + rcptPad(d.items[0] ? d.items[0].no : 0) + " – No." + rcptPad(d.items.length ? d.items[d.items.length - 1].no : 0)], ["单号", "#" + d.code + (d.cnt > 1 ? " · 第 " + d.seq + "/" + d.cnt + " 批" : "")]]; // 三行
  meta.forEach(function (kv) { g.fillStyle = "#6b6353"; g.fillText(kv[0], pad, y); g.textAlign = "right"; g.fillStyle = "#443c2f"; g.font = "700 15px Consolas, monospace"; g.fillText(kv[1], W - pad, y); g.textAlign = "left"; g.font = "15px Consolas, monospace"; y += 24; }); // 逐行
  y += 2; g.setLineDash([7, 6]); g.strokeStyle = "#cabfa5"; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke(); g.setLineDash([]); // 裁切线
  y += 24; g.fillStyle = "#9a907c"; g.font = "12px Consolas, monospace"; g.textAlign = "left"; g.fillText("票号 / 价位", pad, y); g.textAlign = "right"; g.fillText("本张结果", W - pad, y); y += 24; // 表头
  plan.rows.forEach(function (it, i) { // 明细
    if (i === plan.midAt) { g.textAlign = "center"; g.fillStyle = "#9a907c"; g.font = "13px 'Microsoft YaHei', sans-serif"; g.fillText("· 中间 " + plan.more + " 张略 ·", W / 2, y); y += 22; g.textAlign = "left"; } // 折叠行
    g.font = "15px Consolas, monospace"; g.fillStyle = "#5a5346"; g.textAlign = "left"; g.fillText("No." + rcptPad(it.no), pad, y); // 票号
    g.fillStyle = "#a49a85"; g.font = "13px Consolas, monospace"; g.fillText("¥" + it.price, pad + 110, y); // 价位
    g.textAlign = "right"; g.font = "700 15px Consolas, monospace"; // 结果
    if (it.sold > 0) { g.fillStyle = "#3d6f86"; g.fillText("↩ " + rcptMoney(it.sold), W - pad, y); } // 转让
    else if (it.prize > 0) { g.fillStyle = "#a8331f"; g.fillText(rcptMoney(it.prize) + (it.boost ? " ★" : ""), W - pad, y); } // 中奖
    else { g.fillStyle = "#9b9486"; g.font = "15px Consolas, monospace"; g.fillText("—", W - pad, y); } // 空票
    g.textAlign = "left"; y += 24; // 下移
  }); // 结束明细
  y += 6; g.setLineDash([7, 6]); g.strokeStyle = "#cabfa5"; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke(); g.setLineDash([]); y += 24; // 分隔
  const sums = [["张数", d.items.length + " 张"], ["票面合计", rcptMoney(d.cost)], ["中奖合计", rcptMoney(d.win)], ["转让回收", rcptMoney(d.back)]]; // 汇总
  sums.forEach(function (kv) { g.textAlign = "left"; g.fillStyle = "#5a5346"; g.font = "15px 'Microsoft YaHei', sans-serif"; g.fillText(kv[0], pad, y); g.textAlign = "right"; g.fillStyle = "#3b352c"; g.font = "700 15px Consolas, monospace"; g.fillText(kv[1], W - pad, y); y += 24; }); // 逐行
  y += 8; g.strokeStyle = "#ddd2bb"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke(); y += 34; // 净额上边线
  g.textAlign = "left"; g.fillStyle = "#3b352c"; g.font = "800 17px 'Microsoft YaHei', sans-serif"; g.fillText("本批净额", pad, y); // 标签
  g.textAlign = "right"; g.font = "800 28px Consolas, monospace"; g.fillStyle = d.net > 0.004 ? "#a8331f" : (d.net < -0.004 ? "#3c6b4a" : "#7a7264"); // 净额配色
  g.fillText((d.net > 0.004 ? "+" : (d.net < -0.004 ? "-" : "")) + rcptMoney(Math.abs(d.net)), W - pad, y); // 净额
  y += 16; // 下移
  const bH = 46, bx0 = pad + 70, bx1 = W - pad - 70, rnd = rcptSeed(d.code); // 条码参数
  let bx = bx0; g.fillStyle = "#3b352c"; // 条码画笔
  while (bx < bx1) { const w = 2 + Math.floor(rnd() * 3); if (bx + w > bx1) { break; } const hh = bH * (0.55 + rnd() * 0.45); g.fillRect(bx, y + bH - hh, w, hh); bx += w + 2 + Math.floor(rnd() * 2); } // 逐条
  y += bH + 8; g.textAlign = "center"; g.fillStyle = "#8a8172"; g.font = "12px Consolas, monospace"; g.fillText("SCR " + rcptStamp(d.time).replace("_", " "), W / 2, y); // 条码号
  y += 26; g.fillStyle = "#8a8172"; g.font = "14px 'Microsoft YaHei', sans-serif"; g.fillText("谢谢惠顾 · 好运常在", W / 2, y); y += 22; g.fillText("小票可保存留念，祝你下一把中大奖", W / 2, y); // 票脚
  for (let i = 0; i < 240; i++) { g.fillStyle = "rgba(120,100,70,.05)"; g.fillRect(rnd() * W, rnd() * H, 1.4, 1.4); } // 纸纤维
  rcptTeethCut(g, W, H, th); // 锯齿断口
  return H; // 返回高度
} // 结束 rcptPaint
function rcptSavePng() { // 保存为 PNG（2 倍高清）
  if (!rcptData) { return; } // 无数据
  const W = 760, pad = 56; // 画布宽与左右内边距
  const cv = document.createElement("canvas"); // 新建画布
  const H = rcptPaint(cv.getContext("2d"), rcptData, W, pad, true); // 先量高度
  cv.width = W * 2; cv.height = H * 2; // 2x 尺寸
  const g = cv.getContext("2d"); g.scale(2, 2); // 2x 缩放
  rcptPaint(g, rcptData, W, pad, false); // 正式绘制
  const a = document.createElement("a"); // 下载链
  a.href = cv.toDataURL("image/png"); // PNG 数据
  a.download = "彩票小票_" + rcptStamp(rcptData.time) + ".png"; // 文件名
  a.click(); // 触发下载
  tickTone(980, 0.07, 0.05, "triangle", "win"); // 保存音
  toast("小票已保存：彩票小票_" + rcptStamp(rcptData.time) + ".png"); // 反馈
} // 结束 rcptSavePng

/* ---------- 触发：每批刮完自动出票 ---------- */
function rcptFlush() { // 有快照就出票
  if (!rcptPending) { return; } // 无
  const d = rcptPending; rcptPending = null; // 取走
  if (Date.now() - d.at > 6000) { rcptFastNext = false; return; } // 过期快照（恢复现场）丢弃
  const fast = rcptFastNext; rcptFastNext = false; // 本次是否跳过打印
  rcptShow(d, fast); // 出票
} // 结束 rcptFlush
const __rcptClearBatch = clearBatch; // 保存当前实现（已含道具清理钩子）
clearBatch = function () { // 清批前抢拍（否则 itemSold 会被清空）
  try { // 容错
    if (batch && batch.length && remainBuy <= 0 && batch.every(function (t) { return t.revealed; })) { rcptPending = rcptSnap(); } // 整单完成：拍快照
  } catch (e) {} // 静默
  return __rcptClearBatch.apply(this, arguments); // 跑原逻辑
}; // 结束接管
const __rcptUpdateInfo = updateScratchInfo; // 保存当前实现（已含转让计数钩子）
updateScratchInfo = function () { // 进度刷新后再看是否要出票
  __rcptUpdateInfo.apply(this, arguments); // 原逻辑
  try { rcptFlush(); } catch (e) {} // 出票
}; // 结束接管
if (typeof finishSkipSettle === "function") { // 跳过模式结算（白底等待页）：直接整张展示小票
  const __rcptSkip = finishSkipSettle; // 保存原实现
  finishSkipSettle = function () { // 接管
    rcptFastNext = true; // 跳过刮票过程 → 不播打印动画
    const r = __rcptSkip.apply(this, arguments); // 原逻辑
    try { rcptFlush(); } catch (e) {} // 出票
    return r; // 返回
  }; // 结束接管
} // 结束跳过模式
if (typeof scratchAll === "function") { // 一键刮开（速度拉满＝瞬间揭晓）同样直接出票
  const __rcptAll = scratchAll; // 保存原实现
  scratchAll = function () { // 接管
    if (happySpeedIdx >= 50) { rcptFastNext = true; } // 跳过模式标记
    return __rcptAll.apply(this, arguments); // 原逻辑
  }; // 结束接管
} // 结束一键刮开
$("rcptClose") && $("rcptClose").addEventListener("click", rcptClose); // 收好
$("rcptSave") && $("rcptSave").addEventListener("click", rcptSavePng); // 保存
document.addEventListener("keydown", function (e) { // 小票打开时的键盘
  const mask = $("rcptMask"); // 遮罩
  if (!mask || !mask.classList.contains("show")) { return; } // 未打开
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rcptClose(); } // Esc 收起
}, true); // 捕获阶段（先于快捷键模块）
window.addEventListener("resize", function () { // 窗口变化时重算吐纸高度
  const mask = $("rcptMask"), roll = $("rcptRoll"), paper = $("rcptPaper"); // 元素
  if (!mask || !mask.classList.contains("show") || !roll || !paper) { return; } // 未打开
  if (!roll.classList.contains("done")) { return; } // 打印中不打扰
  const maxH = Math.round(Math.max(300, window.innerHeight * 0.5)); // 新的上限
  roll.style.height = Math.min(paper.offsetHeight, maxH) + "px"; // 重设高度
}); // 结束窗口监听



