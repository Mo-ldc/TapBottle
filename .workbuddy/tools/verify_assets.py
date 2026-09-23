#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TapBottle 资源路径一致性检查

背景：本项目按「路径字符串」取资源（Res.I.sf('ui/px_white2') / setFrame(sp, 'env/hand')），
且全部贴图必须在 Core/Res.ts 的 TEXTURE_PATHS 里登记才会被加载。
路径写错或漏登记时，Res.sf() 返回 null，画面空白但控制台不报错 —— 只能靠静态扫描发现。

检查项：
  1) 代码里引用的贴图路径，是否都在 TEXTURE_PATHS 里登记
  2) TEXTURE_PATHS 里登记的路径，对应文件是否真的存在
  3) 音频同理（AUDIO_PATHS）
  4) GameConfig 里 SKILLS / TREE_ICON 的 icon 路径
  5) 代码里 Res.I.play('xxx') 的音频名

用法（在项目根目录）：
  <py> .workbuddy/tools/verify_assets.py
退出码：0 = 全部通过；1 = 有问题（已列出）
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPTS = os.path.join(ROOT, "assets", "Scripts")
RES_TS = os.path.join(SCRIPTS, "Core", "Res.ts")
TEX_DIR = os.path.join(ROOT, "assets", "resources", "Textures")
AUDIO_DIR = os.path.join(ROOT, "assets", "resources", "Audio")


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def ts_files():
    out = []
    for base, _dirs, files in os.walk(SCRIPTS):
        for f in files:
            if f.endswith(".ts"):
                out.append(os.path.join(base, f))
    return out


def parse_path_list(src, name):
    m = re.search(r"export const %s[^=]*=\s*\[(.*?)\];" % name, src, re.S)
    if not m:
        return []
    return re.findall(r"'([^']+)'", m.group(1))


def main():
    problems = []
    res_src = read(RES_TS)
    tex_paths = parse_path_list(res_src, "TEXTURE_PATHS")     # 'Textures/ui/px_white2/spriteFrame'
    audio_paths = parse_path_list(res_src, "AUDIO_PATHS")     # 'Audio/click2'

    tex_keys = set(p[:-len("/spriteFrame")].replace("Textures/", "", 1)
                   for p in tex_paths if p.endswith("/spriteFrame"))
    audio_keys = set(p.replace("Audio/", "", 1) for p in audio_paths)

    # ---- 1) 收集代码里请求的贴图路径 ----
    # setFrame(sp, 'x' / img(..., 'x' / sf('x') / Res.I.sf('x') / sliced(..,'x' / tex: 'x' / icon: 'x'
    pats = [
        r"setFrame\s*\(\s*[^,]+,\s*'([^']+)'",
        r"\bsf\s*\(\s*'([^']+)'\s*\)",
        r"\bslice\s*\(\s*'([^']+)'",
        r"\bsliced\s*\([^,]+,\s*'([^']+)'",
        r"\bimg\s*\([^,]+,\s*'([^']+)'",
        r"\btex:\s*'([^']+)'",
        r"\bicon:\s*'([^']+)'",
        r"Res\.I\.sf\('([^']+)'\)",
    ]
    requested = {}
    for f in ts_files():
        src = read(f)
        for p in pats:
            for mm in re.finditer(p, src):
                # 排除字符串拼接前缀，如 'bottle/body_' + tier —— 它是动态拼出的完整路径
                tail = src[mm.end():mm.end() + 6]
                if re.match(r"\s*\+", tail):
                    continue
                requested.setdefault(mm.group(1), set()).add(
                    os.path.relpath(f, ROOT).replace("\\", "/"))

    # 过滤掉明显不是贴图路径的（含扩展名、含 http、db://）
    def looks_like_texture(s):
        return ("/" in s) and not re.search(r"\.(png|jpg|jpeg|json|wav|mp3|ogg|ttf|anim|prefab|scene)$", s) \
            and not s.startswith("http") and not s.startswith("db://") and not s.startswith("cc.")

    missing_reg = []
    for path, users in sorted(requested.items()):
        if not looks_like_texture(path):
            continue
        if path not in tex_keys:
            missing_reg.append((path, sorted(users)))

    # ---- 2) 登记的贴图是否真有文件 ----
    missing_file = []
    for p in tex_paths:
        if not p.endswith("/spriteFrame"):
            continue
        rel = p[len("Textures/"):-len("/spriteFrame")]
        cands = [os.path.join(TEX_DIR, rel + ext) for ext in (".png", ".jpg", ".jpeg")]
        if not any(os.path.exists(c) for c in cands):
            missing_file.append(rel)

    # ---- 3) 音频 ----
    audio_missing_reg = []
    for f in ts_files():
        src = read(f)
        for mm in re.finditer(r"(?:Res\.I\.)?play\w*\(\s*'([^']+)'", src):
            n = mm.group(1)
            if n in ("click", "click2") or n in audio_keys or "/" in n:
                continue
            # 只报纯名字形式
            if n not in audio_keys:
                audio_missing_reg.append((n, os.path.relpath(f, ROOT).replace("\\", "/")))
    audio_missing_file = [k for k in audio_keys
                          if not any(os.path.exists(os.path.join(AUDIO_DIR, k + e))
                                     for e in (".wav", ".mp3", ".ogg"))]

    # ---- 输出 ----
    print("=== TapBottle 资源路径检查 ===")
    print("TEXTURE_PATHS: %d 条,  AUDIO_PATHS: %d 条" % (len(tex_keys), len(audio_keys)))

    def section(title, rows, fmt):
        print("\n--- %s：%d ---" % (title, len(rows)))
        for r in rows:
            print("  " + fmt(r))

    section("代码引用了但未登记进 TEXTURE_PATHS（图会是空白）", missing_reg,
            lambda r: "'%s'   ← %s" % (r[0], ", ".join(r[1])))
    section("登记了但磁盘上没有文件", missing_file, lambda r: r)
    section("audio 未登记", audio_missing_reg, lambda r: "'%s'   ← %s" % (r[0], r[1]))
    section("audio 登记了但磁盘上没有文件", audio_missing_file, lambda r: r)

    bad = len(missing_reg) + len(missing_file) + len(audio_missing_reg) + len(audio_missing_file)
    print("\n合计问题 %d 条" % bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
