// ================= 6.0 新增：桌宠模块（SVG 表情球 · 参考情绪球引擎设计） =================
let petAffinity = parseFloat(localStorage.getItem("scratch-pet-affinity")) || 0; // 好感度
let petItems = loadCfg("scratch-pet-items", { owned: [], wearing: null }); // 已购配饰与佩戴
let petEmoMode = localStorage.getItem("scratch-pet-emotion-mode") || "manual"; // 表情模式：manual/random/emotion
let petEmotion = "happy"; // 当前表情
let petChatLog = loadCfg("scratch-pet-chat", []); // 聊天记录（最多 50 条）
let petEmoTimer = null; // 随机表情计时器
const PET_EMOS = ["happy", "neutral", "sad", "excited"]; // 四种表情枚举（6.1：按需求移除生气 angry 与害羞 shy）
function petSave() { // 持久化桌宠状态
  localStorage.setItem("scratch-pet-affinity", petAffinity); // 好感
  saveCfg("scratch-pet-items", petItems); // 配饰
  saveCfg("scratch-pet-chat", petChatLog.slice(-50)); // 聊天（最近 50 条）
} // 结束 petSave
const PET_EMO_ID = { happy: "10", neutral: "02", sad: "12", excited: "33" }; // 逻辑表情 → aora-bot emotion-ball 表情 ID（10 开心 / 02 待机放空 / 12 失落 / 33 任务完成庆祝；6.1 移除 21 生气与 14 害羞）
let petEngine = null; // emotion-ball 引擎实例（首次进入桌宠页时懒创建）
function petEnsureEngine() { // 创建引擎（aora-bot-main 原版 emotion-ball，源码零修改集成）
  if (petEngine) { return petEngine; } // 已创建直接复用
  const host = $("petBall"); // 容器节点
  if (!host || !window.EmotionBall || !EmotionBall.create) { return null; } // 容器或引擎未加载时保护
  host.innerHTML = ""; // 清空容器（此前版本的手绘 SVG 已废弃）
  petEngine = EmotionBall.create(host, { emotion: PET_EMO_ID[petEmotion] || "02", idle: true }); // 引擎驱动：呼吸/眨眼/注视/待机小动作全部内置
  return petEngine; // 返回实例
} // 结束 petEnsureEngine
function petRender() { // 刷新配饰角标与好感条（球体画面由引擎每帧渲染，这里只管外围）
  const ball = $("petBall"); if (!ball) { return; } // 节点保护
  const wear = petItems.wearing ? (PET_CFG.accessories.find(function (a) { return a.id === petItems.wearing; }) || {}).name || "" : ""; // 佩戴配饰 emoji 名
  if (wear) { ball.dataset.acc = wear.trim().split(" ")[0]; ball.classList.add("acc"); } // 有配饰：写角标数据并挂类（CSS ::after 渲染，不干扰引擎 SVG）
  else { ball.classList.remove("acc"); delete ball.dataset.acc; } // 无配饰：清角标
  const pct = Math.min(100, petAffinity); // 好感条百分比（条上限 100 显示）
  $("affinityFill").style.width = pct + "%"; $("affinityText").textContent = "好感度 " + Math.round(petAffinity); // 刷新
} // 结束 petRender
function petSetEmotion(emo) { // 切换表情（逻辑名 → 引擎 ID，形变过渡由引擎内置弹簧完成）
  petEmotion = PET_EMOS.indexOf(emo) >= 0 ? emo : "neutral"; // 非法回退平静
  const eng = petEnsureEngine(); // 引擎就绪
  if (eng) { eng.setEmotion(PET_EMO_ID[petEmotion] || "02", { auto: true }); } // 切换表情（引擎带过渡动画）
  if (eng && (petEmotion === "happy" || petEmotion === "excited")) { eng.bounce(); } // 开心/兴奋：引擎原生弹跳（彩带自旋由表情自带）
  petRender(); // 刷新配饰与好感
} // 结束 petSetEmotion
function petSetMode(mode) { // 切换表情模式（三选互斥）
  petEmoMode = mode; localStorage.setItem("scratch-pet-emotion-mode", mode); // 存档
  if (petEmoTimer) { clearInterval(petEmoTimer); petEmoTimer = null; } // 清旧随机器
  if (mode === "random") { petEmoTimer = setInterval(function () { petSetEmotion(PET_EMOS[Math.floor(Math.random() * PET_EMOS.length)]); }, 8000 + Math.floor(Math.random() * 7000)); } // 随机模式：8–15s 换表情（周期在区间内近似）
  if (mode === "manual") { petSetEmotion("happy"); } // 手动模式默认开心，点球切换
} // 结束 petSetMode
function petRenderFoods() { // 渲染食物栏（按配置）
  const wrap = $("foodList"); if (!wrap) { return; } // 保护
  wrap.innerHTML = ""; // 清空
  PET_CFG.foods.forEach(function (f) { // 逐个食物
    const b = document.createElement("button"); b.className = "foodBtn"; // 按钮样式
    b.innerHTML = "<span>" + f.name + '</span><span class="fPri">¥' + (+f.price).toFixed(2) + " · +" + f.affinity + "</span>"; // 名称与价签
    b.addEventListener("click", function () { // 点击喂食
      if (balance < f.price) { toast("余额不足，买不起这份 " + f.name + "…"); return; } // 校验
      payMoney(f.price); // 扣款（复用滚轮）
      petAffinity = Math.max(0, petAffinity + (+f.affinity || 0)); // 加好感
      petSave(); petRender(); petRenderShop(); // 存与刷（6.1：同步刷新配饰商店，好感达标立即解锁文案）
      petSetEmotion("excited"); // 进食开心
      toast(f.name + " 好吃！好感 +" + f.affinity); // 提示
    }); // 结束绑定
    wrap.appendChild(b); // 上树
  }); // 结束遍历
} // 结束 petRenderFoods
function petRenderShop() { // 渲染配饰商店
  const wrap = $("accShop"); if (!wrap) { return; } // 保护
  wrap.innerHTML = ""; // 清空
  PET_CFG.accessories.forEach(function (a) { // 逐个配饰
    const chip = document.createElement("button"); chip.className = "accChip" + (petItems.owned.indexOf(a.id) >= 0 ? " owned" : ""); // 已购高亮
    const locked = petAffinity < a.minAffinity; // 好感门槛（仅用于初始文案显示）
    chip.textContent = a.name + (petItems.owned.indexOf(a.id) >= 0 ? " · 已拥有" : locked ? " · 好感 " + a.minAffinity + " 解锁" : " · ¥" + (+a.price).toFixed(2)); // 文案三态
    chip.addEventListener("click", function () { // 点击购买/佩戴
      if (petItems.owned.indexOf(a.id) < 0) { // 未拥有：购买
        const lockedNow = petAffinity < a.minAffinity; // 6.1 修复：点击瞬间重算门槛（旧版沿用渲染时闭包值，喂食加好感后判定过期）
        if (lockedNow) { toast("好感度到 " + a.minAffinity + " 才能解锁 " + a.name); return; } // 门槛（按实时好感判定）
        if (balance < a.price) { toast("余额不足，攒攒票钱～"); return; } // 余额
        if (!confirm("购买 " + a.name + "（¥" + (+a.price).toFixed(2) + "）？")) { return; } // 确认
        payMoney(a.price); // 扣款
        petItems.owned.push(a.id); petItems.wearing = a.id; // 入库并佩戴
        petSave(); petRender(); petRenderShop(); // 存与刷
        petSetEmotion("happy"); toast("🎁 换上 " + a.name + " 啦！"); // 提示（6.1：害羞表情已移除，改开心）
      } else { // 已拥有：切换佩戴
        petItems.wearing = petItems.wearing === a.id ? null : a.id; // 再点取消佩戴
        petSave(); petRender(); petRenderShop(); // 存与刷
      } // 结束购买/佩戴分支
    }); // 结束绑定
    wrap.appendChild(chip); // 上树
  }); // 结束遍历
} // 结束 petRenderShop
function petPushMsg(cls, text) { // 追加一条聊天消息（入 UI 与存档）
  petChatLog.push({ who: cls, text: text, time: Date.now() }); // 入档
  if (petChatLog.length > 50) { petChatLog = petChatLog.slice(-50); } // 截断 50 条
  petSave(); // 持久化
  const box = $("petMsgs"); // 消息容器
  const el = document.createElement("div"); el.className = "pmsg " + (cls === "me" ? "me" : "bot"); el.textContent = text; // 气泡
  box.appendChild(el); box.scrollTop = box.scrollHeight; // 上树并滚底
} // 结束 petPushMsg
async function petChatSend(text) { // 发送聊天：走本地代理 POST /api/chat
  petPushMsg("me", text); // 先上我方气泡
  const ctrl = new AbortController(); const t = setTimeout(function () { ctrl.abort(); }, 8000); // 8 秒超时中断
  try { // 网络异常全部兜住
    const r = await fetch("http://127.0.0.1:" + (+PET_CFG.chatPort || 8765) + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }), signal: ctrl.signal }); // 调本地代理
    const data = await r.json(); // 解析
    let reply = "（桌宠没回话…）", emo = "neutral"; // 兜底文案与情绪
    try { const j = typeof data.reply === "string" ? JSON.parse(data.reply) : data.reply; if (j && j.reply) { reply = j.reply; emo = j.emotion || "neutral"; } else { reply = String(data.reply || reply); } } // 代理返回已是 {reply,emotion} 或内嵌 JSON 双兼容
    catch (e) { reply = String(data.reply || reply); } // 解析失败原样显示（降级 neutral）
    petPushMsg("bot", reply); // 上桌宠气泡
    petSetEmotion(PET_EMOS.indexOf(emo) >= 0 ? emo : "neutral"); // 聊天情绪驱动表情（「按聊天情绪」模式的主驱动；其余模式同样即时反馈）
  } catch (e) { // 失败/超时
    toast("桌宠暂时走神了"); // 规格要求的降级提示（不阻塞 UI）
  } finally { clearTimeout(t); } // 清计时器
} // 结束 petChatSend
$("petBall").addEventListener("click", function () { // 点球：手动模式下循环表情 / 其他模式弹跳卖萌
  if (petEmoMode === "manual") { const i = PET_EMOS.indexOf(petEmotion); petSetEmotion(PET_EMOS[(i + 1) % PET_EMOS.length]); } // 手动循环
  else { petSetEmotion(petEmotion); } // 其他模式重播弹跳
}); // 结束点球
$("petBall").addEventListener("contextmenu", function (e) { // 右键：打开聊天抽屉
  e.preventDefault(); // 阻止默认菜单（规格 5.2）
  $("petChat").classList.add("show"); // 右滑展开
  $("pcInput").focus(); // 聚焦输入
}); // 结束右键
$("pcClose").addEventListener("click", function () { $("petChat").classList.remove("show"); }); // 收起抽屉
$("pcSend").addEventListener("click", function () { const v = $("pcInput").value.trim(); if (!v) { return; } $("pcInput").value = ""; petChatSend(v); }); // 发送按钮
$("pcInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { const v = $("pcInput").value.trim(); if (v) { $("pcInput").value = ""; petChatSend(v); } } }); // 回车发送
document.querySelectorAll('input[name="emoMode"]').forEach(function (r) { // 表情模式单选绑定
  r.checked = r.value === petEmoMode; // 恢复上次选择
  r.addEventListener("change", function () { petSetMode(r.value); }); // 切换
}); // 结束绑定
function petInit() { // 桌宠页初始化（进页时调用）
  petEnsureEngine(); // 确保 emotion-ball 引擎已创建（aora-bot 原版）
  if (petEngine) { petEngine.setActive(true); } // 恢复渲染循环（离开页时曾暂停）
  petRenderFoods(); petRenderShop(); petRender(); // 渲染三件套
  document.querySelectorAll("#petMsgs .pmsg").forEach(function (el) { el.remove(); }); // 清空 DOM 消息（防重复）
  petChatLog.forEach(function (m) { const el = document.createElement("div"); el.className = "pmsg " + (m.who === "me" ? "me" : "bot"); el.textContent = m.text; $("petMsgs").appendChild(el); }); // 回放历史消息
  if (petEmoMode === "random") { petSetMode("random"); } // 恢复随机模式计时器
} // 结束 petInit
viewHooks.leave["Pet"] = function () { // 离开桌宠页：暂停引擎渲染循环（60fps 目标，规格 9）
  if (petEngine) { petEngine.setActive(false); } // 引擎挂起（表情状态保留，回来即恢复）
}; // 结束离开钩子

