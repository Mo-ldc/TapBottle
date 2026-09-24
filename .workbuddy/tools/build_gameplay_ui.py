# -*- coding: utf-8 -*-
"""
向现有 Game.scene **追加**玩法 UI 子树（场景实体化第二阶段）。

对照各组件 construct()（场景兜底搭建）逐节点镜像：
  hudRoot      ← Hud.construct()          顶栏：返回/双筹码/三工具/体力条/状态行
  navRoot      ← Abilities.construct()    abilityBar 三能力按钮
  belt         ← CapMachine.construct()   木轨/履带面/出售箱/入料机/闸门/在途计数
  bottomPanel  ← BottomPanel.construct()  三页签/下拉框/内嵌面板+滚动区
  adRoot       ← AdButtons.construct()    三块广告增益牌

规则（与 fit_game_scene.py 一致）：只追加、不删除/不重排 —— __id__ 是数组下标。
Graphics 画的部件在场景版用九宫格/纯色 Sprite 替代（外观等价）：
  woodRail 描边 → nine_stroke 叠加；beltFace → px_white2 + slat 子节点 + nine_stroke；
  feeder 滚轮 → px_white2 + slats + nine_stroke；chev/播放三角 → 新贴图 tri_down/tri_play。

用法：<py> .workbuddy/tools/build_gameplay_ui.py [--dry]
"""
import json
import os
import shutil
import sys
import uuid as _uuid

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_scene import (Node, UITransform, Sprite, Label, ScrollView, Mask,
                       Graphics, GraphicsHole, _serialize)

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
os.chdir(ROOT)
TEX = os.path.join(ROOT, 'assets', 'resources', 'Textures')
SCENE = os.path.join(ROOT, 'assets', 'Scenes', 'Game.scene')

# ---------------- 常量（与 GameConfig.ts / BottomPanel.ts 严格一致） ----------------
LAYOUT = dict(barY=520, barH=134, backX=-287, backSize=96,
              chipH=58, chipW=169, coinChipX=-96.5, capChipX=96.5,
              toolX=214, toolStepX=52, toolSize=52, statusY=386,
              abilityY=-136, navY=-356, navH=72, panelY=-508, panelH=216)
MACHINE = dict(binW=150, binH=148, binX=-252, beltW=340, beltH=86,
               feederW=150, feederH=148, feederX=252,
               beltEntryX=160, beltExitX=-160, gateAt=0.46,
               railW=654, railH=32, railY=59)
PANEL_W, SCROLL_W, SCROLL_H = 708, 664, 170

WOOD = dict(line='#4A2C14', cream='#F6E3C5', creamDark='#E3C79C',
            gold='#F2C34E', goldHi='#FFE79A', plate='#5C2E12',
            text='#5A3210', textOn='#FFF6E0', belt='#43434C',
            beltSlat='#35353D', green='#96D07E')

NINE = dict(plate=('ui/nine/nine_base', 'ui/nine/nine_gloss', 'ui/nine/nine_stroke'),
            chip=('ui/nine/nine_chip', 'ui/nine/nine_chip_gloss', 'ui/nine/nine_chip_stroke'))


def C(s, a=255):
    """'#RRGGBB' / '#RRGGBBAA' → (r,g,b,a)"""
    s = s.lstrip('#')
    r, g, b = int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    return (r, g, b, int(s[6:8], 16) if len(s) >= 8 else a)


_SF_CACHE = {}


def SF(rel):
    """'ui/nine/nine_base' → spriteFrame uuid 引用"""
    if rel not in _SF_CACHE:
        meta = json.load(open(os.path.join(TEX, rel + '.png.meta'), encoding='utf-8'))
        _SF_CACHE[rel] = meta['uuid'] + '@f9941'
    return _SF_CACHE[rel]


# ---------------- 节点小助手（镜像 Theme.ts / UIKit.ts 行为） ----------------
def node(name, w, h, x=0, y=0, ax=0.5, ay=0.5, scale=1.0, active=True):
    n = Node(name, x, y, w, h, ax=ax, ay=ay, scale=scale, active=active)
    n.attach(UITransform(w, h, ax=ax, ay=ay))
    return n


def spr(parent, rel, w, h, x=0, y=0, color=None, sliced=False, name=None,
        ax=0.5, ay=0.5, active=True):
    n = node(name or rel, w, h, x, y, ax=ax, ay=ay, active=active)
    n.attach(Sprite(SF(rel), type_=(1 if sliced else 0),
                    color=(C(color) if color else (255, 255, 255, 255))))
    parent.add(n)
    return n


def nine_plate(parent, name, w, h, x, y, fill, skin='plate',
               gloss=True, inner=None, line=WOOD['line'], active=True):
    """镜像 Theme.woodPlate：base(染 fill) + gloss + [inner] + stroke(染 line)"""
    base, gloss_t, stroke_t = NINE[skin]
    n = node(name, w, h, x, y, active=active)
    n.attach(Sprite(SF(base), type_=1, color=C(fill)))
    parent.add(n)
    if gloss:
        g = node('gloss', w, h)
        g.attach(Sprite(SF(gloss_t), type_=1))
        n.add(g)
    if inner:
        i = node('inner', w - 10, h - 10)
        i.attach(Sprite(SF(stroke_t), type_=1, color=C(inner)))
        n.add(i)
    if line != '':
        s = node('stroke', w, h)
        s.attach(Sprite(SF(stroke_t), type_=1, color=C(line)))
        n.add(s)
    return n


def text(parent, name, s, size, w, h, x, y, color, outline=None, ow=2,
         align=1, overflow=0, ax=0.5, ay=0.5, active=True):
    """镜像 UIKit.label：盒子×2、节点 scale 0.5（2K 超采样）、fontSize×2。
    align: 0=LEFT 1=CENTER 2=RIGHT ; overflow: 0=NONE 1=CLAMP 2=SHRINK"""
    ss = 2
    n = node(name, w * ss, h * ss, x, y, ax=ax, ay=ay, scale=1.0 / ss, active=active)
    n.attach(Label(s, size=size * ss, color=C(color), w=w * ss, h=h * ss,
                   bold=True, align=align, valign=1, overflow=overflow,
                   line_height=size * 1.15 * ss,
                   outline=(C(outline) if outline else None), outline_w=ow))
    parent.add(n)
    return n


def px(parent, name, w, h, x, y, color, ax=0.5, ay=0.5, active=True):
    return spr(parent, 'ui/pixel/px_white2', w, h, x, y, color=color,
               name=name, ax=ax, ay=ay, active=active)


# ---------------- 各子树（逐节点对照 construct()） ----------------
def build_hud():
    """Hud.construct() —— 挂 hudRoot"""
    Y = LAYOUT['barY']
    root = Node('__hud__', 0, 0)          # 占位根（append 时剥掉）
    kids = []

    # 返回按钮
    back = nine_plate(root, 'btn_back', 96, 96, LAYOUT['backX'], Y, WOOD['cream'])
    spr(back, 'ui/icon/icon_back', 48, 48, -8.64, 0, color='#E8912E', name='icon')
    kids.append(back)

    # 金币筹码
    kids.append(nine_plate(root, 'chipCoin', 169, 58, -96.5, Y, WOOD['plate'], skin='chip'))
    kids.append(spr(root, 'ui/icon/coin', 64, 64, -142, Y, name='coinIcon'))
    kids.append(text(root, 'moneyLb', '$0', 28, 105, 42, -74.5, Y + 2,
                     '#FFFFFF', outline=WOOD['line'], ow=3, overflow=2))

    # 瓶盖筹码
    kids.append(nine_plate(root, 'chipCap', 169, 58, 96.5, Y, WOOD['plate'], skin='chip'))
    kids.append(spr(root, 'bottle/capchip_6', 62, 60, 41, Y, name='capIcon'))
    kids.append(text(root, 'capsLb', '0', 28, 105, 42, 118.5, Y + 2,
                     '#FFFFFF', outline=WOOD['line'], ow=3, overflow=2))

    # 右端工具按钮
    for i, (nm, icon) in enumerate([('tool_ach', 'ui/icon/icon_ach'),
                                    ('tool_stats', 'ui/icon/icon_stat'),
                                    ('tool_lang', '')]):
        b = nine_plate(root, nm, 52, 52, LAYOUT['toolX'] + i * LAYOUT['toolStepX'], Y,
                       WOOD['cream'])
        if icon:
            spr(b, icon, 34, 34, -0.68, 0, color='#7A4A1E', name='icon')
        else:
            text(b, 'langLb', '中', 25, 48, 40, 0, 1, WOOD['text'])
        kids.append(b)

    # 体力条（默认隐藏）
    stam = px(root, 'stam', 300, 12, 0, Y - LAYOUT['barH'] / 2 + 14, '#3A220CCC', active=False)
    px(stam, 'fill', 296, 8, -148, 0, '#8FCF7A', ax=0, ay=0.5)
    kids.append(stam)

    # 状态行（默认隐藏）
    kids.append(text(root, 'berserkLb', '', 23, 420, 34, 0, LAYOUT['statusY'],
                     '#FFE0B0', outline=WOOD['line'], ow=2, active=False))
    return kids


def build_ability_bar():
    """Abilities.construct() —— 挂 navRoot"""
    root = Node('__ab__', 0, 0)
    bar = node('abilityBar', 700, 110, 0, LAYOUT['abilityY'])
    root.add(bar)
    for aid, icon in [('coke', 'ability/flyingcoke'), ('berserk', 'ability/berserk'),
                      ('samurai', 'ability/samurai')]:
        n = node('ab_' + aid, 104, 104, active=False)
        bar.add(n)
        spr(n, 'ui/panel/card_white', 104, 104, sliced=True, color='#2E3B52', name='bg')
        spr(n, icon, 66, 66, 0, 8, name='icon')
        cd = px(n, 'cd', 92, 96, 0, 46, '#0B0F16CC', ay=1)
        text(n, 'lb', '', 22, 90, 40, 0, -8, '#FFE9A8', outline='#101620', ow=2)
    return [bar]


def build_belt():
    """CapMachine.construct() —— 挂 belt"""
    bh = MACHINE['beltH']
    root = Node('__belt__', 0, 0)
    kids = []

    # 木轨 ×2（描边用 nine_stroke 替代 Graphics）
    for nm, y in [('railTop', MACHINE['railY']), ('railBot', -MACHINE['railY'])]:
        r = node(nm, MACHINE['railW'], MACHINE['railH'], 0, y)
        r.attach(Sprite(SF('ui/deco/wood_rail'), color=C('#D8914A')))
        root.add(r)
        s = node('stroke', MACHINE['railW'], MACHINE['railH'])
        s.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C(WOOD['line'])))
        r.add(s)
        kids.append(r)

    # 履带面：纯色底 + 履带节竖条 + 描边（原 Graphics → Sprite 组合）
    belt = px(root, 'belt', MACHINE['beltW'], bh, 0, 0, WOOD['belt'])
    st = node('stroke', MACHINE['beltW'], bh)
    st.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C(WOOD['line'])))
    belt.add(st)
    px0 = -MACHINE['beltW'] / 2 + 24
    while px0 < MACHINE['beltW'] / 2 - 8:
        px(belt, 'slat', 3, bh - 14, px0, 0, WOOD['beltSlat'])
        px0 += 42
    kids.append(belt)

    # 出售箱（左）
    b = node('bin', MACHINE['binW'], MACHINE['binH'], MACHINE['binX'], 0)
    root.add(b)
    nine_plate(b, 'wood', 150, 148, 0, 0, '#C98A46')
    nine_plate(b, 'face', 132, 130, 0, 0, '#D9A05C', gloss=False)
    nine_plate(b, 'screen', 100, 58, 0, 26, WOOD['green'])
    spr(b, 'bottle/capchip_0', 36, 32, 0, 26, name='capIcon')
    nine_plate(b, 'slot', 92, 30, 0, -42, '#5C2E12', gloss=False)
    kids.append(b)

    # 入料机（右）：滚轮 = 纯色底 + 辊条 + 描边
    f = node('feeder', MACHINE['feederW'], MACHINE['feederH'], MACHINE['feederX'], 0)
    root.add(f)
    nine_plate(f, 'wood', 150, 148, 0, 0, '#C98A46')
    roll = px(f, 'roll', 116, 102, 0, 0, '#3A3A42')
    rs = node('stroke', 116, 102)
    rs.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C(WOOD['line'])))
    roll.add(rs)
    sx = -58 + 12
    while sx < 52:
        px(roll, 'slat', 3, 90, sx, 0, '#565660')
        sx += 16
    for dy in (1, -1):
        nine_plate(f, 'axle', 124, 18, 0, dy * 60, '#A9702F', gloss=False)
    kids.append(f)

    # 双倍闸门（x 运行时由 MACHINE.gateAt 重设）
    gx = 160 + (-160 - 160) * 0.46
    g = px(root, 'gate', 22, bh, gx, 0, '#E8C860D2')
    for dy in (1, -1):
        px(g, 'post', 30, 26, 0, dy * (bh / 2 - 6), WOOD['gold'])
    kids.append(g)

    # 在途计数
    kids.append(text(root, 'binLb', '', 27, 170, 40, MACHINE['binX'], MACHINE['binH'] / 2 + 6,
                     '#FFF3D0', outline=WOOD['line'], ow=3))

    # 瓶盖池容器（池节点运行时建在里面）
    chips = node('chips', 1100, 900)
    root.add(chips)
    kids.append(chips)
    return kids


def build_bottom_panel():
    """BottomPanel.construct() —— 挂 bottomPanel"""
    H, Y = LAYOUT['navH'], LAYOUT['navY']
    W1, W2, W3, W4 = 142, 142, 162, 236
    x0 = -(W1 + W2 + W3 + W4 + 24) / 2
    shopX = x0 + W1 / 2
    upX = shopX + W1 / 2 + 8 + W2 / 2
    treeX = upX + W2 / 2 + 8 + W3 / 2
    ddX = treeX + W3 / 2 + 8 + W4 / 2
    root = Node('__bp__', 0, 0)
    kids = []

    def tab_new(parent, w):
        tg = node('tabNew', 40, 26, w / 2 - 20, H / 2 - 10, active=False)
        parent.add(tg)
        px(tg, 'bg', 40, 26, 0, 0, '#E8556D')
        s = node('stroke', 40, 26)
        s.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C('#7A1E33')))
        tg.add(s)
        text(tg, 'label', '新', 14, 36, 22, 0, 1, '#FFF3D0', overflow=2)

    def mk_tab(nm, x, w, icon, fill, label_txt):
        t = nine_plate(root, nm, w, H, x, Y, fill)
        spr(t, icon, 42, 42, -w / 2 + 34, 0, name='icon')
        text(t, 'label', label_txt, 26, w - 62, H, 12, 2, WOOD['text'],
             outline='#FFF3D6', ow=3)
        tab_new(t, w)
        kids.append(t)

    mk_tab('tab_shop', shopX, W1, 'ui/icon/icon_shop2', WOOD['gold'], '商店')
    mk_tab('tab_up', upX, W2, 'ui/icon/icon_upgrade', WOOD['cream'], '升级')
    mk_tab('tab_tree', treeX, W3, 'ui/icon/icon_medal', WOOD['cream'], '技能树')

    # 下拉框（只有技能树页签显示）
    dd = nine_plate(root, 'dropdown', W4, H, ddX, Y, WOOD['creamDark'], active=False)
    text(dd, 'ddLb', '', 24, W4 - 76, H, -26, 2, WOOD['text'], overflow=2)
    spr(dd, 'ui/misc/tri_down', 30, 20, W3 / 2 - 26, 0, color=WOOD['text'], name='chev')
    nt = node('newTag', 46, 30, W4 / 2 - 16, H / 2 - 4, active=False)
    dd.add(nt)
    px(nt, 'bg', 46, 30, 0, 0, '#E8556D')
    s = node('stroke', 46, 30)
    s.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C('#7A1E33')))
    nt.add(s)
    text(nt, 'label', '新', 16, 42, 24, 0, 1, '#FFF3D0', overflow=2)
    kids.append(dd)

    # 内嵌面板
    p = node('panel', PANEL_W, LAYOUT['panelH'], 0, LAYOUT['panelY'])
    root.add(p)
    bg = node('bg', PANEL_W, LAYOUT['panelH'])
    bg.attach(Sprite(SF('ui/nine/nine_base'), type_=1, color=C('#EFDCBB')))
    p.add(bg)
    bs = node('stroke', PANEL_W, LAYOUT['panelH'])
    bs.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C('#4A2C14')))
    bg.add(bs)
    inner = node('inner', PANEL_W - 12, LAYOUT['panelH'] - 12)
    inner.attach(Sprite(SF('ui/nine/nine_base'), type_=1, color=C('#F4E4C6')))
    p.add(inner)
    ins = node('stroke', PANEL_W - 12, LAYOUT['panelH'] - 12)
    ins.attach(Sprite(SF('ui/nine/nine_stroke'), type_=1, color=C('#D8BF94')))
    inner.add(ins)

    top = LAYOUT['panelH'] / 2
    text(p, 'hintLb', '', 18, 440, 26, -PANEL_W / 2 + 18, top - 21, '#7A4210',
         align=0, overflow=2, ax=0, ay=0.5)
    text(p, 'msLb', '', 17, 200, 26, PANEL_W / 2 - 18, top - 21, '#8A6134',
         align=2, overflow=2, ax=1, ay=0.5)

    # 滚动区（view 带 GRAPHICS_RECT 遮罩 + 配套 Graphics）
    sc = node('scroll', SCROLL_W, SCROLL_H, 0, -15)
    p.add(sc)
    view = node('view', SCROLL_W, SCROLL_H)
    view.attach(Mask(type_=0))
    view.attach(GraphicsHole())
    sc.add(view)
    content = node('content', SCROLL_W, 10, 0, SCROLL_H / 2, ax=0.5, ay=1)
    view.add(content)
    sc.attach(ScrollView(content))
    # 滚动指示条（panel 的子节点，在视口外）
    sbar = px(p, 'sbar', 6, SCROLL_H - 24, SCROLL_W / 2 + 12, -15, '#FFFFFF1C')
    px(sbar, 'thumb', 6, 48, 0, 0, '#C8A44A', active=False)
    kids.append(p)
    return kids


def build_ad_buttons():
    """AdButtons.construct() —— 挂 adRoot"""
    X = -288
    root = Node('__ad__', 0, 0)
    kids = []
    for kind, icon, y, txt in [('coin', 'ui/icon/coin', 152, '金币翻倍'),
                               ('cap', 'bottle/capchip_6', 24, '瓶盖翻倍'),
                               ('halo', 'env/cursor', -104, '光圈变大')]:
        plate = nine_plate(root, 'ad_' + kind, 136, 116, X, y, WOOD['gold'],
                           inner=WOOD['goldHi'])
        spr(plate, icon, 50, 50, 0, 26, name='icon')
        text(plate, 'label', txt, 21, 120, 28, 0, -8, WOOD['text'])
        # 广告角标（原 Graphics 圆角牌 → nine_chip + stroke + 播放三角 + 文字）
        tag = node('adTag', 62, 26, 68 - 31 - 4, -58 + 13 + 4)
        tag.attach(Sprite(SF('ui/nine/nine_chip'), type_=1, color=C(WOOD['plate'])))
        plate.add(tag)
        ts = node('stroke', 62, 26)
        ts.attach(Sprite(SF('ui/nine/nine_chip_stroke'), type_=1, color=C(WOOD['goldHi'])))
        tag.add(ts)
        spr(tag, 'ui/misc/tri_play', 14, 16, -17, 0, name='tri')
        text(tag, 'label', '广告', 15, 36, 22, 8, 1, WOOD['textOn'])
        # 倒计时盖层（默认隐藏）
        dim = px(plate, 'dim', 136, 116, 0, 0, '#2A1608CC', active=False)
        text(dim, 'label', '', 30, 126, 40, 0, 0, '#FFE9A8', outline='#1B0E04', ow=3)
        kids.append(plate)
    return kids


# ---------------- 场景写入 ----------------
def shift_ids(o, off):
    if isinstance(o, dict):
        for k, v in list(o.items()):
            if k == '__id__' and isinstance(v, int) and v >= 0:
                o[k] = v + off
            else:
                shift_ids(v, off)
    elif isinstance(o, list):
        for v in o:
            shift_ids(v, off)


def append_kids(arr, parent_idx, kids):
    """把 kids（同一逻辑父下的兄弟列表）序列化后追加进 arr，挂到 parent_idx。"""
    holder = Node('__holder__', 0, 0)
    for k in kids:
        holder.add(k)
    body = _serialize([holder])[1:]      # 丢弃 holder 本身（下标 0）
    off = len(arr)
    for o in body:
        shift_ids(o, -1)                 # 摘掉 holder 占的 0 号位
    for o in body:
        shift_ids(o, off)                # 对齐到 arr 绝对下标
    for o in body:
        arr.append(o)
    # 子树根 = _parent 仍指向 holder。shift_ids 跳过负数 → holder 的孩子平移后是 -1
    n_roots = 0
    for i, o in enumerate(body):
        if (o.get('__type__') == 'cc.Node'
                and isinstance(o.get('_parent'), dict)
                and o['_parent'].get('__id__') == -1):
            o['_parent'] = {'__id__': parent_idx}
            arr[parent_idx].setdefault('_children', []).append({'__id__': off + i})
            n_roots += 1
    assert n_roots == len(kids), f'roots {n_roots} != kids {len(kids)}'


def find_node(arr, name):
    hits = [i for i, o in enumerate(arr)
            if o.get('__type__') == 'cc.Node' and o.get('_name') == name]
    assert len(hits) == 1, f'node {name}: hits={hits}'
    return hits[0]


# ---------------- 新贴图（tri_down / tri_play）+ meta ----------------
def gen_tri_textures():
    from PIL import Image, ImageDraw

    def write_meta(path, w, h):
        u = str(_uuid.uuid4())
        hw, hh = w / 2.0, h / 2.0
        meta = {
            'ver': '1.0.27', 'importer': 'image', 'imported': True, 'uuid': u,
            'files': ['.json', '.png'],
            'subMetas': {
                '6c48a': {
                    'importer': 'texture', 'uuid': u + '@6c48a', 'displayName': '',
                    'id': '6c48a', 'name': 'texture',
                    'userData': {
                        'wrapModeS': 'clamp-to-edge', 'wrapModeT': 'clamp-to-edge',
                        'imageUuidOrDatabaseUri': u, 'isUuid': True, 'visible': False,
                        'minfilter': 'linear', 'magfilter': 'linear', 'mipfilter': 'none',
                        'anisotropy': 0,
                    },
                    'ver': '1.0.22', 'imported': True, 'files': ['.json'], 'subMetas': {},
                },
                'f9941': {
                    'importer': 'sprite-frame', 'uuid': u + '@f9941', 'displayName': '',
                    'id': 'f9941', 'name': 'spriteFrame',
                    'userData': {
                        'trimThreshold': 1, 'rotated': False, 'offsetX': 0, 'offsetY': 0,
                        'trimX': 0, 'trimY': 0, 'width': w, 'height': h,
                        'rawWidth': w, 'rawHeight': h,
                        'borderTop': 0, 'borderBottom': 0, 'borderLeft': 0, 'borderRight': 0,
                        'packable': True, 'pixelsToUnit': 100, 'pivotX': 0.5, 'pivotY': 0.5,
                        'meshType': 0,
                        'vertices': {
                            'rawPosition': [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0],
                            'indexes': [0, 1, 2, 2, 1, 3],
                            'uv': [0, h, w, h, 0, 0, w, 0],
                            'nuv': [0, 0, 1, 0, 0, 1, 1, 1],
                            'minPos': [-hw, -hh, 0], 'maxPos': [hw, hh, 0],
                        },
                        'isUuid': True, 'imageUuidOrDatabaseUri': u + '@6c48a',
                        'atlasUuid': '', 'trimType': 'auto',
                    },
                    'ver': '1.0.12', 'imported': True, 'files': ['.json'], 'subMetas': {},
                },
            },
            'userData': {
                'type': 'sprite-frame', 'fixAlphaTransparencyArtifacts': False,
                'hasAlpha': True, 'redirect': u + '@6c48a',
            },
        }
        for sub in meta['subMetas'].values():
            sub['displayName'] = os.path.splitext(os.path.basename(path))[0]
        with open(path + '.meta', 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    misc = os.path.join(TEX, 'ui', 'misc')
    os.makedirs(misc, exist_ok=True)
    # tri_down：下指三角（chevron），28×16，顶点 (-14,7)(14,7)(0,-9) → 图内 y 翻转
    p = os.path.join(misc, 'tri_down.png')
    if not os.path.exists(p):
        img = Image.new('RGBA', (28, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.polygon([(0, 0), (28, 0), (14, 16)], fill=(255, 255, 255, 255))
        img.save(p)
        write_meta(p, 28, 16)
        print('gen', p)
    # tri_play：播放三角，10×12，顶点 (0,0)(0,12)(10,6)
    p = os.path.join(misc, 'tri_play.png')
    if not os.path.exists(p):
        img = Image.new('RGBA', (10, 12), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.polygon([(0, 0), (0, 12), (10, 6)], fill=(255, 255, 255, 255))
        img.save(p)
        write_meta(p, 10, 12)
        print('gen', p)


def patch_card_white():
    """card_white 补九宫格边距 26（运行时 sliced() 会补，场景 SLICED 需要 meta 有）"""
    p = os.path.join(TEX, 'ui', 'panel', 'card_white.png.meta')
    meta = json.load(open(p, encoding='utf-8'))
    hit = 0
    for sub in meta.get('subMetas', {}).values():
        if sub.get('importer') == 'sprite-frame':
            ud = sub.setdefault('userData', {})
            if ud.get('borderLeft') != 26:
                ud['borderLeft'] = ud['borderRight'] = ud['borderTop'] = ud['borderBottom'] = 26
                hit += 1
    if hit:
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print('patched card_white borders x', hit)


def validate(arr):
    n = len(arr)
    for i, o in enumerate(arr):
        def walk(v):
            if isinstance(v, dict):
                for k, x in v.items():
                    if k == '__id__':
                        assert isinstance(x, int) and 0 <= x < n, f'[{i}] bad __id__ {x}'
                    else:
                        walk(x)
            elif isinstance(v, list):
                for x in v:
                    walk(x)
        walk(o)
        if o.get('__type__') == 'cc.Node':
            for c in o.get('_children', []):
                assert arr[c['__id__']].get('_parent', {}).get('__id__') == i, \
                    f'[{i}] child/parent mismatch'
            for c in o.get('_components', []):
                assert arr[c['__id__']].get('node', {}).get('__id__') == i, \
                    f'[{i}] comp/node mismatch'
    print('validate ok:', n, 'objects')


def main():
    dry = '--dry' in sys.argv
    gen_tri_textures()
    patch_card_white()

    arr = json.load(open(SCENE, encoding='utf-8'))
    # 幂等：已摆过就跳过
    names = {o.get('_name') for o in arr if o.get('__type__') == 'cc.Node'}
    if 'btn_back' in names:
        print('already built (btn_back exists) — skip')
        return

    pairs = [
        ('hudRoot', build_hud()),
        ('navRoot', build_ability_bar()),
        ('belt', build_belt()),
        ('bottomPanel', build_bottom_panel()),
        ('adRoot', build_ad_buttons()),
    ]
    for pname, kids in pairs:
        pi = find_node(arr, pname)
        if dry:
            print(f'[dry] {pname} ← {len(kids)} nodes')
            continue
        append_kids(arr, pi, kids)
        print(f'{pname} ← {len(kids)} top nodes')

    if dry:
        return
    validate(arr)

    bak = os.path.join(ROOT, '.workbuddy', 'scene_bak')
    os.makedirs(bak, exist_ok=True)
    shutil.copy2(SCENE, os.path.join(bak, 'Game.scene.pre-gameplay-ui.json'))
    with open(SCENE, 'w', encoding='utf-8') as f:
        json.dump(arr, f, ensure_ascii=False, indent=2)
    print('written:', SCENE, os.path.getsize(SCENE), 'bytes')
    print('backup: .workbuddy/scene_bak/Game.scene.pre-gameplay-ui.json')


if __name__ == '__main__':
    main()
