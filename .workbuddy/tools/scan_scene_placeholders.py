import os, json, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 图片 uuid -> 资源路径
img = {}
for dirpath, dirs, files in os.walk(os.path.join(ROOT,'assets','resources','Textures')):
    for fn in files:
        if fn.endswith('.png.meta'):
            p = os.path.join(dirpath, fn)
            try: j = json.load(open(p, encoding='utf-8'))
            except Exception: continue
            u = j.get('uuid')
            if u: img[u] = fn[:-5]
PLACEHOLDER = {'px_white2','nine_base','nine_gloss','nine_stroke','nine_chip','nine_chip_gloss','nine_chip_stroke','card_white','card','card_dark','bg_placeholder','round_rect','round_soft','sq_brown','sq_brown2','sq_grey','bar_bg','bar_fill','bar_fill2','px_white','px_circle','px_dot'}
target = sys.argv[1] if len(sys.argv)>1 else 'Game.scene'
j = json.load(open(os.path.join(ROOT,'assets','Scenes',target), encoding='utf-8'))
arr = j
# 建立 id->node 名与父子映射
def name_of(idx):
    o = arr[idx]
    return o.get('_name','?') if isinstance(o,dict) else '?'
def parent_of(idx):
    o = arr[idx]
    if not isinstance(o,dict): return None
    p = o.get('_parent')
    if p: return p['__id__']
    return None
def path_of(idx):
    parts=[]
    cur=idx
    seen=set()
    while cur is not None and cur not in seen:
        seen.add(cur)
        parts.append(name_of(cur))
        cur=parent_of(cur)
    return '/'.join(reversed(parts))
stats = collections.Counter()
rows=[]
for i,o in enumerate(arr):
    if not isinstance(o,dict): continue
    if o.get('__type__')!='cc.Sprite': continue
    sf = o.get('_spriteFrame')
    u = sf.get('__uuid__') if isinstance(sf,dict) else None
    imgname = img.get((u or '').split('@')[0], u if u else 'EMPTY')
    node = o.get('node')
    npath = path_of(node['__id__']) if isinstance(node,dict) else '?'
    tag = 'PLACEHOLDER' if imgname in PLACEHOLDER else 'tex'
    stats[tag]+=1
    if tag=='PLACEHOLDER':
        rows.append((npath, imgname))
print(target, 'Sprites:', dict(stats))
for p,im in rows: print('  %-70s %s' % (p, im))

print('--- ALL SPRITES ---')
for i,o in enumerate(arr):
    if not isinstance(o,dict) or o.get('__type__')!='cc.Sprite': continue
    sf = o.get('_spriteFrame')
    u = sf.get('__uuid__') if isinstance(sf,dict) else None
    imgname = img.get((u or '').split('@')[0], 'EMPTY:'+str(u))
    node = o.get('node')
    npath = path_of(node['__id__']) if isinstance(node,dict) else '?'
    ut = None
    nid = node['__id__'] if isinstance(node,dict) else None
    if nid is not None and isinstance(arr[nid],dict):
        ut = arr[nid].get('_contentSize')
    active = arr[nid].get('_active') if nid is not None else '?'
    print('  %-72s %-24s size=%s active=%s' % (npath, imgname, ut, active))
