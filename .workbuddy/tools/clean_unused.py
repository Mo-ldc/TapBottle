# -*- coding: utf-8 -*-
"""
清理无用资源（分两步：先 dry-run 列清单，再 --go 真删）

范围（用户 2026-09-28 确认）：
  A. .workbuddy 下历次无头验收残留：42 个 Chrome profile 目录 + tmp/ 旧截图日志 + 顶层旧日志/截图/场景备份
  C. assets/resources 里零引用的死资源（字体/文案 json/旧加载条/杂项图）

显式保留：
  .workbuddy/{memory,skills,tools}、*.tpl 验收模板、unused_report.*、
  备份目录 texture_src / audio_src / skin_bak / reorg_bak / prefab_bak / scene_bak、
  build/ library/ temp/（用户未勾选）、Textures/startUI/bd08.png（用户未勾选）
"""
import os
import sys
import glob
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W = os.path.join(ROOT, '.workbuddy')
GO = '--go' in sys.argv

# ---------- A: 验收残留 ----------
def scratch_targets():
    out = []
    # A1 .workbuddy 顶层 Chrome profile 目录
    for p in glob.glob(os.path.join(W, '*')):
        if os.path.isdir(p) and 'prof' in os.path.basename(p).lower():
            out.append(p)
    # A2 tmp/ 下 Chrome profile / cdp 目录
    tmp = os.path.join(W, 'tmp')
    for p in glob.glob(os.path.join(tmp, '*')):
        b = os.path.basename(p)
        if os.path.isdir(p) and ('prof' in b.lower() or b.lower().startswith('cdp')):
            out.append(p)
    # A3 tmp/ 下散件（保留 .tpl 模板 / unused_report.*）
    for p in glob.glob(os.path.join(tmp, '*')):
        if os.path.isdir(p):
            continue
        b = os.path.basename(p)
        if b.endswith('.tpl') or b.startswith('unused_report'):
            continue
        out.append(p)
    # A4 .workbuddy 顶层旧日志 / 截图 / 旧报告 txt（保留 .json 索引 与 .tpl 模板）
    for p in glob.glob(os.path.join(W, '*')):
        if not os.path.isfile(p):
            continue
        b = os.path.basename(p)
        if b.endswith(('.tpl', '.json', '.py')):
            continue
        if b.endswith(('.log', '.png', '.txt')) or b.startswith('_'):
            out.append(p)
    # A5 顶层旧场景 / prefab 备份
    for p in glob.glob(os.path.join(W, '_*')):
        if os.path.isfile(p) and p.endswith(('.scene', '.prefab')):
            out.append(p)
    return sorted(set(out))


# ---------- C: 项目内死资源 ----------
DEAD_ASSETS = [
    'assets/resources/Fonts/Lato-Semibold.ttf',
    'assets/resources/Fonts/OrangeKid.ttf',
    'assets/resources/Text/zh.json',
    'assets/resources/Text/en.json',
    'assets/resources/Textures/ui/bar/boot_bar_track.png',
    'assets/resources/Textures/ui/bar/boot_bar_rider.png',
    'assets/resources/Textures/ui/bar/boot_bar_fill.png',
    'assets/resources/Textures/ui/misc/tri_play.png',
]


def fsize(p):
    if os.path.isfile(p):
        return os.path.getsize(p)
    b = 0
    for r, _, fs in os.walk(p):
        for f in fs:
            try:
                b += os.path.getsize(os.path.join(r, f))
            except OSError:
                pass
    return b


def main():
    A = scratch_targets()
    C = []
    for rel in DEAD_ASSETS:
        p = os.path.join(ROOT, rel.replace('/', os.sep))
        if os.path.exists(p):
            C.append(p)
            if os.path.exists(p + '.meta'):
                C.append(p + '.meta')

    print('=' * 72)
    print('A. 验收残留清理清单（%d 项，%.1f MB）' % (len(A), sum(fsize(p) for p in A) / 1048576))
    print('=' * 72)
    for p in A:
        print('   %-64s %9.1f KB' % (os.path.relpath(p, ROOT), fsize(p) / 1024))
    print()
    print('=' * 72)
    print('C. 项目内死资源（%d 项，%.2f MB）' % (len(C), sum(fsize(p) for p in C) / 1048576))
    print('=' * 72)
    for p in C:
        print('   %-64s %9.1f KB' % (os.path.relpath(p, ROOT), fsize(p) / 1024))

    if not GO:
        print()
        print('[dry-run] 未删除任何文件。加 --go 执行。')
        return

    # 备份 C 类（便宜，留回滚）
    bak = os.path.join(W, 'dead_res_bak')
    for p in C:
        rel = os.path.relpath(p, ROOT)
        d = os.path.join(bak, rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(d), exist_ok=True)
        if not os.path.exists(d):
            shutil.copy2(p, d)

    freed = 0
    for p in A + C:
        freed += fsize(p)
        try:
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
            else:
                os.remove(p)
        except OSError as e:
            print('  ! 删除失败', p, e)
    print()
    print('已删除 %d 项，释放 %.2f GB' % (len(A) + len(C), freed / 1073741824))
    print('C 类备份 -> %s' % os.path.relpath(bak, ROOT))


main()
