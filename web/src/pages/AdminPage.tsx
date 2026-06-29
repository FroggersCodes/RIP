import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api/client';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import type { ClockInfo } from '../api/types';

// Dev / admin controls, kept off the player-facing Home page and reachable only
// via the ⚙ link in the nav or the /admin URL.
export function AdminPage() {
  const { refresh } = useAuth();
  const clock = useApi(() => api<ClockInfo>('/league/clock'), []);

  const [adminToken, setAdminToken] = useState('dev-admin');
  const [advancing, setAdvancing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [granting, setGranting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [luckInput, setLuckInput] = useState('5');
  const [settingLuck, setSettingLuck] = useState(false);
  const [settingForce, setSettingForce] = useState(false);
  const [advanceMsg, setAdvanceMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const advance = async () => {
    setAdvancing(true);
    setAdvanceMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/advance-week`, { method: 'POST', headers: { 'x-admin-token': adminToken } });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setAdvanceMsg(`Simulated week ${d.weekNumber}: ${d.statsRecorded} box-score lines, ${d.playersRevalued} players revalued.`);
    } catch (e) {
      setAdvanceMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setAdvancing(false);
    }
  };

  const backfillTemplates = async () => {
    setBackfilling(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backfill-templates`, { method: 'POST', headers: { 'x-admin-token': adminToken } });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setAdvanceMsg(`Backfill done — ${d.created} new template(s) created.`);
    } catch (e) {
      setAdvanceMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setBackfilling(false);
    }
  };

  const importNfl = async () => {
    if (
      !window.confirm(
        'Import real NFL players? This WIPES all data (including your account) and starts a fresh real-NFL league. You will log in again as demo / demo1234.',
      )
    ) {
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/import-nfl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setImportMsg(`Imported ${d.players} real players across ${d.teams} teams (season ${d.season}). Log in as demo / demo1234.`);
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setImporting(false);
    }
  };

  const resetFictional = async () => {
    if (
      !window.confirm(
        'Reset to generated (fictional) players? This WIPES all data and reseeds the made-up league (with autographs + boxes). Log in again as demo / demo1234.',
      )
    ) {
      return;
    }
    setResetting(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-fictional`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: '{}',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setImportMsg('Reset to the generated league. Log in as demo / demo1234.');
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setResetting(false);
    }
  };

  const grantMe = async () => {
    setGranting(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: '{}',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      await refresh();
      setImportMsg('Topped up +1,000,000 tokens, +10,000 cases, +1,000 gems.');
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setGranting(false);
    }
  };

  const setLuck = async () => {
    const v = parseFloat(luckInput);
    if (!v || v < 1) {
      setImportMsg('Luck must be ≥ 1 (1 = normal odds).');
      return;
    }
    setSettingLuck(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/clock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ luckBoost: v }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      clock.reload();
      setImportMsg(v === 1 ? 'Luck reset to normal odds.' : `Luck boost set to ${v}× — rares are much more common now.`);
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setSettingLuck(false);
    }
  };

  const setForce = async (forceParallel: string | null) => {
    setSettingForce(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/clock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ forceParallel }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      clock.reload();
      setImportMsg(
        forceParallel
          ? `Forcing every pulled card to ${forceParallel}. Rip a pack to see it — turn off when done.`
          : 'Forced parallel off — pulls are back to normal odds.',
      );
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setSettingForce(false);
    }
  };

  return (
    <>
      <Link to="/" className="back-link">
        ← Home
      </Link>
      <div className="page-head">
        <h1>Dev tools</h1>
        <p>Admin-only controls for simulating the league and seeding data.</p>
      </div>

      <div className="panel panel-p">
        <div className="section-title">Admin token</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input mono" style={{ maxWidth: 220 }} value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
        </div>

        <hr className="divider" style={{ margin: '16px 0' }} />
        <div className="section-title">League &amp; data</div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn" onClick={advance} disabled={advancing}>
            {advancing ? 'Simulating…' : 'Advance week'}
          </button>
          <button className="btn" onClick={importNfl} disabled={importing}>
            {importing ? 'Importing…' : 'Import real NFL players'}
          </button>
          <button className="btn" onClick={resetFictional} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset to generated players'}
          </button>
          <button className="btn btn-gold" onClick={grantMe} disabled={granting}>
            {granting ? 'Granting…' : 'Give me tokens + cases'}
          </button>
          <button className="btn" onClick={backfillTemplates} disabled={backfilling}>
            {backfilling ? 'Backfilling…' : 'Backfill missing templates'}
          </button>
        </div>

        <hr className="divider" style={{ margin: '16px 0' }} />
        <div className="section-title">Pull odds</div>
        <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Luck boost (1 = normal, higher = luckier):</span>
          <input className="input mono" style={{ maxWidth: 70 }} value={luckInput} onChange={(e) => setLuckInput(e.target.value)} />
          <button className="btn btn-sm" onClick={setLuck} disabled={settingLuck}>
            {settingLuck ? '…' : 'Set'}
          </button>
          {clock.data && <span className="muted mono" style={{ fontSize: 11 }}>now {clock.data.luckBoost}×</span>}
        </div>
        <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Force every pull to one parallel:</span>
          <button className="btn btn-sm" onClick={() => setForce('AUTOGRAPH')} disabled={settingForce}>
            {settingForce ? '…' : 'Force all autos'}
          </button>
          <button className="btn btn-sm" onClick={() => setForce('SUPERFRACTOR')} disabled={settingForce}>
            Force all 1/1s
          </button>
          <button className="btn btn-sm" onClick={() => setForce(null)} disabled={settingForce}>
            Off
          </button>
          {clock.data?.forceParallel && <span className="muted mono" style={{ fontSize: 11 }}>forcing {clock.data.forceParallel}</span>}
        </div>

        {advanceMsg && <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>{advanceMsg}</div>}
        {importMsg && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{importMsg}</div>}
      </div>
    </>
  );
}
