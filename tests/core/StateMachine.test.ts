/**
 * StateMachine 單元測試
 * 覆蓋：狀態轉換、非法轉換拒絕、onEnter/onExit、工廠函式
 */
import { describe, it, expect, vi } from 'vitest';
import { StateMachine, createGameStateMachine } from '@/core/StateMachine';

describe('StateMachine', () => {
  function createSimpleFSM() {
    return new StateMachine<'A' | 'B' | 'C'>({
      initial: 'A',
      transitions: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    });
  }

  it('初始狀態應正確', () => {
    const fsm = createSimpleFSM();
    expect(fsm.current).toBe('A');
  });

  it('合法轉換應成功', () => {
    const fsm = createSimpleFSM();
    const result = fsm.transition('B');
    expect(result).toBe(true);
    expect(fsm.current).toBe('B');
  });

  it('非法轉換應失敗且狀態不變', () => {
    const fsm = createSimpleFSM();
    const result = fsm.transition('C'); // A → C 不允許
    expect(result).toBe(false);
    expect(fsm.current).toBe('A');
  });

  it('canTransition 應正確判斷', () => {
    const fsm = createSimpleFSM();
    expect(fsm.canTransition('B')).toBe(true);
    expect(fsm.canTransition('C')).toBe(false);
  });

  it('availableTransitions 應回傳可轉換列表', () => {
    const fsm = createSimpleFSM();
    expect(fsm.availableTransitions()).toEqual(['B']);
  });

  it('onEnter 回調應在進入時觸發', () => {
    const fsm = createSimpleFSM();
    const enterB = vi.fn();
    fsm.onEnter('B', enterB);

    fsm.transition('B');

    expect(enterB).toHaveBeenCalledWith('A', 'B');
  });

  it('onExit 回調應在離開時觸發', () => {
    const fsm = createSimpleFSM();
    const exitA = vi.fn();
    fsm.onExit('A', exitA);

    fsm.transition('B');

    expect(exitA).toHaveBeenCalledWith('A', 'B');
  });

  it('onEnter/onExit 執行順序：先 exit 後 enter', () => {
    const fsm = createSimpleFSM();
    const order: string[] = [];

    fsm.onExit('A', () => order.push('exit-A'));
    fsm.onEnter('B', () => order.push('enter-B'));

    fsm.transition('B');

    expect(order).toEqual(['exit-A', 'enter-B']);
  });

  it('reset 應強制設定狀態', () => {
    const fsm = createSimpleFSM();
    fsm.reset('C');
    expect(fsm.current).toBe('C');
  });
});

describe('createGameStateMachine', () => {
  it('初始狀態為 IDLE', () => {
    const gsm = createGameStateMachine();
    expect(gsm.current).toBe('IDLE');
  });

  it('完整遊戲循環：IDLE→SPINNING→EVALUATING→ANIMATING→IDLE', () => {
    const gsm = createGameStateMachine();

    expect(gsm.transition('SPINNING')).toBe(true);
    expect(gsm.transition('EVALUATING')).toBe(true);
    expect(gsm.transition('ANIMATING')).toBe(true);
    expect(gsm.transition('IDLE')).toBe(true);
  });

  it('無贏分路徑：EVALUATING 可直接回 IDLE', () => {
    const gsm = createGameStateMachine();

    gsm.transition('SPINNING');
    gsm.transition('EVALUATING');
    expect(gsm.transition('IDLE')).toBe(true);
  });

  it('IDLE 不可直接到 EVALUATING', () => {
    const gsm = createGameStateMachine();
    expect(gsm.transition('EVALUATING')).toBe(false);
  });

  it('SPINNING 不可回到 IDLE', () => {
    const gsm = createGameStateMachine();
    gsm.transition('SPINNING');
    expect(gsm.transition('IDLE')).toBe(false);
  });
});
