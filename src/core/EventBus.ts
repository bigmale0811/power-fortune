/**
 * EventBus — 全域事件發佈/訂閱系統
 *
 * 遊戲各模組間的解耦通訊管道。
 * 不可變模式：回傳新的 listener 清單而非修改原始陣列。
 */

export type EventCallback = (...args: unknown[]) => void;

interface ListenerEntry {
  readonly callback: EventCallback;
  readonly once: boolean;
}

export class EventBus {
  private listeners: ReadonlyMap<string, readonly ListenerEntry[]> = new Map();

  /** 訂閱事件 */
  on(event: string, callback: EventCallback): void {
    const current = this.getListeners(event);
    const entry: ListenerEntry = Object.freeze({ callback, once: false });
    this.listeners = new Map([...this.listeners, [event, [...current, entry]]]);
  }

  /** 一次性訂閱（觸發一次後自動移除） */
  once(event: string, callback: EventCallback): void {
    const current = this.getListeners(event);
    const entry: ListenerEntry = Object.freeze({ callback, once: true });
    this.listeners = new Map([...this.listeners, [event, [...current, entry]]]);
  }

  /** 取消訂閱 */
  off(event: string, callback: EventCallback): void {
    const current = this.getListeners(event);
    const filtered = current.filter((entry) => entry.callback !== callback);
    this.listeners = new Map([...this.listeners, [event, filtered]]);
  }

  /** 發送事件 */
  emit(event: string, ...args: unknown[]): void {
    const current = this.getListeners(event);
    if (current.length === 0) return;

    // 收集需要移除的 once listener
    const remaining = current.filter((entry) => {
      entry.callback(...args);
      return !entry.once;
    });

    this.listeners = new Map([...this.listeners, [event, remaining]]);
  }

  /** 移除指定事件的所有監聽器 */
  removeAll(event?: string): void {
    if (event === undefined) {
      this.listeners = new Map();
    } else {
      const updated = new Map(this.listeners);
      updated.delete(event);
      this.listeners = updated;
    }
  }

  /** 取得指定事件的監聽器數量 */
  listenerCount(event: string): number {
    return this.getListeners(event).length;
  }

  private getListeners(event: string): readonly ListenerEntry[] {
    return this.listeners.get(event) ?? [];
  }
}

/** 全域單例 */
export const globalEventBus = new EventBus();
