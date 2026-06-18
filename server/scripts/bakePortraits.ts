import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAllPlayers, nameSlug, TEAMS, type PlayerSeed } from '../src/data/roster';

// Generate one portrait per player into web/public/players/<slug>.jpg.
// Providers:
//   pollinations (default, free)  – uses flux-realism, no key needed
//   dalle                         – DALL-E 3 via OPENAI_API_KEY, best quality
//   openai                        – gpt-image-1 via OPENAI_API_KEY
// Resumable: existing files are skipped, so a re-run only fills gaps.

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/public/players');
const PROVIDER = process.env.IMAGE_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'dalle' : 'pollinations');
const CONCURRENCY = Number(process.env.BAKE_CONCURRENCY ?? 1);
// Minimum gap between requests per worker — keeps Pollinations happy on the free tier
const DELAY_MS = Number(process.env.BAKE_DELAY_MS ?? 4000);

const POSITION_TITLE: Record<string, string> = {
  QB: 'quarterback',
  RB: 'running back',
  WR: 'wide receiver',
  TE: 'tight end',
};

const ETHNICITIES = ['Black', 'white', 'Latino', 'Samoan', 'mixed race', 'Pacific Islander'];

const TEAM_BY_ABBR = new Map(TEAMS.map((t) => [t.abbreviation, t]));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Image models follow named colors far better than hex, so translate the team's
// hex into a human color name via HSL buckets.
function hexToColorName(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'team-colored';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 0.08) {
    if (l < 0.2) return 'black';
    if (l < 0.45) return 'charcoal gray';
    if (l < 0.7) return 'gray';
    return 'white';
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const dark = l < 0.4;
  const muted = s < 0.4;
  if (h < 15 || h >= 345) return dark ? 'dark red' : 'red';
  if (h < 40) return dark ? 'burnt orange' : 'orange';
  if (h < 55) return muted ? 'tan' : dark ? 'amber' : 'gold';
  if (h < 70) return 'yellow';
  if (h < 160) return dark ? 'dark green' : 'green';
  if (h < 200) return 'teal';
  if (h < 250) return dark ? 'navy blue' : 'blue';
  if (h < 290) return dark ? 'deep purple' : 'purple';
  return dark ? 'maroon' : 'pink';
}

function promptFor(p: PlayerSeed): string {
  const eth = ETHNICITIES[hash(p.name + 'E') % ETHNICITIES.length];
  const age = 22 + (hash(p.name + 'A') % 12);
  const title = POSITION_TITLE[p.position] ?? 'player';
  const team = TEAM_BY_ABBR.get(p.teamAbbr);
  const primary = team ? hexToColorName(team.primaryColor) : 'team-colored';
  const secondary = team ? hexToColorName(team.secondaryColor) : 'dark';
  // Prompt tuned for a full-body clean studio cutout in team colors
  return (
    `full-body studio photograph of a ${age}-year-old ${eth} male NFL ${title}, ` +
    `standing three-quarter hero pose, full football uniform with ${primary} and ${secondary} team jersey, ` +
    `matching ${primary} helmet held under one arm, shoulder pads, athletic build, serious confident expression, ` +
    `entire body visible head to cleats, isolated on a seamless dark studio background, clean studio cutout, ` +
    `dramatic rim lighting, sharp focus, 8k ultra-detailed, shot on Canon EOS R5, 85mm f/1.4 lens, ` +
    `professional sports photography, no illustration, no cartoon, no painting, real human face`
  );
}

async function genDallE3(prompt: string): Promise<Buffer> {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, size: '1024x1792', quality: 'standard', response_format: 'b64_json', n: 1 }),
  });
  if (!r.ok) throw new Error(`dalle3 ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`);
  const j: any = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('dalle3: no image in response');
  return Buffer.from(b64, 'base64');
}

async function genOpenAI(prompt: string): Promise<Buffer> {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1536', n: 1 }),
  });
  if (!r.ok) throw new Error(`openai ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`);
  const j: any = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai: no image in response');
  return Buffer.from(b64, 'base64');
}

async function genPollinations(prompt: string, seed: number): Promise<Buffer> {
  // flux-realism produces photorealistic results vs plain flux which looks illustrated
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1152&seed=${seed}&nologo=true&model=flux-realism&enhance=true`;
  const r = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!r.ok) {
    // Surface the rate-limit delay hint if present
    const retryAfter = r.headers.get('retry-after');
    throw Object.assign(new Error(`pollinations ${r.status}`), { status: r.status, retryAfter: retryAfter ? Number(retryAfter) : null });
  }
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.startsWith('image')) throw new Error(`pollinations returned ${ct}`);
  return Buffer.from(await r.arrayBuffer());
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(p: PlayerSeed): Promise<Buffer> {
  const prompt = promptFor(p);
  const seed = hash(p.name) % 1_000_000;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      if (PROVIDER === 'openai') return await genOpenAI(prompt);
      if (PROVIDER === 'dalle') return await genDallE3(prompt);
      return await genPollinations(prompt, seed);
    } catch (e: any) {
      if (attempt === 5) throw e;
      // 429: respect retry-after or back off aggressively
      const wait = e.status === 429
        ? (e.retryAfter ? e.retryAfter * 1000 : 15_000 * (attempt + 1))
        : 3_000 * (attempt + 1);
      console.log(`    retry ${attempt + 1} for ${p.name} in ${wait / 1000}s (${e.message})`);
      await delay(wait);
    }
  }
  throw new Error('unreachable');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const players = buildAllPlayers();
  console.log(`Baking ${players.length} portraits via "${PROVIDER}" -> ${OUT}`);

  const queue = [...players];
  let baked = 0;
  let skipped = 0;
  let failed = 0;

  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      if (!p) break;
      const file = path.join(OUT, `${nameSlug(p.name)}.jpg`);
      if (fs.existsSync(file) && fs.statSync(file).size > 4000) {
        skipped++;
        continue;
      }
      try {
        fs.writeFileSync(file, await generate(p));
        baked++;
        if ((baked + skipped) % 10 === 0 || baked <= 5)
          console.log(`  ${baked + skipped}/${players.length} (baked ${baked}, skipped ${skipped})`);
      } catch (e) {
        failed++;
        console.error(`  FAILED ${p.name}: ${(e as Error).message ?? e}`);
      }
      // Throttle between requests so Pollinations free tier doesn't 429
      if (PROVIDER === 'pollinations') await delay(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. baked=${baked} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
