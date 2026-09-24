"""
生成 Boot.scene（启动场景，替换旧 DOM 引导层）。

适配方案（全部走 Cocos 内置，不写布局代码）：
  - view: FIXED_WIDTH 720x1280
  - Canvas: alignCanvasWithScreen=true + Widget 四边 0 → Canvas 尺寸恒等于真实视口
  - Bg:     Widget 四边 0 + Sprite CUSTOM → 任何比例都铺满，无黑边
  - 加载区: Widget LEFT|RIGHT|BOTTOM → 永远钉在底部安全区（折叠屏/平板矮屏也不出界）
  - 标题区: Widget 四边 0 → 节点中心恒等于视口中心，内部按中心偏移 → 永远居中
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_scene import (Node, UITransform, Sprite, Widget, Label, Script, Camera,
                       CanvasComp, UIOpacity, W_LEFT, W_RIGHT, W_BOTTOM, W_ALL,
                       write_scene)
from scan_cid import load as load_cid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

# ⚠️ scene 里脚本组件的 __type__ 必须是编译期 cid，不是脚本 uuid
CID = load_cid()

UUID = {
    'Boot.ts': CID['Boot'],
    'bg': '89d84e1d-48fb-44af-9914-4a82a298906b',
    'logo': '37d4257f-cabc-4f9f-b8ec-9079fbbd5c9a',
    'bottle': 'e0f33dbd-6687-43d0-8371-a5d5918ec863',
    'nine_base': 'ade2de50-105d-4a17-8d3a-41c7f6a3ce0f',
    'nine_stroke': 'a72e22e7-24b1-4510-b924-fc97a390952b',
    'bar_fill': 'd1eb37ab-ede1-4b36-8646-fec840115887',
}
SF = lambda k: UUID[k] + '@f9941'


def img_size(rel):
    im = Image.open(os.path.join(ROOT, rel))
    return im.size


# ---- 按原图比例算显示尺寸 ----
lw, lh = img_size('assets/resources/Textures/ui/app_logo.png')
LOGO_W = 420
LOGO_H = int(round(LOGO_W * lh / lw))

bw, bh = img_size('assets/resources/Textures/bottle/body_4.png')
RIDER_H = 78
RIDER_W = int(round(RIDER_H * bw / bh))

CREAM = (255, 240, 214)
GOLD = (255, 216, 120)
DK = (78, 40, 12)

# ================= Canvas =================
canvas = Node('Canvas', 0, 0, 720, 1280)
canvas.attach(UITransform(720, 1280))
canvas.attach(Widget(W_ALL))

cam = canvas.add(Node('Camera', 0, 0, 0, 1000, layer=1073741824))
CAM = cam.attach(Camera())
canvas.attach(CanvasComp(CAM))  # 必须是 cc.Camera 组件，不是节点

# ================= 背景（铺满全屏，任何比例无黑边） =================
bg = canvas.add(Node('Bg', 0, 0, 720, 1280))
bg.attach(UITransform(720, 1280))
bg.attach(Sprite(SF('bg'), type_=0, size_mode=0))
bg.attach(Widget(W_ALL))

# ================= Boot 控制节点（挂 Boot.ts，撑满视口） =================
boot = canvas.add(Node('Boot', 0, 0, 720, 1280))
boot.attach(UITransform(720, 1280))
boot.attach(Widget(W_ALL))

# ---- 加载区：钉底 ----
loading = boot.add(Node('LoadingRoot', 0, 0, 720, 96))
loading.attach(UITransform(720, 96))
loading.attach(Widget(W_LEFT | W_RIGHT | W_BOTTOM, bottom=140))
loading.attach(UIOpacity(255))

load_txt = loading.add(Node('LoadTxt', 0, 34, 520, 46))
load_txt.attach(UITransform(520, 46))
load_txt.attach(Label('正在加载中', size=34, color=CREAM, outline=DK, outline_w=3))
L_LOAD = load_txt.components[-1]

track = loading.add(Node('Track', 0, -20, 604, 28))
track.attach(UITransform(604, 28))

tb = track.add(Node('TrackBase', 0, 0, 604, 28))
tb.attach(UITransform(604, 28))
tb.attach(Sprite(SF('nine_base'), type_=1, size_mode=0, color=(46, 25, 8, 255)))

tl = track.add(Node('TrackLine', 0, 0, 604, 28))
tl.attach(UITransform(604, 28))
tl.attach(Sprite(SF('nine_stroke'), type_=1, size_mode=0, color=(255, 220, 150, 255)))

fill = track.add(Node('Fill', -302, 0, 18, 28, ax=0.0, ay=0.5))
fill.attach(UITransform(18, 28, ax=0.0, ay=0.5))
fill.attach(Sprite(SF('bar_fill'), type_=1, size_mode=0, color=(246, 190, 80, 255)))

rider = track.add(Node('Rider', -288, 0, RIDER_W, RIDER_H))
rider.attach(UITransform(RIDER_W, RIDER_H))
rider.attach(Sprite(SF('bottle'), type_=0, size_mode=0))

# ---- 标题区：撑满视口 → 中心恒等于屏幕中心 ----
title = boot.add(Node('TitleRoot', 0, 0, 720, 1280, active=False))
title.attach(UITransform(720, 1280))
title.attach(Widget(W_ALL))
title.attach(UIOpacity(255))

logo = title.add(Node('Logo', 0, 200, LOGO_W, LOGO_H))
logo.attach(UITransform(LOGO_W, LOGO_H))
logo.attach(Sprite(SF('logo'), type_=0, size_mode=0))

sub = title.add(Node('SubTxt', 0, -30, 640, 100))
sub.attach(UITransform(640, 100))
sub.attach(Label('点 瓶 子', size=78, color=GOLD, outline=DK, outline_w=6))
L_SUB = sub.components[-1]

tap = title.add(Node('TapTxt', 0, -290, 640, 56))
tap.attach(UITransform(640, 56))
tap.attach(Label('—— 点击屏幕开始 ——', size=34, color=CREAM, outline=DK, outline_w=4))
L_TAP = tap.components[-1]

# ---- Boot.ts 组件（放最后，属性引用上面的实例） ----
boot.attach(Script(UUID['Boot.ts'],
                   fillBar=fill, bottleRider=rider, loadingRoot=loading,
                   titleRoot=title, logo=logo,
                   loadTxt=L_LOAD, subTxt=L_SUB, tapTxt=L_TAP))

out = write_scene(os.path.join(ROOT, 'assets', 'Scenes', 'Boot.scene'), 'Boot', canvas)
print('written:', out, os.path.getsize(out), 'bytes')
print('logo', LOGO_W, LOGO_H, '| rider', RIDER_W, RIDER_H)
