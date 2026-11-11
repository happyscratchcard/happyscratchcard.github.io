// ================= 6.0 新增：娃娃机（Three.js 3D） =================
let clawScene = null; // 场景句柄
let clawShelf = loadCfg("scratch-claw-shelf", []); // 展示架（容量由配置控制）
let clawPity = parseInt(localStorage.getItem("scratch-claw-pity"), 10) || 0; // 保底连败计数
let clawGoldUntil = 0; // 6.2 金爪时段结束时间戳（0 = 未激活；激活期间成功率 ×2）
let clawGoldNext = 6 + Math.floor(Math.random() * 6); // 6.2 距下次金爪时段的下爪次数（6~11 次内随机触发）
function clawSave() { // 持久化展示架与保底
  localStorage.setItem("scratch-claw-shelf", JSON.stringify(clawShelf)); // 展示架
  localStorage.setItem("scratch-claw-pity", clawPity); // 保底计数
  renderClawShelf(); // 刷新展示架 UI
} // 结束 clawSave
function clawEnsure() { // 懒初始化娃娃机场景
  if (clawScene || !window.THREE || !webglOK()) { if (!clawScene) { noWebglFallback("clawStage", "🧸"); } return; } // 已建或降级
  const stage = $("clawStage"); // 容器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); stage.appendChild(renderer.domElement); // 渲染器
  const scene = new THREE.Scene(); // 场景
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100); camera.position.set(0, 1.15, 8.8); camera.lookAt(0, 0.35, 0); // 相机（6.1：拉远完整呈现立式街机）
  scene.add(new THREE.AmbientLight(0xffffff, 0.85)); // 环境光
  const dl = new THREE.DirectionalLight(0xfff2cc, 0.8); dl.position.set(3, 6, 4); scene.add(dl); // 主光
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.45 }); // 机柜主色（经典娃娃机红）
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x8e2440, roughness: 0.6 }); // 机柜深红
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 2.7), darkMat); base.position.set(0, -1.55, 0); scene.add(base); // 底柜（立式机柜下半段）
  const backP = new THREE.Mesh(new THREE.BoxGeometry(3.9, 3.8, 0.12), redMat); backP.position.set(0, 0.7, -1.09); scene.add(backP); // 背板
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.8, 2.3), redMat); sideL.position.set(-1.99, 0.7, 0); scene.add(sideL); // 左侧板
  const sideR = sideL.clone(); sideR.position.x = 1.99; scene.add(sideR); // 右侧板（镜像克隆）
  const topP = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.12, 2.4), redMat); topP.position.set(0, 2.66, 0); scene.add(topP); // 顶板
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 })); marquee.position.set(0, 2.95, -0.55); scene.add(marquee); // 顶部灯箱（机头）
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.86, 3.6, 0.06), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.14, roughness: 0.08 })); glass.position.set(0, 0.7, 1.12); scene.add(glass); // 前玻璃（透明展示仓）
  const floorP = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 2.2), darkMat); floorP.position.set(0, -0.92, 0); scene.add(floorP); // 舱内底板（玩偶堆放面）
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x2c2a26 })); rail.position.set(0, 1.65, 0); scene.add(rail); // 顶部 X 向导轨
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 1.5), new THREE.MeshStandardMaterial({ color: 0x8e2440, roughness: 0.6 })); chute.position.set(1.55, -0.72, 0); scene.add(chute); // 取物口（成功后玩偶落入这里）
  const consoleP = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.34, 1.1), redMat); consoleP.position.set(0, -1.28, 1.72); scene.add(consoleP); // 前伸控制台（摇杆面板）
  const joyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.5 })); joyBase.position.set(-0.9, -1.06, 1.72); scene.add(joyBase); // 摇杆底座
  const joyStick = new THREE.Group(); joyStick.position.set(-0.9, -1.0, 1.72); scene.add(joyStick); // 摇杆组（杆身 + 红球，可倾斜反馈）
  const joyRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.6, roughness: 0.3 })); joyRod.position.y = 0.25; joyStick.add(joyRod); // 摇杆杆身
  const joyBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), new THREE.MeshStandardMaterial({ color: 0xd64541, roughness: 0.3 })); joyBall.position.y = 0.55; joyStick.add(joyBall); // 红色摇杆球（按住它拖动）
  const bigBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xd64541, roughness: 0.35 })); bigBtn.position.set(0.9, -1.05, 1.72); scene.add(bigBtn); // 大红按钮（对应「下爪」）
  const claw = new THREE.Group(); // 爪子组（车体 + Z 向伸缩轨 + 爪杆 + 三爪齿）
  const railZ = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 1.8), new THREE.MeshStandardMaterial({ color: 0x2c2a26 })); railZ.position.y = 0.42; claw.add(railZ); // Z 向伸缩轨（随爪组横移，视觉父挂）
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.6 })); pole.position.y = 0.18; claw.add(pole); // 爪杆（下接三爪齿）
  const prongMat = new THREE.MeshStandardMaterial({ color: 0xd64541, metalness: 0.4, roughness: 0.4 }); // 爪齿材质（红色）
  const prongs = []; // 爪齿引用（开合动画用）
  for (let i = 0; i < 3; i++) { // 三根爪齿
    const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.42, 8), prongMat); // 齿体
    const a = (i / 3) * Math.PI * 2; // 环形角度
    pr.userData = { openZ: Math.cos(a) * 0.5, openX: -Math.sin(a) * 0.5 }; // 记录「张开」姿态角（闭合即 0）
    pr.position.set(Math.cos(a) * 0.1, -0.05, Math.sin(a) * 0.1); // 环形分布
    claw.add(pr); prongs.push(pr); // 入组
  } // 结束爪齿
  claw.position.set(0, 1.3, 0); scene.add(claw); // 初始位（顶部导轨中点）
  function makeDoll(i) { // 造一只玩偶（按稀有度配色的小人球，供初始铺箱与补货共用）
    const cfg = CLAW_CFG.dolls[i % CLAW_CFG.dolls.length]; // 轮流取种类
    const bodyCol = { 普通: 0xf1c40f, 稀有: 0x3498db, 史诗: 0x9b59b6, 传说: 0xe74c3c }[cfg.rarity] || 0xf1c40f; // 按稀有度配色
    const d = new THREE.Group(); // 玩偶组
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.6 })); d.add(b); // 身体球
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.6 })); h.position.y = 0.26; d.add(h); // 头球
    d.userData.cfg = cfg; // 记住种类（补货同款）
    return d; // 返回玩偶
  } // 结束 makeDoll
  const dolls3d = []; // 箱内玩偶（有限只，被抓走就少一只）
  for (let i = 0; i < 8; i++) { // 八只箱内玩偶
    const d = makeDoll(i); // 造玩偶
    const a = (i / 8) * Math.PI * 2; d.position.set(Math.cos(a) * (0.9 + (i % 3) * 0.35), -0.85 + ((i * 29) % 30) / 100, Math.sin(a) * (0.5 + (i % 2) * 0.25)); // 箱内散布
    d.userData = Object.assign(d.userData, { vy: 0, vx: 0, settled: true }); // 物理状态：静止
    scene.add(d); dolls3d.push(d); // 入场
  } // 结束箱内玩偶
  const FLOOR_Y = -0.85; // 玩偶堆底面高度
  const CLAW_TOP = 1.3; // 导轨行程上限（爪子回位点）
  const CHUTE_X = 1.7; // 取物口水平位置（成功后运到这里松爪）
  clawScene = { renderer: renderer, scene: scene, camera: camera, stage: stage, claw: claw, prongs: prongs, joyStick: joyStick, marquee: marquee, dolls: dolls3d, busy: false, phase: "idle", t: 0, ok: false, slipped: false, gripT: 0, target: null, onDone: null, clock: new THREE.Clock() }; // 存句柄（6.2 补灯箱引用供金爪金光）
  clawScene.spawnDoll = function () { // 补货：从罩顶掉一只新玩偶进箱
    const d = makeDoll(clawScene.dolls.length); // 造玩偶
    d.position.set((Math.random() * 2 - 1) * 1.2, 1.7, (Math.random() * 2 - 1) * 0.6); // 罩顶随机位
    d.userData = Object.assign(d.userData, { vy: 0, vx: 0, settled: false }); // 下落物理状态
    clawScene.scene.add(d); clawScene.dolls.push(d); // 入箱
  }; // 结束 spawnDoll
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } // 自适应
  resize(); if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); } // 观察尺寸
  function prongPose(open01) { // 爪齿开合插值：1=全张 0=全闭（夹紧动画）
    for (const pr of clawScene.prongs) { pr.rotation.z = pr.userData.openZ * open01; pr.rotation.x = pr.userData.openX * open01; } // 在张开/闭合两姿态间线性过渡
  } // 结束 prongPose
  // ---- 红色摇杆交互（6.1）：按住球体附近拖动 → 夹爪朝对应方向移动 ----
  const joy = { active: false, sx: 0, sy: 0 }; // 摇杆拖拽状态
  function joyScreen() { // 摇杆球心投影到屏幕像素坐标
    const v = new THREE.Vector3(); joyBall.getWorldPosition(v); v.project(camera); // 世界坐标 → NDC
    const r = stage.getBoundingClientRect(); // 容器矩形
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top }; // 换算屏幕像素
  } // 结束 joyScreen
  stage.addEventListener("pointerdown", function (e) { // 按下：命中摇杆球附近才开始推杆
    if (!clawScene || clawScene.busy) { return; } // 状态机运行中禁止推杆
    const p = joyScreen(); // 球心屏幕坐标
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 64) { return; } // 64px 半径外不算握杆
    joy.active = true; joy.sx = e.clientX; joy.sy = e.clientY; // 记录起点
    try { stage.setPointerCapture(e.pointerId); } catch (err) {} // 捕获指针（拖出容器仍有效）
  }); // 结束按下
  stage.addEventListener("pointermove", function (e) { // 推动：屏幕位移增量映射为夹爪 X/Z 移动
    if (!joy.active || !clawScene) { return; } // 未握杆忽略
    const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy; // 本拍屏幕位移
    joy.sx = e.clientX; joy.sy = e.clientY; // 增量式：以当前点为新起点
    const c = clawScene.claw; // 爪组
    c.position.x = Math.max(-1.6, Math.min(1.6, c.position.x + dx * 0.0042)); // 左右推动 → X 向移动
    c.position.z = Math.max(-0.8, Math.min(0.8, c.position.z + dy * 0.0042)); // 前后推动 → Z 向移动（向下推 = 靠近玻璃）
    clawScene.joyStick.rotation.z = Math.max(-0.35, Math.min(0.35, -dx * 0.02)); // 杆身倾斜反馈（视觉）
    clawScene.joyStick.rotation.x = Math.max(-0.35, Math.min(0.35, dy * 0.02)); // 前后倾斜反馈
  }); // 结束推动
  function joyRelease() { // 松手：摇杆回正
    joy.active = false; // 结束握杆
    if (clawScene && clawScene.joyStick) { clawScene.joyStick.rotation.set(0, 0, 0); } // 杆身复位
  } // 结束 joyRelease
  stage.addEventListener("pointerup", joyRelease); // 松开
  stage.addEventListener("pointercancel", joyRelease); // 取消（系统接管指针）
  function dollPhysics(d, dt, floorY) { // 玩偶刚体模拟：重力 + 水平滑 + 弹跳衰减 + 摩擦（松爪失败坠落/补货下落共用）
    d.userData.vy -= 6.5 * dt; // 重力加速度（参考 CSDN 文章：density 0.3 对应的轻盈手感）
    d.position.y += d.userData.vy * dt; d.position.x += d.userData.vx * dt; // 位移积分
    if (d.position.y <= floorY) { // 触底
      d.position.y = floorY; // 贴地
      if (d.userData.vy < -0.6) { d.userData.vy = -d.userData.vy * 0.35; d.userData.vx *= 0.55; } // 反弹（能量衰减，参考 restitution 0.35）
      else { d.userData.vy = 0; d.userData.vx *= 0.8; if (Math.abs(d.userData.vx) < 0.02) { d.userData.vx = 0; d.userData.settled = true; } } // 速度过小：摩擦滑行至静止
    } // 结束触底
    d.position.x = Math.max(-1.7, Math.min(1.7, d.position.x)); d.position.z = Math.max(-0.85, Math.min(0.85, d.position.z)); // 箱壁约束
  } // 结束 dollPhysics
  clawScene.loop = function () { // 渲染循环（状态机：travel 移动 → down 下爪 → grip 夹紧 → lift 提升 → carry 运送 → release 松爪 → return 复位）
    const dt = Math.min(0.05, clawScene.clock.getDelta()); // 帧间隔（上限防跳帧穿透）
    const s = clawScene, c = s.claw; // 句柄简称
    s.t += dt; // 累计时间（摆动用）
    for (const d of s.dolls) { if (!d.userData.settled) { dollPhysics(d, dt, d.userData.chute ? -1.05 : FLOOR_Y); } } // 所有未静止玩偶跑物理（取物口内底面更低）
    switch (s.phase) { // 状态机分发（参考文章：所有状态变更必须走统一入口，这里以 phase 字符串驱动）
      case "idle": // 待机：爪子轻微摆动（悬挂感）
        c.rotation.z = Math.sin(s.t * 1.6) * 0.02; // 小幅钟摆
        break; // 结束待机
      case "travel": // 水平移动到落爪点上方（6.1：X/Z 双轴；摇杆已就位时几乎瞬时完成）
        c.position.x += Math.sign(s.claw.userData.tx - c.position.x) * Math.min(1.8 * dt, Math.abs(s.claw.userData.tx - c.position.x)); // X 匀速趋近
        c.position.z += Math.sign((s.claw.userData.tz || 0) - c.position.z) * Math.min(1.8 * dt, Math.abs((s.claw.userData.tz || 0) - c.position.z)); // Z 匀速趋近
        if (Math.abs(c.position.x - s.claw.userData.tx) < 0.01 && Math.abs(c.position.z - (s.claw.userData.tz || 0)) < 0.01) { s.phase = "down"; } // 双轴到位 → 下爪
        break; // 结束移动
      case "down": // 垂直下爪（恒速下落，参考文章 linearVelocity 直接赋值法）
        c.position.y -= 1.35 * dt; // 匀速下降
        if (s.target && c.position.y <= s.target.position.y + 0.38) { s.phase = "grip"; s.gripT = 0; const res = $("clawResult"); res.classList.add("show"); res.innerHTML = "😨 夹住了……能带出来吗？"; } // 触到玩偶 → 夹紧
        else if (!s.target && c.position.y <= -0.5) { s.phase = "grip"; s.gripT = 0; } // 无目标兜底
        break; // 结束下爪
      case "grip": // 夹紧保持（参考文章 gripTimer 计时，不用帧数硬编码）
        s.gripT += dt; prongPose(Math.max(0, 1 - s.gripT / 0.35)); // 0.35s 内收拢爪齿
        if (s.gripT >= 0.6) { s.phase = "lift"; } // 保持 0.6s → 提升
        break; // 结束夹紧
      case "lift": // 提升（成功：玩偶跟随爪子；失败：中途打滑松爪）
        c.position.y += 1.0 * dt; // 匀速提升
        if (s.ok && s.target) { s.target.position.set(c.position.x, c.position.y - 0.4, 0); s.target.rotation.z = Math.sin(s.t * 9) * 0.06; } // 成功：玩偶挂在爪下微摆
        if (!s.ok && !s.slipped && c.position.y >= 0.45) { // 失败：升到半途爪子打滑
          s.slipped = true; prongPose(1); // 松爪
          s.target.userData.settled = false; s.target.userData.chute = false; // 重新进入物理
          s.target.userData.vx = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.5); s.target.userData.vy = -0.2; // 侧向甩出 + 惯性下坠（参考文章 release 初速度）
          s.target.rotation.z = 0; // 摆动归零
        } // 结束打滑
        if (!s.ok && s.slipped) { s.phase = "return"; } // 失败已打滑 → 直接回位
        else if (c.position.y >= CLAW_TOP) { c.position.y = CLAW_TOP; s.phase = s.ok ? "carry" : "return"; } // 到顶：成功去运送，失败回位
        break; // 结束提升
      case "carry": // 成功运送：水平移向取物口（吊着玩偶晃动）
        c.position.x += Math.min(1.6 * dt, CHUTE_X - c.position.x); // 匀速右移
        c.position.z += Math.sign(0 - c.position.z) * Math.min(1.2 * dt, Math.abs(c.position.z)); // 6.1：Z 收回中轴（取物口在 Z=0）
        c.rotation.z = Math.sin(s.t * 7) * 0.07; // 吊摆
        if (s.target) { s.target.position.set(c.position.x, c.position.y - 0.4, 0); s.target.rotation.z = Math.sin(s.t * 9) * 0.06; } // 玩偶跟随
        if (c.position.x >= CHUTE_X - 0.02) { s.phase = "release"; s.gripT = 0; } // 到口 → 松爪
        break; // 结束运送
      case "release": // 松爪放玩偶入取物口
        s.gripT += dt; prongPose(Math.min(1, s.gripT / 0.25)); // 0.25s 张开
        if (s.gripT >= 0.25 && s.target && !s.target.userData.chute) { // 张开完成：玩偶脱落
          s.target.userData.settled = false; s.target.userData.chute = true; // 进入取物口物理（底面更低）
          s.target.userData.vx = 0.5; s.target.userData.vy = -0.3; // 向口内滑落
          s.target.userData.collected = true; // 标记已被抓走
        } // 结束脱落
        if (s.gripT >= 0.7) { s.phase = "return"; } // 稍停 → 回位
        break; // 结束松爪
      case "return": // 回位：升到顶 + 水平回中
        c.position.y = Math.min(CLAW_TOP, c.position.y + 1.3 * dt); // 先升
        if (c.position.y >= CLAW_TOP - 0.01) { c.position.x = Math.max(0, c.position.x - 1.6 * dt); } // X 回中
        c.position.z += Math.sign(0 - c.position.z) * Math.min(1.2 * dt, Math.abs(c.position.z)); // 6.1：Z 回中
        c.rotation.z *= (1 - Math.min(1, dt * 6)); // 摆动衰减
        if (c.position.y >= CLAW_TOP - 0.01 && c.position.x <= 0.01) { // 到家
          c.position.set(0, CLAW_TOP, 0); c.rotation.z = 0; prongPose(1); s.phase = "idle"; s.busy = false; // 归位并解锁
          if (s.ok && s.target) { s.scene.remove(s.target); const k = s.dolls.indexOf(s.target); if (k >= 0) { s.dolls.splice(k, 1); } } // 成功：玩偶已入袋，从箱内移除
          if (s.dolls.length < 5) { for (let i = s.dolls.length; i < 6; i++) { s.spawnDoll(); } } // 补货：箱内不足 5 只时补到 6 只
          if (s.onDone) { const f = s.onDone; s.onDone = null; f(); } // 状态机跑完 → 结算回调
        } // 结束到家
        break; // 结束回位
    } // 结束状态机
    clawGoldTick(); // 6.2：金爪时段灯箱金光与倒计时徽章（每帧）
    renderer.render(scene, camera); // 绘制
  }; // 结束 loop
  renderer.setAnimationLoop(clawScene.loop); // 启动
} // 结束 clawEnsure
function renderClawShelf() { // 渲染展示架与统计行
  const wrap = $("clawShelf"); if (!wrap) { return; } // 节点保护
  const cap = Math.max(1, +CLAW_CFG.shelfCap || 12); // 容量
  $("clawShelfCount").textContent = clawShelf.length; $("clawShelfCap").textContent = cap; $("clawPityView").textContent = clawPity; // 统计
  wrap.innerHTML = clawShelf.map(function (d, i) { // 逐只渲染
    return '<div class="shelfCard"><div class="dIco">' + (d.emoji || "🧸") + '</div><div class="dName">' + d.name + '</div><div class="dRar">' + d.rarity + " · 可售 ¥" + (+d.sellPrice).toFixed(2) + '</div><button data-sell="' + i + '">出售</button></div>'; // 卡结构
  }).join("") || '<p class="gameTip" style="text-align:left">展示架空空的，去抓一只吧～</p>'; // 空态
  wrap.querySelectorAll("[data-sell]").forEach(function (btn) { // 绑定出售
    btn.addEventListener("click", function () { // 点击出售
      const i = +btn.dataset.sell; const d = clawShelf[i]; if (!d) { return; } // 取玩偶
      clawShelf.splice(i, 1); // 移出展示架
      gainMoney(+d.sellPrice || 0); // 入账
      toast("💰 已出售「" + d.name + "」，到账 ¥" + (+d.sellPrice).toFixed(2)); // 提示
      clawSave(); // 持久化
    }); // 结束绑定
  }); // 结束遍历
} // 结束 renderClawShelf
const DOLL_EMOJI = { bear: "🧸", rabbit: "🐰", penguin: "🐧", unicorn: "🦄", dragon: "🐲" }; // 玩偶 emoji 表
function clawFinish(ok) { // 状态机跑完后的结算（成功入展示架 / 失败推进保底）
  clawGoldAfterDrop(); // 6.2：每次下爪后推进金爪计数（可能开启下一轮金爪时段）
  if (clawChal.active && ok) { clawChal.caught += 1; clawChalRender(); } // 6.2 三轮：挑战赛进行中抓中 → 计数并刷徽章
  const res = $("clawResult"); res.classList.add("show"); // 结果横幅
  const cost = Math.max(0.01, +CLAW_CFG.cost || 3); // 本局单价（战绩记录用）
  if (ok) { // 抓中
    let total = 0; for (const d of CLAW_CFG.dolls) { total += (+d.weight || 0); } // 玩偶权重和
    let r = Math.random() * total, doll = CLAW_CFG.dolls[CLAW_CFG.dolls.length - 1]; // 骰子
    for (const d of CLAW_CFG.dolls) { r -= (+d.weight || 0); if (r < 0) { doll = d; break; } } // 加权命中
    clawShelf.push({ id: doll.id, name: doll.name, rarity: doll.rarity, sellPrice: doll.sellPrice, emoji: DOLL_EMOJI[doll.id] || "🧸", time: Date.now() }); // 入展示架
    clawPity = 0; // 保底清零
    clawSave(); // 持久化
    res.innerHTML = '<span class="grBig">🎉 抓到「' + doll.name + "」(" + doll.rarity + ")！已放入展示架</span>"; // 文案
    pushPlayHist("claw", cost, 0, "抓到 " + doll.name); // 战绩（出售时才算收益）
    if (doll.rarity === "传说" || doll.rarity === "史诗") { bigWin(doll.sellPrice); } // 稀有大演出
  } else { // 未抓中
    clawPity += 1; // 连败推进
    clawSave(); // 持久化
    res.innerHTML = "💨 爪子滑了… 下次成功率 " + Math.min(+CLAW_CFG.pityMax || 90, Math.min(100, (+CLAW_CFG.baseRate || 35) + clawPity * (+CLAW_CFG.pityStep || 0))).toFixed(0) + "%"; // 文案含下次成功率
    pushPlayHist("claw", cost, 0, "落空 ×" + clawPity); // 战绩
  } // 结束判定分支
  $("clawBalView").textContent = balance.toFixed(2); // 同步余额
} // 结束 clawFinish
$("btnClawDrop").addEventListener("click", function () { // 下爪
  clawEnsure(); // 场景就绪
  if (clawScene && clawScene.busy) { return; } // 忙碌防连点
  const cost = clawChal.active ? 0 : Math.max(0.01, +CLAW_CFG.cost || 3); // 单价（6.2 三轮：挑战赛期间免费连抓，入场费已付）
  if (cost > 0 && balance < cost) { toast("余额不足，先回大厅刮两张～"); return; } // 校验（挑战赛免费跳过）
  const cap = Math.max(1, +CLAW_CFG.shelfCap || 12); // 容量
  if (clawShelf.length >= cap) { toast("展示架满了，先出售几只再来～"); return; } // 容量校验
  if (cost > 0) { payMoney(cost); } // 扣款（挑战赛期间不扣）
  $("clawCostView").textContent = cost.toFixed(2); $("clawBalView").textContent = balance.toFixed(2); // 刷新显示
  const rate = Math.min(100, Math.max(0, (+CLAW_CFG.baseRate || 35) + clawPity * (+CLAW_CFG.pityStep || 0))); // 当前成功率 = 基础 + 连败 × 步长（上限封顶）
  const goldOn = Date.now() < clawGoldUntil; // 6.2：金爪时段进行中判定
  const effRate = Math.min(100, Math.min(+CLAW_CFG.pityMax || 90, rate) * (goldOn ? 2 : 1)); // 不超过保底上限；金爪时段成功率 ×2（绝对封顶 100%）
  const ok = Math.random() * 100 < effRate; // 判定
  if (clawScene) { // 3D：启动物理状态机（travel → down → grip → lift → carry/release → return），跑完回调结算
    const s = clawScene; // 句柄简称
    s.busy = true; s.ok = ok; s.slipped = false; s.gripT = 0; s.onDone = function () { clawFinish(ok); }; // 注册状态机与结算回调
    const cx = s.claw.position.x, cz = s.claw.position.z; // 6.1：摇杆推到的落爪点（原地下爪，不再自动寻的）
    let best = null, bd = 1e9; // 正下方最近玩偶
    s.dolls.forEach(function (d) { // 遍历箱内玩偶
      if (!d.userData.settled || d.userData.collected) { return; } // 只考虑静止且未被标记的
      const dist = Math.hypot(d.position.x - cx, d.position.z - cz); // 水平距离
      if (dist < bd) { bd = dist; best = d; } // 记录最近
    }); // 结束遍历
    s.target = (best && bd < 0.85) ? best : null; // 距离 0.85 内才算对准，否则抓空
    s.claw.userData.tx = cx; s.claw.userData.tz = cz; // 落爪点 = 当前位置（travel 瞬时完成）
    s.phase = "travel"; // 启动状态机
  } else { setTimeout(function () { clawFinish(ok); }, 500); } // 无 3D 兜底：直接结算
}); // 结束下爪

