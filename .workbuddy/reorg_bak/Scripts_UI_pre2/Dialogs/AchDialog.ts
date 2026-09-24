import { _decorator, Label, UITransform } from 'cc';
import { ACHIEVEMENTS } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { UIBase } from '../UIBase';
import { AchRow } from '../Common/AchRow';

const { ccclass, property } = _decorator;

/**
 * 成就弹窗 —— 24 行静态铺在 prefab 里（每行一个 AchRow，id 在 prefab 里填），
 * 这里只负责刷新图标/颜色/文案，并把「已达成 6/24」写到标题铭牌上。
 *
 * ⚠️ 行数固定为 ACHIEVEMENTS.length：新成就要从 GameConfig 加一项 + prefab 里复制一行，
 *    两边长度不一致时这里会 warn，但不会崩（多余行不刷、缺失行不显）。
 */
@ccclass('AchDialog')
export class AchDialog extends UIBase {
    @property({ type: [AchRow], tooltip: '成就行，id 在每行上单独填' })
    rows: AchRow[] = [];

    @property({ type: Label, tooltip: '标题铭牌上的标题（会追加 已完成/总数）' })
    titleLb: Label = null!;

    @property({ type: UITransform, tooltip: '滚动内容容器，用于按行数校正高度' })
    content: UITransform = null!;

    init(_arg?: unknown): void {
        if (this.rows.length !== ACHIEVEMENTS.length) {
            console.warn('[AchDialog] prefab 行数', this.rows.length, '≠ 配置', ACHIEVEMENTS.length);
        }
        this.refresh();
    }

    refresh(): void {
        let done = 0;
        for (const r of this.rows) {
            if (!r) { continue; }
            r.refresh();
            if (G.hasAch(r.id)) { done++; }
        }
        if (this.titleLb && this.titleLb.isValid) {
            this.titleLb.string = t('achievements', G.lang) + '  ' + done + '/' + ACHIEVEMENTS.length;
        }
    }
}
