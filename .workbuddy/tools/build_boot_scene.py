# -*- coding: utf-8 -*-
"""一次性在 Boot.scene 的 Canvas 下建完整启动页节点树，然后挂 Boot 组件并自动绑定。"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cocos_mcp as mcp

CANVAS = "f3zu+QpHNKV7Krhe5Jwyj3"

# 贴图 spriteFrame 引用（uuid@f9941）
SF_BG = "89d84e1d-48fb-44af-9914-4a82a298906b@f9941"      # Scenes/Boot/loading_bg.jpg
SF_LOGO = "37d4257f-cabc-4f9f-b8ec-9079fbbd5c9a@f9941"    # ui/app_logo.png
SF_BODY4 = "e0f33dbd-6687-43d0-8371-a5d5918ec863@f9941"   # bottle/body_4.png
SF_NINE_BASE = "ade2de50-105d-4a17-8d3a-41c7f6a3ce0f@f9941"
SF_NINE_STROKE = "a72e22e7-24b1-4510-b924-fc97a390952b@f9941"
SF_BAR_FILL = "d1eb37ab-ede1-4b36-8646-fec840115887@f9941"

CREAM = {"r": 247, "g": 232, "b": 203, "a": 255}
BROWN = {"r": 122, "g": 66, "b": 16, "a": 255}
BROWN2 = {"r": 138, "g": 82, "b": 32, "a": 255}
GOLD = {"r": 255, "g": 210, "b": 62, "a": 255}
WHITE = {"r": 255, "g": 255, "b": 255, "a": 255}
SUBC = {"r": 255, "g": 233, "b": 184, "a": 255}


def sprite(sf, w, h, tint=None, sliced=False):
    props = {
        "cc.Sprite.spriteFrame": sf,
        "cc.Sprite.sizeMode": 0,        # CUSTOM
        "cc.Sprite.trim": False,
    }
    if sliced:
        props["cc.Sprite.type"] = 1     # SLICED
    if tint:
        props["cc.Sprite.color"] = tint
    return {
        "components": ["cc.UITransform", "cc.Sprite"],
        "properties": dict(props, **{"cc.UITransform.contentSize": {"width": w, "height": h}}),
    }


def label(text, size, color, outline=None, ow=0):
    comps = ["cc.UITransform", "cc.Label"]
    props = {
        "cc.UITransform.contentSize": {"width": 700, "height": size + 14},
        "cc.Label.string": text,
        "cc.Label.fontSize": size,
        "cc.Label.lineHeight": size + 8,
        "cc.Label.color": color,
        "cc.Label.horizontalAlign": 1,  # CENTER
        "cc.Label.verticalAlign": 1,    # CENTER
    }
    if outline:
        comps.append("cc.LabelOutline")
        props["cc.LabelOutline.color"] = outline
        props["cc.LabelOutline.width"] = ow
    return {"components": comps, "properties": props}


tree = {
    "name": "Bg",
    "position": {"x": 0, "y": 0, "z": 0},
    **sprite(SF_BG, 720, 1728),
    "children": [
        {
            "name": "BootRoot",
            "position": {"x": 0, "y": 0, "z": 0},
            "components": ["cc.UITransform"],
            "properties": {"cc.UITransform.contentSize": {"width": 720, "height": 1280}},
            "children": [
                {
                    "name": "LoadingRoot",
                    "position": {"x": 0, "y": 0, "z": 0},
                    "components": ["cc.UITransform"],
                    "properties": {"cc.UITransform.contentSize": {"width": 720, "height": 1280}},
                    "children": [
                        {
                            "name": "LoadTxt",
                            "position": {"x": 0, "y": -464, "z": 0},
                            **label("正在加载中", 34, WHITE, outline=BROWN2, ow=5),
                        },
                        {
                            "name": "Bar",
                            "position": {"x": 0, "y": -530, "z": 0},
                            "components": ["cc.UITransform"],
                            "properties": {"cc.UITransform.contentSize": {"width": 604, "height": 36}},
                            "children": [
                                {
                                    "name": "Track",
                                    "position": {"x": 0, "y": 0, "z": 0},
                                    **sprite(SF_NINE_BASE, 604, 36, tint=CREAM, sliced=True),
                                },
                                {
                                    "name": "TrackStroke",
                                    "position": {"x": 0, "y": 0, "z": 0},
                                    **sprite(SF_NINE_STROKE, 604, 36, tint=BROWN, sliced=True),
                                },
                                {
                                    "name": "FillBar",
                                    "position": {"x": -302, "y": 0, "z": 0},
                                    "components": ["cc.UITransform", "cc.Sprite"],
                                    "properties": {
                                        "cc.UITransform.contentSize": {"width": 604, "height": 36},
                                        "cc.UITransform.anchorX": 0,
                                        "cc.UITransform.anchorY": 0.5,
                                        "cc.Sprite.spriteFrame": SF_BAR_FILL,
                                        "cc.Sprite.sizeMode": 0,
                                        "cc.Sprite.trim": False,
                                        "cc.Sprite.type": 1,
                                        "cc.Sprite.color": GOLD,
                                    },
                                },
                                {
                                    "name": "BottleRider",
                                    "position": {"x": -290, "y": 14, "z": 0},
                                    **sprite(SF_BODY4, 27, 68),
                                },
                            ],
                        },
                    ],
                },
                {
                    "name": "TitleRoot",
                    "position": {"x": 0, "y": 180, "z": 0},
                    "active": False,
                    "components": ["cc.UITransform"],
                    "properties": {"cc.UITransform.contentSize": {"width": 720, "height": 1280}},
                    "children": [
                        {
                            "name": "Logo",
                            "position": {"x": 0, "y": 120, "z": 0},
                            **sprite(SF_LOGO, 180, 180),
                        },
                        {
                            "name": "Title",
                            "position": {"x": 0, "y": -46, "z": 0},
                            **label("Bottle Flip Inc", 60, WHITE, outline=BROWN, ow=8),
                        },
                        {
                            "name": "SubTxt",
                            "position": {"x": 0, "y": -100, "z": 0},
                            **label("点 瓶 子", 25, SUBC, outline=BROWN2, ow=4),
                        },
                        {
                            "name": "TapTxt",
                            "position": {"x": 0, "y": -196, "z": 0},
                            **label("—— 点击屏幕开始 ——", 32, BROWN),
                        },
                    ],
                },
            ],
        },
    ],
}

r = mcp.call_tool("node_create_tree", {"parent": CANVAS, "spec": tree}, timeout=60)
print("node_create_tree:", json.dumps(r, ensure_ascii=False)[:600])
if r.get("isError"):
    sys.exit(1)

# 挂 Boot 组件并自动绑定（属性名 ↔ 节点名 模糊匹配）
r = mcp.call_tool("component_manage", {"action": "add", "nodeName": "BootRoot", "component": "Boot"}, timeout=30)
print("component add Boot:", json.dumps(r, ensure_ascii=False)[:400])

r = mcp.call_tool("component_auto_bind", {"nodeName": "BootRoot", "componentType": "Boot"}, timeout=30)
print("auto_bind:", json.dumps(r, ensure_ascii=False)[:800])

# 小瓶子转正：body_4 画的是瓶口朝下，转 -90 度横躺（对齐旧 boot/bottle.png）
r = mcp.call_tool("node_find_by_name", {"name": "BottleRider"}, timeout=15)
print("find BottleRider:", json.dumps(r, ensure_ascii=False)[:300])

# 保存场景
r = mcp.call_tool("scene_manage", {"action": "save"}, timeout=30)
print("save:", json.dumps(r, ensure_ascii=False)[:300])
