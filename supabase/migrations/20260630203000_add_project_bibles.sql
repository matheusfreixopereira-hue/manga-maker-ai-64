CREATE TABLE public.project_bibles (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  model TEXT NOT NULL,
  generations_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_bibles TO authenticated;
GRANT ALL ON public.project_bibles TO service_role;

ALTER TABLE public.project_bibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_bibles_owner_all" ON public.project_bibles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER project_bibles_set_updated_at BEFORE UPDATE ON public.project_bibles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX project_bibles_user_id_idx ON public.project_bibles(user_id);
