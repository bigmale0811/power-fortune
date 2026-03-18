/**
 * SymbolView — 單格符號顯示元件
 *
 * 職責：
 * 1. 持有一個 PixiJS Sprite，顯示對應符號貼圖
 * 2. 提供 setSymbol() 方法切換符號
 * 3. 提供 playWinAnimation() / stopAnimation() 控制贏分動畫
 *
 * 贏分動畫：scale pulse（1.0 → 1.1 → 1.0，循環）
 * 使用 requestAnimationFrame 驅動，不依賴 PixiJS Ticker，
 * 以便可在任意時機獨立啟停。
 */

import { Container, Sprite, Texture } from 'pixi.js';

/** 每格尺寸（對齊原版 ReelViewSkin.exml：224×148 × 5col = 1120×592） */
export const SYMBOL_CELL_W = 224;
export const SYMBOL_CELL_H = 148;

/** Scale Pulse 動畫參數 */
const PULSE_MIN = 1.0;
const PULSE_MAX = 1.1;
/** 完整一個 pulse 循環的時長（毫秒） */
const PULSE_PERIOD_MS = 600;

export class SymbolView extends Container {
  /** 目前顯示的符號 ID（0-14） */
  private _symbolId: number;

  /** 符號貼圖映射表（由外部 SymbolManager 注入） */
  private _textures: ReadonlyMap<number, Texture>;

  /** 實際渲染的 Sprite */
  private readonly _sprite: Sprite;

  /** 動畫狀態 */
  private _animating = false;
  private _animStart = 0;
  private _rafId: number | null = null;

  /**
   * @param textures - 符號 ID → Texture 的映射表
   * @param initialId - 初始符號 ID（預設 0）
   */
  constructor(textures: ReadonlyMap<number, Texture>, initialId = 0) {
    super();
    this._textures = textures;
    this._symbolId = initialId;

    // 建立 Sprite，置中對齊
    const tex = this._resolveTexture(initialId);
    this._sprite = new Sprite(tex);
    this._sprite.anchor.set(0.5);
    // 置中於格子內
    this._sprite.x = SYMBOL_CELL_W / 2;
    this._sprite.y = SYMBOL_CELL_H / 2;

    // 縮放至格子尺寸
    this._scaleToCell(tex);

    this.addChild(this._sprite);
  }

  // ─────────────────────── 公開 API ───────────────────────

  /** 取得目前符號 ID */
  get symbolId(): number {
    return this._symbolId;
  }

  /**
   * 切換顯示的符號
   * @param id - 目標符號 ID（0-14）
   */
  setSymbol(id: number): void {
    if (id === this._symbolId) return;

    this._symbolId = id;
    const tex = this._resolveTexture(id);
    this._sprite.texture = tex;
    this._scaleToCell(tex);
  }

  /**
   * 更新貼圖映射表（在 SymbolManager 載入完成後呼叫）
   * 不可變模式：替換整個 map 引用
   */
  setTextures(textures: ReadonlyMap<number, Texture>): void {
    this._textures = textures;
    // 以新 map 重新套用目前符號
    const tex = this._resolveTexture(this._symbolId);
    this._sprite.texture = tex;
    this._scaleToCell(tex);
  }

  /**
   * 播放贏分 Scale Pulse 動畫（循環，直到 stopAnimation() 被呼叫）
   */
  playWinAnimation(): void {
    if (this._animating) return;
    this._animating = true;
    this._animStart = performance.now();
    this._tickPulse();
  }

  /**
   * 停止贏分動畫，恢復原始比例
   */
  stopAnimation(): void {
    this._animating = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    // 還原 scale
    this._sprite.scale.set(this._baseSpriteScale());
  }

  // ─────────────────────── 私有工具 ───────────────────────

  /**
   * 解析符號 ID 對應的 Texture；若找不到則回傳空白 Texture 作為安全降級
   */
  private _resolveTexture(id: number): Texture {
    return this._textures.get(id) ?? Texture.EMPTY;
  }

  /**
   * 計算讓 Sprite 填滿格子所需的統一縮放比例（保持長寬比，取最小值 fit-contain）
   * 留 4px 邊距避免符號緊貼邊框
   */
  private _baseSpriteScale(): number {
    const tex = this._sprite.texture;
    if (tex.width === 0 || tex.height === 0) return 1;
    const margin = 4;
    const targetW = SYMBOL_CELL_W - margin * 2;
    const targetH = SYMBOL_CELL_H - margin * 2;
    return Math.min(targetW / tex.width, targetH / tex.height);
  }

  /** 套用基礎縮放到 Sprite */
  private _scaleToCell(tex: Texture): void {
    if (tex.width === 0 || tex.height === 0) return;
    const s = this._baseSpriteScale();
    this._sprite.scale.set(s);
  }

  /**
   * RAF 驅動的 Scale Pulse 動畫幀
   * 使用 sine 曲線讓縮放平滑震盪
   */
  private _tickPulse(): void {
    if (!this._animating) return;

    const elapsed = performance.now() - this._animStart;
    // 正規化到 [0, 1]，一個完整週期
    const t = (elapsed % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    // sin(0→2π) → [-1, 1] → 映射到 [PULSE_MIN, PULSE_MAX]
    const sineVal = Math.sin(t * Math.PI * 2);
    const mid = (PULSE_MIN + PULSE_MAX) / 2;
    const amp = (PULSE_MAX - PULSE_MIN) / 2;
    const pulseScale = mid + amp * sineVal;

    // 基礎縮放 × pulse 放大係數
    const base = this._baseSpriteScale();
    this._sprite.scale.set(base * pulseScale);

    this._rafId = requestAnimationFrame(() => this._tickPulse());
  }
}
