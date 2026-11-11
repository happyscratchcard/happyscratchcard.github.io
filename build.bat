@echo off
chcp 65001 >nul                        :: 切到 UTF-8，避免中文输出乱码
echo ============================================
echo   彩票模拟器 · 一键构建
echo ============================================

python -c "import PyInstaller" 2>nul   :: 检查 PyInstaller 是否已安装
if errorlevel 1 (                       :: 未安装则提示并退出
    echo [ERROR] 缺少 PyInstaller，请先执行：pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo [1/2] 打包单文件版 HTML ...
python tools\pack_single.py            :: 生成 dist\彩票模拟器_单文件版.html
if errorlevel 1 goto :err              :: 失败则跳到错误处理

echo.
echo [2/2] 打包 exe（单文件版 + 多文件版）...
python tools\build_exe.py --target all :: 生成 release\*.exe
if errorlevel 1 goto :err              :: 失败则跳到错误处理

echo.
echo [DONE] 构建完成，产物在 release 目录
pause
exit /b 0                              :: 正常结束

:err
echo.
echo [FAILED] 构建失败，请查看上方日志
pause
exit /b 1                              :: 异常结束
