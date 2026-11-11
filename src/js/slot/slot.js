// ================= 6.0 新增：老虎机（Three.js 3D） =================
let slotScene = null; // 场景句柄（懒建）
function slotMarqueeFont() { // 「GAMING TIME」5×7 像素字模（顶部灯阵点阵用）
  return { // 每字符 7 行 × 5 列（"1" = 点亮的灯珠）
    G: ["01110", "10001", "10000", "10011", "10001", "10001", "01111"], // G
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], // A
    M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"], // M
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"], // I
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"], // N
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"], // T
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"], // E
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"], // F（FEVER TIME 用）
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"], // V
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], // R
    J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"], // J（JACKPOT 用）
    C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"], // C
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"], // K
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"], // P
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], // O
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], // U（YOU WIN 用）
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"], // W
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"], // Y
    "¥": ["10001", "10001", "01110", "00100", "11111", "00100", "00100"], // ¥（JACKPOT 金额前缀）
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"], // 数字 0
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"], // 数字 1
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"], // 数字 2
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"], // 数字 3
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], // 数字 4
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"], // 数字 5
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"], // 数字 6
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"], // 数字 7
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], // 数字 8
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"], // 数字 9
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"] // 空格（字间距）
  }; // 结束字模表
} // 结束 slotMarqueeFont
function slotMakeMarquee(text) { // 顶部像素灯阵贴图：按传入文字绘制点阵（横向画两份拷贝实现无缝循环跑马；6.2 五轮支持动态换字）
  text = (text || "GAMING TIME ") + " "; // 灯阵文字（尾随空格做词间距）
  const CELL = 6, COLS = text.length * 6, ROWS = 7; // 每字符占 6 列（5 列字模 + 1 列间隙）× 7 行
  const cv = document.createElement("canvas"); cv.width = COLS * CELL * 2; cv.height = ROWS * CELL; // 画布宽 = 两份拷贝
  const g = cv.getContext("2d"); // 绘图句柄
  g.fillStyle = "#180d06"; g.fillRect(0, 0, cv.width, cv.height); // 灯箱暗底
  const font = slotMarqueeFont(); // 字模表
  for (let copy = 0; copy < 2; copy++) { // 两份文字拼接
    for (let ci = 0; ci < text.length; ci++) { // 逐字符
      const glyph = font[text[ci]] || font[" "]; // 取字模（未知字符按空格）
      for (let r = 0; r < 7; r++) { for (let c = 0; c < 5; c++) { // 逐像素灯珠
        if (glyph[r].charAt(c) !== "1") { continue; } // 熄灭位跳过
        const flick = ((ci * 7 + r * 5 + c) % 11) < 2; // 少量琥珀亮点点缀（静态分布即可，滚动时自带流动感）
        g.fillStyle = flick ? "#ffd98a" : "#ff4b30"; // 红色 LED 为主
        g.beginPath(); // 圆点灯珠
        g.arc((copy * COLS + ci * 6 + c) * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.36, 0, Math.PI * 2); // 灯珠圆心
        g.fill(); // 点亮
      } } // 结束像素遍历
    } // 结束字符遍历
  } // 结束两份拷贝
  const tx = new THREE.CanvasTexture(cv); // 生成纹理
  tx.wrapS = THREE.RepeatWrapping; tx.repeat.x = 0.5; // 横向取一半 = 恰好一份文字铺满灯窗；loop 里滚 offset.x 即跑马灯
  return tx; // 返回纹理
} // 结束 slotMakeMarquee
function slotMakeReel() { // 造一轮「白色圆圈数字滚筒」：白圆面片 + CanvasTexture 逐帧重绘（数字滚动直接发生在机身上）
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; // 离屏画布
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; // 纹理句柄
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.56, 40), new THREE.MeshBasicMaterial({ map: tex })); // 白圆面片（Basic 自发光不受灯光影响，数字始终清晰）
  return { mesh: mesh, cv: cv, ctx: cv.getContext("2d"), tex: tex, rot: 0, mode: "idle", speed: 0, from: 0, to: 0, t: 0, dur: 620, gold: false }; // 滚筒句柄（rot 为连续档位值：1 = 一个数字格；gold = Fever 金色态）
} // 结束 slotMakeReel
function slotDrawReel(r) { // 重绘一轮滚筒：白圆底 + 环向数字（中心档显示的数字由 r.rot 决定；Fever 时金圆金数字）
  const g = r.ctx; g.clearRect(0, 0, 128, 128); // 清透明底（露出机身暗窗）
  g.save(); g.beginPath(); g.arc(64, 64, 61, 0, Math.PI * 2); g.clip(); // 圆形裁剪
  if (r.gold) { // Fever 金色态：金底 + 深棕数字
    const gd = g.createRadialGradient(64, 40, 8, 64, 64, 66); // 径向渐变（高光偏上）
    gd.addColorStop(0, "#ffe9a8"); gd.addColorStop(0.55, "#f2c14e"); gd.addColorStop(1, "#c98f1b"); // 金色三段
    g.fillStyle = gd; // 金圆底
  } else { g.fillStyle = "#fffdf8"; } // 常规白圆底
  g.fillRect(0, 0, 128, 128); // 铺底色
  for (let k = -2; k <= 2; k++) { // 中心档 ±2 档各画一位（滚筒纵深感：上下露出相邻数字）
    const pos = Math.round(r.rot) + k; // 档位序号（整数域）
    const rel = pos - r.rot; // 相对中心的连续偏移（转动时数字平滑滚过）
    const idx = ((pos % 10) + 10) % 10; // 归一 0..9（symbols 恰好十位数字）
    const y = 64 + rel * 46; // 纵向像素位置（步长 46px）
    const sc = Math.max(0.4, 1 - Math.abs(rel) * 0.18); // 远离中心略缩小（弧面透视感）
    g.save(); g.globalAlpha = Math.max(0.15, 1 - Math.abs(rel) * 0.3); // 远离中心变淡
    g.translate(64, y); g.scale(sc, sc); // 变换
    g.fillStyle = r.gold ? "#5a3b06" : "#a02c1c"; g.font = "700 42px Consolas, 'Courier New', monospace"; // 深红等宽数字（Fever 转深棕金配）
    g.textAlign = "center"; g.textBaseline = "middle"; // 居中
    g.fillText(String(SLOT_CFG.symbols[idx] || idx), 0, 0); // 画数字
    g.restore(); // 结束单字
  } // 结束五档
  g.restore(); // 结束裁剪
  g.fillStyle = "rgba(44,42,38,.16)"; g.fillRect(0, 0, 128, 12); g.fillRect(0, 116, 128, 12); // 上下暗带：滚筒窗口感
  r.tex.needsUpdate = true; // 通知 GPU 上传新帧
} // 结束 slotDrawReel
function slotEnsure() { // 懒初始化老虎机场景（6.2 全套重建模：方正红长方体 + 像素灯阵 + 白圆滚筒）
  if (slotScene || !window.THREE || !webglOK()) { if (!slotScene) { noWebglFallback("slotStage", "🎰"); } return; } // 已建或不可用直接返回
  const stage = $("slotStage"); // 容器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // 渲染器（抗锯齿 + 透明底）
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); // 像素比上限 2（性能）
  stage.appendChild(renderer.domElement); // 挂画布
  const scene = new THREE.Scene(); // 场景
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100); camera.position.set(0, 1.0, 8.2); camera.lookAt(0, 0.4, 0); // 相机（机身高，稍拉远完整呈现）
  scene.add(new THREE.AmbientLight(0xffffff, 0.85)); // 环境光
  const dir = new THREE.DirectionalLight(0xfff2cc, 0.9); dir.position.set(3, 5, 4); scene.add(dir); // 主光
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.5, 2.0), new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.45, metalness: 0.15 })); body.position.y = 0.2; scene.add(body); // 主机身：方正红色长方体
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 2.3), new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.6 })); plinth.position.y = -1.75; scene.add(plinth); // 底座（深色，方正轮廓收边）
  const topBox = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.78, 2.0), new THREE.MeshStandardMaterial({ color: 0x8e2418, roughness: 0.5 })); topBox.position.set(0, 2.34, 0); scene.add(topBox); // 顶部灯箱（与机身同宽，整体方正）
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.4), new THREE.MeshBasicMaterial({ map: slotMakeMarquee("GAMING TIME") })); marquee.position.set(0, 2.34, 1.005); scene.add(marquee); // 像素灯阵面片（6.2 五轮：内容动态调度——待机轮播 JACKPOT 池额 / 中奖 YOU WIN / Fever FEVER TIME）
  const winPanel = new THREE.Mesh(new THREE.BoxGeometry(4.02, 1.9, 0.06), new THREE.MeshStandardMaterial({ color: 0x1c1a16, roughness: 0.7 })); winPanel.position.set(0, 0.55, 0.99); scene.add(winPanel); // 开奖暗窗（三只白圆滚筒嵌在里面）
  const reels = []; // 三轮滚筒
  for (let i = 0; i < 3; i++) { // 依次建三轮
    const r = slotMakeReel(); // 白圆数字滚筒
    r.mesh.position.set(-1.3 + i * 1.3, 0.55, 1.03); // 横排嵌在暗窗前
    scene.add(r.mesh); reels.push(r); // 入场
    slotDrawReel(r); // 首帧绘制（静止停在 0 号数字）
  } // 结束三轮
  // ---- 拉杆 / 托盘 / 氛围灯（沿用 6.2 实体化方案，位置适配新机身） ----
  const leverGroup = new THREE.Group(); leverGroup.position.set(2.42, 0.2, 0.5); scene.add(leverGroup); // 拉杆组（支点在机身右侧壁）
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.05, 12), new THREE.MeshStandardMaterial({ color: 0xf6c775, metalness: 0.65, roughness: 0.28 })); lever.position.y = 0.55; leverGroup.add(lever); // 金色杆身（下粗上细）
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), new THREE.MeshStandardMaterial({ color: 0xd64541, roughness: 0.32 })); knob.position.y = 1.12; leverGroup.add(knob); // 红色拉杆球（拖动热区中心）
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.6 })); tray.position.set(0, -1.35, 1.15); scene.add(tray); // 出币托盘（机身前下方）
  const spinLight = new THREE.PointLight(0xffd77e, 0.25, 9); spinLight.position.set(0, 1.4, 2.2); scene.add(spinLight); // 动态氛围灯（开转增亮 / 停转回落）
  slotScene = { renderer: renderer, scene: scene, camera: camera, reels: reels, marquee: marquee, stage: stage, spinning: false, leverGroup: leverGroup, leverKnob: knob, spinLight: spinLight, clock: new THREE.Clock(), mqText: "GAMING TIME", mqHold: "", mqHoldUntil: 0, mqPhase: 0 }; // 存句柄（含滚筒/灯阵/拉杆/氛围灯；mq* 为 6.2 五轮灯阵信息屏调度状态）
  function resize() { // 容器尺寸自适应
    const w = stage.clientWidth, h = stage.clientHeight; // 实测尺寸
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); // 更新
  } // 结束 resize
  resize(); // 首次
  if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); } // 观察容器变化（规格要求）
  slotScene.loop = function () { // 渲染循环：滚筒滚动/吸附 + 跑马灯 + 拉杆弹簧 + 氛围灯
    const dt = Math.min(0.05, slotScene.clock.getDelta()); // 帧间隔（上限防跳帧）
    slotScene.reels.forEach(function (r) { // 三轮逐帧更新（6.2 更正滚动逻辑：匀速空转 → easeOut 吸附到目标档）
      if (r.mode === "spin") { r.rot += r.speed; slotDrawReel(r); } // 匀速空转段
      else if (r.mode === "settle") { // 吸附减速段
        r.t += dt * 1000; // 累计毫秒
        const p = Math.min(1, r.t / r.dur); const e = 1 - Math.pow(1 - p, 3); // easeOutCubic 缓动
        r.rot = r.from + (r.to - r.from) * e; slotDrawReel(r); // 插值到目标档位
        if (p >= 1) { r.rot = r.to; r.mode = "idle"; slotDrawReel(r); slotReelStopSound(r); } // 精确定格（rot 恰为整数档）+ 6.2 三轮停轮音（音调逐列升高）
      } // 结束吸附段
    }); // 结束三轮
    const mtx = slotScene.marquee.material.map; // 灯阵纹理
    mtx.offset.x = (mtx.offset.x + dt * 0.06) % 0.5; // 向左循环跑马（0.5 = 一份文字宽度）
    slotScene.mqPhase += dt; // 信息屏相位时钟
    let want = "GAMING TIME"; // 默认跑马文字
    if (slotScene.spinning && slotFever) { want = "FEVER TIME"; } // Fever 转动中：灯阵跑 FEVER TIME
    else if (Date.now() < slotScene.mqHoldUntil) { want = slotScene.mqHold; } // 短时驻留文字（YOU WIN 等）
    else if (!slotScene.spinning && slotScene.mqPhase > 6) { // 待机每 6 秒轮播一次池额
      slotScene.mqPhase = 0; // 重置相位
      want = "GAMING TIME"; slotMarqueeSet("GAMING TIME"); // 先回默认
      const jv = (typeof numAnim !== "undefined" && numAnim.jackT != null) ? Math.round(numAnim.jackT) : 0; // 实时滚存池额（取目标值非插值）
      setTimeout(function () { if (!slotScene.spinning && Date.now() >= slotScene.mqHoldUntil) { slotMarqueeSet("JACKPOT ¥" + jv); } }, 3200); // 半个周期后切 JACKPOT ¥xxx
    } // 结束待机轮播
    if (want !== slotScene.mqText) { slotMarqueeSet(want); } // 文字变化才重建纹理（省性能）
    const lg = slotScene.leverGroup; // 拉杆组
    if (lg && !lg.userData.held) { lg.rotation.x += (0 - lg.rotation.x) * 0.14; if (Math.abs(lg.rotation.x) < 0.004) { lg.rotation.x = 0; } } // 松手弹簧回位（拖动中由指针驱动不干预）
    const on = slotScene.spinning; // 氛围灯相位源
    slotScene.spinLight.intensity += ((on ? 1.15 : 0.25) - slotScene.spinLight.intensity) * 0.08; // 动态灯光平滑增衰
    renderer.render(scene, camera); // 绘制
  }; // 结束 loop
  renderer.setAnimationLoop(slotScene.loop); // 启动循环
} // 结束 slotEnsure

function slotMarqueeSet(text, holdMs) { // 6.2 五轮：灯阵信息屏换字（重建 CanvasTexture；holdMs 为短时驻留时长，驻留期间优先级高于待机轮播）
  if (!slotScene || !slotScene.marquee) { return; } // 无场景静默
  slotScene.mqText = text; // 记忆当前文字（loop 去抖用）
  slotScene.marquee.material.map.dispose(); // 释放旧纹理（防 GPU 泄漏）
  slotScene.marquee.material.map = slotMakeMarquee(text); // 重建贴图
  slotScene.marquee.material.needsUpdate = true; // 通知材质更新
  if (holdMs) { slotScene.mqHold = text; slotScene.mqHoldUntil = Date.now() + holdMs; } // 驻留窗口（YOU WIN 展示 4 秒后回默认）
} // 结束 slotMarqueeSet
let slotStreak = 0, slotFever = false; // 6.2 五轮：连庄计数与 Fever 态（连续两把中奖 → 下把免单 + 金滚筒 + FEVER TIME）
function slotFeverApply(on) { // 滚筒金色态切换（重建三张滚筒贴图）
  if (!slotScene || !slotScene.reels) { return; } // 无场景静默
  slotScene.reels.forEach(function (r) { r.gold = on; slotDrawReel(r); }); // 逐轮刷金色
  const chip = $("slotFeverChip"); // FEVER 徽章
  if (chip) { chip.classList.toggle("on", on); } // 徽章显隐
} // 结束 slotFeverApply

function slotWeightedPick() { // 按权重抽取三同结果（未命中返回 -1 表示空奖）
  let total = 0; for (const p of SLOT_CFG.payouts) { total += (+p.w || 0); } // 权重总和
  let r = Math.random() * total; // 骰子
  for (let i = 0; i < SLOT_CFG.payouts.length; i++) { r -= (+SLOT_CFG.payouts[i].w || 0); if (r < 0) { return i; } } // 命中返回下标
  return -1; // 空奖
} // 结束 slotWeightedPick
function slotSpinStart() { // 6.2：统一开转入口（按钮点击与 3D 拉杆拖动共用）
  slotEnsure(); // 确保场景就绪
  if (slotScene && slotScene.spinning) { return; } // 转动中防连点
  const feverNow = slotFever; // 6.2 五轮：Fever 免单把（连续两把中奖的奖励）
  const cost = feverNow ? 0 : Math.max(0.01, (+SLOT_CFG.cost || 1) * slotBet); // 6.2 六轮：单注 = 基准 × 押注档位（Fever 把为 0）
  if (!feverNow && balance < cost) { toast("余额不足，先去大厅刮两张回回血～"); return; } // 余额校验（Fever 免单把跳过）
  if (cost > 0) { payMoney(cost); } // 扣款（Fever 把免费不扣）
  $("slotCostView").textContent = feverNow ? "FREE" : cost.toFixed(2); // 单注显示（Fever 显示 FREE）
  $("slotBalView").textContent = balance.toFixed(2); // 刷新余额显示
  if (slotScene) { // 开转前的灯阵调度
    if (!feverNow) { slotScene.mqHoldUntil = 0; slotScene.mqPhase = 0; slotMarqueeSet("GAMING TIME"); } // 常规把：清除灯阵驻留并回默认
    /* Fever 把：不清驻留——FEVER TIME 全程陪伴这次免单转动 */
  } // 结束灯阵调度
  const hit = slotWeightedPick(); // 抽三同结果
  const syms = SLOT_CFG.symbols; // 图标表
  let finalIdx = [0, 1, 2]; // 三轮最终停下时的图案下标
  if (hit >= 0) { const si = syms.indexOf(SLOT_CFG.payouts[hit].sym); finalIdx = [si, si, si]; } // 三同：三轮同一图案
  else { // 空奖：随机一个非全同组合
    do { finalIdx = finalIdx.map(function () { return Math.floor(Math.random() * syms.length); }); } // 随机三轮
    while (finalIdx[0] === finalIdx[1] && finalIdx[1] === finalIdx[2]); // 避免假三同
  } // 结束空奖分支
  const dur = Math.max(600, +SLOT_CFG.spinDurationMs || 2600); // 转动时长
  if (slotScene) { // 有 3D 场景：白色圆圈滚筒直接开转（数字滚动区域 = 机身上的白圆）
    slotScene.spinning = true; // 标记（驱动氛围灯与拉杆）
    if (slotScene.leverGroup) { slotScene.leverGroup.rotation.x = 1.0; slotScene.leverGroup.userData.held = false; } // 按钮触发同样压下拉杆（回弹由循环弹簧完成）
    slotScene.reels.forEach(function (r, i) { // 6.2 更正滚动逻辑：匀速空转 → 到点 easeOut 吸附到目标数字档
      r.mode = "spin"; r.speed = 0.34 - i * 0.04; // 三轮不同初速更真实
      setTimeout(function () { // 第 i 轮到点进入吸附段（左→右依次停的期待感）
        let to = Math.ceil(r.rot + 6); // 至少再滚 6 个数字位
        to += (((finalIdx[i] - to) % 10) + 10) % 10; // 对齐目标档位（mod 10 环绕取正余）
        r.mode = "settle"; r.from = r.rot; r.to = to; r.t = 0; r.dur = 620; // 吸附段参数（620ms 缓动定格）
        tickTone(300 + i * 40, 0.04, 0.045, "square", "amb"); // 6.2 三轮：进入吸附时轻滴答（机械感）
      }, 380 + i * 460); // 逐轮延迟（380/840/1300ms 启动吸附）
    }); // 结束三轮
    setTimeout(function () { slotScene.spinning = false; }, dur); // 结束放行
  } // 结束 3D 分支
  setTimeout(function () { // 结算（与 3D 动画并行等待）
    if (hit >= 0 && fxOn) { [660, 880, 1100].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.14, 0.09, "triangle", "win"); }, k * 130); }); } // 6.2 三轮：中奖小号角（三连音上行）
    const res = $("slotResult"); res.classList.add("show"); // 显示结果横幅
    if (hit >= 0) { // 三同中奖
      const amt = (+SLOT_CFG.payouts[hit].amt || 0) * slotBet; // 6.2 六轮：奖额 = 配置奖 × 押注档位（同倍放大）
      saveStub(SLOT_CFG.payouts[hit].sym, amt, "slot", "三同数字"); // 6.2 九轮：三同 ≥ ¥88 自动机打票根入册
      gainMoney(amt); // 入账（复用滚轮上滑/还债/徽章）
      res.innerHTML = '<span class="grBig">🎉 三连数字 ' + SLOT_CFG.payouts[hit].sym + " → ¥" + amt.toFixed(2) + "</span>"; // 横幅文案（6.1 数字版）
      pushPlayHist("slot", cost, amt, "三连数字 " + SLOT_CFG.payouts[hit].sym); // 写战绩（6.1 数字版）
      if (amt >= 66) { bigWin(amt); } // 大奖演出（复用彩带）
      else if (fxOn) { confettiBurst(40); } // 6.2 三轮：小奖也撒花（动画开关关闭/跳过动画时不显示；≥66 已由 bigWin 自带彩带不重复）
      if (slotScene) { slotMarqueeSet("YOU WIN ¥" + amt.toFixed(0), 4000); } // 6.2 五轮：灯阵跑 YOU WIN ¥奖额（4 秒后回默认）
    } else { // 空奖
      res.innerHTML = "💨 差一点点，再拉一把？"; // 横幅文案
      pushPlayHist("slot", cost, 0, "空奖"); // 写战绩
      slotStreak = 0; // 6.2 五轮：空奖断连击
    } // 结束中奖分支
    if (hit >= 0 && !feverNow) { // 6.2 五轮：连庄判定（Fever 把本身不再累计）
      slotStreak += 1; // 连击 +1
      if (slotStreak >= 2 && !slotFever) { // 连续两把三同 → 进入 Fever
        slotFever = true; // 挂 Fever 态（下一把免单）
        slotFeverApply(true); // 滚筒转金 + FEVER 徽章点亮
        slotMarqueeSet("FEVER TIME", 600000); // 灯阵跑 FEVER TIME（长驻留：直到下一把开转被清除，防待机轮播覆盖）
        toast("🔥 FEVER！连中两把，下一拉免单 + 金色滚筒！"); // 全局提示
        if (fxOn) { [523, 659, 784, 1046].forEach(function (f, k) { setTimeout(function () { tickTone(f, 0.12, 0.09, "triangle", "win"); }, k * 110); }); } // Fever 上行音阶
      } // 结束 Fever 触发
    } // 结束连庄判定
    if (feverNow) { slotFever = false; slotStreak = 0; slotFeverApply(false); $("slotCostView").textContent = ((+SLOT_CFG.cost || 1) * slotBet).toFixed(2); if (slotScene) { slotScene.mqHoldUntil = 0; slotMarqueeSet("GAMING TIME"); } } // Fever 免单把结算：消耗完毕（金滚筒还原、连击重计、单注按档位复位、灯阵回默认）
    $("slotBalView").textContent = balance.toFixed(2); // 同步余额（纯文本）
  }, (slotScene ? Math.max(dur, 2100) : 400)); // 有动画等动画（兜底 ≥ 2100ms，保证三轮全部停稳再结算），无动画 400ms 即出结果
} // 结束 slotSpinStart（6.2 函数化）
$("btnSlotSpin").addEventListener("click", slotSpinStart); // 按钮触发（保留为快捷入口）

// ---- 6.2：3D 拉杆拖动交互（按住红球向下拖 → 超阈值触发开转，松手弹簧回位） ----
(function slotLeverDrag() { // 自执行：容器事件委托，场景就绪后才响应
  const host = $("slotStage"); if (!host) { return; } // 容器保护
  let drag = null; // 拖拽状态（记录起点 Y）
  function knobScreen() { // 拉杆红球投影到屏幕像素坐标
    if (!slotScene || !slotScene.leverKnob) { return null; } // 场景未就绪
    const v = new THREE.Vector3(); slotScene.leverKnob.getWorldPosition(v); v.project(slotScene.camera); // 世界坐标 → NDC
    const r = host.getBoundingClientRect(); // 容器矩形
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top }; // 屏幕像素
  } // 结束 knobScreen
  host.addEventListener("pointerdown", function (e) { // 按下：命中红球 46px 内开始拉杆
    const p = knobScreen(); if (!p) { return; } // 未就绪忽略
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 46) { return; } // 热区外不算握杆
    if (slotScene && slotScene.spinning) { return; } // 转动中禁止再拉
    drag = { sy: e.clientY }; // 记录起点
    slotScene.leverGroup.userData.held = true; // 暂停循环弹簧（拖动中由指针驱动）
    try { host.setPointerCapture(e.pointerId); } catch (err) {} // 捕获指针
  }); // 结束按下
  host.addEventListener("pointermove", function (e) { // 拖动：垂直位移映射拉杆角度
    if (!drag || !slotScene || !slotScene.leverGroup) { return; } // 未握杆忽略
    const dy = e.clientY - drag.sy; // 向下位移量
    slotScene.leverGroup.rotation.x = Math.max(0, Math.min(1.15, dy * 0.011)); // 约 105px 拉满（1.15rad）
    slotScene.leverPulled = slotScene.leverGroup.rotation.x > 0.85; // 超阈值记忆（松手即触发）
  }); // 结束拖动
  function leverRelease() { // 松手：达阈值触发开转，否则仅回弹
    if (!drag) { return; } // 未握杆忽略
    drag = null; // 清拖拽态
    if (!slotScene || !slotScene.leverGroup) { return; } // 保护
    slotScene.leverGroup.userData.held = false; // 恢复循环弹簧回位
    if (slotScene.leverPulled) { slotScene.leverPulled = false; slotSpinStart(); } // 达阈值 → 开转
  } // 结束 leverRelease
  host.addEventListener("pointerup", leverRelease); // 松开
  host.addEventListener("pointercancel", leverRelease); // 系统接管取消
})(); // 结束拉杆拖动

