# -*- coding: utf-8 -*-
"""backend/server.py：桌宠聊天本地代理（NVIDIA integrate API）。
功能：接收前端 POST /api/chat → 转发 NVIDIA /v1/chat/completions → 返回 {reply, emotion} 原始 JSON。
安全：仅监听 127.0.0.1、Origin 白名单、请求体上限 8KB；API Key 从 assets/api_key.txt 读取。
启动：python server.py [端口]（默认 8765，须与设置页「桌宠配置 · 聊天端口」一致）。"""
import json # JSON 编解码
import os # 路径与文件
import sys # 退出码与参数
import urllib.request # HTTP 客户端
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer # 内置 HTTP 服务

NVIDIA_MODEL = "openai/gpt-oss-20b" # 上游模型 ID（规格指定 ChatGPT OSS-S-20B；若控制台 ID 不同改此常量）
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions" # NVIDIA 默认接口
ALLOWED_ORIGINS = ["http://localhost", "http://127.0.0.1", "null", ""] # Origin 白名单（file:// 请求 Origin 为 null/空）
MAX_BODY = 8192 # 请求体大小上限（字节）
SYS_PROMPT = ( # 系统提示词：约束输出 JSON
    '你是「果冻」，一只住在刮彩票模拟器里的桌宠。'
    '请始终只输出一行 JSON：{"reply":"<口语化中文回复，40字以内>","emotion":"happy|sad|excited|neutral|angry|shy"}，不要输出任何其他文字。'
) # 结束提示词

def read_api_key(): # 从素材文件夹读取 API Key 文本
    here = os.path.dirname(os.path.abspath(__file__)) # server.py 所在目录（backend/）
    candidates = [ # 候选路径（依次尝试）
        os.path.join(here, "..", "assets", "api_key.txt"), # 多文件版：<根>/assets/api_key.txt
        os.path.join(here, "..", "..", "assets", "api_key.txt"), # 兜底：再上一层
        os.path.join(here, "api_key.txt"), # backend 同目录
    ] # 结束候选
    for p in candidates: # 逐个尝试
        try: # 读文件可能失败
            if os.path.exists(p): # 存在才读
                key = open(p, encoding="utf-8").read().strip() # 读并去空白
                if key: # 非空
                    print("[OK] 已加载 API Key：", os.path.normpath(p), "（%d 字符）" % len(key)) # 提示（不打印内容）
                    return key # 返回
        except OSError: # 读失败
            continue # 尝试下一个
    print("[FATAL] 未找到 assets/api_key.txt，请把 NVIDIA API Key 保存到素材文件夹的文本文档中") # 明确报错
    sys.exit(1) # 退出

API_KEY = read_api_key() # 启动即读密钥

class Handler(BaseHTTPRequestHandler): # 请求处理器
    def _cors(self): # 统一响应头
        self.send_header("Access-Control-Allow-Origin", "*") # 允许本地页面跨域（服务本身只监听 127.0.0.1，风险可控）
        self.send_header("Access-Control-Allow-Headers", "Content-Type") # 允许的请求头
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS") # 允许的方法
    def do_OPTIONS(self): # 预检
        self.send_response(204); self._cors(); self.end_headers() # 空响应
    def do_POST(self): # 主接口
        if self.path != "/api/chat": # 路径校验
            self.send_response(404); self._cors(); self.end_headers(); return # 非目标路径
        origin = self.headers.get("Origin", "") # 取 Origin
        if origin not in ALLOWED_ORIGINS: # 白名单校验
            self.send_response(403); self._cors(); self.end_headers(); return # 拒绝外域
        try: # 读请求体
            n = int(self.headers.get("Content-Length", "0")) # 长度
            if n <= 0 or n > MAX_BODY: # 超限
                self.send_response(413); self._cors(); self.end_headers(); return # 拒绝
            body = json.loads(self.rfile.read(n).decode("utf-8")) # 解析 JSON
            msg = str(body.get("message", ""))[:500] # 取消息并截断
            if not msg: # 空消息
                self.send_response(400); self._cors(); self.end_headers(); return # 拒绝
        except Exception: # 解析失败
            self.send_response(400); self._cors(); self.end_headers(); return # 拒绝
        payload = { # 上游请求体（OpenAI 兼容格式）
            "model": NVIDIA_MODEL, # 模型 ID
            "messages": [ {"role": "system", "content": SYS_PROMPT}, {"role": "user", "content": msg} ], # 系统提示 + 用户消息
            "temperature": 0.8, # 适度发散
            "max_tokens": 200, # 回复上限
            "stream": False # 非流式
        } # 结束请求体
        req = urllib.request.Request( # 构造上游请求
            NVIDIA_URL, # 接口地址
            data=json.dumps(payload).encode("utf-8"), # 序列化
            headers={ "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY, "Accept": "application/json" }, # 带密钥
            method="POST" # POST
        ) # 结束构造
        try: # 上游调用可能失败
            with urllib.request.urlopen(req, timeout=15) as resp: # 15 秒上游超时
                data = json.loads(resp.read().decode("utf-8")) # 解析上游
            content = data["choices"][0]["message"]["content"] # 取模型输出
            try: # 模型输出应为 JSON
                j = json.loads(content) # 解析
                reply = str(j.get("reply", content))[:500] # 取回复
                emo = str(j.get("emotion", "neutral")) # 取情绪
                out = {"reply": json.dumps({"reply": reply, "emotion": emo}, ensure_ascii=False)} # 双层包装：前端 JSON.parse(reply) 得 {reply,emotion}
            except Exception: # 输出非 JSON：降级
                out = {"reply": json.dumps({"reply": str(content)[:300], "emotion": "neutral"}, ensure_ascii=False)} # 原样回 + neutral
            code = 200 # 成功码
        except Exception as e: # 网络/密钥/模型错误
            out = {"error": str(e)} # 错误信息
            code = 502 # 上游错误码
        data = json.dumps(out, ensure_ascii=False).encode("utf-8") # 响应序列化
        self.send_response(code) # 状态码
        self._cors() # 跨域头
        self.send_header("Content-Type", "application/json; charset=utf-8") # JSON 头
        self.send_header("Content-Length", str(len(data))) # 长度
        self.end_headers() # 头结束
        self.wfile.write(data) # 写响应体
    def log_message(self, fmt, *args): # 日志精简
        print("[req]", self.address_string(), fmt % args) # 一行一条

def main(): # 启动入口
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765 # 端口：参数优先，默认 8765
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler) # 仅监听本地回环
    print("[OK] 桌宠聊天代理已启动：http://127.0.0.1:%d/api/chat （Ctrl+C 停止）" % port) # 提示
    print("     模型：", NVIDIA_MODEL, "· 请保持该端口与设置页「桌宠配置」一致") # 提示
    try: srv.serve_forever() # 常驻
    except KeyboardInterrupt: print("\n[BYE] 代理已停止") # 优雅退出

if __name__ == "__main__": # 入口
    main() # 启动
