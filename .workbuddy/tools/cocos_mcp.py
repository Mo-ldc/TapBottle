#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cocos_mcp.py —— cocos-creator-mcp 的最小命令行客户端

用途：在 shell 里直接调编辑器 MCP（不用把 MCP 挂进客户端也能用）。
依赖：只用 Python 标准库（本机无 curl，urllib 更稳）。

用法：
  <py> .workbuddy/tools/cocos_mcp.py health
  <py> .workbuddy/tools/cocos_mcp.py tools [关键字]
  <py> .workbuddy/tools/cocos_mcp.py call <tool> '<json参数>'      # 例: call scene_query {"action":"dirty"}
  <py> .workbuddy/tools/cocos_mcp.py res <uri>                     # 例: res cocos://project/info
  <py> .workbuddy/tools/cocos_mcp.py raw '<完整 jsonrpc 报文>'

退出码：0 成功；2 服务不可达；3 工具返回 isError
环境变量：COCOS_MCP_URL（默认 http://127.0.0.1:3000/mcp）
"""
import json
import os
import sys
import urllib.error
import urllib.request

URL = os.environ.get("COCOS_MCP_URL", "http://127.0.0.1:3000/mcp")


def _post(body, timeout=60):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(URL, data=data, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", "replace")
    # 服务端用 SSE 包装：取最后一条 data:
    payloads = [l[6:] for l in raw.splitlines() if l.startswith("data: ")]
    if payloads:
        return json.loads(payloads[-1])
    return json.loads(raw) if raw.strip() else {}


def rpc(method, params=None, rid=1, timeout=60):
    body = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        body["params"] = params
    return _post(body, timeout)


def health():
    base = URL.rsplit("/mcp", 1)[0]
    try:
        with urllib.request.urlopen(base + "/health", timeout=4) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


def call_tool(name, args, timeout=120):
    r = rpc("tools/call", {"name": name, "arguments": args or {}}, timeout=timeout)
    if "error" in r:
        return {"isError": True, "raw": r["error"]}
    res = r.get("result", {})
    texts = []
    for c in res.get("content", []) or []:
        if c.get("type") == "text":
            texts.append(c.get("text", ""))
    out = {"isError": bool(res.get("isError"))}
    joined = "\n".join(texts)
    try:
        out["data"] = json.loads(joined)
    except Exception:
        out["text"] = joined
    return out


def read_resource(uri, timeout=30):
    r = rpc("resources/read", {"uri": uri}, timeout=timeout)
    if "error" in r:
        return {"isError": True, "raw": r["error"]}
    res = r.get("result", {})
    texts = []
    for c in res.get("contents", []) or []:
        if c.get("text"):
            texts.append(c["text"])
    joined = "\n".join(texts)
    try:
        return {"data": json.loads(joined)}
    except Exception:
        return {"text": joined}


def _dump(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 0
    cmd = argv[1]

    if cmd == "health":
        h = health()
        _dump(h)
        return 0 if h.get("status") == "ok" else 2

    if cmd == "tools":
        try:
            r = rpc("tools/list")
        except Exception as e:
            _dump({"status": "unreachable", "error": str(e)})
            return 2
        tools = r.get("result", {}).get("tools", [])
        kw = argv[2].lower() if len(argv) > 2 else None
        for t in tools:
            if kw and kw not in t["name"].lower() and kw not in (t.get("description") or "").lower():
                continue
            print(t["name"])
        return 0

    if cmd == "schema":
        # 打印工具的参数 schema（tools/list 里拿），便于不开 MCP 客户端也能查参数
        try:
            r = rpc("tools/list")
        except Exception as e:
            _dump({"status": "unreachable", "error": str(e)})
            return 2
        tools = r.get("result", {}).get("tools", [])
        want = [a.lower() for a in argv[2:]]
        for t in tools:
            if want and not any(w in t["name"].lower() for w in want):
                continue
            _dump({"name": t["name"], "description": t.get("description"),
                   "inputSchema": t.get("inputSchema")})
        return 0

    if cmd == "call":
        if len(argv) < 3:
            print("需要工具名", file=sys.stderr)
            return 2
        args = {}
        if len(argv) > 3:
            args = json.loads(argv[3])
        try:
            out = call_tool(argv[2], args)
        except urllib.error.URLError as e:
            _dump({"status": "unreachable", "error": str(e)})
            return 2
        except Exception as e:
            _dump({"status": "error", "error": str(e)})
            return 2
        _dump(out)
        return 3 if out.get("isError") else 0

    if cmd == "res":
        out = read_resource(argv[2])
        _dump(out)
        return 3 if out.get("isError") else 0

    if cmd == "raw":
        _dump(_post(json.loads(argv[2])))
        return 0

    print("未知命令: %s" % cmd, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
