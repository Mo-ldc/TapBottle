# -*- coding: utf-8 -*-
"""
第七十轮·按美术效果图重烘 ConfirmDialog / OfflineDialog 两个弹窗 prefab。

参考图：F:\\SVN\\f_翻瓶子增量\\效果图\\  温馨提示.jpg / 弹窗界面.jpg
素材：  F:\\SVN\\f_翻瓶子增量\\切图\\弹窗\\（buco01~06 + wezi01/wzi04，已拷入 resources/Textures/popup/）

ConfirmDialog（温馨提示.jpg 口径）：
  · 标题 = popup/buco03 空白木牌(479×138, 已在) + popup/wezi01「温馨提示」美术字
  · 正文两段：说明 fs30 #867A3F（新增 question 节点放强调句）
              强调句 fs44 #E65F39（ConfirmArg.question，代码填）
  · 按钮**对调**：确认 = popup/buco04 蓝 · 左；取消 = popup/buco05 橙 · 右（对齐效果图）
  · 按钮字 fs42 #FFFFFF + 描边3：蓝键 #1B66B9 / 橙键 #B8561B

OfflineDialog（弹窗界面.jpg 口径）：
  · 删旧 title 文本节点 → 木牌 popup/buco03 + popup/wzi04「挂机奖励」
  · 正文一行（时长并入）：time 节点上移 fs32；金币行 = coin 图标 + earn（锚点左对齐）
  · 新增瓶盖行 capIc(bottle/capchip_6) + capLb（新增 @property）
  · 新增关闭叉 close(popup/buco02, 节点名 close → UIBase 自动绑)
  · 双键下移出卡：基础领取 = buco04 蓝 · 左 / 三倍领取 = buco05 橙 · 右 + videoIc(buco06)
  · 根组件新增 capLb 序列化引用

★ 硬性格式同 bake_dialog_skin.py：删节点全量重映射 __id__；新节点六件套追加数组末尾。
用法：python bake_dialogs_v2.py [--write]
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


def sf_uuid(rel):
    meta = os.path.join(TEX_DIR, rel + '.png.meta')
    m = json.load(io.open(meta, encoding='utf-8'))
    for v in m['subMetas'].values():
        if v.get('importer') == 'sprite-frame':
            return v['uuid']
    raise RuntimeError('no sprite-frame in ' + meta)


BUCO01 = sf_uuid('popup/buco01')          # 弹窗面板
BUCO02_CLOSE = sf_uuid('popup/buco02')    # 关闭叉（橙圆 X）
BUCO03_BOARD = sf_uuid('popup/buco03')    # 空白木牌标题板
BUCO04 = sf_uuid('popup/buco04')          # 蓝胶囊
BUCO05 = sf_uuid('popup/buco05')          # 橙胶囊
BUCO06 = sf_uuid('popup/buco06')          # 视频播放小图标
WEZI01 = sf_uuid('popup/wezi01')          # 「温馨提示」美术字
WZI04 = sf_uuid('popup/wzi04')            # 「挂机奖励」美术字
CAPCHIP6 = sf_uuid('bottle/capchip_6')    # 瓶盖图标

CID_LOC_LABEL = '87eafg0mZlNr6HZmo8eHRTT'   # LocLabel 组件 cid
CID_OFFLINE = '80380LFC7FGOJ5rQm8Yvjj5'     # OfflineDialog 组件 cid

WHITE = {'__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255}
BROWN = {'__type__': 'cc.Color', 'r': 122, 'g': 66, 'b': 16, 'a': 255}       # #7A4210
BODY = {'__type__': 'cc.Color', 'r': 134, 'g': 122, 'b': 63, 'a': 255}       # #867A3F
EMPH = {'__type__': 'cc.Color', 'r': 230, 'g': 95, 'b': 57, 'a': 255}        # #E65F39
OUT_BLUE = {'__type__': 'cc.Color', 'r': 27, 'g': 102, 'b': 185, 'a': 255}   # #1B66B9
OUT_ORANGE = {'__type__': 'cc.Color', 'r': 184, 'g': 86, 'b': 27, 'a': 255}  # #B8561B
OVERFLOW_RESIZE_H = 3


def fid():
    a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    return ''.join(random.choice(a) for _ in range(22))


class Prefab(object):
    def __init__(self, name):
        self.path = os.path.join(PREFAB_DIR, name + '.prefab')
        self.d = json.load(io.open(self.path, encoding='utf-8'))
        self.log = []
        self.pic_tpl = None   # 「UT+Sprite」节点模板
        self.lab_tpl = None   # 「UT+Label」组件模板（Label 序列化字段抄现成的）

    def ref(self, i):
        return {'__id__': i}

    def node(self, name, parent=None):
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

    def grab_tpl(self):
        """抓节点/Label 模板（建新节点用），只抓一次"""
        if self.pic_tpl is not None:
            return
        for o in self.d:
            if o.get('__type__') != 'cc.Node':
                continue
            if self.comp(self.d.index(o), 'cc.Sprite') is not None and self.pic_tpl is None:
                self.pic_tpl = json.loads(json.dumps(o))
            if self.comp(self.d.index(o), 'cc.Label') is not None and self.lab_tpl is None:
                self.lab_tpl = json.loads(json.dumps(self.d[self.comp(self.d.index(o), 'cc.Label')]))

    # ---------- 删除（全量重映射） ----------
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
        dead = set()
        for nm in names:
            ci = self.child(parent, nm)
            if ci is None:
                continue
            self.collect_dead(ci, dead)
            self.log.append('  删节点 %s/%s' % (self.d[parent]['_name'], nm))
        if not dead:
            return
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

    # ---------- 新增 ----------
    def _append_six(self, parent, name, x, y, comp_key):
        base = len(self.d)
        node = json.loads(json.dumps(self.pic_tpl))
        node['_name'] = name
        node['_parent'] = self.ref(parent)
        node['_children'] = []
        node['_active'] = True
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
            '_contentSize': {'__type__': 'cc.Size', 'width': 100, 'height': 100},
            '_anchorPoint': {'__type__': 'cc.Vec2', 'x': 0.5, 'y': 0.5},
            '__prefab': self.ref(base + 2),
        }
        cp_ut = {'__type__': 'cc.CompPrefabInfo', 'fileId': fid()}
        comp = {
            '__type__': comp_key, '_name': '', '_objFlags': 0, '__editorExtras__': {},
            'node': self.ref(base), '_enabled': True, '_id': '',
            '__prefab': self.ref(base + 4),
        }
        if comp_key == 'cc.Sprite':
            comp.update({
                '_customMaterial': None, '_srcBlendFactor': 2, '_dstBlendFactor': 4,
                '_color': dict(WHITE),
                '_spriteFrame': {'__uuid__': '', '__expectedType__': 'cc.SpriteFrame'},
                '_type': 0, '_fillType': 0, '_sizeMode': 0,
                '_fillCenter': {'__type__': 'cc.Vec2', 'x': 0, 'y': 0},
                '_fillStart': 0, '_fillRange': 0, '_isTrimmedMode': False, '_useGrayscale': False,
                '_atlas': None,
            })
        else:  # cc.Label —— 序列化字段抄本文件现有 Label
            lb = json.loads(json.dumps(self.lab_tpl))
            lb.pop('__prefab', None)
            lb['node'] = self.ref(base)
            lb['_id'] = ''
            lb['_string'] = ''
            comp.update(lb)
            comp.pop('__type__', None)
            comp['__type__'] = 'cc.Label'
        cp_comp = {'__type__': 'cc.CompPrefabInfo', 'fileId': fid()}
        pfi = {
            '__type__': 'cc.PrefabInfo', 'root': self.ref(1), 'asset': self.ref(0),
            'fileId': fid(), 'instance': None, 'targetOverrides': None,
            'nestedPrefabInstanceRoots': None,
        }
        self.d.extend([node, ut, cp_ut, comp, cp_comp, pfi])
        self.d[parent]['_children'].append(self.ref(base))
        return base

    def add_pic(self, parent, name, uuid, w, h, x, y):
        base = self._append_six(parent, name, x, y, 'cc.Sprite')
        self.d[base + 1]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': h}
        self.d[base + 3]['_spriteFrame'] = {'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'}
        self.log.append('  加图 %s/%s %dx%d @(%s,%s)' % (self.d[parent]['_name'], name, w, h, x, y))
        return base

    def add_label(self, parent, name, fs, lh, color, x, y, w, anchor_left=False, halign=None):
        base = self._append_six(parent, name, x, y, 'cc.Label')
        lb = self.d[base + 3]
        lb['_fontSize'] = fs
        lb['_actualFontSize'] = fs
        lb['_lineHeight'] = lh
        lb['_overflow'] = OVERFLOW_RESIZE_H
        lb['_color'] = dict(color)
        if halign is not None:
            lb['_horizontalAlign'] = halign
        self.d[base + 1]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': 0}
        if anchor_left:
            self.d[base + 1]['_anchorPoint'] = {'__type__': 'cc.Vec2', 'x': 0, 'y': 0.5}
        self.log.append('  加字 %s/%s fs=%s @(%s,%s)%s' % (self.d[parent]['_name'], name, fs, x, y, ' 左锚' if anchor_left else ''))
        return base

    # ---------- 修改 ----------
    def set_pic(self, node, uuid, w, h):
        ut = self.comp(node, 'cc.UITransform')
        if ut is not None:
            self.d[ut]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': h}
        sp = self.comp(node, 'cc.Sprite')
        if sp is not None:
            self.d[sp]['_spriteFrame'] = {'__uuid__': uuid, '__expectedType__': 'cc.SpriteFrame'}
            self.d[sp]['_type'] = 0
            self.d[sp]['_sizeMode'] = 0
            self.d[sp]['_isTrimmedMode'] = False
            self.d[sp]['_color'] = dict(WHITE)
        self.log.append('  换图 %s -> %s (%dx%d)' % (self.d[node]['_name'], uuid[:8], w, h))

    def set_pos(self, node, x, y):
        self.d[node]['_lpos'] = {'__type__': 'cc.Vec3', 'x': x, 'y': y, 'z': 0}

    def set_label(self, node, fs=None, lh=None, color=None, overflow=None, w=None, h=None, halign=None):
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
            if halign is not None:
                o['_horizontalAlign'] = halign
        ut = self.comp(node, 'cc.UITransform')
        if ut is not None and w is not None:
            self.d[ut]['_contentSize'] = {'__type__': 'cc.Size', 'width': w, 'height': (h if h is not None else self.d[ut]['_contentSize']['height'])}

    def set_outline(self, node, width, color):
        lb = self.comp(node, 'cc.Label')
        o = self.d[lb]
        o['_enableOutline'] = True
        o['_outlineWidth'] = width
        o['_outlineColor'] = dict(color)
        self.log.append('  描边 %s w=%s' % (self.d[node]['_name'], width))

    def set_anchor_left(self, node):
        ut = self.comp(node, 'cc.UITransform')
        self.d[ut]['_anchorPoint'] = {'__type__': 'cc.Vec2', 'x': 0, 'y': 0.5}

    def set_loc_key(self, node, key):
        for c in self.d[node]['_components']:
            ci = c['__id__']
            if self.d[ci].get('__type__') == CID_LOC_LABEL:
                self.d[ci]['key'] = key
                self.log.append('  LocLabel %s key=%s' % (self.d[node]['_name'], key))
                return
        raise RuntimeError('no LocLabel on ' + self.d[node]['_name'])

    def root_comp(self, cid):
        root = 1
        for c in self.d[root]['_components']:
            ci = c['__id__']
            if self.d[ci].get('__type__') == cid:
                return ci
        raise RuntimeError('root script comp not found')

    def save(self, do_write):
        if not do_write:
            return
        if not os.path.isdir(BAK_DIR):
            os.makedirs(BAK_DIR)
        bak = os.path.join(BAK_DIR, os.path.basename(self.path) + '.pre_v2')
        if not os.path.exists(bak):
            shutil.copy2(self.path, bak)
        txt = json.dumps(self.d, ensure_ascii=False, separators=(',', ':'))
        io.open(self.path, 'w', encoding='utf-8', newline='\n').write(txt)
        print('  -> 已写回 %s (%d 对象)' % (os.path.basename(self.path), len(self.d)))


def bake_confirm(p, do_write):
    print('== ConfirmDialog（温馨提示.jpg）')
    root = p.node('ConfirmDialog')
    card = p.child(p.child(root, 'fit'), 'card')
    p.grab_tpl()
    # ① 标题板 + 美术字换成 popup 口径（同图，统一资源来源）
    board = p.child(card, 'buco01')
    p.set_pic(board, BUCO03_BOARD, 479, 138)
    title = p.child(card, 'title')
    p.set_pic(title, WEZI01, 259, 68)
    # ② 正文：说明 fs30 #867A3F + 新增强调句 fs44 #E65F39
    txt = p.child(card, 'text')
    p.set_pos(txt, 0, 60)
    p.set_label(txt, fs=30, lh=42, color=BODY, overflow=OVERFLOW_RESIZE_H, w=470, h=0)
    p.add_label(card, 'question', 44, 54, EMPH, 0, -25, 470)
    # ③ 按钮对调：确认=蓝左 / 取消=橙右；字 fs42 白 + 描边3
    okb = p.child(card, 'okBtn')
    p.set_pic(okb, BUCO04, 250, 99)
    p.set_pos(okb, -165, -299.9)
    okt = p.child(okb, 'text')
    p.set_label(okt, fs=42, lh=48, color=WHITE, w=220, h=60)
    p.set_outline(okt, 3, OUT_BLUE)
    cab = p.child(card, 'cancelBtn')
    p.set_pic(cab, BUCO05, 250, 99)
    p.set_pos(cab, 165, -299.9)
    cat = p.child(cab, 'text')
    p.set_label(cat, fs=42, lh=48, color=WHITE, w=220, h=60)
    p.set_outline(cat, 3, OUT_ORANGE)
    p.save(do_write)


def bake_offline(p, do_write):
    print('== OfflineDialog（弹窗界面.jpg）')
    root = p.node('OfflineDialog')
    fit = p.child(root, 'fit')
    card = p.child(fit, 'card')
    p.grab_tpl()
    # ① 删旧 title 文本节点 → 木牌 + 「挂机奖励」美术字
    p.remove_nodes(card, ['title'])
    card = p.child(fit, 'card')
    ribbon = p.add_pic(card, 'ribbon', BUCO03_BOARD, 479, 138, 0, 220)
    p.add_pic(ribbon, 'titleText', WZI04, 260, 68, 0, 0)
    # ② 关闭叉
    p.add_pic(card, 'close', BUCO02_CLOSE, 87, 90, 275, 185)
    # ③ 收益两行（图标 + 左对齐文字）
    coin = p.child(card, 'coin')
    p.set_pos(coin, -160, 22)
    p.set_label(coin, w=64, h=67)
    earn = p.child(card, 'earn')
    p.set_pos(earn, -115, 22)
    p.set_label(earn, fs=40, lh=48, color=BROWN, overflow=OVERFLOW_RESIZE_H, w=400, h=0, halign=0)
    p.set_anchor_left(earn)
    p.add_pic(card, 'capIc', CAPCHIP6, 71, 67, -160, -42)
    cap = p.add_label(card, 'capLb', 40, 48, BROWN, -115, -42, 400, anchor_left=True, halign=0)
    # ④ 说明行（时长并入正文）
    tm = p.child(card, 'time')
    p.set_pos(tm, 0, 95)
    p.set_label(tm, fs=32, lh=42, color=BROWN, overflow=OVERFLOW_RESIZE_H, w=540, h=0)
    # ⑤ 双键出卡：基础领取=蓝左 / 三倍领取=橙右+视频角标；字描边
    adb = p.child(card, 'adBtn')
    p.set_pic(adb, BUCO05, 277, 110)
    p.set_pos(adb, 162, -278)
    adt = p.child(adb, 'text')
    p.set_loc_key(adt, 'claim_x3')
    p.set_label(adt, fs=42, lh=48, color=WHITE, w=220, h=60)
    p.set_outline(adt, 3, OUT_ORANGE)
    p.add_pic(adb, 'videoIc', BUCO06, 42, 32, 95, 40)
    okb = p.child(card, 'okBtn')
    p.set_pic(okb, BUCO04, 278, 110)
    p.set_pos(okb, -162, -278)
    okt = p.child(okb, 'text')
    p.set_loc_key(okt, 'claim_base')
    p.set_label(okt, fs=42, lh=48, color=WHITE, w=220, h=60)
    p.set_outline(okt, 3, OUT_BLUE)
    # ⑥ 根组件补 capLb 引用
    rc = p.root_comp(CID_OFFLINE)
    p.d[rc]['capLb'] = p.ref(cap + 3)
    p.log.append('  根组件 OfflineDialog.capLb -> [%d]' % (cap + 3))
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
