# 快速预览：按九宫格规则拉伸三层并叠加，检查是否有拖影 / 边缘是否干净
import os
from PIL import Image, ImageDraw

d = os.path.join('assets','resources','Textures','ui')
def load(n): return Image.open(os.path.join(d, n + '.png')).convert('RGBA')

def nine(src, inset, w, h):
    W, H = src.size
    i = inset
    out = Image.new('RGBA', (w, h), (0,0,0,0))
    # 九块源区域
    cols = [(0,i,i),(i,W-i,W-i),(W-i,W,W)]
    rows = [(0,i,i),(i,H-i,H-i),(H-i,H,H)]
    dstw = [(0,i,i),(i,w-i,w-i),(w-i,w,w)]
    dsth = [(0,i,i),(i,h-i,h-i),(h-i,h,h)]
    for r in range(3):
        for c in range(3):
            sx0,sx1,_ = cols[c]; sy0,sy1,_ = rows[r]
            dx0,dx1,_ = dstw[c]; dy0,dy1,_ = dsth[r]
            tw, th = dx1-dx0, dy1-dy0
            if tw <= 0 or th <= 0: continue
            piece = src.crop((sx0,sy0,sx1,sy1)).resize((tw,th), Image.NEAREST)
            out.paste(piece, (dx0,dy0), piece)
    return out

def tint(src, rgb):
    im = src.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = px[x,y]
            px[x,y] = (r*rgb[0]//255, g*rgb[1]//255, b*rgb[2]//255, a)
    return im

def plate(w,h,base,gloss,stroke,inset,rgb,line=(74,44,20)):
    out = Image.new('RGBA',(w,h),(0,0,0,0))
    for layer, rgb2 in ((base,rgb),(gloss,None),(stroke,line)):
        s = nine(load(layer), inset, w, h)
        if rgb2: s = tint(s, rgb2)
        out.alpha_composite(s)
    return out

canvas = Image.new('RGBA', (1160, 300), (232,168,92,255))
y = 0
combos = [
    (322,78,(246,227,197),26),   # 升级 cell
    (169,58,(92,46,18),27),      # 金币筹码(深棕)  用 chip 系
    (96,96,(246,227,197),26),    # 返回按钮
    (52,52,(246,227,197),26),    # 工具按钮
    (100,58,(150,208,126),26),   # 机器绿屏
    (210,84,(242,195,78),26),    # 金色主按钮
]
x = 8
for w,h,rgb,inset in combos:
    if inset == 27:
        p = plate(w,h,'nine_chip','nine_chip_gloss','nine_chip_stroke',27,rgb)
    else:
        p = plate(w,h,'nine_base','nine_gloss','nine_stroke',26,rgb)
    canvas.alpha_composite(p,(x,10))
    x += w + 8
canvas.save('.workbuddy/_nine_preview.png')
print('ok', canvas.size)
