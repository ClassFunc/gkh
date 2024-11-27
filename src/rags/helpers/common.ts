import {EmbedderReference, RerankerParams, RetrieverParams} from "genkit";
import {Query} from "firebase-admin/firestore";
import {ai} from "@/ai/ai";
import {textEmbedding004} from "@genkit-ai/vertexai";

export const defaultEmbedder = textEmbedding004; // changes your defaultEmbedder

export interface GKHIndexConfigSchema {
    collection: string;
    contentField: string;
    vectorField: string;
    metadata: any[];
    limit: number;
    embedder: EmbedderReference | string;
    distanceMeasure: FirebaseFirestore.VectorQueryOptions["distanceMeasure"];
    distanceThreshold: FirebaseFirestore.VectorQueryOptions["distanceThreshold"];
    distanceResultField: FirebaseFirestore.VectorQueryOptions["distanceResultField"];
}

export const mergeConfig = (
    ...configs: Partial<GKHIndexConfigSchema>[]
) => {
    return configs.reduce(
        (p, v, idx) => {
            return {...p, ...v}
        }, {}
    ) as GKHIndexConfigSchema;
};

/*
firestore, firestore query commons
*/

// retriever actions options
export interface GKHRetrieverActionParams {
    query: string;
    preFilterQuery?: Query;
    withReranker?: Omit<RerankerParams, "documents" | "query">;
    taskType?: EmbedderReference["config"]["taskType"];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

// indexer actions options
export interface GKHIndexerActionParams {
    content: string;
    additionData?: Record<string, any>;
    taskType?: EmbedderReference["config"]["taskType"];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

/*
embedder common
*/
export const doEmbed = async (
    embedder: GKHIndexConfigSchema["embedder"],
    content: string,
    taskType: EmbedderReference["config"]["taskType"],
): Promise<number[]> => {
    return await ai.embed({embedder, content, options: {taskType: taskType}});
};

export const vectorFieldName = (fieldName: string, embedderName: string) => {
    const embedderFieldName = embedderName.replace(/[~\/\[\]]/g, "_");
    return fieldName + "_" + embedderFieldName;
};

export type GKHRetrieverParams = Omit<RetrieverParams, 'retriever'>
export type GKHRerankerParams = Omit<RerankerParams, 'documents' | 'query'>