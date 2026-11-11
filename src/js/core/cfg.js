// ================= 6.0 新增：通用配置读取（损坏回退默认，不抛错） =================
function loadCfg(key, defaults) { // 读取 scratch- 前缀配置；损坏 JSON 回退默认并 console.warn
  try { // JSON 解析可能抛错，全部兜住
    const raw = localStorage.getItem(key); // 读原始字符串
    if (!raw) { return JSON.parse(JSON.stringify(defaults)); } // 无存档：返回默认深拷贝
    const v = JSON.parse(raw); // 解析
    if (v && typeof v === "object") { return Object.assign(JSON.parse(JSON.stringify(defaults)), v); } // 合并默认（浅层字段级覆盖）
    console.warn("[cfg] 结构异常，回退默认：", key); // 异常结构警告
    return JSON.parse(JSON.stringify(defaults)); // 回退默认
  } catch (e) { // 解析失败
    console.warn("[cfg] 解析失败，回退默认：", key, e); // 警告
    return JSON.parse(JSON.stringify(defaults)); // 回退默认
  } // 结束兜底
} // 结束 loadCfg
function saveCfg(key, val) { localStorage.setItem(key, JSON.stringify(val)); } // 写入配置
const SKIP_CFG = loadCfg("scratch-skip-cfg", { msPerTicket: 950, capMs: 60000 }); // 跳过进度配置（第 7 节）：每张 950ms、上限 60s
const SLOT_CFG = loadCfg("scratch-slot-cfg", { // 老虎机配置（4.1 · 6.1 数字版）
  cost: 1, // 单注 1 元
  symbols: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], // 十个转盘数字（6.1：替换原柠檬等 emoji 图案）
  payouts: [ // 三同奖额与权重表（sym 为数字；空奖 = 未命中）
    { sym: "1", amt: 3, w: 30 }, // 数字 1：常见小奖
    { sym: "3", amt: 5, w: 18 }, // 数字 3
    { sym: "5", amt: 8, w: 10 }, // 数字 5
    { sym: "6", amt: 12, w: 6 }, // 数字 6
    { sym: "8", amt: 25, w: 3 }, // 数字 8
    { sym: "9", amt: 60, w: 1.2 }, // 数字 9
    { sym: "7", amt: 150, w: 0.4 } // 数字 7：稀有大奖
  ], // 结束赔率表
  spinDurationMs: 2600 // 转盘时长
}); // 结束 SLOT_CFG
(function slotSanitize() { // 旧版存档清洗：localStorage 里可能残留 emoji 图案配置，统一归一为数字
  if (!Array.isArray(SLOT_CFG.symbols) || !SLOT_CFG.symbols.every(function (s) { return /^[0-9]$/.test(String(s)); })) { // 图案表含非数字
    SLOT_CFG.symbols = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]; // 重置为标准数字表
    saveCfg("scratch-slot-cfg", SLOT_CFG); // 立即回写修正
  } // 结束清洗判断
  SLOT_CFG.payouts.forEach(function (p) { // 赔率表逐行清洗
    const d = String(p.sym).replace(/[^0-9]/g, "").slice(0, 1); // 只保留首个数字字符
    if (d) { p.sym = d; } else { p.sym = "7"; } // 非法 sym 回退为大七
  }); // 结束清洗
})(); // 结束 slotSanitize
const GACHA_CFG = loadCfg("scratch-gacha-cfg", { // 扭蛋机配置（4.2）
  cost: 2, // 单价 2 元
  freeTicketMode: "real", // 免费福卡模式：real=真票进抽卡页；cash=折现 2 元
  pool: [ // 彩蛋颜色池（weight 可为最大项；空奖合法）
    { color: "#e74c3c", prizeType: "cash", amt: 5, w: 30 }, // 红：5 元
    { color: "#f1c40f", prizeType: "cash", amt: 10, w: 12 }, // 黄：10 元
    { color: "#9b59b6", prizeType: "cash", amt: 30, w: 4 }, // 紫：30 元
    { color: "#3498db", prizeType: "ticket", amt: 2, w: 14 }, // 蓝：免费福卡
    { color: "#e8e8e8", prizeType: "empty", amt: 0, w: 40 } // 白：空奖（权重最大）
  ] // 结束颜色池
}); // 结束 GACHA_CFG
const CLAW_CFG = loadCfg("scratch-claw-cfg", { // 娃娃机配置（4.3）
  cost: 3, baseRate: 35, pityStep: 8, pityMax: 90, shelfCap: 12, // 单价 / 基础成功率% / 保底步长% / 保底上限% / 展示架容量
  dolls: [ // 玩偶池
    { id: "bear", name: "小熊", rarity: "普通", sellPrice: 2, weight: 40 }, // 普通熊
    { id: "rabbit", name: "兔子", rarity: "普通", sellPrice: 3, weight: 30 }, // 普通兔
    { id: "penguin", name: "企鹅", rarity: "稀有", sellPrice: 8, weight: 15 }, // 稀有企鹅
    { id: "unicorn", name: "独角兽", rarity: "史诗", sellPrice: 20, weight: 6 }, // 史诗独角兽
    { id: "dragon", name: "小龙", rarity: "传说", sellPrice: 60, weight: 2 } // 传说龙
  ] // 结束玩偶池
}); // 结束 CLAW_CFG
const PET_CFG = loadCfg("scratch-pet-cfg", { // 桌宠配置（5.1）
  chatPort: 8765, // 本地聊天代理端口（与 backend/server.py 一致）
  foods: [ // 食物配置：{id,name,price,affinity}
    { id: "milk", name: "🥛 牛奶", price: 1, affinity: 5 }, // 牛奶
    { id: "cookie", name: "🍪 饼干", price: 2, affinity: 10 }, // 饼干
    { id: "cake", name: "🍰 蛋糕", price: 5, affinity: 25 }, // 蛋糕
    { id: "feast", name: "🍱 大餐", price: 12, affinity: 60 } // 大餐
  ], // 结束食物
  accessories: [ // 配饰商店：{id,name,price,minAffinity}
    { id: "ribbon", name: "🎀 蝴蝶结", price: 5, minAffinity: 10 }, // 蝴蝶结
    { id: "hat", name: "🎩 礼帽", price: 15, minAffinity: 40 }, // 礼帽
    { id: "crown", name: "👑 皇冠", price: 40, minAffinity: 100 }, // 皇冠
    { id: "scarf", name: "🧣 围巾", price: 25, minAffinity: 70 } // 围巾
  ] // 结束配饰
}); // 结束 PET_CFG

