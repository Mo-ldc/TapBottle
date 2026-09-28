# 把运行时采集的 Sprite 最终视觉烘回 Game.scene（只改字段，不动结构）
import json, os, re, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# ---- 1. 解析 dump ----
dump = open(r'E:/LDC_Fby/_shots/q8_dump.txt', encoding='utf-8').read().splitlines()
chunks = {}
for line in dump:
    m = re.match(r'\[eval\] (.*)$', line.strip())
    if not m: continue
    try: v = json.loads(m.group(1))['result']['value']
    except Exception: continue
    mm = re.match(r'(S\d\d|LEN)=(.*)$', v, re.S)
    if mm: chunks[mm.group(1)] = mm.group(2)
blob = ''.join(chunks[k] for k in sorted(chunks) if k.startswith('S'))
rt = {}
dup = []
for rec in blob.split('|'):
    if not rec.strip(): continue
    f = rec.split('~')
    if len(f) != 10: print('BAD REC', rec[:80]); continue
    p = f[0]
    if p in rt: dup.append(p)
    rt[p] = f
print('运行时 Sprite:', len(rt), 'path 冲突:', len(dup))
for d in dup[:10]: print('  DUP', d)
# ---- 2. 场景 ----
sj = json.load(open(os.path.join(ROOT,'assets','Scenes','Game.scene'), encoding='utf-8'))
def name_of(o): return o.get('_name','?') if isinstance(o,dict) else '?'
parent = {}
for i,o in enumerate(sj):
    if isinstance(o,dict) and isinstance(o.get('_parent'),dict): parent[i]=o['_parent']['__id__']
def path_of(i):
    parts=[]; seen=set()
    while i is not None and i not in seen:
        seen.add(i); parts.append(name_of(sj[i])); i=parent.get(i)
    return '/'.join(reversed(parts))
node_path = {i: path_of(i) for i in range(len(sj)) if isinstance(sj[i],dict) and sj[i].get('__type__')=='cc.Node'}
# path -> ids（查重）
p2ids = collections.defaultdict(list)
for i,p in node_path.items(): p2ids[p].append(i)
changed = collections.Counter()
skipped = []
for i,o in enumerate(sj):
    if not isinstance(o,dict) or o.get('__type__')!='cc.Sprite': continue
    nid = o['node']['__id__'] if isinstance(o.get('node'),dict) else None
    p = node_path.get(nid)
    if not p or p not in rt or len(p2ids.get(p,[]))!=1:
        skipped.append(p); continue
    f = rt[p]
    u, col, w, h, typ, smode, trim, en, act = f[1], f[2], int(f[3]), int(f[4]), int(f[5]), int(f[6]), f[7]=='1', f[8]=='1', f[9]=='1'
    # spriteFrame
    sf = o.get('_spriteFrame')
    oldu = sf.get('__uuid__') if isinstance(sf,dict) else None
    if oldu != u:
        o['_spriteFrame'] = {'__uuid__': u, '__expectedType__': 'cc.SpriteFrame'}
        changed['frame'] += 1
        print('  FRAME %-66s %s -> %s' % (p, (oldu or 'NONE')[:8], u[:8]))
    # color
    rr = int(col[1:3],16); gg=int(col[3:5],16); bb=int(col[5:7],16); aa=int(col[7:9],16) if len(col)>=9 else 255
    c = o.get('_color')
    if isinstance(c,dict) and (c.get('r'),c.get('g'),c.get('b'),c.get('a'))!=(rr,gg,bb,aa):
        print('  COLOR %-66s (%s,%s,%s,%s) -> (%s,%s,%s,%s)' % (p,c.get('r'),c.get('g'),c.get('b'),c.get('a'),rr,gg,bb,aa))
        c.update(r=rr,g=gg,b=bb,a=c.get('a',255)); changed['color']+=1  # alpha 保留场景原值（dump 丢失 alpha）
    # type / sizeMode / trim / enabled
    if o.get('_type')!=typ: o['_type']=typ; changed['type']+=1
    if o.get('_sizeMode')!=smode: o['_sizeMode']=smode; changed['sizeMode']+=1
    if bool(o.get('_isTrimmedMode'))!=trim: o['_isTrimmedMode']=trim; changed['trim']+=1
    if bool(o.get('_enabled'))!=en: o['_enabled']=en; changed['enabled']+=1; print('  ENABLED',p,'->',en)
    # contentSize
    if nid is not None and isinstance(sj[nid],dict):
        nd = sj[nid]
        cs = nd.get('_contentSize')
        if isinstance(cs,dict) and (round(cs.get('x',0)),round(cs.get('y',0)))!=(w,h):
            print('  SIZE  %-66s %sx%s -> %sx%s' % (p,cs.get('x'),cs.get('y'),w,h))
            cs.update(x=w,y=h); changed['size']+=1
print('变更统计:', dict(changed))
print('跳过(运行时新建/同名):', len([s for s in skipped if s]))
if changed:
    json.dump(sj, open(os.path.join(ROOT,'assets','Scenes','Game.scene'),'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
    print('已写回 Game.scene')
else:
    print('无变更，不写')
