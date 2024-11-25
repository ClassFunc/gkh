import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";


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
            code = LocalVectorRAGCode(pdata)
            break;
        case 'fs':
            code = FirestoreRAGCode(pdata)
            break;
        case 'fsquery':
            code = FSQueryRetrieverCode(pdata)
            break;
        case 'simple':
            code = SimpleRAGCode(pdata)
            break;
        case 'custom':
            code = CustomRetrieverCode(pdata)
            break;
        default:
            code = SimpleRAGCode(pdata)
            break;
    }
    const writePath = srcPath(RAGS_DIR, `${pdata.name}RAG.ts`)
    const done = makeFile(writePath, code, pdata.force, true)
    if (done) {
        logDone(writePath)
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

const SimpleRAGCode = (
    {
        name,
        limit = 5,
        contentField
    }: ICommandInputSchema) => {
    return String.raw`
import {Document, RerankerParams, RetrieverParams, z} from "genkit";
import {ai} from "@/ai/ai";

${RAGConsoleInputDeclarationCode}

export const ${name}Retriever = ai.defineSimpleRetriever(
    {
        name: '${name}Retriever',
        configSchema: z
            .object({
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
        withReranker
    }: {
        query: RetrieverParams['query'],
        options: RetrieverParams['options'],
        withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
    }
): Promise<Document[]> => {
    const docs = await ai.retrieve(
        {
            retriever: ${name}Retriever,
            query,
            options,
        }
    )
    if (!withReranker) {
        return docs;
    }
    return ai.rerank({
        ...withReranker,
        documents: docs,
        query: query,
        options,
    })
}
`
}

/*
FirestoreRAGCode
* */
const FirestoreRAGCode = (
    {
        name,
        collection,
        contentField,
        vectorField,
    }: ICommandInputSchema) => {
    const fsName = name + `FS`
    const retrieverName = fsName + `Retriever`
    const indexerName = fsName + `Indexer`

    return String.raw`
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {Document, RetrieverParams} from "genkit";
import {z, RerankerParams} from "genkit";
import {ai} from "@/ai/ai";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import DocumentSnapshot = firestore.DocumentSnapshot;
import WriteResult = firestore.WriteResult;

${RAGConsoleInputDeclarationCode}

const db = getFirestore();
const embedder = textEmbedding004 // choose your embedder
${defaultVectorFieldNameCode()}
const indexConfig = {
    collection: $collection,
    contentField: $contentField,
    vectorField: ${`$vectorField || vectorFieldName("` + contentField + `", embedder.name)`},
    embedder: embedder, //
    metadata: [], // fields from ${collection} collection record
    distanceResultField: '_distance',
    distanceMeasure: "COSINE" as const, // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
}

export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: $name + "Retriever",
    firestore: db,
    ...indexConfig,
});

export const ${retrieverName}Retrieve = async (
    params: Omit<RetrieverParams, 'retriever'> & { withReranker?: Omit<RerankerParams, 'documents' | 'query'>; },
): Promise<Document[]> => {
    const docs = await ai.retrieve({
        ...params,
        retriever: ${retrieverName},
    })
    if (!params.withReranker) {
        return docs;
    }
    return ai.rerank({
        ...params.withReranker,
        documents: docs,
        query: params.query,
    });
}

export async function ${indexerName}Add(query: string, otherData: Record<string, any> = {}): Promise<DocumentReference> {
    const vectorValue = await doEmbed(query);
    return db.collection(indexConfig.collection).add({
        ...otherData,
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: query,
    });
}

export async function ${indexerName}Update(doc: DocumentSnapshot, query: string, otherData: Record<string, any> = {}): Promise<WriteResult> {
    const vectorValue = await doEmbed(query);
    return doc.ref.set({
        ...otherData,
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: query,
    }, {merge: true});
}

${doEmbedCode()}

`
}

/*
FSQueryRetrieverCode
* */
const FSQueryRetrieverCode = (
    {
        name,
        limit = 5,
        collection,
        contentField,
        vectorField,
    }: ICommandInputSchema) => {
    const fsName = name + `FSQuery`
    const retrieverName = fsName + `Retriever`
    const indexerName = fsName + `Indexer`

    return String.raw`
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {Document, RerankerParams} from "genkit";
import {ai} from "@/ai/ai";
import {firestore} from "firebase-admin";
import Query = firestore.Query;
import DocumentReference = firestore.DocumentReference;
import DocumentSnapshot = firestore.DocumentSnapshot;
import WriteResult = firestore.WriteResult;

${RAGConsoleInputDeclarationCode}

const db = getFirestore();
const embedder = textEmbedding004 // choose your embedder
${defaultVectorFieldNameCode()}
const indexConfig = {
    collection: $collection,
    contentField: $contentField,
    vectorField: ${`$vectorField || vectorFieldName("` + contentField + `", embedder.name)`},
    embedder: embedder, //
    metadata: [], // fields from ${collection} collection record
    distanceResultField: '_distance',
    distanceThreshold: 0.7,
    distanceMeasure: "COSINE" as const, // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
}


export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: "${retrieverName}",
    firestore: db,
    ...indexConfig,
});

export const ${retrieverName}Retrieve = async (
    {
        query,
        preFilterQuery,
        withReranker
    }: {
        query: string,
        preFilterQuery: Query,
        withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
    }
): Promise<Document[]> => {
    if (preFilterQuery.firestore.collection.name !== indexConfig.collection) {
        throw new Error(${"`"}preFilterQuery's collection name not match with collection '${`$`}{indexConfig.collection}'${"`"})
    }
    const vectorValue = await doEmbed(query)
    const snap = await preFilterQuery
        .findNearest({
            vectorField: indexConfig.vectorField,
            queryVector: vectorValue,
            limit: ${limit},
            distanceMeasure: indexConfig.distanceMeasure,
            distanceResultField: indexConfig.distanceResultField,
            distanceThreshold: indexConfig.distanceThreshold
        })
        .get();

    if (snap.empty)
        return [];

    const docs = snap.docs.map((d) => {
        const metadata: Record<string, any> = indexConfig.metadata.reduce(
            (obj, key: string) => {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = d.get(key)
                }
                return obj;
            }
            , {} as Record<string, any>
        );
        return Document.fromText(
            d.get(indexConfig.contentField),
            metadata
        );
    });
    if (!withReranker) {
        return docs;
    }
    return await ai.rerank({
        ...withReranker, //seemore: https://cloud.google.com/generative-ai-app-builder/docs/ranking#models
        documents: docs,
        query: query,
    });
}


export async function ${indexerName}Add(query: string, otherData: Record<string, any> = {}): Promise<DocumentReference> {
    const vectorValue = await doEmbed(query);
    return db.collection(indexConfig.collection).add({
        ...otherData,
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: query,
    });
}

export async function ${indexerName}Update(doc: DocumentSnapshot, query: string, otherData: Record<string, any> = {}): Promise<WriteResult> {
    const vectorValue = await doEmbed(query);
    return doc.ref.set({
        ...otherData,
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: query,
    }, {merge: true});
}

${doEmbedCode()}
`
}

/*
CustomRetrieverCode
* */
const CustomRetrieverCode = (
    {
        name,
        limit = 5
    }: ICommandInputSchema) => {
    const retrieverName = `${name}Retriever`
    return String.raw`
import {CommonRetrieverOptionsSchema} from 'genkit/retriever';
import {ai} from "@/ai/ai";
import {Document, RerankerParams, RetrieverParams, z} from 'genkit';
import {devLocalRetrieverRef} from "@genkit-ai/dev-local-vectorstore";

${RAGConsoleInputDeclarationCode}

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
            documents: documents.slice(0, config.k || $limit)
        }
    }
);

export const ${retrieverName}Retrieve = async (
    {
        query,
        options,
        withReranker
    }: {
        query: RetrieverParams['query'];
        options?: RetrieverParams['options']
        withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
    }
): Promise<Document[]> => {
    const docs = await ai.retrieve({
        retriever: ${retrieverName},
        query: query,
        options,
    });
    if (!withReranker) {
        return docs;
    }
    return ai.rerank({
        ...withReranker,
        documents: docs,
        query,
    });
}

`
}

/*
LocalVectorRAGCode
* */
const LocalVectorRAGCode = (
    {
        name
    }: ICommandInputSchema) => {

    const commonName = `${name}LocalVectorstore`;

    return String.raw`
import {textEmbedding004} from '@genkit-ai/vertexai';
import {devLocalIndexerRef, devLocalRetrieverRef, devLocalVectorstore,} from '@genkit-ai/dev-local-vectorstore';
import {ai} from "@/ai/ai";
import {Document, IndexerParams, RerankerParams, RetrieverParams} from "genkit";

${RAGConsoleInputDeclarationCode}

const embedder = textEmbedding004 // changes to your embedder

/*
${name}LocalVectorstorePlugin
add this plugin to your ai instance's plugins: e.g: genkit({ plugins: [...] })
* */
export const ${name}LocalVectorstorePlugin = devLocalVectorstore([
    {
        indexName: $name,
        embedder: embedder,
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
    }: {
        query: RetrieverParams['query'];
        options?: RetrieverParams['options']
        withReranker?: Omit<RerankerParams, 'documents' | 'query'>;
    }): Promise<Array<Document>> => {
    const docs = await ai.retrieve({
        retriever: ${name}Retriever,
        query: query,
        options,
    });
    if (!withReranker) {
        return docs;
    }
    return ai.rerank({
        ...withReranker,
        documents: docs,
        query,
    });
}
`
}

const doEmbedCode = () => {
    return `
const doEmbed = async (value: string): Promise<number[]> => {
    return await ai.embed({embedder: indexConfig.embedder, content: value});
}
`
}

const defaultVectorFieldNameCode = () => {
    return String.raw`
const vectorFieldName = (fieldName: string, embedderName: string) => {
    const embedderFieldName = embedderName.replace(/[~\/\[\]]/g, "_");
    return fieldName + "_" + embedderFieldName;
};
`
}