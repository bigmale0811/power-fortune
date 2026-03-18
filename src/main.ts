/**
 * Power Fortune 財神報喜 — 主入口
 * 初始化 PixiJS → 載入 BaseGameScene → 掛載到 DOM
 */
import { Application } from 'pixi.js';
import { BaseGameScene } from '@/scenes/BaseGameScene';
import { SceneManager } from '@/core/SceneManager';
import { GAME_WIDTH, GAME_HEIGHT } from '@/core/GameApp';

// 錯誤顯示到畫面上（debug 用）
function showError(msg: string): void {
  const el = document.getElementById('error-display');
  if (el) {
    el.style.display = 'block';
    el.textContent = msg;
  }
}

async function bootstrap(): Promise<void> {
  try {
    showError('Initializing PixiJS...');

    const app = new Application();
    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x1a0a2e,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: true,
    });

    document.body.appendChild(app.canvas);

    // Letterbox 響應式縮放
    function resize(): void {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gameRatio = GAME_WIDTH / GAME_HEIGHT;
      const viewRatio = vw / vh;
      let w: number, h: number;
      if (viewRatio > gameRatio) {
        h = vh;
        w = vh * gameRatio;
      } else {
        w = vw;
        h = vw / gameRatio;
      }
      app.canvas.style.width = `${w}px`;
      app.canvas.style.height = `${h}px`;
    }
    window.addEventListener('resize', resize);
    resize();

    showError('Loading scene...');

    // 場景管理
    const sceneManager = new SceneManager(app.stage);
    const baseGame = new BaseGameScene();
    await sceneManager.switchTo(baseGame);

    // 隱藏錯誤顯示
    const el = document.getElementById('error-display');
    if (el) el.style.display = 'none';

    // 主迴圈
    app.ticker.add((ticker) => {
      sceneManager.update(ticker.deltaMS);
    });

    console.log('[PowerFortune] 啟動成功！');
  } catch (err) {
    console.error('[PowerFortune] 啟動失敗:', err);
    showError(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

bootstrap();
