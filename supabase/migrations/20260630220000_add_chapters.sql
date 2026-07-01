-- Roteiro (Fase 4): capítulos com cenas e diálogos gerados a partir da Bíblia + Personagens.
-- Segue a tabela `chapters` do PRD (§30); o roteiro estruturado (cenas/diálogos) fica em `script` (jsonb).
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  synopsis TEXT,
  objective TEXT,
  conflict TEXT,
  hook TEXT,
  estimated_pages INTEGER,
  -- Roteiro estruturado: { cenas: [ { numero, local, horario, personagens[], objetivo,
  -- acao, emocao, transicao, dialogos: [ { tipo, personagem, texto } ] } ] }
  script JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT,
  generations_count INTEGER NOT NULL DEFAULT 1,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, chapter_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapters_owner_all" ON public.chapters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER chapters_set_updated_at BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX chapters_project_id_idx ON public.chapters(project_id, chapter_number);
CREATE INDEX chapters_user_id_idx ON public.chapters(user_id);
