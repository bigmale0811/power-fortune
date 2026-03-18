/**
 * Power Fortune 財神報喜 — 主入口
 * 初始化 PixiJS → 載入 BaseGameScene → 掛載到 DOM
 */
import { GameApp } from '@/core/GameApp';
import { SceneManager } from '@/core/SceneManager';
import { BaseGameScene } from '@/scenes/BaseGameScene';

async function bootstrap(): Promise<void> {
  // 初始化 PixiJS
  const app = new GameApp();
  await app.init();
  document.body.appendChild(app.getCanvas());

  // 場景管理
  const sceneManager = new SceneManager(app.getStage());

  // 載入 BaseGameScene
  const baseGame = new BaseGameScene();
  await sceneManager.switchTo(baseGame);

  // 遊戲主迴圈（驅動場景 update）
  app.getApp().ticker.add((ticker) => {
    sceneManager.update(ticker.deltaMS);
  });

  console.log('[PowerFortune] 啟動成功！');
}

bootstrap().catch((err: unknown) => {
  console.error('[PowerFortune] 啟動失敗:', err);
});
