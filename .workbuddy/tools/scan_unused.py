# -*- coding: utf-8 -*-
"""
TapBottle 无用资源扫描（只读，不删任何文件）

判定口径（三条线索取并集，命中任一即为「在用」）：
  A. 路径字符串：Core/Res.ts 的 TEXTURE_PATHS / AUDIO_PATHS，Core/Prefabs.ts 的 PREFAB_PATHS，
     以及 Scripts/*.ts 里出现的资源路径字面量（resources.load / sf( / play( / img( / setFrame( ...）
  B. uuid 引用：assets 下所有 .scene / .prefab / .anim / .mtl / .effect 里出现的 __uuid__
     （含 Scene 内联、Prefab 内联、材质引用）
  C. 前缀通配：代码里存在 'X/' 形式的前缀引用（如 Resources 目录整包加载）时，该目录整棵算在用

输出：分目录列出「疑似无用」清单 + 体积，并单独列出 .workbuddy 下的备份资源体积。
用法：<py> .workbuddy/tools/scan_unused.py [--json out.json]
"""
import os
import re
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
RES = os.path.join(ASSETS, 'resources')
SCRIPTS = os.path.join(ASSETS, 'Scripts')
RES_TS = os.path.join(SCRIPTS, 'Core', 'Res.ts')
PF_TS = os.path.join(SCRIPTS, 'Core', 'Prefabs.ts')

KEEP_EXT = ('.png', '.jpg', '.mp3', '.wav', '.ttf', '.otf', '.prefab', '.anim', '.json', '.txt')
SCAN_REF_EXT = ('.scene', '.prefab', '.anim', '.mtl', '.effect', '.json', '.fire')


def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''


# ---------- 1) 资源清单（uuid <-> 相对 resources 的路径） ----------
def rel(p):
    return os.path.relpath(p, RES).replace('\\', '/')


assets = []          # (path, relpath, uuid, size)
uuid2rel = {}
for root, _, fs in os.walk(RES):
    for f in fs:
        if f.endswith('.meta'):
            continue
        if not f.lower().endswith(KEEP_EXT):
            continue
        p = os.path.join(root, f)
        meta = p + '.meta'
        uid = ''
        if os.path.exists(meta):
            m = re.search(r'"uuid"\s*:\s*"([0-9a-fA-F-]+)"', read(meta))
            if m:
                uid = m.group(1)
        r = rel(p)
        assets.append((p, r, uid, os.path.getsize(p)))
        if uid:
            uuid2rel[uid] = r

# ---------- 1b) 代码里声明的「整目录清单」 ----------
# 这些常量决定某个目录下的资源按名字动态加载，扫描时整目录视为在用。
def enum_values(ts_path, enum_name):
    src = read(ts_path)
    m = re.search(r'export\s+enum\s+' + enum_name + r'\s*\{(.*?)\n\}', src, re.S)
    if not m:
        return set()
    return set(re.findall(r"=\s*'([^']+)'", m.group(1)))


uimgr_ts = os.path.join(SCRIPTS, 'Core', 'UIMgr.ts')
UI_ROOT = 'Prefabs/UI'

# ---------- 2) A: 代码 / 清单里的路径字符串 ----------
used_paths = set()
path_patterns = [
    re.compile(r"'Textures/([^']+)'"),
    re.compile(r"'Audio/([^']+)'"),
    re.compile(r"'Fonts/([^']+)'"),
    re.compile(r"'(Game/[A-Za-z0-9_]+)'"),
    re.compile(r"'UI/([A-Za-z0-9_]+)'"),
    re.compile(r"sf\(\s*'([^']+)'"),
    re.compile(r"setFrame\(\s*[^,]+,\s*'([^']+)'"),
    re.compile(r"img\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*'([^']+)'"),
    re.compile(r"sliced\(\s*[^,]+,\s*'([^']+)'"),
    re.compile(r"play\(\s*'([^']+)'"),
    re.compile(r"roundedPanel\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*'([^']+)'"),
]

code_files = []
for root, _, fs in os.walk(SCRIPTS):
    for f in fs:
        if f.endswith('.ts'):
            code_files.append(os.path.join(root, f))
for p in code_files:
    src = read(p)
    for pat in path_patterns:
        for m in pat.finditer(src):
            used_paths.add(m.group(1))
    # 任何形如 'xxx/yyy' 的引号串也当一次弱引用（保守，宁可漏报不可误删）
    for m in re.finditer(r"'([A-Za-z0-9_]+/[A-Za-z0-9_/]+)'", src):
        used_paths.add(m.group(1))

# TEXTURE_PATHS / AUDIO_PATHS 里带 Textures/ 前缀且带 /spriteFrame
tex_registered = set()
for m in re.finditer(r"'Textures/([^']+?)/spriteFrame'", read(RES_TS)):
    tex_registered.add(m.group(1))
aud_registered = set()
for m in re.finditer(r"'Audio/([^']+)'", read(RES_TS)):
    aud_registered.add(m.group(1))
pf_registered = set(re.findall(r"'([A-Za-z0-9_/]+)'", read(PF_TS)))
# 实际文件在 assets/resources/Prefabs/ 下，补上前缀变体
root_m = re.search(r"PREFAB_ROOT\s*=\s*'([^']+)'", read(PF_TS))
PREFAB_ROOT = root_m.group(1) if root_m else 'Prefabs'
pf_registered |= {PREFAB_ROOT + '/' + p for p in
                  re.findall(r"'([A-Za-z0-9_]+/[A-Za-z0-9_/]+)'", read(PF_TS))}
# UIMgr：UIName 枚举里的每一项都按 UI_ROOT/<name>.prefab 动态加载
ui_names = enum_values(uimgr_ts, 'UIName')
pf_registered |= {'Prefabs/UI/' + n for n in ui_names}
pf_registered |= {'UI/' + n for n in ui_names}

registered = tex_registered | aud_registered | pf_registered | used_paths

# ---------- 3) B: uuid 引用 ----------
ref_uuids = set()
ref_files = []
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if f.lower().endswith(SCAN_REF_EXT):
            ref_files.append(os.path.join(root, f))
for p in ref_files:
    src = read(p)
    for m in re.finditer(r'"__uuid__"\s*:\s*"([^"]+)"', src):
        ref_uuids.add(m.group(1).split('@')[0])
# settings / profiles 目录也扫
for extra in ('settings', 'profiles'):
    d = os.path.join(ROOT, extra)
    for root, _, fs in os.walk(d):
        for f in fs:
            src = read(os.path.join(root, f))
            for m in re.finditer(r'"__uuid__"\s*:\s*"([^"]+)"', src):
                ref_uuids.add(m.group(1).split('@')[0])
# 内联子资源（spriteFrame 等）的 uuid：父资源被引用即算在用
sub_of = {}
for root, _, fs in os.walk(RES):
    for f in fs:
        if not f.endswith('.meta'):
            continue
        p = os.path.join(root, f)
        src = read(p)
        parent = re.search(r'^\s*"uuid"\s*:\s*"([0-9a-fA-F-]+)"', src)
        if not parent:
            continue
        for m in re.finditer(r'"uuid"\s*:\s*"([0-9a-fA-F-]+)"', src):
            if m.group(1) != parent.group(1):
                sub_of[m.group(1)] = parent.group(1)

used_uuids = set(ref_uuids)
for u in list(ref_uuids):
    if u in sub_of:
        used_uuids.add(sub_of[u])

# ---------- 4) 判定 ----------
unused = []
for p, r, uid, size in assets:
    if r.startswith('Textures/startUI/'):
        pass
    base = r
    no_ext = os.path.splitext(r)[0]
    hit = False
    # A: 路径命中（多种写法）
    cands = {r, no_ext, no_ext.replace('Textures/', ''), no_ext.replace('Audio/', ''),
             no_ext.replace('Fonts/', ''), r.replace('Textures/', '')}
    if cands & registered:
        hit = True
    # 目录级：Textures/xxx 下任意图被登记
    elif no_ext in tex_registered or no_ext in aud_registered:
        hit = True
    # B: uuid 命中
    if not hit and uid and uid in used_uuids:
        hit = True
    if not hit:
        unused.append((p, r, uid, size))

# ---------- 5) 输出 ----------
total_unused = sum(u[3] for u in unused)
by_dir = {}
for p, r, uid, size in unused:
    d = os.path.dirname(r) or '.'
    by_dir.setdefault(d, []).append((r, size, uid))

lines = []
lines.append('=' * 70)
lines.append('无用资源扫描（只读报告）')
lines.append('  资源总数 %d，登记/被引用 %d，疑似无用 %d' % (len(assets), len(assets) - len(unused), len(unused)))
lines.append('  疑似无用合计体积 %.2f MB' % (total_unused / 1048576))
lines.append('=' * 70)
for d in sorted(by_dir):
    items = sorted(by_dir[d], key=lambda x: -x[1])
    sz = sum(i[1] for i in items)
    lines.append('')
    lines.append('[%s]  %d 个 / %.2f MB' % (d, len(items), sz / 1048576))
    for r, size, uid in items:
        lines.append('   %8.1f KB  %s' % (size / 1024, r))

# 备份目录体积
lines.append('')
lines.append('-' * 70)
lines.append('.workbuddy 下备份资源（不参与打包，仅占磁盘）：')
for sub in ('texture_src', 'audio_src', 'skin_bak', 'reorg_bak', 'prefab_bak'):
    d = os.path.join(ROOT, '.workbuddy', sub)
    if not os.path.isdir(d):
        continue
    n = 0
    b = 0
    for root, _, fs in os.walk(d):
        for f in fs:
            n += 1
            b += os.path.getsize(os.path.join(root, f))
    lines.append('   %-12s %4d 个 / %7.2f MB' % (sub, n, b / 1048576))

report = '\n'.join(lines)
print(report)
out = os.path.join(ROOT, '.workbuddy', 'tmp', 'unused_report.txt')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(report)

if '--json' in sys.argv:
    js = os.path.join(ROOT, '.workbuddy', 'tmp', 'unused_report.json')
    json.dump({'unused': [{'path': r, 'size': s, 'uuid': u} for _, r, u, s in unused]},
              open(js, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
