// ================= 6.2 十七轮：启动温馨提示（页面虚化 + 2 秒冷却 + 彩屑碎裂 + 设置开关） =================
/* 设计要点：
   1) 视觉：全屏遮罩用 backdrop-filter 把整页虚化（同时降饱和 + 压暗），卡片浮在正中；
   2) 冷却：按钮先禁用，2 秒后解禁（期间数字 2 → 1 → 消失），防止手快误点；
   3) 碎裂：把卡片按网格克隆成 N 份、各自 clip-path 裁成一格，再逐格做「轻抬 + 旋转 + 下坠 + 淡出」，
      视觉上就是彩票屑被吹散后慢慢落到屏幕下方；遮罩同步淡出，页面立刻还原；
   4) 退出：右上角叉号先调外壳原生退出接口（pywebview / Electron），再退回 window.close()，
      浏览器安全策略不允许脚本关窗时，用「已退出」黑幕兜底，保证用户有明确的退出口；
   5) 开关：普通设置里可关掉「下次启动不再提示」，存储键 scratch-boot-tip（默认 1 = 开启）。 */
(function () { // 闭包封装，不污染全局
  const TIP_KEY = "scratch-boot-tip"; // 启动提示开关存储键（"1" 开启 / "0" 关闭）
  const COOLDOWN = 2000; // 按钮解禁冷却（毫秒，用户指定 2 秒）
  const COLS = 11, ROWS = 8; // 碎片网格：11 列 × 8 行 = 88 片（数量与流畅度折中）

  let mask = null; // 遮罩节点
  let card = null; // 卡片节点
  let okBtn = null; // 「我已知悉」按钮
  let ready = false; // 冷却是否结束（结束前点击无效）
  let opened = false; // 本次会话是否已弹过（防重复弹出）
  let cdTimer = null; // 倒计时定时器

  function prefOn() { // 读取「下次启动是否弹出」偏好
    try { return localStorage.getItem(TIP_KEY) !== "0"; } catch (e) { return true; } // 存储不可用时按默认开启
  } // 结束 prefOn

  function lock(on) { // 锁定/解锁页面滚动
    document.documentElement.classList.toggle("dmLock", !!on); // 根元素加类（CSS 里禁滚动）
  } // 结束 lock

  /* ---------- 一、弹出 ---------- */
  function open() { // 显示提示弹窗
    if (opened) { return; } // 已弹过不再重复
    mask = $("dmMask"); // 取遮罩
    card = $("dmCard"); // 取卡片
    okBtn = $("dmOk"); // 取确认按钮
    if (!mask || !card || !okBtn) { return; } // 节点缺失（旧版页面）直接放弃
    opened = true; // 标记已弹
    const cd = $("dmCd"); // 倒计时数字
    lock(true); // 锁滚动（弹窗期间背景不跟着滚）
    mask.classList.add("show"); // 淡入遮罩（backdrop-filter 同步把整页虚化）
    mask.setAttribute("aria-hidden", "false"); // 无障碍：可见
    ready = false; // 冷却开始
    okBtn.disabled = true; // 禁用按钮
    if (cd) { cd.textContent = "2"; cd.style.display = ""; } // 倒计时显示 2
    let left = 2; // 剩余秒数
    cdTimer = setInterval(function () { // 每秒递减
      left -= 1; // 减一秒
      if (left > 0) { if (cd) { cd.textContent = String(left); } return; } // 还有剩余：刷新数字
      clearInterval(cdTimer); cdTimer = null; // 归零：停表
      ready = true; // 解禁
      okBtn.disabled = false; // 允许点击
      if (cd) { cd.style.display = "none"; } // 倒计时隐藏（按钮文字变干净）
      okBtn.classList.add("hot"); // 轻微高亮提示「现在可以点了」
      setTimeout(function () { okBtn.classList.remove("hot"); }, 900); // 高亮 0.9 秒后收回
    }, 1000); // 1 秒一拍
    setTimeout(function () { okBtn.focus({ preventScroll: true }); }, 220); // 无障碍：焦点进弹窗（键盘可直接回车）
  } // 结束 open

  /* ---------- 二、彩屑碎裂 ---------- */
  function shred() { // 把卡片撕成彩屑落下，随后移除遮罩
    if (!card) { return; } // 未初始化
    const r = card.getBoundingClientRect(); // 卡片当前位置与尺寸（视口坐标）
    const cw = r.width / COLS, chh = r.height / ROWS; // 单格宽高
    const shards = []; // 碎片收集（结束统一清理）
    card.style.visibility = "hidden"; // 原卡隐藏（碎片顶替，避免重影）
    if (mask) { mask.classList.add("gone"); } // 遮罩淡出（页面开始还原）
    lock(false); // 解锁滚动
    for (let row = 0; row < ROWS; row++) { // 逐行
      for (let col = 0; col < COLS; col++) { // 逐列
        const x0 = col * cw, y0 = row * chh; // 格子左上角（卡片本地坐标）
        const x1 = Math.min(r.width, x0 + cw + 0.8), y1 = Math.min(r.height, y0 + chh + 0.8); // 右下角（多 0.8px 防缝隙）
        const piece = card.cloneNode(true); // 克隆整张卡片（保留文字与按钮外观，视觉上就是「卡片被切碎」）
        piece.removeAttribute("id"); // 去掉重复 id
        piece.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); }); // 后代 id 一并清掉
        piece.classList.add("dmShard"); // 追加碎片类（不删 dmCard：保留内边距、字号、配色）
        piece.classList.remove("gone"); // 清掉可能的状态类
        const cx = x0 + cw / 2, cy = y0 + chh / 2; // 该格中心（旋转轴心）
        piece.style.cssText = [ // 覆盖定位与裁剪（inline 优先级最高）
          "position:fixed", // 固定定位（视口坐标）
          "left:" + r.left + "px", "top:" + r.top + "px", // 与原卡完全重合
          "width:" + r.width + "px", "height:" + r.height + "px", // 同尺寸（保证文字位置不跑）
          "margin:0", "transform:none", "transition:none", "opacity:1", // 清掉入场过渡
          "border-radius:0", "box-shadow:none", "pointer-events:none", // 碎片不可点
          "clip-path:inset(" + y0.toFixed(1) + "px " + (r.width - x1).toFixed(1) + "px " + (r.height - y1).toFixed(1) + "px " + x0.toFixed(1) + "px)", // 只露出这一格
          "transform-origin:" + cx.toFixed(1) + "px " + cy.toFixed(1) + "px", // 绕格心旋转
          "z-index:100002", "will-change:transform,opacity" // 提升为合成层
        ].join(";"); // 拼成 CSS 文本
        document.body.appendChild(piece); // 上屏
        shards.push(piece); // 收集
        const fall = (innerHeight - (r.top + cy)) + 60 + Math.random() * 180; // 落到屏幕下方之外（+60~240 缓冲）
        const drift = (Math.random() - 0.5) * 190; // 横向飘移
        const rot = (Math.random() - 0.5) * 620; // 翻转角度
        const delay = col * 12 + Math.random() * 80; // 从左往右逐列剥落（+随机抖动更像纸屑）
        const dur = 1600 + Math.random() * 900; // 下落时长：1.6~2.5 秒（「慢慢」落下）
        piece.animate([ // 三段：静止 → 被气流托起 → 旋转坠落淡出
          { transform: "translate(0px,0px) rotate(0deg)", opacity: 1, offset: 0 }, // 起点
          { transform: "translate(" + (drift * 0.18).toFixed(1) + "px," + (-4 - Math.random() * 16).toFixed(1) + "px) rotate(" + (rot * 0.12).toFixed(1) + "deg)", opacity: 1, offset: 0.16 }, // 先轻抬
          { transform: "translate(" + drift.toFixed(1) + "px," + fall.toFixed(1) + "px) rotate(" + rot.toFixed(1) + "deg)", opacity: 0, offset: 1 } // 坠出屏幕
        ], { duration: dur, delay: delay, easing: "cubic-bezier(.3,.02,.72,.44)", fill: "both" }); // 缓动前半段慢、后半段加速（重力感）
      } // 结束逐列
    } // 结束逐行
    setTimeout(function () { if (mask && mask.parentNode) { mask.parentNode.removeChild(mask); } }, 620); // 遮罩淡出结束后移出文档（页面完全还原）
    setTimeout(function () { shards.forEach(function (s) { if (s.parentNode) { s.parentNode.removeChild(s); } }); }, 2900); // 碎片落完统一回收
    if (typeof sfx !== "undefined" && sfx && typeof sfx.play === "function") { sfx.play("ui"); } // 有音效总线时补一声轻响（无则静默）
  } // 结束 shred

  /* ---------- 三、退出程序（叉号） ---------- */
  function quitApp() { // 立即退出程序
    let asked = false; // 是否成功调用外壳接口
    try { // 外壳桥接可能不存在，全部兜住
      const bridge = (typeof nativeBridge !== "undefined" && nativeBridge) ? nativeBridge : ((typeof detectBridge === "function") ? detectBridge() : null); // 复用现有探测
      if (bridge && bridge.api) { // 有桥
        ["quit_app", "close_window", "quit", "exit_app"].some(function (k) { // 按优先级找退出方法
          if (typeof bridge.api[k] === "function") { // 命中
            try { bridge.api[k](); } catch (e) {} // 调用（忽略异步失败）
            asked = true; // 标记已请求
            return true; // 停止遍历
          } // 结束命中
          return false; // 继续找
        }); // 结束遍历
      } // 结束桥判断
    } catch (e) {} // 忽略探测异常
    try { window.open("", "_self"); window.close(); } catch (e) {} // 浏览器兜底（老技巧：先把自己当脚本窗口再关）
    setTimeout(function () { // 兜底检查：窗口没关掉就上黑幕
      if (document.hidden) { return; } // 已经关了（页面进后台）就什么都不做
      if (document.querySelector(".dmBye")) { return; } // 已有黑幕不重复建
      const bye = document.createElement("div"); // 黑幕容器
      bye.className = "dmBye"; // 样式挂钩
      bye.innerHTML = '<div class="dmByeBox"><div class="dmByeT">程序已退出</div>' + // 标题
        '<p class="dmByeS">当前环境不允许网页自动关闭窗口（浏览器安全限制）。<br>按 <b>Alt+F4</b>，或点下面的按钮关闭。</p>' + // 说明
        '<button class="dmByeBtn" type="button">关闭窗口</button></div>'; // 关闭按钮
      document.body.appendChild(bye); // 上屏
      const btn = bye.querySelector(".dmByeBtn"); // 关闭按钮
      if (btn) { btn.addEventListener("click", function () { try { window.close(); } catch (e) {} bye.classList.add("dim"); }); } // 再试一次关窗，不行就淡成纯黑
      requestAnimationFrame(function () { bye.classList.add("show"); }); // 下一帧淡入
    }, 420); // 420ms 后确认（给外壳接口一点时间）
  } // 结束 quitApp

  /* ---------- 四、启动与开关 ---------- */
  function bindSettings() { // 绑定设置页开关
    const tg = $("dmToggle"); // 开关复选框
    if (!tg) { return; } // 节点缺失（旧页面）跳过
    tg.checked = prefOn(); // 回显当前偏好
    tg.addEventListener("change", function () { // 用户拨动
      try { localStorage.setItem(TIP_KEY, tg.checked ? "1" : "0"); } catch (e) {} // 持久化
      if (typeof toast === "function") { toast(tg.checked ? "已开启：每次启动都弹出温馨提示" : "已关闭：以后启动不再弹出温馨提示"); } // 反馈
    }); // 结束绑定
  } // 结束 bindSettings

  function boot() { // 启动入口
    bindSettings(); // 先同步设置开关（即使不弹也要正确回显）
    const mk = $("dmMask"); // 遮罩
    if (mk) { // 绑定交互
      mask = mk; // 缓存遮罩
      card = $("dmCard"); // 缓存卡片
      okBtn = $("dmOk"); // 缓存确认按钮（必须在 open 之前取到，否则绑定不上）
      const closeBtn = $("dmClose"); // 叉号
      if (closeBtn) { closeBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); quitApp(); }); } // 叉号：立即退出
      if (okBtn) { okBtn.addEventListener("click", function () { if (!ready) { return; } shred(); }); } // 已知悉：冷却后碎裂
      document.addEventListener("keydown", function (e) { // 键盘：冷却后回车/空格等同于「我已知悉」
        if (!opened || !ready) { return; } // 未弹或未解禁
        if (!document.querySelector("#dmMask.show") || document.querySelector(".dmShard")) { return; } // 已开始碎裂
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shred(); } // 快捷确认
      }); // 结束键盘绑定
    } // 结束绑定
    if (!prefOn()) { return; } // 用户关掉了：不弹（但遮罩节点留着，下次手动调用仍可用）
    setTimeout(open, 280); // 等首屏渲染稳定再弹（避免白屏时闪一下）
  } // 结束 boot

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } // 文档未就绪：等 DOM
  else { boot(); } // 已就绪：立即启动
})(); // 结束免责提示模块
