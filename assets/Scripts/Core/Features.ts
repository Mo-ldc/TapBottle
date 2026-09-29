/**
 * 功能总开关 —— 「先不用」的模块在这里一句话停用 / 恢复。
 *
 * ★ 第八十三轮（用户口径）：暂时摘掉「特殊技能」与「升级」两块。做法是
 *   **只摘 UI 入口 + 生效链路，数据层一字不动**：
 *     · `GameConfig.SKILLS` 里的技能表 / 价格 / 图标
 *     · `ABILITY_GRAPH` / `ABILITY` / `Player.Graph` 等节点图与参数
 *     · 存档字段 `G.data.skills['a_coke']` 等（老档照样读得出来，不会被清）
 *     · 购买逻辑 `G.upgradeSkill()` / `G.fireSamurai()` 等
 *   所以把下面的开关改成 `true` 就**完整恢复**（老档里已买的等级也还在），
 *   不需要动场景 / 预制体 —— 场景里的 `abilityBar`、`tab_up` 节点都保留着，
 *   只是运行时隐藏 + 不参与布局。
 */

export const FEAT = {
    /**
     * 三大主动技能（飞天可乐 / 狂暴 / 武士处决）。
     * 关闭后果：底部能力条不显示、狂暴连击不累积、处决决意槽不积攒、
     * 「特殊技能」科技线从技能树下拉框消失（生效链路靠 `G.*Unlocked` 单点切断）。
     */
    abilities: false,

    /**
     * 底栏「升级」页签。
     * ★ 第一〇六轮恢复（用户口径：底栏三页签都要显示）。
     * 关闭后果：底栏从 5 件变 4 件自动重排；`showTab('up')` 被拒绝并回落商店页。
     * ⚠️ 该页原本是「光圈大小 / 瓶盖机收入 / 各阶助手许可」的**唯一入口**。
     */
    upgradeTab: true,
};

/** 底栏页签（`Tab`）是否启用 —— 供 BottomPanel / 引导跳转统一判断 */
export function tabEnabled(tab: 'shop' | 'up' | 'tree'): boolean {
    if (tab === 'up') { return FEAT.upgradeTab; }
    return true;
}
