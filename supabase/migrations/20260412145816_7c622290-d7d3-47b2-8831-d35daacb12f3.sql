
-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  booking_token UUID DEFAULT gen_random_uuid(),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own appointments"
  ON public.appointments FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Public read for booking confirmation via token
CREATE POLICY "Public read by booking token"
  ON public.appointments FOR SELECT
  USING (booking_token IS NOT NULL);

-- Public insert for booking page (no auth required)
CREATE POLICY "Public booking insert"
  ON public.appointments FOR INSERT
  WITH CHECK (true);

-- Create booking_settings table
CREATE TABLE public.booking_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  slot_duration INTEGER NOT NULL DEFAULT 30,
  available_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_hour INTEGER NOT NULL DEFAULT 9,
  end_hour INTEGER NOT NULL DEFAULT 17,
  booking_page_slug TEXT UNIQUE,
  booking_page_title TEXT DEFAULT 'Termin buchen',
  booking_page_description TEXT DEFAULT 'Wählen Sie einen passenden Termin aus.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own booking settings"
  ON public.booking_settings FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Public read for booking page
CREATE POLICY "Public read booking settings by slug"
  ON public.booking_settings FOR SELECT
  USING (booking_page_slug IS NOT NULL);
