/**
 * E2E 診斷腳本 — 用 Playwright 抓瀏覽器 console 和截圖
 */
import { chromium } from '@playwright/test';

const URL = 'http://localhost:4190/power-fortune/';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 450, height: 800 } });

  // 收集所有 console 訊息
  const logs = [];
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    logs.push(`[PAGE_ERROR] ${err.message}`);
  });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });

  // 等待 3 秒讓 PixiJS 初始化
  await page.waitForTimeout(3000);

  // 截圖
  await page.screenshot({ path: 'e2e-screenshot.png', fullPage: true });
  console.log('Screenshot saved: e2e-screenshot.png');

  // 抓取畫面上的 #status 文字
  const statusText = await page.textContent('#status').catch(() => 'N/A');
  console.log(`Status element text: "${statusText}"`);

  // 檢查是否有 canvas
  const canvasCount = await page.locator('canvas').count();
  console.log(`Canvas elements: ${canvasCount}`);

  // 輸出所有 console logs
  console.log('\n=== BROWSER CONSOLE ===');
  for (const l of logs) {
    console.log(l);
  }
  console.log('=== END ===\n');

  await browser.close();
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
