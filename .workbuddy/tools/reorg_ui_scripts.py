# -*- coding: utf-8 -*-
"""
reorg_ui_scripts.py —— `assets/Scripts/UI/` 内部按职责分类。

    UI/UIBase.ts UIKit.ts Theme.ts Modal.ts Toast.ts Ads.ts
        -> UI/Base/           （基础设施：基类 / 工厂 / 皮肤 / 模态 / 提示 / 广告接入）

    UI/AdButtons.ts UpgradeRows.ts + UI/Common/*.ts
        -> UI/Widgets/        （可复用控件：广告角标 / 面板一格 / 五个行控件）

    UI/Hud.ts BottomPanel.ts Guidance.ts
        -> UI/Hud/            （主界面：顶栏 / 底栏 / 购买引导）

    UI/Panel.ts AchPanel.ts SettingsPanel.ts StatsPanel.ts
        -> UI/Panels/         （内嵌面板体系）

    UI/Pages/ UI/Dialogs/ UI/_legacy/  保持不动。

★ import 重写用「解析绝对目标 → 按新位置重算相对路径」，不是字符串替换
  —— 因为连**未移动**的文件（如 Core/UIMgr.ts、GameRoot.ts、Game/*.ts）都要改，
  它们的导入目标跑到子目录里去了。

⚠️ 只动「文件 + 同名 .meta」，uuid 不变 → prefab 里的脚本 cid 引用无需改动。

用法：
    python reorg_ui_scripts.py            # 干跑
    python reorg_ui_scripts.py --write
"""
import os
import posixpath
import re
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCRIPTS = os.path.join(ROOT, 'assets', 'Scripts')
WRITE = '--write' in sys.argv

# 相对 assets/Scripts/ 的迁移表
MOVES = {
    'UI/UIBase.ts': 'UI/Base/UIBase.ts',
    'UI/UIKit.ts': 'UI/Base/UIKit.ts',
    'UI/Theme.ts': 'UI/Base/Theme.ts',
    'UI/Modal.ts': 'UI/Base/Modal.ts',
    'UI/Toast.ts': 'UI/Base/Toast.ts',
    'UI/Ads.ts': 'UI/Base/Ads.ts',

    'UI/AdButtons.ts': 'UI/Widgets/AdButtons.ts',
    'UI/UpgradeRows.ts': 'UI/Widgets/UpgradeRows.ts',
    'UI/Common/AchRow.ts': 'UI/Widgets/AchRow.ts',
    'UI/Common/LocLabel.ts': 'UI/Widgets/LocLabel.ts',
    'UI/Common/StatRow.ts': 'UI/Widgets/StatRow.ts',
    'UI/Common/StepperRow.ts': 'UI/Widgets/StepperRow.ts',
    'UI/Common/ToggleRow.ts': 'UI/Widgets/ToggleRow.ts',

    'UI/Hud.ts': 'UI/Hud/Hud.ts',
    'UI/BottomPanel.ts': 'UI/Hud/BottomPanel.ts',
    'UI/Guidance.ts': 'UI/Hud/Guidance.ts',

    'UI/Panel.ts': 'UI/Panels/Panel.ts',
    'UI/AchPanel.ts': 'UI/Panels/AchPanel.ts',
    'UI/SettingsPanel.ts': 'UI/Panels/SettingsPanel.ts',
    'UI/StatsPanel.ts': 'UI/Panels/StatsPanel.ts',
}

# 迁移后每个文件的新位置（含未移动的：新位置 = 老位置）
NEWOF = dict(MOVES)
OLDOF = {v: k for k, v in MOVES.items()}

IMPORT_RE = re.compile(r"""(from\s+)(['"])(\.[^'"]*)(\2)""")


def norm(p):
    return posixpath.normpath(p.replace('\\', '/'))


def new_path_of(old_rel):
    """老相对路径 -> 新相对路径（未移动的原样返回）。"""
    return NEWOF.get(old_rel, old_rel)


def old_path_of(cur_rel):
    """当前（新）相对路径 -> 迁移前的老相对路径。"""
    return OLDOF.get(cur_rel, cur_rel)


def rel_of(abs_path):
    return norm(os.path.relpath(abs_path, SCRIPTS))


def rewrite_imports(cur_rel, text):
    """把 text 里所有相对 import 指向的目标，按新布局重算。

    ⚠️ src_dir_old 用「迁移前」目录（当前磁盘布局），src_dir_new 必须用**迁移后**目录
       —— 否则同目录内的引用（如 Base/ 里 UIBase -> Modal）会被算成 ./Base/Modal。
    """
    src_dir_old = posixpath.dirname(old_path_of(cur_rel))
    src_dir_new = posixpath.dirname(new_path_of(cur_rel))
    hits = []

    def repl(m):
        head, q, spec, _ = m.groups()
        # 目标文件在**老布局**下的路径（import 不带 .ts）
        tgt_old = norm(posixpath.join(src_dir_old, spec))
        tgt_old_ts = tgt_old + '.ts'
        if not os.path.isfile(os.path.join(SCRIPTS, tgt_old_ts.replace('/', os.sep))):
            hits.append((spec, spec, 'MISS'))
            return m.group(0)
        tgt_new = new_path_of(tgt_old_ts)[:-3]           # 去掉 .ts
        new_spec = norm(posixpath.relpath(tgt_new, src_dir_new or '.'))
        if not new_spec.startswith('.'):
            new_spec = './' + new_spec
        if new_spec != spec:
            hits.append((spec, new_spec, ''))
        return head + q + new_spec + q

    out = IMPORT_RE.sub(repl, text)
    return out, hits


def mv(src_abs, dst_abs):
    if not os.path.isfile(src_abs):
        raise RuntimeError('源文件不存在: ' + src_abs)
    os.makedirs(os.path.dirname(dst_abs), exist_ok=True)
    if WRITE:
        shutil.move(src_abs, dst_abs)
        if os.path.isfile(src_abs + '.meta'):
            shutil.move(src_abs + '.meta', dst_abs + '.meta')


def main():
    print('== %s 模式' % ('WRITE' if WRITE else 'DRY-RUN'))
    for k in MOVES:
        if not os.path.isfile(os.path.join(SCRIPTS, k.replace('/', os.sep))):
            raise SystemExit('迁移表里的文件不存在: ' + k)
    # 反向映射不能有重复目标
    assert len(set(MOVES.values())) == len(MOVES), '目标路径重复'
    for v in MOVES.values():
        if v in MOVES and MOVES[v] != v:
            raise SystemExit('目标又出现在源里，会互相覆盖: ' + v)

    # ---- 1) 先重写所有 .ts 的 import（在移动之前按老布局解析）----
    print('\n[1] 重写 import（全量扫描 assets/Scripts）')
    all_ts = []
    for dp, _dn, fns in os.walk(SCRIPTS):
        for f in fns:
            if f.endswith('.ts') and not f.endswith('.d.ts'):
                all_ts.append(rel_of(os.path.join(dp, f)))
    edited = 0
    for r in sorted(all_ts):
        p = os.path.join(SCRIPTS, r.replace('/', os.sep))
        with open(p, encoding='utf-8') as fh:
            src = fh.read()
        out, hits = rewrite_imports(r, src)
        real = [h for h in hits if h[2] != 'MISS']
        miss = [h for h in hits if h[2] == 'MISS']
        for h in miss:
            print('  ⚠️ 解析不到目标，原样保留: %s :: %s' % (r, h[0]))
        if out != src:
            edited += 1
            print('  %s %s' % ('edit ' if WRITE else '[dry] edit', r))
            for a, b, _ in real:
                print('        %-28s -> %s' % (a, b))
            if WRITE:
                with open(p, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(out)
    print('  共 %d 个文件需要改' % edited)

    # ---- 2) 移动文件 ----
    print('\n[2] 移动文件 + .meta')
    for k in sorted(MOVES):
        src = os.path.join(SCRIPTS, k.replace('/', os.sep))
        dst = os.path.join(SCRIPTS, MOVES[k].replace('/', os.sep))
        print('  %s %-30s -> %s' % ('mv   ' if WRITE else '[dry] mv', k, MOVES[k]))
        mv(src, dst)

    # ---- 3) 清理空目录 ----
    print('\n[3] 清理空目录')
    for d in ['UI/Common']:
        abs_d = os.path.join(SCRIPTS, d.replace('/', os.sep))
        if not os.path.isdir(abs_d):
            continue
        left = [f for f in os.listdir(abs_d) if not f.endswith('.meta')]
        if left:
            print('  ⚠️ %s 仍有非 meta 文件，保留: %s' % (d, left))
            continue
        print('  %s %s (+ .meta)' % ('rm -r' if WRITE else '[dry] rm -r', d))
        if WRITE:
            shutil.rmtree(abs_d)
            if os.path.isfile(abs_d + '.meta'):
                os.remove(abs_d + '.meta')

    print('\n== 完成' + ('' if WRITE else '（干跑）'))


if __name__ == '__main__':
    main()
