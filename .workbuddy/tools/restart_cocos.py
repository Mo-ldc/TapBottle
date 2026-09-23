#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
restart_cocos.py —— Cocos Creator 项目「重载 / 重启」，治「引擎不自动更新」

背景：Cocos Creator 3.8.x 经常不自动感知磁盘变化——新拷入的图不生成 .meta、
改完 .ts 不重编译、library/ 里缓存了旧的资源导入结果。本脚本提供两档处理：

  软重载（默认，不动进程，2~10 秒）
      project_refresh_assets  → 重新扫描资源库（生成缺失的 .meta）
      debug_wait_compile      → 等编译（可选先删 temp/programming 强制全量重编译）
      scene_soft_reload       → 软重载当前场景
      读控制台                → 把编译/运行错误直接打出来

  完整重启（--full，30~180 秒）
      先问编辑器拿真实启动参数与主进程 PID
      → 检查场景有没有未保存改动（有则拒绝，除非 --force）
      → Editor.App.quit() 优雅退出
      → 按原命令行重新拉起
      → 轮询 MCP /health 就绪，确认打开的还是本项目

用法（在项目根目录）：
  <py> .workbuddy/tools/restart_cocos.py --status            # 只看状态，不改动
  <py> .workbuddy/tools/restart_cocos.py                     # 软重载（默认）
  <py> .workbuddy/tools/restart_cocos.py --hard-cache        # 软重载 + 删代码缓存强制全量重编译
  <py> .workbuddy/tools/restart_cocos.py --full              # 完整重启
  <py> .workbuddy/tools/restart_cocos.py --full --force      # 有未保存改动也重启
  <py> .workbuddy/tools/restart_cocos.py --full --preview    # 重启后自动开游戏预览
  <py> .workbuddy/tools/restart_cocos.py --launch            # 编辑器没开时，直接启动本项目

退出码：0 = 成功；1 = 失败/被拒绝；2 = 环境问题（编辑器未开且无法启动）
"""
import argparse
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

try:
    import cocos_mcp as mcp
except ImportError:
    print("找不到同目录的 cocos_mcp.py，请确保两个脚本在一起。", file=sys.stderr)
    sys.exit(2)

EXE = r"D:\CoCosIDE\Creator\3.8.8\CocosCreator.exe"
IMAGE = "CocosCreator.exe"
TASKLIST = r"C:\Windows\System32\tasklist.exe"
TASKKILL = r"C:\Windows\System32\taskkill.exe"
CODE_CACHE = os.path.join(ROOT, "temp", "programming")   # 3.8.8 的编译产物 / 代码缓存
# 这两个键是编辑器自己补的默认值，不属于用户原始命令行，重启时不回传
SKIP_ARG_KEYS = {"dev", "home"}


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- 进程

def proc_count():
    """当前 CocosCreator.exe 进程数（0 = 编辑器没开）"""
    try:
        r = subprocess.run([TASKLIST, "/FI", "IMAGENAME eq " + IMAGE, "/FO", "CSV", "/NH"],
                           capture_output=True, text=True, errors="replace", timeout=30)
    except Exception:
        return -1
    n = 0
    for line in (r.stdout or "").splitlines():
        if line.strip().startswith('"%s"' % IMAGE):
            n += 1
    return n


def kill_pid(pid, force):
    cmd = [TASKKILL, "/PID", str(pid)]
    if force:
        cmd.append("/F")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=30)
        return r.returncode == 0, (r.stdout or r.stderr or "").strip()
    except Exception as e:
        return False, str(e)


def launch(cmd, cwd=None):
    """分离方式拉起编辑器，父进程退出后不受影响"""
    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    with open(os.devnull, "wb") as nul:
        return subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL,
                                stdout=nul, stderr=nul, close_fds=True,
                                creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)


# ---------------------------------------------------------------- 编辑器信息

def editor_probe():
    """返回 {ok, pid(main), ppid, args, project, version}；编辑器没开或 MCP 不可达时 ok=False"""
    out = {}
    try:
        r = mcp.call_tool("execute_editor_script", {"code": (
            "var o={ok:true};"
            "o.mainPid=(typeof process!=='undefined'&&typeof process.ppid==='number')?process.ppid:null;"
            "o.selfPid=(typeof process!=='undefined')?process.pid:null;"
            "o.args=(Editor.App&&Editor.App.args)||null;"
            "o.version=(Editor.App&&Editor.App.version)||null;"
            "o.project=(Editor.Project&&Editor.Project.path)||null;"
            "o.projectName=(Editor.Project&&Editor.Project.name)||null;"
            "return o;"
        )}, timeout=15)
        if r.get("isError"):
            return {"ok": False, "error": r.get("data") or r.get("text")}
        d = r.get("data", {}).get("result", {})
        d["ok"] = True
        return d
    except Exception as e:
        return {"ok": False, "error": str(e)}


def build_launch_cmd(args, project=None):
    """把 Editor.App.args 还原成命令行"""
    if not args:
        return [EXE, "--project", project or ROOT, "--can-show-upgrade-dialog", "true"]
    exe = EXE
    rest = []
    for k, v in args.items():
        if os.sep in k or "/" in k:      # argv[0]，就是 exe 自己
            exe = k
            continue
        if k in SKIP_ARG_KEYS or k == "project":
            continue
        if v is True:
            rest += ["--" + k]
        elif v is False or v is None:
            continue
        else:
            rest += ["--" + k, str(v)]
    return [exe, "--project", project or ROOT] + rest


# ---------------------------------------------------------------- MCP 操作

def wait_mcp(seconds, expect_project=None):
    t0 = time.time()
    while time.time() - t0 < seconds:
        h = mcp.health()
        if h.get("status") == "ok":
            if expect_project:
                info = mcp.read_resource("cocos://project/info").get("data", {})
                p = (info.get("path") or "").rstrip("\\/").lower()
                if p != expect_project.rstrip("\\/").lower():
                    time.sleep(2)
                    continue
            return True
        time.sleep(3)
    return False


def soft_step(name, fn):
    try:
        r = fn()
    except Exception as e:
        log("  [失败] %-24s %s" % (name, e))
        return False
    if r.get("isError"):
        d = r.get("data") or {}
        log("  [失败] %-24s %s" % (name, d.get("error") or r.get("text") or "isError"))
        return False
    log("  [ok]   %-24s %s" % (name, _brief(r.get("data"))))
    return True


def _brief(d):
    if not isinstance(d, dict):
        return ""
    keys = ("success", "compiled", "timeout", "waitedMs", "ready", "dirty", "counts")
    parts = ["%s=%s" % (k, d[k]) for k in keys if k in d]
    return " ".join(parts)


def report_console(limit=12):
    r = mcp.call_tool("read_console", {"action": "get", "count": limit,
                                       "types": ["error", "warn"]}, timeout=30)
    entries = (r.get("data") or {}).get("entries") or []
    if not entries:
        log("  控制台：无 error / warn")
        return 0
    log("  控制台 %d 条 error/warn：" % len(entries))
    for e in entries[-limit:]:
        src = e.get("source", "?")
        lvl = (e.get("level") or e.get("type") or "?").upper()
        msg = (e.get("message") or "").replace("\n", " ")[:160]
        log("    [%s/%s] %s" % (src, lvl, msg))
    return len(entries)


# ---------------------------------------------------------------- 三个动作

def do_status():
    log("=== Cocos Creator 状态 ===")
    n = proc_count()
    log("编辑器进程数        : %s" % ("未知" if n < 0 else n))
    h = mcp.health()
    log("MCP %s : %s" % (mcp.URL, h.get("status") or h))
    if h.get("status") != "ok":
        log("→ 编辑器未运行或 MCP 服务未启动。用 --launch 启动本项目，或 --full 走完整重启。")
        return 0 if n <= 0 else 1
    info = mcp.read_resource("cocos://project/info").get("data", {})
    e = mcp.read_resource("cocos://editor/info").get("data", {})
    sc = mcp.read_resource("cocos://scene/current").get("data", {})
    log("项目                : %s" % info.get("name"))
    log("项目路径            : %s" % info.get("path"))
    log("路径与本工程一致    : %s" % (os.path.normcase(info.get("path", "")) == os.path.normcase(ROOT)))
    log("引擎版本            : %s" % e.get("version"))
    log("当前场景            : %s" % sc.get("name"))
    dr = mcp.call_tool("scene_query", {"action": "dirty"})
    log("场景有未存改动      : %s" % ((dr.get("data") or {}).get("dirty")))
    ext = os.path.isdir(CODE_CACHE)
    log("代码缓存 temp/programming: %s" % ("存在（可删以强制重编译）" if ext else "不存在"))
    return 0


def do_soft(hard_cache):
    log("=== 软重载（不重启编辑器）===")
    if mcp.health().get("status") != "ok":
        log("MCP 不可达：编辑器没开，或扩展未启动。")
        return 2
    if hard_cache:
        if os.path.isdir(CODE_CACHE):
            try:
                shutil.rmtree(CODE_CACHE)
                log("  [ok]   删除代码缓存 %s" % CODE_CACHE)
            except Exception as e:
                log("  [失败] 删除代码缓存：%s（可能被编辑器占用，先退出编辑器再试）" % e)
        else:
            log("  [跳过] 代码缓存目录不存在")
    ok = True
    ok &= soft_step("project_refresh_assets", lambda: mcp.call_tool("project_refresh_assets", {}, timeout=60))
    # 注意：timeout 单位是毫秒；无待编译任务时会返回 timeout=true，属正常
    ok &= soft_step("debug_wait_compile", lambda: mcp.call_tool(
        "debug_wait_compile", {"timeout": 15000}, timeout=40))
    ok &= soft_step("scene_soft_reload", lambda: mcp.call_tool("scene_soft_reload", {}, timeout=60))
    log("  控制台：")
    report_console()
    log("软重载完成。" if ok else "软重载有步骤失败，见上。")
    log("提示：若仍不生效，跑 --hard-cache；再不行就 --full 完整重启。")
    return 0 if ok else 1


def do_full(force, timeout, preview, dry_run=False, yes=False):
    log("=== 完整重启编辑器 ===")
    probe = editor_probe()
    if not probe.get("ok"):
        log("拿不到编辑器信息（%s）。" % str(probe.get("error"))[:120])
        log("→ 编辑器可能没开。用 --launch 直接启动本项目。")
        return 2

    main_pid = probe.get("mainPid")
    args = probe.get("args")
    cur_project = probe.get("project")
    log("当前项目            : %s" % cur_project)
    log("引擎版本            : %s" % probe.get("version"))
    log("主进程 PID          : %s" % main_pid)
    if cur_project and os.path.normcase(cur_project) != os.path.normcase(ROOT):
        log("注意：编辑器打开的不是本工程（%s），重启后仍会打开它原有项目。" % cur_project)

    dr = mcp.call_tool("scene_query", {"action": "dirty"})
    dirty = (dr.get("data") or {}).get("dirty")
    log("场景有未存改动      : %s" % dirty)

    cmd = build_launch_cmd(args, project=ROOT)
    log("重启命令            : %s" % " ".join('"%s"' % c if " " in c else c for c in cmd))

    if dry_run:
        log("")
        log("[dry-run] 只预演不执行。会做的动作：")
        log("  1) Editor.App.quit() 优雅退出（失败则 taskkill PID %s，再不行 %s）"
            % (main_pid, "taskkill /F /IM " + IMAGE))
        log("  2) 重新拉起上面的命令")
        log("  3) 轮询 MCP /health 直到打开本项目（最多 %ds）" % timeout)
        log("  4) 刷新资源 + 等编译 + 场景软重载 + 打印控制台错误")
        if preview:
            log("  5) 打开游戏预览")
        if dirty:
            log("")
            log("⚠️ 当前场景有未保存改动，直接跑 --full 会被拒绝（除非 --force）。")
        return 0

    if dirty and not force:
        log("")
        log("拒绝重启：场景有未保存改动，重启会丢失。")
        log("先到编辑器里 Ctrl+S 保存场景，或加 --force 强行继续。")
        return 1

    if not _confirmed(yes, "将关闭编辑器并重新启动，编辑器里未保存的非场景内容也会丢失"):
        log("已取消。")
        return 1

    # 1) 优雅退出
    log("1) 请求编辑器优雅退出…")
    try:
        mcp.call_tool("execute_editor_script", {"code": (
            "setTimeout(function(){try{Editor.App.quit()}catch(e){}},80);"
            "return 'quitting';"
        )}, timeout=8)
    except Exception:
        pass    # 编辑器退出会断开 HTTP 连接，属预期

    # 2) 等进程消失
    log("2) 等待进程退出…")
    t0 = time.time()
    while time.time() - t0 < 40:
        n = proc_count()
        if n <= 0:
            break
        time.sleep(1.5)
    n = proc_count()
    if n > 0:
        log("   仍在运行（%d 个进程），尝试关闭主进程 PID %s…" % (n, main_pid))
        if main_pid:
            kill_pid(main_pid, force=False)
            time.sleep(4)
        n = proc_count()
    if n > 0:
        log("   仍有 %d 个进程。加 --force 会用 /F 强制结束（会影响所有 Cocos Creator 窗口）。" % n)
        if not force:
            log("   ⚠️ 已中止重启：不强制结束，避免与残留进程抢同一工程。")
            return 1
        subprocess.run([TASKKILL, "/F", "/IM", IMAGE], capture_output=True, timeout=30)
        time.sleep(3)
        n = proc_count()
        log("   强制结束后剩余进程：%d" % n)
        if n > 0:
            log("   ✗ 无法结束编辑器进程，请手动关闭后重试。")
            return 1
    log("   已退出。")

    # 3) 重新启动
    log("3) 启动编辑器…")
    try:
        p = launch(cmd, cwd=os.path.dirname(cmd[0]))
        log("   已拉起 PID %s" % p.pid)
    except Exception as e:
        log("   ✗ 启动失败：%s" % e)
        return 1

    # 4) 等就绪
    log("4) 等待 MCP 就绪（最多 %ds，编辑器首次加载较慢）…" % timeout)
    if not wait_mcp(timeout, expect_project=ROOT):
        log("   ✗ 超时未就绪。可能是 MCP 扩展未自动启动（%s 里 autoStart 需为 true），"
            "或编辑器弹了对话框等待操作。" % os.path.join("settings", "cocos-creator-mcp.json"))
        return 1
    log("   ✓ MCP 就绪，工程已打开。")

    # 5) 收尾
    log("5) 收尾：刷新资源 + 等编译 + 场景软重载")
    mcp.call_tool("project_refresh_assets", {}, timeout=60)
    mcp.call_tool("debug_wait_compile", {"timeout": 15000}, timeout=40)
    mcp.call_tool("scene_soft_reload", {}, timeout=60)
    report_console()

    if preview:
        log("6) 打开游戏预览…")
        r = mcp.call_tool("debug_preview", {"action": "start", "waitForReady": True,
                                           "waitTimeout": 60}, timeout=120)
        log("   %s" % (r.get("data") or r.get("text")))

    log("完整重启完成。")
    return 0


def do_launch():
    log("=== 启动本项目 ===")
    n = proc_count()
    if n > 0:
        log("已有 %d 个 CocosCreator.exe 在运行。" % n)
        probe = editor_probe()
        if probe.get("ok") and probe.get("project") == ROOT:
            log("本工程已经在编辑器里打开了，无需重复启动。")
            return 0
        log("将继续启动本工程（编辑器通常支持多实例）。")
    cmd = [EXE, "--project", ROOT, "--can-show-upgrade-dialog", "true"]
    log("命令：%s" % " ".join('"%s"' % c if " " in c else c for c in cmd))
    try:
        p = launch(cmd, cwd=os.path.dirname(EXE))
        log("已拉起 PID %s，等待就绪…" % p.pid)
    except Exception as e:
        log("✗ 启动失败：%s" % e)
        return 1
    if wait_mcp(240, expect_project=ROOT):
        log("✓ 就绪。")
        return 0
    log("✗ 超时未就绪。")
    return 1


def _confirmed(yes, prompt):
    """--yes 直接放行；非交互环境（无 TTY）默认拒绝，避免脚本里误重启"""
    if yes:
        return True
    if not sys.stdin or not getattr(sys.stdin, "isatty", lambda: False)():
        log("  非交互环境，未显式加 --yes —— 视为取消（不会重启）。")
        return False
    try:
        a = input("%s —— 确认？[y/N] " % prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return a in ("y", "yes", "是")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(add_help=True, description="Cocos Creator 项目重载/重启")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--status", action="store_true", help="只报告状态，不做任何改动")
    g.add_argument("--soft", action="store_true", help="软重载（默认）")
    g.add_argument("--full", action="store_true", help="完整重启编辑器")
    g.add_argument("--launch", action="store_true", help="直接启动本项目（编辑器没开时用）")
    ap.add_argument("--hard-cache", action="store_true", help="软重载时额外删代码缓存，强制全量重编译")
    ap.add_argument("--force", action="store_true", help="场景有未存改动也继续 / 允许 /F 强制结束进程")
    ap.add_argument("--dry-run", action="store_true", help="只预演 --full 的计划，不执行")
    ap.add_argument("--preview", action="store_true", help="重启后打开游戏预览")
    ap.add_argument("--timeout", type=int, default=240, help="等待 MCP 就绪的秒数（默认 240）")
    ap.add_argument("-y", "--yes", action="store_true", help="跳过 --full 的确认提示")
    a = ap.parse_args()

    if a.status:
        return do_status()
    if a.launch:
        return do_launch()
    if a.full:
        return do_full(a.force, a.timeout, a.preview, dry_run=a.dry_run, yes=a.yes)
    return do_soft(a.hard_cache)


if __name__ == "__main__":
    sys.exit(main())
