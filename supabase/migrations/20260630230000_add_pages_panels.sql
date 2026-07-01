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
