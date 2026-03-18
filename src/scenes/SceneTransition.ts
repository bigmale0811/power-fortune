/**
 * SceneTransition — 場景切換過渡效果
 *
 * 提供三種靜態方法：
 *   fadeOut  — 畫面由透明漸變為黑色（遮蔽舊場景）
 *   fadeIn   — 畫面由黑色漸變為透明（揭示新場景）
 *   crossFade — 淡出舊場景 → 移除舊場景、加入新場景 → 淡入新場景
 *
 * 實作方式：
 *   在 app.stage 最上層加入一個 1600×2000 的純黑 Graphics 遮罩，
 *   使用 requestAnimationFrame 驅動 alpha 逐幀插值（線性緩動）。
 *   動畫完成後移除遮罩，避免殘留在 stage 上。
 */

import {
  Application,
  Container,
  Graphics,
} from 'pixi.js';

// ─────────────────────── 常數 ───────────────────────

/** 畫布寬度（對齊原版 1600×2000） */
const CANVAS_W = 1600;

/** 畫布高度 */
const CANVAS_H = 2000;

/** 預設過渡時長（毫秒） */
const DEFAULT_DURATION_MS = 400;

/** 遮罩填色（純黑） */
const OVERLAY_COLOR = 0x000000;

// ─────────────────────── SceneTransition ───────────────────────

export class SceneTransition extends Container {
  /**
   * 淡出（畫面由透明 → 黑色）
   *
   * 常見用法：在切換場景前呼叫，讓畫面漸漸變黑。
   *
   * @param app      PixiJS Application 實例
   * @param duration 動畫持續時間（毫秒），預設 400ms
   * @returns Promise，動畫完成後 resolve
   */
  static fadeOut(app: Application, duration = DEFAULT_DURATION_MS): Promise<void> {
    return SceneTransition._animateOverlay(app, 0, 1, duration);
  }

  /**
   * 淡入（畫面由黑色 → 透明）
   *
   * 常見用法：在新場景加入 stage 後呼叫，讓畫面逐漸顯現。
   *
   * @param app      PixiJS Application 實例
   * @param duration 動畫持續時間（毫秒），預設 400ms
   * @returns Promise，動畫完成後 resolve
   */
  static fadeIn(app: Application, duration = DEFAULT_DURATION_MS): Promise<void> {
    return SceneTransition._animateOverlay(app, 1, 0, duration);
  }

  /**
   * 交叉淡化（crossFade）：淡出舊場景 → 切換內容 → 淡入新場景
   *
   * 流程：
   *   1. fadeOut（遮蔽舊場景）
   *   2. 從 stage 移除 oldScene，加入 newScene（在遮蔽期間完成）
   *   3. fadeIn（揭示新場景）
   *
   * @param app      PixiJS Application 實例
   * @param oldScene 即將移除的舊場景容器
   * @param newScene 即將加入的新場景容器
   * @param duration 每個方向（淡出/淡入）的動畫時間（毫秒），預設 400ms
   * @returns Promise，全程動畫完成後 resolve
   */
  static async crossFade(
    app: Application,
    oldScene: Container,
    newScene: Container,
    duration = DEFAULT_DURATION_MS,
  ): Promise<void> {
    // 第一步：淡出（遮蔽舊場景）
    await SceneTransition.fadeOut(app, duration);

    // 第二步：切換場景內容（在黑色遮罩下進行，使用者不可見）
    if (app.stage.children.includes(oldScene)) {
      app.stage.removeChild(oldScene);
    }
    // 將新場景插入 stage 底部（index 0），確保遮罩覆蓋在新場景上方
    app.stage.addChildAt(newScene, 0);

    // 第三步：淡入（揭示新場景）
    await SceneTransition.fadeIn(app, duration);
  }

  // ─────────────────────── 私有：核心動畫邏輯 ───────────────────────

  /**
   * 建立遮罩並以 requestAnimationFrame 驅動 alpha 插值
   *
   * @param app        PixiJS Application 實例
   * @param fromAlpha  起始透明度（0.0 = 完全透明，1.0 = 完全不透明）
   * @param toAlpha    目標透明度
   * @param duration   動畫持續時間（毫秒）
   * @returns Promise，動畫完成後 resolve（遮罩已從 stage 移除）
   */
  private static _animateOverlay(
    app: Application,
    fromAlpha: number,
    toAlpha: number,
    duration: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      // 建立純黑全螢幕遮罩
      const overlay = new Graphics();
      overlay.rect(0, 0, CANVAS_W, CANVAS_H)
        .fill({ color: OVERLAY_COLOR });
      overlay.alpha = fromAlpha;
      // 加到 stage 最上層，確保遮罩覆蓋所有場景
      app.stage.addChild(overlay);

      // 記錄動畫開始時間
      const startTime = performance.now();

      /**
       * 每幀更新 alpha 值
       * 使用線性插值（lerp）：alpha = from + (to - from) * progress
       */
      function step(now: DOMHighResTimeStamp): void {
        const elapsed  = now - startTime;
        // 計算進度（0.0 ~ 1.0，超過 1 時夾為 1）
        const progress = Math.min(elapsed / duration, 1);
        overlay.alpha  = fromAlpha + (toAlpha - fromAlpha) * progress;

        if (progress < 1) {
          // 動畫未完成，繼續下一幀
          requestAnimationFrame(step);
        } else {
          // 動畫完成：設定最終值，從 stage 移除遮罩，resolve Promise
          overlay.alpha = toAlpha;
          app.stage.removeChild(overlay);
          overlay.destroy();
          resolve();
        }
      }

      // 啟動第一幀
      requestAnimationFrame(step);
    });
  }
}
