# -*- coding: utf-8 -*-
"""一次性 bake 脚本（第122轮）：把公司 logo PNG 做 rolling-XOR 混淆 + base64 分片，
生成 assets/Scripts/Core/WmData.ts。明文 PNG 不入库；重跑会整体覆盖 WmData.ts。
源图：C:/Users/A/Downloads/0.png（580x580, 66KB）
"""
import base64
import os

SRC = r"C:\Users\A\Downloads\0.png"
DST = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle\assets\Scripts\Core\WmData.ts"
KEY = "ZSZF@DSZ@2026"
TEXT = "掌上方舟开发四组"

def main():
    data = open(SRC, "rb").read()
    kb = KEY.encode("utf-8")
    out = bytearray(len(data))
    for i, b in enumerate(data):
        out[i] = b ^ kb[i % len(kb)]
    b64 = base64.b64encode(bytes(out)).decode("ascii")
    chunks = [b64[i:i + 1000] for i in range(0, len(b64), 1000)]
    cc = ", ".join(str(ord(c)) for c in TEXT)
    lines = ",\n    ".join("'%s'" % c for c in chunks)
    ts = (
        "/**\n"
        " * 权益水印资源（自动生成 —— .workbuddy/tools/_oneshot/gen_wmdata.py，勿手改）。\n"
        " * 原始 PNG（580x580）按 rolling-XOR（密钥 WM_KEY）混淆后 base64 分片存储；\n"
        " * 运行时由 Core/Wm.ts 还原为 SpriteFrame。明文 PNG / 明文文案均不入库。\n"
        " */\n"
        "export const WM_KEY = '%s';\n\n"
        "/** 显示文案的 charCode 表（避免明文出现在数据段） */\n"
        "export const WM_CC: number[] = [%s];\n\n"
        "/** 混淆 PNG 的 base64 分片（解码后需先 XOR 还原） */\n"
        "export const WM_CHUNKS: string[] = [\n    %s,\n];\n"
    ) % (KEY, cc, lines)
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, "w", encoding="utf-8", newline="\n") as f:
        f.write(ts)
    print("WmData.ts written:", os.path.getsize(DST), "bytes,", len(chunks), "chunks")

if __name__ == "__main__":
    main()
