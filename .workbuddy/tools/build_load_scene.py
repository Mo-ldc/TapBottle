"""
重建 Load.scene —— 加载/开始场景（用户口径：采用切换场景的形式）。

结构：
  Scene
  ├── Canvas (UT 1440×2560 设计区)
  │   ├── Camera
  │   └── LoadRoot (LoadScene.ts)
  │       ├── Bg —— 加载背景图（LoadScene 运行时按可见区拉伸铺满）
  │       └── uiRoot —— UI 层（运行时铺满可见区）
  │           ├── LoadingRoot —— 底部进度条（Widget 钉可见区底部）
  │           │   ├── LoadTxt / Bar → Inner → Fill / Rider
  │           └── PageRoot —— StartPage 预制体挂载点（Widget 全对齐）
  └── Res（场景级常驻节点：LoadScene 里 addPersistRootNode，
      切到 Game 场景后 BGM 不断、已加载资源不丢）
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_scene import (Node, UITransform, Sprite, Widget, Label, Script, Camera,
                       CanvasComp, UIOpacity, W_LEFT, W_RIGHT, W_BOT, W_ALL,
                       write_scene)
from scan_cid import load as load_cid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)
CID = load_cid()

DW, DH = 1440, 2560          # 2K 竖屏设计区
DS = 2
AW = 720

SF = {
    'bg': '89d84e1d-48fb-44af-9914-4a82a298906b@f9941',          # Scenes/Boot/loading_bg.jpg
    'bar_track': '03f78a3d-7895-49b5-be33-95710f67eeed@f9941',
    'bar_fill': 'd6a67c36-4b28-4b73-a79b-16e14658e656@f9941',
    'bar_rider': '94d41a33-6e68-4c71-9d58-3e55656e1de5@f9941',
}
WHITE = (255, 255, 255)

# ---- 进度条几何（设计单位，与旧 bootLayer 完全一致） ----
BG_K = AW / 750.0
BAR_W = round(650 * BG_K * DS)     # 1248
BAR_H = round(67 * BG_K * DS)      # 128
INNER_W = 618 * BG_K * DS          # 1186.6
INNER_H = 37 * BG_K * DS           # 71.0
INNER_X = ((67 - 50) * BG_K - round(650 * BG_K) / 2) * DS
INNER_Y = -(1359.5 - 1360.5) * BG_K * DS
FILL_W = 240 * BG_K * DS
RIDER_W = round(93 * BG_K * DS)    # 178
RIDER_H = round(38 * BG_K * DS)    # 72
BAR_BOTTOM = 320 * DS              # 640
LOAD_TXT_DY = 67 * DS              # 134
LOAD_H = 120 * DS                  # 240

LOAD_SCENE_UUID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c55'


def layer(name, w=DW, h=DH, x=0, y=0, ax=None, ay=None):
    kw = {}
    if ax is not None:
        kw['ax'] = ax
    if ay is not None:
        kw['ay'] = ay
    n = Node(name, x, y, w, h, **kw)
    n.attach(UITransform(w, h, ax=(ax if ax is not None else 0.5),
                         ay=(ay if ay is not None else 0.5)))
    return n


def write_scene_meta(path, uuid):
    """场景 meta（照抄编辑器真产物格式）"""
    d = {
        'ver': '1.1.50',
        'importer': 'scene',
        'imported': True,
        'uuid': uuid,
        'files': ['.json'],
        'subMetas': {},
        'userData': {},
    }
    with open(path + '.meta', 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def main():
    canvas = Node('Canvas', 0, 0, DW, DH)
    canvas.attach(UITransform(DW, DH))
    cam = canvas.add(Node('Camera', 0, 0, 0, 1000, layer=1073741824))
    CAM = cam.attach(Camera())
    canvas.attach(CanvasComp(CAM))

    root = canvas.add(layer('LoadRoot', DW, DH))

    bg = root.add(layer('Bg', DW, DH))
    bg.attach(Sprite(SF['bg'], type_=0, size_mode=0))

    ui = root.add(layer('uiRoot', DW, DH))

    # ---- 加载区：钉可见区底部 ----
    loading = ui.add(layer('LoadingRoot', DW, LOAD_H))
    loading.attach(Widget(W_LEFT | W_RIGHT | W_BOT, bottom=BAR_BOTTOM - LOAD_H / 2))
    loading.attach(UIOpacity(255))

    lt = loading.add(layer('LoadTxt', 520 * DS, 62 * DS, 0, LOAD_TXT_DY))
    L_LOAD = lt.attach(Label('正在加载中', size=46 * DS, color=WHITE, bold=True))

    bar = loading.add(layer('Bar', BAR_W, BAR_H))
    bar.attach(Sprite(SF['bar_track'], type_=0, size_mode=0))
    inner = bar.add(layer('Inner', INNER_W, INNER_H, INNER_X, INNER_Y, ax=0.0, ay=0.5))
    fill = inner.add(layer('Fill', FILL_W, INNER_H, 0, 0, ax=0.0, ay=0.5))
    fill.attach(Sprite(SF['bar_fill'], type_=1, size_mode=0))
    rider = inner.add(layer('Rider', RIDER_W, RIDER_H,
                            FILL_W - 4 * DS + RIDER_W / 2, 0))
    rider.attach(Sprite(SF['bar_rider'], type_=0, size_mode=0))

    # ---- 页面挂载点：StartPage 按需 instantiate 到这里 ----
    page_root = ui.add(layer('PageRoot', DW, DH))
    page_root.attach(Widget(W_ALL))

    root.attach(Script(CID['LoadScene'],
                       bgNode=bg, uiRoot=ui, loadingRoot=loading,
                       inner=inner, fillBar=fill, bottleRider=rider,
                       loadTxt=L_LOAD, pageRoot=page_root))

    # ---- 场景级常驻资源节点（与 Canvas 平级；addPersistRootNode 要求场景直接子节点） ----
    res = layer('Res', 1, 1)
    res.add(layer('BgmSource', 1, 1))
    res.attach(Script(CID['Res']))
    # LoadScene.resNode 回填（指向场景级 Res 节点）
    for c in root.components:
        if c.type_ == CID['LoadScene']:
            c.fields['resNode'] = res

    p = write_scene(os.path.join(ROOT, 'assets', 'Scenes', 'Load.scene'), 'Load', [canvas, res])
    write_scene_meta(p, LOAD_SCENE_UUID)
    print('written:', p, os.path.getsize(p), 'bytes')
    print('uuid:', LOAD_SCENE_UUID)


if __name__ == '__main__':
    main()
