/**
 * SceneManager — 場景堆疊管理器
 *
 * 管理 BaseGame / FreeGame / MiniGame / Loading 等場景的切換。
 * 支援 push/pop 堆疊模式（MiniGame 可疊在 BaseGame 上）。
 */
import { Container } from 'pixi.js';

/** 場景介面：所有場景必須實作 */
export interface IScene {
  /** 場景唯一名稱 */
  readonly name: string;
  /** PixiJS 根容器 */
  readonly container: Container;
  /** 進入場景時呼叫 */
  enter(): void | Promise<void>;
  /** 每幀更新（delta 為毫秒） */
  update(delta: number): void;
  /** 離開場景時呼叫 */
  exit(): void | Promise<void>;
}

export class SceneManager {
  private readonly stage: Container;
  private readonly stack: IScene[] = [];

  constructor(stage: Container) {
    this.stage = stage;
  }

  /** 目前頂層場景 */
  get current(): IScene | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /** 場景堆疊深度 */
  get depth(): number {
    return this.stack.length;
  }

  /** 推入新場景（保留底層場景） */
  async push(scene: IScene): Promise<void> {
    // 暫停當前場景（但不移除）
    const currentScene = this.current;
    if (currentScene) {
      currentScene.container.visible = false;
    }

    this.stack.push(scene);
    this.stage.addChild(scene.container);
    await scene.enter();
  }

  /** 彈出頂層場景，恢復下層場景 */
  async pop(): Promise<IScene | null> {
    const scene = this.stack.pop() ?? null;
    if (scene) {
      await scene.exit();
      this.stage.removeChild(scene.container);
    }

    // 恢復新的頂層場景
    const newTop = this.current;
    if (newTop) {
      newTop.container.visible = true;
    }

    return scene;
  }

  /** 切換場景（清空堆疊後推入新場景） */
  async switchTo(scene: IScene): Promise<void> {
    // 依序彈出所有場景
    while (this.stack.length > 0) {
      await this.pop();
    }
    await this.push(scene);
  }

  /** 每幀更新頂層場景 */
  update(delta: number): void {
    const scene = this.current;
    if (scene) {
      scene.update(delta);
    }
  }
}
