import {Document, EmbedderReference, RerankerParams, RetrieverParams} from "genkit";
import {Query} from "firebase-admin/firestore";
import {ai} from "@/ai/ai";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {DocumentReference, FieldValue, getFirestore, WriteResult} from "firebase-admin/lib/firestore";

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

export const mergeConfig = (...configs: Partial<GKHIndexConfigSchema>[]) => {
    return configs.reduce((p, v, idx) => {
        return {...p, ...v};
    }, {}) as GKHIndexConfigSchema;
};

/*
firestore, firestore query commons
*/

// retriever actions options
export interface GKHRetrieverActionParams {
    query: string;
    preFilterQuery?: Query;
    withReranker?: Omit<RerankerParams, "documents" | "query">;
    embedTaskType?: EmbedderReference["config"]["embedTaskType"];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

// indexer actions options
export interface GKHIndexerActionParams {
    content: string;
    additionData?: Record<string, any>;
    embedTaskType?: EmbedderReference["config"]["embedTaskType"];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

/*
embedder common
*/
export const doEmbed = async (
    embedder: GKHIndexConfigSchema["embedder"],
    content: string,
    embedTaskType: EmbedderReference["config"]["embedTaskType"],
): Promise<number[]> => {
    return await ai.embed({embedder, content, options: {embedTaskType: embedTaskType}});
};

export const vectorFieldName = (fieldName: string, embedderName: string) => {
    const embedderFieldName = embedderName.replace(/[~\/\[\]]/g, "_");
    return fieldName + "_" + embedderFieldName;
};

export type GKHRetrieverParams = Omit<RetrieverParams, "retriever">;
export type GKHRerankerParams = Omit<RerankerParams, "documents" | "query">;

export interface FSQueryRetrieverRetrieveParams {
    query: string;
    preFilterQuery: Query;
    withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
    embedTaskType?: EmbedderReference['config']['embedTaskType'];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

export const fsqueryCommonRetrieve = async (
    {
        query,
        preFilterQuery,
        withReranker,
        embedTaskType,
        withConfig = {},
        config
    }: FSQueryRetrieverRetrieveParams & { config: Partial<GKHIndexConfigSchema> }): Promise<Document[]> => {
    const _config = mergeConfig(config, withConfig);
    if (preFilterQuery.firestore.collection.name !== _config.collection) {
        throw new Error("preFilterQuery collection name not match with collection: " + _config.collection);
    }
    const vectorValue = await doEmbed(_config.embedder, query, embedTaskType);
    const snap = await preFilterQuery
        .findNearest({
            vectorField: _config.vectorField,
            queryVector: vectorValue,
            limit: _config.limit,
            distanceMeasure: _config.distanceMeasure,
            distanceResultField: _config.distanceResultField,
            distanceThreshold: _config.distanceThreshold,
        })
        .get();

    if (snap.empty) return [];

    const docs = snap.docs.map((d) => {
        const metadata: Record<string, any> = _config.metadata.reduce(
            (obj, key: string) => {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = d.get(key);
                }
                return obj;
            },
            {} as Record<string, any>,
        );
        return Document.fromText(d.get(_config.contentField), metadata);
    });

    if (!withReranker) {
        return docs.slice(0, _config.limit);
    }
    const rerankedDocs = await ai.rerank({
        ...withReranker, //seemore: https://cloud.google.com/generative-ai-app-builder/docs/ranking#models
        documents: docs,
        query: query,
    });
    return rerankedDocs.slice(0, _config.limit);
}

export const fsqueryCommonIndexerAdd = async (
    {
        content,
        additionData = {},
        embedTaskType,
        withConfig = {},
        config
    }: GKHIndexerActionParams & {
        config: Partial<GKHIndexConfigSchema>
    }): Promise<DocumentReference> => {
    const _config = mergeConfig(config, withConfig);
    const vectorValue = await doEmbed(_config.embedder, content, embedTaskType);
    return getFirestore()
        .collection(_config.collection)
        .add({
            ...additionData,
            [_config.vectorField]: FieldValue.vector(vectorValue),
            [_config.contentField]: content,
        });
}

export const fsqueryCommonIndexerUpdate = async (
    docRef: DocumentReference,
    {content, additionData = {}, embedTaskType, withConfig = {}, config}:
        GKHIndexerActionParams & {
        config: Partial<GKHIndexConfigSchema>
    },
): Promise<WriteResult> => {
    const _config = mergeConfig(config, withConfig);
    const vectorValue = await doEmbed(_config.embedder, content, embedTaskType);
    return docRef.set(
        {
            ...additionData,
            [_config.vectorField]: FieldValue.vector(vectorValue),
            [_config.contentField]: content,
        },
        {merge: true},
    );
}