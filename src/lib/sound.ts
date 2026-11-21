"use client";

const MUTE_STORAGE_KEY = "tactiquiz_muted";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterOutput: AudioNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime: number = 0;
  private noteStep: number = 0;
  private loadedMutePref: boolean = false;
  private unlockHandler: (() => void) | null = null;

  private ensureMuteLoaded() {
    if (this.loadedMutePref || typeof window === "undefined") return;
    this.loadedMutePref = true;
    try {
      const saved = localStorage.getItem(MUTE_STORAGE_KEY);
      if (saved === "true") {
        this.isMuted = true;
      }
    } catch {
      // abaikan jika storage diblokir
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    this.ensureMuteLoaded();

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Compressor + Master Gain agar suara lantang di speaker kelas tanpa pecah
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
        compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
        compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(1.25, this.ctx.currentTime);

        compressor.connect(masterGain);
        masterGain.connect(this.ctx.destination);
        this.masterOutput = compressor;
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private getDestination(ctx: AudioContext): AudioNode {
    return this.masterOutput || ctx.destination;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private attachAutoUnlock() {
    if (typeof window === "undefined" || this.unlockHandler) return;

    this.unlockHandler = () => {
      const ctx = this.getContext();
      if (ctx && ctx.state === "running") {
        this.detachAutoUnlock();
      }
    };

    window.addEventListener("pointerdown", this.unlockHandler, {
      passive: true,
    });
    window.addEventListener("keydown", this.unlockHandler, { passive: true });
  }

  private detachAutoUnlock() {
    if (typeof window === "undefined" || !this.unlockHandler) return;
    window.removeEventListener("pointerdown", this.unlockHandler);
    window.removeEventListener("keydown", this.unlockHandler);
    this.unlockHandler = null;
  }

  private scheduleOscillator(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "triangle",
    volume: number = 0.35,
    slideToFreq?: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        slideToFreq,
        startTime + duration,
      );
    }

    const attackEnd = startTime + Math.min(0.015, duration * 0.2);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.getDestination(ctx));

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private scheduleHiHat(ctx: AudioContext, startTime: number, volume: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDestination(ctx));

    noise.start(startTime);
    noise.stop(startTime + 0.04);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.35,
    delay: number = 0,
    slideToFreq?: number,
  ) {
    this.ensureMuteLoaded();
    if (this.isMuted) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delay;
    this.scheduleOscillator(
      ctx,
      freq,
      startTime,
      duration,
      type,
      volume,
      slideToFreq,
    );
  }

  public playMove() {
    this.playTone(360, 0.09, "triangle", 0.38, 0, 520);
  }

  public playCorrect() {
    this.playTone(523.25, 0.13, "triangle", 0.42, 0);
    this.playTone(659.25, 0.13, "triangle", 0.42, 0.07);
    this.playTone(783.99, 0.15, "triangle", 0.45, 0.14);
    this.playTone(1046.5, 0.28, "triangle", 0.48, 0.21);
  }

  public playWrong() {
    this.playTone(240, 0.18, "sawtooth", 0.26, 0, 185);
    this.playTone(180, 0.26, "triangle", 0.36, 0.12, 135);
  }

  public playPowerUp() {
    this.playTone(440, 0.1, "triangle", 0.4, 0, 660);
    this.playTone(660, 0.12, "triangle", 0.4, 0.06, 880);
    this.playTone(987.77, 0.22, "triangle", 0.45, 0.12, 1318.5);
  }

  public playTick() {
    this.playTone(920, 0.06, "triangle", 0.42, 0, 640);
  }

  public playFanfare() {
    const notes = [
      { f: 523.25, d: 0.14, t: 0 },
      { f: 523.25, d: 0.14, t: 0.14 },
      { f: 523.25, d: 0.14, t: 0.28 },
      { f: 659.25, d: 0.32, t: 0.44 },
      { f: 587.33, d: 0.22, t: 0.76 },
      { f: 659.25, d: 0.22, t: 0.98 },
      { f: 783.99, d: 0.5, t: 1.2 },
    ];
    notes.forEach((n) => {
      this.playTone(n.f, n.d, "triangle", 0.48, n.t);
    });
  }

  // Musik latar upbeat 158 BPM dengan volume bertenaga & anti-kesendat
  public startMusic() {
    this.ensureMuteLoaded();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.nextNoteTime = 0;
    this.attachAutoUnlock();

    const leadMelody: (number | null)[] = [
      // Bar 1 (C Major)
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 523.25,
      // Bar 2 (G Major)
      587.33, 783.99, 987.77, 783.99, 880.0, 783.99, 659.25, 587.33,
      // Bar 3 (A Minor)
      523.25, 659.25, 880.0, 1046.5, 880.0, 783.99, 659.25, 523.25,
      // Bar 4 (F -> G turnaround)
      587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33, 783.99,
    ];

    const bassLine: number[] = [
      130.81, 261.63, 130.81, 261.63, 130.81, 261.63, 164.81, 196.0, 98.0,
      196.0, 98.0, 196.0, 98.0, 196.0, 123.47, 146.83, 110.0, 220.0, 110.0,
      220.0, 110.0, 220.0, 130.81, 164.81, 87.31, 174.61, 87.31, 174.61, 98.0,
      196.0, 123.47, 146.83,
    ];

    const TEMPO_STEP_SEC = 0.19;
    const LOOKAHEAD_SEC = 0.25;

    const scheduleAhead = () => {
      if (!this.isMusicPlaying || this.isMuted) {
        this.nextNoteTime = 0;
        return;
      }

      const ctx = this.getContext();
      if (!ctx || ctx.state !== "running") {
        this.nextNoteTime = 0;
        return;
      }

      if (this.nextNoteTime < ctx.currentTime) {
        this.nextNoteTime = ctx.currentTime + 0.04;
      }

      while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_SEC) {
        const idx = this.noteStep % leadMelody.length;
        const leadFreq = leadMelody[idx];
        const bassFreq = bassLine[idx];

        // Lead synth ceria (volume dinaikkan)
        if (leadFreq) {
          this.scheduleOscillator(
            ctx,
            leadFreq,
            this.nextNoteTime,
            0.15,
            "triangle",
            0.18,
          );
        }

        // Bassline aktif (volume dinaikkan agar terasa nendang)
        this.scheduleOscillator(
          ctx,
          bassFreq,
          this.nextNoteTime,
          0.16,
          "triangle",
          0.22,
        );

        // Hi-hat perkusi di ketukan ganjil
        if (idx % 2 === 1) {
          this.scheduleHiHat(ctx, this.nextNoteTime, 0.065);
        }

        this.nextNoteTime += TEMPO_STEP_SEC;
        this.noteStep++;
      }
    };

    scheduleAhead();
    this.musicTimer = setInterval(scheduleAhead, 80);
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    this.nextNoteTime = 0;
    this.detachAutoUnlock();
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public getMuted(): boolean {
    this.ensureMuteLoaded();
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.ensureMuteLoaded();
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(this.isMuted));
    } catch {
      // abaikan
    }

    if (this.isMuted) {
      this.nextNoteTime = 0;
    } else if (this.isMusicPlaying) {
      this.getContext();
    }

    return this.isMuted;
  }
}

export const sound = new SoundEngine();
