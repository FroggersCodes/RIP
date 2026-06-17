import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAllPlayers, nameSlug, type PlayerSeed } from '../src/data/roster';

// Generate one portrait per player into web/public/players/<slug>.jpg.
// Default provider is keyless (pollinations); set OPENAI_API_KEY for gpt-image-1.
// Resumable: existing files are skipped, so a re-run only fills gaps.

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/public/players');
const PROVIDER = process.env.IMAGE_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'pollinations');
const CONCURRENCY = Number(process.env.BAKE_CONCURRENCY ?? 4);

const POSITION_TITLE: Record<string, string> = { QB: 'quarterback', RB: 'running back', WR: 'wide receiver', TE: 'tight end' };
const LOOKS = ['Black', 'white', 'Hispanic', 'Samoan', 'East Asian', 'South Asian'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function promptFor(p: PlayerSeed): string {
  const look = LOOKS[hash(p.name + 'L') % LOOKS.length];
  const age = 22 + (hash(p.name + 'A') % 13);
  const title = POSITION_TITLE[p.position] ?? 'player';
  return (
    `professional studio headshot portrait of a ${age} year old ${look} male american football ${title}, ` +
    `athletic build, neutral confident expression, plain dark charcoal studio background, dramatic rim lighting, ` +
    `photorealistic, sharp focus, 85mm`
  );
}

async function genOpenAI(prompt: string): Promise<Buffer> {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
  });
  if (!r.ok) throw new Error(`openai ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`);
  const j: any = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai: no image in response');
  return Buffer.from(b64, 'base64');
}

async function genPollinations(prompt: string, seed: number): Promise<Buffer> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=640&seed=${seed}&nologo=true&model=flux`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`pollinations ${r.status}`);
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.startsWith('image')) throw new Error(`pollinations returned ${ct}`);
  return Buffer.from(await r.arrayBuffer());
}

async function generate(p: PlayerSeed): Promise<Buffer> {
  const prompt = promptFor(p);
  const seed = hash(p.name) % 1_000_000;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return PROVIDER === 'openai' ? await genOpenAI(prompt) : await genPollinations(prompt, seed);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
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
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
        skipped++;
        continue;
      }
      try {
        fs.writeFileSync(file, await generate(p));
        baked++;
        if ((baked + skipped) % 20 === 0) console.log(`  ${baked + skipped}/${players.length} (baked ${baked}, skipped ${skipped})`);
      } catch (e) {
        failed++;
        console.error(`  FAILED ${p.name}: ${(e as Error).message ?? e}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. baked ${baked}, skipped ${skipped}, failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main();
