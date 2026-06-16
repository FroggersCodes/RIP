import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { Card } from '../components/Card';
import { RipReveal, type RevealCard } from '../components/RipReveal';
import { money, num } from '../lib/format';
import type { BattleResult, Product } from '../api/types';

export function BattlePage() {
  const { user, setUser } = useAuth();
  const { data } = useApi(() => api<{ products: Product[] }>('/products'), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<'select' | 'reveal' | 'result'>('select');
  const [result, setResult] = useState<BattleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = data?.products ?? [];
  const sel = products.find((p) => p.id === selected) ?? products[0] ?? null;
  const canPlay = !!sel && (user?.tokens ?? 0) >= sel.entryCost && (user?.cases ?? 0) >= sel.caseCost;

  const start = async () => {
    if (!sel) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<BattleResult>('/battles', { method: 'POST', body: { productId: sel.id } });
      setResult(r);
      setUser(r.user);
      setPhase('reveal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPhase('select');
  };

  if (phase === 'reveal' && result) {
    return (
      <RipReveal
        cards={result.challengerCards as RevealCard[]}
        title="Your pull"
        subtitle="Reveal your cards, then see how you stack up against the house."
        onClose={() => setPhase('result')}
      />
    );
  }

  if (phase === 'result' && result) {
    const cls = result.result === 'win' ? 'result-win' : result.result === 'loss' ? 'result-loss' : 'result-tie';
    const label = result.result === 'win' ? 'YOU WIN' : result.result === 'loss' ? 'YOU LOSE' : 'TIE';
    return (
      <>
        <div className={`result-banner ${cls}`}>
          {label}
          <div className="reward-chips">
            <span>{result.rewardTokens >= 0 ? '+' : ''}{num(result.rewardTokens)} tokens</span>
            {result.rewardCases > 0 && <span>+{result.rewardCases} case</span>}
            <span className={result.ratingDelta >= 0 ? 'up' : 'down'}>
              {result.ratingDelta >= 0 ? '+' : ''}
              {result.ratingDelta} rating
            </span>
          </div>
        </div>
        <div className="battle-cols">
          <div className="battle-side">
            <h3>You</h3>
            <div className="battle-total">{money(result.challengerTotal)}</div>
            <div className="mini-grid">
              {result.challengerCards.map((c, i) => (
                <Card key={i} card={c} size="sm" />
              ))}
            </div>
          </div>
          <div className="vs-pill">VS</div>
          <div className="battle-side">
            <h3>House bot</h3>
            <div className="battle-total">{money(result.opponentTotal)}</div>
            <div className="mini-grid">
              {result.opponentCards.map((c, i) => (
                <Card key={i} card={c} size="sm" faded />
              ))}
            </div>
          </div>
        </div>
        <div className="center" style={{ marginTop: 22 }}>
          <button className="btn btn-gold btn-lg" onClick={reset}>
            Battle again
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Head to head</h1>
        <p>Open the same product as the house bot. Higher total market value wins tokens, a case, and rating. You keep every card you pull.</p>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <div key={p.id} className={`product-card ${sel?.id === p.id ? 'selected' : ''}`} onClick={() => setSelected(p.id)}>
            <div className="between">
              <div className="product-name">{p.name}</div>
              <span className="tag">{p.tier}</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, minHeight: 36 }}>
              {p.description}
            </div>
            <div className="product-cost" style={{ marginTop: 8 }}>
              Entry {num(p.entryCost)} tokens{p.caseCost ? ` + ${p.caseCost} case` : ''}
            </div>
          </div>
        ))}
      </div>
      {sel && (
        <div className="rip-bar">
          <div>
            <div className="section-title">Wager</div>
            <div className="row">
              <span className="product-name" style={{ fontSize: 17 }}>
                {sel.name}
              </span>
              <span className="product-cost">{num(sel.entryCost)} tokens</span>
            </div>
            {error && <div className="error-text">{error}</div>}
          </div>
          <button className="btn btn-gold btn-lg" onClick={start} disabled={busy || !canPlay}>
            {busy ? 'Battling…' : canPlay ? 'Battle the house' : 'Not enough'}
          </button>
        </div>
      )}
    </>
  );
}
