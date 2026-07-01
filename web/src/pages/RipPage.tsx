import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { RipReveal, type RevealCard } from '../components/RipReveal';
import { PackArt } from '../components/PackArt';
import { money, num } from '../lib/format';
import type { Product, RipResult } from '../api/types';

export function RipPage() {
  const { user, setUser } = useAuth();
  const { data, loading } = useApi(() => api<{ products: Product[] }>('/products'), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealCard[] | null>(null);
  const [revealPackSize, setRevealPackSize] = useState(5);
  const [packName, setPackName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = data?.products ?? [];
  const sel = selected ? products.find((p) => p.id === selected) ?? null : null;

  const costLabel = (p: Product) =>
    p.gemCost > 0 ? `${num(p.gemCost)} 💎` : `${num(p.entryCost)} tokens${p.caseCost ? ` + ${p.caseCost} case` : ''}`;

  // Average pull rate per pack. Commons (>=1 expected per pack) show a count;
  // rarer cards show "1 : N packs". perPack is computed slot-exact server-side.
  const packRate = (perPack: number): string => {
    if (perPack <= 0) return '—';
    if (perPack >= 1) return `${perPack >= 1.95 ? Math.round(perPack) : perPack.toFixed(1)}/pack`;
    const oneIn = Math.round(1 / perPack);
    if (oneIn <= 1) return '~1/pack';
    return `1:${oneIn.toLocaleString()}`;
  };

  const rip = async () => {
    if (!sel) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<RipResult>('/rip', { method: 'POST', body: { productId: sel.id } });
      setUser(r.user);
      setPackName(r.product.name);
      setRevealPackSize(sel.packsPerBox > 1 ? sel.cardsPerPack : r.cards.length);
      setReveal(r.cards as RevealCard[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const isGem = !!sel && sel.gemCost > 0;
  const canAfford =
    !!sel &&
    !sel.soldOut &&
    (isGem
      ? (user?.gems ?? 0) >= sel.gemCost
      : (user?.tokens ?? 0) >= sel.entryCost && (user?.cases ?? 0) >= sel.caseCost);

  return (
    <>
      {reveal && (
        <RipReveal
          cards={reveal}
          packSize={revealPackSize}
          title={packName}
          subtitle={revealPackSize < reveal.length ? `${reveal.length / revealPackSize}-pack box` : `${reveal.length}-card pack`}
          onClose={() => setReveal(null)}
        />
      )}

      {sel ? (
        /* ---------- pack detail: picture · cost · odds ---------- */
        <>
          <button className="btn btn-ghost btn-sm pack-back" onClick={() => { setSelected(null); setError(null); }}>
            ← All packs
          </button>

          <div className="pack-detail">
            <div className="pack-detail-art">
              <PackArt setKey={sel.setKey} name={sel.name} size="lg" />
            </div>

            <div className="pack-detail-info">
              <div className="between">
                <h1 style={{ margin: 0 }}>{sel.name}</h1>
                <span className="tag">{sel.tier}</span>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>{sel.description}</div>

              <div className="pack-detail-meta">
                <div className="pack-meta-cell">
                  <span className="pack-meta-k">Cost</span>
                  <span className={`pack-meta-v ${isGem ? 'gem-text' : ''}`}>{costLabel(sel)}</span>
                </div>
                <div className="pack-meta-cell">
                  <span className="pack-meta-k">Contents</span>
                  <span className="pack-meta-v">
                    {sel.packsPerBox > 1
                      ? `${sel.packsPerBox} packs · ${sel.cardsPerPack * sel.packsPerBox} cards`
                      : `${sel.cardsPerPack} cards`}
                  </span>
                </div>
              </div>

              {sel.guaranteeNumbered && (
                <div className="tag" style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)', marginTop: 12, display: 'inline-block' }}>
                  📦 guaranteed numbered
                </div>
              )}

              {sel.totalBoxes != null && (
                <div className="box-supply" style={{ marginTop: 14 }}>
                  <div className="box-supply-head">
                    <span className={`box-supply-label ${sel.soldOut ? 'sold-out' : ''}`}>
                      {sel.soldOut ? 'SOLD OUT' : `${num(sel.boxesRemaining ?? 0)} / ${num(sel.totalBoxes)} boxes left`}
                    </span>
                    <span className="muted mono" style={{ fontSize: 11 }}>{num(sel.boxesOpened)} opened</span>
                  </div>
                  <span className={`box-supply-bar ${sel.soldOut ? 'sold-out' : ''}`}>
                    <span style={{ width: `${Math.max(2, ((sel.boxesRemaining ?? 0) / sel.totalBoxes) * 100)}%` }} />
                  </span>
                </div>
              )}

              <div className="section-title" style={{ marginTop: 18 }}>Card odds</div>
              <div className="odds pack-detail-odds">
                {sel.odds.map((o) => (
                  <div className="odds-row" key={o.parallel}>
                    <span className="odds-name" style={{ color: o.parallel === 'BLACK' ? '#cfd6e2' : o.color }}>
                      {o.displayName.replace(/\s*1\/1/, '')}
                    </span>
                    <span className="odds-pct">{packRate(o.perPack)}</span>
                  </div>
                ))}
              </div>

              {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}

              <button className="btn btn-gold btn-lg pack-detail-rip" onClick={rip} disabled={busy || !canAfford}>
                {busy
                  ? 'Opening…'
                  : sel.soldOut
                    ? 'SOLD OUT'
                    : !canAfford
                      ? isGem ? 'Not enough gems' : 'Not enough'
                      : sel.packsPerBox > 1 ? `OPEN BOX · ${costLabel(sel)}` : `RIP PACK · ${costLabel(sel)}`}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ---------- gallery: every pack as a picture with its name below ---------- */
        <>
          <div className="page-head">
            <h1>Rip packs</h1>
            <p>Pick a pack to see its cost and odds. Every numbered pull is a unique, owned serial — once it's gone, it's gone.</p>
          </div>

          {loading ? (
            <div className="center" style={{ padding: 60 }}>
              <div className="spin" />
            </div>
          ) : (
            <div className="pack-gallery">
              {products.map((p) => (
                <button key={p.id} className="pack-tile" onClick={() => setSelected(p.id)}>
                  <PackArt setKey={p.setKey} name={p.name} size="sm" />
                  {p.soldOut && <span className="pack-tile-flag sold-out">SOLD OUT</span>}
                  <div className="pack-tile-name">{p.name}</div>
                  <div className="pack-tile-cost">
                    <span className={p.gemCost > 0 ? 'gem-text' : ''}>{costLabel(p)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
