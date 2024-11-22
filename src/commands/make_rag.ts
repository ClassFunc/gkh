import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['firestore', 'simple', 'custom']).default("simple").optional(),
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
    const writePath = srcPath(RAGS_DIR, `${pdata.name}.ts`)
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
    async (query, config) => {
        let limit = config?.limit || ${limit}
        //implementation
        
    }
);
`

const FirestoreRAGCode = ({
                              name,
                              collection,
                              contentField,
                              vectorField,
                          }: ICommandInputSchema) => String.raw`
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {RetrieverParams} from "genkit";
import {z} from "genkit";
import {ai} from "@/ai/ai";

const db = getFirestore();

const ${name}IndexConfig = {
    collection: "${collection}",
    contentField: "${contentField}",
    vectorField: "${vectorField || (contentField + `_embedding`)}",
    embedder: textEmbedding004, //
}

export const ${name}FSRetriever = defineFirestoreRetriever(ai, {
    name: "${name}FSRetriever",
    firestore: db,
    ...${name}IndexConfig,
    distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});

export const ${name}FSRetrieverRetrieve = (params: Omit<RetrieverParams, 'retriever'>) => {
    return ai.retrieve({
        ...params,
        retriever: ${name}FSRetriever,
    })
}

async function ${name}FSIndexerAdd(chunks: string[]) {
    for (const text of chunks) {
        const vectorValue = await ai.embed({
            embedder: ${name}IndexConfig.embedder,
            content: text,
        });
        await db.collection(${name}IndexConfig.collection).add({
            [${name}IndexConfig.vectorField]: FieldValue.vector(vectorValue),
            [${name}IndexConfig.contentField]: text,
        });
    }
}

`

const customRetrieverCode = ({
                                 name,
                                 limit = 5
                             }: ICommandInputSchema) => {
    const retrieverName = `${name}Retriever`
    return String.raw`import {CommonRetrieverOptionsSchema,} from 'genkit/retriever';
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
