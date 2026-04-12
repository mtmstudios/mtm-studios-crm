-- Add status column to companies using existing contact_status enum
-- (lead, prospect, customer, inactive) — same lifecycle stages
ALTER TABLE public.companies
  ADD COLUMN status public.contact_status NOT NULL DEFAULT 'lead';

CREATE INDEX idx_companies_status ON public.companies(status);
