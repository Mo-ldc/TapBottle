# -*- coding: utf-8 -*-
"""生成 assets/resources/Prefabs/UI/FloatText.prefab —— 飘字（金币 / 瓶盖 / 提示）单元预制体。

★ 为什么要有它：
  第三十九轮之前，飘字节点是 `FxLayer.floatText` 里用 `nd()+label()` **运行时现建**的，
  只靠 FxItem 数组切 active 做「伪池化」——节点只会越建越多（首局每次落瓶都新建
  一个 Node+Label+UIOpacity，稳定后也不再回收）。改成预制体 + `Pool` 之后：
    · 节点在编辑器里可视化（字号/描边/锚点改一处就全局生效）；
    · `Pool.acquire/release` 真回收，跑两分钟后同屏飘字数就是峰值数，不再增长。

结构（与 `nd(this.labelLayer,'ft',300,60)` + `label(n,'',0,0,300,60,…)` 逐节点同构）：
  FloatText  300×60  UIOpacity(255)
    label    Label 盒 600×120（=300/60 ×TEXT_SS 2）、节点 scale 0.5、
             fontSize 60（=30×2）、lineHeight 69、白字 #141821 描边 3、加粗、居中、不裁切

格式硬规则（详见 MEMORY「手写 .scene / .prefab 的硬性格式」）：
  · prefab 三件套：arr[0]=cc.Prefab(data→1)、每节点 _prefab→cc.PrefabInfo
    （root→1 / asset→0 / 22 字符 fileId）、每组件 __prefab→cc.CompPrefabInfo；
  · 所有 node/component 的 _id 必须是**空串**（prefab 专用，scene 才是 uuid）；
  · PrefabInfo DFS **后序**插入（node → children 子树 → 组件+CompPrefabInfo → PrefabInfo）。
"""
import io, json, os, random, shutil, string, uuid

OUT = "assets/resources/Prefabs/UI/FloatText.prefab"
OUT_META = OUT + ".meta"
BAK_DIR = ".workbuddy/prefab_bak"

# UIKit.label 的超采样口径（TEXT_SS）：盒子与字号 ×2、节点 scale 0.5
SS = 2
BASE_SIZE = 30          # floatText 的默认字号（运行时按需改大改小）
BOX_W, BOX_H = 300, 60  # 世界尺寸（外层 ft 节点）


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


def U(w, h, ax=0.5, ay=0.5):
    return lambda n: DOC.add({
        '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_contentSize': {'__type__': 'cc.Size', 'width': w, 'height': h},
        '_anchorPoint': {'__type__': 'cc.Vec2', 'x': ax, 'y': ay}, '_id': '',
    })


def OP(opacity=255):
    """UIOpacity —— 飘字的淡出靠它（改 Sprite/Label.color 的 a 会破合批，引擎口径用 UIOpacity）"""
    return lambda n: DOC.add({
        '__type__': 'cc.UIOpacity', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_opacity': opacity, '_id': '',
    })


def LB(text, size, color, outline=None, outlineW=3, w=None, h=None, align=1):
    """
    Label；盒子/字号按 UIKit 口径 ×SS（节点 scale 0.5 由 emit_node 传）。
    align: 0=LEFT 1=CENTER 2=RIGHT（与 cc.Label.HorizontalAlign 一致）
    """
    lh = round(size * 1.15 * SS, 2)
    return lambda n: DOC.add({
        '__type__': 'cc.Label', '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': DOC.ref(n), '_enabled': True, '__prefab': None,
        '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': col(color), '_string': text,
        '_horizontalAlign': align, '_verticalAlign': 1,
        '_actualFontSize': size * SS, '_fontSize': size * SS, '_fontFamily': 'Arial',
        '_lineHeight': lh, '_overflow': 0, '_enableWrapText': True,
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
        '__type__': 'cc.Prefab', '_name': 'FloatText', '_objFlags': 0,
        '__editorExtras__': {}, '_native': '', 'data': {'__id__': 1},
        'optimizationPolicy': 0, 'persistent': False,
    })

    def lb(p):
        return emit_node('label', p, 0, 0,
                         [U(BOX_W * SS, BOX_H * SS), LB('', BASE_SIZE, '#FFFFFF', '#141821', 3)],
                         scale=(0.5, 0.5, 1))

    emit_node('FloatText', None, 0, 0, [U(BOX_W, BOX_H), OP(255)], [lb])
    return DOC.arr


def main():
    os.makedirs(BAK_DIR, exist_ok=True)
    if os.path.exists(OUT) and not os.path.exists(os.path.join(BAK_DIR, 'FloatText.prefab.bak')):
        shutil.copyfile(OUT, os.path.join(BAK_DIR, 'FloatText.prefab.bak'))
    d = build()
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2))
    if not os.path.exists(OUT_META):
        meta = {
            'ver': '1.1.50', 'importer': 'prefab', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': ['.json'], 'subMetas': {},
            'userData': {'syncNodeName': 'FloatText'},
        }
        io.open(OUT_META, 'w', encoding='utf-8', newline='\n').write(json.dumps(meta, ensure_ascii=False, indent=2))
        print('meta written:', meta['uuid'])
    else:
        print('meta exists, kept')
    print('entries:', len(d), '->', OUT)


if __name__ == '__main__':
    main()
