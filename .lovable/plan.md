
# Plataforma de Criação de Mangás com IA — Plano

## 1. Resumo do produto
Aplicação web onde o usuário transforma uma ideia, um roteiro colado ou um documento (PDF/DOCX/TXT) em um mangá completo. A IA gera Bíblia da Obra, personagens com fichas visuais bloqueáveis (Character Lock), roteiro, storyboard, quadros e páginas. Balões e textos são camadas editáveis (SVG), não pixels. Exportação em PDF com direção de leitura (RTL/LTR), preto-e-branco ou colorido.

## 2. Arquitetura proposta
- **Frontend:** TanStack Start (já no template) + React 19 + Tailwind v4 + shadcn/ui. Editor visual baseado em Konva (canvas) para layout de quadros e balões SVG sobrepostos.
- **Backend:** Lovable Cloud (Supabase) — Auth, Postgres com RLS, Storage privado, Edge Functions para chamadas OpenAI e jobs.
- **IA:** OpenAI via Edge Functions. Modelos parametrizados por env: `OPENAI_TEXT_MODEL` (Responses API, JSON estruturado) e `OPENAI_IMAGE_MODEL` (gpt-image-2). Chave apenas no backend.
- **Filas/Jobs:** tabela `generation_jobs` + Edge Function worker disparada por `pg_cron` (a cada minuto) e por trigger pós-insert. Idempotência por `job_id`.
- **PDF:** gerado server-side em Edge Function com `pdf-lib` a partir das páginas renderizadas (PNG da arte + overlay SVG → PNG composto em 300 DPI para alta qualidade).
- **Parsing de documentos:** Edge Function dedicada. PDF via `pdfjs-dist` (texto), DOCX via `mammoth`, TXT/MD direto. Arquivos grandes: chunking + sumarização hierárquica antes de montar a Bíblia.

## 3. Diagrama textual do fluxo
```text
Login → Dashboard → Novo Projeto (wizard)
    ↓
Origem: ideia | colar | upload | continuação
    ↓
[Job: parse+extract]  →  Texto canônico
    ↓
[Job: gerar Bíblia da Obra] → Aprovação do usuário
    ↓
[Job: detectar personagens] → Edição → [Job: gerar ficha visual] → Character Lock
    ↓
[Job: roteiro por capítulo/cena] → Aprovação
    ↓
[Job: storyboard (miniaturas + layout)] → Aprovação página a página
    ↓
[Jobs paralelos: gerar arte de cada quadro] → versões
    ↓
Editor de páginas (balões/onomatopeias SVG)
    ↓
[Job: capa] → [Job: export PDF] → Download
```

## 4. Páginas (rotas TanStack)
- `/` landing pública
- `/auth` login/cadastro/reset
- `/_authenticated/dashboard`
- `/_authenticated/projects/new` (wizard)
- `/_authenticated/projects/$id` com sub-rotas: `overview`, `sources`, `bible`, `characters`, `characters/$id`, `locations`, `chapters`, `chapters/$id/storyboard`, `pages/$pageId/editor`, `cover`, `export`, `jobs`, `settings`

## 5. Componentes principais
- `WizardStepper`, `FileDropzone`, `RichTextEditor`
- `BibleEditor`, `CharacterCard`, `CharacterSheetViewer`, `ReferenceUploader`
- `StoryboardGrid`, `PageThumbnail`, `PanelEditor`
- `PageCanvas` (Konva) com camadas: arte, balões SVG, onomatopeias
- `BalloonLayer`, `BalloonShape` (diálogo, pensamento, grito, narração, eletrônico)
- `JobsCenter`, `CostEstimator`, `ApprovalGate`
- `ReadingDirectionToggle`, `PdfExportDialog`

## 6. Estrutura do banco
Conforme PRD §30. Todas com RLS por `user_id`/`project_id`. Tabelas: `profiles`, `projects`, `source_files`, `story_bibles`, `characters`, `character_references`, `locations`, `chapters`, `pages`, `panels`, `dialogues`, `generated_assets`, `generation_jobs`, `exports`, `usage_events`. Storage buckets privados: `sources/`, `references/`, `assets/`, `exports/`. URLs assinadas para download.

## 7. Edge Functions necessárias
1. `parse-document` — extrai texto de PDF/DOCX/TXT/MD/RTF/ODT
2. `analyze-story` — gera Bíblia da Obra (JSON estruturado)
3. `detect-characters`
4. `generate-character-sheet` (imagens multi-pose)
5. `generate-script`
6. `generate-storyboard`
7. `generate-panel` (1 quadro = 1 chamada)
8. `compose-page` (recorte + balões SVG → PNG final)
9. `generate-cover`
10. `export-pdf`
11. `jobs-worker` (cron 1 min, processa fila com lock)
12. `moderate-content` (pré-checagem)
13. `estimate-cost`

## 8. Integração OpenAI
- Cliente único `openai.ts` em `_shared/`. Lê `OPENAI_API_KEY` do env.
- Texto: Responses API com `response_format: json_schema` (Zod → JSON Schema) para Bíblia, personagens, roteiro, storyboard.
- Imagem: `gpt-image-2` via `/v1/images/generations` e `/v1/images/edits` (para regenerações com referência de personagem).
- Retry exponencial em 429/5xx; circuit breaker; registro em `usage_events`.

## 9. Processamento de arquivos
- Upload direto ao Storage com URL assinada; tipo/tamanho validados (cap 25 MB MVP).
- Worker baixa, identifica tipo, extrai texto, faz chunking (~3k tokens), sumariza por chunk e consolida em "texto canônico" salvo em `source_files.extracted_text`.
- Documentos com imagens: extrair imagens em PDFs ilustrados é fora do MVP; apenas texto.

## 10. Consistência de personagens (Character Lock)
- Cada personagem aprovado tem: descrição canônica versionada + 1–3 imagens canônicas (frente, ¾, expressão).
- Todo prompt de quadro injeta o "pacote de contexto" (descrição + features imutáveis + roupa da cena + continuidade).
- Geração de quadro usa `images/edits` com as referências canônicas como input; força paleta/roupas.
- `continuity_state` atualizado por job pós-aprovação de página (ferimentos, roupas, posses).

## 11. Filas e jobs
- `generation_jobs` com `status`, `attempts`, `lease_until`. Worker faz `SELECT ... FOR UPDATE SKIP LOCKED`.
- Tipos: parse, bible, characters, sheet, script, storyboard, panel, page-compose, cover, export.
- Idempotência por hash do payload. Retry 3x com backoff. Aprovações criam jobs filhos.
- UI assina canal Realtime de `generation_jobs` por projeto.

## 12. Montagem de páginas
- Layout salvo em `pages.layout_json` (grid de retângulos + gutter + sangria).
- Arte por quadro gerada SEM texto.
- `compose-page`: posiciona artes nos retângulos, renderiza balões/narrações/onomatopeias como SVG sobreposto, exporta PNG final para `pages.final_image_path`. Balões permanecem editáveis até o export.
- Direção de leitura inverte `reading_order` dos quadros e ordem dos balões; preview mostra setas de fluxo.

## 13. Exportação PDF
- Edge Function `export-pdf` com `pdf-lib`:
  - Modo leitura digital: PNGs de páginas em ~150 DPI.
  - Modo alta qualidade: recompõe em 300 DPI a partir das artes originais + SVG vetorial dos balões → imagem por página.
  - Suporte A4/A5/B5/custom, margens, sangria, capa/contracapa, créditos, numeração, RTL/LTR (ordem das páginas invertida em RTL).
  - Nome do arquivo: `titulo-do-manga-capitulo-01.pdf`. Salvo em `exports/` com URL assinada.

## 14. Segurança
- RLS em todas as tabelas; políticas baseadas em `auth.uid()`.
- Buckets privados; uploads validados (MIME + magic bytes + tamanho).
- Sanitização de nomes; bloqueio de executáveis.
- Rate limit por usuário (tabela `usage_events` + checagem em Edge Function).
- Moderação prévia (texto e prompt de imagem) via `omni-moderation-latest`.
- Confirmação de direitos para uploads de continuação.
- Secrets só no backend (`OPENAI_API_KEY` via secret tool).
- Logs estruturados sem PII.

## 15. Riscos e soluções
| Risco | Solução |
|---|---|
| Inconsistência visual dos personagens | Character Lock com imagens canônicas + `images/edits` referenciadas em todo painel |
| Custo alto de imagens | Estimativa antes de cada job, limites por usuário/projeto, aprovações obrigatórias por etapa, regeneração contabilizada |
| Tempo longo de processamento | Jobs paralelos por quadro, Realtime para progresso, retomada após fechar navegador |
| Texto dentro da imagem com erros | Arte sempre sem texto; balões em SVG sobreposto |
| PDFs grandes/ilustrados na entrada | Chunking + sumarização hierárquica; cap de tamanho no MVP |
| Direção de leitura confusa | Toggle global por projeto + setas de fluxo no storyboard e editor |
| Falhas da API OpenAI | Retry exponencial, circuit breaker, status `failed` retomável |
| Abuso/conteúdo proibido | Moderação obrigatória pré-geração; bloqueio de pessoas reais e cópia de artistas vivos |
| Página inteira gerada em uma chamada | Proibido por design; sempre quadro a quadro + composição |
| Limites de Worker (Cloudflare) | Jobs curtos; processamento pesado fatiado em múltiplos invokes do worker |

## 16. Plano de implementação por fases
**Fase 1 — Fundação (semana 1)**
- Habilitar Lovable Cloud; design system (paleta P/B/vermelho, retículas sutis); auth (email + Google); migrations base (`profiles`, `projects`, `user_roles`, `has_role`); dashboard; criação simples de projeto.

**Fase 2 — Upload e análise (semana 2)**
- Storage `sources/`; `parse-document` (PDF/DOCX/TXT/MD); editor de texto colado; `analyze-story` → Bíblia editável + aprovação.

**Fase 3 — Personagens (semana 3)**
- `detect-characters`; UI de fichas; upload de referências; `generate-character-sheet`; Character Lock.

**Fase 4 — Roteiro + storyboard (semana 4)**
- `generate-script` por capítulo; `generate-storyboard` com miniaturas; editor de storyboard com reorganização e direção de leitura.

**Fase 5 — Geração visual (semana 5)**
- `generate-panel` com pacote de contexto; versionamento em `generated_assets`; regeneração de quadro com instrução livre.

**Fase 6 — Editor de páginas (semana 6)**
- Konva canvas; balões SVG (diálogo/pensamento/grito/sussurro/narração/eletrônico/onomatopeia); recorte, mover, redimensionar; histórico; salvamento automático.

**Fase 7 — Capa + Exportação (semana 7)**
- `generate-cover`; `export-pdf` (A4/A5/B5, RTL/LTR, alta/baixa); download via URL assinada.

**Fase 8 — Custos, limites, moderação, testes (semana 8)**
- `usage_events`; limites administrativos; moderação; testes end-to-end conforme PRD §37; ajustes de performance.

## 17. Ordem recomendada de desenvolvimento
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (linear; cada fase encerra com um fluxo testável de ponta a ponta sobre um projeto de exemplo).

## 18. Perguntas essenciais antes de implementar
1. **OpenAI API Key:** você já possui uma chave da OpenAI para colocarmos como secret? (sem ela, geração não funciona — texto e imagem)
2. **Modelos default:** posso usar `gpt-5` (ou `gpt-4.1` se preferir) para texto e `gpt-image-2` para imagem, ambos configuráveis por env?
3. **Auth:** apenas email/senha + Google no MVP, ou quer também Apple?
4. **Idiomas da UI:** começar em **português** apenas, e adicionar inglês depois?
5. **Limites iniciais por usuário** (para conter custo no MVP): sugiro 3 projetos ativos, 1 capítulo por vez, 20 páginas máx., 3 regenerações por quadro — confirma esses números?
6. **Continuação de obras existentes (Opção D):** entra no MVP ou fica para Fase 9? (é o item de maior risco/complexidade)

Não vou implementar nada antes da sua aprovação deste plano e das respostas acima.
