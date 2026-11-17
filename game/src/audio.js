// Synthesized sound: no audio files, everything is built from oscillators
// and filtered noise through the Web Audio API. Created lazily on the first
// user gesture, so browsers never block it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.22;
    },
    isMuted() { return muted; },
    /** Continuous engine hum: speed 0..1. Call every frame while driving. */
    engine(speed) {
      if (!ensure() || muted) return;
      engineGain.gain.value = speed > 0.02 ? 0.05 + speed * 0.05 : 0;
      engineOsc.frequency.value = 46 + speed * 130;
    },
    /** Siren while police are close; the two-tone wail alternates by time. */
    siren(active, now) {
      if (!ensure()) return;
      sirenOn = active;
      if (!active || muted) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenGain.gain.value = 0.035;
      sirenOsc.frequency.value = Math.floor(now * 2) % 2 === 0 ? 715 : 960;
    },
    shoot() { noiseBurst(0.09, 0.5, 2600); blip(190, 0.08, 'square', 0.22, 70); },
    crash() { noiseBurst(0.22, 0.55, 420); blip(90, 0.2, 'sine', 0.4, 45); },
    pickup() { blip(660, 0.1, 'sine', 0.3, 990); },
    coin() { blip(880, 0.09, 'sine', 0.25, 1320); },
    wanted() { blip(220, 0.16, 'square', 0.25, 165); blip(165, 0.22, 'square', 0.25, 110); },
    mission() {
      blip(523, 0.12, 'sine', 0.3);
      setTimeout(() => blip(659, 0.12, 'sine', 0.3), 110);
      setTimeout(() => blip(784, 0.2, 'sine', 0.3), 220);
    },
    denied() { blip(140, 0.14, 'square', 0.22, 110); },
  };
}
