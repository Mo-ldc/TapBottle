import { _decorator, Color, Label, Node, Sprite, UITransform } from 'cc';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { hex } from '../../Core/Util';
import { UIBase } from '../Base/UIBase';
import { pressable, setFrame } from '../Base/UIKit';

const { ccclass, property } = _decorator;

/** showDialog 传进来的参数 */
export interface ConfirmArg {
    text?: string;
    /** 危险操作（保留参数兼容旧调用；换皮后确认键恒为橙色大键） */
    danger?: boolean;
    onOk?: () => void;
    onCancel?: () => void;
}

/**
 * 通用二次确认弹窗（删存档风险提示等）。
 *
 * ★ 第六十六轮整体换皮（用户供给切图）：
 *   - 面板：`popup/buco01`（596×410 木框奶油底整图）
 *   - 标题：`startUI/buco02`（「温馨提示」美术字整图）
 *   - 取消键：`popup/buco04`（蓝胶囊）/ 确认键：`popup/buco05`（橙胶囊）
 *   - 关闭叉：`popup/buco02` —— 节点命名 `close`，UIBase.bindCloseBtn 自动接手
 * 预制体（ConfirmDialog.prefab）里烘的旧九宫格三层卡面只当骨架用：
 * onLoad 时撤掉 gloss/stroke 子层、换 spriteFrame、改尺寸坐标 —— 节点名保持不变，
 * 组件上序列化的 @property 引用（textLb/okBtn/…）照常生效。
 */
@ccclass('ConfirmDialog')
export class ConfirmDialog extends UIBase {
    @property({ type: Label, tooltip: '正文' })
    textLb: Label = null!;

    @property({ type: Label, tooltip: '确认键文字' })
    okLb: Label = null!;

    @property({ type: Label, tooltip: '取消键文字' })
    cancelLb: Label = null!;

    @property({ type: Sprite, tooltip: '确认键底板（换皮后不再染色）' })
    okPlate: Sprite | null = null;

    @property({ type: Node, tooltip: '确认按钮节点' })
    okBtn: Node = null!;

    @property({ type: Node, tooltip: '取消按钮节点' })
    cancelBtn: Node = null!;

    private onOk: (() => void) | null = null;
    private onCancel: (() => void) | null = null;

    init(arg?: unknown): void {
        const a = (arg || {}) as ConfirmArg;
        this.onOk = a.onOk || null;
        this.onCancel = a.onCancel || null;
        if (this.textLb && this.textLb.isValid) { this.textLb.string = a.text || ''; }
        if (this.okLb && this.okLb.isValid) { this.okLb.string = t('confirm', G.lang); }
        if (this.cancelLb && this.cancelLb.isValid) { this.cancelLb.string = t('cancel', G.lang); }
    }

    onConfirm(): void {
        const fn = this.onOk;
        this.onOk = null;
        if (fn) { fn(); }
        this.close();
    }

    onDeny(): void {
        const fn = this.onCancel;
        this.onCancel = null;
        if (fn) { fn(); }
        this.close();
    }

    onLoad(): void {
        this.skinBucos();
        if (this.okBtn) {
            this.okBtn.off(Node.EventType.TOUCH_END);
            this.okBtn.on(Node.EventType.TOUCH_END, this.onConfirm, this);
        }
        if (this.cancelBtn) {
            this.cancelBtn.off(Node.EventType.TOUCH_END);
            this.cancelBtn.on(Node.EventType.TOUCH_END, this.onDeny, this);
        }
    }

    /* ---------------- 换皮（第六十六轮） ---------------- */

    private skinned = false;

    /** 把旧九宫格卡面换成 buco 素材。幂等：UIMgr 缓存实例，二次打开不再重铺。 */
    private skinBucos(): void {
        if (this.skinned) { return; }
        this.skinned = true;
        const card = this.animRoot || this.node.getChildByName('fit');
        if (!card || !card.isValid) { return; }
        // ① 旧九宫格的光泽/描边子层撤掉
        for (const n of [...card.children]) {
            const nm = n.name.toLowerCase();
            if (nm === 'gloss' || nm === 'stroke') { n.destroy(); }
        }
        // ② 面板整图
        const cardSp = card.getComponent(Sprite);
        if (cardSp) {
            setFrame(cardSp, 'popup/buco01', 596, 410);
            cardSp.type = Sprite.Type.SIMPLE;
            cardSp.color = Color.WHITE;
        }
        // ③ 标题美术字「温馨提示」
        this.addPic(card, 'startUI/buco02', 'title', 259, 68, 0, 150);
        // ④ 右上关闭叉。⚠️ 不能指望 UIBase.bindCloseBtn：它只在首次 show() 跑一次并锁
        //    _closeBound，而本节点是 onLoad 换皮时才造出来的（晚于 show 就永远绑不上）。
        //    这里自己挂 pressable；bindCloseBtn 若后跑会先 off 再绑，不会重复。
        const closeN = this.addPic(card, 'popup/buco02', 'close', 56, 58, 248, 152);
        if (closeN) { pressable(closeN, () => this.close()); }
        // ⑤ 双按钮
        this.plateBtn(this.cancelBtn, 'popup/buco04', -165);
        this.plateBtn(this.okBtn, 'popup/buco05', 165);
        // ⑥ 正文：奶油底上深棕字，定宽换行
        if (this.textLb && this.textLb.isValid) {
            this.textLb.fontSize = 40;
            this.textLb.lineHeight = 58;
            this.textLb.color = hex('#7A4210');
            this.textLb.overflow = Label.Overflow.RESIZE_HEIGHT;
            const ut = this.textLb.node.getComponent(UITransform);
            if (ut) { ut.setContentSize(470, 0); }
            this.textLb.node.setPosition(0, 25, 0);
        }
    }

    /** 按钮换胶囊底图 + 按键文字改白 */
    private plateBtn(btn: Node, path: string, x: number): void {
        if (!btn || !btn.isValid) { return; }
        for (const n of [...btn.children]) {
            const nm = n.name.toLowerCase();
            if (nm === 'gloss' || nm === 'stroke') { n.destroy(); }
        }
        const sp = btn.getComponent(Sprite);
        if (sp) {
            setFrame(sp, path, 250, 99);
            sp.type = Sprite.Type.SIMPLE;
            sp.color = Color.WHITE;
        }
        const ut = btn.getComponent(UITransform);
        if (ut) { ut.setContentSize(250, 99); }
        btn.setPosition(x, -140, 0);
        const tl = btn.getChildByName('text');
        if (tl && tl.isValid) {
            const l = tl.getComponent(Label);
            if (l) {
                l.fontSize = 46;
                l.lineHeight = 52;
                l.color = hex('#FFF6E0');
            }
            const tut = tl.getComponent(UITransform);
            if (tut) { tut.setContentSize(200, 60); }
            tl.setPosition(0, 2, 0);
        }
    }

    /** 造一个整图 Sprite 子节点（StartPage.applyStartLabel 同款写法），返回节点便于调用方绑事件 */
    private addPic(parent: Node, path: string, name: string, w: number, h: number, x: number, y: number): Node {
        const n = new Node(name);
        n.addComponent(UITransform);
        parent.addChild(n);
        n.setPosition(x, y, 0);
        const sp = n.addComponent(Sprite);
        setFrame(sp, path, w, h);
        sp.type = Sprite.Type.SIMPLE;
        return n;
    }
}
