import { _decorator, Component, Font, SpriteFrame, AudioClip, AudioSource, resources, assetManager, Sprite } from 'cc';
import { Prefabs } from './Prefabs';

const { ccclass, property } = _decorator;

/* ------------------------------------------------------------------ *
 * 资源路径（由 assets/resources 下的实际文件生成）
 * ------------------------------------------------------------------ */
export const TEXTURE_PATHS: string[] = [
    'Textures/ability/berserk/spriteFrame',
    'Textures/ability/flyingcoke/spriteFrame',
    'Textures/ability/flyingcoke2/spriteFrame',
    'Textures/ability/katana/spriteFrame',
    'Textures/ability/samurai/spriteFrame',
    'Textures/bottle/body_0/spriteFrame',
    'Textures/bottle/body_1/spriteFrame',
    'Textures/bottle/body_2/spriteFrame',
    'Textures/bottle/body_3/spriteFrame',
    'Textures/bottle/body_4/spriteFrame',
    'Textures/bottle/body_5/spriteFrame',
    'Textures/bottle/body_6/spriteFrame',
    'Textures/bottle/capart_0/spriteFrame',
    'Textures/bottle/capart_1/spriteFrame',
    'Textures/bottle/capart_2/spriteFrame',
    'Textures/bottle/capart_3/spriteFrame',
    'Textures/bottle/capart_4/spriteFrame',
    'Textures/bottle/capart_5/spriteFrame',
    'Textures/bottle/capart_6/spriteFrame',
    'Textures/bottle/capchip_0/spriteFrame',
    'Textures/bottle/capchip_1/spriteFrame',
    'Textures/bottle/capchip_2/spriteFrame',
    'Textures/bottle/capchip_3/spriteFrame',
    'Textures/bottle/capchip_4/spriteFrame',
    'Textures/bottle/capchip_5/spriteFrame',
    'Textures/bottle/capchip_6/spriteFrame',
    'Textures/env/areacircle/spriteFrame',
    'Textures/env/belt/spriteFrame',
    'Textures/env/belt_frame/spriteFrame',
    'Textures/env/belt_leg_l/spriteFrame',
    'Textures/env/belt_leg_r/spriteFrame',
    'Textures/env/container/spriteFrame',
    'Textures/env/cursor/spriteFrame',
    'Textures/env/disc/spriteFrame',
    'Textures/env/hand/spriteFrame',
    'Textures/env/machine/spriteFrame',
    'Textures/env/recycle/spriteFrame',
    'Textures/env/shockwave/spriteFrame',
    'Textures/env/star/spriteFrame',
    'Textures/env/table/spriteFrame',
    'Textures/env/table_leg_l/spriteFrame',
    'Textures/env/table_leg_r/spriteFrame',
    'Textures/env/vignette/spriteFrame',
    'Textures/env/wood_table/spriteFrame',
    'Textures/stat/bonus/spriteFrame',
    'Textures/stat/buyable/spriteFrame',
    'Textures/stat/capgain/spriteFrame',
    'Textures/stat/chance/spriteFrame',
    'Textures/stat/duration/spriteFrame',
    'Textures/stat/flipcount/spriteFrame',
    'Textures/stat/flipspeed/spriteFrame',
    'Textures/stat/income/spriteFrame',
    'Textures/stat/locked/spriteFrame',
    'Textures/stat/locked_l/spriteFrame',
    'Textures/stat/mastery/spriteFrame',
    'Textures/stat/movespeed/spriteFrame',
    'Textures/stat/plusincome/spriteFrame',
    'Textures/stat/recovery/spriteFrame',
    'Textures/stat/resolve/spriteFrame',
    'Textures/stat/size/spriteFrame',
    'Textures/stat/time/spriteFrame',
    'Textures/stat/unlock/spriteFrame',
    'Textures/ui/icon/app_logo/spriteFrame',
    'Textures/ui/icon/arrow_l/spriteFrame',
    'Textures/ui/icon/arrow_r/spriteFrame',
    'Textures/ui/misc/asset53/spriteFrame',
    'Textures/ui/misc/asset54/spriteFrame',
    'Textures/ui/bar/bar_bg/spriteFrame',
    'Textures/ui/bar/bar_fill/spriteFrame',
    'Textures/ui/bar/bar_fill2/spriteFrame',
    'Textures/ui/panel/bg_placeholder/spriteFrame',
    'Textures/ui/button/btn2_blue_active/spriteFrame',
    'Textures/ui/button/btn2_blue_inactive/spriteFrame',
    'Textures/ui/button/btn2_grey_inactive/spriteFrame',
    'Textures/ui/button/btn2_plain_active/spriteFrame',
    'Textures/ui/button/btn2_plain_inactive/spriteFrame',
    'Textures/ui/button/btn2_purple_inactive/spriteFrame',
    'Textures/ui/button/btn2_red_active/spriteFrame',
    'Textures/ui/button/btn2_red_inactive/spriteFrame',
    'Textures/ui/button/btn_blue/spriteFrame',
    'Textures/ui/button/btn_close/spriteFrame',
    'Textures/ui/button/btn_home/spriteFrame',
    'Textures/ui/button/btn_long_active/spriteFrame',
    'Textures/ui/button/btn_long_hover/spriteFrame',
    'Textures/ui/button/btn_long_inactive/spriteFrame',
    'Textures/ui/button/btn_orange/spriteFrame',
    'Textures/ui/button/btn_small_blue/spriteFrame',
    'Textures/ui/panel/card/spriteFrame',
    'Textures/ui/panel/card_dark/spriteFrame',
    'Textures/ui/panel/card_white/spriteFrame',
    'Textures/ui/icon/circle78/spriteFrame',
    'Textures/ui/icon/circle_outline/spriteFrame',
    'Textures/ui/icon/circle_ring/spriteFrame',
    'Textures/ui/icon/coin/spriteFrame',
    'Textures/ui/bar/color_bar/spriteFrame',
    'Textures/ui/icon/gam_icon/spriteFrame',
    'Textures/ui/icon/icon_40/spriteFrame',
    'Textures/ui/icon/icon_ach/spriteFrame',
    'Textures/ui/icon/icon_ach2/spriteFrame',
    'Textures/ui/icon/icon_back/spriteFrame',
    'Textures/ui/icon/icon_cross/spriteFrame',
    'Textures/ui/icon/icon_discord/spriteFrame',
    'Textures/ui/icon/icon_gear/spriteFrame',
    'Textures/ui/icon/icon_hand/spriteFrame',
    'Textures/ui/icon/icon_mail/spriteFrame',
    'Textures/ui/icon/icon_medal/spriteFrame',
    'Textures/ui/icon/ksp/spriteFrame',
    'Textures/ui/icon/icon_save/spriteFrame',
    'Textures/ui/icon/icon_shop/spriteFrame',
    'Textures/ui/icon/icon_shop2/spriteFrame',
    'Textures/ui/icon/icon_skill/spriteFrame',
    'Textures/ui/icon/icon_skill2/spriteFrame',
    'Textures/ui/icon/icon_star2/spriteFrame',
    'Textures/ui/icon/icon_stat/spriteFrame',
    'Textures/ui/icon/icon_steam/spriteFrame',
    'Textures/ui/icon/icon_steam2/spriteFrame',
    'Textures/ui/icon/icon_up/spriteFrame',
    'Textures/ui/icon/icon_upgrade/spriteFrame',
    'Textures/ui/button/list_select/spriteFrame',
    'Textures/ui/panel/panel_deco/spriteFrame',
    'Textures/ui/panel/panel_wood/spriteFrame',
    'Textures/ui/nine/nine_base/spriteFrame',
    'Textures/ui/nine/nine_gloss/spriteFrame',
    'Textures/ui/nine/nine_stroke/spriteFrame',
    'Textures/ui/nine/nine_chip/spriteFrame',
    'Textures/ui/nine/nine_chip_gloss/spriteFrame',
    'Textures/ui/nine/nine_chip_stroke/spriteFrame',
    'Textures/ui/pixel/px_circle/spriteFrame',
    'Textures/ui/pixel/px_dot/spriteFrame',
    'Textures/ui/pixel/px_white/spriteFrame',
    'Textures/ui/pixel/px_white2/spriteFrame',
    'Textures/ui/panel/round_rect/spriteFrame',
    'Textures/ui/panel/round_soft/spriteFrame',
    'Textures/ui/panel/slot/spriteFrame',
    'Textures/ui/panel/slot_hover/spriteFrame',
    'Textures/ui/panel/sq_brown/spriteFrame',
    'Textures/ui/panel/sq_brown2/spriteFrame',
    'Textures/ui/panel/sq_grey/spriteFrame',
    'Textures/ui/button/wood_tab/spriteFrame',
    'Textures/ui/button/wood_tab_dark/spriteFrame',
    'Textures/ui/deco/wood_banner_l/spriteFrame',
    'Textures/ui/deco/wood_banner_m/spriteFrame',
    'Textures/ui/deco/wood_banner_r/spriteFrame',
    'Textures/ui/deco/wood_rail/spriteFrame',
    'Textures/ui/icon/x_bg/spriteFrame',
    'Textures/ui/icon/x_logo/spriteFrame',
    'Textures/ui/icon/x_mail/spriteFrame',
];

export const AUDIO_PATHS: string[] = [
    'Audio/bgm', 'Audio/button', 'Audio/buy', 'Audio/click', 'Audio/click2', 'Audio/hit',
    'Audio/pop1', 'Audio/pop2', 'Audio/pop3', 'Audio/pop4', 'Audio/pop5', 'Audio/slash', 'Audio/win',
];

/**
 * Res —— 资源与音频管理（Cocos resources bundle + AudioSource）
 */
@ccclass('Res')
export class Res extends Component {
    private frames: Record<string, SpriteFrame> = {};
    private clips: Record<string, AudioClip> = {};
    private sfxSource: AudioSource = null!;
    private bgmSource: AudioSource = null!;
    font: Font | null = null;

    static I: Res = null!;

    private ready = false;
    private pending: Array<(ok: boolean) => void> = [];

    onLoad() {
        Res.I = this;
        this.sfxSource = this.node.addComponent(AudioSource);
        this.sfxSource.playOnAwake = false;
        const bgmNode = this.node.getChildByName('BgmSource');
        this.bgmSource = (bgmNode || this.node).addComponent(AudioSource);
        this.bgmSource.playOnAwake = false;
        this.bgmSource.loop = true;
    }

    /** 预加载全部贴图 / 音频 / 字体 / 预制体；onProgress 为 0..1 加权进度（Boot 场景进度条用） */
    loadAll(done: (ok: boolean) => void, onProgress?: (f: number) => void) {
        if (this.ready) { done(true); return; }
        this.pending.push(done);
        if (this.pending.length > 1) { return; }

        const finish = (ok: boolean) => {
            this.ready = true;
            const ps = this.pending; this.pending = [];
            for (const p of ps) { p(ok); }
        };

        let left = 4;
        const oneDone = () => { left--; if (left <= 0) { finish(true); } };
        const guard = (fn: () => void) => {
            try { fn(); } catch (e) { console.warn('[Res]', e); oneDone(); }
        };

        // 加载进度（加载页进度条）：贴图占大头（0.75），预制体 0.10，音频 / 字体做零头（0.10 / 0.05）。
        const fr = { tex: 0, aud: 0, fnt: 0, pf: 0 };
        const reportBoot = () => { if (onProgress) { onProgress(Math.min(1, fr.tex * 0.75 + fr.pf * 0.10 + fr.aud * 0.10 + fr.fnt * 0.05)); } };

        // 预制体（第 4 路）：UI / 游戏对象全部来自预制体，必须在进场景前就绪
        Prefabs.boot();
        guard(() => Prefabs.I.loadAll(() => { oneDone(); }, (f) => { fr.pf = f; reportBoot(); }));

        guard(() => resources.load(TEXTURE_PATHS, SpriteFrame, (fin: number, tot: number) => { fr.tex = tot > 0 ? fin / tot : 0; reportBoot(); }, (err, assets: SpriteFrame[]) => {
            if (err) { console.warn('[Res] texture load error', err); }
            else { for (let i = 0; i < assets.length; i++) { this.frames[TEXTURE_PATHS[i]] = assets[i]; } }
            oneDone();
        }));

        guard(() => resources.load(AUDIO_PATHS, AudioClip, (fin: number, tot: number) => { fr.aud = tot > 0 ? fin / tot : 0; reportBoot(); }, (err, assets: AudioClip[]) => {
            if (err) { console.warn('[Res] audio load error', err); }
            else { for (let i = 0; i < assets.length; i++) { this.clips[AUDIO_PATHS[i]] = assets[i]; } }
            oneDone();
        }));

        guard(() => resources.load('Fonts/NotoSansSC-Bold', Font, (fin: number, tot: number) => { fr.fnt = tot > 0 ? fin / tot : 0; reportBoot(); }, (err, f: Font) => {
            if (!err) { this.font = f; } else { console.warn('[Res] font load error', err); }
            oneDone();
        }));
    }

    /** 取 SpriteFrame（不存在的返回 null） */
    sf(path: string): SpriteFrame | null {
        return this.frames['Textures/' + path + '/spriteFrame'] || null;
    }
    sfRaw(full: string): SpriteFrame | null { return this.frames[full] || null; }

    /** 给九宫格贴图设置切边（Cocos 原生 Sprite.Type.SLICED 需要） */
    private insetDone: Record<string, boolean> = {};
    slice(path: string, l: number, r: number, t: number, b: number): SpriteFrame | null {
        const sf = this.sf(path);
        if (!sf) { return null; }
        if (!this.insetDone[path]) {
            sf.insetLeft = l; sf.insetRight = r; sf.insetTop = t; sf.insetBottom = b;
            this.insetDone[path] = true;
        }
        return sf;
    }

    /* ---------------- 音频 ---------------- */
    play(name: string, volume = 1, rate = 1) {
        const clip = this.clips['Audio/' + name];
        if (!clip || !this.sfxSource) { return; }
        const v = volume * this.masterVol();
        if (v <= 0) { return; }
        if (rate !== 1) { /* 通过多轨近似：直接播放 */ }
        this.sfxSource.playOneShot(clip, v);
    }

    playRand(names: string[], volume = 1) {
        this.play(names[Math.floor(Math.random() * names.length)], volume);
    }

    /**
     * 带节流的音效：同一 key 在 gapMs 内只响一次。
     * 大量瓶子同时落地时（助手/可乐冲击波）用它，避免几十个 oneShot 叠成噪音。
     */
    private lastAt: Record<string, number> = {};
    playThrottled(name: string, key: string, gapMs = 55, volume = 1) {
        const now = Date.now();
        const last = this.lastAt[key];
        if (last !== undefined && now - last < gapMs) { return; }
        this.lastAt[key] = now;
        this.play(name, volume);
    }

    /** 随机音高感：在候选音效里随机挑一个，避免重复听感 */
    playThrottledRand(names: string[], key: string, gapMs = 55, volume = 1) {
        const now = Date.now();
        const last = this.lastAt[key];
        if (last !== undefined && now - last < gapMs) { return; }
        this.lastAt[key] = now;
        this.play(names[Math.floor(Math.random() * names.length)], volume);
    }

    /** 主音量（由 GameRoot 从设置同步） */
    masterScale = 1;

    private masterVol(): number { return this.masterScale; }

    music(on: boolean, volume = 0.5) {
        const clip = this.clips['Audio/bgm'];
        if (!clip || !this.bgmSource) { return; }
        if (on) {
            if (this.bgmSource.playing) { return; }
            this.bgmSource.clip = clip;
            this.bgmSource.volume = volume * this.masterVol();
            this.bgmSource.play();
        } else {
            this.bgmSource.stop();
        }
    }

    musicVolume(v: number) {
        if (this.bgmSource && this.bgmSource.playing) { this.bgmSource.volume = v * this.masterVol(); }
    }

    /** 便捷建 Sprite 节点 */
    static applySprite(sprite: Sprite, path: string, w: number, h: number, tint?: { r: number, g: number, b: number, a: number }) {
        const sf = Res.I ? Res.I.sf(path) : null;
        if (sf) { sprite.spriteFrame = sf; }
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        if (tint) { sprite.color.set(tint.r, tint.g, tint.b, tint.a); }
        const ut = sprite.node.getComponent('cc.UITransform') as any;
        if (ut) { ut.setContentSize(w, h); }
    }

    /** 供外部强制释放（切换语言/重开时用不到，保留接口） */
    release() {
        this.frames = {};
        this.clips = {};
        void assetManager;
    }
}
