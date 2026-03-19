/**
 * LoadingScene — 載入畫面場景
 *
 * 職責：
 * 1. 顯示遊戲 Logo（GameLogo_en.png）於頂部置中
 * 2. 中央顯示進度列（LoadingBar_BG.png + LoadingBar.png）
 * 3. 進度列下方顯示百分比文字
 * 4. 深紫色背景（0x1a0a2e）
 *
 * 使用 PixiJS v8 API：Assets.load → Sprite → Graphics
 */

import {
  Container,
  Sprite,
  Graphics,
  Text,
  TextStyle,
  Assets,
  Texture,
} from 'pixi.js';

// ─────────────────────── 版面常數 ───────────────────────

/** 畫布設計尺寸（直向，對齊原版 1600×2000） */
const CANVAS_W = 900;
const CANVAS_H = 2000;

/** Logo 頂部 Y 位置 */
const LOGO_Y = 280;

/** 進度列容器中心 Y */
const BAR_CENTER_Y = 780;

/** 進度列寬度（填充條最大寬度） */
const BAR_MAX_W = 540;

/** 進度列高度 */
const BAR_H = 36;

/** 進度文字與進度列的間距 */
const TEXT_GAP = 24;

// ─────────────────────── 資源路徑 ───────────────────────

const LOGO_PATH      = 'assets/PreLoad/GameLogo_en.png';
const BAR_BG_PATH    = 'assets/PreLoad/LoadingBar_BG.png';
const BAR_FILL_PATH  = 'assets/PreLoad/LoadingBar.png';

// ─────────────────────── LoadingScene ───────────────────────

export class LoadingScene extends Container {
  // 視覺元素
  private _background!: Graphics;
  private _logo!: Sprite;
  private _barBg!: Sprite;
  private _barFill!: Sprite;
  private _barFillMask!: Graphics;
  private _progressText!: Text;

  // 進度列 fallback（PNG 載入失敗時使用）
  private _fallbackBarBg!: Graphics;
  private _fallbackBarFill!: Graphics;

  // 當前進度 (0.0 ~ 1.0)
  private _progress = 0;
  private _usePngBar = false;

  // ─────────────────────── 初始化 ───────────────────────

  /**
   * 載入 LoadingScene 所需的自有資源（Logo、進度列圖片）
   * 必須在加入 stage 之前或之後呼叫皆可（非同步完成前顯示 fallback）
   */
  async init(): Promise<void> {
    // 先建立 fallback UI（確保資源載入期間有畫面）
    this._buildBackground();
    this._buildFallbackBar();
    this._buildProgressText();

    // 並行載入三張圖片
    const [logoResult, barBgResult, barFillResult] = await Promise.allSettled([
      Assets.load<Texture>(LOGO_PATH),
      Assets.load<Texture>(BAR_BG_PATH),
      Assets.load<Texture>(BAR_FILL_PATH),
    ]);

    // 套用 Logo
    if (logoResult.status === 'fulfilled') {
      this._applyLogo(logoResult.value);
    } else {
      // Logo 載入失敗時顯示文字 fallback
      console.warn('[LoadingScene] GameLogo_en.png 載入失敗，使用文字 fallback');
      this._buildLogoFallback();
    }

    // 套用進度列 PNG
    if (
      barBgResult.status === 'fulfilled'
      && barFillResult.status === 'fulfilled'
    ) {
      this._applyPngBar(barBgResult.value, barFillResult.value);
      this._usePngBar = true;
      // 隱藏 fallback
      this._fallbackBarBg.visible  = false;
      this._fallbackBarFill.visible = false;
    }

    // 套用目前進度（可能在資源載入期間已更新過）
    this._applyProgress(this._progress);
  }

  // ─────────────────────── 公開 API ───────────────────────

  /**
   * 更新進度顯示
   * @param stage    目前載入階段名稱（如 'preload'、'game1'）
   * @param progress 進度值（0.0 ~ 1.0）
   */
  setProgress(_stage: string, progress: number): void {
    this._progress = Math.max(0, Math.min(1, progress));
    this._applyProgress(this._progress);

    // 更新文字：「Loading... XX%」
    const pct = Math.round(this._progress * 100);
    if (this._progressText) {
      this._progressText.text = `Loading... ${pct}%`;
    }
  }

  // ─────────────────────── 私有：UI 建構 ───────────────────────

  /** 建立深色背景 */
  private _buildBackground(): void {
    this._background = new Graphics()
      .rect(0, 0, CANVAS_W, CANVAS_H)
      .fill(0x1a0a2e);
    this.addChild(this._background);
  }

  /**
   * 建立 Graphics 進度列（PNG 未載入時的 fallback）
   * 背景：深色圓角矩形
   * 填充：金色圓角矩形（寬度由進度控制）
   */
  private _buildFallbackBar(): void {
    const barLeft = (CANVAS_W - BAR_MAX_W) / 2;
    const barTop  = BAR_CENTER_Y - BAR_H / 2;

    // 背景框
    this._fallbackBarBg = new Graphics()
      .roundRect(barLeft, barTop, BAR_MAX_W, BAR_H, BAR_H / 2)
      .fill({ color: 0x0d0520, alpha: 0.9 })
      .roundRect(barLeft, barTop, BAR_MAX_W, BAR_H, BAR_H / 2)
      .stroke({ color: 0xd4af37, width: 2, alpha: 0.7 });
    this.addChild(this._fallbackBarBg);

    // 填充條（初始寬度為 0）
    this._fallbackBarFill = new Graphics();
    this.addChild(this._fallbackBarFill);

    // 初始繪製 0%
    this._drawFallbackFill(0);
  }

  /**
   * 重繪 fallback 填充條
   * @param progress 0.0 ~ 1.0
   */
  private _drawFallbackFill(progress: number): void {
    if (!this._fallbackBarFill) return;

    const barLeft = (CANVAS_W - BAR_MAX_W) / 2;
    const barTop  = BAR_CENTER_Y - BAR_H / 2;
    const fillW   = Math.max(0, BAR_MAX_W * progress);

    this._fallbackBarFill.clear();
    if (fillW > 0) {
      // 使用 PixiJS v8 鏈式 API
      this._fallbackBarFill
        .roundRect(barLeft + 2, barTop + 2, fillW - 4, BAR_H - 4, (BAR_H - 4) / 2)
        .fill({ color: 0xd4af37 });
    }
  }

  /** 建立進度文字 */
  private _buildProgressText(): void {
    this._progressText = new Text({
      text: 'Loading... 0%',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xcccccc,
        align: 'center',
      }),
    });
    this._progressText.anchor.set(0.5, 0);
    this._progressText.x = CANVAS_W / 2;
    this._progressText.y = BAR_CENTER_Y + BAR_H / 2 + TEXT_GAP;
    this.addChild(this._progressText);
  }

  /**
   * 套用 Logo Sprite（PNG 成功載入後呼叫）
   */
  private _applyLogo(tex: Texture): void {
    this._logo = new Sprite(tex);
    this._logo.anchor.set(0.5, 0);

    // 等比縮放至目標寬度 600px
    const targetW = 600;
    const scale   = targetW / this._logo.texture.width;
    this._logo.scale.set(scale);
    this._logo.x = CANVAS_W / 2;
    this._logo.y = LOGO_Y;
    this.addChild(this._logo);
  }

  /**
   * Logo 載入失敗時的文字 fallback
   */
  private _buildLogoFallback(): void {
    const logoText = new Text({
      text: 'POWER FORTUNE',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 60,
        fontWeight: 'bold',
        fill: 0xffd700,
        dropShadow: { color: 0x884400, blur: 12, distance: 4, angle: Math.PI / 4 },
        stroke: { color: 0x7a4000, width: 3 },
      }),
    });
    logoText.anchor.set(0.5, 0);
    logoText.x = CANVAS_W / 2;
    logoText.y = LOGO_Y;
    this.addChild(logoText);

    const subText = new Text({
      text: '財神報喜',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 30,
        fill: 0xaaaaaa,
        align: 'center',
      }),
    });
    subText.anchor.set(0.5, 0);
    subText.x = CANVAS_W / 2;
    subText.y = LOGO_Y + 80;
    this.addChild(subText);
  }

  /**
   * 套用 PNG 進度列（兩張圖都成功載入後呼叫）
   * 使用 Mask 遮罩控制填充條的顯示寬度
   */
  private _applyPngBar(bgTex: Texture, fillTex: Texture): void {
    const barLeft = (CANVAS_W - BAR_MAX_W) / 2;
    const barTop  = BAR_CENTER_Y - BAR_H / 2;

    // 背景 Sprite（縮放至 BAR_MAX_W × BAR_H）
    this._barBg = new Sprite(bgTex);
    this._barBg.x = barLeft;
    this._barBg.y = barTop;
    this._barBg.width  = BAR_MAX_W;
    this._barBg.height = BAR_H;
    this.addChild(this._barBg);

    // 填充 Sprite（原始尺寸，透過 mask 控制可見寬度）
    this._barFill = new Sprite(fillTex);
    this._barFill.x = barLeft;
    this._barFill.y = barTop;
    this._barFill.width  = BAR_MAX_W;
    this._barFill.height = BAR_H;

    // 建立矩形遮罩
    this._barFillMask = new Graphics();
    this._barFill.mask = this._barFillMask;

    this.addChild(this._barFill);
    this.addChild(this._barFillMask);

    // 確保進度文字在最上層
    if (this._progressText) {
      this.removeChild(this._progressText);
      this.addChild(this._progressText);
    }
  }

  /**
   * 套用進度至視覺元素
   * @param progress 0.0 ~ 1.0
   */
  private _applyProgress(progress: number): void {
    if (this._usePngBar && this._barFillMask) {
      // PNG 模式：更新遮罩矩形
      const barLeft = (CANVAS_W - BAR_MAX_W) / 2;
      const barTop  = BAR_CENTER_Y - BAR_H / 2;
      const fillW   = BAR_MAX_W * progress;
      this._barFillMask.clear()
        .rect(barLeft, barTop, fillW, BAR_H)
        .fill(0xffffff);
    } else if (this._fallbackBarFill) {
      // Fallback 模式：重繪 Graphics 填充條
      this._drawFallbackFill(progress);
    }
  }
}
