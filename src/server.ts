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
      temperature: 0.6,
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
    content = JSON.parse(text) as Json;
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
      temperature: 0.7,
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
    const parsed = JSON.parse(text) as { personagens?: GeneratedCharacter[] } | GeneratedCharacter[];
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
