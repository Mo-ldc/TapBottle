#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""删除 _serial_probe.py 留下的探针节点 + 探针 prefab，并把场景恢复成干净状态。"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from cocos_mcp import call_tool  # noqa: E402

CODE = r"""
const scene = cc.director.getScene();
const killed = [];
const walk = (n) => {
  const cs = n.children.slice();
  for (const c of cs) {
    if (c.name === 'ProbeSV') { c.parent = null; c.destroy(); killed.push(c.name); }
    else walk(c);
  }
};
walk(scene);
return { killed };
"""


def main():
    r = call_tool('execute_editor_script', {'code': CODE, 'returnLogs': True})
    print('== kill node ==', json.dumps(r, ensure_ascii=False)[:500])
    r2 = call_tool('scene_manage', {'action': 'save'})
    print('== save scene ==', json.dumps(r2, ensure_ascii=False)[:500])
    p = os.path.join(ROOT, 'assets', '_probe.prefab')
    pm = p + '.meta'
    for f in (p, pm):
        if os.path.exists(f):
            os.remove(f)
            print('removed', f)
    call_tool('project_refresh_assets', {})
    return 0


if __name__ == '__main__':
    sys.exit(main())
