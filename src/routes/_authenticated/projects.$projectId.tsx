import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Sparkles,
  Users,
  BookOpen,
  Layers,
  Image as ImageIcon,
  FileDown,
} from "lucide-react";

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
  current_step: string | null;
  color_mode: string;
  reading_direction: string;
  page_format: string;
  genre: string | null;
  tone: string | null;
  initial_idea: string | null;
  updated_at: string;
};

type ProjectBible = {
  project_id: string;
  content: unknown;
  model: string;
  generations_count: number;
  updated_at: string;
};

type Character = {
  id: string;
  name: string;
  role: string | null;
  age: string | null;
  personality: string | null;
  objective: string | null;
  conflict: string | null;
  appearance: string | null;
  visual_lock: Record<string, unknown> | null;
  sort_order: number;
};

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [bible, setBible] = useState<ProjectBible | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatingChars, setGeneratingChars] = useState(false);
  const [charError, setCharError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) {
          setNotFound(true);
          return;
        }

        setProject(data as Project);
        const { data: bibleData } = await supabase
          .from("project_bibles")
          .select("project_id,content,model,generations_count,updated_at")
          .eq("project_id", projectId)
          .maybeSingle();
        setBible((bibleData as ProjectBible | null) ?? null);

        const { data: charData } = await supabase
          .from("characters")
          .select("id,name,role,age,personality,objective,conflict,appearance,visual_lock,sort_order")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });
        setCharacters((charData as Character[] | null) ?? []);
      });
  }, [projectId]);

  async function generateBible() {
    setGenerating(true);
    setGenerationError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const response = await fetch(`/api/projects/${projectId}/generate-bible`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar o planejamento.");

      setBible(payload.bible as ProjectBible);
      setProject((current) =>
        current ? { ...current, status: "awaiting_approval", current_step: "bible" } : current,
      );
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Erro ao gerar o planejamento.");
    } finally {
      setGenerating(false);
    }
  }

  async function generateCharacters() {
    setGeneratingChars(true);
    setCharError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const response = await fetch(`/api/projects/${projectId}/generate-characters`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar personagens.");

      setCharacters((payload.characters as Character[]) ?? []);
      setProject((current) =>
        current ? { ...current, status: "creating_characters", current_step: "characters" } : current,
      );
    } catch (err) {
      setCharError(err instanceof Error ? err.message : "Erro ao gerar personagens.");
    } finally {
      setGeneratingChars(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-4xl">Projeto não encontrado</h1>
        <Link to="/dashboard" className="mt-6 inline-block bg-ink px-4 py-2 text-paper">
          Voltar
        </Link>
      </div>
    );
  }
  if (!project) return <div className="mx-auto max-w-3xl px-6 py-20">Carregando...</div>;

  const steps = [
    { icon: Sparkles, t: "Planejamento", d: "História, universo, regras.", disabled: false },
    {
      icon: Users,
      t: "Personagens",
      d: "Detecção, fichas e Character Lock.",
      disabled: !bible,
    },
    { icon: BookOpen, t: "Roteiro", d: "Capítulos, cenas e diálogos.", disabled: true },
    { icon: Layers, t: "Storyboard", d: "Layout das páginas e quadros.", disabled: true },
    { icon: ImageIcon, t: "Geração visual", d: "Arte de cada quadro.", disabled: true },
    { icon: FileDown, t: "Exportar PDF", d: "Pronto para publicar.", disabled: true },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Todos os projetos
      </Link>

      <div className="ink-border mt-4 bg-card p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <h1 className="font-display text-4xl">{project.title}</h1>
            {project.description && (
              <p className="mt-2 text-muted-foreground">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[
                project.genre,
                project.tone,
                project.color_mode.startsWith("bw") ? "P&B" : "Colorido",
                project.reading_direction === "rtl" ? "RTL" : "LTR",
                project.page_format,
              ]
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag as string}
                    className="bg-ink px-2 py-1 font-semibold uppercase tracking-wider text-paper"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          </div>
          <button
            type="button"
            onClick={generateBible}
            disabled={generating}
            className="bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground disabled:opacity-50"
          >
            {generating
              ? "GERANDO..."
              : bible
                ? "REFAZER PLANEJAMENTO"
                : "COMEÇAR MEU MANGÁ"}
          </button>
        </div>

        {project.initial_idea && (
          <div className="mt-6 border-t-2 border-ink/20 pt-4">
            <div className="font-display text-sm uppercase tracking-widest text-muted-foreground">
              Sua ideia
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{project.initial_idea}</p>
          </div>
        )}
      </div>

      {generationError && (
        <div className="mt-4 border-2 border-accent bg-accent/10 p-4 text-sm text-accent">
          {generationError}
        </div>
      )}

      {bible && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">PLANEJAMENTO DA OBRA</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Modelo: {bible.model} • Gerações: {bible.generations_count}
              </p>
            </div>
            <span className="bg-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-paper">
              Aguardando aprovação
            </span>
          </div>
          <pre className="mt-5 max-h-[560px] overflow-auto whitespace-pre-wrap border-2 border-ink bg-background p-4 text-xs leading-relaxed">
            {JSON.stringify(bible.content, null, 2)}
          </pre>
        </section>
      )}

      {bible && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">PERSONAGENS</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Fichas e Character Lock extraídos do planejamento da obra.
              </p>
            </div>
            <button
              type="button"
              onClick={generateCharacters}
              disabled={generatingChars}
              className="bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground disabled:opacity-50"
            >
              {generatingChars
                ? "GERANDO..."
                : characters.length
                  ? "REGERAR PERSONAGENS"
                  : "GERAR PERSONAGENS"}
            </button>
          </div>

          {charError && (
            <div className="mt-4 border-2 border-accent bg-accent/10 p-4 text-sm text-accent">
              {charError}
            </div>
          )}

          {characters.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Nenhum personagem ainda. Gere o elenco do capítulo 1 a partir do planejamento.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {characters.map((character) => (
                <article key={character.id} className="border-2 border-ink bg-background p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl">{character.name}</h3>
                    {character.role && (
                      <span className="bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
                        {character.role}
                      </span>
                    )}
                  </div>
                  {character.age && (
                    <p className="mt-1 text-xs text-muted-foreground">{character.age}</p>
                  )}
                  {character.appearance && (
                    <p className="mt-3 text-sm">{character.appearance}</p>
                  )}
                  <dl className="mt-3 space-y-1.5 text-xs">
                    {character.objective && (
                      <div>
                        <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                          Objetivo:{" "}
                        </dt>
                        <dd className="inline">{character.objective}</dd>
                      </div>
                    )}
                    {character.conflict && (
                      <div>
                        <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                          Conflito:{" "}
                        </dt>
                        <dd className="inline">{character.conflict}</dd>
                      </div>
                    )}
                    {character.personality && (
                      <div>
                        <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                          Personalidade:{" "}
                        </dt>
                        <dd className="inline">{character.personality}</dd>
                      </div>
                    )}
                  </dl>
                  {character.visual_lock && Object.keys(character.visual_lock).length > 0 && (
                    <div className="mt-3 border-t-2 border-ink/20 pt-3">
                      <div className="font-display text-[11px] uppercase tracking-widest text-accent">
                        Character Lock
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(character.visual_lock).map(([key, value]) => (
                          <span
                            key={key}
                            className="border border-ink/40 bg-muted px-2 py-0.5 text-[11px]"
                            title={String(value)}
                          >
                            <span className="font-semibold">{key}:</span> {String(value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <h2 className="mt-10 font-display text-2xl">PRÓXIMAS ETAPAS</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        As etapas de IA serão liberadas conforme cada fase é implementada.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(({ icon: Icon, t, d, disabled }) => (
          <div key={t} className={`ink-border bg-card p-5 ${disabled ? "opacity-60" : ""}`}>
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
