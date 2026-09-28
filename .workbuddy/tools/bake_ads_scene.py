# -*- coding: utf-8 -*-
"""把广告牌整图 UI（bd07-10）直接烘进 Game.scene。

- ad_coin/ad_cap/ad_halo：拆掉旧的 icon/label/adTag 拼装件子树（JSON 里 detach，
  孤儿条目无害，编辑器下次保存会回收），Sprite 直接指到 skin/main/ab_* 的
  spriteFrame uuid，type=SIMPLE、sizeMode=CUSTOM、白色。
- 新增第 4 块 ad_berserk（bd10），与运行时 newPlate 的坐标一致（-288, -232）。
"""
import json, shutil, uuid, io, sys

SCENE = "assets/scenes/Game.scene"
BAK = ".workbuddy/scene_bak/Game.scene.bak_ads"

SKIN_SF = {
    'ad_coin':    '7e180a6f-ac12-48f9-a541-332115df66d3@f9941',  # ab_double_coin (bd07)
    'ad_cap':     '37fd91ab-e5bc-4fbf-b5ba-b0ca4cf8abf7@f9941',  # ab_double_cap  (bd08)
    'ad_halo':    '6b3e824b-8eb0-45b2-89a4-c2bc8b028121@f9941',  # ab_cursor_big  (bd09)
    'ad_berserk': 'e74ab368-2470-44b1-b34e-6cd8b48cbf82@f9941',  # ab_berserk     (bd10)
}

def main():
    raw = io.open(SCENE, encoding='utf-8').read()
    d = json.loads(raw)
    import os
    os.makedirs(os.path.dirname(BAK), exist_ok=True)
    if not os.path.exists(BAK):
        shutil.copyfile(SCENE, BAK)

    def find(parent_idx, name):
        o = d[parent_idx]
        if o.get('__type__') == 'cc.Node' and o.get('_name') == name:
            return parent_idx
        for c in o.get('_children', []):
            r = find(c['__id__'], name)
            if r is not None:
                return r
        return None

    ad_root = find(1, 'adRoot')
    assert ad_root is not None, 'adRoot not found'
    adr = d[ad_root]

    for name, sf in SKIN_SF.items():
        ni = find(ad_root, name)
        if ni is not None:
            n = d[ni]
            n['_children'] = []           # 拆掉旧拼装件（icon/label/adTag）
            for comp in n.get('_components', []):
                c = d[comp['__id__']]
                if c.get('__type__') == 'cc.Sprite':
                    c['_spriteFrame'] = {'__uuid__': sf, '__expectedType__': 'cc.SpriteFrame'}
                    c['_type'] = 0        # SIMPLE
                    c['_sizeMode'] = 0    # CUSTOM
                    c['_color'] = {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255}
            print('baked', name)
            continue
        # 不存在 → 新建（只有 ad_berserk 会走到这）
        node_idx = len(d)
        ut_idx, sp_idx = node_idx + 1, node_idx + 2
        d.append({  # node
            '__type__': 'cc.Node', '_name': name, '_objFlags': 0, '__editorExtras__': {},
            '_parent': {'__id__': ad_root}, '_children': [], '_active': True,
            '_components': [{'__id__': ut_idx}, {'__id__': sp_idx}], '_prefab': None,
            '_lpos': {'__type__': 'cc.Vec3', 'x': -288, 'y': -232, 'z': 0},
            '_lrot': {'__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0, 'w': 1},
            '_lscale': {'__type__': 'cc.Vec3', 'x': 1, 'y': 1, 'z': 1},
            '_mobility': 0, '_layer': 33554432,
            '_euler': {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0},
            '_id': str(uuid.uuid4()),
        })
        d.append({  # UITransform
            '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': {'__id__': node_idx}, '_enabled': True, '__prefab': None,
            '_contentSize': {'__type__': 'cc.Size', 'width': 136, 'height': 116},
            '_anchorPoint': {'__type__': 'cc.Vec2', 'x': 0.5, 'y': 0.5},
            '_id': str(uuid.uuid4()),
        })
        d.append({  # Sprite
            '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': {'__id__': node_idx}, '_enabled': True, '__prefab': None,
            '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
            '_color': {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255},
            '_spriteFrame': {'__uuid__': sf, '__expectedType__': 'cc.SpriteFrame'},
            '_type': 0, '_fillType': 0, '_sizeMode': 0,
            '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
            '_fillStart': 0, '_fillRange': 0, '_isTrimmedMode': True,
            '_useGrayscale': False, '_atlas': None, '_id': str(uuid.uuid4()),
        })
        adr.setdefault('_children', []).append({'__id__': node_idx})
        print('created', name)

    io.open(SCENE, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(d, ensure_ascii=False, indent=2, default=lambda o: list(o.values()) if isinstance(o, set) else o))
    print('saved', SCENE)

if __name__ == '__main__':
    main()
