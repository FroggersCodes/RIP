import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Position } from '@rip/shared';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { Card } from '../components/Card';
import { money, num } from '../lib/format';
import type { Collection, CollectionCard, User } from '../api/types';

const POS: ('ALL' | Position)[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];

export function CollectionPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const { data, loading, reload } = useApi(() => api<Collection>('/cards'), []);
  const [filter, setFilter] = useState<'all' | 'numbered' | 'base'>('all');
  const [pos, setPos] = useState<'ALL' | Position>('ALL');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const cards = data?.cards ?? [];
  const filtered = cards.filter(
    (c) =>
      (filter === 'all' || (filter === 'numbered' && c.serial != null) || (filter === 'base' && c.serial == null)) &&
      (pos === 'ALL' || c.player.position === pos),
  );
  const dustPer = data?.summary.dustPerBase ?? 5;

  const onCard = (c: CollectionCard) => {
    if (!selecting) {
      nav(`/players/${c.player.id}`);
      return;
    }
    if (c.serial != null || c.equippedRole) return; // only unequipped base recyclable
    setSel((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.add(c.id);
      return n;
    });
  };

  const recycle = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await api<{ recycled: number; dustGained: number; user: User }>('/cards/recycle', {
        method: 'POST',
        body: { instanceIds: ids },
      });
      setUser(r.user);
      setSel(new Set());
      setSelecting(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head between">
        <div>
          <h1>Collection</h1>
          <p>Your pulls, valued live off player values. Recycle base filler into dust.</p>
        </div>
        <button
          className={`btn ${selecting ? 'btn-gold' : ''}`}
          onClick={() => {
            setSelecting((s) => !s);
            setSel(new Set());
          }}
        >
          {selecting ? 'Cancel' : 'Recycle base'}
        </button>
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
            <div className="chip-k">Collection value</div>
            <div className="chip-v">{money(data.summary.totalValue)}</div>
          </div>
          <div className="chip">
            <div className="chip-k">Recyclable base</div>
            <div className="chip-v">{num(data.summary.recyclableBase)}</div>
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
          {filtered.map((c) => {
            const selectable = selecting && c.serial == null && !c.equippedRole;
            return (
              <div
                key={c.id}
                className={`card-wrap ${selecting ? 'selectable' : ''} ${sel.has(c.id) ? 'selected' : ''}`}
                style={{ opacity: selecting && !selectable ? 0.4 : 1 }}
              >
                <Card card={c} size="sm" onClick={() => onCard(c)} />
                {c.equippedRole && <div className="equipped-tag">{c.equippedRole}</div>}
              </div>
            );
          })}
        </div>
      )}

      {selecting && (
        <div className="rip-bar">
          <div>
            <div className="section-title">Recycle</div>
            <div className="muted">
              {sel.size} base card{sel.size === 1 ? '' : 's'} selected → <span className="gold mono">{sel.size * dustPer} dust</span>
            </div>
          </div>
          <button className="btn btn-gold btn-lg" onClick={recycle} disabled={busy || sel.size === 0}>
            {busy ? 'Recycling…' : `Recycle ${sel.size}`}
          </button>
        </div>
      )}
    </>
  );
}
