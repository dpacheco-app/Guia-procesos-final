import React, { useState, useCallback, useRef } from 'react';
import { SearchBar } from './components/SearchBar';
import { ResultDisplay } from './components/ResultDisplay';
import { Loader } from './components/Loader';
import { BuildingIcon } from './components/icons/BuildingIcon';
import { PrintIcon } from './components/icons/PrintIcon';
import { fetchConstructionProcess, generateProcessImage } from './services/geminiService';
import type { SearchResult } from './types';

// Declare global variables from CDN scripts
declare const jspdf: any;
declare const html2canvas: any;

interface SearchHistoryProps {
  history: string[];
  onHistoryClick: (query: string) => void;
  isLoading: boolean;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onHistoryClick, isLoading }) => {
  if (history.length === 0) return null;

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
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, { result: SearchResult; imageUrl: string | null }>());

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (isSearching) return;

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return;

    // Revisar cache
    if (cache.current.has(normalizedQuery)) {
      const cached = cache.current.get(normalizedQuery)!;
      setSearchResult(cached.result);
      setImageUrl(cached.imageUrl);
      setError(null);
      setImageError(null);
      setIsLoading(false);
      setIsImageLoading(false);
      setSearchHistory((prev) => [searchQuery, ...prev.filter((q) => q.toLowerCase() !== normalizedQuery)].slice(0, 3));
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
      fullText += chunk || '';
      setSearchResult((prev) => ({
        text: (prev?.text || '') + (chunk || ''),
        sources: prev?.sources || [],
      }));
    };

    try {
      const [imageResult, sourcesResult] = await Promise.allSettled([
        generateProcessImage(searchQuery),
        fetchConstructionProcess(searchQuery, onTextStream),
      ]);

      setIsImageLoading(false);
      let finalImageUrl: string | null = null;

      // ✅ Imagen
      if (imageResult.status === 'fulfilled' && imageResult.value) {
        const blob = imageResult.value;
        // Si hay una imagen anterior, liberar la URL
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        const url = URL.createObjectURL(blob);
        finalImageUrl = url;
        setImageUrl(url);
        setImageError(null);
      } else if (imageResult.status === 'rejected') {
        const reason = imageResult.reason as Error;
        const msg = reason.name.endsWith('Error')
          ? reason.message
          : 'No se pudo generar la ilustración para este proceso.';
        setImageError(msg);
        console.error('Image generation failed:', reason);
      }

      // ✅ Texto
      if (sourcesResult.status === 'fulfilled') {
        const finalSources = sourcesResult.value.sources;
        setSearchResult({ text: fullText, sources: finalSources });

        setSearchHistory((prev) =>
          [searchQuery, ...prev.filter((q) => q.toLowerCase() !== normalizedQuery)].slice(0, 3)
        );

        if (finalImageUrl) {
          cache.current.set(normalizedQuery, {
            result: { text: fullText, sources: finalSources },
            imageUrl: finalImageUrl,
          });
        } else {
          cache.current.delete(normalizedQuery);
        }

        setError(null);
      } else {
        const reason = sourcesResult.reason as Error;
        const msg = reason.name.endsWith('Error')
          ? reason.message
          : 'Ocurrió un error al obtener los detalles del proceso.';
        setError(msg);
        setSearchResult(null);
        cache.current.delete(normalizedQuery);
        console.error('Text generation failed:', reason);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'Ocurrió un error al procesar la solicitud.');
      cache.current.delete(normalizedQuery);
    } finally {
      setIsSearching(false);
      setIsLoading(false);
      setIsImageLoading(false);
    }
  }, [isSearching, imageUrl]);

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    handleSearch(q);
  };

  const handlePrint = async () => {
    const sourceNode = printRef.current;
    if (!sourceNode || typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
      setError('Error: No se pudo generar el PDF. Faltan librerías.');
      return;
    }

    try {
      const { jsPDF } = jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
      const canvas = await html2canvas(sourceNode, { scale: 2, useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const props = pdf.getImageProperties(img);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (props.height * pdfWidth) / props.width;
      pdf.addImage(img, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`proceso_${query.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      setError('Error al generar el PDF.');
    }
  };

  const handlePrintImage = useCallback(() => {
    if (!imageUrl || typeof jspdf === 'undefined') return;
    const { jsPDF } = jspdf;
    const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const img = new Image();

    img.onload = () => {
      const ratio = img.width / img.height;
      let w = pageWidth - margin * 2;
      let h = w / ratio;
      if (h > pageHeight - margin * 2) {
        h = pageHeight - margin * 2;
        w = h * ratio;
      }
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;
      pdf.addImage(img, 'JPEG', x, y, w, h);
      pdf.save(`esquema_${query.replace(/\s+/g, '_')}.pdf`);
    };
    img.onerror = () => setImageError('No se pudo cargar la imagen para generar el PDF.');
    img.src = imageUrl;
  }, [imageUrl, query]);

  return (
    <div className="min-h-screen text-gray-200 font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <BuildingIcon className="w-12 h-12 text-cyan-400" />
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
            <SearchBar query={query} setQuery={setQuery} onSearch={handleSearch} isLoading={isSearching} />
          </div>

          <SearchHistory history={searchHistory} onHistoryClick={handleHistoryClick} isLoading={isSearching} />

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