#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TapBottle 项目源码类型检查（过滤引擎声明噪音）

用法（在项目根目录执行）：
  <py> .workbuddy/tools/typecheck.py

等价于用 Cocos Creator 3.8.8 自带的 tsc，按 .workbuddy/tools/tsconfig.check.json
只检查 assets/**/*.ts，并把 cc.d.ts / jsb.d.ts 等引擎声明自身的报错过滤掉。

退出码：0 = 项目源码无错误；1 = 有错误（已打印）；2 = 运行环境异常。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NODE = r"C:\Users\A\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
TSC = r"D:\CoCosIDE\Creator\3.8.8\resources\app.asar.unpacked\node_modules\typescript\lib\tsc.js"
CHECK_CFG = os.path.join(ROOT, ".workbuddy", "tools", "tsconfig.check.json")
# 这些前缀下的报错来自引擎/扩展自身声明，与项目代码无关
NOISE = (r"D:\CoCosIDE", r"D:/CoCosIDE", "node_modules", "extensions/cocos-creator-mcp")


def main():
    for p in (NODE, TSC):
        if not os.path.exists(p):
            print("缺文件: %s" % p, file=sys.stderr)
            return 2
    r = subprocess.run([NODE, TSC, "--noEmit", "-p", CHECK_CFG],
                       cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = [l.strip() for l in (r.stdout or "").splitlines() if l.strip()]
    bad = [l for l in lines if re.search(r"error TS\d+", l) and not l.startswith(NOISE)]
    total = len([l for l in lines if re.search(r"error TS\d+", l)])

    print("=== TapBottle 源码类型检查 ===")
    print("原始报错 %d 条，其中引擎/扩展噪音 %d 条，项目源码 %d 条"
          % (total, total - len(bad), len(bad)))
    if bad:
        print("\n--- 需要修复 ---")
        for l in bad:
            print("  " + l)
        return 1
    print("\n项目源码无类型错误。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
