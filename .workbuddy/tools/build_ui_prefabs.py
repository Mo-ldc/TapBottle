#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 assets/resources/Prefabs/UI/<Name>.prefab —— 把 UI 从「运行时代码画」
迁到「预制体」。

⚠️ 2026-09-24 目录重组后，UI 预制体统一放 `resources/Prefabs/UI/`（脚本在
`assets/Scripts/UI/`，贴图在 `resources/Textures/ui/<sub>/`），不再按界面分目录。

为什么托管╃放 resources/ 下：`UIMgr` 走 `resources.load()`，它只认 resources。
后续想切 Asset Bundle 只需把目录挪出 resources 并改 UIMgr.UI_ROOT。

布局常量全部照搬旧运行时代码（Scripts/UI/Panel.ts / SettingsPanel.ts / StatsPanel.ts /
AchPanel.ts / Hud.showOffline / SettingsPanel.confirmNewGame），保证视觉 1:1 ——
这次改的是**组织方式**，不是外观。

⚠️ 三个硬性规则（踩过，见 Memory.md）：
  1. 脚本组件的 __type__ 必须是编译期 cid（scan_cid.py 扫 temp/programming），不是脚本 uuid；
  2. 一个节点只能挂一个渲染组件 —— 底板/高光/描边必须各占一个子节点；
  3. Label 走 UIKit 的 TEXT_SS=2 超采样：盒子 ×2、fontSize ×2、节点 scale 0.5。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
os.chdir(ROOT)

from gen_scene import (  # noqa: E402
    Node, UITransform, Sprite, Label, Script, UIOpacity, Widget,
    Mask, GraphicsHole, Layout, BlockInputEvents, ScrollView,
    write_prefab, ensure_meta, W_ALL,
)
from scan_cid import load as load_cid  # noqa: E402
from _tex_uuid import build as build_tex  # noqa: E402
from _locale_zh import build as build_locale  # noqa: E402

CID = load_cid()
TEX = build_tex()
LOC = build_locale()

OUT = os.path.join(ROOT, 'assets', 'resources', 'Prefabs', 'UI')

# 字体：assets/resources/Fonts/NotoSansSC-Bold.ttf（Res.ts 运行时加载的那一款）
FONT = '564fae0f-064e-41b3-a04d-5b55b7ea9e32'

SS = 2          # 文字超采样倍率，必须与 UIKit.TEXT_SS 严格一致
PANEL_W, PANEL_H, BODY_W = 692, 1080, 640
SCROLL_TOP = PANEL_H / 2 - 120
TOP_PAD = 30

NINE = {
    'plate': ('Textures/ui/nine_base', 'Textures/ui/nine_gloss', 'Textures/ui/nine_stroke'),
    'chip': ('Textures/ui/nine_chip', 'Textures/ui/nine_chip_gloss', 'Textures/ui/nine_chip_stroke'),
}

# 木纹皮肤取色（与 Scripts/UI/Theme.ts 的 WOOD 一致）
CREAM = '#F6E3C5'
CREAM_DARK = '#E3C79C'
WOOD_LINE = '#4A2C14'
WOOD_TEXT = '#5A3210'
PLATE = '#5C4420'
PLATE_DARK = '#33240F'
GOLD = '#F2C34E'
GOLD_DARK = '#C9902C'
CREAM_HI = '#FFF7E6'
DANGER = '#C05B3C'


# ------------------------------------------------------------------ 工具
def hx(s):
    """'#RRGGBB' / '#RRGGBBAA' → (r,g,b,a)"""
    s = s.lstrip('#')
    if len(s) == 6:
        s += 'FF'
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), int(s[6:8], 16))


def nd(parent, name, w, h, x=0, y=0, ax=0.5, ay=0.5, active=True):
    n = Node(name, x, y, w, h, ax, ay, active=active)
    n.attach(UITransform(w, h, ax, ay))
    if parent is not None:
        parent.add(n)
    return n


def plate9(parent, name, w, h, x=0, y=0, fill=CREAM, stroke=WOOD_LINE,
           inner=None, skin='plate', gloss=True):
    """木质圆角面板：底色九宫格 + 顶部高光 + 描边（各占一个子节点）。"""
    base, gloss_t, stroke_t = NINE[skin]
    n = nd(parent, name, w, h, x, y)
    n.attach(Sprite(TEX[base], type_=1, size_mode=0, color=hx(fill)))
    if gloss:
        nd(n, 'gloss', w, h).attach(Sprite(TEX[gloss_t], type_=1, size_mode=0))
    if inner:
        nd(n, 'inner', w - 10, h - 10).attach(Sprite(TEX[stroke_t], type_=1, size_mode=0, color=hx(inner)))
    if stroke:
        nd(n, 'stroke', w, h).attach(Sprite(TEX[stroke_t], type_=1, size_mode=0, color=hx(stroke)))
    return n


def img(parent, name, tex, w, h, x=0, y=0, color=None):
    n = nd(parent, name, w, h, x, y)
    n.attach(Sprite(TEX[tex], type_=0, size_mode=0, color=hx(color) if color else (255, 255, 255, 255)))
    return n


def zh(key, fallback=''):
    """取 Locale 里的中文文案。"""
    e = LOC.get(key)
    return e['zh'] if e else fallback


def lbl(parent, name, text, x, y, w, h, size=28, color='#FFFFFF', align=1, valign=1,
        overflow=0, outline=None, outline_w=2, anchor=(0.5, 0.5), line_h=None, key=None):
    """
    ⚠️ TEXT_SS 超采样：盒子 ×SS、fontSize ×SS、节点 scale 1/SS —— 视觉尺寸不变，
    但字形按 2 倍分辨率栅格化（见 UIKit.label 的注释）。漏了 scale 字会变成两倍大。

    ⚠️ `key` 存在时必须同时给 `text`（或留空让它自动取 zh）：
       编辑器打开 prefab 会按 string 重算 Label 节点尺寸，空串会被算成 width=0。
    """
    if key:
        text = text if text else zh(key)
    w2, h2 = w * SS, h * SS
    n = Node(name, x, y, w2, h2, anchor[0], anchor[1], scale=1.0 / SS)
    n.attach(UITransform(w2, h2, anchor[0], anchor[1]))
    parent.add(n)
    lb = n.attach(Label(text, size=size * SS, color=hx(color), align=align, valign=valign,
                        overflow=overflow, line_height=(line_h or size * 1.15) * SS,
                        outline=hx(outline) if outline else None, outline_w=outline_w,
                        font_uuid=FONT, bold=True))
    if key:
        n.attach(Script(CID['LocLabel'], key=key))
    return lb


def wood_btn(parent, name, w, h, x, y, text=None, size=None, text_color=WOOD_TEXT,
             fill=CREAM, key=None):
    n = plate9(parent, name, w, h, x, y, fill=fill)
    if text is not None:
        lbl(n, 'text', text, 0, 2, w - 12, h, size=size or min(40, int(h * 0.46)),
            color=text_color, outline='#FFF3D6', outline_w=3, key=key)
    return n


def scroll(parent, name, w, h, x, y, top_pad=TOP_PAD, content_h=10):
    """竖向滚动区 + 右侧细指示条（结构照抄 UIKit.scrollView）。"""
    root = nd(parent, name, w, h, x, y)
    view = nd(root, 'view', w, h)
    view.attach(Mask(0))
    view.attach(GraphicsHole())          # GRAPHICS_RECT 遮罩必须配一个 Graphics
    content = nd(view, 'content', w, content_h, 0, h / 2 - top_pad, 0.5, 1)
    root.attach(ScrollView(content, vertical=True, horizontal=False))

    track_h = h - 24
    track = nd(parent, 'sbar', 6, track_h, x + w / 2 + 12, y)
    track.attach(Sprite(TEX['Textures/ui/px_white2'], type_=0, size_mode=0, color=(255, 255, 255, 28)))
    thumb = nd(track, 'thumb', 6, 48, 0, 0, active=False)
    thumb.attach(Sprite(TEX['Textures/ui/px_white2'], type_=0, size_mode=0, color=hx('#C8A44A')))
    return root, content, thumb


def adapted_root(name, mask_alpha=200):
    """全屏适配根（用户口径：每个 UI 自带铺满场景的适配）：

      root（挂 UIFit：尺寸同步父节点=可见区）
      ├── mask（Widget 全对齐 → 遮罩铺满整个场景，BlockInputEvents 挡穿透）
      └── fit（创作空间 720×1280 内容容器，UIFit 按 min(宽比,高比) 等比缩放居中）

    ⚠️ popIn/popOut 的 animRoot 必须指 fit **内部**的面板，不能指 fit 本身
       （动画的 setScale 会覆盖 UIFit 的适配缩放）。
    """
    root = nd(None, name, 720, 1280)
    mask = nd(root, 'mask', 720, 1280)
    mask.attach(Widget(W_ALL))
    mask.attach(Sprite(TEX['Textures/ui/px_white2'], type_=0, size_mode=0, color=(0, 0, 0, mask_alpha)))
    mask.attach(BlockInputEvents())
    fit = nd(root, 'fit', 720, 1280)
    root.attach(Script(CID['UIFit'], fitNode=fit))
    return root, mask, fit


def shell(title_key, body_h, extra=None):
    """
    标准面板外壳：适配根 + 木板 frame + 标题铭牌 + 关闭按钮 + 滚动区。
    返回 (root, mask, frame, content, ptitle, close)。
    """
    root, mask, fit = adapted_root('TMPL')
    frame = plate9(fit, 'frame', PANEL_W, PANEL_H, 0, -8, fill=CREAM, stroke='#6B3A1A')
    # ⚠️ frame 要吞掉落在自己身上的点击：否则点面板内部也会穿透到 mask 触发「点遮罩关闭」
    frame.attach(BlockInputEvents())
    plate9(frame, 'titlePlate', 380, 78, 0, PANEL_H / 2 - 58, fill='#5C4420', stroke='#3A2208')
    ptitle = lbl(frame, 'ptitle', '', 0, PANEL_H / 2 - 58, 340, 60, size=40,
                 color='#FFE9A8', outline='#2A1608', outline_w=3,
                 key=title_key if title_key else None)
    close = wood_btn(frame, 'close', 84, 84, PANEL_W / 2 - 52, PANEL_H / 2 - 54)
    img(close, 'icon', 'Textures/ui/btn_close', 46, 46)
    _, content, _ = scroll(frame, 'scroll', BODY_W, body_h, 0, SCROLL_TOP - body_h / 2)
    void(extra)
    return root, mask, frame, content, ptitle, close


def comp_of(node, type_):
    """按 __type__ 取节点上的组件。

    ⚠️ 不要写 `node.components[0]`：plate9 出来的节点第 0 个是 UITransform，
       取错会拿到 UT 去当 Sprite/脚本引用，运行时 isinstance 断言失败、
       或者更糟 —— 静默拿到错误对象的引用而没有任何报错。
    """
    for c in node.components:
        if c.type_ == type_:
            return c
    return None


def void(_x):
    return _x


# ------------------------------------------------------------------ 设置面板
def setting_dialog():
    body_h = 860
    root, mask, frame, C, _, close = shell('settings', body_h)
    root.name = 'SettingDialog'

    rows_y = []
    y = -12

    def section(yy, key):
        plate9(C, 'secTick', 12, 30, -300, yy, fill='#8A5A20', stroke=None, gloss=False)
        lbl(C, 'sec', '', -284, yy, 300, 40, size=28, color='#7A4210', align=0,
            anchor=(0, 0.5), key=key)
        return yy - 78

    # ---- 显示：三个开关 ----
    y = section(y, 'display')
    toggles = []
    for k in ('hide_income', 'hide_caps', 'hide_hand'):
        card = plate9(C, 'toggle_' + k, 620, 88, 0, y, fill=PLATE)
        tcomp = card.attach(Script(CID['ToggleRow'], knobOnX=267, knobOffX=213,
                                   onColor={'__type__': 'cc.Color', 'r': 242, 'g': 195, 'b': 78, 'a': 255},
                                   offColor={'__type__': 'cc.Color', 'r': 51, 'g': 36, 'b': 15, 'a': 255}))
        tl = lbl(card, 'title', '', -280, 0, 380, 50, size=26, color='#F1E0C0', align=0,
                 anchor=(0, 0.5), key=k)
        tcomp.fields['titleLb'] = tl
        plate9(card, 'track', 110, 54, 240, 0, fill=PLATE_DARK, stroke='#1E1408', skin='chip')
        plate9(card, 'knob', 42, 42, 240, 0, fill=CREAM_HI, stroke=GOLD_DARK, skin='chip')
        hit = nd(card, 'hit', 150, 76, 240, 0)
        rows_y.append(hit)
        # ⚠️ 必须追加组件 tcomp（steppers 同理）：追加节点 card 会序列化成
        #    指向 cc.Node 的引用，运行时 row.bind 不是函数（实测踩过）。
        toggles.append(tcomp)
        y -= 100

    # ---- 音频：三档音量 ----
    y -= 16
    y = section(y, 'audio')
    steppers = []
    for k in ('master_volume', 'music_volume', 'sfx_volume'):
        card = plate9(C, 'step_' + k, 620, 88, 0, y, fill=PLATE)
        scomp = card.attach(Script(CID['StepperRow']))
        tl = lbl(card, 'title', '', -280, 0, 190, 50, size=26, color='#F1E0C0', align=0,
                 anchor=(0, 0.5), key=k)
        dec = wood_btn(card, 'dec', 64, 64, -42, 0, text='-', size=36)
        plate9(card, 'track', 150, 16, 80, 0, fill=PLATE_DARK, stroke=None, gloss=False)
        filln = nd(card, 'fill', 150, 10, 5, 0, ax=0, ay=0.5)
        fillsp = filln.attach(Sprite(TEX['Textures/ui/px_white2'], type_=0, size_mode=0, color=hx(GOLD)))
        val = lbl(card, 'val', '100%', 212, 0, 88, 50, size=26, color=GOLD, align=2, anchor=(1, 0.5))
        inc = wood_btn(card, 'inc', 64, 64, 254, 0, text='+', size=36)
        scomp.fields.update(dict(titleLb=tl, valLb=val, fill=fillsp, decBtn=dec, incBtn=inc))
        steppers.append(scomp)
        y -= 100

    # ---- 语言 ----
    y -= 16
    y = section(y, 'language')
    card = plate9(C, 'card_lang', 620, 92, 0, y, fill=PLATE)
    lbl(card, 'title', '', -280, 0, 190, 50, size=26, color='#F1E0C0', align=0,
        anchor=(0, 0.5), key='language')
    lang_nodes, lang_btns = [], []
    for i, (nm, txt) in enumerate((('lang_zh', '简体中文'), ('lang_en', 'English'))):
        b = wood_btn(card, nm, 150, 64, 66 + i * 162, 0, text=txt, size=24)
        lang_nodes.append(b)
        lang_btns.append(comp_of(b, 'cc.Sprite'))     # 底板 Sprite（切换选中态靠染它）
    y -= 104

    # ---- 数据 ----
    y -= 16
    y = section(y, 'data')
    card = plate9(C, 'card_data', 620, 108, 0, y, fill=PLATE)
    lbl(card, 'desc', '', -280, 0, 380, 96, size=20, color='#F1E0C0', align=0, anchor=(0, 0.5),
        overflow=1, line_h=26, key='delete_game')
    del_btn = wood_btn(card, 'del', 168, 72, 196, 0, text='', size=26, fill=DANGER, key='delete')
    y -= 120

    content_ut = find_ut(C)
    content_ut.fields['_contentSize'] = {'__type__': 'cc.Size', 'width': 620, 'height': abs(y) + 60}

    root.attach(Script(CID['SettingDialog'],
                       toggles=toggles,
                       steppers=steppers,
                       langBtns=lang_btns, langNodes=lang_nodes, delBtn=del_btn,
                       animRoot=frame, maskNode=mask, modal=True, closeOnMask=True))
    void(close)
    return root


def find_ut(node):
    for c in node.components:
        if c.type_ == 'cc.UITransform':
            return c
    return None


# ------------------------------------------------------------------ 统计面板
STAT_ROWS = [
    ('playtime', 'playtime'), ('total_money', 'total_money'),
    ('total_flips', 'total_flips'), ('total_caps', 'total_caps'),
    ('highest_flip', 'highest_flip'), ('per_sec', 'per_sec'),
    ('milestone', 'milestone'), ('ms_next', 'ms_next'),
]
TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'Celestial']


def stats_dialog():
    body_h = 700
    root, mask, frame, C, _, close = shell('stats', body_h)
    root.name = 'StatsDialog'

    y = -14
    plate9(C, 'secTick', 12, 30, -300, y, fill='#8A5A20', stroke=None, gloss=False)
    lbl(C, 'sec', '', -284, y, 300, 40, size=28, color='#7A4210', align=0, anchor=(0, 0.5),
        key='all_time')
    y = -92

    overview = []
    for nm, k in STAT_ROWS:
        card = plate9(C, 'row_' + nm, 620, 88, 0, y, fill=PLATE)
        comp = card.attach(Script(CID['StatRow'], key=k))
        lbl(card, 'title', '', -280, 0, 320, 50, size=26, color='#F1E0C0', align=0,
            anchor=(0, 0.5), key=k)
        vlb = lbl(card, 'val', '', 280, 0, 340, 50, size=28, color=GOLD, align=2, anchor=(1, 0.5))
        comp.fields['valLb'] = vlb
        overview.append(comp)
        y -= 98

    y -= 14
    plate9(C, 'secTick2', 12, 30, -300, y, fill='#8A5A20', stroke=None, gloss=False)
    lbl(C, 'sec2', '', -284, y, 300, 40, size=28, color='#7A4210', align=0, anchor=(0, 0.5),
        key='shop_bottles')
    y -= 80

    bottles = []
    for i, tk in enumerate(TIERS):
        card = plate9(C, 'bot_' + tk, 620, 76, 0, y, fill=PLATE)
        comp = card.attach(Script(CID['StatRow'], key='tier' + str(i)))
        lbl(card, 'title', '', -280, 0, 320, 50, size=24, color='#F1E0C0', align=0,
            anchor=(0, 0.5), key=tk)
        vlb = lbl(card, 'val', '', 280, 0, 340, 50, size=26, color='#8CE7A2', align=2, anchor=(1, 0.5))
        comp.fields['valLb'] = vlb
        bottles.append(comp)
        y -= 86

    find_ut(C).fields['_contentSize'] = {'__type__': 'cc.Size', 'width': 620, 'height': abs(y) + 40}
    root.attach(Script(CID['StatsDialog'], overview=overview, bottles=bottles,
                       animRoot=frame, maskNode=mask))
    void(close)
    return root


# ------------------------------------------------------------------ 成就面板
def ach_dialog():
    body_h = 840
    root, mask, frame, C, ptitle, close = shell(None, body_h)
    root.name = 'AchDialog'
    # 标题由 AchDialog 自己写（要追加 6/24），所以不带 LocLabel
    unbind_key(ptitle)

    y = -40
    rows = []
    for i in range(24):
        card = plate9(C, 'ach_' + str(i + 1), 620, 104, 0, y, fill=PLATE)
        comp = card.attach(Script(CID['AchRow'], id=i + 1))
        icon_n = nd(card, 'ic', 76, 74, -252, 0)
        icon = icon_n.attach(Sprite(TEX['Textures/ui/icon_ach2'], type_=0, size_mode=0))
        tlb = lbl(card, 'title', '', -196, 22, 400, 36, size=26, color='#FFFFFF', align=0,
                  anchor=(0, 0.5))
        dlb = lbl(card, 'desc', '', -196, -20, 420, 32, size=20, color='#C0B096', align=0,
                  anchor=(0, 0.5))
        comp.fields.update(dict(icon=icon, titleLb=tlb, descLb=dlb))
        rows.append(comp)
        y -= 114

    find_ut(C).fields['_contentSize'] = {'__type__': 'cc.Size', 'width': 620, 'height': abs(y) + 40}
    root.attach(Script(CID['AchDialog'], rows=rows, titleLb=ptitle,
                       animRoot=frame, maskNode=mask))
    void(close)
    return root


def unbind_key(label_comp):
    """label 节点上如果挂了 LocLabel（自动翻译），摘掉：标题要带动态数字，不能被动覆盖。"""
    node = label_comp.node
    for c in list(node.components):
        if getattr(c, 'type_', '') == CID['LocLabel']:
            node.components.remove(c)


# ------------------------------------------------------------------ 离线收益
def offline_dialog():
    root, mask, fit = adapted_root('OfflineDialog', mask_alpha=170)

    card = plate9(fit, 'card', 600, 430, 0, 0, fill=CREAM, inner=CREAM_DARK)
    card.attach(BlockInputEvents())   # 吞掉面板上的点击，防穿透到 mask 误关
    lbl(card, 'title', '', 0, 148, 550, 48, size=32, color=WOOD_TEXT, outline='#FFF3D6',
        outline_w=3, key='welcome_back')
    img(card, 'coin', 'Textures/ui/coin', 90, 90, 0, 52)
    earn = lbl(card, 'earn', '$ 0   +   0', 0, -30, 540, 54, size=34, color='#8A5A20',
               outline='#FFF3D6', outline_w=3)
    time = lbl(card, 'time', '', 0, -84, 540, 38, size=25, color='#9A7A50')

    ad_btn = plate9(card, 'adBtn', 210, 84, 116, -152, fill=GOLD)
    lbl(ad_btn, 'text', '', 0, 2, 198, 84, size=26, color=WOOD_TEXT, key='ad_x3')
    ok_btn = plate9(card, 'okBtn', 210, 84, -116, -152, fill=GOLD)
    lbl(ok_btn, 'text', '', 0, 2, 198, 84, size=30, color=WOOD_TEXT, key='ok')

    root.attach(Script(CID['OfflineDialog'], earnLb=earn, timeLb=time,
                       adBtn=ad_btn, okBtn=ok_btn, animRoot=card, maskNode=mask))
    return root


# ------------------------------------------------------------------ 二次确认
def confirm_dialog():
    root, mask, fit = adapted_root('ConfirmDialog', mask_alpha=200)

    card = plate9(fit, 'card', 600, 380, 0, 0, fill='#4A3420', stroke=GOLD_DARK)
    card.attach(BlockInputEvents())   # 吞掉面板上的点击，防穿透到 mask 误关
    text = lbl(card, 'text', '', 0, 60, 520, 190, size=30, color='#FFF6E0', overflow=1, line_h=40)

    cancel = plate9(card, 'cancelBtn', 220, 78, -140, -120, fill=CREAM)
    cancel_lb = lbl(cancel, 'text', '', 0, 2, 208, 78, size=28, color=WOOD_TEXT)
    ok = plate9(card, 'okBtn', 220, 78, 140, -120, fill=CREAM)
    ok_lb = lbl(ok, 'text', '', 0, 2, 208, 78, size=28, color=WOOD_TEXT)

    root.attach(Script(CID['ConfirmDialog'], textLb=text, okLb=ok_lb, cancelLb=cancel_lb,
                       okPlate=comp_of(ok, 'cc.Sprite'), okBtn=ok, cancelBtn=cancel,
                       animRoot=card, maskNode=mask))
    return root


# ------------------------------------------------------------------ 标题页
def start_page():
    root, mask, fit = adapted_root('StartPage', mask_alpha=0)

    logo = nd(fit, 'Logo', 300, 300, 0, 200)
    logo.attach(Sprite(TEX['Textures/ui/app_logo'], type_=0, size_mode=0))
    sub = lbl(fit, 'SubTxt', '点 瓶 子', 0, -30, 640, 100, size=54, color=CREAM,
              outline='#2A1608', outline_w=5)
    tap = lbl(fit, 'TapTxt', '—— 点击屏幕开始 ——', 0, -290, 640, 56, size=34, color=CREAM,
              outline='#2A1608', outline_w=4)

    # ⚠️ animRoot=fit 时必须配 Fade（透明度动画）：Pop 的 setScale 会覆盖 UIFit 的适配缩放
    root.attach(Script(CID['StartPage'], logo=logo, subTxt=sub, tapTxt=tap,
                       animRoot=fit, maskNode=mask, modal=False, closeOnMask=False,
                       aniIn=2, aniOut=2))
    return root


# ------------------------------------------------------------------ 入口
BUILD = (
    ('SettingDialog/SettingDialog', setting_dialog),
    ('StatsDialog/StatsDialog', stats_dialog),
    ('AchDialog/AchDialog', ach_dialog),
    ('OfflineDialog/OfflineDialog', offline_dialog),
    ('ConfirmDialog/ConfirmDialog', confirm_dialog),
    ('StartPage/StartPage', start_page),
)


def main():
    for rel, fn in BUILD:
        name = rel.split('/')[-1]
        path = os.path.join(OUT, name + '.prefab')
        write_prefab(path, name, fn())
        ensure_meta(path, 'prefab', name)
        n = len(json.load(open(path, encoding='utf-8')))
        print('%-34s %7d bytes  %4d objs' % (rel + '.prefab', os.path.getsize(path), n))


if __name__ == '__main__':
    main()
