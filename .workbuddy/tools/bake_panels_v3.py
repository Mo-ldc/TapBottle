# -*- coding: utf-8 -*-
"""
第七十三轮：设置 / 成就 / 记录三个大面板换通用弹窗皮（烘焙进 prefab 本体）。

  背景 frame   popup/buco01（596×410 圆角奶油面板）→ 先给 .meta 补九宫格 border 40，
               再以 SLICED 拉到 692×1080（圆角不变形）；原 nine_base/gloss/stroke 三层删除。
  关闭叉 close popup/buco02（87×90 橙色圆叉）→ SIMPLE 原尺寸；原九宫格钮 + btn_close 图标删除。
               节点名保持 `close`（UIBase.bindCloseBtn 自动接手，无需改代码）。
  标题牌/正文/滚动区全部不动（用户只要求换底框与关闭钮）。

用法：
  python .workbuddy/tools/bake_panels_v3.py            # 干跑
  python .workbuddy/tools/bake_panels_v3.py --write    # 写回（自动备份）
"""
import io
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_dialog_skin import Prefab, sf_uuid, WHITE  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX_DIR = os.path.join(ROOT, 'assets', 'resources', 'Textures')

BUCO01 = sf_uuid('popup/buco01')   # 弹窗面板（需先补 border）
BUCO02 = sf_uuid('popup/buco02')   # 关闭叉

# frame(692×1080) 右上角 = (346, 532)；按 ConfirmDialog 口径内缩 (-28,-34)
CLOSE_POS = (318, 498)


def patch_buco01_border(border=40):
    """buco01 原图无九宫格；SLICED 拉伸前必须补 border（备份原 meta）。"""
    path = os.path.join(TEX_DIR, 'popup', 'buco01.png.meta')
    m = json.load(io.open(path, encoding='utf-8'))
    u = m['subMetas']['f9941']['userData']
    cur = (u.get('borderTop'), u.get('borderBottom'), u.get('borderLeft'), u.get('borderRight'))
    if cur == (border, border, border, border):
        print('buco01 border 已是 %s，跳过' % (cur,))
        return
    bak = path + '.pre_border'
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
    u['borderTop'] = u['borderBottom'] = u['borderLeft'] = u['borderRight'] = border
    io.open(path, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(m, ensure_ascii=False, separators=(',', ':')))
    print('buco01 border %s -> %d/40（备份 .pre_border）' % (cur, border))


def set_pic_typed(p, node, uuid, w, h, sp_type, color):
    ut = p.comp(node, 'cc.UITransform')
    if ut is not None:
        p.d[ut]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': h}
    sp = p.comp(node, 'cc.Sprite')
    o = p.d[sp]
    o['_spriteFrame'] = {'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'}
    o['_type'] = sp_type              # 0=SIMPLE 1=SLICED
    o['_sizeMode'] = 0                # CUSTOM
    o['_isTrimmedMode'] = False
    o['_color'] = dict(color)         # 贴图自带色，必须撤掉旧 tint
    p.log.append('  换图 %s -> %s (%dx%d type=%d color=白)'
                 % (p.d[node]['_name'], uuid[:8], w, h, sp_type))


def bake_panel(p, do_write):
    print('== %s' % p.d[1]['_name'])
    root = p.node(p.d[1]['_name'])
    fit = p.child(root, 'fit')
    frame = p.child(fit, 'frame')
    # ① frame：撤 nine 三层中的 gloss/stroke（本体层换 buco01）
    p.remove_nodes(frame, ['gloss', 'stroke'])
    frame = p.child(fit, 'frame')
    set_pic_typed(p, frame, BUCO01, 692, 1080, sp_type=1, color=WHITE)  # SLICED
    # ② close：撤九宫格钮三层，换 buco02 原尺寸
    close = p.child(frame, 'close')
    p.remove_nodes(close, ['gloss', 'stroke', 'icon'])
    frame = p.child(fit, 'frame')
    close = p.child(frame, 'close')
    set_pic_typed(p, close, BUCO02, 87, 90, sp_type=0, color=WHITE)     # SIMPLE
    p.set_pos(close, *CLOSE_POS)
    p.save(do_write)


def main():
    do_write = '--write' in sys.argv
    patch_buco01_border()
    for name in ('SettingDialog', 'AchDialog', 'StatsDialog'):
        p = Prefab(name)
        bake_panel(p, do_write)
        for line in p.log:
            print(line)
    print('干跑完成（加 --write 才会写回）' if not do_write else '已写回，请跑 check_prefab.py 校验')


if __name__ == '__main__':
    main()
