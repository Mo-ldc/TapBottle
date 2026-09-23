# 资源 · 音频 · 场景 · Cocos Creator 3.8.8

## 资源只能从 bundle 里动态加载

`resources.load()` 读的是 **`assets/resources/`** 目录（构建后是 `resources` 内置 bundle）。放在 `assets/` 其他位置的资源**无法**用 `resources.load` 取到，只能靠场景/prefab 里引用。
音频、字体、JSON 都是 Asset，统一走同一套 API。

### Bundle API（`resources` / `assetManager.getBundle(name)` 都是 Bundle 实例）

```ts
// 单个 / 批量加载（注意：批量时 onComplete 的 data 是数组，顺序与 paths 一致）
resources.load('Textures/ui/px_white2/spriteFrame', SpriteFrame, (err, sf) => {});
resources.load('Textures/a/spriteFrame', SpriteFrame, onProgress, (err, sf) => {});   // 带进度
resources.load(['Textures/a/spriteFrame', 'Textures/b/spriteFrame'], SpriteFrame,
               () => {}, (err, list: SpriteFrame[]) => {});
resources.load(p, (err, a) => {});                         // 不传 type，按扩展名/配置推断
resources.loadDir('Textures/ui', SpriteFrame, () => {}, (err, list) => {});  // 整个目录

resources.get<SpriteFrame>('Textures/ui/px_white2/spriteFrame');   // ★ 同步取「已加载」的，未加载返回 null
resources.getInfoWithPath(path, type);   // 拿 { uuid, path, ... }
resources.getDirWithPath(path, type, out);  // 目录下所有资源信息

resources.preload(paths, type, onProgress, onComplete);      // 只下载不进内存
resources.preloadDir(dir, type, onProgress, onComplete);

resources.release(path, type);   // 减引用计数，归零才真释放
resources.releaseAll();
```
> 路径是**相对 bundle 根、不含扩展名**。图片资源要加 `/spriteFrame` 后缀（因为 png 会被拆成 Texture2D + SpriteFrame 两个 Asset）。
> 用 `resources.load` 加载的东西**要配对 `release`**，否则换场景后不吃内存。本项目把全部贴图常驻（`Res.loadAll`），因为量小且全程要用。

### 其他 bundle / 远程

```ts
assetManager.loadBundle('subgame', (err, bundle) => { bundle.load('cfg/level1', JsonAsset, cb); });
assetManager.loadBundle('http://cdn.x.com/remote', { version: '1.0.0' }, cb);   // 远程 bundle
assetManager.loadRemote<T>(url, { ext: '.png' }, (err, tex) => {});            // 远程单文件
const b = assetManager.getBundle('resources');
assetManager.releaseAsset(asset);
```
自定义 bundle 要在编辑器的「资源管理器 → 文件夹设置 → 配置为 Bundle」里开启，并选择压缩类型（内置/远程/小游戏分包/zip）。

## 常用 Asset 类型

| 资源 | 类型 | 取内容 |
|---|---|---|
| 图（SpriteFrame） | `SpriteFrame` | 直接赋给 `sprite.spriteFrame` |
| 图（Texture2D） | `Texture2D` | `SpriteFrame.createWithImage(tex)` 或做材质 |
| 音效 / BGM | `AudioClip` | `audioSource.clip` / `playOneShot` |
| TTF 字体 | `Font` | `label.font = f; label.useSystemFont = false;` |
| 位图字体 | `BitmapFont` | 同上（美术产出） |
| 图集 | `SpriteAtlas` | `atlas.getSpriteFrame('name')` |
| 预制体 | `Prefab` | `instantiate(prefab)` |
| JSON 配置 | `JsonAsset` | `.json`（已解析对象） |
| 纯文本 | `TextAsset` | `.text` |
| 动画剪辑 | `AnimationClip` | `animation.clips = [clip]` |
| 场景 | `SceneAsset` | `director.runScene` |
| 材质 | `Material` | `sprite.customMaterial = mat` |

```ts
resources.load('data/levels', JsonAsset, (err, a) => { const cfg = a.json as MyType; });
resources.load('prefabs/popup', Prefab, (err, p) => { const n = instantiate(p); parent.addChild(n); });
import { instantiate } from 'cc';
```

## 资源加载的正确姿势（本项目 `Core/Res.ts` 就是范例）

```ts
// 1) 先并发加载全部资源，完成后再建 UI（避免图还没到就建节点 → 空白）
let left = 3;
const oneDone = () => { if (--left <= 0) { finish(true); } };
resources.load(TEXTURE_PATHS, SpriteFrame, () => {}, (err, assets) => {
    if (err) { console.warn('[Res] texture load error', err); }
    else { for (let i = 0; i < assets.length; i++) { this.frames[TEXTURE_PATHS[i]] = assets[i]; } }
    oneDone();
});
// 2) 全部塞进 Record<path, Asset> 做缓存，业务层只查表（Res.sf / Res.play）
// 3) 失败也调 oneDone()，绝不能让回调计数卡死（否则游戏永远卡在 loading）
```
**新增贴图/音效的完整动作**：① 文件拷到 `assets/resources/Textures/...`；② 在 `Res.ts` 的 `TEXTURE_PATHS` / `AUDIO_PATHS` 里加一条；③ 业务里用 `Res.sf('相对路径')` / `Res.play('名字')`。漏第 ② 步 → 返回 null，画面空白但**不报错**（这是本项目最容易踩的坑）。

> 编辑器里新拷入文件后要让它生成 `.meta`：调 MCP 的 `project_refresh_assets`，或在编辑器资源管理器里点一下。**没有 `.meta` 的资源在代码里取不到。**

## 音频

```ts
import { AudioSource, AudioClip } from 'cc';

const src = node.addComponent(AudioSource);
src.clip = clip; src.volume = 0.8; src.loop = true; src.playOnAwake = false;

src.play(); src.pause(); src.stop();
src.playOneShot(clip, volumeScale);   // ★ 短音效首选：可叠加、不受 clip 切换影响
src.playing; src.duration; src.currentTime; src.state;
src.on(AudioSource.EventType.STARTED, cb);
src.on(AudioSource.EventType.ENDED, cb);
```
**为什么要分两个 AudioSource**：`play()` 是单轨，切 clip 会打断上一首；`playOneShot` 只适合短音效。
本项目 `Res` 里挂了两个：`sfxSource`（点音效走 `playOneShot`）+ `bgmSource`（`loop = true` 循环 BGM）。加音频时沿用这个结构，别新建第三个源。

音量：`Res.masterScale` 由 `GameRoot` 每帧从 `G.data.settings.master` 同步；`play()` 内部乘 `masterScale`。
> 浏览器有「自动播放限制」：BGM 必须在**用户手势后**才能播——本项目在 `showSplash()` 的点击回调里才 `Res.I.music(true, ...)`。这是硬约束，不要尝试在 `onLoad` 直接播。

音频格式：`.mp3`（兼容最好）/ `.ogg` / `.wav`（无损但体积大）。本项目全用 `.wav`（13 个，都很短）。

## 场景

```ts
director.preloadScene('Main', () => {});        // 先预载
director.loadScene('Main', () => {}, () => {}); // 加载并切换（异步，当前场景销毁）
```
本项目只有一个场景 `Main.scene`，重载靠 `director.loadScene('Main')`（导出为 `globalThis.__tb_reload`）。
> 重载前 `G.clearListeners()`（`GameRoot.onLoad` 里已做），否则旧的 UI 订阅会指向已销毁节点。**跨场景需要保留的节点用 `director.addPersistRootNode(node)`**。

## 构建产物（build/）

`build/` 是构建输出，**不要手改**（改了下次构建就没了）。`library/` 是编辑器的资源导入缓存，`temp/` 是编译中间产物 + 类型声明（`temp/declarations/cc.d.ts` 只是指向引擎安装目录的转发文件）。
排查「改了代码不生效」时：让编辑器 `debug_clear_code_cache` 或删 `temp/` 后重启编辑器。
