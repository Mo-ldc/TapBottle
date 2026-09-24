# -*- coding: utf-8 -*-
"""
reorg_ui.py —— UI 资源重组：按「类型归位 + 分类」重排目录。

    assets/resources/UIRes/<Name>/Prefabs/<Name>.prefab   ->  assets/resources/Prefabs/UI/<Name>.prefab
    assets/resources/UIRes/<Name>/Scripts/<Name>.ts       ->  assets/Scripts/UI/{Pages,Dialogs}/<Name>.ts
    assets/resources/UIRes/UIPublic/Scripts/*.ts          ->  assets/Scripts/UI/{Common,_legacy}/*.ts
    assets/resources/Textures/ui/<name>.png               ->  assets/resources/Textures/ui/<sub>/<name>.png

同步改写：
    · 脚本 import 相对路径
    · Res.ts 的 TEXTURE_PATHS
    · 所有 .ts 里 'ui/<name>' 形式的逻辑 key

⚠️ 只动「文件 + 同名 .meta」，uuid 不变 —— prefab 里的 SpriteFrame / 脚本 cid 引用全部不受影响。

用法：
    python reorg_ui.py            # 干跑，只打印
    python reorg_ui.py --write    # 实际执行
"""
import os
import re
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RES = os.path.join(ROOT, 'assets', 'resources')
SCRIPTS = os.path.join(ROOT, 'assets', 'Scripts')

WRITE = '--write' in sys.argv

# ---------------------------------------------------------------- 1. 预制体
# 界面名 -> 目标（统一进 resources/Prefabs/UI/）
UI_PREFAB_NAMES = [
    'StartPage', 'SettingDialog', 'StatsDialog',
    'AchDialog', 'OfflineDialog', 'ConfirmDialog',
]

# ---------------------------------------------------------------- 2. 脚本
# 源：UIRes/<dir>/Scripts/<file>.ts   ->   目标：Scripts/UI/<sub>/<file>.ts
SCRIPT_MOVES = [
    # 页面
    ('StartPage/Scripts/StartPage.ts', 'UI/Pages/StartPage.ts'),
    # 弹窗
    ('SettingDialog/Scripts/SettingDialog.ts', 'UI/Dialogs/SettingDialog.ts'),
    ('StatsDialog/Scripts/StatsDialog.ts', 'UI/Dialogs/StatsDialog.ts'),
    ('AchDialog/Scripts/AchDialog.ts', 'UI/Dialogs/AchDialog.ts'),
    ('OfflineDialog/Scripts/OfflineDialog.ts', 'UI/Dialogs/OfflineDialog.ts'),
    ('ConfirmDialog/Scripts/ConfirmDialog.ts', 'UI/Dialogs/ConfirmDialog.ts'),
    # 公共行组件
    ('UIPublic/Scripts/AchRow.ts', 'UI/Common/AchRow.ts'),
    ('UIPublic/Scripts/LocLabel.ts', 'UI/Common/LocLabel.ts'),
    ('UIPublic/Scripts/StatRow.ts', 'UI/Common/StatRow.ts'),
    ('UIPublic/Scripts/StepperRow.ts', 'UI/Common/StepperRow.ts'),
    ('UIPublic/Scripts/ToggleRow.ts', 'UI/Common/ToggleRow.ts'),
    # 已退役（保留可回溯）
    ('UIPublic/Scripts/UIFit.ts', 'UI/_legacy/UIFit.ts'),
]

# 脚本 import 路径改写：UIRes 里的老写法 -> Scripts/UI/<sub>/ 下的新写法
IMPORT_RULES = [
    # 页面 / 弹窗（深度 assets/Scripts/UI/Pages|Dialogs）
    ("'../../../../Scripts/Core/", "'../../Core/"),
    ("'../../../../Scripts/Load/", "'../../Load/"),
    ("'../../../../Scripts/UI/UIBase'", "'../UIBase'"),
    ("'../../../../Scripts/UI/UIKit'", "'../UIKit'"),
    ("'../../../../Scripts/UI/Ads'", "'../Ads'"),
    ("'../../../../Scripts/UI/Toast'", "'../Toast'"),
    ("'../../UIPublic/Scripts/", "'../Common/"),
    # 公共组件（深度 assets/Scripts/UI/Common）
    ("'../../../../Scripts/Core/", "'../../Core/"),
    ("'../../../../Scripts/UI/UIKit'", "'../UIKit'"),
]

# ---------------------------------------------------------------- 3. 贴图
# 88 张 ui 贴图 -> 八个子类
UI_TEX_GROUPS = {
    'nine': ['nine_base', 'nine_gloss', 'nine_stroke',
             'nine_chip', 'nine_chip_gloss', 'nine_chip_stroke'],
    'panel': ['panel_wood', 'panel_deco', 'card', 'card_dark', 'card_white',
              'round_rect', 'round_soft', 'slot', 'slot_hover',
              'sq_brown', 'sq_brown2', 'sq_grey', 'bg_placeholder'],
    'button': ['btn_blue', 'btn_close', 'btn_home', 'btn_orange', 'btn_small_blue',
               'btn_long_active', 'btn_long_hover', 'btn_long_inactive',
               'btn2_blue_active', 'btn2_blue_inactive', 'btn2_grey_inactive',
               'btn2_plain_active', 'btn2_plain_inactive', 'btn2_purple_inactive',
               'btn2_red_active', 'btn2_red_inactive',
               'list_select', 'wood_tab', 'wood_tab_dark'],
    'icon': ['app_logo', 'gam_icon', 'ksp', 'coin', 'circle78',
             'circle_outline', 'circle_ring', 'arrow_l', 'arrow_r',
             'icon_40', 'icon_ach', 'icon_ach2', 'icon_back', 'icon_cross',
             'icon_discord', 'icon_gear', 'icon_hand', 'icon_mail', 'icon_medal',
             'icon_save', 'icon_shop', 'icon_shop2', 'icon_skill', 'icon_skill2',
             'icon_star2', 'icon_stat', 'icon_steam', 'icon_steam2',
             'icon_up', 'icon_upgrade', 'x_bg', 'x_logo', 'x_mail'],
    'bar': ['bar_bg', 'bar_fill', 'bar_fill2', 'color_bar',
            'boot_bar_fill', 'boot_bar_rider', 'boot_bar_track'],
    'deco': ['wood_banner_l', 'wood_banner_m', 'wood_banner_r', 'wood_rail'],
    'pixel': ['px_circle', 'px_dot', 'px_white', 'px_white2'],
    'misc': ['asset53', 'asset54'],
}

# name -> sub
TEX_SUB = {}
for _sub, _names in UI_TEX_GROUPS.items():
    for _n in _names:
        assert _n not in TEX_SUB, '重复分类: ' + _n
        TEX_SUB[_n] = _sub


def log(msg):
    print(msg)


def mv(src, dst):
    """移动文件及其同名 .meta。"""
    if not os.path.isfile(src):
        raise RuntimeError('源文件不存在: ' + src)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if WRITE:
        shutil.move(src, dst)
        if os.path.isfile(src + '.meta'):
            shutil.move(src + '.meta', dst + '.meta')
    log(('  mv  ' if WRITE else '  [dry] ') + rel(src) + '  ->  ' + rel(dst))


def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')


def rewrite(path, rules):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    out = src
    for a, b in rules:
        out = out.replace(a, b)
    if out != src:
        if WRITE:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(out)
        log(('  edit ' if WRITE else '  [dry] edit ') + rel(path))
    return out != src


# ================================================================ 主流程
def main():
    log('== ROOT ' + ROOT)
    log('== 模式: ' + ('WRITE' if WRITE else 'DRY-RUN'))

    # ---- 1) 预制体 ----
    log('\n[1] UI 预制体 -> resources/Prefabs/UI/')
    for n in UI_PREFAB_NAMES:
        mv(os.path.join(RES, 'UIRes', n, 'Prefabs', n + '.prefab'),
           os.path.join(RES, 'Prefabs', 'UI', n + '.prefab'))

    # ---- 2) 脚本 ----
    log('\n[2] UI 脚本 -> assets/Scripts/UI/{Pages,Dialogs,Common,_legacy}/')
    moved_scripts = []
    for src_rel, dst_rel in SCRIPT_MOVES:
        src = os.path.join(RES, 'UIRes', src_rel)
        dst = os.path.join(SCRIPTS, dst_rel)
        mv(src, dst)
        # 干跑时文件还在源位置，改 import 就读源文件
        moved_scripts.append(dst if os.path.isfile(dst) else src)

    log('\n[2b] 脚本 import 路径改写')
    for p in moved_scripts:
        rewrite(p, IMPORT_RULES)

    # ---- 3) 贴图 ----
    log('\n[3] UI 贴图 -> Textures/ui/<sub>/')
    tex_dir = os.path.join(RES, 'Textures', 'ui')
    existing = [f[:-4] for f in os.listdir(tex_dir) if f.endswith('.png')]
    unknown = sorted(set(existing) - set(TEX_SUB))
    if unknown:
        raise RuntimeError('有贴图没分类: ' + ', '.join(unknown))
    for n in sorted(existing):
        sub = TEX_SUB[n]
        mv(os.path.join(tex_dir, n + '.png'),
           os.path.join(tex_dir, sub, n + '.png'))

    # ---- 4) 逻辑 key 改写（Res.ts 的 TEXTURE_PATHS + 全部调用方） ----
    log('\n[4] 逻辑 key 改写  ui/<name> -> ui/<sub>/<name>')
    # 长名优先，避免 'ui/nine_chip' 误伤 'ui/nine_chip_gloss'（都带引号也做一次保险）
    for n in sorted(TEX_SUB, key=len, reverse=True):
        rules = [("'Textures/ui/%s/spriteFrame'" % n, "'Textures/ui/%s/%s/spriteFrame'" % (TEX_SUB[n], n)),
                 ("'ui/%s'" % n, "'ui/%s/%s'" % (TEX_SUB[n], n))]
        for dp, _dn, fns in os.walk(SCRIPTS):
            for fn in fns:
                if fn.endswith('.ts'):
                    rewrite(os.path.join(dp, fn), rules)

    # ---- 5) 清理空目录 ----
    log('\n[5] 清理 UIRes 空目录')
    uires = os.path.join(RES, 'UIRes')
    if os.path.isdir(uires):
        leftovers = [os.path.join(dp, f) for dp, _dn, fns in os.walk(uires) for f in fns]
        if leftovers:
            log('  ⚠️ 仍有残留文件，跳过删除：')
            for f in leftovers:
                log('     ' + rel(f))
        else:
            if WRITE:
                shutil.rmtree(uires)
                if os.path.isfile(uires + '.meta'):
                    os.remove(uires + '.meta')
            log(('  rm -r ' if WRITE else '  [dry] rm -r ') + rel(uires) + ' (+ .meta)')

    log('\n== 完成' + ('' if WRITE else '（干跑，未改动任何文件）'))


if __name__ == '__main__':
    main()
