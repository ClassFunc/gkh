import {genkit, isDevEnv} from "genkit";
import vertexAI from '@genkit-ai/vertexai';
import {enableFirebaseTelemetry} from "@genkit-ai/firebase";
import {logger} from "genkit/logging";
import {vertexAIRerankers} from "@genkit-ai/vertexai/rerankers";
import * as process from "node:process";

const logLever = isDevEnv() ? "error" : "error"
logger.setLogLevel(logLever);
enableFirebaseTelemetry()

const gcloudProject = process.env.GCLOUD_PROJECT!
const gcloudLocation = process.env.GCLOUD_LOCATION!

export const ai = genkit({
    plugins: [
        vertexAI(),
        vertexAIRerankers({
            rerankers: ['semantic-ranker-512'],
            projectId: gcloudProject,
            location: gcloudLocation
        }),
    ],
});