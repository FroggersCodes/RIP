import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Position } from '@rip/shared';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { Card } from '../components/Card';
import { money, num } from '../lib/format';
import type { Collection, CollectionCard } from '../api/types';

const POS: ('ALL' | Position)[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];

export function CollectionPage() {
  const nav = useNavigate();
  const { data, loading } = useApi(() => api<Collection>('/cards'), []);
  const [filter, setFilter] = useState<'all' | 'numbered' | 'base'>('all');
  const [pos, setPos] = useState<'ALL' | Position>('ALL');

  const cards = data?.cards ?? [];
  const filtered = cards.filter(
    (c) =>
      (filter === 'all' || (filter === 'numbered' && c.serial != null) || (filter === 'base' && c.serial == null)) &&
      (pos === 'ALL' || c.player.position === pos),
  );

  const onCard = (c: CollectionCard) => nav(`/players/${c.player.id}`);

  return (
    <>
      <div className="page-head between">
        <div>
          <h1>Collection</h1>
          <p>Every card you own, valued live off player values. Complete a set's base checklist on the Sets tab to earn gems.</p>
        </div>
      </div>

      {data && (
        <div className="summary-chips">
          <div className="chip">
            <div className="chip-k">Cards</div>
            <div className="chip-v">{num(data.summary.total)}</div>
          </div>
          <div className="chip">
            <div className="chip-k">Numbered</div>
            <div className="chip-v gold">{num(data.summary.numbered)}</div>
          </div>
          <div className="chip">
            <div className="chip-k">Base</div>
            <div className="chip-v">{num(data.summary.base)}</div>
          </div>
          <div className="chip">
            <div className="chip-k">Collection value</div>
            <div className="chip-v">{money(data.summary.totalValue)}</div>
          </div>
        </div>
      )}

      <div className="filter-row">
        {(['all', 'numbered', 'base'] as const).map((f) => (
          <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'numbered' ? 'Numbered' : 'Base'}
          </button>
        ))}
        <span style={{ width: 12 }} />
        {POS.map((p) => (
          <button key={p} className={`filter-pill ${pos === p ? 'active' : ''}`} onClick={() => setPos(p)}>
            {p === 'ALL' ? 'All positions' : p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="center" style={{ padding: 60 }}>
          <div className="spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">No cards here yet. Go rip a pack.</div>
      ) : (
        <div className="cards-grid">
          {filtered.map((c) => (
            <div key={c.id} className="card-wrap">
              <Card card={c} size="sm" onClick={() => onCard(c)} />
              {c.equippedRole && <div className="equipped-tag">{c.equippedRole}</div>}
              {c.listed && <div className="equipped-tag listed-tag">listed · {c.listPrice}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
