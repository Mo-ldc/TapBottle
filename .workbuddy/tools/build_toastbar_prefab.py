# -*- coding: utf-8 -*-
"""生成 assets/resources/Prefabs/UI/ToastBar.prefab —— 顶部横条提示（Toast）预制体。

★ 为什么要有它（第一百轮）：
  Toast 横条此前是 `UI/Base/Toast.ts` 的 show() 里用 `roundedPanel()`(Graphics 画圆角)
  + `label()` **运行时现建**的 —— 编辑器里根本不存在这个节点，用户改不到任何东西。
  迁移到预制体后：位置 / 尺寸 / 底色 / 描边色 / 字号 / 描边全在编辑器可视化可调，
  代码只负责填文字 + 动态字色 + 出场动画（上浮淡出）。

结构（与原 show() 运行时现建逐节点同构）：
  ToastBar  560×76  pos(0,0)  UIOpacity(0)（排队时隐藏；playPop 驱动淡入淡出）
    bg      Sprite(SLICED) nine_base  tint #4A2410EE（半透明深棕底）
    stroke  Sprite(SLICED) nine_stroke tint #8A5A20（金棕描边，叠在 bg 上）
    msg     Label 盒 530×70（UIKit 口径 ×TEXT_SS=2 → 1060×140、节点 scale 0.5）、
            fontSize 28(=56)、SHRINK、居中、加粗、白字 #FFE9A8 描边 #2A1608×3

格式硬规则（详见 MEMORY「手写 .scene / .prefab 的硬性格式」）：
  · prefab 三件套：arr[0]=cc.Prefab(data→1)、每节点 _prefab→cc.PrefabInfo
    （root→1 / asset→0 / 22 字符 fileId）、每组件 __prefab→cc.CompPrefabInfo；
  · 所有 node/component 的 _id 必须是**空串**（prefab 专用，scene 才是 uuid）；
  · PrefabInfo DFS **后序**插入（node → children 子树 → 组件+CompPrefabInfo → PrefabInfo）。
"""
import io, json, os, random, shutil, string, uuid

OUT = "assets/resources/Prefabs/UI/ToastBar.prefab"
OUT_META = OUT + ".meta"
BAK_DIR = ".workbuddy/prefab_bak"

# 与 Toast.show() 原运行时口径一致
W, H = 560, 76            # 横条尺寸
MSG_W, MSG_H = 530, 70    # 文字盒
SIZE = 28                 # 字号
SS = 2                    # UIKit.TEXT_SS 超采样

# 九宫格皮肤 spriteFrame（gen_nineslice.py 产物）
SF_BASE = "ade2de50-105d-4a17-8d3a-41c7f6a3ce0f@f9941"    # nine_base
SF_STROKE = "a72e22e7-24b1-4510-b924-fc97a390952b@f9941"  # nine_stroke


def col(h):
    """#RRGGBB 或 #RRGGBBAA"""
    h = h.lstrip('#')
    a = int(h[6:8], 16) if len(h) >= 8 else 255
    return {'__type__': 'cc.Color', 'r': int(h[0:2], 16), 'g': int(h[2:4], 16), 'b': int(h[4:6], 16), 'a': a}


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


def OP(opacity=255):
    return lambda n: DOC.add({
        '__type__': 'cc.UIOpacity', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_opacity': opacity, '_id': '',
    })


def SP(sf, color):
    """Sprite(SLICED)（_type=1），sizeMode=CUSTOM(0) —— 尺寸跟 UITransform 走"""
    return lambda n: DOC.add({
        '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color),
        '_spriteFrame': {'__uuid__': sf, '__expectedType__': 'cc.SpriteFrame'},
        '_type': 1, '_fillType': 0, '_sizeMode': 0,
        '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
        '_fillStart': 0, '_fillRange': 0, '_isTrimmedMode': True,
        '_useGrayscale': False, '_atlas': None, '_id': '',
    })


def LB(text, size, color, outline, outlineW, w, h, align=1, overflow=2):
    """Label（UIKit.label 口径：盒子/字号 ×SS、节点 scale 0.5 由 emit_node 传）。
    align: 0=LEFT 1=CENTER 2=RIGHT；overflow: 0=NONE 1=CLAMP 2=SHRINK 3=RESIZE_HEIGHT"""
    lh = round(size * 1.15 * SS, 2)
    return lambda n: DOC.add({
        '__type__': 'cc.Label', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color), '_string': text,
        '_horizontalAlign': align, '_verticalAlign': 1,
        '_actualFontSize': size * SS, '_fontSize': size * SS, '_fontFamily': 'Arial',
        '_lineHeight': lh, '_overflow': overflow, '_enableWrapText': True,
        '_font': None, '_isSystemFontUsed': True, '_spacingX': 0,
        '_isItalic': False, '_isBold': True, '_isUnderline': False, '_underlineHeight': 2,
        '_cacheMode': 0,
        '_enableOutline': bool(outline),
        '_outlineColor': col(outline or '#000000'),
        '_outlineWidth': outlineW,
        '_enableShadow': False,
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


def build():
    # 0: cc.Prefab 头
    DOC.arr.append({
        '__type__': 'cc.Prefab', '_name': 'ToastBar', '_objFlags': 0,
        '__editorExtras__': {}, '_native': '', 'data': {'__id__': 1},
        'optimizationPolicy': 0, 'persistent': False,
    })

    def bg(p):
        return emit_node('bg', p, 0, 0, [U(W, H), SP(SF_BASE, '#4A2410EE')])

    def stroke(p):
        return emit_node('stroke', p, 0, 0, [U(W, H), SP(SF_STROKE, '#8A5A20')])

    def msg(p):
        return emit_node('msg', p, 0, 0,
                         [U(MSG_W * SS, MSG_H * SS),
                          LB('', SIZE, '#FFE9A8', '#2A1608', 3, MSG_W, MSG_H)],
                         scale=(0.5, 0.5, 1))

    # 根节点位置 = prefab 口径（用户改这里就能挪横条）；UIOpacity(0) 排队隐藏
    emit_node('ToastBar', None, 0, 0, [U(W, H), OP(0)], [bg, stroke, msg])
    return DOC.arr


def main():
    os.makedirs(BAK_DIR, exist_ok=True)
    if os.path.exists(OUT) and not os.path.exists(os.path.join(BAK_DIR, 'ToastBar.prefab.bak')):
        shutil.copyfile(OUT, os.path.join(BAK_DIR, 'ToastBar.prefab.bak'))
    d = build()
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2))
    if not os.path.exists(OUT_META):
        meta = {
            'ver': '1.1.50', 'importer': 'prefab', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': ['.json'], 'subMetas': {},
            'userData': {'syncNodeName': 'ToastBar'},
        }
        io.open(OUT_META, 'w', encoding='utf-8', newline='\n').write(json.dumps(meta, ensure_ascii=False, indent=2))
        print('meta written:', meta['uuid'])
    else:
        print('meta exists, kept')
    print('entries:', len(d), '->', OUT)


if __name__ == '__main__':
    main()
