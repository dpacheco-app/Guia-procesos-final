// services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

/**
 * Genera un informe técnico del proceso constructivo.
 * Usa el modelo gemini-1.5-pro para respuestas de texto.
 */
export async function fetchConstructionProcess(query: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
Eres un ingeniero civil experto en procesos constructivos.
Redacta un informe técnico, detallado y claro sobre el siguiente proceso:
"${query}"

Incluye:
- Descripción general
- Materiales y herramientas principales
- Secuencia constructiva
- Controles de calidad
- Riesgos o errores comunes
- Recomendaciones técnicas
    `;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    return text.trim();
  } catch (error) {
    console.error("Error en fetchConstructionProcess:", error);
    throw new Error("No se pudo generar el texto del proceso constructivo.");
  }
}

/**
 * Genera una imagen descriptiva del proceso constructivo.
 * Devuelve un Blob (imagen) que puede mostrarse directamente en <img src={...} />.
 */
export async function generateProcessImage(query: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Crea una imagen técnica y realista que muestre el proceso constructivo descrito a continuación:
"${query}"

Debe tener estilo profesional, sin texto ni logotipos, y representar el entorno típico de obra civil.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "image/jpeg" },
    });

    const imageBase64 =
      result.response.candidates?.[0]?.content.parts?.[0]?.inlineData?.data;

    if (!imageBase64) {
      throw new Error("No se recibió imagen del modelo");
    }

    const byteCharacters = atob(imageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    return new Blob([byteArray], { type: "image/jpeg" });
  } catch (error) {
    console.error("Error en generateProcessImage:", error);
    throw new Error("No se pudo generar la imagen del proceso constructivo.");
  }
}