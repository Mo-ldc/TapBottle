# -*- coding: utf-8 -*-
"""底栏加「列表展开/收起」按钮（bd16），并把现有四件缩窄腾位。

底栏五件等距（总 706，间隙 8）：W = [138, 138, 154, 188, 56]
  x: 商店 -284 / 升级 -138 / 技能树 16 / 下拉框 195 / 展开按钮 325（右缘 353 贴齐）

- tab_shop/tab_up/tab_tree/dropdown：节点 x + UITransform 宽 + 子件（icon/label/
  tabNew/ddLb/chev/newTag）位置宽度全部同步（底板是 SLICED Sprite，改尺寸即拉伸）。
- 新增 expandBtn：整图 btn_arrow_up（bd16），挂在 bottomPanel 末尾（z 最高，
  不会被展开的面板盖住），y = -370（收起态 = 面板顶边上方 30）。
- 面板收起态布局不动（展开态由 BottomPanel.applyExpand() 运行时调整）。
"""
import json, shutil, uuid, io, os

SCENE = "assets/scenes/Game.scene"
BAK = ".workbuddy/scene_bak/Game.scene.bak_expand"
ARROW_SF = '4a90d3c3-25aa-428c-9cd5-21a7fa492a9d@f9941'  # skin/main/btn_arrow_up (bd16)

# name -> (new_x, new_w, {child: (new_x, new_w)})
BAR = {
    'tab_shop': (-284, 138, {'icon': (-35, None), 'label': (None, 106), 'tabNew': (49, None)}),
    'tab_up':   (-138, 138, {'icon': (-35, None), 'label': (None, 106), 'tabNew': (49, None)}),
    'tab_tree': (16,   154, {'icon': (-43, None), 'label': (None, 130), 'tabNew': (57, None)}),
    'dropdown': (195,  188, {'ddLb': (None, 112), 'chev': (68, None), 'newTag': (78, None)}),
}

def main():
    raw = io.open(SCENE, encoding='utf-8').read()
    d = json.loads(raw)
    os.makedirs(os.path.dirname(BAK), exist_ok=True)
    if not os.path.exists(BAK):
        shutil.copyfile(SCENE, BAK)

    def kid(i, name):
        for c in d[i].get('_children', []):
            if d[c['__id__']].get('_name') == name:
                return c['__id__']
        return None

    def find(i, name):
        if d[i].get('__type__') == 'cc.Node' and d[i].get('_name') == name:
            return i
        for c in d[i].get('_children', []):
            r = find(c['__id__'], name)
            if r is not None:
                return r
        return None

    def ut_idx(i):
        for c in d[i].get('_components', []):
            if d[c['__id__']].get('__type__') == 'cc.UITransform':
                return c['__id__']
        return None

    bp = find(1, 'bottomPanel')
    assert bp is not None, 'bottomPanel not found'

    for name, (nx, nw, kids) in BAR.items():
        ni = kid(bp, name)
        assert ni is not None, name + ' not found'
        n = d[ni]
        n['_lpos']['x'] = nx
        u = d[ut_idx(ni)]
        u['_contentSize']['width'] = nw
        for cn, (cx, cw) in kids.items():
            ci = kid(ni, cn)
            if ci is None:
                continue
            if cx is not None:
                d[ci]['_lpos']['x'] = cx
            if cw is not None:
                cu = d[ut_idx(ci)]
                cu['_contentSize']['width'] = cw
        print('resized', name, nx, nw)

    # ---- 新增 expandBtn（幂等）----
    if kid(bp, 'expandBtn') is not None:
        print('expandBtn already exists, skip')
    else:
        node_idx = len(d)
        ut_idx_, sp_idx = node_idx + 1, node_idx + 2
        d.append({  # node
            '__type__': 'cc.Node', '_name': 'expandBtn', '_objFlags': 0, '__editorExtras__': {},
            '_parent': {'__id__': bp}, '_children': [], '_active': True,
            '_components': [{'__id__': ut_idx_}, {'__id__': sp_idx}], '_prefab': None,
            '_lpos': {'__type__': 'cc.Vec3', 'x': 325, 'y': -370, 'z': 0},
            '_lrot': {'__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0, 'w': 1},
            '_lscale': {'__type__': 'cc.Vec3', 'x': 1, 'y': 1, 'z': 1},
            '_mobility': 0, '_layer': 33554432,
            '_euler': {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0},
            '_id': str(uuid.uuid4()),
        })
        d.append({  # UITransform
            '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': {'__id__': node_idx}, '_enabled': True, '__prefab': None,
            '_contentSize': {'__type__': 'cc.Size', 'width': 56, 'height': 52},
            '_anchorPoint': {'__type__': 'cc.Vec2', 'x': 0.5, 'y': 0.5},
            '_id': str(uuid.uuid4()),
        })
        d.append({  # Sprite（整图按钮，回收态由代码 scaleY=-1 翻转）
            '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': {'__id__': node_idx}, '_enabled': True, '__prefab': None,
            '_spriteFrame': {'__uuid__': ARROW_SF, '__expectedType__': 'cc.SpriteFrame'},
            '_type': 0, '_sizeMode': 0, '_fillType': 0, '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
            '_fillStart': 0.0, '_fillRange': 0.0, '_isTrimmedModeEnabled': True,
            '_atlas': None, '_id': str(uuid.uuid4()),
            '_color': {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255},
        })
        d[bp]['_children'].append({'__id__': node_idx})
        print('expandBtn added')

    io.open(SCENE, 'w', encoding='utf-8', newline='').write(json.dumps(d, ensure_ascii=False, indent=2))
    json.loads(io.open(SCENE, encoding='utf-8').read())
    print('scene parses OK,', len(d), 'entries')

main()
