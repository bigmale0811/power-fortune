/**
 * WebAudioFallback — Web Audio API 合成音效降級方案
 *
 * 當真實音效檔不存在時，使用 Web Audio API 即時合成基礎音效，
 * 確保遊戲在缺乏音效資源的情況下仍有基本的聽覺回饋。
 *
 * 適用場景：
 *   - 開發環境測試（尚未整合正式音效）
 *   - CDN 資源遺失的降級保護
 *   - 快速原型驗證
 *
 * 注意事項：
 *   - AudioContext 需要使用者互動後才能播放（瀏覽器 Autoplay Policy）
 *   - 所有音效均為純合成音（振盪器 + 增益），不依賴任何外部檔案
 *   - 呼叫 dispose() 釋放 AudioContext 資源
 */

// ─────────────────────── 型別定義 ───────────────────────

/** 音符頻率對照表（C4 ~ G4） */
const NOTE_FREQ: Readonly<Record<string, number>> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

/** 振盪器類型 */
type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// ─────────────────────── 實作 ───────────────────────

export class WebAudioFallback {
  /**
   * Web Audio API 上下文
   *
   * 延遲建立（首次呼叫播放方法時初始化），以符合瀏覽器 Autoplay Policy。
   * 初始化失敗（不支援的瀏覽器）時保持 null，所有播放操作靜默跳過。
   */
  private ctx: AudioContext | null;

  constructor() {
    // 嘗試建立 AudioContext；不支援的環境（如 Node.js 測試）保持 null
    try {
      // 部分瀏覽器使用 webkitAudioContext（舊版 Safari）
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      this.ctx = AudioCtx ? new AudioCtx() : null;
    } catch {
      this.ctx = null;
      console.warn('[WebAudioFallback] Web Audio API 不可用，音效降級停用');
    }
  }

  // ─────────────────────── 公開播放方法 ───────────────────────

  /**
   * 播放短促按鍵音（UI 點擊回饋）
   *
   * 1000 Hz 正弦波，持續 50ms，模擬按鈕點擊感。
   */
  playClick(): void {
    this.playTone({
      frequency: 1000,
      type: 'sine',
      durationMs: 50,
      peakVolume: 0.3,
      attackMs: 5,
      releaseMs: 20,
    });
  }

  /**
   * 播放小中獎音效（上升三音 C-E-G）
   *
   * 三個音符依序播放，帶有清脆感，適合小額贏分回饋。
   */
  playWin(): void {
    // C4 → E4 → G4 上升分解和弦
    const notes: Array<{ freq: number; delayMs: number }> = [
      { freq: NOTE_FREQ.C4, delayMs: 0 },
      { freq: NOTE_FREQ.E4, delayMs: 100 },
      { freq: NOTE_FREQ.G4, delayMs: 200 },
    ];

    for (const note of notes) {
      this.playToneDelayed({
        frequency: note.freq,
        type: 'triangle',
        durationMs: 150,
        peakVolume: 0.4,
        attackMs: 10,
        releaseMs: 80,
        delayMs: note.delayMs,
      });
    }
  }

  /**
   * 播放大中獎音效（較長的號角式上升音型）
   *
   * 5 個音符從 C4 升至 C5，帶有方波的厚重感，適合大額贏分。
   */
  playBigWin(): void {
    // C4 → E4 → G4 → B4 → C5 上行分解和弦
    const fanfareNotes: Array<{ freq: number; delayMs: number }> = [
      { freq: NOTE_FREQ.C4, delayMs: 0 },
      { freq: NOTE_FREQ.E4, delayMs: 120 },
      { freq: NOTE_FREQ.G4, delayMs: 240 },
      { freq: NOTE_FREQ.B4, delayMs: 360 },
      { freq: NOTE_FREQ.C5, delayMs: 480 },
    ];

    for (const note of fanfareNotes) {
      this.playToneDelayed({
        frequency: note.freq,
        type: 'square',
        durationMs: 200,
        peakVolume: 0.35,
        attackMs: 15,
        releaseMs: 100,
        delayMs: note.delayMs,
      });
    }

    // 最後加一個持續音強調結尾
    this.playToneDelayed({
      frequency: NOTE_FREQ.C5,
      type: 'sine',
      durationMs: 400,
      peakVolume: 0.5,
      attackMs: 20,
      releaseMs: 200,
      delayMs: 600,
    });
  }

  /**
   * 播放轉動音效（噪音掃頻，模擬轉軸旋轉感）
   *
   * 使用白噪音 + 短 decay，模擬快速轉動的「唰」聲。
   */
  playSpin(): void {
    if (!this.ctx) return;
    // 確保 AudioContext 已解鎖（首次使用者互動後）
    void this.ensureResumed();

    // 白噪音緩衝區（0.15 秒）
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 填充白噪音資料（隨機採樣）
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // 帶通濾波器讓噪音集中在中高頻，聽起來像氣流/轉軸
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime);
    // 快速衰減（0.15 秒內降至 0）
    gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(this.ctx.currentTime);
  }

  /**
   * 播放滾輪停止音效（低頻短促鈍音，模擬「扣」聲）
   *
   * 低頻振盪器快速衰減，模擬機械式定格的觸感。
   */
  playReelStop(): void {
    this.playTone({
      // 低頻（80 Hz）產生厚重的鈍擊感
      frequency: 80,
      type: 'triangle',
      durationMs: 120,
      peakVolume: 0.5,
      attackMs: 5,
      // 快速釋放（半衰期短）產生鈍擊而非持音
      releaseMs: 80,
    });
  }

  /**
   * 釋放 AudioContext 資源
   *
   * 應在遊戲銷毀或場景卸載時呼叫，防止資源洩漏。
   */
  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  // ─────────────────────── 私有工具 ───────────────────────

  /**
   * 通用音調播放（立即播放，無延遲）
   *
   * 建立振盪器 → 增益包絡（Attack / Sustain / Release）→ 輸出。
   * 使用線性斜坡（linearRampToValueAtTime）模擬自然音量包絡。
   *
   * @param opts - 播放參數
   */
  private playTone(opts: ToneOptions): void {
    if (!this.ctx) return;
    void this.ensureResumed();

    const now = this.ctx.currentTime;
    this.scheduleTone(opts, now);
  }

  /**
   * 延遲播放音調（用於分解和弦中的音符序列）
   *
   * @param opts - 播放參數（含 delayMs 欄位）
   */
  private playToneDelayed(opts: ToneOptions & { delayMs: number }): void {
    if (!this.ctx) return;
    void this.ensureResumed();

    const startTime = this.ctx.currentTime + opts.delayMs / 1000;
    this.scheduleTone(opts, startTime);
  }

  /**
   * 在指定時間點排程音調播放
   *
   * 音量包絡流程：
   *   t=startTime      → 音量從 0 開始（避免爆音）
   *   t+attackMs       → 音量達到 peakVolume（Attack 段）
   *   t+duration-relMs → 開始釋放（Sustain 段維持至此）
   *   t+duration       → 音量回到 0（Release 段）
   *
   * @param opts      - 播放參數
   * @param startTime - AudioContext 時間軸上的絕對開始時間（秒）
   */
  private scheduleTone(opts: ToneOptions, startTime: number): void {
    if (!this.ctx) return;

    const {
      frequency,
      type,
      durationMs,
      peakVolume,
      attackMs,
      releaseMs,
    } = opts;

    const durationSec = durationMs / 1000;
    const attackSec = attackMs / 1000;
    const releaseSec = releaseMs / 1000;

    // 建立振盪器
    const oscillator = this.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // 建立增益節點（音量包絡）
    const gainNode = this.ctx.createGain();

    // Attack：從 0 升至 peakVolume
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(
      peakVolume,
      startTime + attackSec,
    );

    // Sustain 段：保持 peakVolume（直到 Release 開始前）
    const releaseStartTime =
      startTime + durationSec - releaseSec;

    if (releaseStartTime > startTime + attackSec) {
      gainNode.gain.setValueAtTime(peakVolume, releaseStartTime);
    }

    // Release：從 peakVolume 降至 0
    gainNode.gain.linearRampToValueAtTime(
      0,
      startTime + durationSec,
    );

    // 節點連接：振盪器 → 增益 → 輸出
    oscillator.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // 排程播放與停止（自動釋放節點資源）
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSec);
  }

  /**
   * 確保 AudioContext 已從 suspended 狀態恢復
   *
   * 瀏覽器在未有使用者互動前會將 AudioContext 設定為 suspended。
   * 此方法在每次播放前呼叫，確保上下文處於 running 狀態。
   */
  private async ensureResumed(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}

// ─────────────────────── 內部型別 ───────────────────────

/** 音調播放參數 */
interface ToneOptions {
  /** 基礎頻率（Hz） */
  readonly frequency: number;
  /** 振盪器波形類型 */
  readonly type: OscType;
  /** 音符持續總時長（毫秒） */
  readonly durationMs: number;
  /** 峰值音量（0 ~ 1） */
  readonly peakVolume: number;
  /** Attack 時間（毫秒），音量從 0 升至峰值的時間 */
  readonly attackMs: number;
  /** Release 時間（毫秒），音量從峰值降至 0 的時間 */
  readonly releaseMs: number;
}
