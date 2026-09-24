"""
生成 assets/resources/Prefabs/ 下的游戏对象预制体。

⚠️ 两个硬性约束（踩过坑）：
  1. 脚本组件的 __type__ 必须是编译期 cid（scan_cid.py 扫出来的），不是脚本 uuid；
  2. 一个节点只能挂一个渲染组件 —— 底板/高光/描边必须各占一个子节点。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_scene import (Node, UITransform, Sprite, Label, Script,
                       write_prefab, ensure_meta)
from scan_cid import load as load_cid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)
CID = load_cid()
OUT = os.path.join(ROOT, 'assets', 'resources', 'Prefabs')

SF = {
    'disc': '03510e10-1a86-473b-97ad-243f7b1d6071@f9941',
    'body_0': '02bd5bdd-e1e8-4071-a310-730596cb90fd@f9941',
    'body_4': 'e0f33dbd-6687-43d0-8371-a5d5918ec863@f9941',
    'coin': 'c70ee16d-ca97-4483-b441-e3fe99fa2f4d@f9941',
    'capchip': '278e4e33-43c5-499c-ac32-548e6f8324e9@f9941',
}

# 与 Bottle.ts 保持一致的常量（改这里必须同步改 Bottle.ts）
ART_W, ART_H, ART_AY = 150, 375, 0.34
BOTTLE_SCALE = 96.0 / ART_H


def bottle_shadow():
    """瓶底影子：env/disc 压扁成椭圆，黑色 118 半透明。"""
    n = Node('BottleShadow', 0, 0, 64, 24)
    n.attach(UITransform(64, 24))
    n.attach(Sprite(SF['disc'], type_=0, size_mode=0, color=(0, 0, 0, 118)))
    return n


def bottle():
    """瓶子：根挂 Bottle.ts（缩放/角度直接烘进预制体，编辑器里看到的就是正立的小瓶子），
    子节点 art 是瓶身贴图。影子是独立预制体（挂在影子层，不在本节点下）。"""
    root = Node('Bottle', 0, 0, 100, 200, scale=BOTTLE_SCALE, angle=180)
    root.attach(UITransform(100, 200))
    art = root.add(Node('art', 0, 0, ART_W, ART_H, ax=0.5, ay=ART_AY))
    art.attach(UITransform(ART_W, ART_H, ax=0.5, ay=ART_AY))
    art.attach(Sprite(SF['body_0'], type_=0, size_mode=0))
    root.attach(Script(CID['Bottle'], art=art))
    return root


if __name__ == '__main__':
    for name, fn in (('Game/BottleShadow', bottle_shadow), ('Game/Bottle', bottle)):
        p = os.path.join(OUT, name + '.prefab')
        write_prefab(p, name.split('/')[-1], fn())
        ensure_meta(p, 'prefab', name.split('/')[-1])
        print('%-28s %6d bytes' % (name + '.prefab', os.path.getsize(p)))
