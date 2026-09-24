# -*- coding: utf-8 -*-
"""v2：打开磁盘上的 Boot.scene（有效空场景），建树 + 挂 Boot 组件 + 自动绑定 + Widget 内置适配 + 保存。"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cocos_mcp as mcp


def call(tool, args, timeout=60):
    r = mcp.call_tool(tool, args, timeout=timeout)
    txt = json.dumps(r, ensure_ascii=False)
    print("## %s -> %s" % (tool, txt[:220]))
    return r


# 1) 打开磁盘上的 Boot.scene（当前可能无场景——close 会掐断 MCP 连接，先探测再决定）
r = mcp.read_resource("cocos://scene/current")
cur = (r.get("data") or {})
if cur.get("name"):
    try:
        call("scene_manage", {"action": "close", "force": True})
    except Exception as e:
        print("close 场景连接重置（预期内）：", str(e)[:80])
r = call("scene_manage", {"action": "open", "scene": "db://assets/Scenes/Boot.scene", "force": True})
r = call("scene_manage", {"action": "hierarchy"})
data = (r.get("data") or {})
print("当前场景：", data.get("sceneName"))
hier = data.get("hierarchy") or []
canvas = None
for n in hier:
    if n.get("name") == "Canvas":
        canvas = n.get("uuid")
print("Canvas:", canvas)
if not canvas:
    sys.exit("没有 Canvas，放弃")

# 2) 建 UI 树（与 v1 相同的 spec，由外部文件注入避免重复）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_boot_scene import tree  # noqa: E402

r = call("node_create_tree", {"parent": canvas, "spec": tree})
if r.get("isError"):
    sys.exit("建树失败")

# 收集所有节点名 -> uuid
created = {}
def walk(n):
    created[n.get("name")] = n.get("uuid")
    for c in n.get("children") or []:
        walk(c)
walk((r.get("data") or {}).get("data") or {})
for k in ("BootRoot", "BottleRider", "Bg", "Bar", "LoadTxt", "TitleRoot", "LoadingRoot"):
    print("  节点 %-12s %s" % (k, created.get(k)))

boot_root = created.get("BootRoot")
if not boot_root:
    sys.exit("BootRoot 未创建")

# 3) 挂 Boot 组件 + 自动绑定
call("component_manage", {"action": "add", "uuid": boot_root, "componentType": "Boot"})
call("component_auto_bind", {"uuid": boot_root, "componentType": "Boot"})

# 4) Widget 内置适配：任何比例自动对齐（背景四边拉伸、加载区钉底、标题区垂直居中）
if created.get("Bg"):
    call("node_set_layout", {"uuid": created["Bg"], "widget": {"top": 0, "bottom": 0, "left": 0, "right": 0}})
if created.get("Bar"):
    call("node_set_layout", {"uuid": created["Bar"], "widget": {"bottom": 134, "horizontalCenter": 0}})
if created.get("LoadTxt"):
    call("node_set_layout", {"uuid": created["LoadTxt"], "widget": {"bottom": 190, "horizontalCenter": 0}})
if created.get("TitleRoot"):
    call("node_set_layout", {"uuid": created["TitleRoot"], "widget": {"verticalCenter": 0, "horizontalCenter": 0}})

# 5) 小瓶子横躺（body_4 画的是瓶口朝下，转 -90° 对齐旧 boot/bottle.png）
if created.get("BottleRider"):
    call("node_set_property", {"uuid": created["BottleRider"], "property": "rotation", "value": {"x": 0, "y": 0, "z": -90}})

# 6) 保存
call("scene_manage", {"action": "save"})
r = call("scene_manage", {"action": "current"})
print("FINAL:", json.dumps(r.get("data"), ensure_ascii=False)[:200])
