import { Node } from 'cc';
import { Prefabs } from './Prefabs';

/**
 * Pool —— 按预制体 key 的通用节点对象池。
 *
 * 迁移到预制体驱动后，凡是「高频生成 + 用完即弃」的对象全部走这里，不再 `new Node()`
 * 也不再 `destroy()`：
 *   · 金币/瓶盖飘字、Toast 提示条、升级列表行、瓶盖飞行粒子、买瓶飞入的临时瓶子……
 * 典型收益是**稳态零分配**：跑起来之后 GC 不再被 Node/Component 的反复创建销毁触发。
 *
 * 约定（很重要，写错会拿到脏状态）：
 *   · `release()` 只做「摘出父节点 + 隐藏 + 入池」，**不销毁**，也不重置业务字段；
 *   · 业务状态必须由调用方在 `acquire()` 之后自己重置（位置/缩放/角度/文字/颜色…），
 *     因为池子不认识你的组件。建议每个可池化对象都提供一个 `resetForReuse()`。
 *   · 池子有容量上限（`MAX_FREE`），超出直接 `destroy()`，避免某个异常路径把几百个节点
 *     永久挂在池子里（表现为内存只涨不降）。
 */
const MAX_FREE = 64;

interface Slot {
    free: Node[];
    /** 累计创建数、累计复用数 —— 验收/调优时看命中率用 */
    created: number;
    reused: number;
}

export class Pool {
    private static slots: Record<string, Slot> = {};

    private static slot(key: string): Slot {
        let s = Pool.slots[key];
        if (!s) { s = { free: [], created: 0, reused: 0 }; Pool.slots[key] = s; }
        return s;
    }

    /**
     * 取一个实例并挂到 `parent`（自动 active=true）。
     * 池子里没有可用实例时才真正 instantiate。
     */
    static acquire(key: string, parent: Node): Node | null {
        const s = Pool.slot(key);
        // 池子里可能混着「已经被别处意外销毁」的节点，从尾部逐个验活
        while (s.free.length) {
            const n = s.free.pop()!;
            if (n && n.isValid) {
                n.active = true;
                if (n.parent !== parent) { parent.addChild(n); }
                s.reused++;
                return n;
            }
        }
        const fresh = Prefabs.boot().make(key, parent);
        if (!fresh) { return null; }
        fresh.active = true;
        s.created++;
        return fresh;
    }

    /** 归还实例：摘出父节点、隐藏、入池（不销毁、不重置业务字段） */
    static release(key: string, node: Node | null) {
        if (!node || !node.isValid) { return; }
        const s = Pool.slot(key);
        node.active = false;
        node.removeFromParent();
        if (s.free.length >= MAX_FREE) { node.destroy(); return; }
        s.free.push(node);
    }

    /** 预热：进场景后一次性把常用对象建好，避免首次触发时掉帧 */
    static warm(key: string, count: number) {
        const s = Pool.slot(key);
        for (let i = 0; i < count; i++) {
            const n = Prefabs.boot().make(key, null);
            if (!n) { return; }
            n.active = false;
            s.free.push(n);
            s.created++;
        }
    }

    /** 清空某个 key（切场景时调用 —— 池里的节点会跟着旧场景一起销毁，必须同步丢弃引用） */
    static clear(key?: string) {
        if (key) {
            const s = Pool.slots[key];
            if (s) { s.free.length = 0; }
            return;
        }
        for (const k in Pool.slots) { Pool.slots[k].free.length = 0; }
    }

    /** 调试用：当前池化统计 */
    static stats(): Record<string, { free: number, created: number, reused: number }> {
        const out: Record<string, { free: number, created: number, reused: number }> = {};
        for (const k in Pool.slots) {
            const s = Pool.slots[k];
            out[k] = { free: s.free.length, created: s.created, reused: s.reused };
        }
        return out;
    }
}
