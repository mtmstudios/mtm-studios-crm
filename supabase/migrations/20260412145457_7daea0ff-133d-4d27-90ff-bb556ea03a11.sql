
-- Create enum for automation action types
CREATE TYPE public.automation_action_type AS ENUM ('send_email', 'send_sms', 'create_task', 'webhook');

-- Create pipeline_automations table
CREATE TABLE public.pipeline_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  deal_stage public.deal_stage NOT NULL,
  action_type public.automation_action_type NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users manage own automations"
  ON public.pipeline_automations
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
