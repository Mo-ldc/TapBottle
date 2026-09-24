"""
扫描编译产物，建立「脚本类名 → cid」映射表。

Cocos 3.8 的 .scene/.prefab 里，用户脚本组件的 "__type__" 不是脚本 uuid，
而是编译期生成并写死进产物的 22 字符 cid（形如 _RF.push({}, "<cid>", "<Class>", ...)）。
所以手写场景必须先查这张表，否则构建会报：
  Script "<uuid>" attached to "<node>" in scene "<x>" is missing or invalid.

产物位置：temp/programming/packer-driver/targets/{editor,preview}/chunks/**/*.js
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, '.workbuddy', '_cid_map.json')
PROG = os.path.join(ROOT, 'temp', 'programming')

PAT = re.compile(r'_RF\.push\(\{\}\s*,\s*"([A-Za-z0-9+/]{20,24})"\s*,\s*"([A-Za-z_$][\w$]*)"')


def scan():
    if not os.path.isdir(PROG):
        return {}
    m = {}
    n = 0
    for base, _dirs, files in os.walk(PROG):
        for f in files:
            if not f.endswith('.js'):
                continue
            p = os.path.join(base, f)
            try:
                s = open(p, encoding='utf-8', errors='replace').read()
            except Exception:
                continue
            for cid, cls in PAT.findall(s):
                n += 1
                if cls not in m:
                    m[cls] = cid
    return m


def load(refresh=False):
    if not refresh and os.path.exists(OUT):
        try:
            return json.load(open(OUT, encoding='utf-8'))
        except Exception:
            pass
    m = scan()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(m, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return m


if __name__ == '__main__':
    m = load(refresh=True)
    print('scanned %d classes ->' % len(m), OUT)
    for k in sorted(m):
        print('  %-18s %s' % (k, m[k]))
    for want in sys.argv[1:]:
        print('QUERY %-16s -> %s' % (want, m.get(want, 'NOT FOUND')))
