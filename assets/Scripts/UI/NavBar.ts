import { _decorator, Component, Node, Label, Sprite } from 'cc';
import { LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { button, img, label, tint } from './UIKit';

const { ccclass } = _decorator;

interface NavDef { id: string; icon: string; labelKey: string; }

/** 底部主导航：升级(金库) / 助手 / 技能树 */
@ccclass('NavBar')
export class NavBar extends Component {
    private labels: Array<{ node: Node, key: string }> = [];
    private tabs: Array<{ id: string, bg: Sprite }> = [];

    build(onTab: (id: string) => void) {
        const defs: NavDef[] = [
            { id: 'bottle', icon: 'bottle/icon_classic', labelKey: 'tab_bottle' },
            { id: 'helper', icon: 'env/hand', labelKey: 'tab_helper' },
            { id: 'tree', icon: 'ui/icon_skill', labelKey: 'tab_tree' },
        ];
        const sp = 212;
        for (let i = 0; i < defs.length; i++) {
            const d = defs[i];
            const x = (i - (defs.length - 1) / 2) * sp;
            const n = button(this.node, {
                w: 192, h: 92, x, y: LAYOUT.navY,
                tex: 'ui/card_white', inset: [28, 28, 28, 28],
                texColor: '#1B2334', sound: 'click', name: 'nav_' + d.id,
                onClick: () => onTab(d.id),
            });
            img(n, d.icon, 60, 54, 0, 14);
            const lb = label(n, t(d.labelKey, G.lang), 0, -26, 178, 30, {
                size: 21, color: '#C9D6E6', outline: '#0B0F16', outlineWidth: 2,
            });
            this.labels.push({ node: lb.node, key: d.labelKey });
            this.tabs.push({ id: d.id, bg: n.getChildByName('bg')!.getComponent(Sprite)! });
        }

        G.addListener(() => this.retranslate());
    }

    /** 高亮当前抽屉页 */
    highlight(id: string | null) {
        for (const tb of this.tabs) {
            tint(tb.bg, tb.id === id ? '#FFFFFF' : '#1B2334');
        }
    }

    private retranslate() {
        for (const l of this.labels) {
            if (!l.node.isValid) { continue; }
            const lb = l.node.getComponent(Label);
            if (lb) { lb.string = t(l.key, G.lang); }
        }
    }
}
