/**
 * StateMachine — 泛型有限狀態機
 *
 * 管理遊戲流程狀態：IDLE → SPINNING → EVALUATING → ANIMATING → IDLE
 * 支援自訂轉換規則與 enter/exit 回調。
 */

export interface StateTransition<S extends string> {
  readonly from: S;
  readonly to: S;
}

export interface StateConfig<S extends string> {
  readonly initial: S;
  readonly transitions: readonly StateTransition<S>[];
}

export type StateCallback<S extends string> = (from: S, to: S) => void;

export class StateMachine<S extends string> {
  private _current: S;
  private readonly _transitions: ReadonlyMap<S, ReadonlySet<S>>;
  private readonly _onEnter: Map<S, StateCallback<S>[]> = new Map();
  private readonly _onExit: Map<S, StateCallback<S>[]> = new Map();

  constructor(config: StateConfig<S>) {
    this._current = config.initial;

    // 建立轉換表：from → Set<to>
    const transMap = new Map<S, Set<S>>();
    for (const t of config.transitions) {
      const existing = transMap.get(t.from) ?? new Set();
      existing.add(t.to);
      transMap.set(t.from, existing);
    }
    this._transitions = transMap;
  }

  /** 目前狀態 */
  get current(): S {
    return this._current;
  }

  /** 嘗試轉換到目標狀態，回傳是否成功 */
  transition(to: S): boolean {
    if (!this.canTransition(to)) return false;

    const from = this._current;

    // 觸發 exit 回調
    const exitCallbacks = this._onExit.get(from) ?? [];
    for (const cb of exitCallbacks) cb(from, to);

    this._current = to;

    // 觸發 enter 回調
    const enterCallbacks = this._onEnter.get(to) ?? [];
    for (const cb of enterCallbacks) cb(from, to);

    return true;
  }

  /** 檢查是否可轉換到目標狀態 */
  canTransition(to: S): boolean {
    const allowed = this._transitions.get(this._current);
    return allowed !== undefined && allowed.has(to);
  }

  /** 取得目前狀態可前往的所有狀態 */
  availableTransitions(): readonly S[] {
    const allowed = this._transitions.get(this._current);
    return allowed ? [...allowed] : [];
  }

  /** 註冊進入狀態的回調 */
  onEnter(state: S, callback: StateCallback<S>): void {
    const callbacks = this._onEnter.get(state) ?? [];
    this._onEnter.set(state, [...callbacks, callback]);
  }

  /** 註冊離開狀態的回調 */
  onExit(state: S, callback: StateCallback<S>): void {
    const callbacks = this._onExit.get(state) ?? [];
    this._onExit.set(state, [...callbacks, callback]);
  }

  /** 強制重置到指定狀態（繞過轉換規則，僅供測試/錯誤恢復） */
  reset(state: S): void {
    this._current = state;
  }
}

/** 遊戲主迴圈狀態定義 */
export type GameState = 'IDLE' | 'SPINNING' | 'EVALUATING' | 'ANIMATING';

/** 建立遊戲主狀態機的工廠函式 */
export function createGameStateMachine(): StateMachine<GameState> {
  return new StateMachine<GameState>({
    initial: 'IDLE',
    transitions: [
      { from: 'IDLE', to: 'SPINNING' },
      { from: 'SPINNING', to: 'EVALUATING' },
      { from: 'EVALUATING', to: 'ANIMATING' },
      { from: 'EVALUATING', to: 'IDLE' },      // 無贏分時直接回 IDLE
      { from: 'ANIMATING', to: 'IDLE' },
    ],
  });
}
