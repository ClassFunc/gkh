import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string(),
    topK: z.number().max(1000).default(10).optional()
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
    }
}

export function get_code(data: ICommandInput) {
    // work with input

    return `
import {ai} from "@/ai/ai";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${data.name}Reranker = ai.defineReranker(
  {
    name: 'custom/'+ $name + 'Reranker',
    configSchema: z.object({
      k: z.number().default($topK).optional(),
    }),
  },
  // @ts-ignore
  async (query, documents, options) => {
    // Your custom reranking logic here
    
  }
);

`;
}

