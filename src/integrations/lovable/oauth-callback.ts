// Completa o login OAuth quando o broker do Lovable volta via redirect de página
// inteira (fluxo usado fora de iframe, ex: app aberta em aba própria).
//
// Nesse modo o SDK (@lovable.dev/cloud-auth-js) faz `window.location.href = broker`
// e retorna { redirected: true } — ele NÃO processa o retorno. O broker devolve os
// tokens na URL (hash no fluxo implícito, ou query), e cabe ao app trocá-los por uma
// sessão do Supabase. Sem isto, a sessão nunca persiste e toda rota autenticada
// devolve o usuário para a tela de login (loop infinito).
import { supabase } from "@/integrations/supabase/client";

export type OAuthCallbackResult =
  | { status: "signed_in" }
  | { status: "error"; message: string }
  | { status: "none" };

function readAuthParams(): URLSearchParams {
  const merged = new URLSearchParams();
  if (typeof window === "undefined") return merged;

  const search = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hash = new URLSearchParams(rawHash);

  // Query primeiro; hash sobrescreve (o fluxo implícito entrega tokens no hash).
  for (const [key, value] of search) merged.set(key, value);
  for (const [key, value] of hash) merged.set(key, value);
  return merged;
}

export async function completeLovableOAuthRedirect(): Promise<OAuthCallbackResult> {
  if (typeof window === "undefined") return { status: "none" };

  const params = readAuthParams();
  const errorCode = params.get("error");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const code = params.get("code");

  if (!errorCode && !accessToken && !refreshToken && !code) return { status: "none" };

  // Remove os tokens/código/erro da URL de imediato para que um refresh não os reprocesse.
  window.history.replaceState({}, "", window.location.origin + window.location.pathname);

  if (errorCode) {
    return { status: "error", message: params.get("error_description") ?? errorCode };
  }

  // Fluxo implícito: tokens direto na URL.
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "signed_in" };
  }

  // Fluxo PKCE: troca o código por sessão.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { status: "error", message: error.message };
    return { status: "signed_in" };
  }

  return { status: "error", message: "Retorno de login sem tokens." };
}
