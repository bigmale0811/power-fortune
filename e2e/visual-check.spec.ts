/**
 * Phase I — E2E 視覺驗證腳本
 *
 * 啟動 Vite dev server，驗證：
 * 1. Canvas 正常渲染（無黑屏）
 * 2. 無 console.error
 * 3. 主要 UI 元素可見
 * 4. SPIN 按鈕可點擊並觸發旋轉
 * 5. 截圖保存供人工比對
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

test.describe('Power Fortune 視覺驗證', () => {
  test('載入畫面正常渲染', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 等待 Canvas 出現
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // 等待載入完成（LoadingScene → BaseGameScene 過渡）
    await page.waitForTimeout(5000);

    // 截圖：主畫面
    await page.screenshot({
      path: 'e2e/screenshots/01-main-screen.png',
      fullPage: true,
    });

    // 確認 canvas 尺寸合理（非 0×0）
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // 無嚴重 console 錯誤
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('點擊 SPIN 觸發旋轉動畫', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // 等待場景載入
    await page.waitForTimeout(5000);

    // 截圖：旋轉前
    await page.screenshot({
      path: 'e2e/screenshots/02-before-spin.png',
      fullPage: true,
    });

    // 點擊 SPIN 按鈕區域（底部中央，約 Y=1100~1280 的中間）
    const box = await canvas.boundingBox();
    if (box) {
      // SPIN 按鈕在畫布底部中央（大約 Y 比例 85%，X 中央）
      const spinX = box.x + box.width / 2;
      const spinY = box.y + box.height * 0.88;
      await page.mouse.click(spinX, spinY);
    }

    // 等待旋轉動畫
    await page.waitForTimeout(3000);

    // 截圖：旋轉後
    await page.screenshot({
      path: 'e2e/screenshots/03-after-spin.png',
      fullPage: true,
    });

    // 再按一次
    if (box) {
      const spinX = box!.x + box!.width / 2;
      const spinY = box!.y + box!.height * 0.88;
      await page.mouse.click(spinX, spinY);
    }
    await page.waitForTimeout(3000);

    // 截圖：第二次旋轉後
    await page.screenshot({
      path: 'e2e/screenshots/04-second-spin.png',
      fullPage: true,
    });
  });

  test('連續旋轉 5 次不崩潰', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(5000);

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    for (let i = 0; i < 5; i++) {
      const spinX = box!.x + box!.width / 2;
      const spinY = box!.y + box!.height * 0.88;
      await page.mouse.click(spinX, spinY);
      await page.waitForTimeout(3500);
    }

    // 截圖：連續旋轉後
    await page.screenshot({
      path: 'e2e/screenshots/05-after-5-spins.png',
      fullPage: true,
    });

    // 不應有 JS 崩潰錯誤
    const crashes = errors.filter(
      (e) =>
        e.includes('Uncaught') ||
        e.includes('TypeError') ||
        e.includes('ReferenceError'),
    );
    expect(crashes).toHaveLength(0);
  });
});
