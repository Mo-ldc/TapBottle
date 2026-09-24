"""
把 UI 预制体统一成「Widget 平铺 + AutoNodeScale 等比缩放」结构（用户口径）。

对 `assets/resources/Prefabs/UI/*.prefab`：
  · 根节点 <Name> ：原来的 UIFit 组件**原地改写**成 cc.Widget(alignFlags=45)
                    → 跟随画布（PageRoot/DialogRoot/TipRoot）平铺；
  · mask          ：补齐 cc.Widget(alignFlags=45) → 跟随父节点铺满；
  · <fit/ui>      ：UT 固定 720×1280（美术给的默认分辨率）+ 补 AutoNodeScale
                    → min(父宽/720, 父高/1280) 等比缩放、锚点 0.5 居中。

⚠️ 只做「原地改写已有组件」+「数组末尾追加新组件」，**绝不删除/重排**：
   prefab 的 __id__ 就是数组下标，一重排就得全量 remap，风险大收益小。
   末尾追加天然满足两条硬规则：① 组件与它的 cc.CompPrefabInfo 相邻；
   ② 不新增节点，故每个节点的 cc.PrefabInfo「子树后置」顺序不变。

用法：
  python fit_prefabs.py            # 干跑：只打印将要做的事
  python fit_prefabs.py --write    # 真写（先自动备份到 .workbuddy/prefab_bak/）
"""
import json
import os
import random
import shutil
import string
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))          # 项目根
# 2026-09-24 目录重组后：UI 预制体从 UIRes/<Name>/Prefabs/ 迁到 Prefabs/UI/
UIRes = os.path.join(ROOT, 'assets', 'resources', 'Prefabs', 'UI')
BAK = os.path.join(ROOT, '.workbuddy', 'prefab_bak')
CIDMAP = os.path.join(ROOT, '.workbuddy', '_cid_map.json')

ALPHA = string.ascii_letters + string.digits + '+/'
SEEN = set()

FIT_W, FIT_H = 720, 1280


def newid(n=22):
    while True:
        s = ''.join(random.choice(ALPHA) for _ in range(n))
        if s not in SEEN:
            SEEN.add(s)
            return s


def cid_of(name):
    d = json.load(open(CIDMAP, encoding='utf-8'))
    c = d.get(name)
    if not c:
        raise SystemExit('cid 表里没有 %s，先跑 scan_cid.py' % name)
    return c


UIFIT_CID = cid_of('UIFit')
AUTOSCALE_CID = cid_of('AutoNodeScale')


def widget_fields(node_id):
    return {
        '__type__': 'cc.Widget',
        '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': {'__id__': node_id},
        '_enabled': True,
        '_id': '',
        '_alignFlags': 45,
        '_target': None,
        '_left': 0, '_right': 0, '_top': 0, '_bottom': 0,
        '_horizontalCenter': 0, '_verticalCenter': 0,
        '_isAbsLeft': True, '_isAbsRight': True, '_isAbsTop': True, '_isAbsBottom': True,
        '_isAbsHorizontalCenter': True, '_isAbsVerticalCenter': True,
        '_originalWidth': 0, '_originalHeight': 0,
        '_alignMode': 2,
        '_lockFlags': 0,
    }


def autoscale_fields(node_id):
    return {
        '__type__': AUTOSCALE_CID,
        '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': {'__id__': node_id},
        '_enabled': True,
        '_id': '',
        'isCustom': False,
        'uiTr': None,
    }


def rewrite(c, fields):
    """原地改写组件：保留 __prefab 交叉引用，其余字段整体替换。"""
    keep = {k: v for k, v in c.items() if k == '__prefab'}
    c.clear()
    c.update(fields)
    c.update(keep)


def append_comp(arr, node_id, fields):
    """在数组末尾追加 [组件, 它的 CompPrefabInfo]，并登记到节点的 _components。"""
    comp = dict(fields)
    comp['node'] = {'__id__': node_id}
    cid = len(arr)
    comp['__prefab'] = {'__id__': cid + 1}
    arr.append(comp)
    arr.append({'__type__': 'cc.CompPrefabInfo', 'fileId': newid()})
    arr[node_id]['_components'].append({'__id__': cid})
    return cid


def comps_of(arr, node_id):
    return [(c['__id__'], arr[c['__id__']]) for c in arr[node_id].get('_components', [])]


def find_comp(arr, node_id, t):
    for i, c in comps_of(arr, node_id):
        if c.get('__type__') == t:
            return i, c
    return None, None


def child_by_name(arr, node_id, name):
    for ch in arr[node_id].get('_children', []):
        if arr[ch['__id__']].get('_name') == name:
            return ch['__id__']
    return None


def process(path, write):
    arr = json.load(open(path, encoding='utf-8', newline=''))
    log = []
    root_id = arr[0]['data']['__id__']

    # ---- 1) 根节点：UIFit → cc.Widget(45) ----
    uifit_ids = [i for i, o in enumerate(arr) if o.get('__type__') == UIFIT_CID]
    fit_id = None
    for i in uifit_ids:
        c = arr[i]
        node_id = c['node']['__id__']
        fn = c.get('fitNode')
        if fn and isinstance(fn, dict) and '__id__' in fn and node_id == root_id:
            fit_id = fn['__id__']
        rewrite(c, widget_fields(node_id))
        log.append('  根节点 id=%d  UIFit → cc.Widget(45) 平铺' % node_id)

    # 根节点若本来没挂 UIFit，也没有 Widget，则补一个
    if not uifit_ids:
        wi, _ = find_comp(arr, root_id, 'cc.Widget')
        if wi is None:
            append_comp(arr, root_id, widget_fields(root_id))
            log.append('  根节点 id=%d  补 cc.Widget(45) 平铺' % root_id)
        else:
            log.append('  根节点 id=%d  已有 Widget，跳过' % root_id)

    # ---- 2) mask：确保 Widget(45) ----
    mask_id = child_by_name(arr, root_id, 'mask')
    if mask_id is not None:
        wi, wc = find_comp(arr, mask_id, 'cc.Widget')
        if wi is None:
            append_comp(arr, mask_id, widget_fields(mask_id))
            log.append('  mask id=%d  补 cc.Widget(45) 铺满' % mask_id)
        else:
            wc['_alignFlags'] = 45
            wc['_target'] = None
            wc['_alignMode'] = 2
            log.append('  mask id=%d  已有 Widget，对齐 45 复核' % mask_id)
    else:
        log.append('  ⚠️ 没有名为 mask 的子节点')

    # ---- 3) fit/ui 内容节点：UT 720×1280 + AutoNodeScale ----
    if fit_id is None:
        # 没有 UIFit 兜底：按名字找 fit / ui
        for nm in ('fit', 'ui'):
            fit_id = child_by_name(arr, root_id, nm)
            if fit_id is not None:
                log.append('  （按名字找到内容节点 %s id=%d）' % (nm, fit_id))
                break
    if fit_id is not None:
        name = arr[fit_id]['_name']
        uti, ut = find_comp(arr, fit_id, 'cc.UITransform')
        if ut is None:
            log.append('  ⚠️ %s 节点没有 UITransform，跳过' % name)
        else:
            old = (int(ut['_contentSize']['width']), int(ut['_contentSize']['height']))
            if old != (FIT_W, FIT_H):
                ut['_contentSize'] = {'__type__': 'cc.Size', 'width': FIT_W, 'height': FIT_H}
                log.append('  %s id=%d  UT %s → %dx%d' % (name, fit_id, old, FIT_W, FIT_H))
            ai, _ = find_comp(arr, fit_id, AUTOSCALE_CID)
            if ai is None:
                append_comp(arr, fit_id, autoscale_fields(fit_id))
                log.append('  %s id=%d  补 AutoNodeScale（等比缩放居中）' % (name, fit_id))
            else:
                log.append('  %s id=%d  已有 AutoNodeScale，跳过' % (name, fit_id))
    else:
        log.append('  ⚠️ 找不到 fit 内容节点')

    print('== %s' % os.path.relpath(path, ROOT))
    for l in log:
        print(l)

    if write:
        os.makedirs(BAK, exist_ok=True)
        shutil.copy2(path, os.path.join(BAK, os.path.basename(path)))
        with open(path, 'w', encoding='utf-8', newline='') as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
        print('   → 已写入（备份在 .workbuddy/prefab_bak/）')


def main():
    write = '--write' in sys.argv
    files = []
    for dirpath, _dirs, fns in os.walk(UIRes):
        for fn in fns:
            if fn.endswith('.prefab'):
                files.append(os.path.join(dirpath, fn))
    if not files:
        raise SystemExit('没找到 prefab')
    for p in sorted(files):
        process(p, write)
    print('\n%s（%d 个预制体）' % ('已写入' if write else '干跑结束，加 --write 真写', len(files)))


if __name__ == '__main__':
    main()
