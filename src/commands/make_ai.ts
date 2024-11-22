import {z} from "zod";
import {GlobalCommandInputSchema} from "../types/GlobalCommandInputSchema";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string().default('ai').optional(),
})

export const make_ai = (input:z.infer<typeof CommandInputSchema>)=>{

}


const make_ai_code = (input: z.infer<typeof CommandInputSchema>) => {
    return `
    import {genkit} from "genkit";
    import {vertexAI} from "@genkit-ai/vertexai";
    import {logger} from "genkit/logging";
    // import {enableFirebaseTelemetry} from "@genkit-ai/firebase";
    // import {openAI} from "genkitx-openai";
    
    logger.setLogLevel("debug");
    
    // (async () => {
    //     await enableFirebaseTelemetry({
    //         projectId: process.env.GCLOUD_PROJECT,
    //     });
    // })();
    
    export const ai = genkit({
        promptDir: "./prompts",
        plugins: [
            vertexAI({
                projectId: process.env.GCLOUD_PROJECT!,
                location: process.env.GCLOUD_LOCATION!,
            }),
            // googleCloud(),
            // openAI(),
        ],
    });    
`
}