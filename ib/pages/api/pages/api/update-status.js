import { supabaseAdmin } from '../../lib/supabase';
import crypto from 'crypto';

const hash = (v) =>
  v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

const EVENT_MAP = {
  contacted: 'Contacted',
  qualified: 'QualifiedLead',
  won: 'Purchase'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const db = supabaseAdmin();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: u } = await db.auth.getUser(token);
  if (!u || !u.user) return res.status(401).json({ error: 'login required' });

  const { data: me } = await db.from('profiles').select('*').eq('id', u.user.id).single();
  const { leadId, status, dealValue } = req.body;

  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
  if (!lead) return res.status(404).json({ error: 'lead not found' });
  if (me.role !== 'admin' && lead.owner_id !== me.id) {
    return res.status(403).json({ error: 'not your lead' });
  }

  await db.from('leads').update({ status, deal_value: dealValue || lead.deal_value }).eq('id', leadId);

  const eventName = EVENT_MAP[status];
  if (eventName) {
    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'system_generated',
          user_data: {
            lead_id: lead.meta_lead_id ? Number(lead.meta_lead_id) : undefined,
            em: hash(lead.email) ? [hash(lead.email)] : undefined,
            ph: hash(lead.phone) ? [hash(lead.phone)] : undefined
          },
          custom_data: status === 'won' ? { value: Number(dealValue || lead.deal_value || 0), currency: 'INR' } : {}
        }
      ]
    };
    const url = `https://graph.facebook.com/v21.0/${process.env.META_DATASET_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    await db.from('lead_events').insert({
      lead_id: leadId,
      event_name: eventName,
      sent_to_meta: r.ok,
      meta_response: text
    });
  }
  res.status(200).json({ ok: true });
}
