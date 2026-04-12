import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY nicht konfiguriert" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image_url } = await req.json();
    if (!image_url) {
      return new Response(
        JSON.stringify({ error: "image_url fehlt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Du extrahierst Kontaktdaten aus Bildern (Visitenkarten, Google My Business Screenshots, Website-Screenshots).
Antworte NUR mit einem JSON-Objekt mit diesen Feldern:
{
  "company_name": "Firmenname",
  "first_name": "Vorname",
  "last_name": "Nachname",
  "email": "E-Mail",
  "phone": "Telefon",
  "website": "Website URL",
  "position": "Position/Rolle",
  "city": "Stadt",
  "industry": "Branche (z.B. Gesundheit & Medizin, IT & Beratung, Handwerk)"
}
Wenn ein Feld nicht erkennbar ist, setze einen leeren String "".
Keine Erklärung, nur das JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrahiere die Kontaktdaten aus diesem Bild:" },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (might be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Konnte keine Daten extrahieren" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
