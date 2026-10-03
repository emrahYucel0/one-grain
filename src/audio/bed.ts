/**
 * A rough three-act sound bed (ported as-is): a low drone for nature with filtered wind,
 * a slow industrial thump-and-hiss, and fast ticking for the chip. Built on first use only.
 */
export interface Bed {
  ctx: AudioContext;
  master: GainNode;
  nature: GainNode;
  wind: GainNode;
  windFilter: BiquadFilterNode;
  industry: GainNode;
  chip: GainNode;
  on: boolean;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = i % 2 ? w : last * 3.5; }
  return b;
}

export function createBed(): Bed | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const noise = noiseBuffer(ctx);

  const nature = ctx.createGain(); nature.gain.value = 0; nature.connect(master);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(nature);
  ([[55, 'sine', .5, 0], [82.4, 'triangle', .16, 5], [110.6, 'sine', .08, -7]] as const).forEach(([f, ty, g, dt]) => {
    const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = ty; o.frequency.value = f; o.detune.value = dt; gg.gain.value = g; o.connect(gg).connect(lp); o.start();
  });
  const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
  const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = .7;
  const wind = ctx.createGain(); wind.gain.value = 0; ns.connect(windFilter).connect(wind).connect(master); ns.start();
  const industry = ctx.createGain(); industry.gain.value = 0; industry.connect(master);
  const chip = ctx.createGain(); chip.gain.value = 0; chip.connect(master);
  const bed: Bed = { ctx, master, nature, wind, windFilter, industry, chip, on: false };

  // look-ahead scheduler for the rhythmic parts
  let nextPulse = ctx.currentTime + .1, nextTick = ctx.currentTime + .1;
  setInterval(() => {
    if (!bed.on) return;
    const ahead = ctx.currentTime + .15;
    while (nextPulse < ahead) {
      const t = nextPulse; nextPulse += .72;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.8, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + .35); o.connect(g).connect(industry); o.start(t); o.stop(t + .4);
      const s = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), g2 = ctx.createGain(); s.buffer = noise; bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 9;
      g2.gain.setValueAtTime(.0001, t + .36); g2.gain.exponentialRampToValueAtTime(.5, t + .365); g2.gain.exponentialRampToValueAtTime(.0001, t + .43); s.connect(bf).connect(g2).connect(industry); s.start(t + .36, Math.random(), .1);
    }
    while (nextTick < ahead) {
      const t = nextTick; nextTick += .03 + Math.random() * .1;
      const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 6000;
      g.gain.setValueAtTime(.4, t); g.gain.exponentialRampToValueAtTime(.0001, t + .022); s.connect(hp).connect(g).connect(chip); s.start(t, Math.random() * 1.5, .03);
    }
  }, 50);
  return bed;
}
