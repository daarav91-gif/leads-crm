import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    const db = supabaseAdmin();
    const entries = req.body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const { leadgen_id, form_id, page_id } = change.value;

        const url = `https://graph.facebook.com/v21.0/${leadgen_id}?access_token=${process.env.META_ACCESS_TOKEN}`;
        const r = await fetch(url);
        const data = await r.json();
        const fields = {};
        (data.field_data || []).forEach((f) => {
          fields[f.name] = (f.values || [])[0];
        });

        await db.from('leads').upsert(
          {
            meta_lead_id: String(leadgen_id),
            form_id: String(form_id),
            page_id: String(page_id),
            name: fields.full_name || fields.name || '',
            phone: fields.phone_number || fields.phone || '',
            email: fields.email || ''
          },
          { onConflict: 'meta_lead_id' }
        );
      }
    }
    return res.status(200).send('ok');
  }

  res.status(405).end();
}
