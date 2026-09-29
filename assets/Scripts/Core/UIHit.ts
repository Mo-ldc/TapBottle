import { Vec3 } from 'cc';

/**
 * 全局输入的「UI 吞点击」登记表。
 *
 * 背景：BottleField 的点击走 `input.on()` 全局监听（BlockInputEvents 拦不住全局输入）。
 * 第七十七轮瓶子活动区下探到履带上沿后，能力条按钮（y -148…-256.5）落进了活动区
 * **内部** —— 按钮正后方可能站着瓶子，点按钮不能连带把身后的瓶子翻飞。
 * 需要「这块 UI 矩形吃掉点击」的界面把自己的世界坐标命中判定登记进来，
 * `BottleField.pointerDown` 在 `tapWorld` 前逐个询问，命中即不翻瓶。
 *
 * ⚠️ 模块级单例跨场景存活：登记方重开场景时自己清理旧闭包
 *   （目前只有 Abilities.buildBar 登记，先 `length = 0` 再 push）。
 */
export const UIHitBlocks: Array<(w: Vec3) => boolean> = [];
