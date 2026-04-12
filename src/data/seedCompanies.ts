export interface SeedCompany {
  name: string;
  industry?: string;
  city?: string;
  website?: string;
  status: "lead" | "prospect" | "customer" | "inactive";
  deal?: {
    title: string;
    stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
    value?: number;
    probability?: number;
  };
  contact?: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  notes?: string;
}

export const seedCompanies: SeedCompany[] = [
  // KUNDEN (Aktiv / Voice KI aktiv)
  {
    name: "Athletic Solution Center Stuttgart",
    industry: "Sport & Fitness",
    city: "Stuttgart",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won", value: 1200, probability: 100 },
    notes: "Voice KI (LENA) aktiv. Blueprint + Angebot vorhanden.",
  },
  {
    name: "Conplaning GmbH",
    industry: "IT & Beratung",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won", value: 1500, probability: 100 },
    notes: "Voice KI Prompt + Blueprint/Präsentation vorhanden.",
  },
  {
    name: "MVZ Nellingen",
    industry: "Gesundheit & Medizin",
    city: "Nellingen",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won", value: 900, probability: 100 },
    notes: "Voice KI (LENA) aktiv. Blueprint vorhanden.",
  },
  {
    name: "Reinker Reha-Zentrum Markkleeberg",
    industry: "Gesundheit & Rehabilitation",
    city: "Markkleeberg",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won", value: 1200, probability: 100 },
    notes: "Voice KI (LISA) aktiv. Angebot + Blueprint + Präsentation vorhanden.",
  },
  {
    name: "Relife Academy",
    industry: "Bildung & Coaching",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won", value: 900, probability: 100 },
    notes: "Ablefy Onboarding Automation aktiv.",
  },
  {
    name: "SJ Design",
    industry: "Design & Marketing",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won", value: 900, probability: 100 },
    notes: "WhatsApp Bot + Rechnungseingang-Verarbeitung aktiv.",
  },
  {
    name: "VFB Rehawelt",
    industry: "Gesundheit & Rehabilitation",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won", value: 1500, probability: 100 },
    notes: "Blueprint + KI Telefonie Präsentation erstellt. Aktiv.",
  },
  {
    name: "Versicherung Frey",
    industry: "Versicherung & Finanzen",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won", value: 900, probability: 100 },
    notes: "Outreach Bot aktiv. Onboarding abgeschlossen.",
  },
  {
    name: "factonet",
    industry: "IT & Beratung",
    website: "https://factonet.de",
    status: "customer",
    deal: { title: "Meta Ads + n8n Automation + Landing Page", stage: "won", value: 1800, probability: 100 },
    contact: { first_name: "Constantin", last_name: "Seretoulis" },
    notes: "Strategische Partnerschaft. Setup-Fee €1.000. €250/qualif. Lead + 5% Revenue Share. 3 n8n Workflows aktiv.",
  },
  {
    name: "ulco GmbH",
    industry: "Sonstiges",
    status: "customer",
    deal: { title: "Onboarding", stage: "won", value: 900, probability: 100 },
    notes: "Onboarding abgeschlossen.",
  },
  {
    name: "webwerkerei",
    industry: "IT & Web",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won", value: 600, probability: 100 },
    notes: "SEO-Automation. Anleitung vorhanden.",
  },

  // INTERESSENTEN (In Bearbeitung)
  {
    name: "HNO Baumann Nürtingen",
    industry: "Gesundheit & HNO",
    city: "Nürtingen",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal", value: 1200, probability: 50 },
    notes: "Blueprint vorhanden. In Bearbeitung.",
  },
  {
    name: "Smart Dental Ulm",
    industry: "Gesundheit & Zahnarzt",
    city: "Ulm",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal", value: 1200, probability: 50 },
    notes: "3 Blueprint-Versionen vorhanden. In Bearbeitung.",
  },
  {
    name: "Zahnarzt Dr. Guter",
    industry: "Gesundheit & Zahnarzt",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal", value: 900, probability: 50 },
    notes: "Blueprint vorhanden. In Bearbeitung.",
  },
  {
    name: "Zahnarzt Dr. Schmid",
    industry: "Gesundheit & Kieferorthopädie",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal", value: 900, probability: 50 },
    notes: "Blueprint + System Prompt erstellt.",
  },
  {
    name: "schreinerei krickl",
    industry: "Handwerk & Schreinerei",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal", value: 900, probability: 50 },
    notes: "In Bearbeitung. Noch keine Dateien.",
  },

  // LEADS (Leerer Ordner / Erstkontakt)
  {
    name: "Augenärzte Im Basteicenter",
    industry: "Gesundheit & Augenheilkunde",
    status: "lead",
    deal: { title: "Voice KI Assistent", stage: "lead", value: 900, probability: 10 },
    notes: "Erstkontakt. Noch kein Material.",
  },
  {
    name: "Dr. Schmid Zahnarzt Laichingen",
    industry: "Gesundheit & Zahnarzt",
    city: "Laichingen",
    status: "lead",
    deal: { title: "Voice KI Assistent", stage: "lead", value: 900, probability: 10 },
    notes: "Erstkontakt. Noch kein Material.",
  },
  {
    name: "Frau vom Fliesenleger",
    industry: "Handwerk & Fliesen",
    status: "lead",
    deal: { title: "Voice KI Assistent", stage: "lead", value: 600, probability: 10 },
    notes: "Erstkontakt. Noch kein Material.",
  },
];
