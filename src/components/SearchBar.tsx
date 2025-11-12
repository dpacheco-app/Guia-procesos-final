import React from 'react';
import { SearchIcon } from './icons/SearchIcon';

interface SearchBarProps {
    query: string;
    setQuery: (query: string) => void;
    onSearch: (query: string) => void;
    isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery, onSearch, isLoading }) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(query);
    };

    return (
        <form onSubmit={handleSubmit} className="relative">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: Muro de contención en concreto reforzado..."
                className="w-full pl-5 pr-28 py-4 text-lg bg-gray-800 border-2 border-gray-600 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-lg"
                disabled={isLoading}
            />
            <button
                type="submit"
                disabled={isLoading}
                className="absolute inset-y-0 right-2.5 my-2.5 flex items-center justify-center px-6 bg-cyan-600 text-white font-semibold rounded-full hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-300"
            >
                {isLoading ? (
                    'Buscando...'
                ) : (
                    <>
                        <SearchIcon className="w-5 h-5 mr-2" />
                        Buscar
                    </>
                )}
            </button>
        </form>
    );
};
