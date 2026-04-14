import { supabase } from "@/integrations/supabase/client";
import { seedCompanies } from "@/data/seedCompanies";

export async function runSeed(userId: string): Promise<{ companiesInserted: number; dealsInserted: number }> {
  let companiesInserted = 0;
  let dealsInserted = 0;

  // Fetch existing company names to avoid duplicates
  const { data: existingCompanies } = await supabase
    .from("companies")
    .select("name")
    .eq("owner_id", userId);
  const existingNames = new Set((existingCompanies || []).map((c) => c.name.toLowerCase()));

  for (const sc of seedCompanies) {
    // Skip if company already exists
    if (existingNames.has(sc.name.toLowerCase())) {
      continue;
    }

    // Insert company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: sc.name,
        industry: sc.industry || null,
        city: sc.city || null,
        website: sc.website || null,
        notes: sc.notes || null,
        status: sc.status as any,
        owner_id: userId,
      })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error(`Failed to insert company ${sc.name}:`, companyError);
      continue;
    }

    companiesInserted++;

    // Insert contact if present
    let contactId: string | null = null;
    if (sc.contact) {
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          first_name: sc.contact.first_name,
          last_name: sc.contact.last_name,
          email: sc.contact.email || null,
          company_id: company.id,
          owner_id: userId,
        })
        .select("id")
        .single();
      if (!contactError && contact) contactId = contact.id;
    }

    // Insert deal if present
    if (sc.deal) {
      const stageProbability: Record<string, number> = {
        won: 100, negotiation: 75, proposal: 50, qualified: 25, lead: 10, lost: 0,
      };
      const { error: dealError } = await supabase.from("deals").insert({
        title: sc.deal.title,
        stage: sc.deal.stage,
        value: sc.deal.value ?? 0,
        company_id: company.id,
        contact_id: contactId,
        owner_id: userId,
        probability: sc.deal.probability ?? stageProbability[sc.deal.stage] ?? 0,
      });

      if (dealError) {
        console.error(`Failed to insert deal for ${sc.name}:`, dealError);
      } else {
        dealsInserted++;
      }
    }
  }

  return { companiesInserted, dealsInserted };
}
