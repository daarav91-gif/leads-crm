import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const db = supabaseAdmin();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: u } = await db.auth.getUser(token);
  if (!u || !u.user) return res.status(401).json({ error: 'login required' });

  const { data: me } = await db.from('profiles').select('*').eq('id', u.user.id).single();
  const { leadId, newOwnerId } = req.body;
  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
  if (!lead) return res.status(404).json({ error: 'lead not found' });

  const isAdmin = me.role === 'admin';
  const ownsLead = lead.owner_id === me.id;
  if (!isAdmin && !(ownsLead && me.can_transfer)) {
    return res.status(403).json({ error: 'transfer not allowed' });
  }

  await db.from('leads').update({ owner_id: newOwnerId }).eq('id', leadId);
  res.status(200).json({ ok: true });
}
