/**
 * Debug: 列出 stage 上的所有 Sprite/Container，找出中文覆蓋的來源
 */
import { test } from '@playwright/test';

test('dump stage children', async ({ page }) => {
  page.on('console', (msg) => console.log(`[browser] ${msg.text()}`));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  // 透過 PixiJS 內部 API 遍歷 stage 的所有 children
  const dump = await page.evaluate(() => {
    // @ts-ignore - access pixi app from global
    const app = (globalThis as any).__PIXI_APP__;
    if (!app) return 'No __PIXI_APP__ found. Need to expose it.';

    function walk(obj: any, depth: number = 0): string[] {
      const lines: string[] = [];
      const indent = '  '.repeat(depth);
      const type = obj.constructor?.name || 'Unknown';
      const vis = obj.visible ? 'V' : 'H';
      const pos = `(${Math.round(obj.x)},${Math.round(obj.y)})`;
      let extra = '';
      if (obj.texture?.label) extra = ` tex=${obj.texture.label}`;
      if (obj.text !== undefined) extra = ` text="${obj.text.substring(0, 40)}"`;
      if (obj.width && obj.height) extra += ` ${Math.round(obj.width)}x${Math.round(obj.height)}`;
      lines.push(`${indent}[${vis}] ${type} ${pos}${extra}`);
      if (obj.children) {
        for (const child of obj.children) {
          lines.push(...walk(child, depth + 1));
        }
      }
      return lines;
    }

    return walk(app.stage).join('\n');
  });

  console.log('=== STAGE DUMP ===');
  console.log(dump);
});
