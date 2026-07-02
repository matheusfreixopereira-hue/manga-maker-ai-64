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

type Dialogue = { tipo?: string; personagem?: string; texto?: string };
type Scene = {
  numero?: number;
  local?: string;
  horario?: string;
  personagens?: string[];
  objetivo?: string;
  acao?: string;
  emocao?: string;
  transicao?: string;
  dialogos?: Dialogue[];
};
type Chapter = {
  id: string;
  chapter_number: number;
  title: string | null;
  synopsis: string | null;
  objective: string | null;
  conflict: string | null;
  hook: string | null;
  estimated_pages: number | null;
  script: { cenas?: Scene[] } | null;
  model: string | null;
  generations_count: number;
};

type Geometry = { x: number; y: number; w: number; h: number };
type Panel = {
  id: string;
  page_id: string;
  panel_number: number;
  reading_order: number;
  geometry: Geometry | null;
  scene_description: string | null;
  framing: string | null;
  camera: string | null;
  prompt: string | null;
  characters: string[] | null;
  dialogues: Dialogue[] | null;
  asset_url: string | null;
  status: string;
};
type Page = {
  id: string;
  page_number: number;
  reading_order: number;
  panels: Panel[];
};

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Desembrulha o conteúdo do planejamento: lida com o formato antigo { resposta: "..." }
// e com JSON salvo como string (dupla codificação).
function normalizeBible(raw: unknown): unknown {
  let c = raw;
  if (c && typeof c === "object" && "resposta" in c) {
    const r = (c as { resposta?: unknown }).resposta;
    if (typeof r === "string") c = r;
  }
  for (let i = 0; i < 3 && typeof c === "string"; i++) {
    try {
      c = JSON.parse(c);
    } catch {
      break;
    }
  }
  return c;
}

// Renderiza qualquer estrutura JSON de forma legível (texto, listas e cards).
function RenderValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    const allPrimitive = value.every((v) => v === null || typeof v !== "object");
    if (allPrimitive) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-3">
        {value.map((v, i) => (
          <div key={i} className="border-2 border-ink/40 bg-background p-3">
            <RenderValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k}>
          <div className="font-display text-[11px] uppercase tracking-widest text-accent">
            {humanizeKey(k)}
          </div>
          <div className="mt-0.5 text-sm">
            <RenderValue value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

const BALLOON_STYLE: Record<string, string> = {
  pensamento: "rounded-[50%] border-dashed",
  narracao: "rounded-none bg-paper",
  grito: "rounded-sm border-[3px]",
  sussurro: "rounded-full border-dotted italic",
  onomatopeia: "border-none bg-transparent font-display text-lg",
};

function PageView({ page, onRegen }: { page: Page; onRegen?: (panelId: string) => void }) {
  const panels = [...page.panels].sort((a, b) => a.reading_order - b.reading_order);
  return (
    <div
      className="manga-page relative mx-auto w-full max-w-[520px] overflow-hidden border-2 border-ink bg-paper"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      {panels.map((panel) => {
        const g = panel.geometry ?? { x: 0, y: 0, w: 1, h: 1 };
        return (
          <div
            key={panel.id}
            className="absolute overflow-hidden border-2 border-ink"
            style={{
              left: `${g.x * 100}%`,
              top: `${g.y * 100}%`,
              width: `${g.w * 100}%`,
              height: `${g.h * 100}%`,
            }}
          >
            {panel.asset_url ? (
              <img
                src={panel.asset_url}
                alt={panel.scene_description ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted p-2 text-center">
                <span className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                  Quadro {panel.panel_number}
                </span>
                <span className="line-clamp-3 text-[10px] leading-tight text-muted-foreground">
                  {panel.framing ? `${panel.framing} — ` : ""}
                  {panel.scene_description}
                </span>
                {onRegen && (
                  <button
                    type="button"
                    onClick={() => onRegen(panel.id)}
                    className="mt-1 bg-ink px-2 py-0.5 text-[9px] uppercase tracking-wider text-paper"
                  >
                    Gerar arte
                  </button>
                )}
              </div>
            )}

            {/* Balões: pequenos e nos cantos (estilo mangá), nunca cobrindo o centro/rosto.
                Máx. 2 no topo; o restante vai para a base do quadro. Texto clampado em
                4 linhas para nenhum balão engolir a arte. Editáveis. */}
            {(() => {
              const dialogues = (panel.dialogues ?? []).slice(0, 4);
              const top = dialogues.slice(0, 2);
              const bottom = dialogues.slice(2);
              const renderBalloon = (d: Dialogue, di: number) => {
                const tipo = (d.tipo ?? "dialogo").toLowerCase();
                const extra = BALLOON_STYLE[tipo] ?? "rounded-2xl";
                const isNarration = tipo === "narracao";
                // Diálogos alternam canto direito/esquerdo (leitura mangá); narração fica à esquerda.
                const side = isNarration ? "self-start" : di % 2 === 0 ? "self-end" : "self-start";
                const width = isNarration ? "max-w-[65%]" : "max-w-[45%]";
                return (
                  <div
                    key={di}
                    contentEditable
                    suppressContentEditableWarning
                    className={`pointer-events-auto ${side} ${width} line-clamp-4 border-2 border-ink bg-paper px-1.5 py-0.5 text-center text-[9px] leading-tight text-ink shadow-sm outline-none ${extra}`}
                  >
                    {d.texto}
                  </div>
                );
              };
              return (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex max-h-[40%] flex-col gap-1 overflow-hidden p-1.5">
                    {top.map((d, di) => renderBalloon(d, di))}
                  </div>
                  {bottom.length > 0 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-[35%] flex-col justify-end gap-1 overflow-hidden p-1.5">
                      {bottom.map((d, di) => renderBalloon(d, di + top.length))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        );
      })}
      <span className="absolute bottom-1 right-2 font-display text-xs text-ink/60">
        {page.page_number}
      </span>
    </div>
  );
}

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [bible, setBible] = useState<ProjectBible | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatingChars, setGeneratingChars] = useState(false);
  const [charError, setCharError] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [imgProgress, setImgProgress] = useState<{ done: number; total: number } | null>(null);

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

        const { data: chapterData } = await supabase
          .from("chapters")
          .select(
            "id,chapter_number,title,synopsis,objective,conflict,hook,estimated_pages,script,model,generations_count",
          )
          .eq("project_id", projectId)
          .eq("chapter_number", 1)
          .maybeSingle();
        setChapter((chapterData as Chapter | null) ?? null);

        await loadPages();
      });
  }, [projectId]);

  async function loadPages() {
    const { data: pageRows } = await supabase
      .from("pages")
      .select("id,page_number,reading_order")
      .eq("project_id", projectId)
      .order("page_number", { ascending: true });
    if (!pageRows || pageRows.length === 0) {
      setPages([]);
      return;
    }
    const { data: panelRows } = await supabase
      .from("panels")
      .select(
        "id,page_id,panel_number,reading_order,geometry,scene_description,framing,camera,prompt,characters,dialogues,asset_url,status",
      )
      .eq("project_id", projectId)
      .order("reading_order", { ascending: true });
    const panelsByPage = new Map<string, Panel[]>();
    for (const panel of (panelRows as Panel[] | null) ?? []) {
      const list = panelsByPage.get(panel.page_id) ?? [];
      list.push(panel);
      panelsByPage.set(panel.page_id, list);
    }
    setPages(
      (pageRows as { id: string; page_number: number; reading_order: number }[]).map((p) => ({
        ...p,
        panels: panelsByPage.get(p.id) ?? [],
      })),
    );
  }

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

  async function generateScript() {
    setGeneratingScript(true);
    setScriptError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const response = await fetch(`/api/projects/${projectId}/generate-script`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar roteiro.");

      setChapter(payload.chapter as Chapter);
      setProject((current) =>
        current ? { ...current, status: "creating_storyboard", current_step: "script" } : current,
      );
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : "Erro ao gerar roteiro.");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function authHeader() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    return { authorization: `Bearer ${token}` };
  }

  async function generateStoryboard() {
    setGeneratingStoryboard(true);
    setStoryboardError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(`/api/projects/${projectId}/generate-storyboard`, {
        method: "POST",
        headers,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar storyboard.");
      await loadPages();
      setProject((current) =>
        current ? { ...current, status: "creating_storyboard", current_step: "storyboard" } : current,
      );
    } catch (err) {
      setStoryboardError(err instanceof Error ? err.message : "Erro ao gerar storyboard.");
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  async function generateImages() {
    const allPanels = pages.flatMap((p) => p.panels);
    const pending = allPanels.filter((p) => !p.asset_url);
    if (pending.length === 0) return;
    setGeneratingImages(true);
    setImagesError(null);
    setImgProgress({ done: 0, total: pending.length });
    try {
      const headers = await authHeader();
      for (let i = 0; i < pending.length; i++) {
        const panel = pending[i];
        const response = await fetch(
          `/api/projects/${projectId}/panels/${panel.id}/generate-image`,
          { method: "POST", headers },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar imagem do quadro.");
        setImgProgress({ done: i + 1, total: pending.length });
        await loadPages();
      }
      setProject((current) =>
        current ? { ...current, status: "generating_images", current_step: "images" } : current,
      );
    } catch (err) {
      setImagesError(err instanceof Error ? err.message : "Erro ao gerar imagens.");
    } finally {
      setGeneratingImages(false);
    }
  }

  async function regenPanelImage(panelId: string) {
    setImagesError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/projects/${projectId}/panels/${panelId}/generate-image`,
        { method: "POST", headers },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao gerar imagem do quadro.");
      await loadPages();
    } catch (err) {
      setImagesError(err instanceof Error ? err.message : "Erro ao gerar imagem.");
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
    { icon: BookOpen, t: "Roteiro", d: "Capítulos, cenas e diálogos.", disabled: !bible },
    { icon: Layers, t: "Storyboard", d: "Layout das páginas e quadros.", disabled: !chapter },
    {
      icon: ImageIcon,
      t: "Geração visual",
      d: "Arte de cada quadro.",
      disabled: pages.length === 0,
    },
    { icon: FileDown, t: "Exportar PDF", d: "Pronto para publicar.", disabled: pages.length === 0 },
  ];

  return (
    <>
    <div className="no-print mx-auto max-w-5xl px-6 py-10">
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
          <div className="mt-5 max-h-[640px] overflow-auto border-2 border-ink bg-background p-5 leading-relaxed">
            <RenderValue value={normalizeBible(bible.content)} />
          </div>
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

      {bible && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">ROTEIRO — CAPÍTULO 1</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cenas e diálogos do capítulo 1, fiéis ao planejamento e aos personagens.
                {chapter && (
                  <>
                    {" "}
                    Modelo: {chapter.model} • Gerações: {chapter.generations_count}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={generateScript}
              disabled={generatingScript}
              className="bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground disabled:opacity-50"
            >
              {generatingScript ? "GERANDO..." : chapter ? "REGERAR ROTEIRO" : "GERAR ROTEIRO"}
            </button>
          </div>

          {characters.length === 0 && !chapter && (
            <p className="mt-4 text-xs text-muted-foreground">
              Dica: gere os personagens primeiro para o roteiro usar os nomes e mantê-los
              consistentes.
            </p>
          )}

          {scriptError && (
            <div className="mt-4 border-2 border-accent bg-accent/10 p-4 text-sm text-accent">
              {scriptError}
            </div>
          )}

          {!chapter ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Nenhum roteiro ainda. Gere o capítulo 1 em cenas e diálogos.
            </p>
          ) : (
            <div className="mt-5">
              <div className="border-2 border-ink bg-background p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl">{chapter.title ?? "Capítulo 1"}</h3>
                  {chapter.estimated_pages != null && (
                    <span className="bg-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-paper">
                      ~{chapter.estimated_pages} páginas
                    </span>
                  )}
                </div>
                {chapter.synopsis && <p className="mt-2 text-sm">{chapter.synopsis}</p>}
                <dl className="mt-3 space-y-1.5 text-xs">
                  {chapter.objective && (
                    <div>
                      <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                        Objetivo:{" "}
                      </dt>
                      <dd className="inline">{chapter.objective}</dd>
                    </div>
                  )}
                  {chapter.conflict && (
                    <div>
                      <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                        Conflito:{" "}
                      </dt>
                      <dd className="inline">{chapter.conflict}</dd>
                    </div>
                  )}
                  {chapter.hook && (
                    <div>
                      <dt className="inline font-semibold uppercase tracking-wider text-muted-foreground">
                        Gancho:{" "}
                      </dt>
                      <dd className="inline">{chapter.hook}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <ol className="mt-4 space-y-4">
                {(chapter.script?.cenas ?? []).map((scene, index) => (
                  <li key={index} className="border-2 border-ink/70 bg-background p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-display text-lg">
                        CENA {scene.numero ?? index + 1}
                      </span>
                      {scene.local && (
                        <span className="text-sm text-muted-foreground">
                          {scene.local}
                          {scene.horario ? ` · ${scene.horario}` : ""}
                        </span>
                      )}
                    </div>
                    {scene.acao && <p className="mt-2 text-sm">{scene.acao}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {scene.emocao && (
                        <span className="border border-ink/40 bg-muted px-2 py-0.5">
                          {scene.emocao}
                        </span>
                      )}
                      {(scene.personagens ?? []).map((p) => (
                        <span key={p} className="border border-ink/40 bg-muted px-2 py-0.5">
                          {p}
                        </span>
                      ))}
                    </div>
                    {(scene.dialogos ?? []).length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t-2 border-ink/20 pt-3 text-sm">
                        {(scene.dialogos ?? []).map((d, di) => (
                          <li key={di}>
                            <span className="font-semibold">{d.personagem ?? "—"}</span>
                            {d.tipo && d.tipo !== "dialogo" && (
                              <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                ({d.tipo})
                              </span>
                            )}
                            <span className="text-muted-foreground">: </span>
                            {d.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                    {scene.transicao && (
                      <p className="mt-3 text-[11px] italic text-muted-foreground">
                        → {scene.transicao}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {chapter && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">STORYBOARD</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Páginas e quadros com layout e ordem de leitura, a partir do roteiro.
              </p>
            </div>
            <button
              type="button"
              onClick={generateStoryboard}
              disabled={generatingStoryboard}
              className="bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground disabled:opacity-50"
            >
              {generatingStoryboard
                ? "GERANDO..."
                : pages.length
                  ? "REGERAR STORYBOARD"
                  : "GERAR STORYBOARD"}
            </button>
          </div>

          {storyboardError && (
            <div className="mt-4 border-2 border-accent bg-accent/10 p-4 text-sm text-accent">
              {storyboardError}
            </div>
          )}

          {pages.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Nenhum storyboard ainda. Gere o layout das páginas do capítulo 1.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs text-muted-foreground">
                {pages.length} páginas • {pages.reduce((n, p) => n + p.panels.length, 0)} quadros
              </p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((page) => (
                  <div key={page.id}>
                    <PageView page={page} onRegen={regenPanelImage} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {pages.length > 0 && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">GERAÇÃO VISUAL</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Arte de cada quadro, mantendo os personagens consistentes. Os textos e balões
                ficam por cima da arte, não dentro dela.
              </p>
            </div>
            <button
              type="button"
              onClick={generateImages}
              disabled={generatingImages}
              className="bg-ink px-5 py-3 font-display tracking-wide text-paper disabled:opacity-50"
            >
              {generatingImages
                ? imgProgress
                  ? `GERANDO ${imgProgress.done}/${imgProgress.total}...`
                  : "GERANDO..."
                : "GERAR ARTE DOS QUADROS"}
            </button>
          </div>
          {imagesError && (
            <div className="mt-4 border-2 border-accent bg-accent/10 p-4 text-sm text-accent">
              {imagesError}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {pages.reduce((n, p) => n + p.panels.filter((q) => q.asset_url).length, 0)} de{" "}
            {pages.reduce((n, p) => n + p.panels.length, 0)} quadros com arte gerada. Você pode
            regenerar um quadro individual clicando nele no storyboard.
          </p>
        </section>
      )}

      {pages.length > 0 && (
        <section className="ink-border mt-8 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">EXPORTAR PDF</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Gera um PDF com as páginas na ordem de leitura. Use "Salvar como PDF" na janela de
                impressão.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-accent px-5 py-3 font-display tracking-wide text-accent-foreground"
            >
              EXPORTAR PDF
            </button>
          </div>
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

    {/* Somente para impressão / exportação em PDF */}
    <div id="print-root">
      {pages.map((page) => (
        <PageView key={page.id} page={page} />
      ))}
    </div>
    </>
  );
}
