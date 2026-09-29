# -*- coding: utf-8 -*-
"""
Cocos Creator 编辑器 MCP 客户端（端口 3000，streamable-http + SSE）。

用途：不离开命令行就能读写**正在运行的编辑器**——验证 assets 是否已重新导入、
打开/校验预制体、读取节点真实属性、甚至跑一段编辑器脚本。

用法：
    python .workbuddy/tools/mcp_call.py --list                 # 列出全部工具名
    python .workbuddy/tools/mcp_call.py --schema prefab_edit   # 看某个工具的入参
    python .workbuddy/tools/mcp_call.py prefab_validate '{"prefab":"assets/..."}'
    python .workbuddy/tools/mcp_call.py editor_context '{}'

★ 坑：
  · 必须显式禁用代理（ProxyHandler({})）——沙箱注入的 58048 会让 127.0.0.1 请求 502。
  · 响应是 SSE（`event: message` + `data: {...}`），要拆行解析，不能直接 json.loads 整体。
  · 结果可能是 content[].text 里的 JSON 字符串，本脚本会尽量展开好看。
"""
import json
import os
import sys
import urllib.request

URL = 'http://127.0.0.1:3000/mcp'
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _post(method, params, timeout=90):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode('utf-8')
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    })
    raw = _opener.open(req, timeout=timeout).read().decode('utf-8', 'replace')
    msgs = []
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith('data:'):
            seg = line[5:].strip()
            if seg:
                try:
                    msgs.append(json.loads(seg))
                except Exception:
                    pass
    if not msgs:
        try:
            msgs.append(json.loads(raw))
        except Exception:
            raise RuntimeError('unparsable response: %r' % raw[:400])
    return msgs[-1]


def list_tools():
    r = _post('tools/list', {})
    for t in r.get('result', {}).get('tools', []):
        print(t['name'])


def schema(name):
    r = _post('tools/list', {})
    for t in r.get('result', {}).get('tools', []):
        if t['name'] == name:
            print('### %s' % name)
            print(t.get('description', ''))
            print(json.dumps(t.get('inputSchema', {}), ensure_ascii=False, indent=2))
            return
    print('tool not found: %s' % name)


def call(name, args, timeout=120):
    r = _post('tools/call', {'name': name, 'arguments': args}, timeout=timeout)
    if 'error' in r:
        print('[JSON-RPC ERROR] %s' % json.dumps(r['error'], ensure_ascii=False))
        return None
    res = r.get('result', {})
    if res.get('isError'):
        print('[TOOL ERROR]')
    texts = []
    for c in res.get('content', []):
        if c.get('type') == 'text':
            texts.append(c.get('text', ''))
        else:
            texts.append('[%s]' % c.get('type'))
    blob = '\n'.join(texts)
    try:
        parsed = json.loads(blob)
        print(json.dumps(parsed, ensure_ascii=False, indent=2)[:20000])
        return parsed
    except Exception:
        print(blob[:20000])
        return blob


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return
    if a[0] == '--list':
        list_tools()
        return
    if a[0] == '--schema':
        schema(a[1])
        return
    tool = a[0]
    args = json.loads(a[1]) if len(a) > 1 and a[1].strip() else {}
    call(tool, args)


if __name__ == '__main__':
    main()
