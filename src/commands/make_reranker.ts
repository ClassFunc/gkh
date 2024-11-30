import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string(),
    topK: z.number().max(1000).default(10).optional(),
    ref: z.string().default("vertexai/semantic-ranker-512")
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const RERANKERS_DIR = 'rerankers';

export function make_reranker() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data)
    // implementations
    const writeTo = srcPath(RERANKERS_DIR, data.name + "Reranker.ts")
    const done = makeFile(writeTo, code, data.force, true)
    if (done) {
        logDone(writeTo)
        //     write src/rarankers/helpers/common.ts file
        const p = srcPath('rerankers/helpers/common.ts')
        const done = makeFile(p, helpersCommonTs_code(), data.force)
        if (done) {
            logDone(p)
        }
    }
}

export function get_code(data: ICommandInput) {
    // work with input

    const name = data.name + "Reranker";
    return `
import {ai} from "@/ai/ai";
import {doRerankFn, GKHRerankerConfigSchema, rerankerFnByRef} from "@/rerankers/helpers/common";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${name} = ai.defineReranker(
    {
        name: "${name}",
        configSchema: GKHRerankerConfigSchema.extend({
            k: z.number().default($topK)
        }),
        // info
    },
    async (query, documents, options) => {
        options = {
            ...{k: $topK},
            ...options
        }
        
        return rerankerFnByRef($ref)(query, documents, options)
    },
);

export const ${name}Rerank = doRerankFn({reranker: ${name}})
`;
}

const helpersCommonTs_code = () => {
    return `
import {RerankerArgument, RerankerParams, z} from "genkit";
import {ai} from "@/ai/ai";
import {RerankerFn} from "@genkit-ai/ai/reranker";

export const GKHRerankerConfigSchema = z.object({
    k: z.number().optional(),
    filter: z
        .function()
        .returns(z.boolean())
        .args(z.object({score: z.number(), metadata: z.record(z.string(), z.any())}))
        .optional(),
});

export type IGKHRerankerConfigSchema = z.infer<typeof GKHRerankerConfigSchema>;

export const rerankerFnByRef = (ref: RerankerArgument): RerankerFn<z.ZodTypeAny> => {
    return async (query, documents, options) => {
        let rerankedDocs = await ai.rerank({
            reranker: ref,
            query,
            documents,
        });
        rerankedDocs.sort((a, b) => b.metadata.score - a.metadata.score);
        if (options) {
            if (options.filter) {
                rerankedDocs = rerankedDocs.filter((d) => options.filter!({score: d.score(), metadata: d.metadata}));
            }
            if (options.k) {
                rerankedDocs = rerankedDocs.slice(0, options.k);
            }
        }
        return {
            documents: rerankedDocs,
        };
    };
}

export const GKHDefaultRerankerFn = rerankerFnByRef("vertexai/semantic-ranker-512")

export const doRerankFn = ({reranker}: { reranker: RerankerParams["reranker"] }) =>
    async <Options extends IGKHRerankerConfigSchema>(
        {
            query,
            documents,
            options,
        }: Omit<RerankerParams, "reranker"> & {
            options?: Options
        }) => {
        return await ai.rerank({
            reranker,
            query,
            documents,
            options,
        });
    };

`
}

