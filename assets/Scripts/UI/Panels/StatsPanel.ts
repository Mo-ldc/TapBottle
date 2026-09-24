import { Node, Label } from 'cc';
import { MILESTONES } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { fmt, fmtTime } from '../../Core/Util';
import { label, roundedPanel } from '../Base/UIKit';
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
    // ⚠️ 奶油底上不能用浅灰米色（#D8CDB8 对比度 ~1.3:1，等于隐形），统一深棕
    roundedPanel(C, 12, 30, -300, -14, '#8A5A20', 6, undefined, 0, 'secTick');
    const allTime = label(C, t('all_time', G.lang), -284, -14, 300, 40, {
        size: 28, color: '#7A4210', hAlign: 'left', anchorX: 0,
    });
    void allTime;
    // ⚠️ 标题字形最低点接近 label 中心，首行卡片顶沿必须低于标题中心 ≥30px，
    //   否则卡片（后建、渲染在上层）会盖住标题下半截（与设置面板同款 bug）
    let y = -92;
    for (const d of defs) {
        const card = rowCard(C, RW, 88, 0, y, '#5C4420');
        label(card, t(d.key, G.lang), -280, 0, 320, 50, { size: 26, color: '#F1E0C0', hAlign: 'left', anchorX: 0 });
        const v = label(card, '', 280, 0, 340, 50, { size: 28, color: '#FFD75E', hAlign: 'right', anchorX: 1 });
        labels.push({ lb: v, get: d.get });
        y -= 98;
    }

    // 瓶子分布
    y -= 14;
    roundedPanel(C, 12, 30, -300, y, '#8A5A20', 6, undefined, 0, 'secTick');
    label(C, t('shop_bottles', G.lang), -284, y, 300, 40, {
        size: 28, color: '#7A4210', hAlign: 'left', anchorX: 0,
    });
    y -= 80;
    const bottleVals: Label[] = [];
    for (let i = 0; i < 7; i++) {
        const card = rowCard(C, RW, 76, 0, y, '#5C4420');
        label(card, t(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'Celestial'][i], G.lang),
            -280, 0, 320, 50, { size: 24, color: '#F1E0C0', hAlign: 'left', anchorX: 0 });
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
