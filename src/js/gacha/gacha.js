// ================= 6.0 新增：扭蛋机（Three.js 3D） =================
let gachaScene = null; // 场景句柄
function gachaEnsure() { // 懒初始化扭蛋机场景
  if (gachaScene || !window.THREE || !webglOK()) { if (!gachaScene) { noWebglFallback("gachaStage", "🥚"); } return; } // 已建或降级
  const stage = $("gachaStage"); // 容器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); stage.appendChild(renderer.domElement); // 渲染器
  const scene = new THREE.Scene(); // 场景
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100); camera.position.set(0, 1.6, 5.6); camera.lookAt(0, 0.4, 0); // 相机
  scene.add(new THREE.AmbientLight(0xffffff, 0.85)); // 环境光
  const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(2, 5, 3); scene.add(dl); // 主光
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 2.4, 32), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4 })); body.position.y = -0.4; scene.add(body); // 红色机身
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.1 })); glass.position.y = 1.35; scene.add(glass); // 玻璃球罩
  const GACHA_EGG_N = 12; // 蛋舱容量：有限颗数，扭一颗少一颗（真实感核心）
  const eggs = []; // 玻璃罩内的彩蛋群（有限库存）
  function eggSlot(i) { // 第 i 颗蛋在球罩内的堆放位（环形 + 高度错落）
    const a = (i / GACHA_EGG_N) * Math.PI * 2, r = 0.55 + (i % 2) * 0.25; // 环形角度与半径
    return { x: Math.cos(a) * r, y: 1.05 + ((i * 37) % 60) / 130, z: Math.sin(a) * r }; // 槽位坐标
  } // 结束 eggSlot
  function makeEgg(color) { // 造一颗蛋（球体 + 颜色）
    return new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.35 })); // 蛋体
  } // 结束 makeEgg
  for (let i = 0; i < GACHA_EGG_N; i++) { // 铺满蛋舱
    const cfg = GACHA_CFG.pool[i % GACHA_CFG.pool.length]; // 轮流取颜色
    const egg = makeEgg(cfg.color); // 蛋体
    const s = eggSlot(i); egg.position.set(s.x, s.y, s.z); // 落位
    egg.userData = { vy: 0, settled: true, slot: s }; // 物理状态：静止在槽位
    scene.add(egg); eggs.push(egg); // 入场
  } // 结束蛋群
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.2), new THREE.MeshStandardMaterial({ color: 0xf6c775, roughness: 0.5 })); tray.position.set(0, -1.75, 0.4); scene.add(tray); // 出蛋托盘
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0x2c2a26, metalness: 0.5 })); knob.position.set(0, -0.1, 1.42); knob.rotation.x = Math.PI / 2; scene.add(knob); // 出蛋旋钮
  gachaScene = { renderer: renderer, scene: scene, camera: camera, stage: stage, eggs: eggs, body: body, knob: knob, dropEgg: null, shakeT: 0, refillQ: [], onEggDone: null, clock: new THREE.Clock() }; // 存句柄（含机身/旋钮引用与物理队列）
  gachaScene.makeEgg = makeEgg; gachaScene.eggSlot = eggSlot; // 暴露给按钮处理器（补货造蛋 / 槽位计算用）
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } // 自适应
  resize(); if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); } // 观察尺寸
  const TRAY_Y = -1.62; // 托盘面高度（蛋的停泊线）
  function eggPhysics(egg, dt, floorY, restitution) { // 单颗蛋的重力-弹跳-静止模拟（简化刚体）
    egg.userData.vy -= 7 * dt; // 重力加速度
    egg.position.y += egg.userData.vy * dt; // 位移
    if (egg.position.y <= floorY) { // 触底
      egg.position.y = floorY; // 贴地
      if (egg.userData.vy < -0.5) { egg.userData.vy = -egg.userData.vy * restitution; } // 反弹（能量衰减）
      else { egg.userData.vy = 0; egg.userData.settled = true; return true; } // 速度过小视为静止
    } // 结束触底
    return false; // 尚未静止
  } // 结束 eggPhysics
  gachaScene.loop = function () { // 渲染循环
    const dt = Math.min(0.05, gachaScene.clock.getDelta()); // 帧间隔（上限防跳帧穿透）
    const s = gachaScene; // 句柄简称
    s.eggs.forEach(function (e, i) { // 蛋群
      if (e.userData.settled) { e.rotation.y += 0.004 + (i % 3) * 0.002; } // 静止蛋缓慢自转
      else { if (eggPhysics(e, dt, e.userData.slot.y, 0.3)) { e.position.x = e.userData.slot.x; e.position.z = e.userData.slot.z; } } // 补货下落蛋：弹跳后归位槽位
    }); // 结束蛋群遍历
    if (s.shakeT > 0) { // 出蛋时整机晃动
      s.shakeT -= dt; // 倒计时
      s.body.rotation.z = Math.sin(s.shakeT * 46) * 0.022 * s.shakeT; // 衰减正弦晃动
      s.knob.rotation.y += dt * 9 * s.shakeT; // 旋钮跟着转（出蛋手感）
    } else { s.body.rotation.z = 0; } // 静止归零
    if (s.dropEgg) { // 出蛋通道中的蛋
      if (eggPhysics(s.dropEgg, dt, TRAY_Y, 0.42) && s.onEggDone) { const f = s.onEggDone; s.onEggDone = null; f(); } // 落托盘弹跳至静止后回调结算
    } // 结束出蛋分支
    renderer.render(scene, camera); // 绘制
  }; // 结束 loop
  renderer.setAnimationLoop(gachaScene.loop); // 启动
} // 结束 gachaEnsure
$("btnGachaTurn").addEventListener("click", function () { // 投币扭蛋
  gachaEnsure(); // 场景就绪
  if (gachaScene && (gachaScene.refillQ.length || (!gachaScene.eggs.length))) { toast("蛋舱空了，店员补货中，稍等一下～"); return; } // 补货期间禁止投币
  const cost = Math.max(0.01, +GACHA_CFG.cost || 2); // 单价
  if (balance < cost) { toast("余额不足，先去赚点票钱～"); return; } // 校验
  payMoney(cost); // 扣款
  $("gachaCostView").textContent = cost.toFixed(2); $("gachaBalView").textContent = balance.toFixed(2); // 刷新显示
  let total = 0; for (const p of GACHA_CFG.pool) { total += (+p.w || 0); } // 权重和
  let r = Math.random() * total, hit = GACHA_CFG.pool[GACHA_CFG.pool.length - 1]; // 骰子与默认命中
  for (const p of GACHA_CFG.pool) { r -= (+p.w || 0); if (r < 0) { hit = p; break; } } // 加权命中
  let settleMs = 300; // 结算等待（无 3D 兜底）
  if (gachaScene) { // 3D：从蛋舱「取出一颗」经出蛋口落到托盘（扭一颗少一颗）
    const s = gachaScene; // 句柄简称
    if (s.dropEgg) { s.scene.remove(s.dropEgg); s.dropEgg = null; } // 收走上一次托盘里的蛋
    let idx = s.eggs.findIndex(function (e) { return e.material.color.getHexString() === String(hit.color).replace("#", "").toLowerCase(); }); // 优先取同色蛋（视觉与奖品一致）
    if (idx < 0) { // 没有同色蛋：取离出口最近的一颗（最低最靠前）
      idx = 0; for (let i = 1; i < s.eggs.length; i++) { if (s.eggs[i].position.y - s.eggs[i].position.z < s.eggs[idx].position.y - s.eggs[idx].position.z) { idx = i; } } // 最低最前
      s.eggs[idx].material.color.set(new THREE.Color(hit.color)); // 重着色为奖品色（视觉真实）
    } // 结束同色回退
    const egg = s.eggs.splice(idx, 1)[0]; // 从蛋舱库存移除（少了一颗的来源）
    $("gachaEggsView").textContent = s.eggs.length; // 刷新蛋舱余量
    egg.position.set(0, 0.12, 0.5); egg.userData = { vy: 0, settled: false }; // 放到出蛋口准备下落
    s.shakeT = 0.55; s.dropEgg = egg; s.shakeT && (s.body.rotation.z = 0); // 机身晃动 + 进入出蛋通道
    settleMs = 1150; // 落蛋 + 弹跳静止的等待时长
    s.onEggDone = function () { // 蛋在托盘停稳后再触发补货判断
      if (!s.eggs.length && !s.refillQ.length) { // 蛋舱清空且未在补货
        setTimeout(function () { // 稍等再补（让「空」被看见）
          toast("蛋舱空了，店员补货中…"); // 提示
          for (let i = 0; i < 12; i++) { // 补满 12 颗
            const cfg = GACHA_CFG.pool[(i + Math.floor(Math.random() * 7)) % GACHA_CFG.pool.length]; // 随机颜色
            const ne = s.makeEgg(cfg.color); // 新蛋
            const slot = s.eggSlot(i); ne.position.set(slot.x, 2.5 + i * 0.12, slot.z); // 从罩顶上方错峰落下
            ne.userData = { vy: 0, settled: false, slot: slot }; // 下落物理状态
            s.scene.add(ne); s.eggs.push(ne); s.refillQ.push(ne); // 入舱入队
            setTimeout(function () { const k = s.refillQ.indexOf(ne); if (k >= 0) { s.refillQ.splice(k, 1); } $("gachaEggsView").textContent = s.eggs.filter(function (e) { return e.userData.settled; }).length; }, 900 + i * 130); // 逐颗落稳后从队列移除并刷新计数
          } // 结束补货循环
        }, 1400); // 结束补货延时
      } // 结束补货判断
    }; // 结束 onEggDone
  } // 结束 3D 分支
  setTimeout(function () { // 延迟结算（等蛋落盘）
    const res = $("gachaResult"); res.classList.add("show"); // 结果横幅
    let prize = 0, detail = ""; // 奖额与详情
    if (hit.prizeType === "cash") { // 现金奖
      prize = +hit.amt || 0; gainMoney(prize); detail = "现金 ¥" + prize.toFixed(2); // 入账
      res.innerHTML = '<span class="grBig">🥚 ' + hit.color + " 蛋 → 现金 ¥" + prize.toFixed(2) + "</span>"; // 文案
    } else if (hit.prizeType === "ticket") { // 免费福卡奖
      if (GACHA_CFG.freeTicketMode === "real") { // 真票模式：走合成福卡同款流程
        if (savedBatch && !confirm("上一批还有未完成的票，免费福卡将作废旧票（已付款不退），继续吗？")) { res.innerHTML = "🥚 奖品已折算：暂停发放（现有批次进行中）"; pushPlayHist("gacha", cost, 0, "福卡暂缓"); return; } // 覆盖确认
        setTier(0); remainBuy = 1; batchSeq = 1; batchCount = 1; qty = 1; renderQty(); batch = []; drawnCount = 0; zTop = 100; buildStack(); showView("Wheel"); // 洗一张福卡上桌
        res.innerHTML = "🎫 恭喜！免费福卡已上桌，去抽卡页开刮"; detail = "免费福卡"; // 文案
      } else { prize = +hit.amt || 2; gainMoney(prize); detail = "福卡折现 ¥" + prize.toFixed(2); res.innerHTML = "🎫 福卡折现 ¥" + prize.toFixed(2); } // 折现模式
    } else { // 空奖
      detail = "空奖"; res.innerHTML = "💨 白蛋一颗… 机器都替你尴尬"; // 文案
    } // 结束三分支
    pushPlayHist("gacha", cost, prize, detail); // 写战绩
    $("gachaBalView").textContent = balance.toFixed(2); // 同步余额
  }, settleMs); // 等 3D 蛋落托盘静止（无 3D 时 300ms 兜底）
}); // 结束扭蛋

