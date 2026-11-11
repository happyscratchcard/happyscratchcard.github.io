// ================= 启动 =================
renderBalance(); // 余额与借钱按钮（首次同时初始化滚存显示）
refreshJack(); // 滚存头奖牌
refreshStreak(); // 转运条
refreshShards(); // 碎片行与合成按钮
$("happySpeed").value = happySpeedIdx; // 恢复爽刮速度滑杆位置（上次选择）
$("happySpeedVal").textContent = happySpeedLabel(happySpeedIdx); // 恢复速度显示文案
$("maxDebtNum").textContent = MAX_DEBT; // 顶栏借款上限提示
refreshStock(); // 初始化商店页库存显示（随发行方）
setIssuer(issuerIdx); // 初始化发行方开关（记住上次选择，内部再刷一次库存）
renderHall(); // 徽章殿堂
(function boot() { // 启动恢复流程（修复：抽卡/刮卡阶段退出后重进自动找回）
  const raw = localStorage.getItem("scratch-batch"); // 读取批次存档
  if (raw) { try { savedBatch = JSON.parse(raw); } catch (e) { savedBatch = null; } } // 解析容错
  if (savedBatch && savedBatch.stage) { restoreBatch(); } // 有未完成批次：恢复现场
  else { refreshResumable(); } // 无存档：刷新商店暂存条
})(); // 结束启动
