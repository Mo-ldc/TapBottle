#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 assets/Scripts/Core/Locale.ts 里抠出 key → {zh, en} 表。

用途：生成 prefab 时给 Label 填**真实中文文案**而不是空串。

⚠️ 为什么必须填真文案（血泪）：在编辑器里打开 prefab 再保存时，Cocos 的 Label
   会按 `string` 重算节点 contentSize —— 空字符串的 Label 会被算成 width=0，
   布局当场塌掉（`ptitle` 680x120 被写成 6x121.92）。填上文案后所见即所得。
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'Scripts', 'Core', 'Locale.ts')
OUT = os.path.join(ROOT, '.workbuddy', '_locale.json')

PAT = re.compile(
    r"^\s{4}([A-Za-z_$][\w$]*)\s*:\s*\{\s*zh\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*en\s*:\s*'((?:[^'\\]|\\.)*)'\s*\}",
    re.MULTILINE,
)


def unesc(s):
    return s.replace("\\'", "'").replace('\\n', '\n').replace('\\\\', '\\')


def build():
    src = open(SRC, encoding='utf-8').read()
    m = {}
    for k, zh, en in PAT.findall(src):
        m[k] = {'zh': unesc(zh), 'en': unesc(en)}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(m, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return m


if __name__ == '__main__':
    m = build()
    print(len(m), 'keys ->', OUT)
