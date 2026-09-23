# -*- coding: utf-8 -*-
"""差距分析辅助：语言包一致性 + 关键词覆盖扫描（只读，不改任何源文件）"""
import json, os, re

ROOT = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle"
OUT = os.path.join(ROOT, ".workbuddy", "gap_scan.txt")
lines = []

def w(s=""):
    lines.append(str(s))

# ---------- 1. 语言包 ----------
loc = open(os.path.join(ROOT, "assets", "Scripts", "Core", "Locale.ts"), encoding="utf-8").read()
ts_keys = set(re.findall(r"^\s{4}([A-Za-z_][A-Za-z0-9_]*):\s*\{", loc, re.M))
zh = json.load(open(os.path.join(ROOT, "assets", "resources", "Text", "zh.json"), encoding="utf-8-sig"))
en = json.load(open(os.path.join(ROOT, "assets", "resources", "Text", "en.json"), encoding="utf-8-sig"))
w("== 语言包 ==")
w(f"Locale.ts 内联条目 {len(ts_keys)} 项 / zh.json {len(zh)} 键 / en.json {len(en)} 键")
w(f"zh.json 与 en.json 键差异: {sorted(set(zh) ^ set(en))[:20]}")
w(f"Locale.ts 有而 zh.json 无: {sorted(ts_keys - set(zh))[:25]}")
w(f"zh.json 有而 Locale.ts 无: {sorted(set(zh) - ts_keys)[:25]}")

# ---------- 2. 代码里是否出现原版系统的关键词 ----------
KW = [
    ("里程碑 Milestone", r"milestone|Milestone"),
    ("商店 Modal/shop 面板", r"openShop|ShopModal|shopPanel"),
    ("悬停翻转 HoverMode", r"hoverMode|HoverMode|p_hover"),
    ("随机连锁翻转 RandomFlip", r"randomflip|randomFlip|RandomFlip"),
    ("瓶盖收益升级 IncomeCap", r"incomecap|IncomeUpgradeCap"),
    ("购买价格升级 PurchasePrice", r"PurchasePriceUpgrade|purchasePrice"),
    ("助手阶数许可 Capability", r"CapabilityUpgrade|capability"),
    ("完成度检查器 Completion", r"CompletionChecker|completion"),
    ("新手引导 Guide", r"guide|Guide"),
    ("双倍闸门 Gate", r"gate|Gate"),
    ("离线收益 Offline", r"applyOffline|offline"),
    ("狂暴 Berserk", r"berserk"),
    ("武士 Samurai", r"samurai"),
    ("飞天可乐 Coke", r"coke"),
    ("成就 Achievement", r"achievement|Ach"),
    ("对象池 Pool", r"Pool|pool\."),
    ("大数字格式化 BigNumber", r"fmt\(|BigNumber"),
]
w("\n== 关键词覆盖（assets/Scripts 下出现的 .ts 文件数）==")
files = {}
for dp, _, fns in os.walk(os.path.join(ROOT, "assets", "Scripts")):
    for fn in fns:
        if fn.endswith(".ts"):
            files[os.path.join(dp, fn)] = open(os.path.join(dp, fn), encoding="utf-8", errors="replace").read()
for name, pat in KW:
    hits = [os.path.relpath(p, ROOT) for p, t in files.items() if re.search(pat, t)]
    w(f"{name}: {len(hits)} 文件" + ("" if not hits else f"  ->  {', '.join(hits[:4])}"))

# ---------- 3. 资源目录规模 ----------
def count(d, exts):
    n = 0
    for dp, _, fns in os.walk(d):
        for f in fns:
            if f.lower().endswith(exts):
                n += 1
    return n
proj_res = os.path.join(ROOT, "assets", "resources")
w("\n== 资源规模 ==")
w(f"项目 resources: png {count(proj_res, ('.png',))} / wav {count(proj_res, ('.wav',))} / ttf {count(proj_res, ('.ttf',))} / json {count(proj_res, ('.json',))}")

REF = r"E:\LDC_Fby\BottleFlipInc\Bottle Flip Inc Demo\Bottle_Flip_Inc_全量资源导出"
if os.path.isdir(REF):
    w(f"参考导出: 图片纹理 {count(os.path.join(REF,'01_图片纹理_Textures'), ('.png',))} / 精灵切片 {count(os.path.join(REF,'02_精灵切片_Sprites'), ('.png',))} / 音频 {count(os.path.join(REF,'03_音频音效_Audio'), ('.wav',))} / 字体 {count(os.path.join(REF,'05_字体资源_Fonts'), ('.ttf',))} / shader {count(os.path.join(REF,'07_着色器_Shaders'), ('.shader','.txt','.shadergraph'))} / 材质 {count(os.path.join(REF,'08_材质配置清单_Materials'), ('.json','.mat','.txt'))} / 3D网格 {count(os.path.join(REF,'04_3D模型网格_Meshes_3D'), ('.obj','.json','.mesh'))}")

open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print("\n".join(lines))
