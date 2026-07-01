-- Migrations do pipeline NÃO aplicadas no banco rcsjyhgslimfsclpltog.
-- Rode isto no SQL Editor do Supabase (ou via db push). Idempotente onde possível.

-- ===== 20260630203000_add_project_bibles.sql =====
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

-- ===== 20260630210000_add_project_characters.sql =====
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

-- ===== 20260630220000_add_chapters.sql =====
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

-- ===== 20260630230000_add_pages_panels.sql =====
-- Storyboard (Fase 4/5): páginas e quadros gerados a partir do roteiro (PRD §16, §17, §30).
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  reading_order INTEGER NOT NULL DEFAULT 0,
  final_image_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages_owner_all" ON public.pages
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER pages_set_updated_at BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX pages_chapter_idx ON public.pages(chapter_id, page_number);
CREATE INDEX pages_project_idx ON public.pages(project_id);

CREATE TABLE public.panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  panel_number INTEGER NOT NULL,
  reading_order INTEGER NOT NULL DEFAULT 0,
  -- geometria em frações 0..1 da página: { x, y, w, h }
  geometry JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":1,"h":1}'::jsonb,
  scene_description TEXT,
  framing TEXT,
  camera TEXT,
  -- prompt canônico da imagem (sem textos/balões), montado com Character Lock (PRD §20)
  prompt TEXT,
  characters JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- balões: [ { tipo, personagem, texto, position:{x,y} } ]
  dialogues JSONB NOT NULL DEFAULT '[]'::jsonb,
  asset_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.panels TO authenticated;
GRANT ALL ON public.panels TO service_role;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "panels_owner_all" ON public.panels
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER panels_set_updated_at BEFORE UPDATE ON public.panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX panels_page_idx ON public.panels(page_id, reading_order);
CREATE INDEX panels_project_idx ON public.panels(project_id);

-- ===== 20260630240000_add_storage_bucket.sql =====
-- Bucket para a arte gerada dos quadros. Público em leitura (para <img src> direto no MVP);
-- escrita restrita ao dono via pasta {user_id}/... (PRD §31 pede privado+URL assinada — evoluir depois).
INSERT INTO storage.buckets (id, name, public)
VALUES ('manga-assets', 'manga-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "manga_assets_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'manga-assets');

CREATE POLICY "manga_assets_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'manga-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "manga_assets_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'manga-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'manga-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "manga_assets_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'manga-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

