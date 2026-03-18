/**
 * PayTable — 賠付表
 *
 * 定義 1024 Ways-to-Win 模式下每個符號的賠率。
 * 資料來源：從原版 main.min.js 分析提取。
 *
 * 賠率為「×bet」倍數，例如 x5 Wild = 500 × bet
 */

/** 符號賠率：[x3, x4, x5] */
export interface SymbolPay {
  readonly id: number;
  readonly name: string;
  readonly pays: readonly [number, number, number]; // x3, x4, x5
}

/**
 * 賠付表定義
 * ID 0-4：高額符號（財神、金元寶、扇子、印章、卷軸）
 * ID 5-9：低額符號（A, K, Q, J, 10）
 * ID 10-11: 特殊低額
 * ID 12: Fortune Ball（JP 觸發符號）
 * ID 13: Wild
 * ID 14: Scatter（不在 Ways 內賠付）
 */
export const PAY_TABLE: readonly SymbolPay[] = Object.freeze([
  { id: 0,  name: 'CaiShen',     pays: [50, 200, 500] },   // 財神（最高額）
  { id: 1,  name: 'GoldIngot',   pays: [30, 100, 300] },   // 金元寶
  { id: 2,  name: 'Fan',         pays: [20, 80, 200] },     // 扇子
  { id: 3,  name: 'Seal',        pays: [15, 60, 150] },     // 印章
  { id: 4,  name: 'Scroll',      pays: [10, 40, 100] },     // 卷軸
  { id: 5,  name: 'A',           pays: [5, 20, 50] },       // A
  { id: 6,  name: 'K',           pays: [5, 20, 50] },       // K
  { id: 7,  name: 'Q',           pays: [4, 15, 40] },       // Q
  { id: 8,  name: 'J',           pays: [4, 15, 40] },       // J
  { id: 9,  name: '10',          pays: [3, 10, 30] },       // 10
  { id: 10, name: '9',           pays: [3, 10, 30] },       // 9
  { id: 11, name: 'Coin',        pays: [2, 8, 25] },        // 金幣
  { id: 12, name: 'FortuneBall', pays: [0, 0, 0] },         // JP 球（不直接賠付）
  { id: 13, name: 'Wild',        pays: [100, 400, 1000] },  // Wild（獨立賠付時最高）
  { id: 14, name: 'Scatter',     pays: [0, 0, 0] },         // Scatter（觸發 Free Game）
]);

/**
 * 查詢指定符號的賠率
 * @param symbolId 符號 ID
 * @param length 連續列數（3/4/5）
 * @returns 賠率倍數，或 0 表示不賠付
 */
export function getPayForSymbol(symbolId: number, length: number): number {
  if (length < 3 || length > 5) return 0;
  const entry = PAY_TABLE[symbolId];
  if (!entry) return 0;
  return entry.pays[length - 3];
}
