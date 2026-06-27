import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { RipReveal, type RevealCard } from '../components/RipReveal';
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
  const sel = products.find((p) => p.id === selected) ?? products[0] ?? null;

  const costLabel = (p: Product) =>
    p.gemCost > 0 ? `${num(p.gemCost)} 💎` : `${num(p.entryCost)} tokens${p.caseCost ? ` + ${p.caseCost} case` : ''}`;

  // Average pull rate per pack. Commons (>=1 expected per pack) show a count;
  // rarer cards show "1 : N packs".
  const packRate = (percentPerCard: number, cardsPerPack: number): string => {
    const perPack = (percentPerCard / 100) * cardsPerPack;
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
      <div className="page-head">
        <h1>Rip packs</h1>
        <p>Server-rolled odds. Every numbered pull is a unique, owned serial — once it's gone, it's gone.</p>
      </div>

      {loading ? (
        <div className="center" style={{ padding: 60 }}>
          <div className="spin" />
        </div>
      ) : (
        <>
          <div className="product-grid">
            {products.map((p) => {
              return (
                <div
                  key={p.id}
                  className={`product-card ${sel?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setSelected(p.id)}
                >
                  <div className="between">
                    <div className="product-name">{p.name}</div>
                    <span className="tag">{p.tier}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4, minHeight: 36 }}>
                    {p.description}
                  </div>
                  <div className="between" style={{ marginTop: 8 }}>
                    <span className={`product-cost ${p.gemCost > 0 ? 'gem-text' : ''}`}>{costLabel(p)}</span>
                    <span className="muted mono" style={{ fontSize: 12 }}>
                      {p.packsPerBox > 1 ? `${p.packsPerBox} packs · ${p.cardsPerPack * p.packsPerBox} cards` : `${p.cardsPerPack} cards`}
                    </span>
                  </div>
                  {p.guaranteeNumbered && (
                    <div className="tag" style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)', marginTop: 6, display: 'inline-block' }}>
                      📦 guaranteed numbered
                    </div>
                  )}
                  {p.totalBoxes != null && (
                    <div className="box-supply">
                      <div className="box-supply-head">
                        <span className={`box-supply-label ${p.soldOut ? 'sold-out' : ''}`}>
                          {p.soldOut ? 'SOLD OUT' : `${num(p.boxesRemaining ?? 0)} / ${num(p.totalBoxes)} boxes left`}
                        </span>
                        <span className="muted mono" style={{ fontSize: 11 }}>{num(p.boxesOpened)} opened</span>
                      </div>
                      <span className={`box-supply-bar ${p.soldOut ? 'sold-out' : ''}`}>
                        <span style={{ width: `${Math.max(2, ((p.boxesRemaining ?? 0) / p.totalBoxes) * 100)}%` }} />
                      </span>
                    </div>
                  )}
                  <div className="odds">
                    {p.odds.map((o) => (
                      <div className="odds-row" key={o.parallel}>
                        <span className="odds-name" style={{ color: o.parallel === 'BLACK' ? '#cfd6e2' : o.color }}>
                          {o.displayName.replace(/\s*1\/1/, '')}
                        </span>
                        <span className="odds-pct">{packRate(o.percent, p.cardsPerPack)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {sel && (
            <div className="rip-bar">
              <div>
                <div className="section-title">Selected</div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="product-name" style={{ fontSize: 17 }}>
                    {sel.name}
                  </span>
                  <span className={`product-cost ${isGem ? 'gem-text' : ''}`}>{costLabel(sel)}</span>
                </div>
                {error && <div className="error-text" style={{ marginTop: 4 }}>{error}</div>}
              </div>
              <div className="row">
                <button className="btn btn-gold btn-lg" onClick={rip} disabled={busy || !canAfford}>
                  {busy
                    ? 'Opening…'
                    : sel.soldOut
                      ? 'SOLD OUT'
                      : !canAfford
                        ? isGem ? 'Not enough gems' : 'Not enough'
                        : sel.packsPerBox > 1 ? 'OPEN BOX' : 'RIP PACK'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
