
-- Drop the overly permissive insert policy
DROP POLICY "Public booking insert" ON public.appointments;

-- Create a more restrictive public insert policy
CREATE POLICY "Public booking insert"
  ON public.appointments FOR INSERT
  WITH CHECK (
    contact_name IS NOT NULL 
    AND contact_email IS NOT NULL 
    AND status = 'scheduled'
  );
