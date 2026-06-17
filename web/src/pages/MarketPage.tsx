import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { Card } from '../components/Card';
import { money, num } from '../lib/format';
import type { Collection, CollectionCard, User } from '../api/types';

interface MarketListing {
  listingId: string;
  priceTokens: number;
  seller: string;
  card: CollectionCard;
}

function Spin() {
  return (
    <div className="center" style={{ padding: 60 }}>
      <div className="spin" />
    </div>
  );
}

export function MarketPage() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState<'browse' | 'sell' | 'mine'>('browse');
  const browse = useApi(() => api<{ listings: MarketListing[] }>('/market/listings'), []);
  const mine = useApi(() => api<{ listings: { listingId: string; priceTokens: number; card: CollectionCard }[] }>('/market/mine'), []);
  const coll = useApi(() => api<Collection>('/cards'), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const buy = (l: MarketListing) =>
    run(l.listingId, async () => {
      const r = await api<{ user: User }>('/market/buy', { method: 'POST', body: { listingId: l.listingId } });
      setUser(r.user);
      browse.reload();
    });
  const sellHouse = (c: CollectionCard) =>
    run(c.id, async () => {
      const r = await api<{ tokens: number; user: User }>('/market/sell', { method: 'POST', body: { instanceId: c.id } });
      setUser(r.user);
      coll.reload();
    });
  const list = (c: CollectionCard) =>
    run(c.id, async () => {
      const price = parseInt(prices[c.id] ?? '', 10);
      if (!price || price < 1) {
        alert('Enter a token price');
        return;
      }
      await api('/market/list', { method: 'POST', body: { instanceId: c.id, priceTokens: price } });
      coll.reload();
      mine.reload();
    });
  const cancel = (listingId: string) =>
    run(listingId, async () => {
      await api('/market/cancel', { method: 'POST', body: { listingId } });
      mine.reload();
      coll.reload();
    });

  const sellable = (coll.data?.cards ?? []).filter((c) => !c.equippedRole && !c.listed);

  return (
    <>
      <div className="page-head">
        <h1>Marketplace</h1>
        <p>Sell to the house instantly at 80% of market value, or list to other managers for any token price.</p>
      </div>
      <div className="filter-row">
        {(['browse', 'sell', 'mine'] as const).map((t) => (
          <button key={t} className={`filter-pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'browse' ? 'Browse' : t === 'sell' ? 'Sell' : 'My listings'}
          </button>
        ))}
      </div>

      {tab === 'browse' &&
        (browse.loading ? (
          <Spin />
        ) : browse.data?.listings.length ? (
          <div className="cards-grid">
            {browse.data.listings.map((l) => (
              <div className="card-wrap" key={l.listingId}>
                <Card card={l.card} size="sm" />
                <div className="market-foot">
                  <div>
                    <div className="gold mono" style={{ fontWeight: 700 }}>{num(l.priceTokens)} tok</div>
                    <div className="muted" style={{ fontSize: 11 }}>mkt {money(l.card.marketValue)} · {l.seller}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-gold"
                    disabled={busy === l.listingId || (user?.tokens ?? 0) < l.priceTokens}
                    onClick={() => buy(l)}
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No listings yet. Head to the Sell tab and be the first.</div>
        ))}

      {tab === 'sell' &&
        (coll.loading ? (
          <Spin />
        ) : sellable.length ? (
          <div className="cards-grid">
            {sellable.map((c) => (
              <div className="card-wrap" key={c.id}>
                <Card card={c} size="sm" />
                <div className="market-sell">
                  <button className="btn btn-sm" disabled={busy === c.id} onClick={() => sellHouse(c)}>
                    Sell {num(Math.max(1, Math.round(c.marketValue * 0.8)))} tok
                  </button>
                  <div className="row" style={{ gap: 4 }}>
                    <input
                      className="input"
                      style={{ padding: '5px 8px', fontSize: 13, width: 84 }}
                      placeholder="price"
                      value={prices[c.id] ?? ''}
                      onChange={(e) => setPrices((s) => ({ ...s, [c.id]: e.target.value }))}
                    />
                    <button className="btn btn-sm btn-gold" disabled={busy === c.id} onClick={() => list(c)}>
                      List
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No sellable cards. Pull some, or unequip first.</div>
        ))}

      {tab === 'mine' &&
        (mine.loading ? (
          <Spin />
        ) : mine.data?.listings.length ? (
          <div className="cards-grid">
            {mine.data.listings.map((l) => (
              <div className="card-wrap" key={l.listingId}>
                <Card card={l.card} size="sm" />
                <div className="market-foot">
                  <div className="gold mono" style={{ fontWeight: 700 }}>{num(l.priceTokens)} tok</div>
                  <button className="btn btn-sm btn-ghost" disabled={busy === l.listingId} onClick={() => cancel(l.listingId)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">You have no active listings.</div>
        ))}
    </>
  );
}
