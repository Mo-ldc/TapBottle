# 把瓶盖染色底图 capart_0 的蓝灰色偏转成中性灰白（保留 alpha 与明暗层次），
# 让 Sprite.color 染色后各阶色相都是「真色」——否则金色 tint 会混成橄榄绿（用户看到的
# 「红瓶产绿盖」的另一半根因）。
# 用法：先 dry 预览，加 --apply 才写回（写回前备份到 .workbuddy/texture_src/capart_0_neutral_bak.png）
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'assets/resources/Textures/bottle/capart_0.png')
BAK = os.path.join(ROOT, '.workbuddy/texture_src/capart_0_neutral_bak.png')

CAP_COLOR = ['#EDF2F7', '#7BC24E', '#48A8D8', '#E8A838', '#F2D43C', '#E8654F', '#C89BF0']
ART_NAMES = ['白', '绿', '蓝', '橙', '金', '红', '紫']


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def render(base_rgb, tint, label):
    r = base_rgb[0] * tint[0] // 255
    g = base_rgb[1] * tint[1] // 255
    b = base_rgb[2] * tint[2] // 255
    print('  %-6s tint=%s -> #%02X%02X%02X' % (label, tint, r, g, b))


def main():
    apply = '--apply' in sys.argv
    im = Image.open(P).convert('RGBA')
    w, h = im.size
    px = im.load()
    lums = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= 200:
                lums.append(0.299 * r + 0.587 * g + 0.114 * b)
    lums.sort()
    p99 = lums[int(len(lums) * 0.99)]
    k = 250.0 / p99
    print('不透明像素=%d 亮度 p50=%.0f p99=%.0f max=%.0f -> 缩放系数 k=%.3f'
          % (len(lums), lums[len(lums) // 2], p99, lums[-1], k))

    # 染色效果预览：原底图 vs 中性化后
    dom = lums[len(lums) // 2]
    orig = (int(dom * 0.72), int(dom * 0.72), int(dom * 0.80))  # 近似原底图蓝灰
    print('--- 原底图(蓝灰)染色 ---')
    for i, c in enumerate(CAP_COLOR):
        render(orig, hx(c), ART_NAMES[i])
    print('--- 中性化后(k=%.3f)染色 ---' % k)
    for i, c in enumerate(CAP_COLOR):
        render((int(dom * k), int(dom * k), int(dom * k)), hx(c), ART_NAMES[i])

    if not apply:
        print('\n(dry run，加 --apply 才写回)')
        return

    os.makedirs(os.path.dirname(BAK), exist_ok=True)
    if not os.path.exists(BAK):
        shutil.copy2(P, BAK)
        print('已备份原图 ->', BAK)
    im2 = Image.open(P).convert('RGBA')
    p2 = im2.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = p2[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            v = min(255, int(round(lum * k)))
            p2[x, y] = (v, v, v, a)
    im2.save(P)
    print('已写回中性底图 ->', P)


main()
