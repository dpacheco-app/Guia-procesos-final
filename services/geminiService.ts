
import { GoogleGenAI } from "@google/genai";
import type { GroundingChunk } from '../types';
import { NetworkError, InvalidQueryError, ServiceUnavailableError, NoApiKeyError, ApiError } from './errors';

// Using gemini-2.5-flash for faster text responses.
const textModel = 'gemini-2.5-flash';
// Using Imagen for higher quality and better control over image generation.
const imageModel = 'imagen-4.0-generate-001';

const getGenAI = (): GoogleGenAI => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new NoApiKeyError();
    }
    return new GoogleGenAI({ apiKey });
}

const handleApiError = (error: any): never => {
    console.error("Gemini API Error:", error);

    if (error instanceof ApiError) {
        throw error;
    }
    
    // Check for network errors first
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('failed to fetch')) {
        throw new NetworkError();
    }
    
    const status = error.httpStatus || error.status || (error.e && error.e.code);
    
    if (status) {
        if (status === 400 || status === 'INVALID_ARGUMENT') {
            throw new InvalidQueryError("La consulta es inválida o el modelo no pudo procesarla. Por favor, reformule su búsqueda.");
        }
        if (status >= 500 || status === 'UNAVAILABLE') {
            throw new ServiceUnavailableError();
        }
    }
    
    // Fallback for other errors
    throw new ApiError("Ocurrió un error inesperado al comunicarse con el servicio de IA.");
}


export async function fetchConstructionProcess(
    query: string,
    onStream: (textChunk: string) => void
): Promise<{ sources: GroundingChunk[] }> {
    const ai = getGenAI();

    const prompt = `
        Eres un asistente experto en ingeniería civil y arquitectura especializado en normatividad de construcción colombiana.

        Para la siguiente actividad de construcción: "${query}"

        Genera una respuesta detallada y técnica en español con la siguiente estructura:
        
        1.  **Descripción del Proceso:** Una explicación clara y concisa de la actividad.
        2.  **Pasos Clave para el Éxito:** Una lista numerada de los pasos más importantes a seguir, en orden cronológico.
        3.  **Parámetros y Materiales:** Información puntual, exacta y precisa sobre materiales, dosificaciones y control de calidad.
        4.  **Normatividad Aplicable:** Un apartado específico y claro bajo este título exacto. Aquí debes resumir las normas clave que aplican al proceso descrito, explicando brevemente su incumbencia.

        **REQUISITOS INDISPENSABLES:**
        *   **Citas Inline:** Toda la información en los puntos 1, 2 y 3 debe estar rigurosamente soportada y citar explícitamente las normas colombianas cuando apliquen. Para cada paso, parámetro, material o dosificación, debes indicar de forma explícita y junto a la descripción, cuál norma específica (y si es posible, qué artículo o sección) lo respalda. Por ejemplo: "El concreto debe tener una resistencia de 21 MPa (NSR-10, Título C.5.2)". La conexión entre la información y la norma debe ser directa e inequívoca.
        *   **Condicional de Normatividad:** Si después de tu análisis, ninguna de las normativas de la lista aplica directamente al proceso consultado, DEBES OMITIR POR COMPLETO la sección "Normatividad Aplicable". No escribas "No aplica" ni nada similar; simplemente no incluyas el título ni la sección.
        *   **Formato Markdown:** Utiliza formato Markdown para la respuesta. Usa encabezados de nivel 1 (#) y 2 (##) únicamente. No uses encabezados de nivel 3 (###) o inferiores.

        **Lista de normativas de referencia obligatoria:**
        *   NSR-10
        *   Normas Técnicas Colombianas (NTC)
        *   Normas ICONTEC
        *   Reglamento Técnico del Sector de Agua Potable y Saneamiento Básico (RAS)
        *   Reglamento Técnico de Instalaciones Eléctricas (RETIE)
        *   Reglamento Técnico de Iluminación y Alumbrado Público (RETILAP)
        *   Reglamento Técnico para Redes Internas de Telecomunicaciones (RITEL)
    `;
    
    try {
        const resultStream = await ai.models.generateContentStream({
            model: textModel,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
    
        let sources: GroundingChunk[] = [];
        for await (const chunk of resultStream) {
            onStream(chunk.text);
            if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                sources = chunk.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[];
            }
        }
        return { sources };

    } catch (error) {
        handleApiError(error);
    }
}


export async function generateProcessImage(query: string): Promise<string> {
    const ai = getGenAI();
    
    const prompt = `Un dibujo técnico profesional y detallado, estilo diagrama de un manual de construcción. La ilustración debe ilustrar claramente el proceso de: "${query}". Usar una paleta de colores limpia que diferencie materiales y etapas constructivas. Todas las etiquetas y anotaciones deben estar en ESPAÑOL. La imagen debe ser clara, precisa y de alta calidad.`;
    
    try {
        const response = await ai.models.generateImages({
            model: imageModel,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '4:3',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const image = response.generatedImages[0];
            if (image.image?.imageBytes) {
                const base64ImageBytes: string = image.image.imageBytes;
                return `data:image/jpeg;base64,${base64ImageBytes}`;
            }
        }
        
        console.error("Imagen generation response did not contain valid image data.", response);
        throw new ApiError("La generación de imagen no devolvió datos válidos.");

    } catch (error) {
        handleApiError(error);
    }
}
