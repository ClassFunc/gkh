import {Document, EmbedderReference, IndexerArgument, IndexerParams, RerankerParams, RetrieverParams} from "genkit";
import {DocumentReference, FieldValue, getFirestore, Query, WriteResult} from "firebase-admin/firestore";
import {ai} from "@/ai/ai";
import {textEmbedding004} from "@genkit-ai/vertexai";

export const defaultEmbedder = textEmbedding004; // changes your defaultEmbedder

export interface GKHIndexConfigSchema {
    collection: string;
    contentField: string;
    vectorField: string;
    metadataFields: any[];
    limit: number;
    embedder: EmbedderReference | string;
    distanceMeasure: FirebaseFirestore.VectorQueryOptions["distanceMeasure"];
    distanceThreshold: FirebaseFirestore.VectorQueryOptions["distanceThreshold"];
    distanceResultField: FirebaseFirestore.VectorQueryOptions["distanceResultField"];
}

export const mergeConfig = (...configs: Partial<GKHIndexConfigSchema | Record<string, any>>[]) => {
    return configs.reduce((p, v, idx) => {
        return {...p, ...v};
    }, {}) as GKHIndexConfigSchema;
};

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
    updateMethod?: "update" | "set";
}

/*
embedder common
*/
export const doEmbed = async (
    embedder: GKHIndexConfigSchema["embedder"],
    content: string,
    embedTaskType: EmbedderReference["config"]["embedTaskType"],
): Promise<number[]> => {
    return (await ai.embed({embedder, content, options: {embedTaskType: embedTaskType}})).at(0)?.embedding || [];
};

export const vectorFieldName = (fieldName: string, embedderName: string) => {
    const embedderFieldName = embedderName.replace(/[~\/\[\]]/g, "_");
    return fieldName + "_" + embedderFieldName;
};

export type GKHRetrieverParams = Omit<RetrieverParams, "retriever">;
export type GKHRerankerParams = Omit<RerankerParams, "documents" | "query">;

export interface FSQueryRetrieverRetrieveParams {
    query: string;
    withReranker?: Omit<RerankerParams, "documents" | "query">;
    embedTaskType?: EmbedderReference["config"]["embedTaskType"];
    withConfig?: Partial<GKHIndexConfigSchema>;
}

export const fsCommonRetrieverRetrieveWithPreFilter = async (
    preFilterQuery: Query,
    {
        query,
        withReranker,
        embedTaskType,
        withConfig = {},
        config,
    }: FSQueryRetrieverRetrieveParams & { config: Partial<GKHIndexConfigSchema> },
): Promise<Document[]> => {
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
        const metadataFields: Record<string, any> = _config.metadataFields.reduce(
            (obj, key: string) => {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = d.get(key);
                }
                return obj;
            },
            {} as Record<string, any>,
        );
        return Document.fromText(d.get(_config.contentField), metadataFields);
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
};

export const fsCommonIndexerAdd = async ({
                                             content,
                                             additionData = {},
                                             embedTaskType,
                                             withConfig = {},
                                             config,
                                         }: GKHIndexerActionParams & {
    config: Partial<GKHIndexConfigSchema>;
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
};

export const fsCommonIndexerUpdate = async (
    docRef: DocumentReference,
    {
        content,
        additionData = {},
        embedTaskType,
        withConfig = {},
        config,
        updateMethod = "update"
    }: GKHIndexerActionParams & { config: Partial<GKHIndexConfigSchema> },
): Promise<WriteResult> => {
    const _config = mergeConfig(config, withConfig);
    const vectorValue = await doEmbed(_config.embedder, content, embedTaskType);
    switch (updateMethod) {
        case "update":
            return docRef.update(
                {
                    ...additionData,
                    [_config.vectorField]: FieldValue.vector(vectorValue),
                    [_config.contentField]: content,
                }
            );
        case "set":
            return docRef.set(
                {
                    ...additionData,
                    [_config.vectorField]: FieldValue.vector(vectorValue),
                    [_config.contentField]: content,
                },
                {merge: true},
            );
    }
};

export const fsCommonRetrieverRetrieve = async ({
                                                    retriever,
                                                    query,
                                                    options,
                                                    withReranker,
                                                    withConfig = {},
                                                    config,
                                                }: RetrieverParams &
    Pick<GKHRetrieverActionParams, "withReranker" | "withConfig"> & { config: GKHIndexConfigSchema }): Promise<
    Document[]
> => {
    const _config = mergeConfig(config, withConfig);
    options = {..._config, ...options}
    const docs = await ai.retrieve({
        retriever,
        query,
        options,
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
};

export const commonRetrieverRetrieve = async <C extends Record<string, any>>({
                                                                                 retriever,
                                                                                 query,
                                                                                 options,
                                                                                 withReranker,
                                                                                 config,
                                                                             }: RetrieverParams & Pick<GKHRetrieverActionParams, "withReranker"> & {
    config: C
}): Promise<Document[]> => {
    const docs = await ai.retrieve({
        retriever,
        query,
        options,
    });

    if (!withReranker) {
        return docs.slice(0, config.k);
    }
    const rerankedDocs = await ai.rerank({
        ...withReranker, //seemore: https://cloud.google.com/generative-ai-app-builder/docs/ranking#models
        query,
        documents: docs,
    });
    return rerankedDocs.slice(0, config.k);
};

export const commonIndexerIndex = async ({
                                             indexer,
                                             documents,
                                             options,
                                         }: {
    indexer: IndexerArgument,
    documents: Array<Document | string>;
    options: IndexerParams["options"];
}) => {

    const docs = documents.map((doc) => {
        if (doc instanceof Document) {
            return doc;
        }
        return Document.fromText(doc);
    });

    return await ai.index({
        indexer: indexer,
        documents: docs,
        options,
    });
};