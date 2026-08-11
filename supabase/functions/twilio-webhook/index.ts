/**
 * Eingehende SMS- und WhatsApp-Nachrichten von Twilio in den Posteingang.
 *
 * Der Endpunkt ist öffentlich erreichbar (Twilio kann sich nicht anmelden),
 * deshalb wird jede Anfrage über die Twilio-Signatur geprüft. Ohne diese
 * Prüfung könnte jeder beliebige Nachrichten ins CRM schreiben.
 *
 * Deployment:
 *   supabase functions deploy twilio-webhook --no-verify-jwt
 *   supabase secrets set TWILIO_AUTH_TOKEN=... PUBLIC_WEBHOOK_URL=https://<ref>.supabase.co/functions/v1/twilio-webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml(status = 200): Response {
  return new Response(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml' } });
}

/**
 * Twilio-Signatur nachrechnen: HMAC-SHA1 über die URL plus alle
 * Formularfelder in alphabetischer Reihenfolge, Base64-kodiert.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
async function isValidSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Zeitkonstanter Vergleich — verhindert, dass sich die Signatur über die
  // Antwortzeit Zeichen für Zeichen erraten lässt.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/** Auf die letzten Ziffern reduzieren, damit +49… und 0049… zusammenfinden. */
function phoneTail(value: string): string {
  return value.replace(/\D/g, '').slice(-9);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return twiml(405);

  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const webhookUrl = Deno.env.get('PUBLIC_WEBHOOK_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!authToken || !webhookUrl || !supabaseUrl || !serviceKey) {
    console.error('Konfiguration unvollständig — Nachricht verworfen');
    return twiml(500);
  }

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value;
  }

  const signature = req.headers.get('X-Twilio-Signature') ?? '';
  if (!signature || !(await isValidSignature(authToken, webhookUrl, params, signature))) {
    console.warn('Signatur ungültig — Anfrage abgewiesen');
    return twiml(403);
  }

  const from = params.From;
  const body = params.Body;
  const messageSid = params.MessageSid;
  if (!from || !body) return twiml(400);

  const isWhatsApp = from.startsWith('whatsapp:');
  const phone = from.replace('whatsapp:', '');
  const channel = isWhatsApp ? 'whatsapp' : 'sms';

  // Service-Rolle: der Webhook handelt ohne angemeldeten Nutzer und muss
  // deshalb an RLS vorbei schreiben dürfen.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Bestehende Unterhaltung suchen …
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('channel', channel)
    .eq('counterparty', phone)
    .maybeSingle();

  let conversationId = existing?.id as string | undefined;

  if (!conversationId) {
    // … sonst anlegen und, wenn möglich, einem Kontakt zuordnen.
    const tail = phoneTail(phone);
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, company_id, phone, mobile')
      .or(`phone.ilike.%${tail},mobile.ilike.%${tail}`)
      .limit(1);

    const match = contacts?.[0];

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        channel,
        counterparty: phone,
        contact_id: match?.id ?? null,
        company_id: match?.company_id ?? null,
        subject: match ? null : `Neue Nachricht von ${phone}`,
      })
      .select('id')
      .single();

    if (error || !created) {
      console.error('Unterhaltung konnte nicht angelegt werden:', error?.message);
      return twiml(500);
    }
    conversationId = created.id as string;
  }

  // Der Trigger auf messages zieht last_message_at und unread_count nach.
  const { error: insertError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    body,
    from_addr: phone,
    external_id: messageSid ?? null,
    sent_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error('Nachricht konnte nicht gespeichert werden:', insertError.message);
    return twiml(500);
  }

  return twiml();
});
