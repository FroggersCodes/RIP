import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dustForBreakdown, type Position } from '@rip/shared';
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
  const selectedCards = cards.filter((c) => sel.has(c.id));
  const dustPreview = selectedCards.reduce((a, c) => a + dustForBreakdown(c.marketValue), 0);

  const onCard = (c: CollectionCard) => {
    if (!selecting) {
      nav(`/players/${c.player.id}`);
      return;
    }
    if (c.equippedRole) return; // equipped cards can't be broken down
    setSel((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.add(c.id);
      return n;
    });
  };

  const breakdown = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    const numbered = selectedCards.filter((c) => c.serial != null).length;
    if (
      numbered > 0 &&
      !window.confirm(
        `Break down ${numbered} numbered card${numbered > 1 ? 's' : ''}? Their serials are retired forever and can never be pulled again.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ brokenDown: number; dustGained: number; user: User }>('/cards/breakdown', {
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
          <p>Your pulls, valued live off player values. Break cards down into dust — the bigger the card, the more dust.</p>
        </div>
        <button
          className={`btn ${selecting ? 'btn-gold' : ''}`}
          onClick={() => {
            setSelecting((s) => !s);
            setSel(new Set());
          }}
        >
          {selecting ? 'Cancel' : 'Break down'}
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
            <div className="chip-k">Break-down dust</div>
            <div className="chip-v">{num(data.summary.breakdownDust)}</div>
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
            const selectable = selecting && !c.equippedRole;
            return (
              <div
                key={c.id}
                className={`card-wrap ${selecting ? 'selectable' : ''} ${sel.has(c.id) ? 'selected' : ''}`}
                style={{ opacity: selecting && !selectable ? 0.4 : 1 }}
              >
                <Card card={c} size="sm" onClick={() => onCard(c)} />
                {c.equippedRole && <div className="equipped-tag">{c.equippedRole}</div>}
                {selecting && selectable && <div className="breakdown-tag">+{dustForBreakdown(c.marketValue)} dust</div>}
              </div>
            );
          })}
        </div>
      )}

      {selecting && (
        <div className="rip-bar">
          <div>
            <div className="section-title">Break down</div>
            <div className="muted">
              {sel.size} card{sel.size === 1 ? '' : 's'} → <span className="gold mono">{num(dustPreview)} dust</span>
              {selectedCards.some((c) => c.serial != null) && (
                <span className="down" style={{ marginLeft: 8, fontSize: 12 }}>
                  numbered serials are retired forever
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-gold btn-lg" onClick={breakdown} disabled={busy || sel.size === 0}>
            {busy ? 'Breaking down…' : `Break down ${sel.size}`}
          </button>
        </div>
      )}
    </>
  );
}
