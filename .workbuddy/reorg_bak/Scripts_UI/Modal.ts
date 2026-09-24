/** 面板开关计数：有模态面板打开时屏蔽游戏输入 */
export const Modal = {
    count: 0,
    get open(): boolean { return this.count > 0; },
    push() { this.count++; },
    pop() { this.count = Math.max(0, this.count - 1); },
    reset() { this.count = 0; },
};
