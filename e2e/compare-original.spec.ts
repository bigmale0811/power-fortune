/**
 * Stage 5 — 原版 vs 克隆版視覺比對
 *
 * 截取原版遊戲與我們的版本，存成並排截圖供人工比對
 */
import { test, expect } from '@playwright/test';

const ORIGINAL_URL = 'https://uat.bfrk.org/egame-lobby?t=1&egame_id=3&egame_vendor=fc';
const CLONE_URL = 'http://localhost:5174';

test.describe('原版 vs 克隆版比對', () => {
  test('截取原版遊戲主畫面', async ({ browser }) => {
    // 開啟原版
    const origCtx = await browser.newContext({ viewport: { width: 450, height: 800 } });
    const origPage = await origCtx.newPage();

    try {
      await origPage.goto(ORIGINAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
      // 等待遊戲載入（原版可能需要較長時間）
      await origPage.waitForTimeout(10000);
      await origPage.screenshot({ path: 'e2e/screenshots/original-main.png', fullPage: true });
    } catch (e) {
      // 原版可能無法存取（需要登入/VPN），記錄錯誤但不失敗
      console.log('無法存取原版遊戲，跳過原版截圖：', e);
      // 改用 WebFetch 備案
    }
    await origCtx.close();

    // 截取我們的版本
    const cloneCtx = await browser.newContext({ viewport: { width: 450, height: 800 } });
    const clonePage = await cloneCtx.newPage();

    const errors: string[] = [];
    clonePage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await clonePage.goto(CLONE_URL, { waitUntil: 'networkidle' });
    await clonePage.waitForTimeout(8000);

    // 主畫面截圖
    await clonePage.screenshot({ path: 'e2e/screenshots/clone-main.png', fullPage: true });

    // 驗證 canvas 存在且尺寸合理
    const canvas = clonePage.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // 無嚴重錯誤
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR'),
    );
    if (criticalErrors.length > 0) {
      console.log('⚠️ Console errors:', criticalErrors);
    }

    await cloneCtx.close();
  });

  test('截取克隆版各狀態截圖', async ({ page }) => {
    await page.goto(CLONE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // 1. 載入完成後的主畫面
    await page.screenshot({ path: 'e2e/screenshots/clone-01-idle.png' });

    // 2. 點擊 SPIN
    const spinX = box!.x + box!.width / 2;
    const spinY = box!.y + box!.height * 0.88;
    await page.mouse.click(spinX, spinY);
    await page.waitForTimeout(1000);

    // 3. 旋轉中截圖
    await page.screenshot({ path: 'e2e/screenshots/clone-02-spinning.png' });

    // 4. 等待停止
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/clone-03-result.png' });

    // 5. 多轉幾次找到贏分畫面
    for (let i = 0; i < 8; i++) {
      await page.mouse.click(spinX, spinY);
      await page.waitForTimeout(3500);
    }
    await page.screenshot({ path: 'e2e/screenshots/clone-04-after-8-spins.png' });
  });
});
