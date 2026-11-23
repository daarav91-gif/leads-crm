import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

export default function Home() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  async function loadAll() {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setMe(p);
    const { data: l } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(l || []);
    if (p && p.role === 'admin') {
      const { data: t } = await supabase.from('profiles').select('*');
      setTeam(t || []);
    }
  }

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
  }

  async function call(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token
      },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error || 'error');
    else setMsg('');
    loadAll();
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 320, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h2>Leads CRM Login</h2>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 8 }} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 8 }} />
        <button onClick={login} style={{ padding: 8, width: '100%' }}>Login</button>
        <p style={{ color: 'red' }}>{msg}</p>
      </div>
    );
  }

  const isAdmin = me && me.role === 'admin';

  return (
    <div style={{ maxWidth: 1000, margin: '30px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Leads ({leads.length}) {isAdmin ? '- Admin' : ''}</h2>
        <button onClick={() => supabase.auth.signOut()}>Logout</button>
      </div>
      <p style={{ color: 'red' }}>{msg}</p>
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Name</th><th>Phone</th><th>Email</th><th>Status</th>
            {isAdmin && <th>Owner</th>}
            <th>Deal value</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              <td>{l.phone}</td>
              <td>{l.email}</td>
              <td>
                <select value={l.status} onChange={(e) => call('/api/update-status', { leadId: l.id, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              {isAdmin && (
                <td>
                  <select value={l.owner_id || ''} onChange={(e) => call('/api/assign-lead', { leadId: l.id, newOwnerId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {team.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.id.slice(0, 6)}</option>)}
                  </select>
                </td>
              )}
              <td>{l.deal_value || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
