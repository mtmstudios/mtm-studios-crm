-- Review request status enum
CREATE TYPE public.review_request_status AS ENUM ('pending', 'sent', 'completed', 'declined');

-- Review requests table
CREATE TABLE public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  platform TEXT NOT NULL DEFAULT 'google',
  status public.review_request_status NOT NULL DEFAULT 'pending',
  review_url TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own review_requests" ON public.review_requests FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'google',
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  review_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_url TEXT,
  responded BOOLEAN NOT NULL DEFAULT false,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reviews" ON public.reviews FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Snapshots table
CREATE TABLE public.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots" ON public.snapshots FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);