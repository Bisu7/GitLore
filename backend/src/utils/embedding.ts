import { pipeline } from "@xenova/transformers";

let extractor: any = null;

/**
 * Returns a singleton instance of the Xenova embedding model pipeline.
 * Downloads the model locally on the first run.
 */
export const getExtractor = async () => {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
};

/**
 * Convenience function to embed a query string into a 384d vector
 */
export const embedText = async (text: string): Promise<number[]> => {
    const extract = await getExtractor();
    const output = await extract(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
};
