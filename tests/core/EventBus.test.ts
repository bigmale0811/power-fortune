/**
 * EventBus 單元測試
 * 覆蓋：on/off/once/emit/removeAll/listenerCount
 */
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';

describe('EventBus', () => {
  it('應該能訂閱並接收事件', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('spin', handler);
    bus.emit('spin', 100);

    expect(handler).toHaveBeenCalledWith(100);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('應該支援多個訂閱者', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('win', h1);
    bus.on('win', h2);
    bus.emit('win', 500);

    expect(h1).toHaveBeenCalledWith(500);
    expect(h2).toHaveBeenCalledWith(500);
  });

  it('off 應該移除指定的訂閱者', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('spin', handler);
    bus.off('spin', handler);
    bus.emit('spin');

    expect(handler).not.toHaveBeenCalled();
  });

  it('once 應該只觸發一次', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once('bonus', handler);
    bus.emit('bonus', 'grand');
    bus.emit('bonus', 'major');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('grand');
  });

  it('emit 不存在的事件不應報錯', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('removeAll 應該清除指定事件的所有監聽器', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('spin', h1);
    bus.on('spin', h2);
    bus.removeAll('spin');
    bus.emit('spin');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('removeAll 無參數應清除所有事件', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('spin', h1);
    bus.on('win', h2);
    bus.removeAll();
    bus.emit('spin');
    bus.emit('win');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('listenerCount 應返回正確數量', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    expect(bus.listenerCount('spin')).toBe(0);

    bus.on('spin', h1);
    expect(bus.listenerCount('spin')).toBe(1);

    bus.on('spin', h2);
    expect(bus.listenerCount('spin')).toBe(2);

    bus.off('spin', h1);
    expect(bus.listenerCount('spin')).toBe(1);
  });

  it('應該支援多參數傳遞', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('result', handler);
    bus.emit('result', 'win', 1000, { multiplier: 3 });

    expect(handler).toHaveBeenCalledWith('win', 1000, { multiplier: 3 });
  });
});
