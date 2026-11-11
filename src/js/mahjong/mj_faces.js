// ================= 6.2 十六轮：麻将 · 牌面纹理（Canvas 程序化绘制，零外部资源） =================
// 一套纹理被全桌 136 张牌共享：34 种牌面 + 3 种赤宝牌 + 1 张背面。
(function (root) { // 自执行作用域
  "use strict"; // 严格模式
  if (!root.THREE) { return; } // 无 THREE 时不执行（降级由场景层处理）

  const FACE_W = 256, FACE_H = 360; // 牌面逻辑尺寸（绘制坐标一律按这个尺寸写，便于统一改字号）
  const SS = 2; // 超采样倍数（实际画布 512×720，缩到 30px 高时笔画才不会糊）
  const CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]; // 汉字数字
  const cache = {}; // 纹理缓存（kind → THREE.Texture）

  // 主色（相比初版整体加深，小尺寸下对比更强）
  const INK = "#101b28"; // 墨黑（万子数字 / 风牌）
  const RED = "#c2261a"; // 朱红（萬 / 中 / 赤宝牌）
  const GREEN = "#1f7a4b"; // 竹绿（發 / 条子）
  const BLUE = "#1e5f9e"; // 靛蓝（筒子）

  function mkCanvas(w, h) { // 建离屏画布
    const c = document.createElement("canvas"); // 创建
    c.width = w; c.height = h; // 尺寸（传入的是物理像素）
    return c; // 返回
  } // 结束 mkCanvas

  function inked(ctx, text, x, y, color, width) { // 同色描边再填充：等效加粗，缩到小尺寸时笔画依然结实
    ctx.lineJoin = "round"; // 圆角接头，避免尖角外溢
    ctx.miterLimit = 2; // 限制尖角长度
    ctx.lineWidth = width; // 描边宽度 = 加粗量
    ctx.strokeStyle = color; // 描边同色
    ctx.strokeText(text, x, y); // 先描边（向外扩一圈）
    ctx.fillStyle = color; // 填充色
    ctx.fillText(text, x, y); // 再填充（合起来就是加粗字）
  } // 结束 inked

  function roundRect(ctx, x, y, w, h, r) { // 圆角矩形路径
    ctx.beginPath(); // 起笔
    ctx.moveTo(x + r, y); // 左上
    ctx.arcTo(x + w, y, x + w, y + h, r); // 右上
    ctx.arcTo(x + w, y + h, x, y + h, r); // 右下
    ctx.arcTo(x, y + h, x, y, r); // 左下
    ctx.arcTo(x, y, x + w, y, r); // 闭合
    ctx.closePath(); // 收笔
  } // 结束 roundRect

  function baseFace(ctx) { // 绘制牌面底：象牙白 + 底部淡青竹色 + 内描边
    const g = ctx.createLinearGradient(0, 0, 0, FACE_H); // 竖向渐变
    g.addColorStop(0, "#fffdf6"); // 顶部暖白
    g.addColorStop(0.62, "#f7f4e9"); // 中部象牙
    g.addColorStop(1, "#e8f0e4"); // 底部淡青（传统麻将牌下段染色）
    ctx.fillStyle = g; // 填充
    roundRect(ctx, 0, 0, FACE_W, FACE_H, 18); // 圆角
    ctx.fill(); // 上色
    ctx.strokeStyle = "rgba(120,110,90,.18)"; // 内描边色
    ctx.lineWidth = 3; // 线宽
    roundRect(ctx, 6, 6, FACE_W - 12, FACE_H - 12, 14); // 内框
    ctx.stroke(); // 描边
  } // 结束 baseFace

  function drawWan(ctx, num, red) { // 万子：上方汉字数字，下方「萬」（字号占满牌宽，配合描边加粗）
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; // 居中
    ctx.font = 'bold 172px "Songti SC", "STSong", "SimSun", serif'; // 宋体显庄重（比初版大 15%）
    inked(ctx, CN[num - 1], FACE_W / 2, FACE_H * 0.318, red ? RED : INK, 10); // 数字（同色描边加粗）
    ctx.font = 'bold 152px "Songti SC", "STSong", "SimSun", serif'; // 萬略小
    inked(ctx, "萬", FACE_W / 2, FACE_H * 0.735, RED, 10); // 萬字恒红
  } // 结束 drawWan

  function drawDot(ctx, num, red) { // 筒子：圆点阵列
    const cx = FACE_W / 2, cy = FACE_H * 0.5; // 中心
    const R = 25; // 点半径（放大，缩到小尺寸还能看出点数）
    const spot = function (x, y, col) { // 画一个筒
      const c = col || (red ? RED : BLUE); // 该筒颜色
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); // 圆
      ctx.fillStyle = "#fffdf8"; ctx.fill(); // 白底
      ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke(); // 粗描边（笔画更实）
      ctx.beginPath(); ctx.arc(x, y, R * 0.44, 0, Math.PI * 2); // 内圈
      ctx.fillStyle = c; ctx.fill(); // 内点
    }; // 结束 spot
    const layout = { // 各点数的坐标（相对中心的比例）
      1: [[0, 0]], // 一点居中
      2: [[0, -0.17], [0, 0.17]], // 竖两
      3: [[-0.20, -0.18], [0, 0], [0.20, 0.18]], // 斜三
      4: [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]], // 四角
      5: [[-0.20, -0.19], [0.20, -0.19], [0, 0], [-0.20, 0.19], [0.20, 0.19]], // 五
      6: [[-0.18, -0.21], [0.18, -0.21], [-0.18, 0], [0.18, 0], [-0.18, 0.21], [0.18, 0.21]], // 六
      7: [[-0.20, -0.24], [0, -0.19], [0.20, -0.14], [-0.18, 0.02], [0.18, 0.02], [-0.18, 0.22], [0.18, 0.22]], // 七
      8: [[-0.18, -0.24], [0.18, -0.24], [-0.18, -0.08], [0.18, -0.08], [-0.18, 0.08], [0.18, 0.08], [-0.18, 0.24], [0.18, 0.24]], // 八
      9: [[-0.20, -0.24], [0, -0.24], [0.20, -0.24], [-0.20, 0], [0, 0], [0.20, 0], [-0.20, 0.24], [0, 0.24], [0.20, 0.24]] // 九
    }[num]; // 取布局
    layout.forEach(function (p) { spot(cx + p[0] * FACE_W, cy + p[1] * FACE_H); }); // 逐点绘制
  } // 结束 drawDot

  function drawBam(ctx, num, red) { // 条子：竹条（1 条画成鸟形简化图）
    const col = red ? RED : GREEN; // 主色
    if (num === 1) { // 一条：鸟（放大剪影，小尺寸也认得出）
      ctx.fillStyle = col; // 填色
      ctx.beginPath(); ctx.ellipse(FACE_W / 2, FACE_H * 0.53, 52, 68, 0, 0, Math.PI * 2); ctx.fill(); // 鸟身
      ctx.beginPath(); ctx.arc(FACE_W / 2 + 8, FACE_H * 0.34, 26, 0, Math.PI * 2); ctx.fill(); // 头
      ctx.beginPath(); ctx.moveTo(FACE_W / 2 + 30, FACE_H * 0.33); ctx.lineTo(FACE_W / 2 + 60, FACE_H * 0.30); ctx.lineTo(FACE_W / 2 + 30, FACE_H * 0.39); ctx.closePath(); ctx.fill(); // 喙
      ctx.beginPath(); ctx.ellipse(FACE_W / 2, FACE_H * 0.68, 34, 44, 0, 0, Math.PI); ctx.fillStyle = "#fffdf8"; ctx.fill(); // 腹
      return; // 结束
    } // 结束一条
    const bar = function (x, y, h) { // 一根竹条
      ctx.fillStyle = col; roundRect(ctx, x - 11, y - h / 2, 22, h, 11); ctx.fill(); // 圆头竖条（比初版宽 4px）
      ctx.fillStyle = "rgba(255,255,255,.5)"; roundRect(ctx, x - 3.5, y - h / 2 + 11, 6, h - 22, 3); ctx.fill(); // 高光
    }; // 结束 bar
    const cols = num <= 4 ? 2 : 3; // 列数
    const rows = Math.ceil(num / cols); // 行数
    let n = 0; // 已画数
    for (let r = 0; r < rows; r++) { // 逐行
      for (let c = 0; c < cols && n < num; c++, n++) { // 逐列
        const x = FACE_W / 2 + (c - (cols - 1) / 2) * 80; // 横向均分
        const y = FACE_H * 0.5 + (r - (rows - 1) / 2) * 96; // 纵向均分
        bar(x, y, 82); // 画一根
      } // 结束列
    } // 结束行
  } // 结束 drawBam

  function drawHonor(ctx, kind, red) { // 字牌
    const map = { 27: "東", 28: "南", 29: "西", 30: "北", 31: "", 32: "發", 33: "中" }; // 字面
    const ch = map[kind]; // 取字
    if (kind === 31) { // 白板：双线方框
      ctx.strokeStyle = red ? RED : BLUE; // 框色
      ctx.lineWidth = 12; // 线宽（加粗）
      roundRect(ctx, FACE_W * 0.2, FACE_H * 0.21, FACE_W * 0.6, FACE_H * 0.58, 10); ctx.stroke(); // 外框
      roundRect(ctx, FACE_W * 0.3, FACE_H * 0.31, FACE_W * 0.4, FACE_H * 0.38, 8); ctx.stroke(); // 内框
      return; // 结束
    } // 结束白板
    const col = red ? RED : (kind === 33 ? RED : (kind === 32 ? GREEN : INK)); // 中红 发绿 风墨黑
    ctx.font = 'bold 208px "Songti SC", "STSong", "SimSun", serif'; // 字牌字号最大（占满牌宽）
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; // 居中
    inked(ctx, ch, FACE_W / 2, FACE_H * 0.53, col, 11); // 描边加粗后填充
  } // 结束 drawHonor

  function makeFaceTexture(kind) { // 生成（并缓存）一张牌面纹理
    const key = "f" + kind; // 缓存键
    if (cache[key]) { return cache[key]; } // 命中缓存
    const cv = mkCanvas(FACE_W * SS, FACE_H * SS); // 画布（超采样：实际 512×720）
    const ctx = cv.getContext("2d"); // 上下文
    ctx.scale(SS, SS); // 之后所有绘制仍按 256×360 逻辑坐标写
    baseFace(ctx); // 底
    const red = kind >= 34; // 赤宝牌
    const k = kind >= 34 ? [4, 13, 22][kind - 34] : kind; // 基础牌种
    if (k < 9) { drawWan(ctx, k + 1, red); } // 万
    else if (k < 18) { drawDot(ctx, k - 8, red); } // 筒
    else if (k < 27) { drawBam(ctx, k - 17, red); } // 条
    else { drawHonor(ctx, k, red); } // 字
    const tex = new THREE.CanvasTexture(cv); // 转纹理
    tex.anisotropy = 16; // 各向异性拉满：斜视角下牌面依然锐利
    tex.needsUpdate = true; // 标记更新
    cache[key] = tex; // 入缓存
    return tex; // 返回
  } // 结束 makeFaceTexture

  function makeBackTexture() { // 牌背纹理（竹青 + 细纹 + 中央圆标）
    if (cache.back) { return cache.back; } // 缓存
    const cv = mkCanvas(FACE_W * SS, FACE_H * SS); // 画布（与牌面同超采样）
    const ctx = cv.getContext("2d"); // 上下文
    ctx.scale(SS, SS); // 逻辑坐标绘制
    const g = ctx.createLinearGradient(0, 0, FACE_W, FACE_H); // 斜向渐变
    g.addColorStop(0, "#2a6047"); // 深竹绿
    g.addColorStop(0.5, "#377a58"); // 中绿
    g.addColorStop(1, "#1f4a36"); // 暗绿
    ctx.fillStyle = g; roundRect(ctx, 0, 0, FACE_W, FACE_H, 18); ctx.fill(); // 底色
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2; // 细纹颜色
    for (let i = -FACE_H; i < FACE_W; i += 22) { // 斜线纹理
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + FACE_H, FACE_H); ctx.stroke(); // 一条斜线
    } // 结束纹理循环
    ctx.strokeStyle = "rgba(255,255,255,.38)"; ctx.lineWidth = 7; // 中央圆环
    ctx.beginPath(); ctx.arc(FACE_W / 2, FACE_H / 2, 48, 0, Math.PI * 2); ctx.stroke(); // 外环
    ctx.beginPath(); ctx.arc(FACE_W / 2, FACE_H / 2, 21, 0, Math.PI * 2); ctx.stroke(); // 内环
    const tex = new THREE.CanvasTexture(cv); // 转纹理
    tex.anisotropy = 16; tex.needsUpdate = true; // 设置
    cache.back = tex; // 缓存
    return tex; // 返回
  } // 结束 makeBackTexture

  function makeSideMaterial(color) { // 牌侧面色（象牙 / 竹绿）
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.62, metalness: 0.02 }); // 半哑光
  } // 结束 makeSideMaterial

  const ivorySide = makeSideMaterial(0xf3efe3); // 象牙侧面（正面所在牌体）
  const greenSide = makeSideMaterial(0x2f6b4f); // 竹绿侧面（背面所在牌体）

  function makeTileMaterials(kind) { // 返回 6 面材质数组（贴图顺序 +X -X +Y -Y +Z -Z）
    const face = new THREE.MeshStandardMaterial({ map: makeFaceTexture(kind), roughness: 0.48, metalness: 0.02 }); // 牌面
    const back = new THREE.MeshStandardMaterial({ map: makeBackTexture(), roughness: 0.66, metalness: 0.02 }); // 牌背
    return [ivorySide, ivorySide, face, back, ivorySide, greenSide]; // +Y 面为正面，-Y 为背面
  } // 结束 makeTileMaterials

  root.MJFaces = { makeTileMaterials: makeTileMaterials, makeFaceTexture: makeFaceTexture, makeBackTexture: makeBackTexture, FACE_W: FACE_W, FACE_H: FACE_H }; // 导出
})(typeof window !== "undefined" ? window : globalThis); // 作用域根

