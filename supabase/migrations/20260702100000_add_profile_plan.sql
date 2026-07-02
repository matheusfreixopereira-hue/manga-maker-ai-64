-- Plano do usuário: free (Gemini Flash + imagem gratuita) ou pro (OpenAI GPT + gpt-image-1)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro'));
