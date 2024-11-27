import {genkit} from "genkit";
import {vertexAI} from "@genkit-ai/vertexai";

export const ai = genkit({
    plugins: [
        vertexAI(),
    ],
});
