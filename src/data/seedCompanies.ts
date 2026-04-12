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
  };
  notes?: string;
}

export const seedCompanies: SeedCompany[] = [
  // 1
  {
    name: "Solution Center Stuttgart",
    industry: "Sport & Fitness",
    city: "Stuttgart",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LENA) aktiv. Blueprint + Angebot vorhanden.",
  },
  // 2 – FIRMENNAME FEHLT
  {
    name: "FIRMA_2",
    industry: "IT & Beratung",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI Prompt + Blueprint/Präsentation vorhanden.",
  },
  // 3 – FIRMENNAME FEHLT
  {
    name: "FIRMA_3",
    industry: "Gesundheit & Medizin",
    city: "Nellingen",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LENA) aktiv.",
  },
  // 4 – FIRMENNAME FEHLT
  {
    name: "FIRMA_4",
    industry: "Gesundheit & Rehabilitation",
    city: "Markkleeberg",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LISA) aktiv. Angebot + Blueprint + Präsentation vorhanden.",
  },
  // 5 – FIRMENNAME FEHLT
  {
    name: "FIRMA_5",
    industry: "Coaching & Bildung",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "Ablefy Onboarding Automation aktiv.",
  },
  // 6 – FIRMENNAME FEHLT
  {
    name: "FIRMA_6",
    industry: "Design & Kreativagentur",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "WhatsApp Bot + Rechnungseingang-Verarbeitung aktiv.",
  },
  // 7 – FIRMENNAME FEHLT
  {
    name: "FIRMA_7",
    industry: "Gesundheit & Rehabilitation",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal" },
    notes: "Blueprint + KI Telefonie Präsentation erstellt.",
  },
  // 8 – FIRMENNAME FEHLT
  {
    name: "FIRMA_8",
    industry: "Versicherung & Finanzen",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "Outreach Bot aktiv. Onboarding abgeschlossen.",
  },
  // 9
  {
    name: "factonet (PCA Partners)",
    industry: "Beratung & Forschungsförderung",
    website: "https://factonet.de",
    status: "customer",
    deal: { title: "Meta Ads + n8n Automation + Landing Page", stage: "won", value: 1000 },
    notes: "Strategische Partnerschaft. ASP: Constantin Seretoulis. Setup-Fee €1.000. €250/qualif. Lead + 5% Revenue Share. 3 n8n Workflows aktiv.",
  },
  // 10 – FIRMENNAME FEHLT
  {
    name: "FIRMA_10",
    industry: "Sonstiges",
    status: "customer",
    deal: { title: "Onboarding", stage: "won" },
    notes: "Onboarding abgeschlossen.",
  },
  // 11 – FIRMENNAME FEHLT
  {
    name: "FIRMA_11",
    industry: "Web & Digitalagentur",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "SEO-Automation. Anleitung vorhanden.",
  },
  // 13
  {
    name: "FIRMA_13",
    industry: "Gesundheit & Zahnarzt",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal" },
    notes: "Blueprint vorhanden.",
  },
  // 14
  {
    name: "FIRMA_14",
    industry: "Gesundheit & Kieferorthopädie",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal" },
    notes: "Blueprint + System Prompt erstellt.",
  },
  // === FIRMEN 15-19 FEHLEN NOCH ===
];
