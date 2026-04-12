// Seed data for companies and their deals.
// Edit this file to add/change companies before importing.
// status maps to contact_status on the implicit "company contact"
// deal.stage must be one of: lead, qualified, proposal, negotiation, won, lost

export interface SeedCompany {
  name: string;
  industry?: string;
  city?: string;
  status: "lead" | "prospect" | "customer" | "inactive";
  deal?: {
    title: string;
    stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
    value?: number;
  };
  notes?: string;
}

export const seedCompanies: SeedCompany[] = [
  // === BITTE HIER DEINE 19 UNTERNEHMEN EINTRAGEN ===
  // Beispiel-Format:
  // {
  //   name: "Firmenname",
  //   industry: "Branche",
  //   city: "Stadt",
  //   status: "customer",
  //   deal: { title: "Voice KI Assistent", stage: "won", value: 0 },
  //   notes: "Notizen hier",
  // },

  // Aus deinen Nachrichten konnte ich diese Fragmente rekonstruieren:
  {
    name: "Solution Center Stuttgart",
    industry: "Sport & Fitness",
    city: "Stuttgart",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LENA) aktiv. Blueprint + Angebot vorhanden.",
  },
  {
    name: "FIRMA_2",
    industry: "IT & Beratung",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI Prompt + Blueprint/Präsentation vorhanden.",
  },
  {
    name: "FIRMA_3",
    industry: "Gesundheit & Medizin",
    city: "Nellingen",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LENA) aktiv.",
  },
  {
    name: "FIRMA_4",
    industry: "Gesundheit & Rehabilitation",
    city: "Markkleeberg",
    status: "customer",
    deal: { title: "Voice KI Assistent", stage: "won" },
    notes: "Voice KI (LISA) aktiv. Angebot + Blueprint + Präsentation vorhanden.",
  },
  {
    name: "FIRMA_5",
    industry: "Coaching & Bildung",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "Ablefy Onboarding Automation aktiv.",
  },
  {
    name: "FIRMA_6",
    industry: "Design & Kreativagentur",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "WhatsApp Bot + Rechnungseingang-Verarbeitung aktiv.",
  },
  {
    name: "FIRMA_7",
    industry: "Gesundheit & Rehabilitation",
    status: "prospect",
    deal: { title: "Voice KI Assistent", stage: "proposal" },
    notes: "Blueprint + KI Telefonie Präsentation erstellt.",
  },
  {
    name: "FIRMA_8",
    industry: "Versicherung & Finanzen",
    status: "customer",
    deal: { title: "n8n Automatisierung", stage: "won" },
    notes: "Outreach Bot aktiv. Onboarding abgeschlossen.",
  },
  // FIRMA_9 bis FIRMA_19 hier ergänzen...
];
