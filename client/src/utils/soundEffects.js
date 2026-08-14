// Web Audio API sound effect generator (zero external asset dependencies)

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

/**
 * Plays an incoming ringtone loop until stopped
 * @returns {Function} stopFunction
 */
export const playIncomingRingtone = () => {
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isPlaying = true;
  let timerId = null;

  const playToneBurst = () => {
    if (!isPlaying) return;

    try {
      const now = ctx.currentTime;

      // First beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.setValueAtTime(480, now + 0.1);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Second beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(440, now + 0.4);
      osc2.frequency.setValueAtTime(480, now + 0.5);
      gain2.gain.setValueAtTime(0.15, now + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.4);
      osc2.stop(now + 0.8);
    } catch {
      // Audio context might be blocked if user hasn't interacted yet
    }

    if (isPlaying) {
      timerId = setTimeout(playToneBurst, 2500);
    }
  };

  playToneBurst();

  return () => {
    isPlaying = false;
    if (timerId) clearTimeout(timerId);
  };
};

/**
 * Plays outgoing call ringing tone until stopped
 * @returns {Function} stopFunction
 */
export const playOutgoingRinging = () => {
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isPlaying = true;
  let timerId = null;

  const playPulse = () => {
    if (!isPlaying) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(425, now); // standard dial tone freq
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    } catch {
      // Audio context not ready
    }

    if (isPlaying) {
      timerId = setTimeout(playPulse, 3500);
    }
  };

  playPulse();

  return () => {
    isPlaying = false;
    if (timerId) clearTimeout(timerId);
  };
};

/**
 * Plays call ended chime
 */
export const playCallEndedTone = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(360, now + 0.15);
    osc.frequency.setValueAtTime(240, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    // Ignore audio context errors
  }
};
