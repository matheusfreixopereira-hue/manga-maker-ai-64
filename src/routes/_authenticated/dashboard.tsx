import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Meus mangás — Tinta" }] }),
  component: Dashboard,
});

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  color_mode: string;
  reading_direction: string;
  cover_url: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  analyzing_story: "Analisando história",
  awaiting_approval: "Aguardando aprovação",
  creating_characters: "Criando personagens",
  creating_storyboard: "Criando storyboard",
  generating_images: "Gerando imagens",
  reviewing: "Em revisão",
  ready_to_export: "Pronto para exportar",
  exported: "Exportado",
  error: "Erro",
};

function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id,title,description,status,color_mode,reading_direction,cover_url,updated_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-5xl">MEUS MANGÁS</h1>
          <p className="mt-2 text-muted-foreground">Continue de onde parou ou comece uma nova obra.</p>
        </div>
        <Link
          to="/projects/new"
          className="ink-border flex items-center gap-2 bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground"
        >
          <Plus className="h-5 w-5" /> NOVO MANGÁ
        </Link>
      </div>

      {projects === null ? (
        <div className="mt-10 text-muted-foreground">Carregando...</div>
      ) : projects.length === 0 ? (
        <div className="ink-border mt-10 bg-card p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-4 font-display text-3xl">SUA ESTANTE ESTÁ VAZIA</h2>
          <p className="mt-2 text-muted-foreground">Crie seu primeiro mangá a partir de uma ideia, roteiro ou documento.</p>
          <Link
            to="/projects/new"
            className="mt-6 inline-block bg-ink px-6 py-3 font-display tracking-wide text-paper"
          >
            COMEÇAR AGORA
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="ink-border group block bg-card transition hover:-translate-y-0.5"
            >
              <div className="screentone aspect-[3/4] bg-muted">
                {p.cover_url && (
                  <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="border-t-2 border-ink p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-display text-xl">{p.title}</h3>
                  <span className="shrink-0 bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
                    {p.color_mode.startsWith("bw") ? "P&B" : "COR"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {STATUS_LABEL[p.status] ?? p.status} • {p.reading_direction === "rtl" ? "Direita → Esquerda" : "Esquerda → Direita"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
