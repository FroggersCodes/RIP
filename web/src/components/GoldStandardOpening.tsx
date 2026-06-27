/* eslint-disable @typescript-eslint/no-explicit-any */
// Gold Standard — pack-opening cinematic.
//
// A 3D CSS gold box hinges open and a sealed foil pack levitates out on a
// rising cloud of gold dust before the box drops away. Ported from a
// standalone timeline-driven scene (Stage/useTime/interpolate) into a
// self-contained, one-shot React component: it runs its own rAF clock, scales
// the hand-tuned 1280×720 scene to fit the overlay, and calls onDone() when the
// cinematic finishes (or the moment the viewer taps to skip). RipReveal plays
// it for the Gold Standard set in place of the tap-to-rip pack stage, the same
// way the Reliquary briefcase cinematic precedes its reveal.
//
// The scene art is intentionally raw inline styles / hex / px — every transform
// is composed in 1280×720 space, so the coordinates must not be "cleaned up".
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: ReactNode;
  onDone: () => void;
}

// ── Timeline math (only the easings this scene uses) ─────────────────────────
const Easing = {
  linear: (t: number) => t,
  easeInCubic: (t: number) => t * t * t,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// interpolate([0, 0.5, 1], [0, 100, 50], ease?) -> fn(t): piecewise tween.
function interpolate(input: number[], output: number[], ease: (t: number) => number = Easing.linear) {
  return (t: number) => {
    if (t <= input[0]!) return output[0]!;
    if (t >= input[input.length - 1]!) return output[output.length - 1]!;
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i]! && t <= input[i + 1]!) {
        const span = input[i + 1]! - input[i]!;
        const local = span === 0 ? 0 : (t - input[i]!) / span;
        return output[i]! + (output[i + 1]! - output[i]!) * ease(local);
      }
    }
    return output[output.length - 1]!;
  };
}

// ── Palette / type ───────────────────────────────────────────────────────────
const GOLD = 'linear-gradient(100deg,#f9efc8,#e6c574,#b58a3b,#f4e3a6,#caa052,#fff3cf)';
const GOLD_BRIGHT = 'linear-gradient(100deg,#fff3cf,#f2d98f,#caa052,#fff7df,#e6c574)';
const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = "'Saira Condensed', system-ui, sans-serif";

const goldText = (grad = GOLD): CSSProperties => ({
  background: grad,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

// ── 3D face + cuboid primitives ─────────────────────────────────────────────
function Face({ w, h, transform, style = {}, children }: {
  w: number; h: number; transform: string; style?: CSSProperties; children?: ReactNode;
}) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: w, height: h,
      marginLeft: -w / 2, marginTop: -h / 2, transform,
      transformStyle: 'preserve-3d', backfaceVisibility: 'hidden',
      overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

function Cuboid({ w, h, d, faceStyle = {}, faces = {} }: {
  w: number; h: number; d: number;
  faceStyle?: Record<string, CSSProperties>;
  faces?: Record<string, ReactNode>;
}) {
  const out: ReactNode[] = [];
  const add = (name: string, fw: number, fh: number, transform: string, flip?: boolean) => {
    if (!faceStyle[name]) return;
    const doFlip = flip || name === 'back';
    const content = doFlip
      ? <div style={{ position: 'absolute', inset: 0, transform: 'scaleX(-1)' }}>{faces[name]}</div>
      : faces[name];
    out.push(<Face key={name} w={fw} h={fh} transform={transform} style={faceStyle[name]}>{content}</Face>);
  };
  add('front', w, h, `translateZ(${d / 2}px)`);
  add('back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`, true);
  add('right', d, h, `rotateY(90deg) translateZ(${w / 2}px)`);
  add('left', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`);
  add('top', w, d, `rotateX(90deg) translateZ(${h / 2}px)`);
  add('bottom', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`);
  return <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>{out}</div>;
}

// ── Gold frame overlay (echoes the card design) ─────────────────────────────
function GoldFrame({ radius = 22, bright = false, tabs = true }: {
  radius?: number; bright?: boolean; tabs?: boolean;
}) {
  const grad = bright
    ? 'linear-gradient(135deg,#8a6a2c,#f7e6ab,#b58a3b,#fff3cf,#7a6230) 1'
    : 'linear-gradient(135deg,#6e5829,#f1dca0,#7a6230,#d9b46b,#5a4a25) 1';
  const tabColor = bright ? 'linear-gradient(180deg,#fff3cf,#b58a3b)' : 'linear-gradient(180deg,#f1dca0,#9a7a36)';
  return (
    <>
      <div style={{ position: 'absolute', inset: 8, border: '1px solid', borderImage: grad, borderRadius: 4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 18, border: '2px solid', borderImage: grad, borderRadius: radius, pointerEvents: 'none', boxShadow: '0 0 10px rgba(202,165,92,.14)' }} />
      {tabs && (
        <>
          <div style={{ position: 'absolute', left: 32, top: 18, width: 1.5, height: 92, background: tabColor }} />
          <div style={{ position: 'absolute', left: 18, top: 110, width: 15, height: 1.5, background: tabColor }} />
          <div style={{ position: 'absolute', right: 32, bottom: 18, width: 1.5, height: 92, background: tabColor }} />
          <div style={{ position: 'absolute', right: 18, bottom: 110, width: 15, height: 1.5, background: tabColor }} />
        </>
      )}
    </>
  );
}

// ── Box body front decal ────────────────────────────────────────────────────
function BoxFront() {
  return (
    <>
      <GoldFrame radius={24} />
      <div style={{ position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 16, letterSpacing: '.4em', textIndent: '.4em', textTransform: 'uppercase', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))', ...goldText() }}>Gold Standard</div>
      <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', width: 118, height: 118, borderRadius: '50%', border: '2px solid rgba(236,213,160,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 22px rgba(202,165,92,.3), 0 0 20px rgba(202,165,92,.16)' }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 56, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.55))', ...goldText() }}>GS</span>
      </div>
      <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#9a854f' }}>Sealed &nbsp;·&nbsp; Football</div>
    </>
  );
}

function SideDecal() {
  return (
    <>
      <div style={{ position: 'absolute', top: 14, bottom: 14, left: 16, width: 1, background: 'linear-gradient(180deg,transparent,#9a7a36,transparent)' }} />
      <div style={{ position: 'absolute', top: 14, bottom: 14, right: 16, width: 1, background: 'linear-gradient(180deg,transparent,#9a7a36,transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 13, letterSpacing: '.5em', textIndent: '.5em', textTransform: 'uppercase', writingMode: 'vertical-rl', ...goldText() }}>Gold Standard</span>
      </div>
    </>
  );
}

function BoxBody() {
  const dark = 'linear-gradient(90deg,#0c0b08,#241f17 55%,#100d09)';
  return (
    <Cuboid
      w={300} h={430} d={140}
      faceStyle={{
        front: { background: 'radial-gradient(125% 95% at 50% 14%, #34302a 0%, #1a1712 55%, #0c0b08 100%)', boxShadow: 'inset 0 0 0 1px rgba(212,175,106,.3)' },
        back: { background: 'radial-gradient(125% 95% at 50% 14%, #34302a 0%, #1a1712 55%, #0c0b08 100%)', boxShadow: 'inset 0 0 0 1px rgba(212,175,106,.3)' },
        left: { background: dark, boxShadow: 'inset 0 0 0 1px rgba(212,175,106,.14)' },
        right: { background: dark, boxShadow: 'inset 0 0 0 1px rgba(212,175,106,.14)' },
        bottom: { background: '#040403' },
      }}
      faces={{ front: <BoxFront />, back: <BoxFront />, left: <SideDecal />, right: <SideDecal /> }}
    />
  );
}

// ── Lid ─────────────────────────────────────────────────────────────────────
function LidTop() {
  return (
    <>
      <GoldFrame radius={16} tabs={false} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg,transparent,#caa55c,transparent)' }} />
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, letterSpacing: '.42em', textIndent: '.42em', textTransform: 'uppercase', ...goldText() }}>Gold Standard</span>
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg,transparent,#caa55c,transparent)' }} />
      </div>
    </>
  );
}

function LidSkirt() {
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, height: 1, background: 'linear-gradient(90deg,transparent,#caa55c,transparent)' }} />;
}

function Lid() {
  const wall = 'linear-gradient(180deg,#1a1813,#0a0908)';
  return (
    <Cuboid
      w={316} h={70} d={156}
      faceStyle={{
        top: { background: 'radial-gradient(110% 130% at 50% 26%, #3a3527 0%, #14110b 72%)', boxShadow: 'inset 0 0 0 1px rgba(212,175,106,.32)' },
        front: { background: wall }, back: { background: wall },
        left: { background: 'linear-gradient(180deg,#15130e,#080706)' }, right: { background: 'linear-gradient(180deg,#15130e,#080706)' },
      }}
      faces={{ top: <LidTop />, front: <LidSkirt />, back: <LidSkirt />, left: <LidSkirt />, right: <LidSkirt /> }}
    />
  );
}

// ── Foil pack ───────────────────────────────────────────────────────────────
function crimp(w: number, teeth: number, h: number) {
  const pts = [`0,${h}`];
  for (let i = 0; i <= teeth; i++) {
    const x = (i * w / teeth).toFixed(1);
    const y = (i % 2 === 0 ? 0 : h * 0.6).toFixed(1);
    pts.push(`${x},${y}`);
  }
  pts.push(`${w},${h}`);
  return `polygon(${pts.join(' ')})`;
}

function PackFront({ w }: { w: number }) {
  return (
    <>
      {/* crimped foil seal top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: GOLD_BRIGHT, clipPath: crimp(w, 22, 22), opacity: .92 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, background: GOLD_BRIGHT, clipPath: crimp(w, 22, 18), transform: 'scaleY(-1)', opacity: .9 }} />
      {/* gold header band */}
      <div style={{ position: 'absolute', top: 40, left: 18, right: 18, height: 96, borderRadius: 4, background: GOLD, boxShadow: '0 4px 14px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, letterSpacing: '.26em', textIndent: '.26em', textTransform: 'uppercase', color: '#0b0a07' }}>Gold</span>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, letterSpacing: '.26em', textIndent: '.26em', textTransform: 'uppercase', color: '#0b0a07' }}>Standard</span>
      </div>
      {/* emblem */}
      <div style={{ position: 'absolute', left: '50%', top: '56%', transform: 'translate(-50%,-50%)', width: 96, height: 96, borderRadius: '50%', border: '1.5px solid rgba(236,213,160,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 20px rgba(202,165,92,.25)' }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 46, ...goldText(GOLD_BRIGHT) }}>GS</span>
      </div>
      <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 12, letterSpacing: '.36em', textTransform: 'uppercase', color: '#caa55c' }}>Football · 8 Cards</div>
    </>
  );
}

function Pack() {
  const w = 250, h = 392, d = 44;
  const side = 'linear-gradient(180deg,#3a2e15,#15110a)';
  return (
    <Cuboid
      w={w} h={h} d={d}
      faceStyle={{
        front: { background: 'radial-gradient(120% 80% at 50% 30%, #15140f 0%, #090806 70%)', boxShadow: 'inset 0 0 0 1px rgba(236,213,160,.25)' },
        back: { background: 'radial-gradient(120% 80% at 50% 30%, #15140f 0%, #090806 70%)' },
        left: { background: side }, right: { background: side },
        top: { background: GOLD_BRIGHT }, bottom: { background: 'linear-gradient(180deg,#2a2110,#0a0806)' },
      }}
      faces={{ front: <PackFront w={w} />, back: <PackFront w={w} /> }}
    />
  );
}

// ── Particles (gold dust rising during levitation) ──────────────────────────
function makeParticles(n: number) {
  let s = 1337;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => {
    const ang = rnd() * Math.PI * 2, rad = 40 + rnd() * 150;
    return {
      x: Math.cos(ang) * rad, z: Math.sin(ang) * rad,
      size: 2 + rnd() * 4, delay: rnd() * 0.7, rise: 240 + rnd() * 220,
      drift: (rnd() - .5) * 60, dur: 1.3 + rnd() * 0.9,
    };
  });
}
const PARTICLES = makeParticles(30);

function Particles({ t }: { t: number }) {
  const START = 2.3;
  return (
    <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>
      {PARTICLES.map((p, i) => {
        const lt = t - START - p.delay;
        if (lt < 0 || lt > p.dur) return null;
        const k = lt / p.dur;
        const y = 150 - k * p.rise;
        const op = Math.sin(Math.PI * k) * 0.9;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2,
            borderRadius: '50%', background: '#f4e3a6',
            boxShadow: '0 0 6px 1px rgba(236,213,160,.8)',
            opacity: op,
            transform: `translate3d(${p.x + p.drift * k}px, ${y}px, ${p.z}px)`,
          }} />
        );
      })}
    </div>
  );
}

// ── Scene ───────────────────────────────────────────────────────────────────
const E = Easing.easeInOutCubic;

function Scene({ t, title }: { t: number; title?: string }) {
  // Camera: low side angle → crane over the top → tilt back to hero 3/4.
  const rx = interpolate([0, 1.2, 2.8, 4.0, 5], [20, 23, 24, 26, 26], E)(t);
  const ry = interpolate([0, 1.5, 3.0, 4.0, 5], [-26, -18, -13, -12, -12], E)(t);
  const sc = interpolate([0, 1.0, 2.0, 2.8, 4.0, 5], [0.98, 1.0, 1.06, 1.04, 1.2, 1.2], E)(t);
  const follow = interpolate([0, 2.6, 4.0, 5], [8, 8, 306, 306], E)(t);

  // Lid: lifts straight up, then drifts + fades.
  const lidY = interpolate([0, 2.0, 2.7, 5], [0, 0, -300, -380], E)(t);
  const lidX = interpolate([2.0, 2.7, 5], [0, 0, 55], E)(t);
  const lidRot = interpolate([2.0, 2.7, 5], [0, 0, -13], E)(t);
  const lidOp = interpolate([2.0, 2.5, 3.3], [1, 1, 0])(t);

  // Pack: rises fully out, slow spin, glow, then holds.
  const packY = interpolate([0, 2.5, 4.0, 5], [0, 0, -300, -300], E)(t);
  const packSpin = interpolate([4.0, 5], [0, 30], Easing.easeInOutCubic)(t);
  const glow = interpolate([2.3, 3.4, 5], [0, 1, 1])(t);

  // Box drops straight down and tumbles off-screen once the pack has cleared it.
  const boxFall = interpolate([2.7, 4.6], [0, 1500], Easing.easeInCubic)(t);
  const boxTumble = interpolate([2.7, 4.6], [0, 18], Easing.easeInCubic)(t);
  const shadowOp = interpolate([2.7, 3.9], [1, 0])(t);

  // Light burst at the rim when the lid pops.
  const burst = interpolate([2.1, 2.7, 3.6], [0, 1, 0])(t);

  // 2D captions.
  const capIn = interpolate([0.3, 0.8, 1.3, 1.8], [0, 1, 1, 0])(t);

  const camera = `scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg)`;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      perspective: '1500px', perspectiveOrigin: '50% 40%',
      background: 'radial-gradient(120% 100% at 50% 12%, #2a2620 0%, #14110d 44%, #050403 100%)',
      fontFamily: SANS,
    }}>
      {/* Soft key light behind the subject */}
      <div style={{ position: 'absolute', left: '50%', top: '36%', width: 780, height: 640, transform: 'translate(-50%,-50%)', background: 'radial-gradient(closest-side, rgba(128,104,56,.24), rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
      {/* Camera rig (2D follow) */}
      <div style={{ position: 'absolute', left: 640, top: 360, transform: `translateY(${follow}px)` }}>
        <div style={{ transformStyle: 'preserve-3d', transform: camera }}>

          {/* Ground glow + contact shadow */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1100, height: 1100, marginLeft: -550, marginTop: -550, transform: 'translateY(215px) rotateX(90deg)', background: 'radial-gradient(closest-side, rgba(120,92,40,.28), rgba(0,0,0,0) 64%)', opacity: shadowOp }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 420, height: 300, marginLeft: -210, marginTop: -150, transform: 'translateY(214px) rotateX(90deg)', background: 'radial-gradient(closest-side, rgba(0,0,0,.6), rgba(0,0,0,0) 70%)', opacity: shadowOp }} />

          {/* Pack glow (behind pack) */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 560, height: 680, marginLeft: -280, marginTop: -340, transform: `translate3d(0, ${20 + packY}px, -30px)`, background: 'radial-gradient(closest-side, rgba(236,213,160,.45), rgba(236,213,160,0) 70%)', opacity: glow, pointerEvents: 'none' }} />

          {/* Pack */}
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `translateY(${20 + packY}px) rotateY(${packSpin}deg)` }}>
            <Pack />
          </div>

          {/* Box body (painted after pack so its walls occlude the part still inside) */}
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `translateY(${boxFall}px) rotateZ(${boxTumble}deg)` }}>
            <BoxBody />
          </div>

          {/* Rim light burst */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 360, height: 360, marginLeft: -180, marginTop: -180, transform: 'translateY(-215px) rotateX(90deg)', background: 'radial-gradient(closest-side, rgba(255,240,200,.85), rgba(255,240,200,0) 68%)', opacity: burst, pointerEvents: 'none' }} />

          {/* Particles */}
          <Particles t={t} />

          {/* Lid */}
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `translate3d(${lidX}px, ${-217 + lidY}px, 0) rotateZ(${lidRot}deg)`, opacity: lidOp }}>
            <Lid />
          </div>

        </div>
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 170px 24px rgba(0,0,0,.55)' }} />

      {/* Opening caption */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', opacity: capIn }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, letterSpacing: '.5em', textIndent: '.5em', textTransform: 'uppercase', ...goldText() }}>{title ?? 'Gold Standard'}</div>
        <div style={{ marginTop: 10, fontFamily: SANS, fontWeight: 600, fontSize: 12, letterSpacing: '.46em', textIndent: '.46em', textTransform: 'uppercase', color: '#7a6f52' }}>The Break</div>
      </div>
    </div>
  );
}

// The scene is composed in a fixed 1280×720 space (every transform is tuned to
// it), so we render it at that size and scale-to-fit the overlay rather than
// reflowing. DURATION matches the source timeline.
const STAGE_W = 1280;
const STAGE_H = 720;
const DURATION = 5;

export function GoldStandardOpening({ title, subtitle, onDone }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [t, setT] = useState(0);
  const doneRef = useRef(false);
  const rafRef = useRef(0);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onDone();
  };

  // Scale the 1280×720 stage to fit the overlay.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One-shot clock — plays the timeline once, then hands off to the reveal.
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (start == null) start = ts;
      const elapsed = (ts - start) / 1000;
      setT(elapsed);
      if (elapsed >= DURATION) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className="gs-open-stage"
      onClick={finish}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer', background: '#030302' }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: STAGE_W, height: STAGE_H,
        transform: `translate(-50%,-50%) scale(${scale})`,
        transformOrigin: 'center',
      }}>
        <Scene t={Math.min(t, DURATION)} title={title} />
      </div>
      {subtitle && (
        <div className="reveal-sub muted" style={{ position: 'absolute', left: 0, right: 0, top: 28, textAlign: 'center' }}>{subtitle}</div>
      )}
      <div className="gs-skip muted">tap to skip</div>
    </div>
  );
}
