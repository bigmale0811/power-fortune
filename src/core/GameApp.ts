/**
 * GameApp — PixiJS v8 應用程式包裝
 *
 * 職責：
 * 1. 初始化 PixiJS Application（1600×2000 直向畫布）
 * 2. Letterbox 響應式縮放（ADR-003）
 * 3. 提供全域入口點給各模組
 */
import { Application, Container } from 'pixi.js';
import { ResizeManager } from '@/core/ResizeManager';

/** 遊戲設計解析度（直向，對齊原版 Base_BG.jpg 1600×2000） */
export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 2000;

export class GameApp {
  private app: Application | null = null;
  private resizeManager: ResizeManager | null = null;
  private _initialized = false;

  /** 初始化 PixiJS 並掛載 resize 監聽 */
  async init(): Promise<void> {
    if (this._initialized) return;

    this.app = new Application();
    await this.app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x1a0a2e, // 深紫色，接近原版底色
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    this.resizeManager = new ResizeManager(
      this.app.canvas as HTMLCanvasElement,
      GAME_WIDTH,
      GAME_HEIGHT,
    );
    this.resizeManager.enable();

    this._initialized = true;
  }

  /** 取得 canvas DOM 元素 */
  getCanvas(): HTMLCanvasElement {
    if (!this.app) {
      throw new Error('[GameApp] 尚未初始化，請先呼叫 init()');
    }
    return this.app.canvas as HTMLCanvasElement;
  }

  /** 取得 PixiJS stage 根容器 */
  getStage(): Container {
    if (!this.app) {
      throw new Error('[GameApp] 尚未初始化，請先呼叫 init()');
    }
    return this.app.stage;
  }

  /** 取得 PixiJS Application 實例 */
  getApp(): Application {
    if (!this.app) {
      throw new Error('[GameApp] 尚未初始化，請先呼叫 init()');
    }
    return this.app;
  }

  /** 是否已初始化 */
  get initialized(): boolean {
    return this._initialized;
  }

  /** 銷毀應用程式並釋放資源 */
  destroy(): void {
    if (this.resizeManager) {
      this.resizeManager.disable();
      this.resizeManager = null;
    }
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    this._initialized = false;
  }
}
