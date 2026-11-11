# -*- coding: utf-8 -*-
"""pack_single.py：把 src/ 多文件版源码打成一个可双击运行的单文件 HTML。

用法：
    python tools/pack_single.py                # 默认 src/ → dist/彩票模拟器_单文件版.html，并同步根目录 index.html
    python tools/pack_single.py --no-site      # 只产出 dist/，不动根目录 index.html
    python tools/pack_single.py --out x.html   # 指定输出路径

为什么要同步根目录 index.html：本仓库同时是 GitHub Pages 站点，站点入口就是根目录的
index.html。若入口与 dist/ 产物各存一份却不同步，线上就会停留在旧版本（历史上确实发生过）。
所以默认让两者在每次打包时自动保持一致。

原理：读取 src/index.html，把其中所有 <link rel="stylesheet"> 与 <script src> 换成
内联的 <style> / <script> 内容。不做代码压缩、不做任何改写，确保产物与源码逐字一致。
"""
import argparse          # 命令行参数解析
import os                # 路径处理
import re                # 正则匹配标签
import sys               # 退出码与平台信息

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根目录（tools 的上一级）
SRC_DIR = os.path.join(ROOT, "src")                                # 源码目录
DEFAULT_OUT = os.path.join(ROOT, "dist", "彩票模拟器_单文件版.html")  # 默认输出路径
SITE_ENTRY = os.path.join(ROOT, "index.html")                      # GitHub Pages 站点入口（根目录 index.html）

LINK_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>')          # 样式表标签
SCRIPT_RE = re.compile(r'<script\s+src="([^"]+)"\s*></script>')                     # 外链脚本标签


def read_text(path):  # 以 UTF-8 读文本
    with open(path, "r", encoding="utf-8", newline="") as f:  # newline="" 保留原始换行符
        return f.read()                                       # 返回全文


def make_inline_css(rel):  # 把一个 CSS 文件转成 <style> 块
    path = os.path.join(SRC_DIR, rel)                         # 资源绝对路径
    if not os.path.isfile(path):                              # 文件缺失直接报错，避免产出残缺页面
        sys.exit("[FATAL] 找不到样式文件：" + rel)
    css = read_text(path)                                     # 读样式内容
    css = css.replace("</style", "<\\/style")                 # 防止内容里出现闭合标签打断 HTML
    print("  + inline css  %-28s %6.1f KB" % (rel, len(css.encode("utf-8")) / 1024))
    return "<style>\n/* ==== %s ==== */\n%s\n</style>" % (rel, css)  # 带来源注释，便于在产物里定位


def make_inline_js(rel):  # 把一个 JS 文件转成 <script> 块
    path = os.path.join(SRC_DIR, rel)                         # 资源绝对路径
    if not os.path.isfile(path):                              # 文件缺失直接报错
        sys.exit("[FATAL] 找不到脚本文件：" + rel)
    js = read_text(path)                                      # 读脚本内容
    js = js.replace("</script", "<\\/script")                 # 关键：转义闭合标签，否则内联会截断
    print("  + inline js   %-28s %6.1f KB" % (rel, len(js.encode("utf-8")) / 1024))
    return "<script>\n/* ==== %s ==== */\n%s\n</script>" % (rel, js)  # 带来源注释


def pack(out_path, sync_site=True):  # 主流程：读入口 → 内联 → 写文件（可选同步站点入口）
    entry = os.path.join(SRC_DIR, "index.html")                # 入口页面
    if not os.path.isfile(entry):                              # 入口缺失
        sys.exit("[FATAL] 找不到入口文件：" + entry)
    html = read_text(entry)                                    # 读入口 HTML
    print("[1/3] 读取入口 index.html（%.1f KB）" % (len(html.encode("utf-8")) / 1024))

    css_n = len(LINK_RE.findall(html))                         # 统计外链样式数量
    js_n = len(SCRIPT_RE.findall(html))                        # 统计外链脚本数量
    print("[2/3] 内联资源：%d 个 CSS / %d 个 JS" % (css_n, js_n))
    html = LINK_RE.sub(lambda m: make_inline_css(m.group(1)), html)     # 逐个替换样式表
    html = SCRIPT_RE.sub(lambda m: make_inline_js(m.group(1)), html)    # 逐个替换脚本

    left = len(LINK_RE.findall(html)) + len(SCRIPT_RE.findall(html))    # 检查是否有漏网的外链
    if left:                                                           # 仍存在外链说明写法不标准
        print("[WARN] 仍有 %d 处外链资源未内联，产物可能依赖同目录文件" % left)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)      # 确保输出目录存在
    with open(out_path, "w", encoding="utf-8", newline="") as f:  # UTF-8 写出，保留换行
        f.write(html)                                          # 写全文
    size = os.path.getsize(out_path)                           # 产物大小
    print("[3/3] 完成：%s（%.2f MB）" % (out_path, size / 1048576))

    if sync_site:                                              # 需要同步站点入口时
        if os.path.abspath(out_path) == os.path.abspath(SITE_ENTRY):  # 产物本身就是入口，无需复制
            print("[SITE] 产物即站点入口，跳过同步")
        else:                                                  # 正常情况：把产物复制为根目录 index.html
            with open(out_path, "rb") as src, open(SITE_ENTRY, "wb") as dst:  # 二进制复制，保证逐字节一致
                dst.write(src.read())                          # 写入站点入口
            print("[SITE] 已同步站点入口：index.html（%.2f MB）" % (os.path.getsize(SITE_ENTRY) / 1048576))

    print("[OK] 双击该 HTML 即可离线运行，无需服务器")
    return out_path                                            # 返回路径便于上层调用


def main():  # 命令行入口
    ap = argparse.ArgumentParser(description="把 src/ 打包成单文件 HTML")  # 参数解析器
    ap.add_argument("--out", default=DEFAULT_OUT, help="输出文件路径")     # 可选输出路径
    ap.add_argument("--no-site", action="store_true", help="不同步根目录 index.html（仅产出 dist/）")  # 关闭站点同步
    args = ap.parse_args()                                                 # 解析参数
    out = args.out if os.path.isabs(args.out) else os.path.join(ROOT, args.out)  # 相对路径按仓库根解析
    pack(out, sync_site=not args.no_site)                                  # 执行打包（默认同步站点入口）


if __name__ == "__main__":  # 直接运行时
    main()                  # 启动主流程
