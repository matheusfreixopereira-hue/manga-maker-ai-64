import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Users, BookOpen, Layers, Image as ImageIcon, FileDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — Tinta" }] }),
  component: ProjectOverview,
});

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  creation_mode: string;
  color_mode: string;
  reading_direction: string;
  page_format: string;
  genre: string | null;
  tone: string | null;
  initial_idea: string | null;
  updated_at: string;
};

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setProject(data as Project);
    });
  }, [projectId]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-4xl">Projeto não encontrado</h1>
        <Link to="/dashboard" className="mt-6 inline-block bg-ink px-4 py-2 text-paper">Voltar</Link>
      </div>
    );
  }
  if (!project) return <div className="mx-auto max-w-3xl px-6 py-20">Carregando...</div>;

  const steps = [
    { icon: Sparkles, t: "Bíblia da Obra", d: "História, universo, regras.", disabled: true },
    { icon: Users, t: "Personagens", d: "Detecção, fichas e Character Lock.", disabled: true },
    { icon: BookOpen, t: "Roteiro", d: "Capítulos, cenas e diálogos.", disabled: true },
    { icon: Layers, t: "Storyboard", d: "Layout das páginas e quadros.", disabled: true },
    { icon: ImageIcon, t: "Geração visual", d: "Arte de cada quadro.", disabled: true },
    { icon: FileDown, t: "Exportar PDF", d: "Pronto para publicar.", disabled: true },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Todos os projetos
      </Link>

      <div className="ink-border mt-4 bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">{project.title}</h1>
            {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[
                project.genre,
                project.tone,
                project.color_mode.startsWith("bw") ? "P&B" : "Colorido",
                project.reading_direction === "rtl" ? "RTL" : "LTR",
                project.page_format,
              ].filter(Boolean).map((tag) => (
                <span key={tag as string} className="bg-ink px-2 py-1 font-semibold uppercase tracking-wider text-paper">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {project.initial_idea && (
          <div className="mt-6 border-t-2 border-ink/20 pt-4">
            <div className="font-display text-sm uppercase tracking-widest text-muted-foreground">Sua ideia</div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{project.initial_idea}</p>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-display text-2xl">PRÓXIMAS ETAPAS</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        As etapas de IA serão liberadas conforme cada fase é implementada.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(({ icon: Icon, t, d, disabled }) => (
          <div
            key={t}
            className={`ink-border bg-card p-5 ${disabled ? "opacity-60" : ""}`}
          >
            <Icon className="h-7 w-7 text-accent" />
            <h3 className="mt-2 font-display text-xl">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            {disabled && (
              <span className="mt-3 inline-block bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Em breve
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
