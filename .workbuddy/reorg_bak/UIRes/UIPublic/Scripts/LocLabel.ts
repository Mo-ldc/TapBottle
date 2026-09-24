import { _decorator, Component, Label } from 'cc';
import { G } from '../../../../Scripts/Core/State';
import { t } from '../../../../Scripts/Core/Locale';

const { ccclass, property } = _decorator;

/**
 * 多语言文本 —— 挂在任何需要翻译的 Label 上，prefab 里填 `key` 即可。
 *
 * 存在的理由：以前所有文案都是运行时 `t(key, G.lang)` 塞进 label 的，
 * 预制体化之后 label 属于 prefab 的静态结构，必须有一个「跟语言走」的组件，
 * 否则切语言只能重建界面。
 *
 * prefab 里可以给 label 写一份中文占位文案方便美术看图，运行时会被这里覆盖。
 */
@ccclass('LocLabel')
export class LocLabel extends Component {
    @property({ tooltip: 'Locale.ts 里的 key，留空则沿用 prefab 里写死的字符串' })
    key = '';

    @property({ tooltip: '前缀（如 "6/24 "）' })
    prefix = '';

    @property({ tooltip: '后缀' })
    suffix = '';

    private lb: Label = null!;

    onLoad(): void {
        this.lb = this.getComponent(Label) || this.node.addComponent(Label);
        this.refresh();
        // 切语言时 G.notify() 会广播，这里跟着刷
        G.addListener(() => this.refresh());
    }

    /** 外部改了 key（比如成就标题带进度）后手动刷 */
    refresh(): void {
        if (!this.lb || !this.lb.isValid) { return; }
        if (!this.key) { return; }
        let s = this.prefix + t(this.key, G.lang) + this.suffix;
        if (this.extra !== '') { s += this.extra; }
        this.lb.string = s;
    }

    /**
     * 动态追加内容（成就标题的 "6/24" 之类）。
     * ⚠️ 不能用 @property：它是运行时值，做成 property 会被 prefab 序列化覆盖回来。
     */
    extra = '';

    /** 设置动态后缀并立刻刷新 */
    setExtra(s: string): void {
        this.extra = s;
        this.refresh();
    }
}
