# -*- coding: utf-8 -*-
"""扫描 assets/resources/Audio 下所有 wav，打印参数（时长/采样率/位深/声道/大小）。"""
import os, wave, sys

AUD = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle\assets\resources\Audio"

rows = []
for fn in sorted(os.listdir(AUD)):
    if not fn.lower().endswith('.wav'):
        continue
    p = os.path.join(AUD, fn)
    size = os.path.getsize(p)
    try:
        with wave.open(p, 'rb') as w:
            ch = w.getnchannels()
            sw = w.getsampwidth()
            fr = w.getframerate()
            n = w.getnframes()
            dur = n / fr if fr else 0
    except Exception as e:
        rows.append((fn, size, 0, 0, 0, 0, 'ERR:%s' % e))
        continue
    rows.append((fn, size, ch, sw * 8, fr, dur, ''))

out = []
out.append('%-12s %10s %6s %6s %8s %8s' % ('file', 'bytes', 'ch', 'bits', 'rate', 'dur_s'))
for fn, size, ch, bits, fr, dur, err in rows:
    out.append('%-12s %10d %6s %6s %8s %8.2f %s' % (fn, size, ch, bits, fr, dur, err))
total = sum(r[1] for r in rows)
out.append('TOTAL bytes = %d (%.2f MB)' % (total, total / 1048576.0))

txt = '\n'.join(out)
open(r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle\.workbuddy\tools\_audio_info.txt", 'w', encoding='utf-8').write(txt)
print(txt)
