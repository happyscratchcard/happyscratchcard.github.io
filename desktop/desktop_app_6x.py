# -*- coding: utf-8 -*-
"""
刮彩票模拟器 6.1 Beta · 桌面外壳（Python + pywebview + WebView2）
====================================================================
职责：为 6.1 页面提供原生桥接。
  1) 桌面壁纸读取（液态玻璃 P4 已验收视觉，原样保留）；
  2) 实时透视桌面（6.1 新增「光学近似」，airpeg 同款思路）：
     · SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) 让本窗口从一切屏幕捕获中排除；
     · GDI BitBlt 抓取本窗口客户区对应的屏幕区域（即窗口背后的实时画面）；
     · JPEG 压缩后经桥接喂给页面 #liveBg 画布（≈15fps），实现背景实时跟随；
     · 说明：pywebview 在 Windows 上不支持 transparent 真透明窗口（官方文档明确），
       故采用「捕获排除 + 实时抓帧」的独立 Windows 光学近似实现，并非系统级透明。

已知限制（P5 优化仍待正式稳定性验收）：
  · Windows 11 / 高 DPI / 多显示器 / HDR / 远程桌面 / 显示设备重置等环境未全部实测通过；
  · 拖动或缩放本窗口时，背景帧存在一拍以内的延迟（15fps 固有）；
  · WDA_EXCLUDEFROMCAPTURE 需要 Windows 10 2004+（较老系统自动回退壁纸层模式）；
  · 透视帧中不含本窗口自身（设计如此），但会包含本窗口正后方的一切其他窗口。

打包方式（两种二选一）：
  1) 单文件版 exe：
     pyinstaller --onefile --windowed --icon=app-icon.ico \
       --add-data "刮彩票模拟器_Beta_单文件版.html;." desktop_app_6x.py
  2) 多文件版 exe（整目录内嵌，保留 css/js/vendor 结构）：
     pyinstaller --onefile --windowed --icon=app-icon.ico \
       --add-data "app;app" desktop_app_6x.py
exe 启动时优先加载同目录页面文件（改 HTML 无需重打包），否则用内嵌资源。
"""

import base64           # 壁纸/抓帧图片转 base64 dataURL，喂给 HTML
import ctypes           # Win32 API 调用（显示排除 + GDI 抓屏）
import ctypes.wintypes as wt  # Win32 基础类型（RECT/POINT 等）
import os               # 路径拼接、文件信息（mtime/size）
import sys              # 判断打包后的资源目录（_MEIPASS）
import threading        # 锁：防止多个 JS 轮询同时触发重复编码
import winreg           # 读注册表：当前桌面壁纸的文件路径

import webview          # pywebview：用系统自带 WebView2 渲染 HTML 的轻量外壳

try:                    # DPI 感知：保证 GetClientRect/BitBlt 用物理像素，高 DPI 下不模糊
    ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PER_MONITOR_DPI_AWARE
except Exception:       # 老 Windows 没有 shcore
    try:
        ctypes.windll.user32.SetProcessDPIAware()   # 兜底：系统级 DPI 感知
    except Exception:
        pass                # 彻底失败则按 DIP 抓帧（可能偏小，不致命）

# 页面查找顺序：单文件版优先，其次多文件版 app/index.html
PAGE_CANDIDATES = [     # 相对页面路径候选（按优先级）
    "彩票模拟器_单文件版.html",          # 仓库标准产物名（tools/pack_single.py 的默认输出）
    "刮彩票模拟器_Beta_单文件版.html",   # 历史文件名（兼容旧交付包，保留不动）
    os.path.join("app", "index.html"),  # 多文件版主页面
]

HTTP_PORT = 58996       # 6.1 固定本地服务端口：页面 origin 稳定，localStorage 存档不再因随机端口漂移

SRCCOPY = 0x00CC0020    # GDI BitBlt 光栅操作码：原样拷贝
WDA_EXCLUDE = 0x00000011  # SetWindowDisplayAffinity：从屏幕捕获中排除本窗口（Win10 2004+）

_user32 = ctypes.windll.user32  # user32 句柄
_gdi32 = ctypes.windll.gdi32    # gdi32 句柄


# ---------------------------------------------------------------
# 壁纸读取（P4 液态玻璃 · 已验收，保留）
# ---------------------------------------------------------------

_WALLPAPER_LOCK = threading.Lock()      # 全局锁：同一时刻只做一次壁纸编码
_WALLPAPER_CACHE = {"stamp": None, "dataUrl": None}  # 缓存：上次编码结果，壁纸没换就直接复用


def _candidate_wallpaper_paths():
    """生成可能的壁纸文件路径候选列表（按优先级依次尝试）。"""
    candidates = []                     # 候选列表
    try:
        key = winreg.OpenKey(           # 打开注册表项
            winreg.HKEY_CURRENT_USER,   # 当前用户配置
            r"Control Panel\Desktop",   # 桌面设置所在键
        )
        value, _ = winreg.QueryValueEx(key, "WallPaper")  # 读壁纸路径（系统设置里换壁纸会实时更新）
        winreg.CloseKey(key)            # 及时关闭句柄
        if value:                       # 注册表里有值才加入候选
            candidates.append(value)    # 例如 C:\Users\果果\Pictures\xxx.jpg
    except OSError:                     # 读不到注册表（极少见）不致命
        pass                            # 静默跳过
    appdata = os.environ.get("APPDATA", "")  # 兜底路径：系统转码后的当前壁纸
    if appdata:                         # 有 APPDATA 才拼
        candidates.append(os.path.join(appdata, "Microsoft", "Windows", "Themes", "TranscodedWallpaper"))  # Windows 会把当前壁纸转码存这里
    return candidates                   # 返回候选列表


def _file_stamp(path):
    """计算文件的"指纹"（修改时间 + 大小），用于判断壁纸是否被更换。"""
    try:
        st = os.stat(path)              # 取文件状态
        return "%d-%d" % (st.st_mtime_ns, st.st_size)  # 纳秒级 mtime + 大小，足够灵敏
    except OSError:                     # 文件可能刚好被换掉
        return None                     # 返回空指纹


def _to_data_url(path):
    """把壁纸文件读出来并编码成 data:image/...;base64 字符串。"""
    with open(path, "rb") as f:         # 二进制读
        raw = f.read()                  # 全量读取（壁纸一般几 MB，可接受）
    if raw[:3] == b"\xff\xd8\xff":      # JPEG 魔数
        mime = "image/jpeg"             # MIME 设为 jpeg
    elif raw[:8] == b"\x89PNG\r\n\x1a\n":  # PNG 魔数
        mime = "image/png"              # MIME 设为 png
    elif raw[:4] in (b"II*\x00", b"MM\x00*"):  # TIFF 魔数（少数壁纸）
        mime = "image/tiff"             # MIME 设为 tiff（WebView2 能显示）
    elif raw[:6] in (b"GIF87a", b"GIF89a"):    # GIF 魔数
        mime = "image/gif"              # MIME 设为 gif
    else:                               # 未知格式（如 BMP 变体）
        mime = "image/bmp"              # 按 BMP 兜底
    b64 = base64.b64encode(raw).decode("ascii")  # base64 编码为 ASCII
    return "data:%s;base64,%s" % (mime, b64)     # 拼成标准 dataURL


def get_wallpaper(since=None):
    """供 JS 调用的桥接方法：返回 {dataUrl, stamp}；若 JS 传来的指纹与当前壁纸一致，只回指纹不回图片。"""
    with _WALLPAPER_LOCK:               # 串行化，避免并发重复编码大图
        for path in _candidate_wallpaper_paths():      # 依次尝试候选路径
            stamp = _file_stamp(path)   # 取当前文件指纹
            if stamp is None:           # 路径不存在（如注册表指向已删除的图）
                continue                # 试下一个候选
            if since and str(since) == stamp and _WALLPAPER_CACHE["dataUrl"]:  # JS 已有这张图
                return {"stamp": stamp}  # 只回指纹：省掉每 2 秒几 MB 的 base64 传输
            if stamp == _WALLPAPER_CACHE["stamp"] and _WALLPAPER_CACHE["dataUrl"]:  # 指纹没变
                return {"dataUrl": _WALLPAPER_CACHE["dataUrl"], "stamp": stamp}  # 直接复用缓存（秒回）
            try:
                data_url = _to_data_url(path)          # 真正读取并编码
            except OSError:             # 读文件失败（被占用等）
                continue                # 试下一个候选
            _WALLPAPER_CACHE["stamp"] = stamp          # 更新缓存指纹
            _WALLPAPER_CACHE["dataUrl"] = data_url     # 更新缓存内容
            return {"dataUrl": data_url, "stamp": stamp}  # 交给 JS
        return {"error": "no-wallpaper"}               # 所有候选都失败：告诉 JS 没壁纸


# ---------------------------------------------------------------
# 实时透视桌面（6.1 光学近似：捕获排除 + GDI 抓帧）
# ---------------------------------------------------------------

_LIVE_LOCK = threading.Lock()           # 抓帧串行锁（GDI 位图资源不能并发混用）
_LIVE_MAX_W = 1600                      # 帧宽上限：超高分辨率屏下先降采样再编码，控制体积


class _BITMAPINFOHEADER(ctypes.Structure):  # BITMAPINFOHEADER 结构（GetDIBits 需要）
    _fields_ = [                        # 字段表（与 win32 定义逐一对齐）
        ("biSize", wt.DWORD),           # 结构大小
        ("biWidth", ctypes.c_long),     # 位图宽
        ("biHeight", ctypes.c_long),    # 位图高（负数 = 自顶向下行序）
        ("biPlanes", wt.WORD),          # 固定 1
        ("biBitCount", wt.WORD),        # 每像素位数（32 = BGRA）
        ("biCompression", wt.DWORD),    # 压缩方式（0 = BI_RGB）
        ("biSizeImage", wt.DWORD),      # 图像字节数
        ("biXPelsPerMeter", ctypes.c_long),  # 水平分辨率（0 即可）
        ("biYPelsPerMeter", ctypes.c_long),  # 垂直分辨率（0 即可）
        ("biClrUsed", wt.DWORD),        # 调色板使用数（0）
        ("biClrImportant", wt.DWORD),   # 重要调色板数（0）
    ]                                   # 结束字段表


def _find_hwnd(window):
    """定位本窗口的 HWND：优先 pywebview 原生窗体句柄，失败则按标题 FindWindow 兜底。"""
    try:                                # pythonnet 句柄提取
        return int(window.native.Handle.ToInt64())   # WinForms 窗体句柄（IntPtr → int64）
    except Exception:                   # 属性缺失或类型不符
        pass                            # 走兜底
    try:                                # 按标题兜底（外壳标题与 create_window 一致）
        return _user32.FindWindowW(None, "刮彩票模拟器 6.1 Beta")  # 返回 HWND 或 0
    except Exception:                   # API 失败
        return 0                        # 返回 0 = 未找到


def _enable_capture_exclude(window):
    """把本窗口从一切屏幕捕获中排除（WDA_EXCLUDEFROMCAPTURE）。成功返回 True。"""
    hwnd = _find_hwnd(window)           # 找句柄
    if not hwnd:                        # 没找到
        return False                    # 失败
    try:                                # API 可能因系统过老而失败
        return bool(_user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDE))  # 设置捕获排除
    except Exception:                   # Win10 2004 之前无此 API
        return False                    # 失败 → 页面自动回退壁纸层


def _client_rect_screen(hwnd):
    """取窗口客户区的屏幕坐标与物理像素尺寸：(x, y, w, h)。"""
    rect = wt.RECT()                    # 客户区矩形（相对窗口）
    _user32.GetClientRect(hwnd, ctypes.byref(rect))  # 读客户区
    pt = wt.POINT(0, 0)                 # 客户区左上角（窗口坐标）
    _user32.ClientToScreen(hwnd, ctypes.byref(pt))   # 换算成屏幕坐标
    return pt.x, pt.y, rect.right - rect.left, rect.bottom - rect.top  # (x, y, w, h)


def _grab_screen(x, y, w, h):
    """GDI 抓取屏幕区域 (x, y, w, h)，返回 PIL Image（RGB）。失败返回 None。"""
    try:                                # GDI 全链路任何一步失败都不致命
        from PIL import Image           # 延迟导入 Pillow（编码用）
        hdc_screen = _user32.GetDC(None)             # 整屏 DC（虚拟桌面坐标系）
        hdc_mem = _gdi32.CreateCompatibleDC(hdc_screen)  # 兼容内存 DC
        hbm = _gdi32.CreateCompatibleBitmap(hdc_screen, w, h)  # 目标位图
        _gdi32.SelectObject(hdc_mem, hbm)            # 挂载位图
        _gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, x, y, SRCCOPY)  # 拷贝屏幕区域（本窗口已被捕获排除）
        bi = _BITMAPINFOHEADER()                     # 位图信息头
        bi.biSize = ctypes.sizeof(_BITMAPINFOHEADER) # 结构大小
        bi.biWidth = w                               # 宽
        bi.biHeight = -h                             # 负高 = 自顶向下
        bi.biPlanes = 1                              # 固定 1
        bi.biBitCount = 32                           # 32bpp BGRA
        bi.biCompression = 0                         # BI_RGB
        buf = ctypes.create_string_buffer(w * h * 4) # 像素缓冲
        _gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(bi), 0)  # 读出像素
        img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1).convert("RGB")  # BGRA → RGB
        _gdi32.DeleteObject(hbm)                     # 释放位图
        _gdi32.DeleteDC(hdc_mem)                     # 释放内存 DC
        _user32.ReleaseDC(None, hdc_screen)          # 释放屏幕 DC
        return img                     # 返回图像
    except Exception:                   # 任一步失败
        return None                     # 返回 None 让页面跳帧


def get_live_frame():
    """供 JS 调用的桥接方法：抓取本窗口背后的实时屏幕画面，返回 {dataUrl, w, h} 或 {error}。"""
    window = webview.windows[0] if webview.windows else None  # 主窗口
    hwnd = _find_hwnd(window) if window else 0               # 窗口句柄
    if not hwnd:                        # 句柄不可用（极少见）
        return {"error": "no-hwnd"}     # 告知 JS 无帧
    x, y, w, h = _client_rect_screen(hwnd)  # 客户区屏幕矩形
    if w <= 0 or h <= 0:                # 尺寸异常（最小化等）
        return {"error": "bad-size"}    # 无帧
    with _LIVE_LOCK:                    # 串行化抓帧
        img = _grab_screen(x, y, w, h)  # 抓屏
    if img is None:                     # 抓屏失败
        return {"error": "grab-failed"} # 告知 JS
    if img.width > _LIVE_MAX_W:         # 超宽降采样
        ratio = _LIVE_MAX_W / img.width # 缩放比
        img = img.resize((_LIVE_MAX_W, max(1, int(img.height * ratio))))  # 等比缩
    import io as _io                    # 字节流
    bio = _io.BytesIO()                 # 内存流
    img.save(bio, "JPEG", quality=72, optimize=True)  # JPEG 压缩（体积与清晰度平衡）
    b64 = base64.b64encode(bio.getvalue()).decode("ascii")  # base64 编码
    return {"dataUrl": "data:image/jpeg;base64," + b64, "w": img.width, "h": img.height}  # 帧数据


class Bridge:
    """暴露给 JS 的桥接类：页面里 window.pywebview.api.* 即调到这里。"""

    def get_wallpaper(self, since=None):  # 液态玻璃壁纸桥（P4 保留）
        return get_wallpaper(since)       # 直接转发

    def is_transparent(self):             # 兼容旧探测协议：本外壳非真透明窗口
        return False                      # 如实返回 False（页面会走光学近似或壁纸层）

    def get_live_frame(self):             # 6.1 实时透视桌面：抓一帧窗口背后画面
        return get_live_frame()           # 直接转发

    def quit_app(self):                   # 6.2 十七轮：JS 叉号「退出程序」：销毁全部窗口并立即退出
        try:                              # webview 模块一定已导入，兜底防意外
            import webview                # 取窗口句柄
            for w in list(webview.windows):  # 逐个窗口
                try: w.destroy()          # 销毁（触发事件循环退出）
                except Exception: pass    # 单个失败不阻断
        except Exception: pass            # 全部失败也继续
        os._exit(0)                       # 强制退出进程（立即，不等清理）


# ---------------------------------------------------------------
# 启动窗口
# ---------------------------------------------------------------

def _search_dirs():
    """生成页面查找目录列表：exe/脚本同目录优先（便于改页面不重打包），其次 _MEIPASS 内嵌资源。"""
    dirs = []                           # 目录候选
    if getattr(sys, "frozen", False):   # PyInstaller 打包后运行
        dirs.append(os.path.dirname(sys.executable))   # exe 所在目录（用户可把页面放这里覆盖）
        dirs.append(getattr(sys, "_MEIPASS", ""))      # 打包时内嵌的资源目录
    else:                               # 源码运行
        dirs.append(os.path.dirname(os.path.abspath(__file__)))  # 脚本所在目录
    return [d for d in dirs if d]       # 去掉空项


def _find_page():
    """按候选顺序查找页面文件，返回完整路径；都找不到则报错退出。"""
    for d in _search_dirs():            # 逐目录
        for rel in PAGE_CANDIDATES:     # 逐候选页面
            p = os.path.join(d, rel)    # 拼完整路径
            if os.path.isfile(p):       # 命中
                return p                # 返回
    raise SystemExit("找不到页面文件（刮彩票模拟器_Beta_单文件版.html 或 app/index.html）")  # 全部落空


def _on_shown(window):
    """窗口显示完成后：开启捕获排除（实时透视的前提）。"""
    ok = _enable_capture_exclude(window)             # 排除本窗口出屏
    print("[shell] capture-exclude:", "on" if ok else "unavailable")  # 日志（重定向时可见）


def main():
    """创建窗口并进入事件循环（阻塞直到窗口关闭）。"""
    html_path = _find_page()            # 定位页面
    window = webview.create_window(     # 创建主窗口
        title="刮彩票模拟器 6.1 Beta",   # 标题栏文字
        url=html_path,                  # 加载本地 HTML（pywebview 经内置 HTTP 服务，端口固定）
        js_api=Bridge(),                # 注入桥接：JS 侧 window.pywebview.api
        width=1180,                     # 默认宽度（适配一屏网格布局）
        height=850,                     # 默认高度
        min_size=(960, 640),            # 最小尺寸，避免布局挤压
        background_color="#FFFFFF",     # WebView 尚未渲染时的底色（与页面白系一致）
        http_port=HTTP_PORT,            # 6.1 固定端口：localStorage 存档跨启动稳定
    )
    window.events.shown += lambda: _on_shown(window)  # 显示后开启捕获排除
    webview.start(debug=False)          # 启动事件循环（debug=True 会开 DevTools）


if __name__ == "__main__":              # 直接运行本文件才启动窗口
    main()                              # 进入主循环
