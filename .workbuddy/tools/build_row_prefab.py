# -*- coding: utf-8 -*-
"""生成 assets/resources/Prefabs/UI/UpgradeRow.prefab —— 列表行单元预制体。

结构（与 UpgradeRows.ts constructCell 逐节点同构，名字必须一致，bindRow 按名接手）：
  cell 322×78
    stroke  card_white SLICED 328×84 #3A1C08
    bg      card_white SLICED 322×78 #5C2E12
    tierBg  46×46 @(-136,-6) Graphics（空，运行时 applyRow 重描）   [隐藏]
    ic      46×46 @(-136,-6) Sprite SIMPLE stat/income（占位，运行时换图）
    badgeIc 18×18 @(-120,-24) stat/income                              [隐藏]
    nameIc  11×28 @(-106,17)  bottle/body_0                            [隐藏]
    name    Label 左对齐 @(-112,17) 盒 172×30 字 26
    sub     Label 左对齐 @(-112,-18) 盒 172×24 字 19
    btn     card_white SLICED 92×52 @(111,0) #F2C34E
      btnLb   Label 居中 @(13,1) 盒 50×40 字 20
      curIc   22×22 @(-33,1)  coin                                    [隐藏]
      adIcon  30×30 @(33,22)  ksp                                     [隐藏]
      newTag  46×24 @(-247,25)  (bg=card_white SLICED #E8556D + tagLb「新」)

格式硬规则（见 MEMORY）：prefab 三件套（PrefabInfo root→1/asset→0/fileId22）、
所有 node/component 的 _id 空串、PrefabInfo DFS 后序（node → children 子树 →
组件+CompPrefabInfo → PrefabInfo）。Label 按 UIKit 口径：盒子 ×TEXT_SS(2)、
节点 scale 0.5、fontSize ×2。
"""
import io, json, os, random, shutil, string, uuid

OUT = "assets/resources/Prefabs/UI/UpgradeRow.prefab"
OUT_META = OUT + ".meta"
BAK_DIR = ".workbuddy/prefab_bak"

SS = 2
SF = {
    'card_white': '62a176fe-219f-4cff-b9a9-ea10612f835f@f9941',
    'stat_income': '588aafd0-8646-4d7a-b0f5-594f595d2884@f9941',
    'body_0': '02bd5bdd-e1e8-4071-a310-730596cb90fd@f9941',
    'coin': 'c70ee16d-ca97-4483-b441-e3fe99fa2f4d@f9941',
    'ksp': 'bc6e554b-e65c-4f61-abba-be9a05217cd6@f9941',
}

def col(h):
    h = h.lstrip('#')
    return {'__type__': 'cc.Color', 'r': int(h[0:2], 16), 'g': int(h[2:4], 16), 'b': int(h[4:6], 16), 'a': 255}

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

# ---------- 组件工厂（lambda 拿到 owner node 的 __id__） ----------
def U(w, h, ax=0.5, ay=0.5):
    return lambda n: DOC.add({
        '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_contentSize': {'__type__': 'cc.Size', 'width': w, 'height': h},
        '_anchorPoint': {'__type__': 'cc.Vec2', 'x': ax, 'y': ay}, '_id': '',
    })

def SP(sf, color, typ=0):
    return lambda n: DOC.add({
        '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color),
        '_spriteFrame': {'__uuid__': SF[sf], '__expectedType__': 'cc.SpriteFrame'},
        '_type': typ, '_fillType': 0, '_sizeMode': 0,
        '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
        '_fillStart': 0, '_fillRange': 0, '_isTrimmedMode': True,
        '_useGrayscale': False, '_atlas': None, '_id': '',
    })

def GR(color='#FFFFFF'):
    return lambda n: DOC.add({
        '__type__': 'cc.Graphics', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color), '_lineWidth': 1,
        '_strokeColor': {'__type__': 'cc.Color', 'r': 0, 'g': 0, 'b': 0, 'a': 255},
        '_lineJoin': 2, '_lineCap': 0,
        '_fillColor': {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 0},
        '_miterLimit': 10, '_id': '',
    })

def LB(text, w, h, size, color, align='center', overflow=2, ax=0.5, bold=True):
    """Label；盒子/字号按 UIKit 口径 ×SS（节点 scale 0.5 由 node() 传）"""
    lh = round(size * 1.15 * SS, 2)
    return lambda n: DOC.add({
        '__type__': 'cc.Label', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color), '_string': text,
        '_horizontalAlign': 0 if align == 'left' else 1, '_verticalAlign': 1,
        '_actualFontSize': size * SS, '_fontSize': size * SS, '_fontFamily': 'Arial',
        '_lineHeight': lh, '_overflow': overflow, '_enableWrapText': True,
        '_font': None, '_isSystemFontUsed': True, '_spacingX': 0,
        '_isItalic': False, '_isBold': bold, '_isUnderline': False, '_underlineHeight': 2,
        '_cacheMode': 0, '_enableOutline': False,
        '_outlineColor': {'__type__': 'cc.Color', 'r': 0, 'g': 0, 'b': 0, 'a': 255},
        '_outlineWidth': 2, '_enableShadow': False,
        '_shadowColor': {'__type__': 'cc.Color', 'r': 0, 'g': 0, 'b': 0, 'a': 255},
        '_shadowOffset': {'__type__': 'cc.Vec2', 'x': 2, 'y': 2}, '_shadowBlur': 2, '_id': '',
    })

def emit_node(name, parent_id, x, y, comp_fns, child_fns=(), active=True, ax=0.5, ay=0.5, scale=None):
    """DFS 后序：node 占位 → children 子树 → 组件(+CompPrefabInfo) → PrefabInfo。"""
    nid = len(DOC.arr)
    DOC.arr.append({
        '__type__': 'cc.Node', '_name': name, '_objFlags': 0, '__editorExtras__': {},
        '_parent': DOC.ref(parent_id) if parent_id is not None else None,
        '_children': [], '_active': active, '_components': [], '_prefab': None,
        '_lpos': vec3(x, y), '_lrot': {'__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0, 'w': 1},
        '_lscale': vec3(*(scale or (1, 1, 1))), '_mobility': 0, '_layer': 33554432,
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

# ---------- 摆树（顺序 = 渲染序） ----------
def build():
    # 0: cc.Prefab 头
    DOC.arr.append({
        '__type__': 'cc.Prefab', '_name': 'UpgradeRow', '_objFlags': 0,
        '__editorExtras__': {}, '_native': '', 'data': {'__id__': 1},
        'optimizationPolicy': 0, 'persistent': False,
    })

    def stroke(p): return emit_node('stroke', p, 0, 0, [U(328, 84), SP('card_white', '#3A1C08', 1)])
    def bg(p):     return emit_node('bg', p, 0, 0, [U(322, 78), SP('card_white', '#5C2E12', 1)])
    def tierBg(p): return emit_node('tierBg', p, -136, -6, [U(46, 46), GR()], active=False)
    def ic(p):     return emit_node('ic', p, -136, -6, [U(46, 46), SP('stat_income', '#FFFFFF', 0)])
    def badge(p):  return emit_node('badgeIc', p, -120, -24, [U(18, 18), SP('stat_income', '#FFFFFF', 0)], active=False)
    def nameIc(p): return emit_node('nameIc', p, -106, 17, [U(11, 28), SP('body_0', '#FFFFFF', 0)], active=False)
    def name(p):   return emit_node('name', p, -112, 17,
                                    [U(172 * SS, 30 * SS, ax=0), LB('', 172, 30, 26, '#FFF3D0', align='left')],
                                    scale=(0.5, 0.5, 1), ax=0)
    def sub(p):    return emit_node('sub', p, -112, -18,
                                    [U(172 * SS, 24 * SS, ax=0), LB('', 172, 24, 19, '#D9C4A6', align='left')],
                                    scale=(0.5, 0.5, 1), ax=0)

    def btnLb(p):  return emit_node('btnLb', p, 13, 1,
                                    [U(50 * SS, 40 * SS), LB('', 50, 40, 20, '#7A4210')],
                                    scale=(0.5, 0.5, 1))
    def curIc(p):  return emit_node('curIc', p, -33, 1, [U(22, 22), SP('coin', '#FFFFFF', 0)], active=False)
    def adIcon(p): return emit_node('adIcon', p, 33, 22, [U(30, 30), SP('ksp', '#FFFFFF', 0)], active=False)
    def tagBg(p):  return emit_node('bg', p, 0, 0, [U(46, 24), SP('card_white', '#E8556D', 1)])
    def tagLb(p):  return emit_node('tagLb', p, 0, 1,
                                    [U(42 * SS, 20 * SS), LB('新', 42, 20, 16, '#FFF3D0')],
                                    scale=(0.5, 0.5, 1))
    def newTag(p): return emit_node('newTag', p, -247, 25, [U(46, 24)], [tagBg, tagLb])
    def btn(p):    return emit_node('btn', p, 111, 0, [U(92, 52), SP('card_white', '#F2C34E', 1)],
                                    [btnLb, curIc, adIcon, newTag])

    emit_node('cell', None, 0, 0, [U(322, 78)],
              [stroke, bg, tierBg, ic, badge, nameIc, name, sub, btn])
    return DOC.arr

def main():
    os.makedirs(BAK_DIR, exist_ok=True)
    if os.path.exists(OUT) and not os.path.exists(os.path.join(BAK_DIR, 'UpgradeRow.prefab.bak')):
        shutil.copyfile(OUT, os.path.join(BAK_DIR, 'UpgradeRow.prefab.bak'))
    d = build()
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2))
    if not os.path.exists(OUT_META):
        meta = {
            'ver': '1.1.50', 'importer': 'prefab', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': ['.json'], 'subMetas': {},
            'userData': {'syncNodeName': 'UpgradeRow'},
        }
        io.open(OUT_META, 'w', encoding='utf-8', newline='\n').write(json.dumps(meta, ensure_ascii=False, indent=2))
        print('meta written:', meta['uuid'])
    else:
        print('meta exists, kept')
    print('entries:', len(d), '->', OUT)

if __name__ == '__main__':
    main()
