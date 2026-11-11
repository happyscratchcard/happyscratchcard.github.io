# -*- coding: utf-8 -*-
"""build_exe.py：把 src/ 打成 Windows 可执行文件（pywebview 外壳 + 内嵌页面）。

依赖：pip install pywebview pyinstaller
用法：
    python tools/build_exe.py                  # 打两个 exe（单文件版 + 多文件版）
    python tools/build_exe.py --target single  # 只打单文件版
    python tools/build_exe.py --no-clean       # 复用上次缓存，构建更快

产物：release/彩票模拟器.exe          （内嵌单文件版页面）
      release/彩票模拟器_多文件版.exe  （内嵌整个 src/ 目录）
"""
import argparse            # 命令行参数
import os                  # 路径处理
import shutil              # 复制产物
import subprocess          # 调用 PyInstaller
import sys                 # 解释器路径与平台判断
import time                # 计时

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 仓库根目录
SRC = os.path.join(ROOT, "src")                                      # 源码目录
DIST = os.path.join(ROOT, "dist")                                    # 中间产物目录
RELEASE = os.path.join(ROOT, "release")                              # 最终产物目录
SHELL = os.path.join(ROOT, "desktop", "desktop_app_6x.py")           # pywebview 外壳入口
ICON = os.path.join(ROOT, "desktop", "app-icon.ico")                 # exe 图标
SINGLE_HTML = os.path.join(DIST, "彩票模拟器_单文件版.html")           # 单文件版页面
WORK = os.path.join(ROOT, "build")                                   # PyInstaller 工作目录
SEP = ";" if os.name == "nt" else ":"                                # --add-data 的平台分隔符（Windows 用分号）


def run(cmd, title):  # 执行外部命令并实时回显
    print("\n[RUN] %s\n      %s" % (title, " ".join(cmd)))            # 打印将要执行的命令
    t0 = time.time()                                                  # 计时起点
    p = subprocess.run(cmd)                                           # 同步执行，继承 stdout
    if p.returncode != 0:                                             # 非零退出码视为失败
        sys.exit("[FATAL] %s 失败（exit %d）" % (title, p.returncode))
    print("[OK] %s 完成，用时 %.1f 秒" % (title, time.time() - t0))     # 完成提示


def ensure_single_html():  # 保证单文件版页面存在且是最新的
    if not os.path.isfile(SINGLE_HTML):                               # 尚未生成
        print("[1/2] 未找到单文件版页面，先执行打包")
        run([sys.executable, os.path.join(ROOT, "tools", "pack_single.py")], "打包单文件版")
    else:                                                             # 已存在则提醒
        newer = max(os.path.getmtime(os.path.join(SRC, "index.html")),     # 入口页面修改时间
                    os.path.getmtime(os.path.join(SRC, "js", "core", "app.js")))  # 主脚本修改时间
        if newer > os.path.getmtime(SINGLE_HTML):                     # 源码比产物新
            print("[WARN] 源码比单文件版页面新，建议先运行 tools/pack_single.py 重新打包")
        else:                                                         # 产物是最新的
            print("[1/2] 单文件版页面已是最新：%s" % os.path.basename(SINGLE_HTML))


def pyinstaller(name, add_data, clean=True):  # 调用 PyInstaller 打一个 exe
    cmd = [sys.executable, "-m", "PyInstaller",                      # 用当前解释器调 PyInstaller
           "--noconfirm",                                             # 覆盖输出不再询问
           "--onefile",                                               # 打成单个 exe（内嵌资源）
           "--windowed",                                              # 无控制台窗口
           "--name", name,                                            # 产物名（英文，避免路径编码问题）
           "--distpath", RELEASE,                                     # 产物输出目录
           "--workpath", WORK,                                        # 中间文件目录
           "--specpath", WORK,                                        # spec 文件目录
           "--add-data", add_data]                                    # 内嵌资源：源路径<SEP>目标目录
    if os.path.isfile(ICON):                                          # 有图标才加，避免报错
        cmd += ["--icon", ICON]                                       # exe 图标
    if clean:                                                         # 是否清缓存
        cmd += ["--clean"]                                            # 全量重建
    cmd += [SHELL]                                                    # 入口脚本放最后
    run(cmd, "PyInstaller 打包 %s" % name)                            # 执行打包


def build_single():  # 单文件版 exe：内嵌一个 HTML
    ensure_single_html()                                              # 确保页面就绪
    pyinstaller("ScratchLottery", SINGLE_HTML + SEP + ".", clean=CLEAN)   # 页面放到 exe 内根目录
    src_exe = os.path.join(RELEASE, "ScratchLottery.exe")             # PyInstaller 产物
    dst_exe = os.path.join(RELEASE, "彩票模拟器.exe")                  # 中文友好名
    shutil.copy2(src_exe, dst_exe)                                    # 复制一份中文名
    os.remove(src_exe)                                                # 删掉英文名，避免重复
    print("[OK] 单文件版 exe：%s（%.1f MB）" % (dst_exe, os.path.getsize(dst_exe) / 1048576))


def build_multi():  # 多文件版 exe：内嵌整个 src/ 目录
    pyinstaller("ScratchLotteryMulti", SRC + SEP + "app", clean=CLEAN)  # 目录映射到 exe 内 app/
    src_exe = os.path.join(RELEASE, "ScratchLotteryMulti.exe")        # PyInstaller 产物
    dst_exe = os.path.join(RELEASE, "彩票模拟器_多文件版.exe")          # 中文友好名
    shutil.copy2(src_exe, dst_exe)                                    # 复制一份中文名
    os.remove(src_exe)                                                # 删掉英文名
    print("[OK] 多文件版 exe：%s（%.1f MB）" % (dst_exe, os.path.getsize(dst_exe) / 1048576))


def main():  # 命令行入口
    global CLEAN                                                  # 让构建函数读到本次的开关
    ap = argparse.ArgumentParser(description="把 src/ 打成 Windows exe")  # 参数解析器
    ap.add_argument("--target", choices=["single", "multi", "all"], default="all", help="打哪个版本")  # 目标
    ap.add_argument("--no-clean", action="store_true", help="复用 PyInstaller 缓存，构建更快")           # 不清缓存
    args = ap.parse_args()                                        # 解析
    CLEAN = not args.no_clean                                     # 是否清缓存

    if os.name != "nt":                                           # 非 Windows 无法产出 exe
        print("[WARN] 当前不是 Windows，PyInstaller 只会产出本机可执行文件，exe 请在 Windows 上构建")
    os.makedirs(RELEASE, exist_ok=True)                           # 确保产物目录存在
    os.makedirs(WORK, exist_ok=True)                              # 确保工作目录存在

    if args.target in ("single", "all"):                          # 单文件版
        build_single()
    if args.target in ("multi", "all"):                           # 多文件版
        build_multi()
    print("\n[DONE] 产物位于：%s" % RELEASE)                        # 收尾提示


if __name__ == "__main__":  # 直接运行
    CLEAN = True            # 默认清缓存（main 里会按参数覆盖）
    main()                  # 启动
