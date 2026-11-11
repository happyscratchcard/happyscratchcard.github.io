// ================= 6.0 新增：管理员 · 四组玩法配置卡编辑器 =================
function cfgBindNum(inputId, get, set) { // 数字输入绑定小工具：打开面板时填值，点设置按钮写回
  const inp = $(inputId); // 输入框
  return function fillAndBind(btnId) { // 返回填充+绑定函数
    if (!inp) { return; } // 保护
    return { fill: function () { inp.value = get(); }, bind: function () { $(btnId).addEventListener("click", function () { const v = parseFloat(inp.value); if (isNaN(v)) { toast("请输入合法数值"); return; } set(v); toast("已保存"); }); } }; // 填值与保存
  }; // 结束返回
} // 结束 cfgBindNum
function cfgTableRender(tblId, rows, cols, onEdit, onDel) { // 通用配置表渲染：cols=[{k,label,step}]
  const tbl = $(tblId); if (!tbl) { return; } // 保护
  tbl.innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "<th></th></tr>"; // 表头
  rows.forEach(function (row, ri) { // 逐行
    const tr = document.createElement("tr"); // 行
    tr.innerHTML = cols.map(function (c) { return '<td><input type="text" data-r="' + ri + '" data-k="' + c.k + '" value="' + String(row[c.k]).replace(/"/g, "&quot;") + '"></td>'; }).join("") + '<td><button class="delRow" data-del="' + ri + '">✕</button></td>'; // 输入列 + 删除列
    tbl.appendChild(tr); // 上树
  }); // 结束行
  tbl.querySelectorAll("input").forEach(function (inp) { // 输入绑定
    inp.addEventListener("change", function () { onEdit(+inp.dataset.r, inp.dataset.k, inp.value); }); // 改动回调
  }); // 结束绑定
  tbl.querySelectorAll(".delRow").forEach(function (b) { b.addEventListener("click", function () { onDel(+b.dataset.del); }); }); // 删除绑定
} // 结束 cfgTableRender
function cfgNum(v, min, dft) { const n = parseFloat(v); return isNaN(n) ? dft : Math.max(min, n); } // 数值清洗
function renderSlotCfg() { // 渲染老虎机配置卡
  const ci = $("admSlotCost"); if (ci) { ci.value = SLOT_CFG.cost; } // 单价回填
  cfgTableRender("admSlotTbl", SLOT_CFG.payouts, // 表渲染
    [{ k: "sym", label: "数字" }, { k: "amt", label: "三同奖额¥" }, { k: "w", label: "权重" }], // 三列（6.1 图案改数字）
    function (r, k, v) { SLOT_CFG.payouts[r][k] = k === "sym" ? (String(v).replace(/[^0-9]/g, "").slice(0, 1) || "7") : cfgNum(v, 0, 0); saveCfg("scratch-slot-cfg", SLOT_CFG); }, // 编辑写回（6.1 sym 仅允许单个数字）
    function (r) { if (SLOT_CFG.payouts.length <= 2) { toast("至少保留两个图案"); return; } SLOT_CFG.payouts.splice(r, 1); saveCfg("scratch-slot-cfg", SLOT_CFG); renderSlotCfg(); }); // 删除（保底下限）
} // 结束 renderSlotCfg
$("admSlotCostSet").addEventListener("click", function () { const v = cfgNum($("admSlotCost").value, 0.5, 1); SLOT_CFG.cost = v; saveCfg("scratch-slot-cfg", SLOT_CFG); toast("老虎机单价已设为 ¥" + v.toFixed(2)); }); // 单价设置
$("admSlotAdd").addEventListener("click", function () { SLOT_CFG.payouts.push({ sym: String(SLOT_CFG.payouts.length % 10), amt: 5, w: 5 }); saveCfg("scratch-slot-cfg", SLOT_CFG); renderSlotCfg(); }); // 添加数字行（6.1）
function renderGachaCfg() { // 渲染扭蛋机配置卡
  const ci = $("admGachaCost"); if (ci) { ci.value = GACHA_CFG.cost; } // 单价回填
  const fm = $("admGachaFreeMode"); if (fm) { fm.value = GACHA_CFG.freeTicketMode; } // 模式回填
  cfgTableRender("admGachaTbl", GACHA_CFG.pool, // 表渲染
    [{ k: "color", label: "颜色" }, { k: "prizeType", label: "类型" }, { k: "amt", label: "金额¥" }, { k: "w", label: "权重" }], // 四列
    function (r, k, v) { // 编辑写回
      if (k === "color") { GACHA_CFG.pool[r][k] = String(v); } // 颜色按字符串
      else if (k === "prizeType") { GACHA_CFG.pool[r][k] = ["cash", "ticket", "empty"].indexOf(v) >= 0 ? v : "empty"; } // 类型三选
      else { GACHA_CFG.pool[r][k] = cfgNum(v, 0, 0); } // 数值
      saveCfg("scratch-gacha-cfg", GACHA_CFG); // 持久化
    }, // 结束编辑
    function (r) { if (GACHA_CFG.pool.length <= 2) { toast("至少保留两颗彩蛋"); return; } GACHA_CFG.pool.splice(r, 1); saveCfg("scratch-gacha-cfg", GACHA_CFG); renderGachaCfg(); }); // 删除
} // 结束 renderGachaCfg
$("admGachaCostSet").addEventListener("click", function () { GACHA_CFG.cost = cfgNum($("admGachaCost").value, 0.5, 2); saveCfg("scratch-gacha-cfg", GACHA_CFG); toast("扭蛋单价已设为 ¥" + GACHA_CFG.cost.toFixed(2)); }); // 单价
$("admGachaFreeMode").addEventListener("change", function () { GACHA_CFG.freeTicketMode = this.value === "cash" ? "cash" : "real"; saveCfg("scratch-gacha-cfg", GACHA_CFG); toast("免费福卡模式：" + (GACHA_CFG.freeTicketMode === "real" ? "真免费票" : "折现 ¥2")); }); // 模式切换
$("admGachaAdd").addEventListener("click", function () { GACHA_CFG.pool.push({ color: "#bbbbbb", prizeType: "empty", amt: 0, w: 10 }); saveCfg("scratch-gacha-cfg", GACHA_CFG); renderGachaCfg(); }); // 添加彩蛋
function renderClawCfg() { // 渲染娃娃机配置卡
  const ids = ["admClawCost", "admClawBase", "admClawStep", "admClawMax", "admClawCap"]; // 五个参数框
  const keys = ["cost", "baseRate", "pityStep", "pityMax", "shelfCap"]; // 对应键
  ids.forEach(function (id, i) { const el = $(id); if (el) { el.value = CLAW_CFG[keys[i]]; } }); // 回填
  cfgTableRender("admClawTbl", CLAW_CFG.dolls, // 表渲染
    [{ k: "name", label: "玩偶名" }, { k: "rarity", label: "稀有度" }, { k: "sellPrice", label: "售价¥" }, { k: "weight", label: "权重" }], // 四列
    function (r, k, v) { CLAW_CFG.dolls[r][k] = (k === "name" || k === "rarity") ? String(v).slice(0, 12) : cfgNum(v, 0, 0); saveCfg("scratch-claw-cfg", CLAW_CFG); }, // 编辑
    function (r) { if (CLAW_CFG.dolls.length <= 1) { toast("至少保留一只玩偶"); return; } CLAW_CFG.dolls.splice(r, 1); saveCfg("scratch-claw-cfg", CLAW_CFG); renderClawCfg(); }); // 删除
} // 结束 renderClawCfg
$("admClawSet").addEventListener("click", function () { // 五参数一键写入
  CLAW_CFG.cost = cfgNum($("admClawCost").value, 0.5, 3); // 单价
  CLAW_CFG.baseRate = Math.min(95, Math.max(5, cfgNum($("admClawBase").value, 5, 35))); // 基础率
  CLAW_CFG.pityStep = Math.min(50, Math.max(0, cfgNum($("admClawStep").value, 0, 8))); // 步长
  CLAW_CFG.pityMax = Math.min(100, Math.max(10, cfgNum($("admClawMax").value, 10, 90))); // 上限
  CLAW_CFG.shelfCap = Math.round(Math.min(99, Math.max(1, cfgNum($("admClawCap").value, 1, 12)))); // 容量
  saveCfg("scratch-claw-cfg", CLAW_CFG); clawSave(); // 持久化（含展示架 UI 刷新）
  toast("娃娃机参数已保存"); // 提示
}); // 结束五参数
$("admClawAdd").addEventListener("click", function () { CLAW_CFG.dolls.push({ id: "d" + Date.now(), name: "新玩偶", rarity: "普通", sellPrice: 2, weight: 10 }); saveCfg("scratch-claw-cfg", CLAW_CFG); renderClawCfg(); }); // 添加玩偶
function renderPetCfg() { // 渲染桌宠配置卡
  const pi = $("admPetPort"); if (pi) { pi.value = PET_CFG.chatPort; } // 端口回填
  cfgTableRender("admPetTbl", PET_CFG.foods, // 表渲染
    [{ k: "name", label: "食物" }, { k: "price", label: "价格¥" }, { k: "affinity", label: "好感+" }], // 三列
    function (r, k, v) { PET_CFG.foods[r][k] = k === "name" ? String(v).slice(0, 16) : cfgNum(v, 0, 0); saveCfg("scratch-pet-cfg", PET_CFG); petRenderFoods(); }, // 编辑并即时刷新食物栏
    function (r) { if (PET_CFG.foods.length <= 1) { toast("至少保留一种食物"); return; } PET_CFG.foods.splice(r, 1); saveCfg("scratch-pet-cfg", PET_CFG); renderPetCfg(); petRenderFoods(); }); // 删除
} // 结束 renderPetCfg
$("admPetPortSet").addEventListener("click", function () { PET_CFG.chatPort = Math.round(cfgNum($("admPetPort").value, 1024, 8765)); saveCfg("scratch-pet-cfg", PET_CFG); toast("聊天端口已设为 " + PET_CFG.chatPort); }); // 端口设置
$("admPetAdd").addEventListener("click", function () { PET_CFG.foods.push({ id: "f" + Date.now(), name: "🍗 新食物", price: 2, affinity: 10 }); saveCfg("scratch-pet-cfg", PET_CFG); renderPetCfg(); petRenderFoods(); }); // 添加食物
function renderSkipCfg() { // 渲染跳过时长配置卡
  $("admSkipMs").value = SKIP_CFG.msPerTicket; $("admSkipCap").value = SKIP_CFG.capMs; // 回填
} // 结束 renderSkipCfg
$("admSkipSet").addEventListener("click", function () { // 跳过参数写入
  SKIP_CFG.msPerTicket = Math.max(100, cfgNum($("admSkipMs").value, 100, 950)); // 每张计时
  SKIP_CFG.capMs = Math.max(3000, cfgNum($("admSkipCap").value, 3000, 60000)); // 上限
  saveCfg("scratch-skip-cfg", SKIP_CFG); // 持久化
  toast("跳过进度：每张 " + SKIP_CFG.msPerTicket + "ms、上限 " + SKIP_CFG.capMs + "ms"); // 提示
}); // 结束写入
function openAdminExt() { // 高级设置打开时同步四张配置卡
  renderSlotCfg(); renderGachaCfg(); renderClawCfg(); renderPetCfg(); renderSkipCfg(); // 五卡全刷
  renderClawShelf(); // 展示架统计同步
} // 结束 openAdminExt

