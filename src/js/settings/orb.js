// ================= 6.0 新增：悬浮球与向上 Tab（3.2） =================
(function initOrb() { // 自执行：拖拽 + 展开 + 记忆位置
  const orb = $("orb"), tab = $("orbTab"); if (!orb || !tab) { return; } // 节点保护
  try { const p = JSON.parse(localStorage.getItem("scratch-orb-pos")); if (p && typeof p.left === "number") { orb.style.left = Math.max(4, Math.min(window.innerWidth - 62, p.left)) + "px"; orb.style.bottom = "auto"; orb.style.top = Math.max(4, Math.min(window.innerHeight - 62, p.top)) + "px"; } } catch (e) {} // 恢复位置（容错）
  let drag = null; // 拖拽状态
  orb.addEventListener("pointerdown", function (e) { // 按下开始
    drag = { sx: e.clientX, sy: e.clientY, l: orb.offsetLeft, t: orb.offsetTop, moved: false }; // 记录起点
    orb.setPointerCapture(e.pointerId); // 捕获指针
  }); // 结束按下
  orb.addEventListener("pointermove", function (e) { // 移动拖拽
    if (!drag) { return; } // 未按下忽略
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; // 位移
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { drag.moved = true; } // 超阈值算拖拽
    if (drag.moved) { // 拖拽中
      orb.style.left = Math.max(4, Math.min(window.innerWidth - 62, drag.l + dx)) + "px"; // 左右夹取
      orb.style.top = Math.max(4, Math.min(window.innerHeight - 62, drag.t + dy)) + "px"; // 上下夹取
      orb.style.bottom = "auto"; // 改用 top 定位
    } // 结束拖拽分支
  }); // 结束移动
  orb.addEventListener("pointerup", function (e) { // 松开
    if (drag && drag.moved) { // 是拖拽：存位置
      localStorage.setItem("scratch-orb-pos", JSON.stringify({ left: orb.offsetLeft, top: orb.offsetTop })); // 持久化
    } else { // 是点击：开合 Tab
      tab.classList.toggle("show"); // 切换展开态（指示器默认 0 档）
    } // 结束分支
    drag = null; // 清状态
  }); // 结束松开
  document.querySelectorAll("#orbTab .orbItem").forEach(function (it) { // Tab 五项绑定（6.2 增今日运势）
    it.addEventListener("click", function () { // 点击跳转
      tab.style.setProperty("--orbIdx", it.dataset.oi); // 指示器滑动
      if (!it.dataset.goto) { tab.classList.remove("show"); return; } // 6.2：无视图项（今日运势）只收起，由专用绑定开弹窗
      showView(it.dataset.goto); // 切视图（复用现有系统）
      tab.classList.remove("show"); // 收起
    }); // 结束绑定
  }); // 结束遍历
  document.addEventListener("pointerdown", function (e) { // 点击空白收起
    if (tab.classList.contains("show") && !tab.contains(e.target) && e.target !== orb && !orb.contains(e.target)) { tab.classList.remove("show"); } // 焦点在外则收
  }); // 结束空白监听
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { tab.classList.remove("show"); } }); // Esc 收起
})(); // 结束 initOrb

