import { supabase } from "@/integrations/supabase/client";
import { seedCompanies } from "@/data/seedCompanies";

export async function runSeed(userId: string): Promise<{ companiesInserted: number; dealsInserted: number }> {
  let companiesInserted = 0;
  let dealsInserted = 0;

  for (const sc of seedCompanies) {
    // Insert company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: sc.name,
        industry: sc.industry || null,
        city: sc.city || null,
        notes: sc.notes || null,
        owner_id: userId,
      })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error(`Failed to insert company ${sc.name}:`, companyError);
      continue;
    }

    companiesInserted++;

    // Insert deal if present
    if (sc.deal) {
      const { error: dealError } = await supabase.from("deals").insert({
        title: sc.deal.title,
        stage: sc.deal.stage,
        value: sc.deal.value ?? 0,
        company_id: company.id,
        owner_id: userId,
        probability: sc.deal.stage === "won" ? 100 : sc.deal.stage === "lost" ? 0 : 50,
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
