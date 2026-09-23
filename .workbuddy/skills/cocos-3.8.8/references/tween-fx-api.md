# 缓动与表现 · Cocos Creator 3.8.8

## tween / Tween

```ts
import { tween, Tween, Vec3, Color, UIOpacity } from 'cc';

tween(node)                                   // 泛型目标，可以是 Node / Component / 任意对象
    .to(0.3, { position: new Vec3(0, 100, 0) }, { easing: 'quadOut' })
    .delay(0.2)
    .call(() => console.log('done'))
    .start();
```

### 方法全表（3.8 签名）

| 方法 | 说明 |
|---|---|
| `to(dur, props, opts?)` | 从当前值 → 目标值 |
| `by(dur, props, opts?)` | 相对偏移（`by(1, { position: v3 })` 位移 v3） |
| `set(props)` | 瞬时赋值，无时长 |
| `delay(dur)` | 等待 |
| `call(cb)` | 回调，可接在链中 |
| `then(otherTween)` | 串接另一条 tween（另一目标） |
| `union(fromId?)` | **把多条 tween 合并到同一目标上**，避免互相覆盖 |
| `sequence(...tweens)` / `parallel(...tweens)` | 串/并组合 |
| `repeat(times, embedTween?)` / `repeatForever(embedTween?)` | 重复 |
| `show()` / `hide()` | 切 `active` |
| `removeSelf()` | 结束时销毁节点 |
| `start(time?)` | 开始（不调 `start` 什么都不会发生） |
| `stop()` / `pause()` / `resume()` / `clone()` / `target()` | 控制 |
| `Tween.stopAll()` / `Tween.stopAllByTarget(node)` | 静态：清空（**切场景/销毁前建议调**） |

### 可缓动字段（针对 Node 常用）

`position`(Vec3)、`scale`(Vec3)、`angle`(number，2D 旋转角度)、`eulerAngles`(Vec3)、`rotation`(Quat)、`color`(Color，针对 Sprite/Label)、`opacity`(number，**目标必须是 `UIOpacity` 组件**)、以及目标对象上的**任意 number 属性**（如自定义 `this.hp`）。

```ts
// 节点平移/旋转/缩放
tween(node).to(0.3, { position: new Vec3(x, y, 0), angle: 360, scale: new Vec3(1.1, 1.1, 1) },
                 { easing: 'backOut' }).start();

// 透明度（注意目标是 UIOpacity 组件，不是 Node）
const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
op.opacity = 0;
tween(op).to(0.2, { opacity: 255 }).start();

// 颜色
tween(sprite).to(0.15, { color: new Color(255, 80, 80, 255) }).start();

// 无限呼吸
tween(node).to(0.7, { scale: new Vec3(1.06, 1.06, 1) })
           .to(0.7, { scale: new Vec3(1, 1, 1) })
           .union().repeatForever().start();
```
> **`.union()` 的位置很关键**：`.to().to()` 连续写是「串行」；想「并行作用于同一目标」或用 `repeatForever` 包住整段，必须先 `.union()` 再 `.repeatForever()`（本项目 `GameRoot.showSplash()` 就是这个写法）。

### 缓动函数名（`TweenEasing`，全部可用）

```
linear | smooth | fade | constant
quadIn quadOut quadInOut quadOutIn
cubicIn cubicOut cubicInOut cubicOutIn
quartIn quartOut quartInOut quartOutIn
quintIn quintOut quintInOut quintOutIn
sineIn sineOut sineInOut sineOutIn
expoIn expoOut expoInOut expoOutIn
circIn circOut circInOut circOutIn
elasticIn elasticOut elasticInOut elasticOutIn
backIn backOut backInOut backOutIn
bounceIn bounceOut bounceInOut bounceOutIn
```
也可以传自定义函数：`{ easing: (k: number) => k * k }`。常用搭配：弹入 `backOut`、下落 `quadIn`、起跳 `quadOut`、冲击 `cubicOut`、匀速旋转 `sineInOut`。

### `ITweenOption`

```ts
{
  easing: 'quadOut' | ((k: number) => number),
  progress: (start, end, current, ratio) => number,   // 自定义插值
  onStart:    (target?) => void,
  onUpdate:   (target?, ratio?) => void,
  onComplete: (target?) => void,
}
```

### 本项目里的高频模式（照抄即可）

```ts
// 抛物线跳跃（两段近似）—— Bottle.flip
tween(n).to(dur, { position: new Vec3(x, y + jump, 0) }, { easing: 'quadOut' })
        .to(dur, { position: new Vec3(x + dx, y, 0) }, { easing: 'quadIn' })
        .call(() => this.land(...)).start();

// 落地压扁回弹
tween(n).to(0.06, { scale: new Vec3(s * 1.18, s * 0.80, 1) })
        .to(0.10, { scale: new Vec3(s * 0.94, s * 1.06, 1) })
        .to(0.09, { scale: new Vec3(s, s, 1) })
        .call(() => { this.busy = false; }).start();

// 飘字后销毁
tween(n).by(dur, { position: new Vec3(0, dy, 0) }, { easing: 'quadOut' }).start();
tween(op).delay(dur * 0.45).to(dur * 0.55, { opacity: 0 }).call(() => n.destroy()).start();
```
> 用 tween 做「动画期间不可再点」时，一律配 `busy` 标志位（见 `Bottle.busy`），因为 tween 本身不阻塞逻辑。

## Animation（关键帧动画）

```ts
const an = node.addComponent(Animation);
an.clips = [clipA, clipB];          // AnimationClip，需要 .anim 资源
an.defaultClip = clipA;
an.play();  an.play('run');  an.crossFade('idle', 0.2);
an.pause(); an.resume(); an.stop();
const st = an.getState('run');      // AnimationState
st.speed = 1.5; st.wrapMode = Animation.WrapMode.LOOP; st.repeatCount = 3;
st.on(Animation.EventType.FINISHED, cb);
an.createState(clip, 'name');
```
本项目**没用 Animation**（无 .anim 资源），全用 tween。要加关键帧动画：编辑器里做 `assets/Animations/xxx.anim` → `resources.load(path, AnimationClip)` → 赋给 `clips`。

## 粒子与骨骼

| 类 | 说明 |
|---|---|
| `ParticleSystem2D` | 2D 粒子，靠 `plist` 配置（`ParticleAsset`），需要美术产出 |
| `ParticleSystem` | 3D 粒子 |
| `SkeletalAnimation` / `sp.Skeleton` | 骨骼动画（DragonBones / Spine），需对应插件与资源 |

**本项目没有粒子资源**，所有特效都是 Sprite + tween 手搓（`Game/Fx.ts`）。加新特效时优先沿用这套：
- 爆散粒子 → `FxLayer.burst(x, y, n, tier)`（复用 `bottle/capchip_N`）
- 圆形冲击波 → `FxLayer.shockwave(x, y, maxR, dur, color)`（复用 `env/shockwave`）
- 星光 → `FxLayer.sparkle`（复用 `env/star`）
- 全屏色闪 → `FxLayer.flash`（复用 `ui/px_white2` 拉伸 + `UIOpacity`）
- 震屏 → `FxLayer.shake`（`update` 里手写随机偏移，作用在 `shakeHolder` 上）

> 震屏只能扰动 `shakeHolder`（它包着 worldLayer/fxLayer/uiLayer），**不能扰动 panelLayer/toastLayer**，否则面板会跟着抖。

## 定时/循环：用哪个

| 需求 | 用什么 |
|---|---|
| 延时后做某事 | `this.scheduleOnce(cb, delay)` 或 `tween(n).delay(d).call(cb)` |
| 固定间隔反复 | `this.schedule(cb, interval)`（随组件 enabled/active 自动暂停） |
| 每帧推进逻辑 | `update(dt)`，**并且 `dt` 要钳位**：本项目 `const d = Math.min(dt, 0.05)`（切后台回来时 `dt` 会很大，不钳位会导致收益/计时爆炸） |
| 与动画同步 | tween 的 `.call()` |

> 任何情况下都不要 `setTimeout` / `setInterval`：不会随节点销毁而取消，浏览器切后台会被节流，小游戏/原生端行为不一致。
