// ================= 6.2 十六轮：麻将 · 电动麻将机 3D 场景 =================
// 结构：桌体（木箱 + 台呢 + 金属包边）→ 中心升牌盘 + 骰子 → 136 张牌 → 四家槽位布局。
// 动画策略：状态驱动 —— 每次同步只改「目标位姿」，由每帧的缓动 + 抛物线抬升完成过渡，因此出牌/摸牌/鸣牌全部流畅且不会与逻辑脱节。
(function (root) { // 自执行作用域
  "use strict"; // 严格模式
  if (!root.THREE || !root.MJFaces) { return; } // 依赖缺失则退出（降级由 UI 层处理）
  const T = root.THREE; // 简写

  const TW = 0.26, TT = 0.18, TL = 0.38; // 牌宽 / 厚 / 长
  const TABLE = 5.8; // 桌面边长
  const WALL_GAP = 0.262; // 牌墙每墩沿边间距（≈ 牌宽，墩与墩相接）
  const WALL_SIDE = 17; // 每边墩数（17 × 4 = 68 墩 = 136 张）
  const WALL_D = 2.05; // 牌墙中心线到桌心距离
  const HAND_D = 2.36; // 手牌到桌心距离
  const MELD_D = 2.70; // 副露（横放亮牌）到桌心距离
  const FACE_Y = 0.205; // 立牌中心高度（长边竖直，底边贴台面）
  const FLAT_Y = 0.105; // 平放牌中心高度
  const STACK_Y = FLAT_Y + TT; // 牌墙上层中心高度（平放两层叠起）
  const EASE = function (t) { return 1 - Math.pow(1 - t, 3); }; // easeOutCubic

  function seatBasis(p) { // 座位基准向量：forward 从桌心指向该座（外侧），right 为该座视角的右手方向
    if (p === 0) { return { fx: 0, fz: 1, rx: 1, rz: 0 }; } // 南（玩家）：位于南侧，右手东
    if (p === 1) { return { fx: 1, fz: 0, rx: 0, rz: -1 }; } // 东：位于东侧，右手北
    if (p === 2) { return { fx: 0, fz: -1, rx: -1, rz: 0 }; } // 北：位于北侧，右手西
    return { fx: -1, fz: 0, rx: 0, rz: 1 }; // 西：位于西侧，右手南
  } // 结束 seatBasis

  function rotYOf(rx, rz) { return Math.atan2(rx, rz); } // 让牌长轴对齐 right 方向

  function create(host) { // 创建场景
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); // 渲染器
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); // 像素比上限 2
    renderer.shadowMap.enabled = true; // 开启阴影（桌面立体感）
    renderer.shadowMap.type = T.PCFSoftShadowMap; // 柔和阴影
    host.appendChild(renderer.domElement); // 挂画布

    const scene = new T.Scene(); // 场景
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 120); // 透视相机
    const PHI_MIN = 0.13, PHI_MAX = 1.26, ZOOM_MIN = 0.40, ZOOM_MAX = 2.20; // 极角与缩放边界（不下钻到桌面以下）
    const orbit = { // 轨道相机状态（6.2 十八轮：视角可自由调整）
      theta: 0, phi: 0.70, zoom: 1, tx: 0, tz: 0.10, // 当前值（theta 水平角 / phi 极角 / zoom 缩放 / tx,tz 焦点）
      tTheta: 0, tPhi: 0.70, tZoom: 1, tTx: 0, tTz: 0.10, // 目标值（每帧缓动逼近 → 转动跟手又不生硬）
      fit: 12, active: "overview" // 基础距离（按容器尺寸算）/ 当前预设视角名
    }; // 结束 orbit
    const VIEWS = { // 三档预设视角（顶栏按钮切换）
      overview: { theta: 0, phi: 0.70, zoom: 1.00, tx: 0, tz: 0.10 }, // 全景：整桌入镜
      top: { theta: 0, phi: 0.16, zoom: 0.90, tx: 0, tz: 0.00 }, // 俯视：近乎垂直看台面，牌河与手牌最清楚
      hand: { theta: 0, phi: 1.14, zoom: 0.56, tx: 0, tz: 1.42 } // 手牌：贴近自己一侧，牌面放到最大
    }; // 结束预设
    let onView = null; // 视角变更回调（UI 用来高亮按钮）
    function clampV(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); } // 夹取
    function applyCamera() { // 按轨道参数摆放相机
      const d = orbit.fit * orbit.zoom; // 相机到焦点的距离
      const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi); // 极角分量
      camera.position.set(orbit.tx + Math.sin(orbit.theta) * sp * d, cp * d + 0.08, orbit.tz + Math.cos(orbit.theta) * sp * d); // 球坐标 → 世界坐标
      camera.lookAt(orbit.tx, 0.06, orbit.tz); // 看向焦点（略高于台面）
    } // 结束 applyCamera
    function setView(name) { // 切换预设视角（带缓动，不会瞬移）
      const p = VIEWS[name] || VIEWS.overview; // 取预设
      orbit.tTheta = p.theta; orbit.tPhi = p.phi; orbit.tZoom = p.zoom; // 角度与缩放
      orbit.tTx = p.tx; orbit.tTz = p.tz; // 焦点
      orbit.active = VIEWS[name] ? name : "overview"; // 记录
      if (onView) { onView(orbit.active); } // 通知 UI
    } // 结束 setView
    function markCustom() { // 手动拖动/缩放后：取消按钮高亮
      if (orbit.active) { orbit.active = ""; if (onView) { onView(""); } } // 只在从预设切走时通知一次
    } // 结束 markCustom

    scene.add(new T.AmbientLight(0xffffff, 0.72)); // 环境光
    const key = new T.DirectionalLight(0xfff3d6, 1.15); // 主光（暖白）
    key.position.set(4.2, 9, 5.5); // 右上方
    key.castShadow = true; // 投影
    key.shadow.mapSize.set(1024, 1024); // 阴影分辨率
    key.shadow.camera.near = 1; key.shadow.camera.far = 26; // 阴影相机范围
    key.shadow.camera.left = -6; key.shadow.camera.right = 6; // 横向范围
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; // 纵向范围
    scene.add(key); // 加入
    const fill = new T.DirectionalLight(0x9fc4ff, 0.32); // 冷色补光
    fill.position.set(-5, 5, -4); // 左后方
    scene.add(fill); // 加入

    /* ================= 一、桌体 ================= */
    const bodyMat = new T.MeshStandardMaterial({ color: 0x4a2f21, roughness: 0.58, metalness: 0.08 }); // 深胡桃木
    const body = new T.Mesh(new T.BoxGeometry(TABLE, 0.46, TABLE), bodyMat); // 桌箱
    body.position.y = -0.27; body.castShadow = true; body.receiveShadow = true; // 位置与阴影
    scene.add(body); // 加入

    const feltMat = new T.MeshStandardMaterial({ color: 0x1f6b4a, roughness: 0.94, metalness: 0 }); // 台呢绿
    const felt = new T.Mesh(new T.BoxGeometry(TABLE - 0.34, 0.06, TABLE - 0.34), feltMat); // 台面
    felt.position.y = -0.015; felt.receiveShadow = true; // 略低于桌沿
    scene.add(felt); // 加入

    const rimMat = new T.MeshStandardMaterial({ color: 0xd9b25e, roughness: 0.32, metalness: 0.78 }); // 金属包边
    const rimGeoH = new T.BoxGeometry(TABLE + 0.06, 0.1, 0.1); // 横边
    const rimGeoV = new T.BoxGeometry(0.1, 0.1, TABLE + 0.06); // 竖边
    [[0, TABLE / 2], [0, -TABLE / 2]].forEach(function (p) { const m = new T.Mesh(rimGeoH, rimMat); m.position.set(p[0], 0.02, p[1]); scene.add(m); }); // 前后包边
    [[TABLE / 2], [-TABLE / 2]].forEach(function (p) { const m = new T.Mesh(rimGeoV, rimMat); m.position.set(p[0], 0.02, 0); scene.add(m); }); // 左右包边

    // 四角推牌器（麻将机特征细节）
    const pusherMat = new T.MeshStandardMaterial({ color: 0x2b3a34, roughness: 0.5, metalness: 0.35 }); // 深灰绿
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) { // 四角
      const pm = new T.Mesh(new T.BoxGeometry(0.5, 0.09, 0.14), pusherMat); // 推牌条
      pm.position.set(s[0] * (TABLE / 2 - 0.42), 0.02, s[1] * (TABLE / 2 - 0.42)); // 位置
      pm.rotation.y = Math.PI / 4; // 斜置
      pm.castShadow = true; scene.add(pm); // 加入
    }); // 结束四角

    /* ================= 二、中心升牌盘 ================= */
    const centerGroup = new T.Group(); // 中心组（可整体升降）
    scene.add(centerGroup); // 加入场景
    const wellMat = new T.MeshStandardMaterial({ color: 0x0e231b, roughness: 1, metalness: 0 }); // 井底暗色
    const well = new T.Mesh(new T.CylinderGeometry(0.72, 0.72, 0.26, 48), wellMat); // 井
    well.position.y = -0.14; centerGroup.add(well); // 加入
    const plateMat = new T.MeshStandardMaterial({ color: 0xb9c6bf, roughness: 0.28, metalness: 0.55 }); // 铝制升牌盘
    const plate = new T.Mesh(new T.CylinderGeometry(0.66, 0.66, 0.07, 48), plateMat); // 盘
    plate.position.y = 0.02; plate.receiveShadow = true; plate.castShadow = true; // 位置
    centerGroup.add(plate); // 加入
    const plateRing = new T.Mesh(new T.TorusGeometry(0.66, 0.028, 10, 56), new T.MeshStandardMaterial({ color: 0xe3c877, roughness: 0.3, metalness: 0.8 })); // 金环
    plateRing.rotation.x = Math.PI / 2; plateRing.position.y = 0.062; // 平放
    centerGroup.add(plateRing); // 加入
    const ledMat = new T.MeshBasicMaterial({ color: 0x66e2a6 }); // 指示灯
    for (let i = 0; i < 8; i++) { // 八颗指示灯
      const led = new T.Mesh(new T.CircleGeometry(0.026, 12), ledMat); // 小圆片
      const a = (i / 8) * Math.PI * 2; // 角度
      led.position.set(Math.cos(a) * 0.55, 0.062, Math.sin(a) * 0.55); // 环上
      led.rotation.x = -Math.PI / 2; // 朝上
      centerGroup.add(led); // 加入
    } // 结束指示灯

    /* ================= 三、骰子 ================= */
    const diceGroup = new T.Group(); // 骰子组
    scene.add(diceGroup); // 加入
    const diceMat = new T.MeshStandardMaterial({ color: 0xf7f4ea, roughness: 0.4, metalness: 0.02 }); // 象牙白
    const pipMat = new T.MeshStandardMaterial({ color: 0x1f2b3a, roughness: 0.6 }); // 点色
    const dice = []; // 两颗
    for (let i = 0; i < 2; i++) { // 逐颗
      const g = new T.Group(); // 牌组
      const cube = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2), diceMat); // 骰体
      cube.castShadow = true; g.add(cube); // 加入
      const pipGeo = new T.SphereGeometry(0.021, 8, 8); // 点几何
      [[0, 0.101, 0], [0, -0.101, 0], [0.101, 0, 0], [-0.101, 0, 0], [0, 0, 0.101], [0, 0, -0.101]].forEach(function (d, di) { // 六个面中心
        const n = di + 1; // 面序号
        const count = n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : n === 4 ? 4 : n === 5 ? 5 : 6; // 点数
        const offs = []; // 点位偏移
        if (count === 1) { offs.push([0, 0]); } // 中
        else if (count === 2) { offs.push([-0.045, -0.045], [0.045, 0.045]); } // 对角两
        else if (count === 3) { offs.push([-0.045, -0.045], [0, 0], [0.045, 0.045]); } // 斜三
        else if (count === 4) { offs.push([-0.045, -0.045], [0.045, -0.045], [-0.045, 0.045], [0.045, 0.045]); } // 四角
        else if (count === 5) { offs.push([-0.045, -0.045], [0.045, -0.045], [0, 0], [-0.045, 0.045], [0.045, 0.045]); } // 五
        else { offs.push([-0.045, -0.06], [0.045, -0.06], [-0.045, 0], [0.045, 0], [-0.045, 0.06], [0.045, 0.06]); } // 六
        offs.forEach(function (o) { // 逐点
          const pip = new T.Mesh(pipGeo, pipMat); // 点
          if (d[0] !== 0) { pip.position.set(d[0] * 1.0, o[0], o[1]); } // 左右面
          else if (d[1] !== 0) { pip.position.set(o[0], d[1] * 1.0, o[1]); } // 上下面
          else { pip.position.set(o[0], o[1], d[2] * 1.0); } // 前后面
          pip.scale.setScalar(1); g.add(pip); // 加入
        }); // 结束逐点
      }); // 结束六面
      g.position.set(-0.18 + i * 0.36, 0.1, 0.0); // 盘中并排
      diceGroup.add(g); // 加入
      dice.push({ mesh: g, t: 0, from: null, to: null, spin: 0 }); // 状态
    } // 结束两颗

    /* ================= 四、牌池 ================= */
    const tileGeo = new T.BoxGeometry(TW, TT, TL); // 统一几何
    const matCache = {}; // 材质缓存
    function matsOf(kind) { if (!matCache[kind]) { matCache[kind] = root.MJFaces.makeTileMaterials(kind); } return matCache[kind]; } // 取材质组
    const tiles = []; // 全部视觉牌
    for (let i = 0; i < 136; i++) { // 136 张
      const m = new T.Mesh(tileGeo, matsOf(0)); // 初始材质随意
      m.castShadow = true; m.receiveShadow = true; // 阴影
      m.visible = false; // 初始隐藏
      m.rotation.order = "YXZ"; // 先竖立再绕竖轴转向（否则四面牌墙朝向会全错）
      scene.add(m); // 加入
      tiles.push({ mesh: m, kind: -1, tween: null, cur: new T.Vector3(0, -5, 0), tar: new T.Vector3(0, -5, 0), rotX: 0, rotY: 0, tarRotX: 0, tarRotY: 0, rotZ: 0, tarRotZ: 0 }); // 记录
    } // 结束牌池

    /* ================= 五、槽位计算 ================= */
    function computeSlots(game) { // 生成目标槽位数组（每个槽位 = 一张牌的目标位姿）
      const out = []; // 结果
      const push = function (kind, x, y, z, rx, ry, lift, group) { out.push({ kind: kind, x: x, y: y, z: z, rx: rx, ry: ry, lift: lift || 0, group: group || "" }); }; // 收集器

      // 1) 手牌：四家立牌（牌面朝自己），玩家最右一张与手牌拉开距离表示「刚摸到」
      for (let p = 0; p < 4; p++) { // 四家
        const pl = game.players[p]; // 状态
        const b = seatBasis(p); // 基准
        const n = pl.hand.length; // 张数（摸牌后为 14 张，即 3n+2）
        const gap = 0.285; // 相邻间距
        const hasDrawn = n > 0 && n % 3 === 2; // 含摸到的牌（多出一张）
        const gapLast = hasDrawn ? 0.36 : gap; // 摸牌位更宽
        const span = (n - 1) * gap + (hasDrawn ? gapLast - gap : 0); // 整排长度
        const start = -span / 2; // 居中起点
        const faceY = Math.atan2(b.fx, b.fz); // 牌面朝向自己（外侧）
        for (let i = 0; i < n; i++) { // 逐张
          const off = start + i * gap + (hasDrawn && i === n - 1 ? gapLast - gap : 0); // 沿右手方向偏移
          const x = b.fx * HAND_D + b.rx * off; // 世界坐标 X
          const z = b.fz * HAND_D + b.rz * off; // 世界坐标 Z
          push(pl.hand[i], x, FACE_Y + (hasDrawn && i === n - 1 ? 0.012 : 0), z, Math.PI / 2 - 0.22, faceY, 0, "hand" + p); // 立牌略后仰
        } // 结束逐张
      } // 结束四家

      // 2) 副露：横放亮牌，排在各自手牌外侧（更靠桌沿）
      for (let p = 0; p < 4; p++) { // 四家
        const pl = game.players[p]; // 状态
        const b = seatBasis(p); // 基准
        const faceY = Math.atan2(b.fx, b.fz); // 牌面朝向自己（外侧）
        let width = 0; // 副露总宽（用于居中）
        pl.melds.forEach(function (m) { width += m.tiles.length * 0.245 + 0.12; }); // 累加
        let cursor = -width / 2; // 居中起点
        pl.melds.forEach(function (m) { // 每组副露
          m.tiles.forEach(function (k, i) { // 逐张
            const off = cursor + i * 0.245; // 组内偏移
            const x = b.fx * MELD_D + b.rx * off; // 世界坐标
            const z = b.fz * MELD_D + b.rz * off; // 世界坐标
            push(k, x, FLAT_Y, z, 0, faceY, 0, "meld" + p); // 平放、牌面朝上
          }); // 结束逐张
          cursor += m.tiles.length * 0.245 + 0.12; // 下一组
        }); // 结束副露
      } // 结束四家

      // 3) 牌河：每方 6 列 × 4 行，自内向外铺
      for (let p = 0; p < 4; p++) { // 四家
        const pl = game.players[p]; // 状态
        const b = seatBasis(p); // 基准
        const n = Math.min(pl.river.length, 24); // 最多铺 24 张（一局足够）
        for (let i = 0; i < n; i++) { // 逐张
          const col = i % 6, row = Math.floor(i / 6); // 行列
          const rx2 = (col - 2.5) * 0.30; // 横向（沿右手）
          const ry2 = 0.88 + row * 0.30; // 纵向（距桌心）
          const x = b.fx * ry2 + b.rx * rx2; // 世界坐标
          const z = b.fz * ry2 + b.rz * rx2; // 世界坐标
          push(pl.river[i], x, FLAT_Y, z, 0, Math.atan2(-b.fx, -b.fz), 0, "river" + p); // 牌面朝上（国标无立直宣言牌，全部正向平放）
        } // 结束逐张
      } // 结束四家

      // 4) 牌墙：满墙四面各 17 墩、每墩两张平放叠起；随摸牌减少时四面均匀收缩
      const wallN = game.wall.length; // 剩余可摸张数
      const stacks = Math.ceil(wallN / 2); // 墩数
      const baseN = Math.floor(stacks / 4), extraN = stacks % 4; // 均分：前 extraN 边多一墩
      const sideCnt = []; // 每边墩数
      for (let s = 0; s < 4; s++) { sideCnt.push(Math.min(WALL_SIDE, baseN + (s < extraN ? 1 : 0))); } // 四边分配
      let stackId = 0; // 全局墩序
      for (let side = 0; side < 4; side++) { // 四边
        const cnt = sideCnt[side]; // 本边墩数
        const b = seatBasis(side); // 该边基准
        for (let idx = 0; idx < cnt; idx++, stackId++) { // 逐墩
        const off = (idx - (cnt - 1) / 2) * WALL_GAP; // 沿边偏移（居中收缩）
        const x = b.fx * WALL_D + b.rx * off; // 世界坐标
        const z = b.fz * WALL_D + b.rz * off; // 世界坐标
        const wallRotY = Math.atan2(b.fx, b.fz); // 长轴指向该座（牌背朝上）
        push(0, x, FLAT_Y, z, Math.PI, wallRotY, 0, "wallLow"); // 下层（牌面朝下）
        if (stackId * 2 + 1 < wallN) { push(0, x, STACK_Y, z, Math.PI, wallRotY, 0, "wallHigh"); } // 上层
        } // 结束逐墩
      } // 结束牌墙

      // 5) 王牌：收在桌体内部（真实麻将机的王牌不摆在台面），保证台面只余牌墙与牌河
      for (let i = 0; i < game.dead.length; i++) { // 逐张
        push(game.dead[i], 0, -1.15 + i * 0.004, 0, 0, 0, 0, "dead"); // 桌箱内层叠
      } // 结束王牌

      return out; // 返回
    } // 结束 computeSlots

    /* ================= 六、状态同步 ================= */
    let lastSig = ""; // 上次状态指纹（避免每帧重排）
    let poolIndex = 0; // 牌池游标

    function signature(game) { // 生成状态指纹（只要变化就重排）
      let s = game.wall.length + "|" + game.dead.length + "|" + game.handNo; // 牌山与局数（国标无宝牌）
      for (let p = 0; p < 4; p++) { // 四家
        const pl = game.players[p]; // 状态
        s += "#" + p + ":" + pl.hand.join(",") + "/" + pl.melds.length + "/" + pl.river.join(","); // 手牌/副露/牌河
      } // 结束四家
      return s; // 返回
    } // 结束 signature

    function sync(game) { // 同步逻辑状态到视觉
      const sig = signature(game); // 指纹
      if (sig === lastSig) { return; } // 未变化（每帧都调用也不会重复排布）
      lastSig = sig; // 记录
      const slots = computeSlots(game); // 目标槽位

      // ---- 分配策略：先按牌种归类，多出的牌退回池中改牌面，缺的牌从池中取 ----
      const byKind = {}; // 牌种 → 视觉牌数组
      const need = {}; // 牌种 → 需求张数
      for (let i = 0; i < slots.length; i++) { need[slots[i].kind] = (need[slots[i].kind] || 0) + 1; } // 统计需求
      const free = []; // 空闲视觉牌（可改牌种）
      for (let i = 0; i < tiles.length; i++) { // 遍历牌池
        const t = tiles[i]; // 当前
        t.used = false; // 清除占用标记
        if (t.kind >= 0) { (byKind[t.kind] = byKind[t.kind] || []).push(t); } else { free.push(t); } // 归类
      } // 结束遍历
      Object.keys(byKind).forEach(function (k) { // 退回多余的牌
        const list = byKind[k]; // 该种牌
        const keep = need[k] || 0; // 需要的张数
        while (list.length > keep) { const t = list.pop(); t.kind = -1; free.push(t); } // 多余退回
      }); // 结束退回

      const cursorOf = {}; // 各牌种已用游标
      for (let i = 0; i < slots.length; i++) { // 逐槽分配
        const sl = slots[i]; // 槽位
        const list = byKind[sl.kind] || (byKind[sl.kind] = []); // 该种牌
        const ci = cursorOf[sl.kind] || 0; // 游标
        let t = list[ci]; // 优先复用同种牌
        if (t) { cursorOf[sl.kind] = ci + 1; } // 推进游标
        else { // 需要改一张空闲牌
          t = free.pop(); // 取空闲
          if (!t) { continue; } // 池空（理论上 136 槽 = 136 牌，不会发生）
          t.kind = sl.kind; // 改牌种
          t.mesh.material = matsOf(sl.kind); // 换牌面材质
          list.push(t); // 入归类
          cursorOf[sl.kind] = list.length; // 游标推到末尾
        } // 结束改牌
        t.used = true; // 标记占用
        t.mesh.visible = true; // 显示
        t.tar.set(sl.x, sl.y, sl.z); // 目标位置
        t.tarRotX = sl.rx; t.tarRotY = sl.ry; t.tarRotZ = 0; // 目标角度
        t.group = sl.group; // 分组标记（拾取时只认手牌）
        startTween(t, (sl.group === "wallLow" || sl.group === "wallHigh") ? 0.26 : 0.34); // 过渡时长（牌墙稍快）
      } // 结束逐槽

      for (let i = 0; i < tiles.length; i++) { // 清理未使用牌
        const t = tiles[i]; // 当前
        if (!t.used) { t.mesh.visible = false; t.kind = -1; t.tween = null; } // 隐藏并归还池
      } // 结束清理
    } // 结束 sync

    function startTween(t, dur) { // 开始一次位姿过渡
      t.tween = { from: t.mesh.position.clone(), fromRX: t.mesh.rotation.x, fromRY: t.mesh.rotation.y, fromRZ: t.mesh.rotation.z, t: 0, dur: dur, lift: 1 }; // 记录起点
    } // 结束 startTween

    /* ================= 七、表演：洗牌 / 发牌 ================= */
    let mode = "play"; // play / wash
    let washT = 0; // 洗牌计时
    const WASH_DUR = 0.9; // 洗牌表演时长（秒）
    function setMode(m) { mode = m; washT = 0; if (m === "wash") { lastSig = "@@wash"; } } // 切换表演模式

    function washPose(dt, game) { // 洗牌表演：所有牌聚向中心并微微抖动
      washT += dt; // 计时
      const list = tiles.filter(function (t) { return t.mesh.visible; }); // 当前可见牌
      list.forEach(function (t, i) { // 逐张
        const a = (i / list.length) * Math.PI * 2 + washT * 1.6; // 旋转角
        const r = 0.18 + (i % 7) * 0.055; // 半径
        const x = Math.cos(a) * r; // 位置
        const z = Math.sin(a) * r; // 位置
        t.mesh.position.x += (x - t.mesh.position.x) * Math.min(1, dt * 6); // 缓动聚拢
        t.mesh.position.z += (z - t.mesh.position.z) * Math.min(1, dt * 6); // 缓动聚拢
        t.mesh.position.y += (0.05 + (i % 4) * 0.035 - t.mesh.position.y) * Math.min(1, dt * 6); // 叠起
        t.mesh.rotation.y += dt * 2.4; // 自转（洗牌感）
        t.mesh.rotation.x += (0 - t.mesh.rotation.x) * Math.min(1, dt * 5); // 放平
      }); // 结束逐张
      centerGroup.position.y = Math.max(-0.34, centerGroup.position.y - dt * 0.9); // 升牌盘下降
    } // 结束 washPose

    /* ================= 八、骰子动画 ================= */
    let diceRolling = false; // 是否在掷
    function rollDice(v1, v2, cb) { // 掷两颗骰子
      diceRolling = true; // 标记
      const targets = [v1, v2]; // 点数
      dice.forEach(function (d, i) { // 逐颗
        d.from = { x: d.mesh.rotation.x, y: d.mesh.rotation.y, z: d.mesh.rotation.z }; // 起点
        d.to = { x: Math.PI * 2 * (2 + i), y: Math.PI * 2 * 3, z: Math.PI * 2 * 2 }; // 目标（多转两圈）
        d.hop = 1.0 + Math.random() * 0.5; // 弹跳高度
        d.t = 0; d.dur = 0.9 + i * 0.12; d.val = targets[i]; // 计时与点数
      }); // 结束逐颗
      setTimeout(function () { diceRolling = false; if (cb) { cb(); } }, 1100); // 结束回调
    } // 结束 rollDice

    /* ================= 九、渲染循环 ================= */
    const clock = new T.Clock(); // 计时器
    let onPick = null; // 拾取回调
    const ray = new T.Raycaster(); // 射线
    const ndc = new T.Vector2(); // 归一化设备坐标

    function loop() { // 渲染循环入口（由 setAnimationLoop 每帧调用）
      frame(Math.min(0.05, clock.getDelta()), true); // 帧间隔上限 50ms，防止切后台后跳变
    } // 结束 loop

    function frame(dt, draw) { // 单帧推进（抽出来便于无头自检同步快进）
      const _dt = dt; // 帧时长（秒）
      // 相机缓动：拖拽、滚轮、预设切换共用同一套阻尼，任何时刻打断都不会跳
      const dT = orbit.tTheta - orbit.theta, dP = orbit.tPhi - orbit.phi, dZ = orbit.tZoom - orbit.zoom; // 角度与缩放差
      const dX = orbit.tTx - orbit.tx, dQ = orbit.tTz - orbit.tz; // 焦点差
      if (Math.abs(dT) + Math.abs(dP) + Math.abs(dZ) + Math.abs(dX) + Math.abs(dQ) > 1e-4) { // 还在移动
        const k = Math.min(1, _dt * 16); // 阻尼系数（约 60ms 追上目标）
        orbit.theta += dT * k; orbit.phi += dP * k; orbit.zoom += dZ * k; // 逼近
        orbit.tx += dX * k; orbit.tz += dQ * k; // 逼近焦点
        applyCamera(); // 重新摆位
      } // 结束缓动
      if (mode === "wash") { // 洗牌表演
        washPose(_dt); // 聚拢 + 抖动 + 自转
        if (washT >= WASH_DUR) { mode = "play"; lastSig = ""; } // 表演结束，允许重新按状态排布
      } // 结束洗牌
      else { // 正常布局
        centerGroup.position.y += (0 - centerGroup.position.y) * Math.min(1, _dt * 4); // 升牌盘回到原位
        tiles.forEach(function (t) { // 逐张推进补间
          if (!t.mesh.visible || !t.tween) { return; } // 跳过
          const tw = t.tween; // 补间
          tw.t += _dt / tw.dur; // 进度
          const p = Math.min(1, tw.t); // 截断
          const e = EASE(p); // 缓动
          t.mesh.position.lerpVectors(tw.from, t.tar, e); // 位置插值
          const dist = tw.from.distanceTo(t.tar); // 距离
          t.mesh.position.y += Math.sin(e * Math.PI) * Math.min(0.55, dist * 0.22) * (tw.lift === 0 ? 1 : tw.lift); // 抛物线抬升
          t.mesh.rotation.x = tw.fromRX + (t.tarRotX - tw.fromRX) * e; // 角度插值
          t.mesh.rotation.y = tw.fromRY + (t.tarRotY - tw.fromRY) * e; // 角度插值
          t.mesh.rotation.z = tw.fromRZ + (t.tarRotZ - tw.fromRZ) * e; // 角度插值
          if (p >= 1) { t.tween = null; t.mesh.position.copy(t.tar); } // 结束
        }); // 结束逐张
      } // 结束模式判断
      // 骰子补间
      dice.forEach(function (d) { // 逐颗
        if (!d.from || d.t >= 1) { return; } // 未掷过或已结束（避免首帧解引用 null）
        d.t = Math.min(1, d.t + _dt / d.dur); // 进度
        const e = EASE(d.t); // 缓动
        d.mesh.rotation.x = d.from.x + (d.to.x - d.from.x) * e; // 旋转
        d.mesh.rotation.y = d.from.y + (d.to.y - d.from.y) * e; // 旋转
        d.mesh.rotation.z = d.from.z + (d.to.z - d.from.z) * e; // 旋转
        d.mesh.position.y = 0.1 + Math.sin(Math.PI * Math.min(1, d.t * 1.2)) * d.hop; // 弹跳
      }); // 结束逐颗
      if (draw !== false) { renderer.render(scene, camera); } // 绘制（自检快进时可跳过）
    } // 结束 frame

    /* ================= 十、尺寸自适应 ================= */
    function resize() { // 根据容器调整（只更新基础距离与宽高比，机位由 orbit 决定）
      const w = host.clientWidth || 1, h = host.clientHeight || 1; // 实测
      renderer.setSize(w, h, false); // 渲染器尺寸
      camera.aspect = w / h; // 宽高比
      const half = camera.fov * Math.PI / 360; // 纵向半视角（弧度）
      const need = TABLE * 0.54; // 需要完整入镜的半径（略收边，让桌面铺满画面）
      const dV = need / Math.sin(half); // 纵向需要的距离
      const dH = need / Math.sin(Math.atan(Math.tan(half) * camera.aspect)); // 横向需要的距离
      orbit.fit = Math.max(dV, dH) * 1.02; // 取大者并留 2% 余量（作为 zoom=1 的基准距离）
      camera.updateProjectionMatrix(); // 更新矩阵
      applyCamera(); // 重新摆位
    } // 结束 resize
    resize(); // 首次
    if (root.ResizeObserver) { new root.ResizeObserver(resize).observe(host); } // 监听尺寸

    /* ================= 十一、拾取 + 视角交互（拖拽旋转 / 滚轮缩放 / 双指捏合） ================= */
    function pointerToNdc(e) { // 屏幕坐标 → NDC
      const r = renderer.domElement.getBoundingClientRect(); // 画布矩形
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; // 归一
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1; // 归一（Y 翻转）
    } // 结束 pointerToNdc
    function pick(e) { // 拾取一张手牌
      pointerToNdc(e); // 换算
      ray.setFromCamera(ndc, camera); // 射线
      const hits = ray.intersectObjects(tiles.filter(function (t) { return t.mesh.visible && t.group === "hand0"; }).map(function (t) { return t.mesh; }), false); // 仅玩家手牌
      if (!hits.length) { return null; } // 未命中
      const mesh = hits[0].object; // 命中网格
      const t = tiles.find(function (x) { return x.mesh === mesh; }); // 反查
      return t ? t.kind : null; // 返回牌种
    } // 结束 pick

    const pointers = new Map(); // 按下中的指针（双指捏合用）
    let drag = null; // 拖拽状态（区分「转动视角」与「点击出牌」）
    let pinch0 = 0, pinchZoom0 = 1; // 双指起始间距 / 起始缩放值

    host.addEventListener("pointerdown", function (e) { // 按下：可能是拖拽视角，也可能是点击出牌
      if (e.pointerType === "mouse" && e.button !== 0) { return; } // 只认左键与触摸
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); // 记录指针
      try { host.setPointerCapture(e.pointerId); } catch (err) {} // 捕获：手指/鼠标移出画布也能继续拖
      if (pointers.size === 1) { // 单指：准备拖拽
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false }; // 起点
      } else if (pointers.size === 2) { // 双指：准备捏合缩放
        drag = null; // 取消拖拽
        const arr = Array.from(pointers.values()); // 两个指针
        pinch0 = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y); // 起始间距
        pinchZoom0 = orbit.tZoom; // 起始缩放
      } // 结束分支
    }); // 结束按下

    host.addEventListener("pointermove", function (e) { // 移动
      const p = pointers.get(e.pointerId); // 当前指针
      if (!p) { return; } // 未按下
      p.x = e.clientX; p.y = e.clientY; // 更新位置
      if (pointers.size >= 2) { // 双指捏合缩放
        const arr = Array.from(pointers.values()); // 两个指针
        const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y); // 当前间距
        if (pinch0 > 12 && d > 12) { orbit.tZoom = clampV(pinchZoom0 * (pinch0 / d), ZOOM_MIN, ZOOM_MAX); markCustom(); } // 间距变大 → 拉近
        return; // 结束
      } // 结束捏合
      if (!drag || drag.id !== e.pointerId) { return; } // 非拖拽
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; // 本次增量
      drag.x = e.clientX; drag.y = e.clientY; // 更新
      if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 6) { // 超过阈值才算拖拽（避免点击时手抖）
        drag.moved = true; // 标记
        host.classList.add("mjGrab"); // 光标变抓取中
      } // 结束阈值
      if (!drag.moved) { return; } // 还没拖动
      orbit.tTheta -= dx * 0.0075; // 左右拖 → 绕桌旋转
      orbit.tPhi = clampV(orbit.tPhi - dy * 0.006, PHI_MIN, PHI_MAX); // 上下拖 → 抬高压低视角
      markCustom(); // 取消预设高亮
    }); // 结束移动

    function endPointer(e, cancelled) { // 松手 / 取消
      pointers.delete(e.pointerId); // 移除指针
      try { host.releasePointerCapture(e.pointerId); } catch (err) {} // 释放捕获
      if (pointers.size < 2) { pinch0 = 0; } // 退出捏合
      if (drag && drag.id === e.pointerId) { // 结束拖拽
        const wasDrag = drag.moved; // 是否真的拖动过
        drag = null; // 清状态
        host.classList.remove("mjGrab"); // 恢复光标
        if (!cancelled && !wasDrag && onPick) { const k = pick(e); if (k != null) { onPick(k); } } // 纯点击 → 出牌
      } // 结束拖拽
    } // 结束 endPointer
    host.addEventListener("pointerup", function (e) { endPointer(e, false); }); // 松手
    host.addEventListener("pointercancel", function (e) { endPointer(e, true); }); // 系统取消

    host.addEventListener("wheel", function (e) { // 滚轮缩放（缩放到边界后放行，页面可以正常滚动）
      const prev = orbit.tZoom; // 原值
      orbit.tZoom = clampV(prev * Math.pow(1.0016, e.deltaY), ZOOM_MIN, ZOOM_MAX); // 指数缩放，快慢都与当前距离成比例
      if (orbit.tZoom !== prev) { e.preventDefault(); markCustom(); } // 真的变了才拦截
    }, { passive: false }); // 需要 preventDefault，故 passive:false

    renderer.setAnimationLoop(loop); // 启动循环

    /* ================= 十二、洗牌散牌表演 ================= */
    function scatter() { // 洗牌：先散到桌心，再进入 wash 表演（约 0.9 秒后由 sync 重新砌墙）
      for (let i = 0; i < tiles.length; i++) { // 逐张
        const t = tiles[i]; // 当前
        t.mesh.visible = true; // 全部显示
        if (t.kind < 0) { t.kind = Math.floor(Math.random() * 34); t.mesh.material = matsOf(t.kind); } // 空闲牌临时给个随机牌面
        t.mesh.position.set((Math.random() - 0.5) * 1.3, 0.06 + Math.random() * 0.3, (Math.random() - 0.5) * 1.3); // 桌心随机散落
        t.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0); // 随机朝向（平放）
        t.tween = null; // 清补间（否则本帧插值会把人拽回去）
      } // 结束逐张
      centerGroup.position.y = -0.32; // 升牌盘下沉
      setMode("wash"); // 进入洗牌表演
    } // 结束 scatter

    return { // 对外接口
      renderer: renderer, scene: scene, camera: camera, tiles: tiles, // 暴露核心对象（tiles 供自检分组统计）
      sync: sync, // 同步状态
      scatter: scatter, // 洗牌散牌
      setMode: setMode, // 表演模式
      rollDice: rollDice, // 掷骰
      onPick: function (fn) { onPick = fn; }, // 注册拾取回调
      setView: setView, // 切换预设视角（overview / top / hand）
      onView: function (fn) { onView = fn; }, // 注册视角变更回调（UI 高亮按钮）
      getView: function () { return orbit.active; }, // 当前视角名
      orbit: orbit, // 轨道参数（自检/调试用）
      step: function (dt, draw) { frame(dt || 0.016, draw); }, // 手动推进一帧（无头自检用）
      resize: resize, // 手动自适应
      dispose: function () { renderer.setAnimationLoop(null); renderer.dispose(); if (host.contains(renderer.domElement)) { host.removeChild(renderer.domElement); } } // 销毁
    }; // 结束接口
  } // 结束 create

  root.MJScene = { create: create }; // 导出
})(typeof window !== "undefined" ? window : globalThis); // 作用域根

