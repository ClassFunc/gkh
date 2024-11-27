import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";
import {existsSync} from "node:fs";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['fs', 'fsquery', 'simple', 'local', 'custom']).default("simple").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";
let RAGConsoleInputDeclarationCode = ''

export default function make_rag() {

    const pdata = getParsedData(arguments, CommandInputSchema)
    RAGConsoleInputDeclarationCode = getRAGConsoleInputDeclarationCode(pdata);

    let code: string
    switch (pdata.type) {
        case 'local':
            code = LocalCode(pdata)
            break;
        case 'fs':
            code = FSCode(pdata)
            break;
        case 'fsquery':
            code = FSQueryCode(pdata)
            break;
        case 'custom':
            code = CustomCode(pdata)
            break;
        case 'simple':
        default:
            code = SimpleCode(pdata)
            break;
    }
    const writePath = srcPath(RAGS_DIR, `${pdata.name}RAG.ts`)
    const done = makeFile(writePath, code, pdata.force, true)
    if (done) {
        logDone(writePath)
    }
    const helpersCommonPath = srcPath(RAGS_DIR, 'helpers/common.ts')
    if (!existsSync(helpersCommonPath)) {
        const done = makeFile(helpersCommonPath, helpersCommonC_code(), pdata.force, true)
        if (done) logDone(helpersCommonPath)
    }
}

const getRAGConsoleInputDeclarationCode = (pdata: ICommandInputSchema) => {
    let entries: string[] = []
    for (const [k, val] of Object.entries(pdata)) {
        if (k === 'force') {
            continue;
        }
        entries.push(`const $${k} = ${JSON.stringify(val)};`)
    }
    return `\n` + entries.join(`\n`);
}

const SimpleCode = (
    {
        name,
        limit = 5,
        contentField
    }: ICommandInputSchema) => {
    return String.raw`
import {GKHRetrieverActionParams, GKHRetrieverParams, mergeConfig} from "@/rags/helpers/common";
import {Document, z} from "genkit";
import {ai} from '@/ai/ai';

${RAGConsoleInputDeclarationCode};

export const ${name}Retriever = ai.defineSimpleRetriever(
    {
        name: '${name}Retriever',
        configSchema: z.object({
                limit: z.number().optional(),
            })
            .optional(),
        content: $contentField,
        // and several keys to use as metadata
        metadata: [],
    },
    async (query, config): Promise<any[]> => {
        let limit = config?.limit || $limit;
        //implementation

        return [];
    }
);

export const ${name}RetrieverRetrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: GKHRetrieverParams & GKHRetrieverActionParams
): Promise<Document[]> => {
    const _config = mergeConfig({limit: $limit}, withConfig);
    const docs = await ai.retrieve(
        {
            retriever: ${name}Retriever,
            query,
            options,
        }
    );
${withReranker_code()};
}
`
}

/*
firestore type
* */
const FSCode = (
    {
        name,
        collection,
        contentField,
        vectorField,
    }: ICommandInputSchema) => {
    const fsName = name
    const retrieverName = fsName + `_retriever`
    const indexerName = fsName + `_indexer`

    return String.raw`
import {defineFirestoreRetriever} from '@genkit-ai/firebase';
import {DocumentReference, FieldValue, getFirestore, WriteResult} from 'firebase-admin/firestore';
import {Document, RetrieverParams} from 'genkit';
import {ai} from '@/ai/ai';
import {
    defaultEmbedder,
    doEmbed,
    GKHIndexerActionParams,
    GKHRetrieverActionParams,
    GKHIndexConfigSchema,
    mergeConfig,
    vectorFieldName,
} from '@/rags/helpers/common';

${RAGConsoleInputDeclarationCode};

${firestore_indexConfig_code()};

export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: $name + 'Retriever',
    firestore: getFirestore(),
    ...indexConfig,
});


export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: Omit<RetrieverParams, 'retriever'> & Pick<GKHRetrieverActionParams, 'withReranker' | 'withConfig'>
): Promise<Document[]> => {
    const _config = mergeConfig(indexConfig, withConfig);
    const docs = await ai.retrieve({
        query,
        options,
        retriever: ${retrieverName},
    });
${withReranker_code()};
}

${firestoreIndexerActions_code(indexerName)};
`
}

/*
FSQueryCode
* */
const FSQueryCode = (
    {
        name,
        limit = 5,
        collection,
        contentField,
        vectorField,
    }: ICommandInputSchema) => {
    const fsName = name
    const retrieverName = fsName + `_retriever`
    const indexerName = fsName + `_indexer`

    return `
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {DocumentReference, FieldValue, getFirestore, WriteResult} from "firebase-admin/firestore";
import {Document, EmbedderReference, RerankerParams} from "genkit";
import {ai} from "@/ai/ai";
import {
    defaultEmbedder,
    doEmbed,
    GKHIndexerActionParams,
    GKHIndexConfigSchema,
    mergeConfig,
    vectorFieldName
} from "@/rags/helpers/common";
import {Query} from "firebase-admin/firestore";

${RAGConsoleInputDeclarationCode};

${firestore_indexConfig_code()}

export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: '${retrieverName}',
    firestore: getFirestore(),
    ...indexConfig,
});

export const ${retrieverName}Retrieve = async (
    {
        query,
        preFilterQuery,
        withReranker,
        taskType = $retrieverTaskType,
        withConfig = {},
    }: {
        query: string;
        preFilterQuery: Query;
        withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
        taskType?: EmbedderReference['config']['taskType'];
        withConfig?: Partial<GKHIndexConfigSchema>;
    }): Promise<Document[]> => {
    const _config = mergeConfig(indexConfig, withConfig);
    if (preFilterQuery.firestore.collection.name !== _config.collection) {
        throw new Error("preFilterQuery collection name not match with collection: " + _config.collection);
    }
    const vectorValue = await doEmbed(_config.embedder, query, taskType);
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
${withReranker_code()}
};

${firestoreIndexerActions_code(indexerName)};
`
}

/*
CustomRetrieverCode
* */
const CustomCode = (
    {
        name,
        limit = 5
    }: ICommandInputSchema) => {
    const retrieverName = `${name}Retriever`
    return String.raw`
import {CommonRetrieverOptionsSchema} from "genkit/retriever";
import {ai} from "@/ai/ai";
import {Document, z} from "genkit";
import {devLocalRetrieverRef} from "@genkit-ai/dev-local-vectorstore";
import {GKHRetrieverActionParams, GKHRetrieverParams, mergeConfig} from "@/rags/helpers/common";

${RAGConsoleInputDeclarationCode};

const subRetriever = devLocalRetrieverRef('subRetriever'); // TODO: your sub-retriever

const configSchema = CommonRetrieverOptionsSchema.extend({
    preRerankK: z.number().max(1000).default($limit * 2).optional(), // for sub-retriever
});

export const ${retrieverName} = ai.defineRetriever(
    {
        name: 'custom/' + $name + 'Retriever',
        configSchema: configSchema,
    },
    async (input, config) => {
        const documents = await ai.retrieve({
            retriever: subRetriever,
            query: input,
            options: {k: config.preRerankK || ($limit * 2)},
        });

        return {
            documents: documents.slice(0, config.k || $limit),
        };
    }
);

export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: GKHRetrieverParams & GKHRetrieverActionParams,
): Promise<Document[]> => {
    const _config = mergeConfig({limit: $limit}, withConfig);
    const docs = await ai.retrieve({
        retriever: ${retrieverName},
        query: query,
        options,
    });
${withReranker_code()}
}

`
}

/*
LocalVectorRAGCode
* */
const LocalCode = (
    {
        name
    }: ICommandInputSchema) => {

    const commonName = `${name}LocalVectorstore`;

    return String.raw`
import {devLocalIndexerRef, devLocalRetrieverRef, devLocalVectorstore} from "@genkit-ai/dev-local-vectorstore";
import {ai} from "@/ai/ai";
import {Document, IndexerParams} from "genkit";
import {defaultEmbedder, GKHRetrieverActionParams, GKHRetrieverParams, mergeConfig} from "@/rags/helpers/common";

${RAGConsoleInputDeclarationCode}

/*
${name}LocalVectorstorePlugin
add this plugin to your ai instance's plugins: e.g: genkit({ plugins: [...] })
* */
export const ${name}LocalVectorstorePlugin = devLocalVectorstore([
    {
        indexName: $name,
        embedder: defaultEmbedder,
    },
]);

export const ${name}Indexer = devLocalIndexerRef($name);
export const ${name}Retriever = devLocalRetrieverRef($name);

export const ${name}IndexerIndex = async (
    {
        documents,
        options
    }: {
        documents: Array<Document | string>,
        options: IndexerParams['options']
    }
) => {
    // Add documents to the index.
    const toDocs = documents.map(doc => {
        if (doc instanceof Document) {
            return doc;
        }
        return Document.fromText(doc)
    })

    return await ai.index({
        indexer: ${name}Indexer,
        documents: toDocs,
        options,
    });
}

export const ${name}RetrieverRetrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: GKHRetrieverParams & GKHRetrieverActionParams): Promise<Array<Document>> => {
    const _config = mergeConfig(withConfig);
    const docs = await ai.retrieve({
        retriever: ${name}Retriever,
        query: query,
        options,
    });
${withReranker_code()}
}
`
}

const embedTaskTypesCode = () => {
    return String.raw`
const $indexerTaskType = "RETRIEVAL_DOCUMENT"
const $retrieverTaskType = "RETRIEVAL_QUERY"

`
}

/*
firestore rag codes
* */
const firestore_indexConfig_code = () => {
    return `
${embedTaskTypesCode()};
export const indexConfig: GKHIndexConfigSchema = {
    collection: $collection,
    contentField: $contentField,
    vectorField: $vectorField || vectorFieldName($contentField, defaultEmbedder.name),
    embedder: defaultEmbedder, //
    metadata: [], // fields from collection record
    distanceResultField: '_distance',
    distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
    distanceThreshold: 0.7,
    limit: $limit,
};
`
}

const firestoreIndexerActions_code = (indexerName: string) => {
    return `
/*
indexer actions
* */

export async function ${indexerName}Add(
    {
        content,
        additionData = {},
        taskType = $indexerTaskType,
        withConfig = {},
    }: GKHIndexerActionParams): Promise<DocumentReference> {
    const _config = mergeConfig(indexConfig, withConfig);
    const vectorValue = await doEmbed(_config.embedder, content, taskType);
    return getFirestore().collection(_config.collection).add({
        ...additionData,
        [_config.vectorField]: FieldValue.vector(vectorValue),
        [_config.contentField]: content,
    });
}

export async function ${indexerName}Update(
    docRef: DocumentReference,
    {content, additionData = {}, taskType = $indexerTaskType, withConfig = {}}: GKHIndexerActionParams,
): Promise<WriteResult> {
    const _config = mergeConfig(indexConfig, withConfig);
    const vectorValue = await doEmbed(_config.embedder, content, taskType);
    return docRef.set(
        {
            ...additionData,
            [_config.vectorField]: FieldValue.vector(vectorValue),
            [_config.contentField]: content,
        },
        {merge: true},
    );
}
`
}

const withReranker_code = () => {
    return `
    if (!withReranker) {
        return docs.slice(0, _config.limit);
    }
    const rerankedDocs = await ai.rerank({
        ...withReranker, //seemore: https://cloud.google.com/generative-ai-app-builder/docs/ranking#models
        documents: docs,
        query: query,
    });
    return rerankedDocs.slice(0, _config.limit);
`
}

const helpersCommonC_code = () => {
    return `
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
    const embedderFieldName = embedderName.replace(/[~\\/\\[\\]]/g, "_");
    return fieldName + "_" + embedderFieldName;
};

export type GKHRetrieverParams = Omit<RetrieverParams, 'retriever'>
export type GKHRerankerParams = Omit<RerankerParams, 'documents' | 'query'>
`
}