
import React from 'react';

export const BuildingIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <path d="M4 22h16" />
        <path d="M6 18v-5" />
        <path d="M12 18V8" />
        <path d="M18 18v-9" />
        <path d="M14 22v-2a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
        <path d="M4 13.5a2.5 2.5 0 0 1 5 0V18" />
        <path d="M20 9.5a2.5 2.5 0 0 0-5 0V18" />
        <path d="M10 8V5c0-1.7 1.3-3 3-3v0c1.7 0 3 1.3 3 3v3" />
    </svg>
);
