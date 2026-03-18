/**
 * reel 模組共用型別定義
 *
 * 抽離至獨立檔案以避免循環依賴。
 */

/**
 * ReadonlyMap — TypeScript 不內建 ReadonlyMap，此處定義最小介面
 * 僅含讀取操作，防止外部意外修改
 */
export interface ReadonlyMap<K, V> {
  get(key: K): V | undefined;
  has(key: K): boolean;
  readonly size: number;
  entries(): IterableIterator<[K, V]>;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void;
  [Symbol.iterator](): IterableIterator<[K, V]>;
}
