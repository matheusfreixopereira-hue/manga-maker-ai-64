import "./lib/error-capture";

import { createClient } from "@supabase/supabase-js";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { Database, Json } from "./integrations/supabase/types";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

type RuntimeEnv = Record<string, string | undefined>;

type ProjectForBible = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  creation_mode: string;
  initial_idea: string | null;
  genre: string | null;
  tone: string | null;
  age_rating: string | null;
  color_mode: string;
  reading_direction: string;
  page_format: string;
  dialogue_language: string;
};

function readEnv(env: unknown, name: string) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  if (env && typeof env === "object") return (env as RuntimeEnv)[name];
  return undefined;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function buildBiblePrompt(project: ProjectForBible) {
  return [
    "Voce e um roteirista senior de mangas criando a Biblia da Obra para um MVP em portugues do Brasil.",
    "Responda somente com JSON valido, sem markdown.",
    "O MVP deve respeitar estes limites: 1 capitulo por vez, ate 20 paginas, interface e texto em pt-BR.",
    "Nao inclua continuacao de obra existente; trate apenas a ideia, texto colado ou documento enviado pelo usuario.",
    "",
    "Estrutura JSON obrigatoria:",
    JSON.stringify({
      premissa: "string",
      logline: "string",
      sinopse_curta: "string",
      publico_alvo: "string",
      genero_e_tom: "string",
      tema_central: "string",
      regras_do_universo: ["string"],
      personagens_principais: [
        {
          nome: "string",
          papel: "string",
          objetivo: "string",
          conflito: "string",
          visual: "string",
        },
      ],
      arco_do_capitulo_1: {
        titulo: "string",
        resumo: "string",
        paginas_estimadas: 12,
        cenas: ["string"],
      },
      direcao_visual: {
        estilo: "string",
        composicao: "string",
        observacoes_de_consistencia: ["string"],
      },
      proximos_passos: ["string"],
    }),
    "",
    "Dados do projeto:",
    JSON.stringify(project, null, 2),
  ].join("\n");
}

function extractOpenAIText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

// Parse tolerante: com text.format json_object a saida ja e JSON valido, mas isto
// protege contra cercas markdown ou texto extra caso o modelo escape do formato.
function parseJsonLoose(raw: string): unknown {
  let t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const firstObj = t.indexOf("{");
    const firstArr = t.indexOf("[");
    const candidates = [firstObj, firstArr].filter((i) => i !== -1);
    const start = candidates.length ? Math.min(...candidates) : -1;
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("resposta sem JSON valido");
  }
}

async function createProjectBible(request: Request, env: unknown, projectId: string) {
  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseKey = readEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = readEnv(env, "OPENAI_API_KEY");
  const model = readEnv(env, "OPENAI_MODEL") ?? "gpt-5.5";
  const token = extractBearerToken(request);

  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase nao configurado" }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY nao configurada" }, 500);
  if (!token) return json({ error: "Sessao ausente" }, 401);

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida" }, 401);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,description,creation_mode,initial_idea,genre,tone,age_rating,color_mode,reading_direction,page_format,dialogue_language",
    )
    .eq("id", projectId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (projectError) return json({ error: projectError.message }, 500);
  if (!project) return json({ error: "Projeto nao encontrado" }, 404);

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openaiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildBiblePrompt(project),
      text: { format: { type: "json_object" } },
      max_output_tokens: 16000,
    }),
  });

  const openaiPayload = await openaiResponse.json().catch(() => null);
  if (!openaiResponse.ok) {
    const message =
      openaiPayload && typeof openaiPayload === "object" && "error" in openaiPayload
        ? JSON.stringify((openaiPayload as { error: unknown }).error)
        : "Erro ao chamar OpenAI";
    return json({ error: message }, 502);
  }

  const text = extractOpenAIText(openaiPayload);
  let content: Json;
  try {
    content = parseJsonLoose(text) as Json;
  } catch {
    content = { resposta: text };
  }

  const { data: existing } = await supabase
    .from("project_bibles")
    .select("generations_count")
    .eq("project_id", project.id)
    .maybeSingle();

  const { data: bible, error: bibleError } = await supabase
    .from("project_bibles")
    .upsert({
      project_id: project.id,
      user_id: userData.user.id,
      content,
      model,
      generations_count: (existing?.generations_count ?? 0) + 1,
    })
    .select("*")
    .single();

  if (bibleError) return json({ error: bibleError.message }, 500);

  await supabase
    .from("projects")
    .update({ status: "awaiting_approval", current_step: "bible" })
    .eq("id", project.id);

  return json({ bible });
}

type GeneratedCharacter = {
  name?: string;
  role?: string;
  age?: string;
  personality?: string;
  objective?: string;
  conflict?: string;
  appearance?: string;
  visual_lock?: Record<string, unknown>;
};

function buildCharactersPrompt(project: ProjectForBible, bible: Json) {
  return [
    "Voce e um character designer senior de mangas trabalhando em um MVP em portugues do Brasil.",
    "A partir da Biblia da Obra abaixo, extraia e detalhe o elenco do capitulo 1 (protagonista, antagonista e coadjuvantes relevantes).",
    "Responda SOMENTE com JSON valido, sem markdown, no formato: { \"personagens\": [ ... ] }.",
    "Cada personagem deve ter os campos abaixo. O campo visual_lock e o 'Character Lock': descritores canonicos e invariaveis reutilizados em todas as paginas para manter consistencia visual.",
    JSON.stringify({
      personagens: [
        {
          name: "string",
          role: "protagonista | antagonista | coadjuvante",
          age: "string",
          personality: "string",
          objective: "string",
          conflict: "string",
          appearance: "descricao fisica completa em 2-3 frases",
          visual_lock: {
            cabelo: "string",
            olhos: "string",
            roupa_padrao: "string",
            marcas_ou_acessorios: "string",
            paleta: "string",
            traco_distintivo: "string",
          },
        },
      ],
    }),
    "",
    "Gere entre 2 e 6 personagens, priorizando os essenciais para o capitulo 1.",
    "Direcao visual do projeto: color_mode=" + project.color_mode + ".",
    "",
    "Biblia da Obra:",
    JSON.stringify(bible),
  ].join("\n");
}

async function createProjectCharacters(request: Request, env: unknown, projectId: string) {
  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseKey = readEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = readEnv(env, "OPENAI_API_KEY");
  const model = readEnv(env, "OPENAI_MODEL") ?? "gpt-5.5";
  const token = extractBearerToken(request);

  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase nao configurado" }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY nao configurada" }, 500);
  if (!token) return json({ error: "Sessao ausente" }, 401);

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida" }, 401);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,description,creation_mode,initial_idea,genre,tone,age_rating,color_mode,reading_direction,page_format,dialogue_language",
    )
    .eq("id", projectId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (projectError) return json({ error: projectError.message }, 500);
  if (!project) return json({ error: "Projeto nao encontrado" }, 404);

  const { data: bibleRow } = await supabase
    .from("project_bibles")
    .select("content")
    .eq("project_id", project.id)
    .maybeSingle();

  if (!bibleRow) return json({ error: "Gere o planejamento da obra antes dos personagens." }, 400);

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openaiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildCharactersPrompt(project, bibleRow.content),
      text: { format: { type: "json_object" } },
      max_output_tokens: 16000,
    }),
  });

  const openaiPayload = await openaiResponse.json().catch(() => null);
  if (!openaiResponse.ok) {
    const message =
      openaiPayload && typeof openaiPayload === "object" && "error" in openaiPayload
        ? JSON.stringify((openaiPayload as { error: unknown }).error)
        : "Erro ao chamar OpenAI";
    return json({ error: message }, 502);
  }

  const text = extractOpenAIText(openaiPayload);
  let list: GeneratedCharacter[] = [];
  try {
    const parsed = parseJsonLoose(text) as { personagens?: GeneratedCharacter[] } | GeneratedCharacter[];
    list = Array.isArray(parsed) ? parsed : (parsed.personagens ?? []);
  } catch {
    return json({ error: "A IA nao retornou personagens em JSON valido. Tente novamente." }, 502);
  }

  const rows = list
    .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 0)
    .map((c, index) => ({
      project_id: project.id,
      user_id: userData.user.id,
      name: c.name!.trim(),
      role: c.role ?? null,
      age: c.age ?? null,
      personality: c.personality ?? null,
      objective: c.objective ?? null,
      conflict: c.conflict ?? null,
      appearance: c.appearance ?? null,
      visual_lock: (c.visual_lock ?? {}) as Json,
      sort_order: index,
    }));

  if (rows.length === 0) return json({ error: "Nenhum personagem foi gerado. Tente novamente." }, 502);

  // Regeneration replaces the previous cast for this project.
  await supabase.from("characters").delete().eq("project_id", project.id);

  const { data: characters, error: insertError } = await supabase
    .from("characters")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (insertError) return json({ error: insertError.message }, 500);

  await supabase
    .from("projects")
    .update({ status: "creating_characters", current_step: "characters" })
    .eq("id", project.id);

  return json({ characters });
}

type CharacterForScript = {
  name: string;
  role: string | null;
  personality: string | null;
  objective: string | null;
};

function buildScriptPrompt(
  project: ProjectForBible,
  bible: Json,
  characters: CharacterForScript[],
) {
  const direction =
    project.reading_direction === "ltr"
      ? "esquerda para a direita (ocidental)"
      : "direita para a esquerda (padrao japones)";

  return [
    "Voce e um roteirista senior de mangas. Transforme a historia no roteiro visual do CAPITULO 1 para um MVP em portugues do Brasil.",
    "Responda SOMENTE com JSON valido, sem markdown.",
    "",
    "PRINCIPIO DE FIDELIDADE (obrigatorio): a Biblia da Obra e as fichas de personagens sao a fonte da verdade.",
    "Nao invente acontecimentos que contradigam o material aprovado; nao renomeie personagens; use exatamente os nomes das fichas.",
    "",
    "LIMITES DO MVP: apenas o capitulo 1, entre 4 e 20 paginas. Direcao de leitura: " + direction + ".",
    "Distribua as cenas de forma coerente com a quantidade estimada de paginas.",
    "",
    "Estrutura JSON obrigatoria:",
    JSON.stringify({
      titulo: "string",
      objetivo: "string",
      sinopse: "string",
      conflito: "string",
      gancho: "string",
      paginas_estimadas: 12,
      cenas: [
        {
          numero: 1,
          local: "string",
          horario: "string",
          personagens: ["string"],
          objetivo: "string",
          acao: "descricao da acao visual da cena",
          emocao: "string",
          transicao: "como corta para a proxima cena",
          dialogos: [
            {
              tipo: "dialogo | pensamento | narracao | grito | sussurro | onomatopeia",
              personagem: "nome do personagem ou Narrador",
              texto: "string",
            },
          ],
        },
      ],
    }),
    "",
    "Personagens disponiveis (use estes nomes):",
    JSON.stringify(characters),
    "",
    "Biblia da Obra:",
    JSON.stringify(bible),
  ].join("\n");
}

async function createProjectScript(request: Request, env: unknown, projectId: string) {
  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseKey = readEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = readEnv(env, "OPENAI_API_KEY");
  const model = readEnv(env, "OPENAI_MODEL") ?? "gpt-5.5";
  const token = extractBearerToken(request);

  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase nao configurado" }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY nao configurada" }, 500);
  if (!token) return json({ error: "Sessao ausente" }, 401);

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida" }, 401);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,description,creation_mode,initial_idea,genre,tone,age_rating,color_mode,reading_direction,page_format,dialogue_language",
    )
    .eq("id", projectId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (projectError) return json({ error: projectError.message }, 500);
  if (!project) return json({ error: "Projeto nao encontrado" }, 404);

  const { data: bibleRow } = await supabase
    .from("project_bibles")
    .select("content")
    .eq("project_id", project.id)
    .maybeSingle();

  if (!bibleRow) return json({ error: "Gere o planejamento da obra antes do roteiro." }, 400);

  const { data: characters } = await supabase
    .from("characters")
    .select("name,role,personality,objective")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openaiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildScriptPrompt(project, bibleRow.content, (characters ?? []) as CharacterForScript[]),
      text: { format: { type: "json_object" } },
      max_output_tokens: 16000,
    }),
  });

  const openaiPayload = await openaiResponse.json().catch(() => null);
  if (!openaiResponse.ok) {
    const message =
      openaiPayload && typeof openaiPayload === "object" && "error" in openaiPayload
        ? JSON.stringify((openaiPayload as { error: unknown }).error)
        : "Erro ao chamar OpenAI";
    return json({ error: message }, 502);
  }

  const text = extractOpenAIText(openaiPayload);
  let script: {
    titulo?: string;
    objetivo?: string;
    sinopse?: string;
    conflito?: string;
    gancho?: string;
    paginas_estimadas?: number;
    cenas?: unknown[];
  };
  try {
    script = parseJsonLoose(text) as typeof script;
  } catch {
    return json({ error: "A IA nao retornou o roteiro em JSON valido. Tente novamente." }, 502);
  }

  if (!Array.isArray(script.cenas) || script.cenas.length === 0) {
    return json({ error: "O roteiro veio sem cenas. Tente novamente." }, 502);
  }

  const { data: existing } = await supabase
    .from("chapters")
    .select("generations_count")
    .eq("project_id", project.id)
    .eq("chapter_number", 1)
    .maybeSingle();

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .upsert(
      {
        project_id: project.id,
        user_id: userData.user.id,
        chapter_number: 1,
        title: script.titulo ?? null,
        synopsis: script.sinopse ?? null,
        objective: script.objetivo ?? null,
        conflict: script.conflito ?? null,
        hook: script.gancho ?? null,
        estimated_pages:
          typeof script.paginas_estimadas === "number" ? script.paginas_estimadas : null,
        script: script as Json,
        status: "draft",
        model,
        generations_count: (existing?.generations_count ?? 0) + 1,
      },
      { onConflict: "project_id,chapter_number" },
    )
    .select("*")
    .single();

  if (chapterError) return json({ error: chapterError.message }, 500);

  await supabase
    .from("projects")
    .update({ status: "creating_storyboard", current_step: "script" })
    .eq("id", project.id);

  return json({ chapter });
}

type CharacterLock = {
  name: string;
  appearance: string | null;
  visual_lock: Record<string, unknown> | null;
};

function colorModeLabel(colorMode: string) {
  switch (colorMode) {
    case "grayscale":
      return "escala de cinza";
    case "color":
      return "colorido com paleta consistente";
    case "color_limited":
      return "colorido com paleta limitada";
    default:
      return "preto e branco tradicional (linhas de tinta, screentones, alto contraste)";
  }
}

// Monta o prompt canônico de imagem de um quadro embutindo o Character Lock (PRD §20).
function buildPanelImagePrompt(
  project: ProjectForBible & { style_preset?: string | null },
  panel: {
    scene_description?: string | null;
    framing?: string | null;
    camera?: string | null;
    characters?: string[];
  },
  locks: CharacterLock[],
) {
  const present = (panel.characters ?? [])
    .map((name) => locks.find((l) => l.name.toLowerCase() === String(name).toLowerCase()))
    .filter((l): l is CharacterLock => Boolean(l))
    .map((l) => {
      const traits = l.visual_lock
        ? Object.entries(l.visual_lock)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(", ")
        : "";
      return `- ${l.name}: ${l.appearance ?? ""} ${traits ? `[${traits}]` : ""}`.trim();
    })
    .join("\n");

  return [
    "Crie um quadro original de manga.",
    `MODO: ${colorModeLabel(project.color_mode)}.`,
    project.genre ? `GENERO: ${project.genre}.` : "",
    project.style_preset ? `ESTILO: ${project.style_preset}.` : "",
    panel.framing ? `ENQUADRAMENTO: ${panel.framing}.` : "",
    panel.camera ? `CAMERA: ${panel.camera}.` : "",
    present ? `PERSONAGENS (mantenha identidade EXATA):\n${present}` : "",
    panel.scene_description ? `CENA: ${panel.scene_description}.` : "",
    "ESTILO VISUAL: composicao dramatica de manga, linhas de movimento quando fizer sentido.",
    "NAO ALTERAR: cabelo, olhos, roupas, cicatrizes, idade, proporcoes ou lado de ferimentos dos personagens.",
    "SEM TEXTOS, SEM BALOES E SEM LETRAS NA IMAGEM.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStoryboardPrompt(
  project: ProjectForBible,
  chapterScript: Json,
  characters: CharacterLock[],
) {
  const direction =
    project.reading_direction === "ltr"
      ? "esquerda para a direita (primeiro quadro no canto superior esquerdo)"
      : "direita para a esquerda (primeiro quadro no canto superior direito)";

  return [
    "Voce e um artista de manga montando o STORYBOARD do capitulo 1 (MVP em pt-BR).",
    "Responda SOMENTE com JSON valido, sem markdown.",
    "",
    "Distribua as cenas do roteiro em paginas (4 a 20) e quadros (1 a 6 por pagina).",
    "Direcao de leitura: " + direction + ". Defina reading_order de cada quadro seguindo essa direcao.",
    "Geometria: cada quadro tem { x, y, w, h } em fracoes de 0 a 1 da pagina; os quadros de uma pagina devem preencher a pagina sem sobrepor.",
    "Distribua os dialogos do roteiro entre os quadros correspondentes.",
    "",
    "Estrutura JSON obrigatoria:",
    JSON.stringify({
      paginas: [
        {
          numero: 1,
          quadros: [
            {
              numero: 1,
              reading_order: 1,
              geometry: { x: 0, y: 0, w: 1, h: 0.5 },
              descricao: "descricao visual do quadro",
              enquadramento: "plano medio | close | plano geral | ...",
              camera: "angulo/altura da camera",
              personagens: ["nome"],
              dialogos: [{ tipo: "dialogo", personagem: "nome", texto: "string" }],
            },
          ],
        },
      ],
    }),
    "",
    "Personagens (para manter consistencia):",
    JSON.stringify(characters.map((c) => ({ nome: c.name }))),
    "",
    "Roteiro (cenas e dialogos):",
    JSON.stringify(chapterScript),
  ].join("\n");
}

type AiPanel = {
  numero?: number;
  reading_order?: number;
  geometry?: { x?: number; y?: number; w?: number; h?: number };
  descricao?: string;
  enquadramento?: string;
  camera?: string;
  personagens?: string[];
  dialogos?: unknown[];
};
type AiPage = { numero?: number; quadros?: AiPanel[] };

async function createProjectStoryboard(request: Request, env: unknown, projectId: string) {
  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseKey = readEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = readEnv(env, "OPENAI_API_KEY");
  const model = readEnv(env, "OPENAI_MODEL") ?? "gpt-5.5";
  const token = extractBearerToken(request);

  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase nao configurado" }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY nao configurada" }, 500);
  if (!token) return json({ error: "Sessao ausente" }, 401);

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida" }, 401);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,description,creation_mode,initial_idea,genre,tone,age_rating,color_mode,reading_direction,page_format,dialogue_language,style_preset",
    )
    .eq("id", projectId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (projectError) return json({ error: projectError.message }, 500);
  if (!project) return json({ error: "Projeto nao encontrado" }, 404);

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id,script")
    .eq("project_id", project.id)
    .eq("chapter_number", 1)
    .maybeSingle();

  if (!chapter) return json({ error: "Gere o roteiro antes do storyboard." }, 400);

  const { data: charRows } = await supabase
    .from("characters")
    .select("name,appearance,visual_lock")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });
  const locks = (charRows ?? []) as CharacterLock[];

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input: buildStoryboardPrompt(project, chapter.script, locks),
      text: { format: { type: "json_object" } },
      max_output_tokens: 16000,
    }),
  });

  const openaiPayload = await openaiResponse.json().catch(() => null);
  if (!openaiResponse.ok) {
    const message =
      openaiPayload && typeof openaiPayload === "object" && "error" in openaiPayload
        ? JSON.stringify((openaiPayload as { error: unknown }).error)
        : "Erro ao chamar OpenAI";
    return json({ error: message }, 502);
  }

  const text = extractOpenAIText(openaiPayload);
  let parsed: { paginas?: AiPage[] };
  try {
    parsed = parseJsonLoose(text) as { paginas?: AiPage[] };
  } catch {
    return json({ error: "O storyboard nao veio em JSON valido. Tente novamente." }, 502);
  }
  const aiPages = Array.isArray(parsed.paginas) ? parsed.paginas : [];
  if (aiPages.length === 0) return json({ error: "O storyboard veio sem paginas. Tente novamente." }, 502);

  // Regeneração substitui o storyboard anterior deste capítulo.
  await supabase.from("pages").delete().eq("chapter_id", chapter.id);

  const createdPages: unknown[] = [];
  for (let p = 0; p < aiPages.length; p++) {
    const aiPage = aiPages[p];
    const pageNumber = typeof aiPage.numero === "number" ? aiPage.numero : p + 1;

    const { data: page, error: pageError } = await supabase
      .from("pages")
      .insert({
        chapter_id: chapter.id,
        project_id: project.id,
        user_id: userData.user.id,
        page_number: pageNumber,
        reading_order: pageNumber,
      })
      .select("id,page_number")
      .single();
    if (pageError || !page) return json({ error: pageError?.message ?? "Erro ao criar pagina" }, 500);

    const quadros = Array.isArray(aiPage.quadros) ? aiPage.quadros : [];
    const panelRows = quadros.map((q, qi) => {
      const g = q.geometry ?? {};
      return {
        page_id: page.id,
        project_id: project.id,
        user_id: userData.user.id,
        panel_number: typeof q.numero === "number" ? q.numero : qi + 1,
        reading_order: typeof q.reading_order === "number" ? q.reading_order : qi + 1,
        geometry: {
          x: typeof g.x === "number" ? g.x : 0,
          y: typeof g.y === "number" ? g.y : qi / Math.max(quadros.length, 1),
          w: typeof g.w === "number" ? g.w : 1,
          h: typeof g.h === "number" ? g.h : 1 / Math.max(quadros.length, 1),
        } as Json,
        scene_description: q.descricao ?? null,
        framing: q.enquadramento ?? null,
        camera: q.camera ?? null,
        characters: (q.personagens ?? []) as Json,
        dialogues: (q.dialogos ?? []) as Json,
        prompt: buildPanelImagePrompt(
          project,
          {
            scene_description: q.descricao,
            framing: q.enquadramento,
            camera: q.camera,
            characters: q.personagens,
          },
          locks,
        ),
      };
    });

    if (panelRows.length > 0) {
      const { error: panelError } = await supabase.from("panels").insert(panelRows);
      if (panelError) return json({ error: panelError.message }, 500);
    }
    createdPages.push({ id: page.id, page_number: page.page_number, panels: panelRows.length });
  }

  await supabase
    .from("projects")
    .update({ status: "creating_storyboard", current_step: "storyboard" })
    .eq("id", project.id);

  return json({ pages: createdPages });
}

function pickImageSize(geometry: unknown): string {
  const g = (geometry ?? {}) as { w?: number; h?: number };
  const w = typeof g.w === "number" ? g.w : 1;
  const h = typeof g.h === "number" ? g.h : 1;
  // Página é retrato (1 : 1.414); converte a proporção do quadro para pixels.
  const aspect = (w / h) / 1.414;
  if (aspect > 1.2) return "1536x1024";
  if (aspect < 0.8) return "1024x1536";
  return "1024x1024";
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generatePanelImage(
  request: Request,
  env: unknown,
  projectId: string,
  panelId: string,
) {
  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseKey = readEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = readEnv(env, "OPENAI_API_KEY");
  const imageModel = readEnv(env, "OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
  const token = extractBearerToken(request);

  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase nao configurado" }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY nao configurada" }, 500);
  if (!token) return json({ error: "Sessao ausente" }, 401);

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida" }, 401);

  const { data: panel, error: panelError } = await supabase
    .from("panels")
    .select("id,project_id,prompt,geometry")
    .eq("id", panelId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (panelError) return json({ error: panelError.message }, 500);
  if (!panel) return json({ error: "Quadro nao encontrado" }, 404);

  const prompt = panel.prompt ?? "Quadro de manga em preto e branco, sem textos.";
  const size = pickImageSize(panel.geometry);

  const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: imageModel, prompt, size, n: 1 }),
  });

  const imagePayload = (await imageResponse.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: unknown;
  } | null;
  if (!imageResponse.ok) {
    const message = imagePayload?.error ? JSON.stringify(imagePayload.error) : "Erro ao gerar imagem";
    return json({ error: message }, 502);
  }

  const first = imagePayload?.data?.[0];
  let bytes: Uint8Array;
  if (first?.b64_json) {
    bytes = base64ToBytes(first.b64_json);
  } else if (first?.url) {
    const fetched = await fetch(first.url);
    bytes = new Uint8Array(await fetched.arrayBuffer());
  } else {
    return json({ error: "A OpenAI nao retornou imagem." }, 502);
  }

  const path = `${userData.user.id}/${projectId}/${panelId}.png`;
  const { error: uploadError } = await supabase.storage
    .from("manga-assets")
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) return json({ error: uploadError.message }, 500);

  const { data: publicUrl } = supabase.storage.from("manga-assets").getPublicUrl(path);
  // Cache-buster para o navegador recarregar após regeneracao.
  const assetUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabase
    .from("panels")
    .update({ asset_url: assetUrl, status: "generated" })
    .eq("id", panelId)
    .select("id,asset_url,status")
    .single();
  if (updateError) return json({ error: updateError.message }, 500);

  return json({ panel: updated });
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const generateBibleMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/generate-bible$/);
      if (generateBibleMatch) {
        return await createProjectBible(request, env, generateBibleMatch[1]);
      }

      const generateCharactersMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/generate-characters$/,
      );
      if (generateCharactersMatch) {
        return await createProjectCharacters(request, env, generateCharactersMatch[1]);
      }

      const generateScriptMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/generate-script$/,
      );
      if (generateScriptMatch) {
        return await createProjectScript(request, env, generateScriptMatch[1]);
      }

      const generateStoryboardMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/generate-storyboard$/,
      );
      if (generateStoryboardMatch) {
        return await createProjectStoryboard(request, env, generateStoryboardMatch[1]);
      }

      const generatePanelImageMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/panels\/([^/]+)\/generate-image$/,
      );
      if (generatePanelImageMatch) {
        return await generatePanelImage(
          request,
          env,
          generatePanelImageMatch[1],
          generatePanelImageMatch[2],
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
