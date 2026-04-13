
-- Add public access policies for all tables (no auth required)
CREATE POLICY "Public read all contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Public write all contacts" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all contacts" ON public.contacts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all contacts" ON public.contacts FOR DELETE USING (true);

CREATE POLICY "Public read all companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public write all companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all companies" ON public.companies FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all companies" ON public.companies FOR DELETE USING (true);

CREATE POLICY "Public read all deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Public write all deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all deals" ON public.deals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all deals" ON public.deals FOR DELETE USING (true);

CREATE POLICY "Public read all activities" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Public write all activities" ON public.activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all activities" ON public.activities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all activities" ON public.activities FOR DELETE USING (true);

CREATE POLICY "Public read all voice_leads" ON public.voice_leads FOR SELECT USING (true);
CREATE POLICY "Public write all voice_leads" ON public.voice_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all voice_leads" ON public.voice_leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all voice_leads" ON public.voice_leads FOR DELETE USING (true);

CREATE POLICY "Public read all conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "Public write all conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all conversations" ON public.conversations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all conversations" ON public.conversations FOR DELETE USING (true);

CREATE POLICY "Public read all messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Public write all messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all messages" ON public.messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all messages" ON public.messages FOR DELETE USING (true);

CREATE POLICY "Public read all reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Public write all reviews" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all reviews" ON public.reviews FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all reviews" ON public.reviews FOR DELETE USING (true);

CREATE POLICY "Public read all review_requests" ON public.review_requests FOR SELECT USING (true);
CREATE POLICY "Public write all review_requests" ON public.review_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all review_requests" ON public.review_requests FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all review_requests" ON public.review_requests FOR DELETE USING (true);

CREATE POLICY "Public read all snapshots" ON public.snapshots FOR SELECT USING (true);
CREATE POLICY "Public write all snapshots" ON public.snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all snapshots" ON public.snapshots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all snapshots" ON public.snapshots FOR DELETE USING (true);

CREATE POLICY "Public read all pipeline_automations" ON public.pipeline_automations FOR SELECT USING (true);
CREATE POLICY "Public write all pipeline_automations" ON public.pipeline_automations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all pipeline_automations" ON public.pipeline_automations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all pipeline_automations" ON public.pipeline_automations FOR DELETE USING (true);

CREATE POLICY "Public read all booking_settings" ON public.booking_settings FOR SELECT USING (true);
CREATE POLICY "Public write all booking_settings" ON public.booking_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all booking_settings" ON public.booking_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all booking_settings" ON public.booking_settings FOR DELETE USING (true);

CREATE POLICY "Public read all appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Public write all appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update all appointments" ON public.appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete all appointments" ON public.appointments FOR DELETE USING (true);
