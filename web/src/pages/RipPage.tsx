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
  const [packName, setPackName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = data?.products ?? [];
  const sel = products.find((p) => p.id === selected) ?? products[0] ?? null;

  const rip = async (pay: 'tokens' | 'dust') => {
    if (!sel) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<RipResult>('/rip', { method: 'POST', body: { productId: sel.id, pay } });
      setUser(r.user);
      setPackName(r.product.name);
      setReveal(r.cards as RevealCard[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const canTokens = !!sel && (user?.tokens ?? 0) >= sel.entryCost && (user?.cases ?? 0) >= sel.caseCost;
  const canDust = !!sel && sel.caseCost === 0 && (user?.dust ?? 0) >= sel.entryCost;

  return (
    <>
      {reveal && (
        <RipReveal
          cards={reveal}
          title={packName}
          subtitle={`${reveal.length} cards · pack value ${money(reveal.reduce((a, c) => a + c.marketValue, 0))}`}
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
              const maxPct = Math.max(...p.odds.map((o) => o.percent));
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
                    <span className="product-cost">
                      {num(p.entryCost)} tokens{p.caseCost ? ` + ${p.caseCost} case` : ''}
                    </span>
                    <span className="muted mono" style={{ fontSize: 12 }}>
                      {p.cardsPerPack} cards
                    </span>
                  </div>
                  <div className="odds">
                    {p.odds.map((o) => (
                      <div className="odds-row" key={o.parallel}>
                        <span className="odds-name" style={{ color: o.parallel === 'BLACK' ? '#cfd6e2' : o.color }}>
                          {o.displayName.replace(/\s*1\/1/, '')}
                        </span>
                        <span className="odds-bar">
                          <span
                            style={{
                              width: `${Math.max(3, (o.percent / maxPct) * 100)}%`,
                              background: o.parallel === 'BLACK' ? '#cfd6e2' : o.color,
                            }}
                          />
                        </span>
                        <span className="odds-pct">{o.percent < 1 ? o.percent.toFixed(2) : o.percent.toFixed(1)}%</span>
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
                  <span className="product-cost">
                    {num(sel.entryCost)} tokens{sel.caseCost ? ` + ${sel.caseCost} case` : ''}
                  </span>
                </div>
                {error && <div className="error-text" style={{ marginTop: 4 }}>{error}</div>}
              </div>
              <div className="row">
                {canDust && (
                  <button className="btn" onClick={() => rip('dust')} disabled={busy}>
                    Use {num(sel.entryCost)} dust
                  </button>
                )}
                <button className="btn btn-gold btn-lg" onClick={() => rip('tokens')} disabled={busy || !canTokens}>
                  {busy ? 'Ripping…' : canTokens ? 'RIP PACK' : 'Not enough'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
