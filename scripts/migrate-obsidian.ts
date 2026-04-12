/**
 * MTM Studios CRM — Obsidian Migration Script
 * Migriert alle 19 Kunden aus Obsidian in Supabase.
 *
 * Voraussetzung:
 *   SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariable setzen
 *   (Supabase Dashboard → Settings → API → service_role key)
 *
 * Ausführen:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/migrate-obsidian.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://noujasigkpvvewzppegd.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY fehlt.");
  console.error("   Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

const OWNER_USER_ID = process.env.OWNER_USER_ID;
if (!OWNER_USER_ID) {
  console.error("❌ OWNER_USER_ID fehlt.");
  console.error("   Supabase Dashboard → Authentication → Users → deine User-ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Kundendaten aus Obsidian ────────────────────────────────────────────────

const companies = [
  {
    name: "Athletic Solution Center Stuttgart",
    industry: "Sport & Fitness",
    city: "Stuttgart",
    country: "Deutschland",
    notes: "Voice KI aktiv. System Prompt: LENA v1. Blueprint + Angebot vorhanden.",
    _status: "customer" as const,
    _product: "Voice KI Assistent",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "Voice KI Assistent (LENA) aktiv. Blueprint + Angebot erstellt.",
  },
  {
    name: "Conplaning GmbH",
    industry: "IT & Beratung",
    city: "",
    country: "Deutschland",
    notes: "Aktiv. Voice KI Prompt + Blueprint/Präsentation vorhanden.",
    _status: "customer" as const,
    _product: "Voice KI Assistent",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "Voice KI Assistent aktiv. Dokumentation vorhanden.",
  },
  {
    name: "MVZ Nellingen",
    industry: "Gesundheit & Medizin",
    city: "Nellingen",
    country: "Deutschland",
    notes: "Voice KI aktiv. System Prompt: LENA v1. Blueprint vorhanden.",
    _status: "customer" as const,
    _product: "Voice KI Assistent",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "Voice KI Assistent (LENA) aktiv im MVZ.",
  },
  {
    name: "Reinker Reha-Zentrum",
    industry: "Gesundheit & Rehabilitation",
    city: "Markkleeberg",
    country: "Deutschland",
    notes: "Voice KI aktiv. System Prompt: LISA v1. Angebot + Blueprint + Präsentation vorhanden.",
    _status: "customer" as const,
    _product: "Voice KI Assistent",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "Voice KI Assistent (LISA) aktiv im Reha-Zentrum Markkleeberg.",
  },
  {
    name: "Relife Academy",
    industry: "Coaching & Bildung",
    city: "",
    country: "Deutschland",
    notes: "Aktiv mit Workflow. n8n Ablefy Onboarding Automation (inkl. agentische Version). Architektur-Doku vorhanden.",
    _status: "customer" as const,
    _product: "n8n Automatisierung",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "n8n Ablefy Onboarding Automation. Zwei Workflow-Versionen (Standard + Agentic).",
  },
  {
    name: "SJ Design",
    industry: "Design & Kreativagentur",
    city: "",
    country: "Deutschland",
    notes: "Aktiv mit Workflow. Zwei Automationen: WhatsApp Bot für Anfragen + Rechnungseingang-Verarbeitung.",
    _status: "customer" as const,
    _product: "n8n Automatisierung",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "n8n: WhatsApp Bot (Anfragen) + Rechnungseingang-Verarbeitung. Blueprints für beide vorhanden.",
  },
  {
    name: "VFB Rehawelt",
    industry: "Gesundheit & Rehabilitation",
    city: "",
    country: "Deutschland",
    notes: "Blueprint + KI Telefonie Präsentation erstellt. In Verhandlung.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "proposal" as const,
    _dealValue: 0,
    _dealNotes: "Blueprint + Vorstellung KI Telefonie vorhanden. Angebot steht aus.",
  },
  {
    name: "Versicherung Frey",
    industry: "Versicherung & Finanzen",
    city: "",
    country: "Deutschland",
    notes: "Aktiv mit Workflow. Outreach Bot (n8n) live. Onboarding-Dokument vorhanden.",
    _status: "customer" as const,
    _product: "n8n Automatisierung",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "n8n Outreach Bot aktiv. Onboarding abgeschlossen.",
  },
  {
    name: "factonet (PCA Partners)",
    industry: "Beratung & Forschungsförderung",
    website: "https://factonet.de",
    city: "",
    country: "Deutschland",
    notes: [
      "Strategische Partnerschaft. ASP: Constantin Seretoulis.",
      "Geschäftsmodell: €1.000 Setup + €250/qualif. Lead + 5% Revenue Share (PCA erhält 15% der ausgezahlten Forschungszulage).",
      "€1.000/Monat Werbebudget (100% Meta Ads).",
      "24 Monate nachvertraglicher Kundenschutz.",
      "Produkte: Meta Ads Kampagne + n8n Lead-Automation + Landing Page (foerderzulage-mittelstand.de) + Supabase Dashboard.",
      "Status: Auftrag erteilt 11.04.2026. Kundendaten (Pixel, Domain, Impressum) noch ausstehend.",
      "3 n8n Workflows importiert: Lead Eingang, Follow-Up Sequenz (Tag 1/3/7), Meta CAPI Offline Conversions.",
      "Google Sheet Leads: 1VttpO6ZnpjHx5TveHPw7G9slY2pGgMs2IZWd_x3ZmmA",
      "Landing Page Repo: github.com/mtmstudios/f-rdermittel-navigator",
      "KPIs: Ziel CPL €40-80, Qualifizierungsrate 40-60%, 1-3 Mandate/Quartal.",
    ].join("\n"),
    _status: "customer" as const,
    _product: "Meta Ads + n8n Automation + Landing Page",
    _dealStage: "won" as const,
    _dealValue: 1000,
    _dealNotes: "Setup-Fee €1.000 bezahlt. Laufende Provision €250/Lead + 5% Revenue Share. Vertrag unterschriftsreif (Vertrag_MTM_factonet_final.docx).",
    _contactFirstName: "Constantin",
    _contactLastName: "Seretoulis",
  },
  {
    name: "ulco GmbH",
    industry: "Sonstiges",
    city: "",
    country: "Deutschland",
    notes: "Aktiv. Onboarding v1 abgeschlossen.",
    _status: "customer" as const,
    _product: "Onboarding",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "Onboarding-Dokument vorhanden und abgeschlossen.",
  },
  {
    name: "webwerkerei",
    industry: "Web & Digitalagentur",
    city: "",
    country: "Deutschland",
    notes: "Aktiv. SEO-Seitengenerator Anleitung erstellt.",
    _status: "customer" as const,
    _product: "n8n Automatisierung",
    _dealStage: "won" as const,
    _dealValue: 0,
    _dealNotes: "SEO-Automation. Anleitung als HTML-Dokument vorhanden.",
  },
  {
    name: "schreinerei krickl",
    industry: "Handwerk & Schreinerei",
    city: "",
    country: "Deutschland",
    notes: "In Bearbeitung. Voice KI Assistent geplant. Noch keine Dateien erstellt.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "qualified" as const,
    _dealValue: 0,
    _dealNotes: "Voice KI Assistent qualifiziert, noch in Bearbeitung.",
  },
  {
    name: "Zahnarzt Dr. Guter",
    industry: "Gesundheit & Zahnarzt",
    city: "",
    country: "Deutschland",
    notes: "In Bearbeitung. Blueprint vorhanden.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "proposal" as const,
    _dealValue: 0,
    _dealNotes: "Blueprint erstellt. Voice KI Assistent im Angebot.",
  },
  {
    name: "Zahnarzt Dr. Schmid (KFO)",
    industry: "Gesundheit & Kieferorthopädie",
    city: "",
    country: "Deutschland",
    notes: "Blueprint + Voice KI Prompt erstellt. Nächster Schritt: Angebot/Entscheidung.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "proposal" as const,
    _dealValue: 0,
    _dealNotes: "Blueprint Dr. Schmid KFO v1 + System Prompt erstellt. Angebot folgt.",
  },
  {
    name: "Dr. Schmid Zahnarzt Laichingen",
    industry: "Gesundheit & Zahnarzt",
    city: "Laichingen",
    country: "Deutschland",
    notes: "Erstkontakt. Noch kein Material vorhanden.",
    _status: "lead" as const,
    _product: "Voice KI Assistent",
    _dealStage: "lead" as const,
    _dealValue: 0,
    _dealNotes: "Neu im System. Noch kein Blueprint oder Prompt.",
  },
  {
    name: "Augenärzte Im Basteicenter",
    industry: "Gesundheit & Augenheilkunde",
    city: "",
    country: "Deutschland",
    notes: "Erstkontakt. Noch kein Material vorhanden.",
    _status: "lead" as const,
    _product: "Voice KI Assistent",
    _dealStage: "lead" as const,
    _dealValue: 0,
    _dealNotes: "Neu im System. Noch kein Blueprint oder Prompt.",
  },
  {
    name: "Frau vom Fliesenleger",
    industry: "Handwerk & Fliesen",
    city: "",
    country: "Deutschland",
    notes: "Erstkontakt. Noch kein Material vorhanden. Blueprint (Fliesenleger) in Blueprints-Ordner vorhanden.",
    _status: "lead" as const,
    _product: "Voice KI Assistent",
    _dealStage: "lead" as const,
    _dealValue: 0,
    _dealNotes: "Blueprint-Entwurf (Fliesenleger) vorhanden, noch nicht zugeordnet.",
  },
  {
    name: "HNO Baumann Nürtingen",
    industry: "Gesundheit & HNO",
    city: "Nürtingen",
    country: "Deutschland",
    notes: "In Bearbeitung. Blueprint vorhanden.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "proposal" as const,
    _dealValue: 0,
    _dealNotes: "Blueprint HNO Baumann v1 erstellt.",
  },
  {
    name: "Smart Dental Ulm",
    industry: "Gesundheit & Zahnarzt",
    city: "Ulm",
    country: "Deutschland",
    notes: "In Bearbeitung. 3 Blueprint-Versionen vorhanden.",
    _status: "prospect" as const,
    _product: "Voice KI Assistent",
    _dealStage: "proposal" as const,
    _dealValue: 0,
    _dealNotes: "3 Blueprint-Versionen (v1, v2, v3) erstellt. Aktiv in Bearbeitung.",
  },
];

// ─── Migration ────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🚀 MTM Studios CRM — Obsidian Migration`);
  console.log(`   ${companies.length} Kunden werden migriert...\n`);

  let companyCount = 0;
  let contactCount = 0;
  let dealCount = 0;
  let errorCount = 0;

  for (const c of companies) {
    const {
      _status, _product, _dealStage, _dealValue, _dealNotes,
      _contactFirstName, _contactLastName,
      ...companyFields
    } = c as any;

    // 1. Company anlegen
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({
        name: companyFields.name,
        industry: companyFields.industry,
        website: companyFields.website || null,
        city: companyFields.city || null,
        country: companyFields.country,
        notes: companyFields.notes,
        owner_id: OWNER_USER_ID,
      })
      .select()
      .single();

    if (companyErr) {
      console.error(`  ❌ ${companyFields.name}: ${companyErr.message}`);
      errorCount++;
      continue;
    }
    companyCount++;
    console.log(`  ✅ Company: ${company.name}`);

    // 2. Kontakt anlegen (nur wenn Ansprechpartner bekannt)
    let contactId: string | null = null;
    if (_contactFirstName && _contactLastName) {
      const { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          first_name: _contactFirstName,
          last_name: _contactLastName,
          company_id: company.id,
          source: "manual",
          status: _status,
          owner_id: OWNER_USER_ID,
        })
        .select()
        .single();

      if (contactErr) {
        console.warn(`     ⚠️  Kontakt ${_contactFirstName}: ${contactErr.message}`);
      } else {
        contactId = contact.id;
        contactCount++;
        console.log(`     👤 Kontakt: ${_contactFirstName} ${_contactLastName}`);
      }
    }

    // 3. Deal anlegen
    const { error: dealErr } = await supabase
      .from("deals")
      .insert({
        title: _product,
        company_id: company.id,
        contact_id: contactId,
        value: _dealValue,
        stage: _dealStage,
        probability: stageToProbability(_dealStage),
        notes: _dealNotes,
        owner_id: OWNER_USER_ID,
        currency: "EUR",
      });

    if (dealErr) {
      console.warn(`     ⚠️  Deal: ${dealErr.message}`);
    } else {
      dealCount++;
      console.log(`     💼 Deal: ${_product} (${_dealStage})`);
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ Migration abgeschlossen:`);
  console.log(`   ${companyCount} Companies`);
  console.log(`   ${contactCount} Kontakte`);
  console.log(`   ${dealCount} Deals`);
  if (errorCount > 0) {
    console.log(`   ${errorCount} Fehler (siehe oben)`);
  }
  console.log(`─────────────────────────────────────\n`);
}

function stageToProbability(stage: string): number {
  const map: Record<string, number> = {
    lead: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    won: 100,
    lost: 0,
  };
  return map[stage] ?? 0;
}

run().catch(console.error);
