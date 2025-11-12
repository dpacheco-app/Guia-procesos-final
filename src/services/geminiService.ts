import { GoogleGenAI, Modality } from "@google/genai";
import type { GroundingChunk } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/**
 * Genera un informe técnico del proceso constructivo con streaming y fuentes.
 */
export async function fetchConstructionProcess(
  query: string,
  onStream: (chunk: string) => void
): Promise<{ sources: GroundingChunk[] }> {
  try {
    const model = "gemini-2.5-pro";

    const prompt = `
Eres un ingeniero civil experto en procesos constructivos y normativa de construcción colombiana.
Redacta un informe técnico, detallado y claro sobre el siguiente proceso, basándote en la normativa colombiana (como la NSR-10) y las mejores prácticas de la industria:
"${query}"

Tu respuesta debe estar bien estructurada, en formato Markdown, e incluir:
- Descripción general del proceso.
- Materiales y herramientas principales requeridos.
- Secuencia constructiva paso a paso.
- Puntos críticos de control de calidad según la normativa.
- Riesgos laborales y errores comunes a evitar.
- Recomendaciones técnicas y normativas clave.`;

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let sources: GroundingChunk[] = [];
    for await (const chunk of responseStream) {
      const textChunk = chunk.text;
      if (textChunk) {
        onStream(textChunk);
      }
      
      const chunkSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunkSources) {
        // Deduping sources
        // FIX: The GroundingChunk type from the Gemini API has optional properties,
        // while our internal type is stricter. We need to filter for valid sources
        // with a URI and map them to our internal type.
        chunkSources.forEach(source => {
          if (source.web?.uri && !sources.some(s => s.web.uri === source.web.uri)) {
            sources.push({
              web: {
                uri: source.web.uri,
                title: source.web.title || source.web.uri,
              }
            });
          }
        });
      }
    }
    return { sources };
  } catch (error) {
    console.error("Error en fetchConstructionProcess:", error);
    throw new Error("No se pudo generar el texto del proceso constructivo.");
  }
}

/**
 * Genera una imagen descriptiva del proceso constructivo.
 * Devuelve un Blob (imagen) que puede mostrarse directamente en <img src={...} />.
 */
export async function generateProcessImage(query: string): Promise<Blob> {
  try {
    const prompt = `
Crea una ilustración técnica, clara y realista que muestre el proceso constructivo descrito a continuación:
"${query}"

La imagen debe tener un estilo profesional de diagrama de ingeniería o arquitectura, sin texto, anotaciones ni logotipos. Debe representar de forma precisa el entorno típico de una obra civil en Colombia.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageBase64 = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;

          const byteCharacters = atob(imageBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
      
          return new Blob([byteArray], { type: mimeType });
        }
    }

    throw new Error("No se recibió imagen del modelo");

  } catch (error) {
    console.error("Error en generateProcessImage:", error);
    throw new Error("No se pudo generar la imagen del proceso constructivo.");
  }
}
