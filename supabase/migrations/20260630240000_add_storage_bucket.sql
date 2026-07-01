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
