import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['firestore', 'fsquery', 'simple', 'custom']).default("simple").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";

export default function make_rag() {

    const pdata = getParsedData(arguments, CommandInputSchema)
    let code: string
    switch (pdata.type) {
        // case 'local':
        //     code = LocalVectorRAGCode(pdata)
        //     break;
        case 'firestore':
            code = FirestoreRAGCode(pdata)
            break;
        case 'fsquery':
            code = FSQueryRetrieverCode(pdata)
            break;
        case 'simple':
            code = SimpleRAGCode(pdata)
            break;
        case 'custom':
            code = customRetrieverCode(pdata)
            break;
        default:
            code = SimpleRAGCode(pdata)
            break;
    }
    const writePath = srcPath(RAGS_DIR, `${pdata.name}RAG.ts`)
    const done = makeFile(writePath, code, pdata.force)
    if (done) {
        logDone(writePath)
    }
}

const SimpleRAGCode = ({
                           name,
                           limit = 5,
                           contentField
                       }: ICommandInputSchema) => `
import {z} from "genkit";
import {ai} from "@/ai/ai";

export const ${name}SimpleRetriever = ai.defineSimpleRetriever(
    {
        name: '${name}SimpleRetriever',
        configSchema: z
          .object({
            limit: z.number().optional(),
          })
          .optional(),
        content: "${contentField}",
        // and several keys to use as metadata
        metadata: [],
    },
    async (query, config): Promise<any[]> => {
        let limit = config?.limit || ${limit}
        //implementation
        
        return [];
    }
);
`

const FirestoreRAGCode = ({
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
import {z} from "genkit";
import {ai} from "@/ai/ai";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import DocumentSnapshot = firestore.DocumentSnapshot;
import WriteResult = firestore.WriteResult;

const db = getFirestore();

const indexConfig = {
    collection: "${collection}",
    contentField: "${contentField}",
    vectorField: "${vectorField || (contentField + `_embedding`)}",
    embedder: textEmbedding004, //
    distanceResultField: '_distance'
}

export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: "${retrieverName}",
    firestore: db,
    ...indexConfig,
    distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});

export const ${retrieverName}Retrieve = async (params: Omit<RetrieverParams, 'retriever'>):Promise<Document[]> => {
    return ai.retrieve({
        ...params,
        retriever: ${retrieverName},
    })
}

export async function ${indexerName}Add(text: string, otherData: Record<string, any> = {}): Promise<DocumentReference> {
    const vectorValue = await doEmbed(text);
    return db.collection(indexConfig.collection).add({
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: text,
        ...otherData
    });
}

export async function ${indexerName}Update(doc: DocumentSnapshot, text: string, otherData: Record<string, any> = {}): Promise<WriteResult> {
    const vectorValue = await doEmbed(text);
    return doc.ref.set({
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: text,
        ...otherData
    }, {merge: true});
}

export async function ${indexerName}Batch(chunks: string[]): Promise<DocumentReference[]> {
    return Promise.all(
        chunks.map(async c => {
            const vv = await doEmbed(c);
            return db.collection(indexConfig.collection).add({
                [indexConfig.vectorField]: FieldValue.vector(vv),
                [indexConfig.contentField]: c,
            });
        })
    )
}

${doEmbedCode()}

`
}

const FSQueryRetrieverCode = ({
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
import {Document} from "genkit";
import {ai} from "@/ai/ai";
import {firestore} from "firebase-admin";
import Query = firestore.Query;
import DocumentReference = firestore.DocumentReference;
import DocumentSnapshot = firestore.DocumentSnapshot;
import WriteResult = firestore.WriteResult;

const db = getFirestore();

const indexConfig = {
    collection: "${collection}",
    contentField: "${contentField}",
    vectorField: "${vectorField || (contentField + `_embedding`)}",
    embedder: textEmbedding004, //
    metadata:[],
    distanceResultField: '_distance',
    distanceThreshold: 0.7
}


export const ${retrieverName} = defineFirestoreRetriever(ai, {
    name: "${retrieverName}",
    firestore: db,
    ...indexConfig,
    distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});

export const ${retrieverName}Retrieve = async ({text, preFilterQuery}: { text: string, preFilterQuery: Query }) => {
    const vectorValue = await doEmbed(text)
    const snap = await preFilterQuery
        .findNearest({
            vectorField: indexConfig.vectorField,
            queryVector: vectorValue,
            limit: ${limit},
            distanceMeasure: "COSINE",
            distanceResultField: indexConfig.distanceResultField,
            distanceThreshold: indexConfig.distanceThreshold
        })
        .get();

    if (snap.empty)
        return [];

    return snap.docs.map((d) => {
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
}


export async function ${indexerName}Add(text: string, otherData: Record<string, any> = {}): Promise<DocumentReference> {
    const vectorValue = await doEmbed(text);
    return db.collection(indexConfig.collection).add({
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: text,
        ...otherData
    });
}

export async function ${indexerName}Update(doc: DocumentSnapshot, text: string, otherData: Record<string, any> = {}): Promise<WriteResult> {
    const vectorValue = await doEmbed(text);
    return doc.ref.set({
        [indexConfig.vectorField]: FieldValue.vector(vectorValue),
        [indexConfig.contentField]: text,
        ...otherData
    }, {merge: true});
}

export async function ${indexerName}Batch(chunks: string[]): Promise<DocumentReference[]> {
    return Promise.all(
        chunks.map(async c => {
            const vv = await doEmbed(c);
            return db.collection(indexConfig.collection).add({
                [indexConfig.vectorField]: FieldValue.vector(vv),
                [indexConfig.contentField]: c,
            });
        })
    )
}
${doEmbedCode()}
`
}

const customRetrieverCode = ({
                                 name,
                                 limit = 5
                             }: ICommandInputSchema) => {
    const retrieverName = `${name}Retriever`
    return String.raw`
import {CommonRetrieverOptionsSchema} from 'genkit/retriever';
import {z} from 'genkit';
import {ai} from "@/ai/ai";

const ${retrieverName}OptionsSchema = CommonRetrieverOptionsSchema.extend({
    preRerankK: z.number().max(1000),
});

const subRetriever = devLocalRetrieverRef('subRetriever'); // TODO: your retriever

export const ${retrieverName} = ai.defineRetriever(
    {
        name: 'custom/${retrieverName}',
        configSchema: ${retrieverName}OptionsSchema,
    },
    async (input, options) => {
        const documents = await ai.retrieve({
            retriever: subRetriever,
            query: input,
            options: {k: options.preRerankK || ${limit * 2}},
        });

        const rerankedDocuments = await ai.rerank({
            reranker: 'vertexai/semantic-ranker-512',
            query: input,
            documents,
        });

        return {
            documents: rerankedDocuments.slice(0, options.k || ${limit})
        }
    }
);

`
}
const LocalVectorRAGCode = ({
                                name
                            }: ICommandInputSchema) => String.raw`
import { textEmbedding004 } from '@genkit-ai/vertexai';
import {
    devLocalVectorstore,
    devLocalIndexerRef,
    devLocalRetrieverRef,
} from '@genkit-ai/dev-local-vectorstore';
import {z} from "genkit";
import {ai} from "@/ai/ai";

const refName = '${name}';

export const ${name}LocalVectorstore = devLocalVectorstore(ai, [
    {
        indexName: refName,
        embedder: textEmbedding004,
    },
]);
export const ${name}Indexer = devLocalIndexerRef(refName);
export const ${name}Retriever = devLocalRetrieverRef(refName);

`

const doEmbedCode = () => {
    return `
const doEmbed = async (value: string): Promise<number[]> => {
    return await ai.embed({embedder: indexConfig.embedder, content: value});
}
`
}