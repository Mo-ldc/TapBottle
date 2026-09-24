import { _decorator, Color, Node, Sprite } from 'cc';
import { G } from '../../../../Scripts/Core/State';
import { t } from '../../../../Scripts/Core/Locale';
import { Res } from '../../../../Scripts/Core/Res';
import { clearSave } from '../../../../Scripts/Core/Save';
import { UIBase } from '../../../../Scripts/UI/UIBase';
import { UIMgr, UIName } from '../../../../Scripts/Core/UIMgr';
import { ToggleRow } from '../../UIPublic/Scripts/ToggleRow';
import { StepperRow } from '../../UIPublic/Scripts/StepperRow';

const { ccclass, property } = _decorator;

/**
 * 设置弹窗 —— 全部结构在 `Prefabs/SettingDialog.prefab` 里，这里只负责：
 *   ① 把 G.data.settings 的字段绑定到 ToggleRow / StepperRow 上；
 *   ② 语言按钮的高亮切换；
 *   ③ 「删除存档」二次确认（转给 ConfirmDialog）。
 *
 * 旧实现（`assets/Scripts/UI/SettingsPanel.ts` 的 openSettings）是运行时
 * `roundedPanel / label / woodButton` 一整套画出来的 —— 编辑器里场景是空的，
 * 改一个间距要改代码重新跑。预制体化之后这些都在 prefab 里所见即所得。
 */
@ccclass('SettingDialog')
export class SettingDialog extends UIBase {
    @property({ type: [ToggleRow], tooltip: '显示开关：隐藏收入 / 隐藏瓶盖粒子 / 隐藏辅助手' })
    toggles: ToggleRow[] = [];

    @property({ type: [StepperRow], tooltip: '音量：主 / 音乐 / 音效' })
    steppers: StepperRow[] = [];

    @property({ type: [Sprite], tooltip: '语言按钮底板：0=中文 1=English' })
    langBtns: Sprite[] = [];

    @property({ type: Node, tooltip: '删除存档按钮' })
    delBtn: Node = null!;

    @property({ type: Node, tooltip: '语言按钮节点（点-N），索引与 langBtns 一致' })
    langNodes: Node[] = [];

    private bound = false;

    init(_arg?: unknown): void {
        this.bindRows();
        this.refresh();
    }

    /** 三个开关 + 三个音量步进器 —— 顺序由 prefab 里的数组顺序决定 */
    private bindRows(): void {
        if (this.bound) { return; }
        this.bound = true;
        const S = G.data.settings;
        const refreshAll = () => this.refresh();
        const set = (i: number, key: 'hideIncome' | 'hideCaps' | 'hideHand') => {
            const row = this.toggles[i];
            if (row) { row.bind(t(key, G.lang), () => S[key], (v) => { S[key] = v; }, refreshAll); }
        };
        set(0, 'hideIncome');
        set(1, 'hideCaps');
        set(2, 'hideHand');

        const vol = (i: number, key: 'master' | 'music' | 'sfx', after?: (v: number) => void) => {
            const row = this.steppers[i];
            if (!row) { return; }
            row.bind(t(key === 'master' ? 'master_volume' : key === 'music' ? 'music_volume' : 'sfx_volume', G.lang),
                () => S[key], (v) => { S[key] = v; if (after) { after(v); } }, refreshAll);
        };
        vol(1, 'music', (v) => { Res.I?.musicVolume(v); });
        vol(2, 'sfx', () => { Res.I?.play('click'); });
        vol(0, 'master');

        for (let i = 0; i < this.langNodes.length; i++) {
            const id: 'zh' | 'en' = i === 0 ? 'zh' : 'en';
            this.langNodes[i].off(Node.EventType.TOUCH_END);
            this.langNodes[i].on(Node.EventType.TOUCH_END, () => {
                G.data.settings.lang = id;
                G.notify();
                this.refresh();
            }, this);
        }
        if (this.delBtn) {
            this.delBtn.off(Node.EventType.TOUCH_END);
            this.delBtn.on(Node.EventType.TOUCH_END, () => this.confirmDelete(), this);
        }
    }

    /** 刷新所有控件到当前存档值 */
    refresh(): void {
        for (const r of this.toggles) { if (r) { r.refresh(); } }
        for (const r of this.steppers) { if (r) { r.refresh(); } }
        // 选中语言 = 亮金，未选 = 奶油（和 Vol.19 木纹皮肤一致）
        for (let i = 0; i < this.langBtns.length; i++) {
            const sp = this.langBtns[i];
            if (!sp || !sp.isValid) { continue; }
            const sel = G.data.settings.lang === (i === 0 ? 'zh' : 'en');
            // ⚠️ 必须整体 new 一个 Color：就地改值 Cocos 的 color setter 会提前 return
            sp.color = sel ? new Color(242, 195, 78, 255) : new Color(246, 227, 197, 255);
        }
        Res.I && (Res.I.masterScale = G.data.settings.master);
    }

    /** 删除存档 —— 二次确认走 ConfirmDialog（也是预制体） */
    private confirmDelete(): void {
        UIMgr.I.showDialog(UIName.ConfirmDialog, undefined, {
            text: t('delete_confirm', G.lang),
            danger: true,
            onOk: () => {
                clearSave();
                G.reset();
                G.save();
                this.close();
                const reload = (globalThis as any).__tb_reload;
                if (reload) { reload(); }
            },
        });
    }
}
