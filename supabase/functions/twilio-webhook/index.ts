import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

Deno.serve(async (req: Request) => {
  // Twilio sends webhooks as POST with application/x-www-form-urlencoded
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      return new Response("Missing From or Body", { status: 400 });
    }

    // Determine channel
    const isWhatsApp = from.startsWith("whatsapp:");
    const cleanPhone = from.replace("whatsapp:", "");
    const channel = isWhatsApp ? "whatsapp" : "sms";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find existing conversation by phone number
    const { data: existingConvo } = await supabase
      .from("conversations")
      .select("id, owner_id")
      .eq("contact_phone", cleanPhone)
      .eq("channel", channel)
      .maybeSingle();

    let conversationId: string;

    if (existingConvo) {
      conversationId = existingConvo.id;
      // Update conversation
      await supabase.from("conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 100),
        unread_count: (existingConvo as any).unread_count + 1 || 1,
      }).eq("id", conversationId);
    } else {
      // No existing conversation found - can't create without owner
      // Log and respond with TwiML empty response
      console.warn(`No conversation found for ${cleanPhone}`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Insert inbound message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "inbound",
      content: body,
      status: "delivered",
      external_id: messageSid,
    });

    // Respond with empty TwiML
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
