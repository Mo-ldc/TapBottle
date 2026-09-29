# -*- coding: utf-8 -*-
"""
探针：读取**编辑器 prefab 面板内存里**的 Label 真实值。

为什么需要它：prefab 文件被外部脚本改过之后，编辑器里已经打开的编辑面板可能仍持有
旧的内存副本 —— 此时面板显示「没改」，而一旦按保存就会把旧数据写回文件（覆盖外部改动）。
本探针直接问编辑器场景进程要 Label.string，以此判定面板是旧是新。

用法：python .workbuddy/tools/mcp_probe_labels.py
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcp_call import call  # noqa: E402

CODE = r"""
const s = cc.director.getScene();
const rows = [];
const walk = (n, p) => {
  const l = n.getComponent('cc.Label');
  if (l) { rows.push(p + ' | "' + l.string + '" | fs=' + l.fontSize + ' | ov=' + l.overflow + ' | active=' + n.active); }
  for (const c of n.children) { walk(c, p + '/' + c.name); }
};
if (s) { walk(s, s.name); }
return { scene: s ? s.name : null, count: rows.length, rows: rows };
"""


def main():
    res = call('execute_editor_script', {'code': CODE, 'timeoutMs': 8000}, timeout=60)
    print('--- raw ---')
    print(json.dumps(res, ensure_ascii=False, indent=2)[:6000])


if __name__ == '__main__':
    main()
