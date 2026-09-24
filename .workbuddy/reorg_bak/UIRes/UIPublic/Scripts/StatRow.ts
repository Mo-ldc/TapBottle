import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 统计面板的一行：左边标题（多语言）+ 右边数值（运行时算）。
 *
 * `key` 决定是哪个统计项；`fmt` 决定怎么渲染：
 *   'money'   → `$` + fmt(v)
 *   'pct'     → Math.round(v*100) + '%'
 *   'ms'      → 'M' + v + ' / ' + extra
 *   'plain'   → 原样字符串
 */
@ccclass('StatRow')
export class StatRow extends Component {
    @property({ tooltip: '统计项标识，由 StatsDialog 按此分发数值' })
    key = '';

    @property({ type: Label, tooltip: '数值' })
    valLb: Label = null!;

    /** 由 StatsDialog 每帧/每次刷新写入，不上 property（运行时值不该进 prefab） */
    setValue(s: string): void {
        if (this.valLb && this.valLb.isValid && this.valLb.string !== s) {
            this.valLb.string = s;
        }
    }
}
