import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/projects/new")({
  head: () => ({ meta: [{ title: "Novo mangá — Tinta" }] }),
  component: NewProject,
});

const schema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  creation_mode: z.enum(["idea", "pasted", "upload"]),
  initial_idea: z.string().trim().max(300000).optional().or(z.literal("")),
  genre: z.string().trim().max(80).optional().or(z.literal("")),
  tone: z.string().trim().max(80).optional().or(z.literal("")),
  age_rating: z.string().trim().max(20).optional().or(z.literal("")),
  color_mode: z.enum(["bw_traditional", "grayscale", "color", "color_limited"]),
  reading_direction: z.enum(["rtl", "ltr"]),
  page_format: z.enum(["A4", "A5", "B5"]),
  source_language: z.string().min(2).max(10),
  dialogue_language: z.string().min(2).max(10),
});

function NewProject() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    creation_mode: "idea" as "idea" | "pasted" | "upload",
    initial_idea: "",
    genre: "",
    tone: "",
    age_rating: "Livre",
    color_mode: "bw_traditional" as const,
    reading_direction: "rtl" as const,
    page_format: "A5" as const,
    source_language: "pt-BR",
    dialogue_language: "pt-BR",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtractError(null);
    setUploadFileName(file.name);
    setExtracting(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 25 MB).");
      const { extractTextFromFile } = await import("@/lib/extract-text");
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        throw new Error("Não consegui extrair texto desse arquivo. Cole o texto manualmente.");
      }
      update("initial_idea", text.slice(0, 300000));
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Erro ao ler o arquivo.");
      update("initial_idea", "");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (
      (form.creation_mode === "pasted" || form.creation_mode === "upload") &&
      !form.initial_idea.trim()
    ) {
      toast.error(
        form.creation_mode === "pasted"
          ? "Cole o texto da sua história."
          : "Envie um arquivo com o texto da história.",
      );
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão inválida");

      const { count, error: countError } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userData.user.id)
        .eq("archived", false);
      if (countError) throw countError;
      if ((count ?? 0) >= 3) {
        throw new Error("Limite do MVP atingido: mantenha no máximo 3 projetos ativos.");
      }

      const payload = {
        ...parsed.data,
        description: parsed.data.description || null,
        initial_idea: parsed.data.initial_idea || null,
        genre: parsed.data.genre || null,
        tone: parsed.data.tone || null,
        age_rating: parsed.data.age_rating || null,
        user_id: userData.user.id,
      };
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) throw error;
      toast.success("Projeto criado!");
      navigate({ to: "/projects/$projectId", params: { projectId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-5xl">NOVO MANGÁ</h1>
      <p className="mt-2 text-muted-foreground">
        Configure o básico. Você poderá revisar e ajustar tudo nas próximas etapas.
      </p>

      <form onSubmit={handleSubmit} className="ink-border mt-8 space-y-6 bg-card p-6">
        <Field label="Título do projeto" required>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Ex.: Crônicas de Mizu"
            className="w-full border-2 border-ink bg-background px-3 py-2"
            required
          />
        </Field>

        <Field label="Descrição (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full border-2 border-ink bg-background px-3 py-2"
          />
        </Field>

        <Field label="Como você quer começar?">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: "idea", t: "A partir de uma ideia", d: "Eu descrevo brevemente." },
              { v: "pasted", t: "Colar história/roteiro", d: "Já tenho texto pronto." },
              { v: "upload", t: "Enviar PDF/DOCX/TXT", d: "Tenho um documento." },
              { v: "continuation", t: "Continuar obra existente", d: "Depois do MVP." },
            ].map((o) => (
              <label
                key={o.v}
                className={`border-2 p-3 ${o.v === "continuation" ? "cursor-not-allowed border-ink bg-muted opacity-60" : form.creation_mode === o.v ? "cursor-pointer border-accent bg-accent/10" : "cursor-pointer border-ink bg-background"}`}
              >
                <input
                  type="radio"
                  name="creation_mode"
                  value={o.v}
                  checked={form.creation_mode === o.v}
                  disabled={o.v === "continuation"}
                  onChange={() => {
                    if (o.v !== "continuation")
                      update("creation_mode", o.v as typeof form.creation_mode);
                  }}
                  className="sr-only"
                />
                <div className="font-display text-lg">{o.t}</div>
                <div className="text-xs text-muted-foreground">{o.d}</div>
              </label>
            ))}
          </div>
        </Field>

        {form.creation_mode === "idea" && (
          <Field label="Sua ideia inicial">
            <textarea
              value={form.initial_idea}
              onChange={(e) => update("initial_idea", e.target.value)}
              rows={6}
              placeholder="Ex.: Um jovem descobre que enxerga criaturas invisíveis que se alimentam de memórias humanas..."
              className="w-full border-2 border-ink bg-background px-3 py-2"
            />
          </Field>
        )}

        {form.creation_mode === "pasted" && (
          <Field label="Cole sua história ou roteiro completo">
            <textarea
              value={form.initial_idea}
              onChange={(e) => update("initial_idea", e.target.value)}
              rows={18}
              placeholder="Cole aqui o texto completo — pode ser longo. A IA vai analisar e transformar em mangá."
              className="w-full resize-y border-2 border-ink bg-background px-3 py-2 text-sm leading-relaxed"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {form.initial_idea.length.toLocaleString("pt-BR")} caracteres
            </div>
          </Field>
        )}

        {form.creation_mode === "upload" && (
          <Field label="Envie seu documento">
            <label
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink bg-background p-8 text-center ${extracting ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}
            >
              <Upload className="h-8 w-8 text-accent" />
              <span className="font-display text-lg">
                {extracting ? "Lendo arquivo..." : "Clique para escolher um arquivo"}
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, DOCX, TXT, MD ou RTF — até 25 MB
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.csv"
                className="hidden"
                onChange={handleFile}
                disabled={extracting}
              />
            </label>

            {uploadFileName && !extractError && form.initial_idea && (
              <div className="mt-2 text-xs text-muted-foreground">
                <strong>{uploadFileName}</strong> —{" "}
                {form.initial_idea.length.toLocaleString("pt-BR")} caracteres extraídos. Revise
                abaixo se quiser.
              </div>
            )}
            {extractError && (
              <div className="mt-2 border-2 border-accent bg-accent/10 p-3 text-sm text-accent">
                {extractError}
              </div>
            )}
            {form.initial_idea && (
              <textarea
                value={form.initial_idea}
                onChange={(e) => update("initial_idea", e.target.value)}
                rows={12}
                className="mt-3 w-full resize-y border-2 border-ink bg-background px-3 py-2 text-sm leading-relaxed"
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gênero">
            <select
              value={form.genre}
              onChange={(e) => update("genre", e.target.value)}
              className="w-full border-2 border-ink bg-background px-3 py-2"
            >
              <option value="">Selecione...</option>
              {[
                "Shonen",
                "Shojo",
                "Seinen",
                "Josei",
                "Ação",
                "Aventura",
                "Fantasia",
                "Terror",
                "Romance",
                "Drama",
                "Ficção Científica",
                "Comédia",
                "Esportivo",
              ].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tom">
            <select
              value={form.tone}
              onChange={(e) => update("tone", e.target.value)}
              className="w-full border-2 border-ink bg-background px-3 py-2"
            >
              <option value="">Selecione...</option>
              {[
                "Sério",
                "Sombrio",
                "Leve",
                "Dramático",
                "Cômico",
                "Épico",
                "Melancólico",
                "Tenso",
              ].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Modo de cor">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { v: "bw_traditional", t: "P&B tradicional" },
              { v: "grayscale", t: "Escala de cinza" },
              { v: "color", t: "Colorido" },
              { v: "color_limited", t: "Paleta limitada" },
            ].map((o) => (
              <label
                key={o.v}
                className={`cursor-pointer border-2 p-2 text-center text-sm ${form.color_mode === o.v ? "border-accent bg-accent/10" : "border-ink bg-background"}`}
              >
                <input
                  type="radio"
                  name="color_mode"
                  value={o.v}
                  checked={form.color_mode === o.v}
                  onChange={() => update("color_mode", o.v as typeof form.color_mode)}
                  className="sr-only"
                />
                {o.t}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Direção de leitura">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: "rtl", t: "Direita → Esquerda", d: "Tradicional japonês" },
              { v: "ltr", t: "Esquerda → Direita", d: "Ocidental" },
            ].map((o) => (
              <label
                key={o.v}
                className={`cursor-pointer border-2 p-3 ${form.reading_direction === o.v ? "border-accent bg-accent/10" : "border-ink bg-background"}`}
              >
                <input
                  type="radio"
                  name="reading_direction"
                  value={o.v}
                  checked={form.reading_direction === o.v}
                  onChange={() => update("reading_direction", o.v as typeof form.reading_direction)}
                  className="sr-only"
                />
                <div className="font-display text-lg">{o.t}</div>
                <div className="text-xs text-muted-foreground">{o.d}</div>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Formato de página">
            <select
              value={form.page_format}
              onChange={(e) => update("page_format", e.target.value as typeof form.page_format)}
              className="w-full border-2 border-ink bg-background px-3 py-2"
            >
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="B5">B5</option>
            </select>
          </Field>
          <Field label="Classificação">
            <select
              value={form.age_rating}
              onChange={(e) => update("age_rating", e.target.value)}
              className="w-full border-2 border-ink bg-background px-3 py-2"
            >
              {["Livre", "10", "12", "14", "16", "18"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Idioma">
            <select
              value={form.dialogue_language}
              onChange={(e) => {
                update("dialogue_language", e.target.value);
                update("source_language", e.target.value);
              }}
              className="w-full border-2 border-ink bg-background px-3 py-2"
            >
              <option value="pt-BR">Português</option>
            </select>
          </Field>
        </div>

        <div className="border-2 border-ink/20 bg-muted px-3 py-2 text-xs text-muted-foreground">
          MVP: até 3 projetos ativos, 1 capítulo por vez, até 20 páginas e 3 regenerações por
          quadro.
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="border-2 border-ink bg-background px-5 py-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-accent px-6 py-2 font-display tracking-wide text-accent-foreground disabled:opacity-50"
          >
            {loading ? "CRIANDO..." : "CRIAR PROJETO"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}
