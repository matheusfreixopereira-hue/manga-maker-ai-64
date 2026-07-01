-- Characters (Personagens): per-project cast with Character Lock consistency data
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  age TEXT,
  personality TEXT,
  objective TEXT,
  conflict TEXT,
  appearance TEXT,
  -- Character Lock: canonical descriptors reused for visual consistency across pages
  visual_lock JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characters_owner_all" ON public.characters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER characters_set_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX characters_project_id_idx ON public.characters(project_id, sort_order);
CREATE INDEX characters_user_id_idx ON public.characters(user_id);
