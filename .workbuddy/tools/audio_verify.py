# -*- coding: utf-8 -*-
"""校验生成的 mp3：解析 MPEG 帧头，累计采样数换算时长，和源 wav 对比。"""
import os, wave

PROJ = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle"
AUD = os.path.join(PROJ, "assets", "resources", "Audio")
BAK = os.path.join(PROJ, ".workbuddy", "audio_src")

BR_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BR_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
SR_V1 = [44100, 48000, 32000, 0]
SR_V2 = [22050, 24000, 16000, 0]


def mp3_duration(path):
    data = open(path, 'rb').read()
    i = 0
    # 跳过 ID3v2
    if data[:3] == b'ID3':
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        i = 10 + size
    frames, sr_used, ch_used, kbps_used = 0, 0, 0, 0
    n = len(data)
    while i + 4 <= n:
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
        ver = (b1 >> 3) & 0x3      # 3=MPEG1 2=MPEG2 0=MPEG2.5
        layer = (b1 >> 1) & 0x3    # 1=Layer III
        br_idx = (b2 >> 4) & 0xF
        sr_idx = (b2 >> 2) & 0x3
        pad = (b2 >> 1) & 0x1
        ch_mode = (b3 >> 6) & 0x3  # 3=mono
        if ver != 3 or layer != 1 or br_idx in (0, 15) or sr_idx == 3:
            i += 1
            continue
        kbps = BR_V1L3[br_idx]
        sr = SR_V1[sr_idx]
        flen = 144 * kbps * 1000 // sr + pad
        if flen <= 4:
            i += 1
            continue
        frames += 1
        sr_used, ch_used, kbps_used = sr, (1 if ch_mode == 3 else 2), kbps
        i += flen
    return frames * 1152.0 / sr_used if sr_used else 0, sr_used, ch_used, kbps_used


lines = ['%-9s %9s %9s %7s %6s %6s %5s  %s' %
         ('name', 'wav_s', 'mp3_s', 'delta_s', 'rate', 'ch', 'kbps', 'head')]
bad = 0
for fn in sorted(os.listdir(AUD)):
    if not fn.lower().endswith('.mp3'):
        continue
    name = os.path.splitext(fn)[0]
    wav = os.path.join(BAK, name + '.wav')
    with wave.open(wav, 'rb') as w:
        wdur = w.getnframes() / w.getframerate()
        wch = w.getnchannels()
    d, sr, ch, kbps = mp3_duration(os.path.join(AUD, fn))
    head = open(os.path.join(AUD, fn), 'rb').read(3)
    ok = abs(d - wdur) < 0.12 and ch == wch
    if not ok:
        bad += 1
    lines.append('%-9s %9.3f %9.3f %7.3f %6d %6d %5d  %s %s' %
                 (name, wdur, d, d - wdur, sr, ch, kbps, head.hex(), 'OK' if ok else 'MISMATCH'))
lines.append('bad = %d' % bad)
txt = '\n'.join(lines)
open(os.path.join(PROJ, '.workbuddy', 'tools', '_audio_verify.txt'), 'w', encoding='utf-8').write(txt)
print(txt)
