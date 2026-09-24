import { _decorator, Component, Label, Sprite } from 'cc';
import { ACHIEVEMENTS } from '../../../../Scripts/Core/GameConfig';
import { G } from '../../../../Scripts/Core/State';
import { Res } from '../../../../Scripts/Core/Res';
import { t } from '../../../../Scripts/Core/Locale';
import { tint } from '../../../../Scripts/UI/UIKit';

const { ccclass, property } = _decorator;

/**
 * 成就列表的一行 —— prefab 里的静态节点，24 行各挂一个。
 *
 * `id` 在 prefab 里填（对应 GameConfig.ACHIEVEMENTS 的 id），
 * 运行时 `refresh()` 按当前存档把图标换成「已达成 / 未达成」两版、并写标题与描述。
 */
@ccclass('AchRow')
export class AchRow extends Component {
    @property({ tooltip: 'GameConfig.ACHIEVEMENTS 里的 id' })
    id = 1;

    @property({ type: Sprite, tooltip: '图标' })
    icon: Sprite = null!;

    @property({ type: Label, tooltip: '成就名' })
    titleLb: Label = null!;

    @property({ type: Label, tooltip: '描述' })
    descLb: Label = null!;

    refresh(): void {
        const a = ACHIEVEMENTS.find((x) => x.id === this.id);
        if (!a) { return; }
        const has = G.hasAch(this.id);
        const sf = Res.I ? Res.I.sf(has ? 'ui/icon_ach' : 'ui/icon_ach2') : null;
        if (this.icon && this.icon.isValid && sf) { this.icon.spriteFrame = sf; }
        tint(this.icon, has ? '#FFD75E' : '#8A7256');
        if (this.titleLb && this.titleLb.isValid) {
            this.titleLb.string = t(a.title, G.lang);
            tint(this.titleLb, has ? '#FFE9A8' : '#C0B096');
        }
        if (this.descLb && this.descLb.isValid) { this.descLb.string = t(a.desc, G.lang); }
    }
}
