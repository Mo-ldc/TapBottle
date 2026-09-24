"""
Game.scene 适配层改造（用户口径）：Widget 负责平铺、AutoNodeScale 负责等比缩放。

  GameRoot (Canvas 的子节点)  ← 补 cc.Widget(alignFlags=45) 平铺整个摄像机可见区；
  gameRoot (GameRoot 的子节点) ← 补 AutoNodeScale（UT 720×1280 已在场景里摆好）
  uiRoot   (GameRoot 的子节点) ← 补 cc.Widget(45)，1:1 平铺（不缩放）

⚠️ 与 prefab 的差异：.scene 里组件 `_id` 必须是**标准 uuid**（prefab 里才是空串）。
⚠️ 同样只在数组末尾追加 [组件, ...]，不删除/重排 —— __id__ 是数组下标，
   Cocos 反序列化是「先建对象再填引用」的两阶段，顺序无关，追加天然安全。

用法：python fit_game_scene.py [--write]
"""
import json
import os
import shutil
import sys
import uuid as _uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SCENE = os.path.join(ROOT, 'assets', 'Scenes', 'Game.scene')
BAK = os.path.join(ROOT, '.workbuddy', 'prefab_bak')


def widget_fields(node_id):
    return {
        '__type__': 'cc.Widget',
        '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': {'__id__': node_id},
        '_enabled': True,
        '_id': str(_uuid.uuid4()),
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


def autoscale_fields(node_id, cid):
    return {
        '__type__': cid,
        '_name': '', '_objFlags': 0, '__editorExtras__': {},
        'node': {'__id__': node_id},
        '_enabled': True,
        '_id': str(_uuid.uuid4()),
        'isCustom': False,
        'uiTr': None,
    }


def append_comp(arr, node_id, fields):
    comp = dict(fields)
    cid = len(arr)
    arr.append(comp)
    arr[node_id]['_components'].append({'__id__': cid})
    return cid


def main():
    write = '--write' in sys.argv
    cid_map = json.load(open(os.path.join(ROOT, '.workbuddy', '_cid_map.json'), encoding='utf-8'))
    as_cid = cid_map['AutoNodeScale']

    arr = json.load(open(SCENE, encoding='utf-8', newline=''))

    def node_id_by_name(name, parent=None):
        for i, o in enumerate(arr):
            if o.get('__type__') != 'cc.Node' or o.get('_name') != name:
                continue
            if parent is not None and (o.get('_parent') or {}).get('__id__') != parent:
                continue
            return i
        return None

    def has(arr, nid, t):
        for c in arr[nid].get('_components', []):
            if arr[c['__id__']].get('__type__') == t:
                return c['__id__']
        return None

    gr = node_id_by_name('GameRoot')
    if gr is None:
        raise SystemExit('找不到 GameRoot 节点')
    gr_child = node_id_by_name('gameRoot', gr)
    ui_root = node_id_by_name('uiRoot', gr)
    if gr_child is None:
        raise SystemExit('找不到 gameRoot 节点')

    log = []
    # GameRoot：平铺整个摄像机可见区
    if has(arr, gr, 'cc.Widget') is None:
        append_comp(arr, gr, widget_fields(gr))
        log.append('GameRoot  id=%d  补 cc.Widget(45) 平铺可见区' % gr)
    else:
        log.append('GameRoot  id=%d  已有 Widget，跳过' % gr)

    # gameRoot：等比缩放居中
    if has(arr, gr_child, as_cid) is None:
        append_comp(arr, gr_child, autoscale_fields(gr_child, as_cid))
        log.append('gameRoot  id=%d  补 AutoNodeScale（720×1280 → 可见区）' % gr_child)
    else:
        log.append('gameRoot  id=%d  已有 AutoNodeScale，跳过' % gr_child)

    # uiRoot：1:1 平铺（不缩放）
    if ui_root is not None:
        if has(arr, ui_root, 'cc.Widget') is None:
            append_comp(arr, ui_root, widget_fields(ui_root))
            log.append('uiRoot    id=%d  补 cc.Widget(45) 平铺（不缩放）' % ui_root)
        else:
            log.append('uiRoot    id=%d  已有 Widget，跳过' % ui_root)
    else:
        log.append('⚠️ 找不到 uiRoot 节点')

    for l in log:
        print(l)

    if write:
        os.makedirs(BAK, exist_ok=True)
        shutil.copy2(SCENE, os.path.join(BAK, 'Game.scene'))
        with open(SCENE, 'w', encoding='utf-8', newline='') as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
        print('→ 已写入（备份在 .workbuddy/prefab_bak/Game.scene）')
    else:
        print('（干跑，加 --write 真写）')


if __name__ == '__main__':
    main()
