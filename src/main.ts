/**
 * Power Fortune 財神報喜 — 主入口
 * 全部使用靜態 import，避免 Vite code-splitting TDZ 問題
 */
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { GameController } from './core/GameController';
import { PAY_TABLE } from './evaluation/PayTable';

async function bootstrap(): Promise<void> {
  const statusEl = document.getElementById('status');
  function log(msg: string): void {
    if (statusEl) statusEl.textContent = msg;
    if (import.meta.env.DEV) console.log(msg);
  }

  try {
    log('Initializing...');

    const app = new Application();
    await app.init({
      width: 900,
      height: 1600,
      backgroundColor: 0x1a0a2e,
      antialias: true,
    });

    document.body.appendChild(app.canvas);

    // 響應式縮放
    function resize(): void {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ratio = 900 / 1600;
      const vr = vw / vh;
      const w = vr > ratio ? vh * ratio : vw;
      const h = vr > ratio ? vh : vw / ratio;
      app.canvas.style.width = `${w}px`;
      app.canvas.style.height = `${h}px`;
    }
    window.addEventListener('resize', resize);
    resize();

    const W = 900;
    const ctrl = new GameController({
      initialBalance: 50000,
      betOptions: [10, 20, 50, 100, 200, 500],
      defaultBetIndex: 3,
    });

    // === 標題 ===
    const title = new Text({
      text: 'POWER FORTUNE',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 42, fill: 0xffcc00, fontWeight: 'bold' }),
    });
    title.anchor.set(0.5);
    title.x = W / 2;
    title.y = 60;
    app.stage.addChild(title);

    const sub = new Text({
      text: '財神報喜 — 1024 Ways to Win',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 20, fill: 0xaaaaaa }),
    });
    sub.anchor.set(0.5);
    sub.x = W / 2;
    sub.y = 110;
    app.stage.addChild(sub);

    // === 5×4 格線 ===
    const COLS = 5, ROWS = 4, CW = 150, CH = 150;
    const GX = (W - COLS * CW) / 2, GY = 250;
    const COLORS = [
      0xff4444, 0xffaa00, 0xff6600, 0xcc3333, 0x8b4513,
      0x4488ff, 0x44aaff, 0x44ccaa, 0x66cc66, 0x888888,
      0x666666, 0xddaa00, 0xff00ff, 0x00ff00, 0xffff00,
    ];

    const reelBg = new Graphics().rect(GX - 10, GY - 10, COLS * CW + 20, ROWS * CH + 20).fill(0x0d0520);
    app.stage.addChild(reelBg);

    const cells: { g: Graphics; t: Text }[][] = [];
    for (let c = 0; c < COLS; c++) {
      cells[c] = [];
      for (let r = 0; r < ROWS; r++) {
        const x = GX + c * CW + 2;
        const y = GY + r * CH + 2;
        const g = new Graphics().roundRect(x, y, CW - 4, CH - 4, 8).fill(0x333333);
        app.stage.addChild(g);
        const t = new Text({
          text: '?',
          style: new TextStyle({ fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold' }),
        });
        t.anchor.set(0.5);
        t.x = x + (CW - 4) / 2;
        t.y = y + (CH - 4) / 2;
        app.stage.addChild(t);
        cells[c][r] = { g, t };
      }
    }

    // === 控制面板 ===
    const panelY = GY + ROWS * CH + 40;

    const balText = new Text({
      text: `BALANCE: ${ctrl.balance.toLocaleString()}`,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 26, fill: 0xffffff }),
    });
    balText.x = 50; balText.y = panelY;
    app.stage.addChild(balText);

    const betText = new Text({
      text: `BET: ${ctrl.currentBet}`,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 26, fill: 0xffffff }),
    });
    betText.x = 400; betText.y = panelY;
    app.stage.addChild(betText);

    const winText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 48, fill: 0xffdd00, fontWeight: 'bold' }),
    });
    winText.anchor.set(0.5);
    winText.x = W / 2; winText.y = GY - 50;
    app.stage.addChild(winText);

    const msgText = new Text({
      text: 'Press SPIN to play!',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 22, fill: 0xffcc00 }),
    });
    msgText.anchor.set(0.5);
    msgText.x = W / 2; msgText.y = panelY + 200;
    app.stage.addChild(msgText);

    // === SPIN 按鈕 ===
    let spinning = false;
    const spinBtn = new Container();
    spinBtn.x = W / 2; spinBtn.y = panelY + 110;
    spinBtn.eventMode = 'static'; spinBtn.cursor = 'pointer';
    const btnBg = new Graphics().circle(0, 0, 60).fill(0x00cc44);
    spinBtn.addChild(btnBg);
    const btnTxt = new Text({
      text: 'SPIN',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 28, fill: 0xffffff, fontWeight: 'bold' }),
    });
    btnTxt.anchor.set(0.5);
    spinBtn.addChild(btnTxt);
    app.stage.addChild(spinBtn);

    // === BET +/- ===
    function makeBetBtn(label: string, bx: number): Container {
      const c = new Container();
      c.x = bx; c.y = panelY;
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.addChild(new Graphics().roundRect(-18, -2, 36, 36, 6).fill(0x555555));
      const tx = new Text({
        text: label,
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 26, fill: 0xffffff }),
      });
      tx.anchor.set(0.5); tx.y = 15;
      c.addChild(tx);
      app.stage.addChild(c);
      return c;
    }
    makeBetBtn('-', 360).on('pointerdown', () => {
      if (!spinning) { ctrl.decreaseBet(); betText.text = `BET: ${ctrl.currentBet}`; }
    });
    makeBetBtn('+', 560).on('pointerdown', () => {
      if (!spinning) { ctrl.increaseBet(); betText.text = `BET: ${ctrl.currentBet}`; }
    });

    // === SPIN 邏輯 ===
    spinBtn.on('pointerdown', () => {
      if (spinning) return;
      spinning = true;
      winText.text = '';
      msgText.text = 'Spinning...';
      btnBg.clear().circle(0, 0, 60).fill(0x666666);

      setTimeout(() => {
        const result = ctrl.spin();
        if (result) {
          for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
              const symId = result.gridResult.grid[c][r];
              const color = COLORS[symId] ?? 0x333333;
              const name = PAY_TABLE[symId]?.name ?? '?';
              const x = GX + c * CW + 2, y = GY + r * CH + 2;
              cells[c][r].g.clear().roundRect(x, y, CW - 4, CH - 4, 8).fill(color);
              cells[c][r].t.text = name;
            }
          }
          if (result.totalWin > 0) {
            winText.text = `WIN: ${result.totalWin.toLocaleString()}`;
            msgText.text = `${result.wins.length} winning way(s)!`;
          } else {
            winText.text = '';
            msgText.text = 'No win. Try again!';
          }
          if (result.triggerFreeGame) {
            msgText.text = `FREE GAME! (${result.scatterCount} Scatters)`;
          }
        } else {
          msgText.text = 'Insufficient balance!';
        }
        balText.text = `BALANCE: ${ctrl.balance.toLocaleString()}`;
        spinning = false;
        btnBg.clear().circle(0, 0, 60).fill(0x00cc44);
      }, 400);
    });

    // 成功 → 隱藏 status
    if (statusEl) statusEl.style.display = 'none';
    if (import.meta.env.DEV) console.log('[PowerFortune] Game ready!');

  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error('[PowerFortune]', msg);
    if (statusEl) {
      statusEl.style.color = '#ff4444';
      statusEl.textContent = `ERROR: ${msg}`;
    }
  }
}

bootstrap();
