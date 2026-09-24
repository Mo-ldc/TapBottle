"""
重建 Game.scene —— 游戏主场景（原 Main.scene，用户口径改名 Game）。

层级（创作空间 720×1280，y 以屏幕中心为 0）：
  Canvas (UT 1440×2560 设计区)
  ├── Camera
  └── GameRoot (GameRoot.ts)
      ├── gameRoot ── 游戏层：现在的游戏主要布置（×DS×sA 整体等比缩放居中）
      │   ├── bgLayer
      │   ├── shakeHolder（震屏只震游戏层）
      │   │   └── worldLayer ── bottles / hands / fxLayer（fx 必须排最后）
      │   ├── hudRoot          —— 顶栏 HUD
      │   ├── navRoot          —— belt / bottomPanel（底栏）
      │   ├── adRoot           —— 广告增益按钮
      │   ├── panelLayer       —— 买瓶飞入精灵层
      │   └── toastLayer       —— 游戏内提示（Toast）
      └── uiRoot ── UI 层（**不缩放**，运行时铺满可见区）：
          提示、设置等页面/弹窗的挂载点；每个 UI 预制体自带 UIFit
          （遮罩铺满整个场景 + 内容按原分辨率等比缩放居中）
          ├── PageRoot / DialogRoot / TipRoot（均 Widget 全对齐 uiRoot）

  ★ 资源节点不在这里：Res 是 Load 场景的常驻节点（addPersistRootNode），
    切场景后由 GameRoot.ensureRes 复用；单独预览本场景时运行时兜底创建。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_scene import (Node, UITransform, Widget, Script, Camera,
                       CanvasComp, W_ALL, write_scene)
from scan_cid import load as load_cid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)
CID = load_cid()

DW, DH = 1440, 2560          # 2K 竖屏设计区
AW, AH = 720, 1280           # 创作空间

# ★ 沿用 Main.scene 的 uuid：构建配置/编辑器引用不断链
GAME_SCENE_UUID = '8f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e51'


def layer(name, w=AW, h=AH, x=0, y=0, ax=None, ay=None):
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
    import json
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
    # ⚠️ Canvas **不能**挂 Widget：它在场景 attach 之前就会 onEnable →
    #    "Node Canvas has not attached to a scene"，之后 widgetManager 每帧 align()
    #    访问失效节点刷屏 `_getUITransformComp`。Canvas 本身已经铺满视口，不需要对齐。

    root = canvas.add(layer('GameRoot', DW, DH))

    # ---- gameRoot：游戏层（创作空间 UT，×DS×sA 由 applySafeLayout 设） ----
    game = root.add(layer('gameRoot'))

    bg_layer = game.add(layer('bgLayer'))
    shake = game.add(layer('shakeHolder'))

    world = shake.add(layer('worldLayer'))
    bottles = world.add(layer('bottles'))
    hands = world.add(layer('hands'))
    fx = world.add(layer('fxLayer'))          # ← 必须最后（飘字在最上）

    hud_root = game.add(layer('hudRoot'))
    nav_root = game.add(layer('navRoot'))
    belt = nav_root.add(layer('belt', AW, 86, 0, -256))
    bottom_panel = nav_root.add(layer('bottomPanel'))
    ad_root = game.add(layer('adRoot'))
    panel = game.add(layer('panelLayer'))
    toast = game.add(layer('toastLayer'))

    # ---- uiRoot：UI 层（不缩放；运行时 applySafeLayout 铺满可见区） ----
    # 顺序 = 渲染顺序：Page → Dialog → Tip 依次盖上去。
    ui = root.add(layer('uiRoot'))
    page_root = ui.add(layer('PageRoot'))
    page_root.attach(Widget(W_ALL))
    dialog_root = ui.add(layer('DialogRoot'))
    dialog_root.attach(Widget(W_ALL))
    tip_root = ui.add(layer('TipRoot'))
    tip_root.attach(Widget(W_ALL))

    root.attach(Script(CID['GameRoot'],
                       gameRoot=game, uiRoot=ui,
                       bgLayer=bg_layer, shakeHolder=shake,
                       worldLayer=world, fxLayer=fx,
                       hudRoot=hud_root, navRoot=nav_root, adRoot=ad_root,
                       panelLayer=panel, toastLayer=toast,
                       bottlesNode=bottles, handsNode=hands,
                       beltNode=belt, bottomNode=bottom_panel,
                       pageRoot=page_root, dialogRoot=dialog_root, tipRoot=tip_root))

    p = write_scene(os.path.join(ROOT, 'assets', 'Scenes', 'Game.scene'), 'Game', canvas)
    write_scene_meta(p, GAME_SCENE_UUID)
    print('written:', p, os.path.getsize(p), 'bytes')
    print('uuid:', GAME_SCENE_UUID)


if __name__ == '__main__':
    main()
