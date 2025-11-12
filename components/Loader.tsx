
import React from 'react';

export const Loader: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-500"></div>
            <p className="text-lg font-semibold text-cyan-400">Procesando su solicitud...</p>
            <p className="text-gray-400">
                Consultando normativas y generando el esquema. Esto puede tardar un momento.
            </p>
        </div>
    );
};
