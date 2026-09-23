import { Node, Label } from 'cc';
import { MILESTONES } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt, fmtTime } from '../Core/Util';
import { label } from './UIKit';
import { openPanel, rowCard } from './Panel';

/** 统计面板 */
export function openStats(parent: Node) {
    const p = openPanel(parent, 'stats', 700);
    const C = p.body;
    const RW = 620;

    const defs: Array<{ key: string, get: () => string }> = [
        { key: 'playtime', get: () => fmtTime(G.data.stats.time) },
        { key: 'total_money', get: () => fmt(G.data.stats.earned) },
        { key: 'total_flips', get: () => fmt(G.data.stats.flips) },
        { key: 'total_caps', get: () => fmt(G.data.stats.capsEarned) },
        { key: 'highest_flip', get: () => '$' + fmt(G.data.stats.best) },
        { key: 'per_sec', get: () => '$' + fmt(G.data.eps) },
        // 里程碑（GDD §7，24 阶真实阈值）——它同时决定升级面板里能看到几条词条
        { key: 'milestone', get: () => 'M' + G.milestone + ' / ' + MILESTONES.length },
        {
            key: 'ms_next',
            get: () => {
                const nx = G.msNext;
                return nx ? 'M' + nx.n + '  ' + fmt(G.msProgress) + '/' + fmt(nx.need) : t('ms_max', G.lang);
            },
        },
    ];

    const labels: Array<{ lb: Label, get: () => string }> = [];
    const allTime = label(C, t('all_time', G.lang), -296, -14, 300, 40, {
        size: 28, color: '#9FB3CC', hAlign: 'left', anchorX: 0,
    });
    void allTime;
    let y = -68;
    for (const d of defs) {
        const card = rowCard(C, RW, 88, 0, y, '#1D2636');
        label(card, t(d.key, G.lang), -280, 0, 320, 50, { size: 26, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
        const v = label(card, '', 280, 0, 340, 50, { size: 28, color: '#FFD75E', hAlign: 'right', anchorX: 1 });
        labels.push({ lb: v, get: d.get });
        y -= 98;
    }

    // 瓶子分布
    y -= 14;
    label(C, t('shop_bottles', G.lang), -296, y, 300, 40, {
        size: 28, color: '#9FB3CC', hAlign: 'left', anchorX: 0,
    });
    y -= 54;
    const bottleVals: Label[] = [];
    for (let i = 0; i < 7; i++) {
        const card = rowCard(C, RW, 76, 0, y, '#1D2636');
        label(card, t(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'Celestial'][i], G.lang),
            -280, 0, 320, 50, { size: 24, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
        const v = label(card, '', 280, 0, 340, 50, { size: 26, color: '#8CE7A2', hAlign: 'right', anchorX: 1 });
        bottleVals.push(v);
        y -= 86;
    }

    const ut = C.getComponent('cc.UITransform') as any;
    ut.setContentSize(RW, Math.abs(y) + 40);

    function refresh() {
        for (const l of labels) { l.lb.string = l.get(); }
        for (let i = 0; i < 7; i++) {
            const n = G.data.bottles[i];
            bottleVals[i].string = n + ' / ' + G.tierCap(i) + '   $' + fmt(G.bottleIncome(i));
        }
    }

    p.host.onRefresh = refresh;
    refresh();
    return p;
}
