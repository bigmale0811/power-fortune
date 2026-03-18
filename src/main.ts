/**
 * Power Fortune 財神報喜 — 主入口（視覺層整合版）
 *
 * 啟動流程：
 *   1. 建立 PixiJS Application (1600×2000)，掛載 canvas
 *   2. 設定響應式 Letterbox 縮放
 *   3. 建立 LoadingScene，加入 stage
 *   4. 建立 AssetPipeline，onProgress → LoadingScene.setProgress
 *   5. await pipeline.load()（全資源載入）
 *   6. 解析符號：symbolManager.loadSymbols()
 *   7. 移除 LoadingScene
 *   8. 建立 BaseGameScene(app)，await init()，加入 stage
 *   9. 全程 try/catch — 錯誤顯示在畫面上
 *
 * PixiJS v8 要點：
 *   - new Application() + await app.init({...})（兩步驟初始化）
 *   - app.canvas（不是 app.view）
 *   - app.ticker.add((ticker) => { ... })
 */

import { Application, Text, TextStyle } from 'pixi.js';
import { AssetPipeline } from '@/assets/AssetPipeline';
import { AssetStore } from '@/assets/AssetStore';
import { symbolManager } from '@/reel/SymbolManager';
import { LoadingScene } from '@/scenes/LoadingScene';
import { BaseGameScene } from '@/scenes/BaseGameScene';
import type { EgretMCData } from '@/reel/SymbolManager';

// ─────────────────────── 版面常數 ───────────────────────

const GAME_W = 1600;
const GAME_H = 2000;

// ─────────────────────── 主要啟動函式 ───────────────────────

async function bootstrap(): Promise<void> {
  // ── 步驟 1：建立 PixiJS Application ──────────────────────────
  const app = new Application();
  await app.init({
    width:           GAME_W,
    height:          GAME_H,
    backgroundColor: 0x1a0a2e,
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });

  // ── 步驟 2：掛載 canvas 並設定 Letterbox 縮放 ──────────────────
  document.body.appendChild(app.canvas);
  setupLetterbox(app.canvas as HTMLCanvasElement);

  // ── 步驟 3：建立並顯示 LoadingScene ──────────────────────────
  const loadingScene = new LoadingScene();
  app.stage.addChild(loadingScene);

  // 非阻塞地初始化 LoadingScene 自身資源（Logo + 進度列圖片）
  // 先讓進度列的 init 開始跑，同時啟動 pipeline
  const loadingInitPromise = loadingScene.init();

  // ── 步驟 4：建立 AssetPipeline，回呼驅動 LoadingScene ─────────
  const pipeline = new AssetPipeline({
    locale: 'en',
    onProgress: (stage: string, progress: number) => {
      // 將各階段進度映射至 LoadingScene 的 setProgress
      // preload=0~20%，game1=20~60%，control-panel=60~75%，
      // game2=75~88%，game3=88~99%，complete=100%
      const stageWeights: Record<string, [number, number]> = {
        preload:         [0.00, 0.20],
        game1:           [0.20, 0.60],
        'control-panel': [0.60, 0.75],
        game2:           [0.75, 0.88],
        game3:           [0.88, 0.99],
        complete:        [0.99, 1.00],
      };

      const range = stageWeights[stage] ?? [0, 1];
      const globalProgress = range[0] + (range[1] - range[0]) * progress;
      loadingScene.setProgress(stage, globalProgress);
    },
  });

  // 等待 LoadingScene 本身初始化完成後再開始大量資源載入
  // （避免 LoadingScene 的進度條圖片因管線佔用頻寬而延遲顯示）
  await loadingInitPromise;

  // ── 步驟 5：執行完整資源載入流程 ─────────────────────────────
  const store: AssetStore = await pipeline.load();

  // ── 步驟 6：解析符號貼圖（Symbol.png + Symbol.json） ─────────
  // AssetPipeline 在 game1 階段已將 Symbol_png + Symbol_json 載入 AssetStore
  // 但 SymbolManager 需要在此獨立解析以建立 id→Texture 映射
  try {
    const symbolTex  = store.getTexture('Symbol_png');
    const symbolJson = store.getJsonAs<EgretMCData>('Symbol_json');
    symbolManager.loadSymbols(symbolTex, symbolJson);
    console.log('[main] 符號貼圖解析完成');
  } catch (err) {
    // 符號資源缺失時啟動降級模式（純色色塊）
    console.warn('[main] Symbol 資源解析失敗，使用備用貼圖：', err);
    symbolManager.loadFallbacks();
  }

  // ── 步驟 7：移除 LoadingScene ─────────────────────────────────
  loadingScene.setProgress('complete', 1.0);
  // 短暫停頓讓玩家看到 100%
  await delay(300);
  app.stage.removeChild(loadingScene);
  loadingScene.destroy();

  // ── 步驟 8：建立並顯示 BaseGameScene ──────────────────────────
  const gameScene = new BaseGameScene(app);
  app.stage.addChild(gameScene);
  await gameScene.init();

  // 暴露 app 給 E2E 測試（僅 dev 環境）
  if (import.meta.env.DEV) {
    (globalThis as any).__PIXI_APP__ = app;
  }

  console.log('[PowerFortune] 遊戲就緒！');
}

// ─────────────────────── 工具函式 ───────────────────────

/**
 * 設定 Letterbox 響應式縮放
 *
 * 保持 1600:2000 (4:5) 比例置中顯示，
 * 可用寬度不足時以高度為準，反之以寬度為準。
 *
 * @param canvas - PixiJS app.canvas（HTMLCanvasElement）
 */
function setupLetterbox(canvas: HTMLCanvasElement): void {
  // 套用 CSS 使 canvas 置中（Letterbox：保持 1600:2000 = 4:5 比例）
  canvas.style.position = 'absolute';
  canvas.style.left     = '50%';
  canvas.style.top      = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';

  function resize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gameRatio = GAME_W / GAME_H; // 1600/2000 = 0.8
    const viewRatio = vw / vh;

    let w: number;
    let h: number;

    if (viewRatio > gameRatio) {
      // 視口較寬：以高度為基準
      h = vh;
      w = vh * gameRatio;
    } else {
      // 視口較高或等比：以寬度為基準
      w = vw;
      h = vw / gameRatio;
    }

    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  window.addEventListener('resize', resize);
  resize();
}

/**
 * 非同步延遲工具（避免 setTimeout 直接用在 async/await 中）
 * @param ms 毫秒數
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 顯示致命錯誤到畫面（讓使用者看到錯誤而非空白頁）
 *
 * @param app - PixiJS Application（可能尚未初始化）
 * @param err - 錯誤物件
 */
function showFatalError(app: Application | null, err: unknown): void {
  const msg = err instanceof Error
    ? (err.stack ?? err.message)
    : String(err);

  console.error('[PowerFortune] 致命錯誤：', msg);

  // 若 app 已初始化，在 stage 顯示錯誤訊息
  if (app && app.stage) {
    const errText = new Text({
      text: `ERROR:\n${msg}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 18,
        fill: 0xff4444,
        wordWrap: true,
        wordWrapWidth: GAME_W - 40,
      }),
    });
    errText.x = 20;
    errText.y = 20;
    app.stage.addChild(errText);
  }

  // 同時更新 HTML status 元素（若存在）
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.style.color   = '#ff4444';
    statusEl.textContent   = `ERROR: ${msg}`;
    statusEl.style.display = 'block';
  }
}

// ─────────────────────── 啟動 ───────────────────────

// 頂層啟動：bootstrap 在自己內部管理 Application 實例
// 錯誤發生時嘗試顯示到 DOM（app 可能尚未建立，所以傳 null）
bootstrap().catch((err: unknown) => {
  showFatalError(null, err);
});
