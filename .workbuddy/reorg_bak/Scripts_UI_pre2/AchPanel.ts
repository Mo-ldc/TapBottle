import { Node, Label, Sprite } from 'cc';
import { ACHIEVEMENTS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { label, nd, tint } from './UIKit';
import { openPanel, rowCard } from './Panel';

/** 成就面板（24 项，与原文案一一对应） */
export function openAch(parent: Node) {
    const p = openPanel(parent, 'achievements', 840);
    const C = p.body;
    const RW = 620;
    // 首行卡片高 104，中心必须离内容顶 ≥ 52+留白，否则上半截被视口上沿切掉
    let y = -40;

    // ⚠️ 原来是 '#FFE9A8'（浅金）—— 那是深蓝底面板的配色，落在奶油底（#F6E3C5）上
    //    对比度约 1.5:1，几乎看不见。奶油底上一律用深棕。
    // 进度直接写在标题铭牌上（原来是在铭牌下面单开一行，那一行正好压住首行卡片——
    // 铭牌底 443 / 滚动区顶 420 之间只剩 23px，塞不下一个 26px 的行）
    const ptitle = p.frame.getChildByName('ptitle')?.getComponent(Label) ?? null;

    interface Row { id: number; icon: Sprite; title: Label; desc: Label; bg: Node; }
    const rows: Row[] = [];

    for (const a of ACHIEVEMENTS) {
        const card = rowCard(C, RW, 104, 0, y, '#5C4420');
        const ic = nd(card, 'ic', 76, 74, -252, 0);
        const icon = ic.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.trim = false;
        const title = label(card, '', -196, 22, 400, 36, { size: 26, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        const desc = label(card, '', -196, -20, 420, 32, { size: 20, color: '#C0B096', hAlign: 'left', anchorX: 0 });
        rows.push({ id: a.id, icon, title, desc, bg: card });
        y -= 114;
    }

    const ut = C.getComponent('cc.UITransform') as any;
    ut.setContentSize(RW, Math.abs(y) + 40);

    function refresh() {
        let done = 0;
        for (const r of rows) {
            const a = ACHIEVEMENTS.find(x => x.id === r.id)!;
            const has = G.hasAch(r.id);
            if (has) { done++; }
            const sf = Res.I ? Res.I.sf(has ? 'ui/icon/icon_ach' : 'ui/icon/icon_ach2') : null;
            if (sf) { r.icon.spriteFrame = sf; }
            tint(r.icon, has ? '#FFD75E' : '#8A7256');
            r.title.string = t(a.title, G.lang);
            tint(r.title, has ? '#FFE9A8' : '#C0B096');
            r.desc.string = t(a.desc, G.lang);
        }
        // 只写进度数字：铭牌上已是「成就 6/24」，不再重复标题
        if (ptitle && ptitle.isValid) {
            ptitle.string = t('achievements', G.lang) + '  ' + done + '/' + ACHIEVEMENTS.length;
        }
    }

    p.host.onRefresh = refresh;
    refresh();
    return p;
}
