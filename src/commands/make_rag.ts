import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";
import {omit} from "lodash";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['fs', 'firestore', 'simple', 'local', 'custom']).default("simple").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";
let RAGConsoleInputDeclarationCode = ''

export default function make_rag() {

    let pdata = getParsedData(arguments, CommandInputSchema)
    if (pdata.type === 'simple') {
        pdata = omit(pdata, ['collection', 'vectorField'])
    } else if (
        pdata.type === 'custom' ||
        pdata.type === 'local'
    ) {
        pdata = omit(pdata, ['collection', 'vectorField', 'contentField'])
    }
    RAGConsoleInputDeclarationCode = getRAGConsoleInputDeclarationCode(pdata);

    let code: string
    switch (pdata.type) {
        case 'local':
            code = LocalCode(pdata)
            break;
        case 'fs':
        case 'firestore':
            code = FSCode(pdata)
            break;
        // case 'fsquery':
        //     code = FSQueryCode(pdata)
        //     break;
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
    const done2 = makeFile(helpersCommonPath, helpersCommonTsCode(), pdata.force, true)
    if (done2) logDone(helpersCommonPath)

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

    const retrieverName = name + "Retriever";

    return String.raw`
import {
    commonRetrieverRetrieve,
    GKHRetrieverActionParams,
    GKHRetrieverParams,
    mergeConfig
} from "@/rags/helpers/common";
import {Document, z} from "genkit";
import {ai} from "@/ai/ai";

${RAGConsoleInputDeclarationCode};

const configSchema = z.object({
    limit: z.number().optional(),
}).optional();

export const ${retrieverName} = ai.defineSimpleRetriever(
    {
        name: '${retrieverName}',
        configSchema: configSchema,
        content: $contentField,
        // and several keys to use as metadataFields
        metadata: [],
    },
    async (query, config): Promise<any[]> => {
        const options = {
            k: $limit,
            ...config,
        };
        //implementation
        
        return [];
    }
);

export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: GKHRetrieverParams & GKHRetrieverActionParams
): Promise<Document[]> => {
    return await commonRetrieverRetrieve({
        retriever: ${retrieverName},
        query,
        options,
        withReranker,
        config: mergeConfig({k: options.k || $limit}, withConfig),
    });
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
    const retrieverName = fsName + `Retriever`
    const indexerName = fsName + `Indexer`

    return String.raw`
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {DocumentReference, getFirestore, Query, WriteResult} from "firebase-admin/firestore";
import {Document, RetrieverParams} from "genkit";
import {ai} from "@/ai/ai";
import {
    defaultEmbedder,
    fsCommonIndexerAdd,
    fsCommonIndexerUpdate,
    fsCommonRetrieverRetrieve,
    fsCommonRetrieverRetrieveWithPreFilter,
    FSQueryRetrieverRetrieveParams,
    GKHIndexConfigSchema,
    GKHIndexerActionParams,
    GKHRetrieverActionParams,
    vectorFieldName,
} from "@/rags/helpers/common";

${RAGConsoleInputDeclarationCode};

${firestore_indexConfig_code()};

export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: '${retrieverName}',
    firestore: getFirestore(),
    ...indexConfig,
});

export const ${retrieverName}RetrieveWithPreFilter = async (
    preFilterQuery: Query,
    {
        query,
        withReranker,
        embedTaskType = $retrieverEmbedTaskType,
        withConfig = {},
    }: FSQueryRetrieverRetrieveParams): Promise<Document[]> => {
    return await fsCommonRetrieverRetrieveWithPreFilter(
        preFilterQuery,
        {
            query,
            withReranker,
            embedTaskType,
            withConfig,
            config: indexConfig,
        }
    );
};

export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: Omit<RetrieverParams, 'retriever'>
        & Pick<GKHRetrieverActionParams, 'withReranker' | 'withConfig'>
)
    : Promise<Document[]> => {
    return fsCommonRetrieverRetrieve({
        retriever:${retrieverName},
        query,
        options,
        withReranker,
        withConfig,
        config: indexConfig,
    });
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
import {
    commonRetrieverRetrieve,
    GKHRetrieverActionParams,
    GKHRetrieverParams,
    mergeConfig
} from "@/rags/helpers/common";

${RAGConsoleInputDeclarationCode}

const subRetriever = devLocalRetrieverRef("subRetriever"); // TODO: your sub-retriever

const configSchema = CommonRetrieverOptionsSchema.extend({
    preRerankK: z.number().max(1000).optional(), // for sub-retriever
});

export const chunksCustomRetriever = ai.defineRetriever(
    {
        name: "chunksCustomRetriever",
        configSchema: configSchema,
        // info
    },
    async (input, config) => {
        const documents = await ai.retrieve({
            retriever: subRetriever,
            query: input,
            options: {...config, k: config.preRerankK},
        });

        return {
            documents,
        };
    },
);

export const chunksCustomRetrieverRetrieve = async (
    {
        query,
        options,
        withReranker,
    }: GKHRetrieverParams
        & Pick<GKHRetrieverActionParams, "withReranker"> 
        & { options: z.infer<typeof configSchema> }
): Promise<Document[]> => {
    return await commonRetrieverRetrieve({
        retriever: chunksCustomRetriever,
        query,
        options,
        withReranker,
        config: mergeConfig({k: $limit}, options)
    })
};

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

    const indexerName = name + "Indexer";
    const retrieverName = name + "Retriever";

    return String.raw`
import {devLocalIndexerRef, devLocalRetrieverRef, devLocalVectorstore} from "@genkit-ai/dev-local-vectorstore";
import {Document, IndexerParams} from "genkit";
import {
    commonIndexerIndex,
    commonRetrieverRetrieve,
    defaultEmbedder,
    GKHRetrieverActionParams,
    GKHRetrieverParams,
    mergeConfig
} from "@/rags/helpers/common";

${RAGConsoleInputDeclarationCode}

/*
${name}LocalVectorstorePlugin
add this plugin to your ai instance's plugins: e.g: genkit({ plugins: [${name}LocalVectorstorePlugin] })
* */
export const ${name}LocalVectorstorePlugin = devLocalVectorstore([
    {
        indexName: $name,
        embedder: defaultEmbedder,
    },
]);

export const ${indexerName} = devLocalIndexerRef($name);
export const ${retrieverName} = devLocalRetrieverRef($name);

export const ${indexerName}Index = async (
    {
        documents,
        options,
    }: {
        documents: Array<Document | string>;
        options: IndexerParams["options"];
    }) => {
    return commonIndexerIndex({
        indexer: ${indexerName},
        documents,
        options,
    })
}

export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker,
        withConfig = {},
    }: GKHRetrieverParams
        & Pick<GKHRetrieverActionParams, 'withConfig' | 'withReranker'>): Promise<Array<Document>> => {
    return commonRetrieverRetrieve({
        retriever: ${retrieverName},
        query,
        options,
        withReranker,
        config: mergeConfig({k: $limit}, options, withConfig),
    })
};

`
}

const embedTaskTypesCode = () => {
    return String.raw`
const $indexerEmbedTaskType = "RETRIEVAL_DOCUMENT";
const $retrieverEmbedTaskType = "RETRIEVAL_QUERY";

`
}

/*
firestore rag codes
* */
const firestore_indexConfig_code = () => {
    return `
const embedder = defaultEmbedder;
${embedTaskTypesCode()};
export const indexConfig: GKHIndexConfigSchema = {
    collection: $collection,
    contentField: $contentField,
    vectorField: $vectorField || vectorFieldName($contentField, embedder.name),
    embedder: embedder, //
    metadataFields: [], // fields from collection record
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

export async function chunksIndexerAdd({
                                           content,
                                           additionData = {},
                                           embedTaskType = $indexerEmbedTaskType,
                                           withConfig = {},
                                       }: GKHIndexerActionParams): Promise<DocumentReference> {

    return await fsCommonIndexerAdd(
        {
            content,
            additionData,
            embedTaskType,
            withConfig,
            config:indexConfig
        }
    )
}

export async function chunksIndexerUpdate(
    docRef: DocumentReference,
    {content, additionData = {}, embedTaskType = $indexerEmbedTaskType, withConfig = {}}: GKHIndexerActionParams,
): Promise<WriteResult> {
    return await fsCommonIndexerUpdate(
        docRef,
        {
            content,
            additionData,
            embedTaskType,
            withConfig,
            config:indexConfig
        }
    )
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

const helpersCommonTsCode = () => {
    return `
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
    const embedderFieldName = embedderName.replace(/[~\\/\\[\\]]/g, "_");
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
    }: GKHIndexerActionParams & { config: Partial<GKHIndexConfigSchema> },
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
};`
}