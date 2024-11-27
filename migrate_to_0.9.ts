import * as fs from "node:fs";
import {readFileSync} from "node:fs";
import * as path from "node:path";
import {execSync} from 'node:child_process'

/* STEP 1:
Install & remove dependencies
* */
const doInstallAndRemoveDependencies = () => {
    execSync(`rm -fr lib/ node_modules/ package-lock.json`)
    execSync(`npm cache clean --force`)

    execSync(`npm uninstall -g genkit && npm uninstall genkit --force`)
    execSync(`npm i -D genkit-cli --force`)
    execSync(`npm uninstall @genkit-ai/ai @genkit-ai/core @genkit-ai/dotprompt @genkit-ai/flow @genkit-ai/firebase @genkit-ai/vertexai --force`)
    execSync(`npm i --save genkit @genkit-ai/firebase @genkit-ai/vertexai --force`)
}

/*
STEP 2:
Replace with new codes
* */
const doCodeMod = (dirs: string[], prettier = false) => {

    const replaceAtPath = (fpath: string) => {

        const code = readFileSync(fpath).toString()
        let newCode = code;

        const toAiDots = [
            "defineFlow",
            "defineStreamingFlow",
            "defineTool",
            "defineSchema",
            "defineJsonSchema",
            "defineModel",
            "prompt",
            "definePrompt",
            "defineRetriever",
            "defineSimpleRetriever",
            "defineIndexer",
            "defineEvaluator",
            "defineEmbedder",
            "defineHelper",
            "definePartial",
            "defineReranker",
            "embed",
            "embedMany",
            "evaluate",
            "rerank",
            "index",
            "retrieve",
            "generate",
            "generateStream",
            "chat",
            "createSession",
            "loadSession",
            "currentSession",
            "stopServers",
            "startFlowServer"
        ]

        let hasAiDot = false;
        toAiDots.forEach((k: string) => {
            const r = new RegExp(`\\s*(ai)?\\.?${k}\\(`, 'g')
            const replaceWith = ` ai.${k}(`
            newCode = newCode.replace(r, replaceWith)
            hasAiDot ||= newCode.includes(replaceWith)
        })

        newCode = newCode
            .replace(/import\s*\w+\s*from\s*['"]zod['"]/g, `import {z} from "genkit"`) // replace import zod
            .replace(/onFlow\(\s*\{/g, "onFlow(ai,{")// `onFlow({` -> `onFlow(ai,{`
            .replace(/of\s+stream\(\)/g, "of stream")// `of stream()` -> `of stream`
            .replace(/await\s+response\(\)/g, "await response")// `await response()` -> `await response`
            .replace(/runAction\(\s*(\w+)\s*,?\s*\)?/g, '$1(\n') // `runAction(name, -> `name(`
            .replace(/['"]@genkit-ai\/(ai|core|flow)\/?\w*['"]/g, `"genkit"`) // `@genkit-ai/ai|core|flow...` -> `genkit`
            .replace(/geminiPro/g, "gemini10Pro") // `geminiPro` -> `gemini10Pro`

        hasAiDot ||= newCode.includes("onFlow(ai,{")

        // console.log({hasAiDot})
        const importAiDotCode = /import\s+{\s*ai\s*}\s+from\s+["']@\/ai\/ai["']/
        if (hasAiDot && !importAiDotCode.test(newCode)) {
            newCode = `import {ai} from "@/ai/ai"` + `\n` + newCode //prepend first line
        }

        /* comment-out bellow if you want to debug before execute */
        // if (fpath.includes("embeddings.ts")) {
        // console.log(newCode)
        // }

        // write newCode to file
        fs.writeFileSync(fpath, newCode)
        console.log(`MIGRATE DONE: ${fpath}`)
    }

    /*
    RUN REPLACE
    * */

    function walk(dir: string, clb?: (fpath: string) => void) {
        let files: string[] = [];
        try {
            files = fs.readdirSync(dir);
        } catch (e) {
        }
        if (!files?.length) {
            return;
        }

        files.forEach((file: string) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                walk(filePath, clb); // Recursively walk into subdirectories
            } else {
                if (filePath.endsWith('.ts')) {
                    clb?.(filePath)
                }
            }
        });
    }

    for (const dir of dirs) {
        walk(dir, replaceAtPath);
        if (prettier) {
            console.log(`excuting prettier for ${dir}`)
            execSync(`npx prettier --write ${dir}`)
        }
    }
}

doInstallAndRemoveDependencies()
// doCodeMod(['src/'], false/* do prettier: true|false */)
