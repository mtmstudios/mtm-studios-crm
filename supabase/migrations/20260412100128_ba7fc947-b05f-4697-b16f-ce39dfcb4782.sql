
-- Create enums
CREATE TYPE public.contact_source AS ENUM ('manual','voice_ai','website','referral');
CREATE TYPE public.contact_status AS ENUM ('lead','prospect','customer','inactive');
CREATE TYPE public.company_size AS ENUM ('startup','smb','mid_market','enterprise');
CREATE TYPE public.deal_stage AS ENUM ('lead','qualified','proposal','negotiation','won','lost');
CREATE TYPE public.activity_type AS ENUM ('call','email','meeting','task','note');
CREATE TYPE public.voice_lead_intent AS ENUM ('information','appointment','callback','other');
CREATE TYPE public.voice_lead_status AS ENUM ('new','contacted','converted','dismissed');

-- Companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  size public.company_size,
  country TEXT,
  city TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own companies" ON public.companies FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  position TEXT,
  source public.contact_source NOT NULL DEFAULT 'manual',
  status public.contact_status NOT NULL DEFAULT 'lead',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tags TEXT[],
  notes TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON public.contacts FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  stage public.deal_stage NOT NULL DEFAULT 'lead',
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  lost_reason TEXT
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deals" ON public.deals FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  type public.activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own activities" ON public.activities FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Voice Leads table
CREATE TABLE public.voice_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  caller_name TEXT NOT NULL,
  caller_phone TEXT,
  transcript TEXT,
  summary TEXT,
  intent public.voice_lead_intent NOT NULL DEFAULT 'other',
  status public.voice_lead_status NOT NULL DEFAULT 'new',
  converted_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ai_score INTEGER DEFAULT 0 CHECK (ai_score >= 0 AND ai_score <= 100),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.voice_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own voice_leads" ON public.voice_leads FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Indexes
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_owner ON public.deals(owner_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_activities_owner ON public.activities(owner_id);
CREATE INDEX idx_activities_due ON public.activities(due_date);
CREATE INDEX idx_activities_contact ON public.activities(contact_id);
CREATE INDEX idx_activities_deal ON public.activities(deal_id);
CREATE INDEX idx_voice_leads_status ON public.voice_leads(status);
CREATE INDEX idx_voice_leads_owner ON public.voice_leads(owner_id);
