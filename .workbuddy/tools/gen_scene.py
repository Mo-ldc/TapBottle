"""
直接生成 Cocos 3.8 的 .scene / .prefab 文件（绕过编辑器 MCP 不稳定的场景切换）。

用法：在 build_xxx.py 里 import 本模块，用 Node()/Sprite()/Label()/Widget() 组装树，
     最后 write_scene(path, name, root) / write_prefab(path, name, root)。

序列化规则（对照 Cocos 3.8 真实产物验证）：
  - 数组元素顺序 = 深度优先：node → children(递归) → components
  - 交叉引用用 {"__id__": <数组下标>}，允许前后向引用
  - 资源引用用 {"__uuid__": "xxx@f9941", "__expectedType__": "cc.SpriteFrame"}
"""
import json
import os
import random
import string
import uuid as _uuid

_ALPHA = string.ascii_letters + string.digits + '+/'
_ID_SEEN = set()


def newid(n=22):
    """22 字符压缩 id —— 用于 PrefabInfo.fileId / CompPrefabInfo.fileId"""
    while True:
        s = ''.join(random.choice(_ALPHA) for _ in range(n))
        if s not in _ID_SEEN:
            _ID_SEEN.add(s)
            return s


def uid():
    """标准 uuid —— 用于 .scene 里 node / component 的 _id（编辑器真产物就是这个格式）。
    ⚠️ .prefab 里 _id 必须为空字符串，不能调这个（见 write_prefab）。"""
    return str(_uuid.uuid4())


def V3(x=0, y=0, z=0):
    return {'__type__': 'cc.Vec3', 'x': x, 'y': y, 'z': z}


def V2(x=0, y=0):
    return {'__type__': 'cc.Vec2', 'x': x, 'y': y}


def Size(w, h):
    return {'__type__': 'cc.Size', 'width': w, 'height': h}


def Color(r, g, b, a=255):
    return {'__type__': 'cc.Color', 'r': r, 'g': g, 'b': b, 'a': a}


def Quat(angle_z=0.0):
    """绕 Z 轴旋转 angle_z 度的四元数（_lrot 与 _euler 必须一致）"""
    import math
    h = math.radians(angle_z) / 2.0
    return {'__type__': 'cc.Quat', 'x': 0, 'y': 0,
            'z': round(math.sin(h), 6), 'w': round(math.cos(h), 6)}


def Rect(x=0, y=0, w=1, h=1):
    return {'__type__': 'cc.Rect', 'x': x, 'y': y, 'width': w, 'height': h}


# ---------------- Widget 对齐位 ----------------
# ⚠️ 必须与引擎 `cc.Widget.AlignFlags` 逐位一致（cocos/ui/widget.ts）：
#      TOP=1<<0  MID=1<<1  BOT=1<<2  LEFT=1<<3  CENTER=1<<4  RIGHT=1<<5
#    早期这里写成 LEFT,TOP,RIGHT,BOTTOM = 1,2,4,8 是**错的**，
#    于是 `W_LEFT|W_RIGHT|W_BOTTOM`(=13) 被引擎读成 TOP|BOT|LEFT：
#    宽度不拉伸、反而纵向拉伸到「父高 − bottom」，元素被拉到屏幕中间。
#    因为绝大多数层的自身尺寸本来就等于父尺寸，看起来「碰巧没坏」，
#    直到引导层这种窄条才暴露。实测校验：置 13 → 引擎报告 L/T/B=true, R=false。
W_TOP, W_MID, W_BOT, W_LEFT, W_HC, W_RIGHT = 1, 2, 4, 8, 16, 32
W_VC = W_MID
W_ALL = W_LEFT | W_RIGHT | W_TOP | W_BOT


class Node:
    """场景/Prefab 节点。children / components 由 attach() 填充。"""

    def __init__(self, name, x=0, y=0, w=1, h=1, ax=0.5, ay=0.5, active=True,
                 layer=33554432, scale=1.0, angle=0.0):
        self.name = name
        self.x, self.y = x, y
        self.w, self.h = w, h
        self.ax, self.ay = ax, ay
        self.active = active
        self.layer = layer
        self.scale = scale
        self.angle = angle
        self.children = []
        self.components = []

    def attach(self, comp):
        self.components.append(comp)
        comp.node = self
        return comp

    def add(self, child):
        self.children.append(child)
        return child

    def to_obj(self):
        return {
            '__type__': 'cc.Node',
            '_name': self.name,
            '_objFlags': 0,
            '__editorExtras__': {},
            '_parent': None,
            '_children': [],
            '_active': self.active,
            '_components': [],
            '_prefab': None,
            '_lpos': V3(self.x, self.y, 0),
            '_lrot': Quat(self.angle),
            '_lscale': V3(self.scale, self.scale, 1),
            '_mobility': 0,
            '_layer': self.layer,
            '_euler': V3(0, 0, self.angle),
            '_id': uid(),
        }


class Comp:
    def __init__(self, type_, **fields):
        self.type_ = type_
        self.fields = fields
        self.node = None

    def to_obj(self):
        o = {
            '__type__': self.type_,
            '_name': '',
            '_objFlags': 0,
            '__editorExtras__': {},
            'node': None,
            '_enabled': True,
            '_id': uid(),
        }
        o.update(self.fields)
        return o


def UITransform(w, h, ax=0.5, ay=0.5):
    return Comp('cc.UITransform', _contentSize=Size(w, h), _anchorPoint=V2(ax, ay))


def Sprite(uuid, type_=0, size_mode=0, color=(255, 255, 255, 255), gray=False):
    """type_: 0=SIMPLE 1=SLICED 2=TILED 3=FILLED ; size_mode: 0=CUSTOM 1=TRIMMED 2=RAW"""
    return Comp('cc.Sprite',
                _customMaterial=None,
                _srcBlendFactor=2, _dstBlendFactor=4,
                _color=Color(*color),
                _spriteFrame={'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'},
                _type=type_, _fillType=0, _sizeMode=size_mode,
                _fillCenter=V2(0, 0), _fillStart=0, _fillRange=0,
                _isTrimmedMode=True, _useGrayscale=gray, _atlas=None)


def Widget(flags, left=0, right=0, top=0, bottom=0, hc=0, vc=0, mode=2):
    return Comp('cc.Widget',
                _alignFlags=flags, _target=None,
                _left=left, _right=right, _top=top, _bottom=bottom,
                _horizontalCenter=hc, _verticalCenter=vc,
                _isAbsLeft=True, _isAbsRight=True, _isAbsTop=True, _isAbsBottom=True,
                _isAbsHorizontalCenter=True, _isAbsVerticalCenter=True,
                _originalWidth=0, _originalHeight=0,
                _alignMode=mode, _lockFlags=0)


def Label(text, size=32, color=(255, 255, 255, 255), w=0, h=0, bold=True,
          align=1, valign=1, overflow=0, line_height=None,
          outline=None, outline_w=4, shadow=None, font_uuid=None):
    """overflow: 0=NONE 1=CLAMP 2=SHRINK 3=RESIZE_HEIGHT"""
    lh = line_height if line_height is not None else int(size * 1.25)
    f = {
        '_customMaterial': None,
        '_srcBlendFactor': 2, '_dstBlendFactor': 4,
        '_color': Color(*color),
        '_string': text,
        '_horizontalAlign': align,
        '_verticalAlign': valign,
        '_actualFontSize': size,
        '_fontSize': size,
        '_fontFamily': 'Arial',
        '_lineHeight': lh,
        '_overflow': overflow,
        '_enableWrapText': True,
        # ⚠️ expectedType 必须是 'cc.TTFFont' 而不是泛化的 'cc.Font'：
        #    编辑器存盘时会改写这一项，写成 cc.Font 的话每次 open+save 都会产生 diff。
        '_font': ({'__uuid__': font_uuid, '__expectedType__': 'cc.TTFFont'} if font_uuid else None),
        '_isSystemFontUsed': font_uuid is None,
        '_spacingX': 0,
        '_isItalic': False,
        '_isBold': bold,
        '_isUnderline': False,
        '_underlineHeight': 2,
        '_cacheMode': 0,
        '_enableOutline': outline is not None,
        '_outlineColor': Color(*(outline or (0, 0, 0, 255))),
        '_outlineWidth': outline_w,
        '_enableShadow': shadow is not None,
        '_shadowColor': Color(*(shadow or (0, 0, 0, 255))),
        '_shadowOffset': V2(2, 2),   # 标定结果：编辑器默认 (2,2)，不是 (2,-2)
        '_shadowBlur': 2,
    }
    return Comp('cc.Label', **f)


def Script(uuid, **props):
    """用户脚本组件：uuid 为脚本 meta 的 uuid，props 为 @property 字段名 → 值（Node/Label 或标量）。"""
    return Comp(uuid, **props)


def UIOpacity(a=255):
    return Comp('cc.UIOpacity', _opacity=a)


# ---------------- 交互 / 容器类组件 ----------------
# ⚠️ 下面这些字段全部是「编辑器真产物标定」出来的（见 _serial_probe.py）：
#    在编辑器进程里用 cc API 建节点 → prefab_create 存盘 → 读回 JSON。
#    不要凭 cc.d.ts 的 protected 字段猜 —— 受保护字段常常和运行时属性不同名
#    （例如 Layout 是 `_layoutType` 而不是 `_type`），猜错不会报错，
#    但编辑器存盘时会把缺的字段补回来，手写版和编辑器版就不一致了。

def Mask(type_=0, inverted=False, segments=64, alpha_threshold=0.1):
    """type_: 0=GRAPHICS_RECT 1=GRAPHICS_ELLIPSE 2=IMAGE_STENCIL
    ⚠️ GRAPHICS_* 类型必须跟一个 cc.Graphics 兄弟组件（引擎用它画遮罩区域），
       少了它遮罩不生效且不报错 —— 由 build Mask 的辅助函数自动补。"""
    return Comp('cc.Mask', _type=type_, _inverted=inverted,
                _segments=segments, _alphaThreshold=alpha_threshold)


def Graphics(line_width=1, stroke_color=(0, 0, 0, 255), fill_color=(255, 255, 255, 0),
             line_join=2, line_cap=0, miter_limit=10, color=(255, 255, 255, 255)):
    return Comp('cc.Graphics',
                _customMaterial=None,
                _srcBlendFactor=2, _dstBlendFactor=4,
                _color=Color(*color),
                _lineWidth=line_width, _strokeColor=Color(*stroke_color),
                _lineJoin=line_join, _lineCap=line_cap,
                _fillColor=Color(*fill_color), _miterLimit=miter_limit)


def GraphicsHole():
    """GRAPHICS_RECT 遮罩配套的 Graphics —— 引擎序列化时自动带的那个。

    注意：它的 _fillColor 是 `(255,255,255,0)`（alpha=0 的白色），
    不是 `(0,0,0,0)`；lineWidth=1、strokeColor 全黑。原样抄编辑器产物。"""
    return Graphics(line_width=1, stroke_color=(0, 0, 0, 255),
                    fill_color=(255, 255, 255, 0))


def Layout(type_=2, resize_mode=1, spacing_x=0, spacing_y=0,
           padding_left=0, padding_right=0, padding_top=0, padding_bottom=0,
           start_axis=0, cell=(40, 40), vertical_dir=1, horizontal_dir=0,
           constraint=0, constraint_num=2, affected_by_scale=False, enabled=True):
    """type_: 0=NONE 1=HORIZONTAL 2=VERTICAL 3=GRID
    resize_mode: 0=NONE 1=CONTAINER 2=CHILDREN"""
    c = Comp('cc.Layout',
             _resizeMode=resize_mode, _layoutType=type_,
             _cellSize=Size(cell[0], cell[1]), _startAxis=start_axis,
             _paddingLeft=padding_left, _paddingRight=padding_right,
             _paddingTop=padding_top, _paddingBottom=padding_bottom,
             _spacingX=spacing_x, _spacingY=spacing_y,
             _verticalDirection=vertical_dir, _horizontalDirection=horizontal_dir,
             _constraint=constraint, _constraintNum=constraint_num,
             _affectedByScale=affected_by_scale, _isAlign=False)
    c.fields['_enabled'] = enabled
    return c


def BlockInputEvents():
    return Comp('cc.BlockInputEvents')


def ScrollView(content, vertical=True, horizontal=False, inertia=True,
               brake=0.72, elastic=True, bounce_duration=0.2, cancel_inner=True):
    """`content` 传 Node 实例（会被解析成 __id__）。"""
    return Comp('cc.ScrollView',
                bounceDuration=bounce_duration, brake=brake, elastic=elastic,
                inertia=inertia, horizontal=horizontal, vertical=vertical,
                cancelInnerEvents=cancel_inner,
                scrollEvents=[],
                _content=content,
                _horizontalScrollBar=None, _verticalScrollBar=None)


def Camera(ortho=10, depth=1, clear_flags=6, visibility=1108344832):
    return Comp('cc.Camera',
                _projection=0, _priority=0, _fov=45, _fovAxis=0,
                _orthoHeight=ortho, _near=1, _far=2000,
                _color=Color(0, 0, 0, 255),
                _depth=depth, _stencil=0, _clearFlags=clear_flags,
                _rect=Rect(0, 0, 1, 1),
                _visibility=visibility)


def CanvasComp(camera_comp):
    """⚠️ _cameraComponent 必须是 cc.Camera **组件**实例，传节点会导致
    `this._cameraComponent._createCamera is not a function`。"""
    return Comp('cc.Canvas', _cameraComponent=camera_comp, _alignCanvasWithScreen=True)


# ---------------- 序列化 ----------------
def _serialize(roots, scene_globals=None, prefab_info=False):
    """prefab_info=True 时按 Cocos 真产物的格式注入 PrefabInfo / CompPrefabInfo。

    ⚠️ 这是「编辑器能双击打开 prefab」的硬性条件（实测缺了就打不开）：
       - 每个 **组件** 之后紧跟一个 cc.CompPrefabInfo（__prefab 指向它）
       - 每个 **节点** 的子树和组件全部排完之后，紧跟一个 cc.PrefabInfo（_prefab 指向它）
         —— 即 DFS 后序。
    """
    out = []
    idx = {}

    def place(n):
        nobj = n.to_obj()
        if id(nobj) in idx:
            return idx[id(nobj)]
        my = len(out)
        idx[id(nobj)] = my
        out.append(nobj)
        for c in n.children:
            ci = place(c)
            nobj['_children'].append({'__id__': ci})
            out[ci]['_parent'] = {'__id__': my}
        for c in n.components:
            cobj = c.to_obj()
            ci = len(out)
            idx[id(cobj)] = ci
            out.append(cobj)
            nobj['_components'].append({'__id__': ci})
            cobj['node'] = {'__id__': my}
            if prefab_info:
                cobj['__prefab'] = {'__id__': ci + 1}
                out.append({'__type__': 'cc.CompPrefabInfo', 'fileId': newid()})
        if prefab_info:
            nobj['_prefab'] = {'__id__': len(out)}
            out.append({
                '__type__': 'cc.PrefabInfo',
                'root': {'__id__': -1},   # → 1：prefab 根节点（write_prefab 里已 +1 偏移）
                'asset': {'__id__': -2},  # → 0：cc.Prefab asset
                'fileId': newid(),
                'instance': None,
                'targetOverrides': None,
            })
        return my

    for r in roots:
        place(r)

    # Script 属性：Node/Comp 实例 → __id__
    pos = {}
    seq = []

    # ⚠️ seq 必须与 out 逐位对齐：插入了 CompPrefabInfo / PrefabInfo 就要补 None 占位，
    #    否则 Script 属性里的 Node/Comp 引用会整体错位（指向错误的节点）。
    def rec2(n):
        seq.append(n)
        for c in n.children:
            rec2(c)
        for c in n.components:
            seq.append(c)
            if prefab_info:
                seq.append(None)   # cc.CompPrefabInfo
        if prefab_info:
            seq.append(None)       # cc.PrefabInfo

    for r in roots:
        rec2(r)
    for i, item in enumerate(seq):
        if item is not None:
            pos[id(item)] = i

    for o in out:
        for k, v in list(o.items()):
            o[k] = _ref(v, pos)

    if scene_globals:
        out.extend(scene_globals)
    return out


def _ref(v, pos):
    """把 Node / Comp（含数组形式）解析成 {"__id__": i} / [{"__id__": i}, ...]。

    ⚠️ 递归进 list 是后来加的：`@property({ type: [StatRow] })` 这类数组型绑定写的就是
       `[{"__id__": 12}, {"__id__": 20}, ...]`。早期只解单个实例，数组会原样吐出一个
       Python 对象，JSON dump 时直接炸或写成 {}，运行时拿到 undefined。
    """
    if isinstance(v, (Node, Comp)):
        return {'__id__': pos[id(v)]}
    if isinstance(v, (list, tuple)):
        return [_ref(x, pos) for x in v]
    return v


def _globals():
    return [
        {
            '__type__': 'cc.SceneGlobals',
            'ambient': {'__id__': None},
            'shadows': {'__id__': None},
            '_skybox': {'__id__': None},
            'fog': {'__id__': None},
        }
    ]


def _shift(body, n):
    """把 body 内所有 __id__ 相对下标 +n（对齐到最终数组的绝对下标）。

    ⚠️ 负数下标是「绝对下标占位符」，不参与平移：
       -1 → 1（prefab 根节点）、-2 → 0（cc.Prefab asset）。
    """
    def walk(o):
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if k == '__id__' and isinstance(v, int):
                    o[k] = v + n if v >= 0 else (1 if v == -1 else 0)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    for o in body:
        walk(o)
    return body


def write_scene(path, name, root, canvas_size=(720, 1280)):
    """root 为 cc.Node 树的根（通常是 Canvas）；也可传 list（多个场景级根，如常驻节点）"""
    roots = root if isinstance(root, (list, tuple)) else [root]
    arr = [
        {
            '__type__': 'cc.SceneAsset',
            '_name': name,
            '_objFlags': 0,
            '__editorExtras__': {},
            '_native': '',
            'scene': {'__id__': 1},
        }
    ]
    scene = {
        '__type__': 'cc.Scene',
        '_name': name,
        '_objFlags': 0,
        '__editorExtras__': {},
        '_parent': None,
        '_children': [{'__id__': 2}],
        '_active': True,
        '_components': [],
        '_prefab': None,
        '_lpos': V3(0, 0, 0),
        '_lrot': Quat(),
        '_lscale': V3(1, 1, 1),
        '_mobility': 0,
        '_layer': 1073741824,
        '_euler': V3(0, 0, 0),
        'autoReleaseAssets': False,
        '_globals': {'__id__': None},
        '_id': newid(),
    }
    arr.append(scene)
    body = _shift(_serialize(list(roots)), 2)  # 前面已占 0=SceneAsset, 1=Scene
    # ★ 每个根节点的 _parent 必须显式指回 Scene（序列化时它没有父节点，默认是 null）。
    #   漏了这一条，引擎会认为 Canvas 没 attach 到场景：node.scene === null，
    #   于是整棵树的 UITransform.hitTest 抛 `Cannot read properties of null (reading 'renderScene')`
    #   —— 表现是「画面正常、但所有点击全部失效」。
    scene_children = []
    # 从序列化结果里找每个根对象（_parent 为 None 的 cc.Node）
    for i, o in enumerate(body):
        if o.get('__type__') == 'cc.Node' and o.get('_parent') is None:
            o['_parent'] = {'__id__': 1}
            scene_children.append({'__id__': i + 2})
    for o in body:
        arr.append(o)
    scene['_children'] = scene_children
    gi = len(arr)
    arr.append({'__type__': 'cc.SceneGlobals',
                'ambient': {'__id__': gi + 1},
                'shadows': {'__id__': gi + 2},
                '_skybox': {'__id__': gi + 3},
                'fog': {'__id__': gi + 4}})
    arr.append({'__type__': 'cc.AmbientInfo',
                '_skyLightingColor': {'__type__': 'cc.Vec4', 'x': 0.2, 'y': 0.2, 'z': 0.2, 'w': 1}})
    arr.append({'__type__': 'cc.ShadowsInfo'})
    arr.append({'__type__': 'cc.SkyboxInfo'})
    arr.append({'__type__': 'cc.FogInfo'})
    scene['_globals'] = {'__id__': gi}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(arr, f, ensure_ascii=False, indent=2)
    return path


def write_prefab(path, name, root):
    arr = [{
        '__type__': 'cc.Prefab',
        '_name': name,
        '_objFlags': 0,
        '__editorExtras__': {},
        '_native': '',
        'data': {'__id__': 1},
        'optimizationPolicy': 0,
        'persistent': False,
    }]
    body = _shift(_serialize([root], prefab_info=True), 1)  # 前面已占 0=Prefab
    # ⚠️ prefab 里所有 node / component 的 _id 必须是**空字符串**（对照参考工程 463 个
    #    节点全部为空；而 .scene 里是真 uuid）。写成随机 id 编辑器会当成脏数据打不开。
    for o in body:
        if '_id' in o:
            o['_id'] = ''
    for o in body:
        arr.append(o)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(arr, f, ensure_ascii=False, indent=2)
    return path


def ensure_meta(path, type_='prefab', name=None):
    """生成 meta。字段照抄编辑器真产物（缺 files / syncNodeName 会导入异常）：
    ver 1.1.50、imported true、files [".json"]、userData.syncNodeName = 根节点名。"""
    p = path + '.meta'
    nm = name or os.path.splitext(os.path.basename(path))[0]
    d = {}
    if os.path.exists(p):
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            d = {}
    # 保留已有 uuid：别的地方可能按 uuid 引用它，重分配会静默断链
    d.setdefault('uuid', str(_uuid.uuid4()))
    d['ver'] = '1.1.50'
    d['importer'] = type_
    d['imported'] = True
    d['files'] = ['.json']
    d['subMetas'] = {}
    d.setdefault('userData', {})
    d['userData']['syncNodeName'] = nm
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    return p
