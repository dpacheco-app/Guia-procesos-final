export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    }
}

export interface SearchResult {
    text: string;
    sources: GroundingChunk[];
}
