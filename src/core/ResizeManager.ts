/**
 * ResizeManager — 響應式 Letterbox 縮放管理器
 *
 * 實作 ADR-003：Portrait-first contain-fit letterbox
 * 根據瀏覽器視窗大小，以 contain 模式等比縮放 canvas，
 * 保持設計解析度比例（900:1600），兩側補黑邊。
 */

export interface ResizeResult {
  /** canvas 實際顯示寬度 (px) */
  readonly width: number;
  /** canvas 實際顯示高度 (px) */
  readonly height: number;
  /** 縮放比例 */
  readonly scale: number;
}

export class ResizeManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly designWidth: number;
  private readonly designHeight: number;
  private readonly handleResize: () => void;
  private _enabled = false;

  constructor(canvas: HTMLCanvasElement, designWidth: number, designHeight: number) {
    this.canvas = canvas;
    this.designWidth = designWidth;
    this.designHeight = designHeight;
    this.handleResize = this.resize.bind(this);
  }

  /** 啟用自動監聽 window resize */
  enable(): void {
    if (this._enabled) return;
    window.addEventListener('resize', this.handleResize);
    this.resize(); // 立即執行一次
    this._enabled = true;
  }

  /** 停用監聽 */
  disable(): void {
    window.removeEventListener('resize', this.handleResize);
    this._enabled = false;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 計算 contain-fit 縮放結果（純函式，方便測試）
   * @param viewportWidth  瀏覽器視窗寬度
   * @param viewportHeight 瀏覽器視窗高度
   */
  calculateFit(viewportWidth: number, viewportHeight: number): ResizeResult {
    const aspectRatio = this.designWidth / this.designHeight;
    const viewportRatio = viewportWidth / viewportHeight;

    let width: number;
    let height: number;
    let scale: number;

    if (viewportRatio > aspectRatio) {
      // 視窗比較寬 → 高度撐滿，左右補黑邊
      height = viewportHeight;
      scale = viewportHeight / this.designHeight;
      width = this.designHeight * aspectRatio * (viewportHeight / this.designHeight);
    } else {
      // 視窗比較窄（或剛好）→ 寬度撐滿，上下補黑邊
      width = viewportWidth;
      scale = viewportWidth / this.designWidth;
      height = this.designWidth / aspectRatio * (viewportWidth / this.designWidth);
    }

    return Object.freeze({ width: Math.round(width), height: Math.round(height), scale });
  }

  /** 執行 resize，更新 canvas CSS 尺寸 */
  private resize(): void {
    const { width, height } = this.calculateFit(window.innerWidth, window.innerHeight);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }
}
