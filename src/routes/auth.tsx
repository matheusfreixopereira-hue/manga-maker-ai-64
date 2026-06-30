import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Tinta" },
      { name: "description", content: "Acesse sua conta para criar e gerenciar seus mangás." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Falha ao entrar com Google");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden bg-ink p-12 text-paper md:block">
        <div className="screentone absolute inset-0 opacity-20" />
        <Link to="/" className="relative font-display text-3xl tracking-wide">墨 TINTA</Link>
        <div className="relative mt-32">
          <h2 className="font-display text-5xl leading-tight">
            SUA HISTÓRIA<br />MERECE<br /><span className="text-accent">VIRAR MANGÁ.</span>
          </h2>
          <p className="mt-6 max-w-md text-paper/70">
            Crie obras completas a partir de ideias, roteiros ou documentos. Aprove cada etapa antes de gerar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden">
            <Link to="/" className="font-display text-2xl">墨 TINTA</Link>
          </div>
          <h1 className="mt-6 font-display text-4xl">
            {mode === "signin" ? "ENTRAR" : "CRIAR CONTA"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "Acesse seus projetos." : "Comece a criar seu primeiro mangá."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 border-2 border-ink bg-card px-4 py-3 font-medium hover:bg-muted disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3-3C17.2 2.2 14.8 1.2 12 1.2 7.4 1.2 3.4 3.8 1.5 7.7l3.5 2.7C6 7.5 8.8 5.4 12 5.4z"/><path fill="#34A853" d="M23 12.2c0-.8-.1-1.6-.2-2.4H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-1.9 3.6-4.8 3.6-8.2z"/><path fill="#4A90E2" d="M5 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4L1.5 7c-.8 1.5-1.3 3.2-1.3 5s.5 3.5 1.3 5l3.5-2.6z"/><path fill="#FBBC05" d="M12 22.8c2.8 0 5.2-.9 6.9-2.5l-3.5-2.7c-1 .7-2.2 1-3.4 1-3.2 0-5.9-2.1-7-5l-3.5 2.7C3.4 20.2 7.4 22.8 12 22.8z"/></svg>
            Continuar com Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OU <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium">Nome</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full border-2 border-ink bg-card px-3 py-2"
                  placeholder="Como devemos te chamar?"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border-2 border-ink bg-card px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border-2 border-ink bg-card px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink px-4 py-3 font-display text-lg tracking-wide text-paper disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "ENTRAR" : "CRIAR CONTA"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            {mode === "signin" ? (
              <>Não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="font-semibold text-accent">Criar agora</button>
              </>
            ) : (
              <>Já tem conta?{" "}
                <button onClick={() => setMode("signin")} className="font-semibold text-accent">Entrar</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
