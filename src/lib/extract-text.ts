// Extrai texto de arquivos enviados (txt/md/rtf direto; pdf via pdfjs; docx via mammoth).
// Só roda no cliente (importado dinamicamente a partir de um handler de evento).
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  if (["txt", "md", "markdown", "text", "csv"].includes(ext)) {
    return (await file.text()).trim();
  }

  if (ext === "rtf") {
    return stripRtf(await file.text());
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  if (ext === "pdf") {
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" ") + "\n\n";
    }
    return text.trim();
  }

  throw new Error("Formato não suportado. Use TXT, MD, RTF, PDF ou DOCX.");
}
