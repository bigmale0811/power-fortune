/**
 * 原始解析度截圖驗證 — 1600×2000 viewport（對齊原版設計解析度）
 * 避免縮小導致的誤判
 */
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 2000 } });

test('原始解析度：載入 + 旋轉 + 贏分', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);

  // 截圖 1：idle 狀態
  await page.screenshot({ path: 'e2e/screenshots/full-01-idle.png' });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // 旋轉 3 次
  for (let i = 1; i <= 3; i++) {
    const spinX = box!.x + box!.width / 2;
    const spinY = box!.y + box!.height * 0.71; // SPIN 按鈕在 Y=1420/2000 ≈ 0.71
    await page.mouse.click(spinX, spinY);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `e2e/screenshots/full-02-spin${i}.png` });
  }

  // 印出所有 console log（找 balance/win 相關輸出）
  const relevant = logs.filter(l =>
    l.includes('balance') || l.includes('win') || l.includes('Balance') ||
    l.includes('載入') || l.includes('error') || l.includes('Error')
  );
  console.log('=== Relevant console logs ===');
  relevant.forEach(l => console.log(l));
});
