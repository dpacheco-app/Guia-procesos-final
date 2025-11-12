// services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
import type { GroundingChunk } from '../types';
import {
  NetworkError,
  InvalidQueryError,
  ServiceUnavailableError,
  NoApiKeyError,
  ApiError,
} from './errors';

/**
 * Model names (ajusta si tu proyecto usa otros)
 */
const textModel = 'gemini-2.5-flash';
const imageModel = 'imagen-4.0-generate-001';

/**
 * Crea el cliente de Google GenAI.
 * Lanza NoApiKeyError si no encuentra la API key.
 */
const getGenAI = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY || (typeof window !== 'undefined' && (window as any).__API_KEY__);
  if (!apiKey) throw new NoApiKeyError();
  return new GoogleGenAI({ apiKey });
};

/**
 * Convierte base64 (sin prefijo) a Blob.
 * Funciona tanto en navegador como en Node (server-side).
 */
const base64ToBlob = (base64: string, mime = 'image/jpeg'): Blob => {
  // Si estamos en Node (SSR) usamos Buffer
  if (typeof window === 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Blob([buf], { type: mime } as any); // TS: Blob from Buffer on Node runtime may require any
  }

  // En navegador: atob -> Uint8Array -> Blob
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * Manejo centralizado de errores (reusa los errores del proyecto).
 * Lanza la excepción adecuada para que el caller la capture si necesita.
 */
const handleApiError = (error: any): never => {
  if (!error) throw new ApiError('Unknown error in image generation');
  // errores del SDK o fetch
  const msg = error?.message || String(error);

  if (/network/i.test(msg)) throw new NetworkError(msg);
  if (/invalid query|bad request/i.test(msg)) throw new InvalidQueryError(msg);
  if (/service unavailable|timeout/i.test(msg)) throw new ServiceUnavailableError(msg);
  if (/api key|unauthorized|401/i.test(msg)) throw new NoApiKeyError(msg);

  throw new ApiError(msg);
};

/**
 * generateProcessImage
 * Genera una imagen desde Google AI (Imagen) y devuelve un Blob listo para usar con URL.createObjectURL(blob)
 *
 * @param query - texto descriptivo para la imagen (prompt)
 * @returns Promise<Blob>
 */
export async function generateProcessImage(query: string): Promise<Blob> {
  if (!query || typeof query !== 'string') {
    throw new InvalidQueryError('Query inválida para la generación de imagen.');
  }

  try {
    const ai = getGenAI();

    // Prompt sencillo y controlado; ajústalo a tus necesidades
    const prompt = `Dibujo técnico profesional, diagrama claro y etiquetado en español. Describir: ${query}`;

    const response = await ai.models.generateImages({
      model: imageModel,
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '4:3',
      },
    });

    // Validación de la respuesta
    const image = response?.generatedImages?.[0];
    if (!image) {
      console.error('Respuesta de generación sin generatedImages:', response);
      throw new ApiError('No se recibió imagen desde el servicio AI.');
    }

    const imageBase64 = image.image?.imageBytes;
    if (!imageBase64) {
      console.error('generatedImages[0] no contiene image.imageBytes:', response);
      throw new ApiError('La generación de imagen no devolvió datos válidos.');
    }

    // imageBase64 es la cadena base64 sin prefijo data:... o puede venir sólo imageBytes.
    // Convertir a Blob
    const blob = base64ToBlob(imageBase64, 'image/jpeg');
    return blob;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Función auxiliar exportada por si quieres convertir base64 público a Blob sin llamar al AI.
 */
export function convertBase64ToBlob(base64WithOrWithoutPrefix: string): Blob {
  // eliminar prefijo si existe
  const commaIndex = base64WithOrWithoutPrefix.indexOf(',');
  const raw = commaIndex >= 0 ? base64WithOrWithoutPrefix.split(',')[1] : base64WithOrWithoutPrefix;
  return base64ToBlob(raw, 'image/jpeg');
}