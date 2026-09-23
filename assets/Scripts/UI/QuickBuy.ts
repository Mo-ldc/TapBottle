import { _decorator, Component, Node, Label, Sprite, UITransform } from 'cc';
import { LAYOUT, TIERS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { fmt, hex } from '../Core/Util';
import { label, nd, setFrame, tint } from './UIKit';
import { Toast } from './Toast';

const { ccclass } = _decorator;

interface CardUI {
    root: Node;
    icon: Sprite;
    name: Label;
    count: Label;
    price: Label;
    buy: () => boolean;
}

/**
 * 主界面快捷购买卡（对照原版右侧的「普通瓶 / 助手之手」两行）。
 * 整行都是点击热区，点一下即购买。
 */
@ccclass('QuickBuy')
export class QuickBuy extends Component {
    private cards: CardUI[] = [];
    private lastTop = -1;

    build() {
        const w = 300, h = 84, y = LAYOUT.quickBuyY;
        this.cards.push(this.makeCard(-160, y, w, h, () => {
            const tier = topOwnedTier();
            if (G.buyBottle(tier)) { return true; }
            return false;
        }));
        this.cards.push(this.makeCard(160, y, w, h, () => G.buyHand()));
        G.addListener(() => this.refresh());
        this.refresh();
    }

    private makeCard(x: number, y: number, w: number, h: number, buy: () => boolean): CardUI {
        const root = nd(this.node, 'qb', w, h, x, y);
        const bg = root.addComponent(Sprite);
        bg.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.trim = false;
        const sf = Res.I ? Res.I.slice('ui/card_white', 30, 30, 30, 30) : null;
        if (sf) { bg.spriteFrame = sf; bg.type = Sprite.Type.SLICED; }
        (root.getComponent(UITransform) as any).setContentSize(w, h);
        bg.color = hex('#1B2334EE');

        const ic = nd(root, 'ic', 62, 56, -114, 0);
        const icon = ic.addComponent(Sprite);

        const name = label(root, '', -76, 20, 190, 32, { size: 21, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        const count = label(root, '', -76, -14, 190, 28, { size: 18, color: '#8FA3BC', hAlign: 'left', anchorX: 0 });
        const price = label(root, '', 142, 0, 130, 32, { size: 21, color: '#FFD75E', hAlign: 'right', anchorX: 1 });

        const card: CardUI = { root, icon, name, count, price, buy };
        root.on(Node.EventType.TOUCH_START, () => root.setScale(0.97, 0.97, 1));
        root.on(Node.EventType.TOUCH_CANCEL, () => root.setScale(1, 1, 1));
        root.on(Node.EventType.TOUCH_END, () => {
            root.setScale(1, 1, 1);
            if (Res.I) { Res.I.play('buy', 0.7); }
            if (!card.buy()) {
                Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（金币）' : ' (coins)'), '#FFB0A0');
            }
            this.refresh();
        });
        return card;
    }

    private refresh() {
        const tier = topOwnedTier();
        const d = TIERS[tier];

        // 卡片 1：瓶子
        const c0 = this.cards[0];
        setFrame(c0.icon, 'bottle/icon_' + d.key, 62, 56);
        c0.name.string = G.lang === 'zh' ? d.zh : d.en;
        const n = G.data.bottles[tier];
        const cap = G.tierCap(tier);
        c0.count.string = n + '/' + cap;
        const maxed = n >= cap;
        const cost = G.bottleCost(tier);
        c0.price.string = maxed ? t('max', G.lang) : '$' + fmt(cost);
        tint(c0.price, maxed ? '#8CE7A2' : (G.data.money >= cost ? '#FFD75E' : '#E8765A'));

        // 卡片 2：助手之手
        const c1 = this.cards[1];
        setFrame(c1.icon, 'env/hand', 52, 66);
        c1.name.string = t('helper_hand', G.lang);
        c1.count.string = G.data.hands + '/' + G.maxHands;
        const hMax = G.data.hands >= G.maxHands;
        const hCost = G.handCost();
        if (!G.hasHelper) {
            c1.price.string = t('locked', G.lang);
            tint(c1.price, '#8FA3BC');
        } else {
            c1.price.string = hMax ? t('max', G.lang) : '$' + fmt(hCost);
            tint(c1.price, hMax ? '#8CE7A2' : (G.data.money >= hCost ? '#FFD75E' : '#E8765A'));
        }
        this.lastTop = tier;
    }

    update() {
        // 最高阶瓶子变化时重取图标（避免每帧刷文本）
        if (topOwnedTier() !== this.lastTop) { this.refresh(); }
    }
}

/** 当前已拥有的最高阶瓶子 */
function topOwnedTier(): number {
    for (let t = 6; t >= 0; t--) { if (G.data.bottles[t] > 0) { return t; } }
    return 0;
}
