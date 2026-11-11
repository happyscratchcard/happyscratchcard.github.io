// ================= 6.0 新增：设置页（深浅色 / 背景透明 Beta / 高级设置入口） =================
const MODE_KEY = "scratch-mode"; // 深浅色存储键
let systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null; // 系统偏好查询
function applyMode(mode) { // 应用深浅色（auto 跟随系统）
  const eff = mode === "auto" ? (systemDark && systemDark.matches ? "dark" : "light") : mode; // 计算生效值
  document.documentElement.dataset.mode = eff; // 写入根元素驱动 CSS
} // 结束 applyMode
(function initMode() { // 启动恢复深浅色
  const mode = localStorage.getItem(MODE_KEY) || "auto"; // 默认跟随系统
  applyMode(mode); // 立即应用
  if (systemDark) { systemDark.addEventListener("change", function () { if ((localStorage.getItem(MODE_KEY) || "auto") === "auto") { applyMode("auto"); } }); } // 系统切换时 auto 联动
  const group = document.querySelectorAll('input[name="mode"]'); // 三档单选
  group.forEach(function (r) { // 绑定
    r.checked = r.value === mode; // 回显
    r.addEventListener("change", function () { // 切换
      localStorage.setItem(MODE_KEY, r.value); // 持久化
      applyMode(r.value); // 应用
      const g = $("modeGlider"); if (g) { g.style.transform = "translateX(" + ({ light: 0, dark: 100, auto: 200 })[r.value] + "%)"; g.style.background = "linear-gradient(135deg, rgba(120,110,90,.9), rgba(84,74,58,.75))"; g.style.boxShadow = "0 0 14px rgba(0,0,0,.25)"; } // 滑块联动（JS 驱动三档）
    }); // 结束绑定
  }); // 结束遍历
  const g0 = $("modeGlider"); if (g0) { const idx = { light: 0, dark: 1, auto: 2 }[mode] || 0; if (mode !== "light") { g0.style.transform = "translateX(" + idx * 100 + "%)"; g0.style.background = "linear-gradient(135deg, rgba(120,110,90,.9), rgba(84,74,58,.75))"; g0.style.boxShadow = "0 0 14px rgba(0,0,0,.25)"; } } // 启动滑块复位
})(); // 结束 initMode

/* ---------- 背景透明 Beta（6.1 光学近似：外壳实时抓帧，复用 detectBridge / nativeTransparent） ---------- */
const BG_TRANS_KEY = "scratch-bg-transparent"; // 存储键
let liveBgTimer = null; // 实时抓帧轮询句柄
let liveBgBusy = false; // 帧请求去重锁（上一帧未返回不重复请求）
function liveBgEnsure() { // 幂等创建实时背景画布
  let cv = $("liveBg"); // 先找已有节点
  if (!cv) { cv = document.createElement("canvas"); cv.id = "liveBg"; document.body.appendChild(cv); } // 无则创建（z-index -5）
  return cv; // 返回画布
} // 结束 liveBgEnsure
function liveBgStart() { // 启动实时透视：外壳每帧返回窗口背后屏幕截图，画布实时重绘
  const bridge = nativeBridge || detectBridge(); // 探测外壳
  if (!bridge || bridge.type !== "pywebview" || !bridge.api.get_live_frame) { return false; } // 外壳不支持抓帧：放弃
  const cv = liveBgEnsure(); // 画布就绪
  cv.classList.add("on"); // 点亮
  if (liveBgTimer) { clearInterval(liveBgTimer); } // 防重复轮询
  liveBgBusy = false; // 复位锁
  liveBgTimer = setInterval(function () { // 约 15fps 轮询（流畅与开销平衡）
    if (liveBgBusy || document.hidden) { return; } // 忙碌或页面隐藏：跳过本拍
    liveBgBusy = true; // 上锁
    Promise.resolve(bridge.api.get_live_frame()).then(function (f) { // 向外壳要一帧
      liveBgBusy = false; // 解锁
      if (!f || !f.dataUrl) { return; } // 无帧（如抓屏失败）静默跳过
      const img = new Image(); // 帧图像
      img.onload = function () { // 解码完成后绘制
        if (!$("liveBg")) { return; } // 画布可能已被移除
        cv.width = f.w; cv.height = f.h; // 物理像素对齐（避免模糊）
        cv.getContext("2d").drawImage(img, 0, 0); // 整幅绘制（CSS 拉伸铺满视口）
      }; // 结束绘制
      img.src = f.dataUrl; // 触发加载
    }).catch(function () { liveBgBusy = false; }); // 失败解锁
  }, 66); // 66ms ≈ 15fps
  return true; // 启动成功
} // 结束 liveBgStart
function liveBgStop() { // 停止实时透视
  if (liveBgTimer) { clearInterval(liveBgTimer); liveBgTimer = null; } // 停轮询
  liveBgBusy = false; // 复位锁
  const cv = $("liveBg"); if (cv) { cv.classList.remove("on"); } // 熄灭画布（节点保留复用）
} // 结束 liveBgStop
function bgTransApply(on, silent) { // 应用背景透明状态
  if (on) { // 开启
    const bridge = nativeBridge || detectBridge(); // 探测外壳（复用现有机制）
    if (bridge && bridge.type === "pywebview" && bridge.api.get_live_frame && liveBgStart()) { // 外壳支持实时抓帧：光学近似直接生效（airpeg 同款思路）
      document.documentElement.dataset.nativeTransparent = "on"; nativeTransparent = true; // 标记真透视
      $("bgTransStatus").textContent = "🪟 实时透视桌面 · 光学近似（15fps 跟随窗口背后画面）"; $("bgTransStatus").style.color = "#2f7d47"; // 状态
      if ($("wpLayer")) { $("wpLayer").classList.remove("on"); } // 关壁纸层（实时桌面优先）
    } else if (bridge && ((bridge.type === "electron" && bridge.api.isTransparent) || (bridge.type === "pywebview" && bridge.api.is_transparent))) { // 外壳支持透明窗口查询（Electron 等）
      Promise.resolve(bridge.type === "electron" ? bridge.api.isTransparent() : bridge.api.is_transparent()).then(function (flag) { // 查询
        if (flag) { document.documentElement.dataset.nativeTransparent = "on"; nativeTransparent = true; $("bgTransStatus").textContent = "🖥 外壳为透明窗口 · 已直接透出实时桌面"; $("bgTransStatus").style.color = "#2f7d47"; if ($("wpLayer")) { $("wpLayer").classList.remove("on"); } } // 真透明生效
        else { bgTransFallback(); } // 外壳未开透明：降级
      }).catch(bgTransFallback); // 查询失败降级
    } else { bgTransFallback(); } // 无外壳：降级
  } else { // 关闭
    liveBgStop(); // 停实时透视
    delete document.documentElement.dataset.nativeTransparent; nativeTransparent = false; // 摘除真透明
    $("bgTransStatus").textContent = "已关闭 · 恢复常规背景"; $("bgTransStatus").style.color = ""; // 状态
    if (liquidOn) { $("wpLayer") && $("wpLayer").classList.add("on"); } // 液态玻璃开着则恢复壁纸层
  } // 结束开关分支
  if (!silent) { toast(on ? "背景透明 Beta 已开启" : "背景透明已关闭"); } // 反馈
} // 结束 bgTransApply
function bgTransFallback() { // 不支持环境的降级：回退液态玻璃壁纸模式
  toast("当前环境不支持真实透明，已用壁纸层近似"); // 规格要求文案
  $("bgTransStatus").textContent = "当前环境不支持真实透明 · 已回退液态玻璃壁纸模式"; $("bgTransStatus").style.color = "#a3642e"; // 状态
  setLiquid(true, true); // 静默开启液态玻璃兜底
} // 结束 bgTransFallback
$("bgTransToggle").addEventListener("change", function () { // 拨动背景透明开关
  const bridge = nativeBridge || detectBridge(); // 先探测外壳
  const inShell = !!(bridge && bridge.type === "pywebview" && bridge.api.get_live_frame); // 桌面外壳内（支持实时抓帧）
  if (this.checked) { // 开启
    if (!inShell && !confirm("背景透明 Beta 在普通浏览器内无法真透明。\n将回退为液态玻璃壁纸模式近似。\n继续开启吗？")) { this.checked = false; return; } // 仅浏览器环境保留确认（6.1：外壳内不再弹系统 confirm，避免出现 127.0.0.1:端口 标题的突兀弹窗）
    localStorage.setItem(BG_TRANS_KEY, "1"); bgTransApply(true); // 存与用
  } else { localStorage.setItem(BG_TRANS_KEY, "0"); bgTransApply(false); } // 关闭
}); // 结束开关绑定
if (localStorage.getItem(BG_TRANS_KEY) === "1") { $("bgTransToggle").checked = true; bgTransApply(true, true); } // 6.1 启动恢复：上次开着则静默重开
$("btnAdvSettings").addEventListener("click", function () { // 高级设置入口（迁移自顶栏管理员按钮）
  $("pwdMask").classList.add("show"); // 弹出密码验证遮罩（复用）
  $("pwdInput").value = ""; // 清输入
  setTimeout(function () { $("pwdInput").focus(); }, 60); // 聚焦
}); // 结束入口

