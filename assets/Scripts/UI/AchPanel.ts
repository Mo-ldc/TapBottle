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
    let y = -12;

    const progress = label(p.frame, '', 0, 424, 600, 44, { size: 26, color: '#FFE9A8' });
    void progress;

    interface Row { id: number; icon: Sprite; title: Label; desc: Label; bg: Node; }
    const rows: Row[] = [];

    for (const a of ACHIEVEMENTS) {
        const card = rowCard(C, RW, 104, 0, y, '#1D2636');
        const ic = nd(card, 'ic', 76, 74, -252, 0);
        const icon = ic.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.trim = false;
        const title = label(card, '', -196, 22, 400, 36, { size: 26, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        const desc = label(card, '', -196, -20, 420, 32, { size: 20, color: '#8FA3BC', hAlign: 'left', anchorX: 0 });
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
            const sf = Res.I ? Res.I.sf(has ? 'ui/icon_ach' : 'ui/icon_ach2') : null;
            if (sf) { r.icon.spriteFrame = sf; }
            tint(r.icon, has ? '#FFD75E' : '#5A6678');
            r.title.string = t(a.title, G.lang);
            tint(r.title, has ? '#FFE9A8' : '#8FA3BC');
            r.desc.string = t(a.desc, G.lang);
        }
        progress.string = t('achievements', G.lang) + '  ' + done + ' / ' + ACHIEVEMENTS.length;
    }

    p.host.onRefresh = refresh;
    refresh();
    return p;
}
