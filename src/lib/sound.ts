// Web Audio API Synthesizer untuk efek suara game & musik latar ceria (Marimba Bouncy)
const MUSIC_MUTE_KEY = "tactiquiz_music_muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private outputNode: AudioNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex = 0;
  private isMusicMuted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMusicMuted = localStorage.getItem(MUSIC_MUTE_KEY) === "true";
    }
  }

  private getAudioGraph() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.outputNode) {
      // Compressor mencegah suara pecah/clipping saat nada bertumpuk pada volume tinggi
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.1, this.ctx.currentTime);
      compressor.connect(this.ctx.destination);
      this.outputNode = compressor;
    }
    return { ctx: this.ctx, out: this.outputNode };
  }

  // ==================== MUSIK LATAR CERIA (MARIMBA BOUNCY) ====================
  getMuted(): boolean {
    if (typeof window !== "undefined") {
      this.isMusicMuted = localStorage.getItem(MUSIC_MUTE_KEY) === "true";
    }
    return this.isMusicMuted;
  }

  toggleMute(): boolean {
    this.isMusicMuted = !this.getMuted();
    if (typeof window !== "undefined") {
      localStorage.setItem(MUSIC_MUTE_KEY, String(this.isMusicMuted));
    }

    if (this.isMusicMuted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this.isMusicMuted;
  }

  private playMarimbaNote(freq: number, duration = 0.3, volume = 0.24) {
    const audio = this.getAudioGraph();
    if (!audio || this.isMusicMuted) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    // Harmonik oktaf atas agar terdengar jelas di speaker kecil (HP/Laptop)
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(freq * 2, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.25, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(out);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + duration);
    overtone.stop(now + duration);
  }

  private playBouncyBass(freq: number) {
    const audio = this.getAudioGraph();
    if (!audio || this.isMusicMuted) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  startMusic() {
    if (typeof window === "undefined") return;
    if (this.getMuted() || this.musicTimer) return;

    const N = {
      C3: 130.81,
      F3: 174.61,
      G3: 196.0,
      A3: 220.0,
      A4: 440.0,
      B4: 493.88,
      C5: 523.25,
      D5: 587.33,
      E5: 659.25,
      F5: 698.46,
      G5: 783.99,
      A5: 880.0,
    };

    const melodyPattern: number[] = [
      N.E5,
      0,
      N.G5,
      N.E5,
      N.C5,
      N.D5,
      N.E5,
      0,
      N.D5,
      0,
      N.G5,
      N.D5,
      N.B4,
      N.C5,
      N.D5,
      0,
      N.C5,
      0,
      N.E5,
      N.C5,
      N.A4,
      N.B4,
      N.C5,
      N.E5,
      N.F5,
      N.E5,
      N.D5,
      N.C5,
      N.D5,
      0,
      N.G5,
      0,
    ];

    const bassPattern: Record<number, number> = {
      0: N.C3,
      4: N.G3,
      8: N.G3,
      12: N.D5 / 2,
      16: N.A3,
      20: N.E5 / 2,
      24: N.F3,
      28: N.G3,
    };

    const playStep = () => {
      if (this.isMusicMuted) return;
      const idx = this.stepIndex % melodyPattern.length;

      const bassFreq = bassPattern[idx];
      if (bassFreq) {
        this.playBouncyBass(bassFreq);
      }

      const noteFreq = melodyPattern[idx];
      if (noteFreq > 0) {
        this.playMarimbaNote(noteFreq, 0.3, 0.24);
      }

      this.stepIndex++;
    };

    playStep();
    this.musicTimer = setInterval(playStep, 230);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // ==================== EFEK SUARA GAMEPLAY ====================
  playMove() {
    const audio = this.getAudioGraph();
    if (!audio) return;
    const { ctx, out } = audio;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(out);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playCorrect() {
    const audio = this.getAudioGraph();
    if (!audio) return;
    const { ctx, out } = audio;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.32, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.06 + 0.22,
      );
      osc.connect(gain);
      gain.connect(out);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.22);
    });
  }

  playWrong() {
    const audio = this.getAudioGraph();
    if (!audio) return;
    const { ctx, out } = audio;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(out);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  playPowerUp() {
    const audio = this.getAudioGraph();
    if (!audio) return;
    const { ctx, out } = audio;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.32, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(out);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
}

export const sound = new SoundEngine();
