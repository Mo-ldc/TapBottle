#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_serial_probe.py —— 在编辑器进程里用真 cc API 建一棵探针节点树，
再让编辑器的 create-prefab 把它存盘，用来**标定** ScrollView / Mask / Layout /
Graphics / BlockInputEvents / Label / UIOpacity 的真实序列化字段。

产出：assets/_probe.prefab（标定完要删）
为什么不猜字段：手写 JSON 少一个受保护字段（比如 ScrollView 的 _content 或
Group 的 _N$string）编辑器存盘时会补回来，运行时表现就和手写的不一致。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cocos_mcp import call_tool  # noqa: E402

CODE = r"""
const newNode = (nm, w, h) => {
  const n = new cc.Node(nm);
  const u = n.addComponent(cc.UITransform);
  if (w !== undefined) u.setContentSize(w, h);
  return n;
};
const root = newNode('ProbeSV', 600, 800);

// --- ScrollView: root + view(Mask) + content ---
const view = newNode('view', 600, 800); root.addChild(view);
const mk = view.addComponent(cc.Mask); mk.type = cc.Mask.Type.GRAPHICS_RECT;
const content = newNode('content', 600, 100); view.addChild(content);
content.getComponent(cc.UITransform).setAnchorPoint(0.5, 1);
content.setPosition(0, 400, 0);
const sv = root.addComponent(cc.ScrollView);
sv.content = content;
sv.vertical = true; sv.horizontal = false;
sv.inertia = true; sv.brake = 0.72; sv.elastic = true; sv.bounceDuration = 0.2;

// --- BlockInputEvents ---
const mn = newNode('masknode', 100, 100); root.addChild(mn);
mn.addComponent(cc.BlockInputEvents);

// --- Layout ---
const ln = newNode('lay', 200, 200); root.addChild(ln);
const lay = ln.addComponent(cc.Layout);
lay.type = cc.Layout.Type.VERTICAL;
lay.resizeMode = cc.Layout.ResizeMode.CONTAINER;
lay.spacingY = 8; lay.paddingTop = 4;

// --- Graphics ---
const gn = newNode('gfx', 100, 100); root.addChild(gn);
const g = gn.addComponent(cc.Graphics);
g.fillColor = new cc.Color(255, 0, 0, 255);
g.roundRect(-10, -10, 20, 20, 4); g.fill();
g.lineWidth = 3; g.strokeColor = new cc.Color(0, 0, 0, 255);
g.roundRect(-10, -10, 20, 20, 4); g.stroke();

// --- Label（TTF 超采样那一套：盒子*2 + scale0.5 + outline） ---
const ln2 = newNode('lb', 400, 120); root.addChild(ln2);
ln2.setScale(0.5, 0.5, 1);
const lb = ln2.addComponent(cc.Label);
lb.string = 'hi'; lb.fontSize = 80; lb.lineHeight = 100; lb.isBold = true;
lb.enableOutline = true;
lb.outlineColor = new cc.Color(0, 0, 0, 255);
lb.outlineWidth = 6;
lb.overflow = cc.Label.Overflow.SHRINK;
lb.horizontalAlign = cc.Label.HorizontalAlign.LEFT;

// --- UIOpacity ---
const opn = newNode('op', 10, 10); root.addChild(opn);
opn.addComponent(cc.UIOpacity).opacity = 120;

root.parent = cc.director.getScene();
return { uuid: root.uuid, children: root.children.map(c => c.name) };
"""


def main():
    r = call_tool('execute_editor_script', {'code': CODE, 'returnLogs': True})
    print('== build ==')
    print(json.dumps(r, ensure_ascii=False, indent=2)[:2000])
    uuid = None
    try:
        uuid = r['data']['result']['uuid']
    except Exception:
        pass
    if not uuid:
        print('!! no uuid')
        return 1
    # 让编辑器把这个节点抽成 prefab（走的是官方 export path，序列化一定准）
    r2 = call_tool('prefab_create', {'mode': 'simple', 'uuid': uuid,
                                     'path': 'db://assets/_probe.prefab'})
    print('== create-prefab ==')
    print(json.dumps(r2, ensure_ascii=False, indent=2)[:2000])
    return 0


if __name__ == '__main__':
    sys.exit(main())
