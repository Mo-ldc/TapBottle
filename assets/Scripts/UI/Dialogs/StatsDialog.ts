import { _decorator, Label } from 'cc';
import { MILESTONES } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { fmt, fmtTime } from '../../Core/Util';
import { UIBase } from '../Base/UIBase';
import { StatRow } from '../Widgets/StatRow';

const { ccclass, property } = _decorator;

/**
 * 统计弹窗 —— 行结构在 prefab 里，这里只按 key 往 StatRow 里写数值。
 *
 * 内容分两块（与旧实现一致）：
 *   ① 总览 8 项：游戏时长 / 总收入 / 总翻转 / 总瓶盖 / 单次最高 / 每秒收益 / 里程碑 / 下一阶
 *   ② 各档瓶子持有量与收益：7 行
 */
@ccclass('StatsDialog')
export class StatsDialog extends UIBase {
    @property({ type: [StatRow], tooltip: '总览行，key = playtime/total_money/...' })
    overview: StatRow[] = [];

    @property({ type: [StatRow], tooltip: '瓶子分布行，按索引对应 0..6 档' })
    bottles: StatRow[] = [];

    @property({ type: Label, tooltip: '面板标题（可以带进度数）' })
    titleLb: Label = null!;

    init(_arg?: unknown): void { this.refresh(); }

    refresh(): void {
        for (const r of this.overview) { if (r) { this.fill(r); } }
        for (let i = 0; i < this.bottles.length; i++) {
            const r = this.bottles[i];
            if (!r) { continue; }
            r.setValue(G.data.bottles[i] + ' / ' + G.tierCap(i) + '   $' + fmt(G.bottleIncome(i)));
        }
    }

    private fill(r: StatRow): void {
        switch (r.key) {
            case 'playtime': r.setValue(fmtTime(G.data.stats.time)); break;
            case 'total_money': r.setValue(fmt(G.data.stats.earned)); break;
            case 'total_flips': r.setValue(fmt(G.data.stats.flips)); break;
            case 'total_caps': r.setValue(fmt(G.data.stats.capsEarned)); break;
            case 'highest_flip': r.setValue('$' + fmt(G.data.stats.best)); break;
            case 'per_sec': r.setValue('$' + fmt(G.data.eps)); break;
            case 'milestone': r.setValue('M' + G.milestone + ' / ' + MILESTONES.length); break;
            case 'ms_next': {
                const nx = G.msNext;
                r.setValue(nx ? 'M' + nx.n + '  ' + fmt(G.msProgress) + '/' + fmt(nx.need) : t('ms_max', G.lang));
                break;
            }
            default: break;
        }
    }
}
