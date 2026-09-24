# -*- coding: utf-8 -*-
"""
TapBottle 音频压缩 / 转 MP3
---------------------------
- 把 assets/resources/Audio/*.wav 全部编码为同名 .mp3（代码按 'Audio/xxx' 路径加载，无需改 TS）
- 原 wav 备份到 .workbuddy/audio_src/（不删源，确认后再清理）
用:  python audio_conv.py            # 转换
     python audio_conv.py --purge    # 转换后删除 assets 里的 wav + wav.meta
"""
import os, sys, wave, shutil, time

import lameenc

PROJ = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle"
AUD = os.path.join(PROJ, "assets", "resources", "Audio")
BAK = os.path.join(PROJ, ".workbuddy", "audio_src")

# 码率分档（kbps）：长音乐吃体积 → 96k 立体声；短音效保持质感。
# 单声道文件自动用 mono 编码，节省一半。
RATE_MAP = {
    'bgm':    96,   # 116.6s 立体声，20.5MB → ~1.4MB
    'win':   128,   # 胜利音，保留质感
    'buy':   128,
    'hit':   128,
    'slash': 128,
    'button': 96,
    'click':  64,
    'click2': 64,
    'pop1':   64,
    'pop2':   64,
    'pop3':   64,
    'pop4':   64,
    'pop5':   64,
}
DEFAULT_RATE = 96


def read_wav_pcm(path):
    """返回 (pcm_bytes, channels, rate, sampwidth)"""
    with wave.open(path, 'rb') as w:
        ch = w.getnchannels()
        sw = w.getsampwidth()
        rate = w.getframerate()
        pcm = w.readframes(w.getnframes())
    if sw != 2:
        raise ValueError('only 16-bit PCM supported, got %d bytes/sample' % sw)
    return pcm, ch, rate, sw


def encode_mp3(pcm, ch, rate, kbps):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(rate)
    enc.set_out_sample_rate(rate)   # 显式保持源采样率（否则低码率下 LAME 会自动降到 32kHz）
    enc.set_channels(ch)
    enc.set_quality(2)          # 0=最慢最好 … 9=最快
    data = enc.encode(pcm)
    data += enc.flush()
    return bytes(data)


def main():
    purge = '--purge' in sys.argv
    os.makedirs(BAK, exist_ok=True)

    files = sorted(f for f in os.listdir(AUD) if f.lower().endswith('.wav'))
    rows, total_old, total_new = [], 0, 0
    for fn in files:
        src = os.path.join(AUD, fn)
        name = os.path.splitext(fn)[0]
        dst = os.path.join(AUD, name + '.mp3')
        old = os.path.getsize(src)
        kbps = RATE_MAP.get(name, DEFAULT_RATE)

        pcm, ch, rate, sw = read_wav_pcm(src)
        mp3 = encode_mp3(pcm, ch, rate, kbps)
        with open(dst, 'wb') as f:
            f.write(mp3)

        new = os.path.getsize(dst)
        total_old += old
        total_new += new
        rows.append((name, old, new, ch, rate, kbps, len(pcm) / (ch * 2) / rate))

        # 备份原始 wav（保留 wav.meta 一起，便于整体回滚）
        shutil.copy2(src, os.path.join(BAK, fn))
        m = src + '.meta'
        if os.path.exists(m):
            shutil.copy2(m, os.path.join(BAK, fn + '.meta'))

    lines = ['%-9s %11s %10s %7s %6s %6s %8s %7s' %
             ('name', 'wav_B', 'mp3_B', 'ratio', 'ch', 'rate', 'kbps', 'dur_s')]
    for name, old, new, ch, rate, kbps, dur in rows:
        lines.append('%-9s %11d %10d %6.1f%% %6d %6d %8d %7.2f' %
                     (name, old, new, 100.0 * new / old, ch, rate, kbps, dur))
    lines.append('TOTAL     %11d %10d %6.1f%%   ->  %.2f MB  (was %.2f MB)' %
                 (total_old, total_new, 100.0 * total_new / total_old,
                  total_new / 1048576.0, total_old / 1048576.0))

    if purge:
        for fn in files:
            os.remove(os.path.join(AUD, fn))
            m = os.path.join(AUD, fn + '.meta')
            if os.path.exists(m):
                os.remove(m)
        lines.append('PURGED: removed %d wav + meta from assets' % len(files))

    txt = '\n'.join(lines)
    open(os.path.join(PROJ, '.workbuddy', 'tools', '_audio_conv.txt'),
         'w', encoding='utf-8').write(txt)
    print(txt)


if __name__ == '__main__':
    main()
