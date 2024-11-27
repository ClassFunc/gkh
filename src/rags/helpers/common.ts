import {EmbedderReference, RerankerParams, RetrieverParams} from "genkit";
import {Query} from "firebase-admin/firestore";
import {ai} from "@/ai/ai";
import {textEmbedding004} from "@genkit-ai/vertexai";

export const defaultEmbedder = textEmbedding004; // changes your defaultEmbedder

export interface GKHFirestoreIndexConfigSchema {
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
    conf1: GKHFirestoreIndexConfigSchema,
    withConfig?: Partial<GKHFirestoreIndexConfigSchema>
) => {
    return {
        ...conf1,
        ...withConfig,
    };
};

/*
firestore, firestore query commons
*/

// retriever actions options
export interface FSRetrieverActionParams {
    query: string;
    preFilterQuery?: Query;
    withReranker?: Omit<RerankerParams, "documents" | "query">;
    taskType?: EmbedderReference["config"]["taskType"];
    withConfig?: Partial<GKHFirestoreIndexConfigSchema>;
}

// indexer actions options
export interface FSIndexerActionParams {
    content: string;
    additionData?: Record<string, any>;
    taskType?: EmbedderReference["config"]["taskType"];
    withConfig?: Partial<GKHFirestoreIndexConfigSchema>;
}

/*
embedder common
*/
export const doEmbed = async (
    embedder: GKHFirestoreIndexConfigSchema["embedder"],
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