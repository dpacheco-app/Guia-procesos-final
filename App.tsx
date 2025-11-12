
import React, { useState, useCallback, useRef } from 'react';
import { SearchBar } from './components/SearchBar';
import { ResultDisplay } from './components/ResultDisplay';
import { Loader } from './components/Loader';
import { BuildingIcon } from './components/icons/BuildingIcon';
import { PrintIcon } from './components/icons/PrintIcon';
import { fetchConstructionProcess, generateProcessImage } from './services/geminiService';
import type { SearchResult, GroundingChunk } from './types';

// Declare global variables from CDN scripts
declare const jspdf: any;
declare const html2canvas: any;

interface SearchHistoryProps {
    history: string[];
    onHistoryClick: (query: string) => void;
    isLoading: boolean;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onHistoryClick, isLoading }) => {
    if (history.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 animate-fade-in">
            <span className="text-gray-400 text-sm font-medium">Búsquedas recientes:</span>
            {history.map((item) => (
                <button
                    key={item}
                    onClick={() => onHistoryClick(item)}
                    disabled={isLoading}
                    className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {item}
                </button>
            ))}
        </div>
    );
};

const App: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const cache = useRef(new Map<string, { result: SearchResult; imageUrl: string | null; }>());
    const [isSearching, setIsSearching] = useState<boolean>(false);

    const handleSearch = useCallback(async (searchQuery: string) => {
        if (isSearching) return;

        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) return;

        if (cache.current.has(normalizedQuery)) {
            const cachedData = cache.current.get(normalizedQuery)!;
            setSearchResult(cachedData.result);
            setImageUrl(cachedData.imageUrl);
            setError(null);
            setImageError(null);
            setIsLoading(false);
            setIsImageLoading(false);
            
            setSearchHistory(prev => {
                const updatedHistory = [searchQuery, ...prev.filter(q => q.toLowerCase() !== normalizedQuery)];
                return updatedHistory.slice(0, 3);
            });
            return;
        }

        setIsSearching(true);
        setIsLoading(true);
        setIsImageLoading(true);
        setError(null);
        setImageError(null);
        setSearchResult(null);
        setImageUrl(null);
        
        let fullText = '';

        const onTextStream = (chunk: string) => {
            if (isLoading) setIsLoading(false); 
            const textChunk = chunk || '';
            fullText += textChunk;
            setSearchResult(prev => {
                const existingText = prev ? prev.text : '';
                return { text: existingText + textChunk, sources: prev?.sources || [] };
            });
        };

        try {
            const [imageResult, sourcesResult] = await Promise.allSettled([
                generateProcessImage(searchQuery),
                fetchConstructionProcess(searchQuery, onTextStream),
            ]);

            setIsImageLoading(false);

            let finalImageUrl: string | null = null;
            
            if (imageResult.status === 'fulfilled' && imageResult.value) {
                finalImageUrl = imageResult.value;
                setImageUrl(finalImageUrl);
                setImageError(null);
            } else if (imageResult.status === 'rejected') {
                const reason = imageResult.reason as Error;
                const errorMessage = (reason.name.endsWith('Error')) 
                    ? reason.message 
                    : 'No se pudo generar la ilustración para este proceso.';
                setImageError(errorMessage);
                console.error("Image generation failed:", reason);
            }

            if (sourcesResult.status === 'fulfilled') {
                const finalSources = sourcesResult.value.sources;
                setSearchResult(prev => ({
                    text: prev?.text || fullText,
                    sources: finalSources,
                }));
                
                setSearchHistory(prev => {
                    const updatedHistory = [searchQuery, ...prev.filter(q => q.toLowerCase() !== normalizedQuery)];
                    return updatedHistory.slice(0, 3);
                });

                if (imageResult.status === 'fulfilled' && finalImageUrl) {
                    const finalResult: SearchResult = { text: fullText, sources: finalSources };
                    cache.current.set(normalizedQuery, { result: finalResult, imageUrl: finalImageUrl });
                } else {
                    cache.current.delete(normalizedQuery);
                }

                setError(null);

            } else {
                 const reason = sourcesResult.reason as Error;
                 const errorMessage = (reason.name.endsWith('Error'))
                    ? reason.message
                    : 'Ocurrió un error al obtener los detalles del proceso.';
                 setError(errorMessage);
                 setSearchResult(null);
                 cache.current.delete(normalizedQuery);
                 console.error("Text generation/sourcing failed:", reason);
            }

        } catch (err: any) {
            console.error("An unexpected error occurred in handleSearch:", err);
            setError(err.message || 'Ocurrió un error al procesar la solicitud.');
            cache.current.delete(normalizedQuery);
        } finally {
            setIsSearching(false);
            setIsLoading(false);
            setIsImageLoading(false);
        }
    }, [isSearching]);

    const handleHistoryClick = (historicQuery: string) => {
        setQuery(historicQuery);
        handleSearch(historicQuery);
    };

    const handlePrint = async () => {
        const sourceNode = printRef.current;
        if (!sourceNode || typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            setError("Error: No se pudo generar el PDF. Las librerías necesarias no están cargadas o el contenido no existe.");
            return;
        }

        const textNode = sourceNode.querySelector('#pdf-text-content');
        const imageNode = sourceNode.querySelector('#pdf-image-content');
        const sourcesNode = sourceNode.querySelector('#pdf-sources-content');

        if (!textNode || !imageNode) {
            setError("Error: La estructura del contenido para el PDF es inválida. No se encontraron los bloques de texto o imagen.");
            return;
        }

        try {
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 40;
            const contentWidth = pdfWidth - margin * 2;
            const contentHeight = pageHeight - margin * 2;

            // --- STEP 1: Process the text content block ---
            const textCanvas = await html2canvas(textNode as HTMLElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#374151',
                logging: false,
            });

            const textImgData = textCanvas.toDataURL('image/jpeg', 0.95);
            const textImgProps = pdf.getImageProperties(textImgData);
            
            const textImgRatio = textImgProps.height / textImgProps.width;
            const textPdfTotalHeight = contentWidth * textImgRatio;

            let textPosition = 0;
            let pageCount = 0;
            while (textPosition < textPdfTotalHeight) {
                if (pageCount > 0) {
                    pdf.addPage();
                }
                pdf.addImage(textImgData, 'JPEG', margin, -textPosition + margin, contentWidth, textPdfTotalHeight);
                textPosition += contentHeight;
                pageCount++;
            }

            // --- STEP 2: Process the image content block on a new, dedicated page ---
            const imageCanvas = await html2canvas(imageNode as HTMLElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#374151',
                logging: false,
            });

            pdf.addPage();

            const imageImgData = imageCanvas.toDataURL('image/jpeg', 0.95);
            const imageImgProps = pdf.getImageProperties(imageImgData);
            const imageImgRatio = imageImgProps.height / imageImgProps.width;

            let pdfImgWidth = contentWidth;
            let pdfImgHeight = contentWidth * imageImgRatio;
            
            if (pdfImgHeight > contentHeight) {
                pdfImgHeight = contentHeight;
                pdfImgWidth = pdfImgHeight / imageImgRatio;
            }

            const x = (pdfWidth - pdfImgWidth) / 2;
            const y = (pageHeight - pdfImgHeight) / 2;

            pdf.addImage(imageImgData, 'JPEG', x, y, pdfImgWidth, pdfImgHeight);
            
            // --- STEP 3: Process the sources content block (if it exists) ---
            if (sourcesNode) {
                const sourcesCanvas = await html2canvas(sourcesNode as HTMLElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#374151',
                    logging: false,
                });

                const sourcesImgData = sourcesCanvas.toDataURL('image/jpeg', 0.95);
                const sourcesImgProps = pdf.getImageProperties(sourcesImgData);
                const sourcesImgRatio = sourcesImgProps.height / sourcesImgProps.width;
                const sourcesPdfTotalHeight = contentWidth * sourcesImgRatio;

                pdf.addPage();
                let sourcesPosition = 0;
                let sourcesPageCount = 0;
                while (sourcesPosition < sourcesPdfTotalHeight) {
                    if (sourcesPageCount > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(sourcesImgData, 'JPEG', margin, -sourcesPosition + margin, contentWidth, sourcesPdfTotalHeight);
                    sourcesPosition += contentHeight;
                    sourcesPageCount++;
                }
            }

            // --- STEP 4: Save the final PDF document ---
            const fileName = `resumen_${query.replace(/\s+/g, '_').toLowerCase()}.pdf`;
            pdf.save(fileName);

        } catch (e) {
            console.error("Error al generar el PDF con html2canvas:", e);
            setError("Ocurrió un error al crear el archivo PDF. Por favor, inténtelo de nuevo.");
        }
    };
    
    const handlePrintImage = useCallback(() => {
        if (!imageUrl || typeof jspdf === 'undefined') {
            console.error("No image URL or jspdf library not found.");
            return;
        }
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'letter' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;

        const img = new Image();
        img.onload = () => {
            const imgWidth = img.width;
            const imgHeight = img.height;
            const ratio = imgWidth / imgHeight;

            let pdfImgWidth = pageWidth - margin * 2;
            let pdfImgHeight = pdfImgWidth / ratio;
            
            if (pdfImgHeight > pageHeight - margin * 2) {
                pdfImgHeight = pageHeight - margin * 2;
                pdfImgWidth = pdfImgHeight * ratio;
            }

            const x = (pageWidth - pdfImgWidth) / 2;
            const y = (pageHeight - pdfImgHeight) / 2;

            const imageFormat = imageUrl.substring(imageUrl.indexOf('/') + 1, imageUrl.indexOf(';')).toUpperCase();
            pdf.addImage(imageUrl, imageFormat, x, y, pdfImgWidth, pdfImgHeight);

            const fileName = `esquema_${query.replace(/\s+/g, '_').toLowerCase()}.pdf`;
            pdf.save(fileName);
        };
        img.onerror = () => {
            setImageError("No se pudo cargar la imagen para generar el PDF. El archivo de imagen puede estar corrupto.");
        };
        img.src = imageUrl;
    }, [imageUrl, query]);
    

    return (
        <div className="min-h-screen text-gray-200 font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <div className="flex justify-center items-center gap-4 mb-4">
                        <BuildingIcon className="w-12 h-12 text-cyan-400"/>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
                            GUIA PROCESOS CONSTRUCTIVOS
                        </h1>
                    </div>
                    <p className="text-gray-400 text-lg">
                        Busque un proceso constructivo y obtenga un resumen técnico basado en la normativa colombiana.
                    </p>
                </header>

                <main>
                    <div className="mb-4">
                        <SearchBar
                            query={query}
                            setQuery={setQuery}
                            onSearch={handleSearch}
                            isLoading={isSearching}
                        />
                    </div>
                    
                    <SearchHistory 
                        history={searchHistory} 
                        onHistoryClick={handleHistoryClick}
                        isLoading={isSearching}
                    />

                    {!isSearching && searchResult && (
                         <div className="flex justify-end mb-6">
                            <button
                                onClick={handlePrint}
                                className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 transition-colors duration-300"
                            >
                                <PrintIcon className="w-5 h-5 mr-2" />
                                Imprimir Resumen (PDF)
                            </button>
                        </div>
                    )}

                    {isLoading && <Loader />}

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center backdrop-blur-sm">
                            <p className="font-semibold">Error al obtener la información</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && searchResult && (
                        <ResultDisplay
                            searchResult={searchResult}
                            imageUrl={imageUrl}
                            imageError={imageError}
                            query={query}
                            printRef={printRef}
                            isImageLoading={isImageLoading}
                            handlePrintImage={handlePrintImage}
                        />
                    )}

                    {!isSearching && !searchResult && !error && (
                        <div className="text-center text-gray-500 mt-12">
                            <p>Ingrese una actividad de construcción para comenzar.</p>
                            <p className="text-sm">Ej: "Instalación de una viga de cimentación"</p>
                        </div>
                    )}
                </main>
                 <footer className="text-center mt-12 text-gray-600 text-sm">
                    <p>Desarrollado con IA. La información debe ser verificada por un profesional.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
