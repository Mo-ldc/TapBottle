# -*- coding: utf-8 -*-
"""生成 assets/resources/Prefabs/Game/Cap.prefab —— 履带瓶盖单元（CapMachine 对象池的实例来源）。

★ 为什么要有它：
  第四十三轮之前，瓶盖节点是 `CapMachine.ensurePool` 里 `nd()` + `addComponent(Sprite)`
  **运行时现建**的（110 个）。功能上没问题（那 110 个节点常驻 chips 容器、只切 active，
  比通用 Pool 的 acquire/release 更省——后者每次都 addChild/removeFromParent 会重建
  渲染合批），但外观无法在编辑器里可视化调整。改成「预制体作为池的实例来源、节点仍然
  常驻复用」之后：改贴图/尺寸/亮度进编辑器一处生效，且不再运行时拼组件。

结构（与 `nd(chipsNode,'chip',40,36)` + `setFrame(sp,'bottle/capchip_0',40,36)` 同构）：
  Cap  40×36  UITransform(0.5,0.5) + Sprite(capchip_0, SIMPLE, CUSTOM, 白)

格式硬规则见 build_floattext_prefab.py 的说明（prefab 三件套 / _id 空串 / 后序 PrefabInfo）。
"""
import io, json, os, random, shutil, string, uuid

OUT = "assets/resources/Prefabs/Game/Cap.prefab"
OUT_META = OUT + ".meta"
BAK_DIR = ".workbuddy/prefab_bak"

# 瓶盖统一贴图（与 CapMachine.CHIP_TEX 一致；靠 Sprite.color 染色区分品阶 → 保持合批）
CHIP_TEX_UUID = "9f75f315-beed-4383-b868-de68dddac8a2"   # Textures/bottle/capchip_0.png
W, H = 40, 36


def fid():
    pool = string.ascii_letters + string.digits + '/_+=-'
    return ''.join(random.choice(pool) for _ in range(22))


def vec3(x=0, y=0, z=0):
    return {'__type__': 'cc.Vec3', 'x': x, 'y': y, 'z': z}


class Doc:
    def __init__(self):
        self.arr = []

    def add(self, o):
        self.arr.append(o)
        return len(self.arr) - 1

    def ref(self, i):
        return {'__id__': i}


DOC = Doc()


def U(w, h, ax=0.5, ay=0.5):
    return lambda n: DOC.add({
        '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_contentSize': {'__type__': 'cc.Size', 'width': w, 'height': h},
        '_anchorPoint': {'__type__': 'cc.Vec2', 'x': ax, 'y': ay}, '_id': '',
    })


def SPRITE(uuid_str, r=255, g=255, b=255, a=255):
    """Sprite：SIMPLE(0) + CUSTOM sizeMode(0) + isTrimmedMode —— 与 BottleShadow.prefab 同字段集"""
    return lambda n: DOC.add({
        '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': {'__type__': 'cc.Color', 'r': r, 'g': g, 'b': b, 'a': a},
        '_spriteFrame': {'__uuid__': uuid_str + '@f9941', '__expectedType__': 'cc.SpriteFrame'},
        '_type': 0, '_fillType': 0, '_sizeMode': 0,
        '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
        '_fillStart': 0, '_fillRange': 0,
        '_isTrimmedMode': True, '_useGrayscale': False, '_atlas': None, '_id': '',
    })


def emit_node(name, parent_id, x, y, comp_fns, child_fns=(), active=True, ax=0.5, ay=0.5):
    nid = len(DOC.arr)
    DOC.arr.append({
        '__type__': 'cc.Node', '_name': name, '_objFlags': 0, '__editorExtras__': {},
        '_parent': DOC.ref(parent_id) if parent_id is not None else None,
        '_children': [], '_active': active, '_components': [], '_prefab': None,
        '_lpos': vec3(x, y), '_lrot': {'__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0, 'w': 1},
        '_lscale': vec3(1, 1, 1), '_mobility': 0, '_layer': 33554432,
        '_euler': vec3(), '_id': '',
    })
    DOC.arr[nid]['_children'] = [DOC.ref(f(nid)) for f in child_fns]
    comps = []
    for fn in comp_fns:
        cid = fn(nid)
        ci = DOC.add({'__type__': 'cc.CompPrefabInfo', 'fileId': fid()})
        DOC.arr[cid]['__prefab'] = DOC.ref(ci)
        comps.append(DOC.ref(cid))
    DOC.arr[nid]['_components'] = comps
    DOC.arr[nid]['_prefab'] = DOC.ref(DOC.add({
        '__type__': 'cc.PrefabInfo', 'root': {'__id__': 1}, 'asset': {'__id__': 0},
        'fileId': fid(), 'instance': None, 'targetOverrides': None,
        'nestedPrefabInstanceRoots': None,
    }))
    return nid


def build():
    DOC.arr.append({
        '__type__': 'cc.Prefab', '_name': 'Cap', '_objFlags': 0,
        '__editorExtras__': {}, '_native': '', 'data': {'__id__': 1},
        'optimizationPolicy': 0, 'persistent': False,
    })
    emit_node('Cap', None, 0, 0, [U(W, H), SPRITE(CHIP_TEX_UUID)])
    return DOC.arr


def main():
    os.makedirs(BAK_DIR, exist_ok=True)
    if os.path.exists(OUT) and not os.path.exists(os.path.join(BAK_DIR, 'Cap.prefab.bak')):
        shutil.copyfile(OUT, os.path.join(BAK_DIR, 'Cap.prefab.bak'))
    d = build()
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2))
    if not os.path.exists(OUT_META):
        meta = {
            'ver': '1.1.50', 'importer': 'prefab', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': ['.json'], 'subMetas': {},
            'userData': {'syncNodeName': 'Cap'},
        }
        io.open(OUT_META, 'w', encoding='utf-8', newline='\n').write(json.dumps(meta, ensure_ascii=False, indent=2))
        print('meta written:', meta['uuid'])
    else:
        print('meta exists, kept')
    print('entries:', len(d), '->', OUT)


if __name__ == '__main__':
    main()
