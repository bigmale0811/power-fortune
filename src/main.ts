/**
 * Power Fortune 財神報喜 — 主入口
 * 初始化 GameApp 並掛載到 DOM
 */
import { GameApp } from '@/core/GameApp';

async function bootstrap(): Promise<void> {
  const app = new GameApp();
  await app.init();
  document.body.appendChild(app.getCanvas());
}

bootstrap().catch((err: unknown) => {
  console.error('[PowerFortune] 啟動失敗:', err);
});
