# -*- coding: utf-8 -*-
"""
把判定无用的图片资源「移出」assets -> .workbuddy/unused_park/（保留原相对路径 + .meta）

用法：
  park_unused.py --list      只显示清单（dry-run）
  park_unused.py --go        执行移动
  park_unused.py --restore   从 unused_park 一键移回 assets

清单来源：.workbuddy/tmp/verify_unused.json（先跑 verify_unused.py）
特点：
  - 移动而非删除：unused_park 里原样保留目录结构，随时可回滚
  - png 与 png.meta 成对移动
  - 若目录因此变空，目录级 .meta 一并移走并删空目录（assets 根除外）
"""
import os
import sys
import json
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = os.path.join(ROOT, '.workbuddy', 'tmp')
PARK = os.path.join(ROOT, '.workbuddy', 'unused_park')
MANIFEST = os.path.join(TMP, 'park_manifest.json')

GO = '--go' in sys.argv
RESTORE = '--restore' in sys.argv


def move(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(src, dst)


def prune_empty_dirs(start_dir):
    """自底向上：若目录里只剩 .meta（或全空），把目录 .meta 移入 park 并删空目录。到 assets 根为止。"""
    assets_root = os.path.join(ROOT, 'assets')
    changed = True
    while changed:
        changed = False
        for root, dirs, fs in os.walk(assets_root, topdown=False):
            if os.path.abspath(root) == os.path.abspath(assets_root):
                continue
            real = [f for f in fs if not f.endswith('.meta')]
            if real or dirs:
                continue
            # 目录已无实际文件/子目录 -> 移走该目录的 .meta，删目录
            dmeta = root + '.meta'
            rel = os.path.relpath(root, ROOT).replace('\\', '/')
            if os.path.exists(dmeta):
                move(dmeta, os.path.join(PARK, os.path.relpath(dmeta, ROOT).replace('\\', '/')))
            os.rmdir(root)
            print('   [目录] %s (空, 目录.meta 已移走)' % rel)
            changed = True


def do_park():
    data = json.load(open(MANIFEST, encoding='utf-8'))
    items = data['items']
    moved = 0
    for rel in items:
        src = os.path.join(ROOT, rel.replace('/', os.sep))
        meta = src + '.meta'
        if not os.path.exists(src):
            print('   ! 缺文件跳过: %s' % rel)
            continue
        dst = os.path.join(PARK, rel.replace('/', os.sep))
        if os.path.exists(dst):
            print('   ! park 已有同名, 跳过: %s' % rel)
            continue
        if GO:
            move(src, dst)
            if os.path.exists(meta):
                move(meta, os.path.join(PARK, (rel + '.meta').replace('/', os.sep)))
        print('   %s' % rel)
        moved += 1
    if GO:
        prune_empty_dirs(os.path.join(ROOT, 'assets'))
        print()
        print('已移出 %d 张图片 -> %s' % (moved, os.path.relpath(PARK, ROOT)))
    else:
        print()
        print('[dry-run] 共 %d 张，未移动。加 --go 执行。' % moved)


def do_restore():
    if not os.path.isdir(PARK):
        print('park 不存在，无需恢复')
        return
    n = 0
    for root, _, fs in os.walk(PARK):
        for f in fs:
            src = os.path.join(root, f)
            rel = os.path.relpath(src, PARK).replace('\\', '/')
            dst = os.path.join(ROOT, rel.replace('/', os.sep))
            if os.path.exists(dst):
                print('   ! 目标已存在, 跳过: %s' % rel)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            n += 1
    # 清掉 park 里的空目录
    for root, dirs, fs in os.walk(PARK, topdown=False):
        for d in dirs:
            p = os.path.join(root, d)
            try:
                os.rmdir(p)
            except OSError:
                pass
    print('已移回 %d 个文件' % n)


if RESTORE:
    do_restore()
else:
    # 收集清单：verify_unused.json 的 dead 项
    v = json.load(open(os.path.join(TMP, 'verify_unused.json'), encoding='utf-8'))
    items = [d['rel'] for d in v['dead']]
    json.dump({'items': items}, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(ROOT, r.replace('/', os.sep)))
                for r in items if os.path.exists(os.path.join(ROOT, r.replace('/', os.sep))))
    print('清单 %d 项, 合计 %.2f MB -> %s' % (len(items), total / 1048576,
                                            os.path.relpath(PARK, ROOT)))
    print()
    do_park()
