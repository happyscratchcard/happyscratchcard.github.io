// ================= 6.0 新增：视图生命周期钩子（3D 场景切入恢复 / 切出暂停） =================
const viewHooks = { enter: {}, leave: {} }; // 进入/离开钩子表：viewHooks.enter["Slot"] = fn
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; // 系统减少动效偏好（3D 降级依据）
function webglOK() { // 检测 WebGL 是否可用（不可用则 3D 降级为静态占位）
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } // 探测上下文
} // 结束 webglOK
function noWebglFallback(stageId, face) { // 3D 降级：容器挂斜纹底与大表情
  const el = $(stageId); // 取容器
  if (el) { el.classList.add("noWebGL"); el.textContent = face; } // 标记并放占位
} // 结束 noWebglFallback

// ================= 6.0 新增：数字滚动动画（参考掘金「CSS 老虎机数字滚动」：无缝滚动 + 模糊 + 逐位延迟停 + 回弹抖动） =================
function rollMakeStrip(items, copies) { // 构建滚动条带：items 重复 copies 份（首尾相接实现无缝循环）
  const strip = document.createElement("div"); strip.className = "rollStrip"; // 条带容器
  for (let c = 0; c < copies; c++) { for (const it of items) { const s = document.createElement("div"); s.className = "rollItem"; s.textContent = it; strip.appendChild(s); } } // 重复铺内容
  return strip; // 返回条带（调用方负责挂载）
} // 结束 rollMakeStrip
function rollSpin(strip, per, unit, durMs) { // 循环滚动：每圈位移 per×unit 像素，滚动中带运动模糊
  return strip.animate( // Web Animations API：循环滚动
    [{ transform: "translateY(0)", filter: "blur(1.6px)" }, { transform: "translateY(" + (-per * unit) + "px)", filter: "blur(1.6px)" }], // 一整圈的起止（位移取负 = 向上滚）
    { duration: durMs, easing: "linear", iterations: Infinity }); // 线性无限循环（模糊由关键帧携带）
} // 结束 rollSpin
function rollStopTo(strip, col, per, item, unit, spinAni, delayMs) { // 停止：取消循环 → 跳到中段副本目标格回弹定格（障眼法：滚得快，人眼只看结果）
  setTimeout(function () { // 逐位延迟：第 i 列晚 i 停
    spinAni.cancel(); // 停掉循环滚动
    const k = per + item; // 中段副本内的目标格序号（第二份起，保证前后都有内容可滚）
    const end = -k * unit; // 最终位移（负 = 向上）
    strip.animate([ // 回弹关键帧：过冲 → 回弹 → 定格（模糊先在后消失）
      { transform: "translateY(" + (end + unit * 1.1) + "px)", filter: "blur(1.3px)" }, // 从下一格冲上来
      { transform: "translateY(" + (end - unit * 0.10) + "px)", filter: "blur(0)", offset: 0.5 }, // 过冲过头
      { transform: "translateY(" + (end + unit * 0.04) + "px)", filter: "blur(0)", offset: 0.78 }, // 回弹
      { transform: "translateY(" + end + "px)", filter: "blur(0)" } // 精确定格
    ], { duration: 560, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" }); // forwards 定格在最后一帧
    if (col) { col.classList.remove("rolling"); void col.offsetWidth; col.classList.add("rolling"); } // 边框跟着抖一下（规格）
  }, delayMs); // 结束延迟
} // 结束 rollStopTo
const ROLL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]; // 数字条带内容：末尾补 0 实现无缝（11 格 / 圈）
function rollNumber(el, text) { // 余额等数字的滚动动画：逐位竖排条带（位数变化时重建列）
  const cur = el._rollVal == null ? "" : String(el._rollVal); // 上一次值
  if (cur === text && el._rollCols) { return; } // 未变化直接跳过（省动画）
  if (fxOn) { // 6.2 三轮：大额变动播放轻滴答（余额滚动音效层；零钱级变动静默防噪）
    const a = parseFloat(cur), b = parseFloat(text); // 新旧数值
    if (isFinite(a) && isFinite(b) && Math.abs(b - a) >= 1) { tickTone(760, 0.04, 0.035, "square"); } // 变动 ≥1 元才响（音量压得很低）
  } // 结束音效分支
  el._rollVal = text; // 记录新值
  if (!el._rollCols || el._rollCols.length !== text.length) { // 首次或位数变化：重建
    el.textContent = ""; el.classList.add("rollNumBox"); el._rollCols = []; // 清空并挂列组样式
    for (const ch of text) { // 逐字符建列
      const col = document.createElement("span"); col.className = "rollCol"; el.appendChild(col); // 列容器
      if (ch >= "0" && ch <= "9") { col._strip = rollMakeStrip(ROLL_DIGITS, 3); col.appendChild(col._strip); } // 数字列：条带 ×3 份
      else { col.textContent = ch; col.classList.add("rollDot"); col._strip = null; } // 小数点等静态位
      el._rollCols.push(col); // 缓存列
    } // 结束字符循环
  } // 结束重建
  for (let i = 0; i < text.length; i++) { // 逐位滚到新数字
    const col = el._rollCols[i], ch = text[i]; // 取列与目标字符
    if (!col._strip) { col.textContent = ch; continue; } // 静态位直接写
    const spin = rollSpin(col._strip, 11, col._unit || 18, 300); // 先滚起来（数字格步长 18px，与 CSS 一致）
    rollStopTo(col._strip, col, 11, +ch, col._unit || 18, spin, 60 + i * 55); // 逐位延迟吸附到目标数字
  } // 结束逐位
} // 结束 rollNumber

