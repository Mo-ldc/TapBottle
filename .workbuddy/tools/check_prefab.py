"""
校验 .prefab / .scene 是否符合 Cocos 3.8 真产物格式（对照参考工程 46 个预制体归纳）。

用法：python check_prefab.py <file.prefab|file.scene> [...]

规则（缺任一条，编辑器就打不开或打开后行为异常）：
  P1 arr[0].__type__ == 'cc.Prefab' 且 data 指向根节点
  P2 每个 cc.Node 有 _prefab → cc.PrefabInfo
  P3 每个组件有 __prefab → cc.CompPrefabInfo
  P4 prefab 里所有 node / component 的 _id 必须是空字符串
  P5 PrefabInfo.root → 根节点；asset → arr[0] (cc.Prefab)
  P6 所有 __id__ 下标在范围内
  S1 scene: arr[0]=cc.SceneAsset, arr[1]=cc.Scene；根 Canvas 的 _parent 必须指回 arr[1]
     （漏了 → node.scene===null → 整棵树 hitTest 崩溃、点击全废）
"""
import json
import sys


def check(path):
    d = json.load(open(path, encoding='utf-8'))
    errs = []
    warns = []
    is_prefab = d[0].get('__type__') == 'cc.Prefab'

    def t(i):
        return d[i].get('__type__', '?') if 0 <= i < len(d) else 'OUT_OF_RANGE'

    # ---- 引用完整性 ----
    def walk_refs(o, path_where):
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if k == '__id__' and isinstance(v, int):
                    if not (0 <= v < len(d)):
                        errs.append('P6 引用越界 %s -> %d' % (path_where, v))
                else:
                    walk_refs(v, path_where + '.' + str(k))
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk_refs(v, '%s[%d]' % (path_where, i))

    for i, o in enumerate(d):
        walk_refs(o, 'obj%d' % i)

    if is_prefab:
        # P1
        p0 = d[0]
        root_idx = p0.get('data', {}).get('__id__')
        if root_idx != 1:
            errs.append('P1 cc.Prefab.data 应指向 idx 1，实际 %s' % root_idx)
        if t(1) != 'cc.Node':
            errs.append('P1 idx 1 应为 cc.Node，实际 %s' % t(1))
        # P2 / P3 / P4
        for i, o in enumerate(d):
            ty = o.get('__type__', '')
            if ty == 'cc.Node':
                pf = o.get('_prefab')
                if not isinstance(pf, dict) or t(pf.get('__id__', -1)) != 'cc.PrefabInfo':
                    errs.append('P2 node[%d]%s 缺少 _prefab → cc.PrefabInfo' % (i, o.get('_name')))
                if o.get('_id', '') != '':
                    errs.append('P4 node[%d]%s 的 _id 应为空串，实际 %r' % (i, o.get('_name'), o.get('_id')))
            elif ty.startswith('cc.') and ty not in ('cc.Prefab', 'cc.PrefabInfo',
                                                     'cc.CompPrefabInfo',
                                                     'cc.Vec3', 'cc.Vec2', 'cc.Quat',
                                                     'cc.Color', 'cc.Size', 'cc.Rect',
                                                     'cc.Vec4', 'cc.Mat4'):
                pf = o.get('__prefab')
                if not isinstance(pf, dict) or t(pf.get('__id__', -1)) != 'cc.CompPrefabInfo':
                    errs.append('P3 组件[%d]%s 缺少 __prefab → cc.CompPrefabInfo' % (i, ty))
                if o.get('_id', '') != '':
                    errs.append('P4 组件[%d]%s 的 _id 应为空串，实际 %r' % (i, ty, o.get('_id')))
        # P5
        for i, o in enumerate(d):
            if o.get('__type__') == 'cc.PrefabInfo':
                r = o.get('root', {}).get('__id__')
                a = o.get('asset', {}).get('__id__')
                if r != 1:
                    errs.append('P5 PrefabInfo[%d].root 应指向 1，实际 %s' % (i, r))
                if a != 0:
                    errs.append('P5 PrefabInfo[%d].asset 应指向 0，实际 %s' % (i, a))
                if not o.get('fileId'):
                    errs.append('P5 PrefabInfo[%d] 缺 fileId' % i)
    else:
        # S1
        if t(0) != 'cc.SceneAsset':
            errs.append('S1 arr[0] 应为 cc.SceneAsset，实际 %s' % t(0))
        if t(1) != 'cc.Scene':
            errs.append('S1 arr[1] 应为 cc.Scene，实际 %s' % t(1))
        kids = d[1].get('_children', [])
        if not kids:
            errs.append('S1 cc.Scene 没有子节点')
        else:
            ci = kids[0].get('__id__')
            if t(ci) != 'cc.Node':
                errs.append('S1 cc.Scene 首个子节点应为 cc.Node，实际 %s' % t(ci))
            elif not isinstance(d[ci].get('_parent'), dict) or d[ci]['_parent'].get('__id__') != 1:
                errs.append('S1 根节点 %s 的 _parent 必须指回 cc.Scene(1)，实际 %s'
                            % (d[ci].get('_name'), d[ci].get('_parent')))
        # scene 里 _id 应为非空 uuid
        for i, o in enumerate(d):
            if o.get('__type__') == 'cc.Node' and o.get('_id', '') == '':
                warns.append('scene node[%d]%s 的 _id 为空（编辑器产物一般是 uuid）'
                             % (i, o.get('_name')))

    n_node = sum(1 for o in d if o.get('__type__') == 'cc.Node')
    n_pfi = sum(1 for o in d if o.get('__type__') == 'cc.PrefabInfo')
    n_cpi = sum(1 for o in d if o.get('__type__') == 'cc.CompPrefabInfo')

    tag = 'PREFAB' if is_prefab else 'SCENE'
    status = 'OK' if not errs else 'FAIL(%d)' % len(errs)
    print('[%s][%s] %s  objs=%d nodes=%d PrefabInfo=%d CompPrefabInfo=%d'
          % (status, tag, path.split('\\')[-1], len(d), n_node, n_pfi, n_cpi))
    for e in errs[:12]:
        print('    ERR  ' + e)
    for w in warns[:5]:
        print('    warn ' + w)
    return len(errs)


if __name__ == '__main__':
    bad = 0
    for p in sys.argv[1:]:
        bad += check(p)
    sys.exit(1 if bad else 0)
