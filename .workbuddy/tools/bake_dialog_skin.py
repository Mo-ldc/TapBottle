# -*- coding: utf-8 -*-
"""
第六十七轮·预制体实体化：把 buco 弹窗皮肤**烘焙进 prefab 本体**（不再运行时换皮）。

背景：第六十六/六十七轮的 ConfirmDialog / OfflineDialog 换皮写在 onLoad 的 skinBucos()
里（撤旧层 → 换 spriteFrame → 运行时 addChild 造 title/close）。用户要求改预制体本体：
编辑器打开就是新皮，代码只留数值填充与事件绑定。

用法（先备份，再烘焙，再校验）：
  python .workbuddy/tools/bake_dialog_skin.py            # 干跑：只打印将要做的改动
  python .workbuddy/tools/bake_dialog_skin.py --write    # 写回（自动备份到 .workbuddy/prefab_bak/）

烘焙内容（数值 = 运行时 skinBucos 的同款口径，保证视觉与已验收一致）：
  面板   card  → popup/buco01  596×410
  标题   startUI/buco02 美术字（仅 ConfirmDialog；OfflineDialog 用原有 title 文本）
  关闭叉 popup/buco02 → 节点名 close（UIBase.bindCloseBtn 自动接手）
  按钮   popup/buco04 蓝胶囊（取消/确定）· popup/buco05 橙胶囊（确认/看广告）250×99
  文案   奶油底深棕字 #7A4210（辅助行 #9B6A3C）/ 按键文字 #FFF6E0

★ 硬性格式（见 skills/cocos-3.8.8/references/prefab-format.md）：
  · prefab 里所有 node/component 的 _id 必须是空串（OfflineDialog 由生成器产出，部分对象直接省略该键）；
  · 每个 Node 必须有 _prefab → cc.PrefabInfo（root→ref(1)、asset→ref(0)、fileId 22 字符随机）；
  · 每个组件必须有 __prefab → cc.CompPrefabInfo；
  · 删节点会打乱 __id__（下标即引用），**必须全量重映射**；新节点一律追加到数组末尾，
    内部引用按「追加时的当前长度」现场计算，不做二次重排。
"""
import io
import json
import os
import random
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PREFAB_DIR = os.path.join(ROOT, 'assets', 'resources', 'Prefabs', 'UI')
TEX_DIR = os.path.join(ROOT, 'assets', 'resources', 'Textures')
BAK_DIR = os.path.join(ROOT, '.workbuddy', 'prefab_bak')

# ---- 贴图 spriteFrame uuid（从 .meta 里读，别手抄） ----
def sf_uuid(rel):
    """rel 形如 'popup/buco01' 或 'startUI/buco02'"""
    meta = os.path.join(TEX_DIR, rel + '.png.meta')
    m = json.load(io.open(meta, encoding='utf-8'))
    for v in m['subMetas'].values():
        if v.get('importer') == 'sprite-frame':
            return v['uuid']
    raise RuntimeError('no sprite-frame in ' + meta)


BUCO01 = sf_uuid('popup/buco01')        # 弹窗面板整图
BUCO02_CLOSE = sf_uuid('popup/buco02')  # 右上关闭叉
BUCO04 = sf_uuid('popup/buco04')        # 蓝胶囊
BUCO05 = sf_uuid('popup/buco05')        # 橙胶囊
BUCO02_TITLE = sf_uuid('startUI/buco02')  # 「温馨提示」美术字

WHITE = {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255}
BROWN = {'__type__': 'cc.Color', 'r': 122, 'g': 66, 'b': 16, 'a': 255}      # #7A4210
BROWN_DIM = {'__type__': 'cc.Color', 'r': 155, 'g': 106, 'b': 60, 'a': 255}  # #9B6A3C
KEY_TEXT = {'__type__': 'cc.Color', 'r': 255, 'g': 246, 'b': 224, 'a': 255}  # #FFF6E0
OVERFLOW_RESIZE_H = 3  # cc.Label.Overflow.RESIZE_HEIGHT


def fid():
    a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    return ''.join(random.choice(a) for _ in range(22))


class Prefab(object):
    def __init__(self, name):
        self.path = os.path.join(PREFAB_DIR, name + '.prefab')
        self.d = json.load(io.open(self.path, encoding='utf-8'))
        self.log = []
        self.node_tpl = None

    # ---------- 查询 ----------
    def ref(self, i):
        return {'__id__': i}

    def idx_of(self, o):
        for i, x in enumerate(self.d):
            if x is o:
                return i
        raise RuntimeError('object not found')

    def node(self, name, parent=None):
        """按名字找节点；parent=None 时全树搜索（取第一个匹配）"""
        pool = range(len(self.d)) if parent is None else [c['__id__'] for c in self.d[parent]['_children']]
        for i in pool:
            o = self.d[i]
            if o.get('__type__') == 'cc.Node' and o.get('_name') == name:
                return i
        return None

    def child(self, parent, name):
        return self.node(name, parent)

    def comp(self, node, typ):
        for c in self.d[node]['_components']:
            ci = c['__id__']
            if self.d[ci].get('__type__') == typ:
                return ci
        return None

    # ---------- 删除 ----------
    def collect_dead(self, i, dead):
        dead.add(i)
        n = self.d[i]
        for c in n.get('_components', []):
            ci = c['__id__']
            dead.add(ci)
            p = self.d[ci].get('__prefab')
            if p:
                dead.add(p['__id__'])
        p = n.get('_prefab')
        if p:
            dead.add(p['__id__'])
        for k in n.get('_children', []):
            self.collect_dead(k['__id__'], dead)

    def remove_nodes(self, parent, names):
        """删掉 parent 下这些名字的子节点（递归含组件/PrefabInfo），并全量重映射 __id__"""
        dead = set()
        for nm in names:
            ci = self.child(parent, nm)
            if ci is None:
                continue
            # 留一个「UT + Sprite」节点当模板：add_pic 要用（此时本文件里可能已无同类节点）
            if self.node_tpl is None and self.comp(ci, 'cc.Sprite') is not None:
                self.node_tpl = json.loads(json.dumps(self.d[ci]))
            self.collect_dead(ci, dead)
            self.log.append('  删节点 %s/%s (idx %d)' % (self.d[parent]['_name'], nm, ci))
        if not dead:
            return
        # 从 _children / _components 里摘掉指向死对象的引用
        for o in self.d:
            if o.get('__type__') == 'cc.Node':
                o['_children'] = [c for c in o.get('_children', []) if c['__id__'] not in dead]
                o['_components'] = [c for c in o.get('_components', []) if c['__id__'] not in dead]
        keep = [i for i in range(len(self.d)) if i not in dead]
        remap = dict((old, new) for new, old in enumerate(keep))

        def fix(o):
            if isinstance(o, dict):
                for k, v in list(o.items()):
                    if k == '__id__' and isinstance(v, int):
                        o[k] = remap[v]
                    else:
                        fix(v)
            elif isinstance(o, list):
                for v in o:
                    fix(v)

        self.d = [self.d[i] for i in keep]
        for o in self.d:
            fix(o)

    # ---------- 新增节点 ----------
    def add_pic(self, parent, name, uuid, w, h, x, y):
        """追加一个「UT + Sprite」子节点（模板取自本文件里已有的 stroke 节点）"""
        tpl_node = None
        st = self.child(parent, 'stroke')
        if st is not None:
            tpl_node = self.d[st]
        elif self.node_tpl is not None:
            tpl_node = self.node_tpl
        if tpl_node is None:
            raise RuntimeError('缺模板节点（UT+Sprite），无法复制')
        base = len(self.d)
        node = json.loads(json.dumps(tpl_node))
        node['_name'] = name
        node['_parent'] = self.ref(parent)
        node['_children'] = []
        node['_components'] = [self.ref(base + 1), self.ref(base + 3)]
        node['_prefab'] = self.ref(base + 5)
        node['_lpos'] = {'__type__': 'cc.Vec3', 'x': x, 'y': y, 'z': 0}
        node['_lrot'] = {'__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0.0, 'w': 1.0}
        node['_lscale'] = {'__type__': 'cc.Vec3', 'x': 1.0, 'y': 1.0, 'z': 1}
        node['_euler'] = {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0.0}
        node['_id'] = ''
        ut = {
            '__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': self.ref(base), '_enabled': True, '_id': '',
            '_contentSize': {'__type__': 'cc.Size', 'width': w, 'height': h},
            '_anchorPoint': {'__type__': 'cc.Vec2', 'x': 0.5, 'y': 0.5},
            '__prefab': self.ref(base + 2),
        }
        cp_ut = {'__type__': 'cc.CompPrefabInfo', 'fileId': fid()}
        sp = {
            '__type__': 'cc.Sprite', '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': self.ref(base), '_enabled': True, '_id': '',
            '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
            '_color': dict(WHITE),
            '_spriteFrame': {'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'},
            '_type': 0, '_fillType': 0, '_sizeMode': 0,
            '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
            '_fillStart': 0, '_fillRange': 0, '_isTrimmedMode': False, '_useGrayscale': False,
            '_atlas': None, '__prefab': self.ref(base + 4),
        }
        cp_sp = {'__type__': 'cc.CompPrefabInfo', 'fileId': fid()}
        pfi = {
            '__type__': 'cc.PrefabInfo', 'root': self.ref(1), 'asset': self.ref(0),
            'fileId': fid(), 'instance': None, 'targetOverrides': None,
            'nestedPrefabInstanceRoots': None,
        }
        self.d.extend([node, ut, cp_ut, sp, cp_sp, pfi])
        self.d[parent]['_children'].append(self.ref(base))
        self.log.append('  加节点 %s/%s (idx %d) %dx%d @(%d,%d)' % (self.d[parent]['_name'], name, base, w, h, x, y))
        return base

    # ---------- 改属性 ----------
    def set_pic(self, node, uuid, w, h):
        ut = self.comp(node, 'cc.UITransform')
        if ut is not None:
            self.d[ut]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': h}
        sp = self.comp(node, 'cc.Sprite')
        if sp is not None:
            self.d[sp]['_spriteFrame'] = {'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'}
            self.d[sp]['_type'] = 0        # Sprite.Type.SIMPLE
            self.d[sp]['_sizeMode'] = 0    # Sprite.SizeMode.CUSTOM
            self.d[sp]['_isTrimmedMode'] = False
            self.d[sp]['_color'] = dict(WHITE)
        self.log.append('  换图 %s -> %s (%dx%d)' % (self.d[node]['_name'], uuid[:8], w, h))

    def set_pos(self, node, x, y):
        self.d[node]['_lpos'] = {'__type__': 'cc.Vec3', 'x': x, 'y': y, 'z': 0}
        self.log.append('  挪位 %s -> (%s,%s)' % (self.d[node]['_name'], x, y))

    def set_label(self, node, fs=None, lh=None, color=None, overflow=None, w=None, h=None):
        lb = self.comp(node, 'cc.Label')
        if lb is not None:
            o = self.d[lb]
            if fs is not None:
                o['_fontSize'] = fs
                o['_actualFontSize'] = fs
            if lh is not None:
                o['_lineHeight'] = lh
            if color is not None:
                o['_color'] = dict(color)
            if overflow is not None:
                o['_overflow'] = overflow
        ut = self.comp(node, 'cc.UITransform')
        if ut is not None and w is not None:
            self.d[ut]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': (h if h is not None else self.d[ut]['_contentSize']['height'])}
        self.log.append('  文案 %s fs=%s lh=%s w=%s color=%s' % (self.d[node]['_name'], fs, lh, w, color))

    # ---------- 写回 ----------
    def save(self, do_write):
        if not do_write:
            return
        if not os.path.isdir(BAK_DIR):
            os.makedirs(BAK_DIR)
        bak = os.path.join(BAK_DIR, os.path.basename(self.path) + '.pre_skin')
        if not os.path.exists(bak):
            shutil.copy2(self.path, bak)
        txt = json.dumps(self.d, ensure_ascii=False, separators=(',', ':'))
        io.open(self.path, 'w', encoding='utf-8', newline='\n').write(txt)
        print('  -> 已写回 ' + self.path + ' (%d 对象)' % len(self.d))


def bake_confirm(p, do_write):
    print('== ConfirmDialog')
    root = p.node('ConfirmDialog')
    card = p.child(root, 'fit') and p.child(p.child(root, 'fit'), 'card')
    # ① 撤旧九宫格三层 + 按钮上的光泽/描边
    for btn in ('cancelBtn', 'okBtn'):
        bi = p.child(card, btn)
        if bi is not None:
            p.remove_nodes(bi, ['gloss', 'stroke'])
    p.remove_nodes(card, ['gloss', 'stroke'])
    # 删完后 card 下标变了，重新取
    card = p.child(p.child(root, 'fit'), 'card')
    # ② 面板整图
    p.set_pic(card, BUCO01, 596, 410)
    # ③ 标题美术字 + 关闭叉
    p.add_pic(card, 'title', BUCO02_TITLE, 259, 68, 0, 150)
    p.add_pic(card, 'close', BUCO02_CLOSE, 56, 58, 248, 152)
    # ④ 正文
    txt = p.child(card, 'text')
    p.set_pos(txt, 0, 25)
    p.set_label(txt, fs=40, lh=58, color=BROWN, overflow=OVERFLOW_RESIZE_H, w=470, h=0)
    # ⑤ 双键（蓝=取消 / 橙=确认）
    for btn, uuid, x in (('cancelBtn', BUCO04, -165), ('okBtn', BUCO05, 165)):
        bi = p.child(card, btn)
        p.set_pic(bi, uuid, 250, 99)
        p.set_pos(bi, x, -140)
        t = p.child(bi, 'text')
        if t is not None:
            p.set_pos(t, 0, 2)
            p.set_label(t, fs=46, lh=52, color=KEY_TEXT, w=200, h=60)
    p.save(do_write)


def bake_offline(p, do_write):
    print('== OfflineDialog')
    root = p.node('OfflineDialog')
    fit = p.child(root, 'fit')
    card = p.child(fit, 'card')
    for btn in ('adBtn', 'okBtn'):
        bi = p.child(card, btn)
        if bi is not None:
            p.remove_nodes(bi, ['gloss', 'stroke'])
    p.remove_nodes(card, ['gloss', 'inner', 'stroke'])
    card = p.child(fit, 'card')
    p.set_pic(card, BUCO01, 596, 410)
    # 文案（奶油底深棕字）
    p.set_pos(p.child(card, 'title'), 0, 134)
    p.set_label(p.child(card, 'title'), fs=40, lh=58, color=BROWN, overflow=OVERFLOW_RESIZE_H, w=470, h=0)
    p.set_pos(p.child(card, 'coin'), 0, 52)
    p.set_pos(p.child(card, 'earn'), 0, -16)
    p.set_label(p.child(card, 'earn'), fs=54, lh=64, color=BROWN, overflow=OVERFLOW_RESIZE_H, w=530, h=0)
    p.set_pos(p.child(card, 'time'), 0, -88)
    p.set_label(p.child(card, 'time'), fs=38, lh=48, color=BROWN_DIM, overflow=OVERFLOW_RESIZE_H, w=420, h=0)
    # 双键（橙=看广告 / 蓝=确定）
    for btn, uuid, x, fs in (('adBtn', BUCO05, 150, 42), ('okBtn', BUCO04, -150, 46)):
        bi = p.child(card, btn)
        p.set_pic(bi, uuid, 250, 99)
        p.set_pos(bi, x, -145)
        t = p.child(bi, 'text')
        if t is not None:
            p.set_pos(t, 0, 2)
            p.set_label(t, fs=fs, lh=fs + 6, color=KEY_TEXT, w=220, h=60)
    p.save(do_write)


def main():
    do_write = '--write' in sys.argv
    for name, fn in (('ConfirmDialog', bake_confirm), ('OfflineDialog', bake_offline)):
        p = Prefab(name)
        fn(p, do_write)
        for line in p.log:
            print(line)
    print('干跑完成（加 --write 才会写回）' if not do_write else '已写回，请跑 check_prefab.py 校验')


if __name__ == '__main__':
    main()
