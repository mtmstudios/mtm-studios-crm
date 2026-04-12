ALTER TABLE public.companies 
ADD COLUMN status text NOT NULL DEFAULT 'lead' 
CHECK (status IN ('lead', 'prospect', 'customer', 'inactive'));