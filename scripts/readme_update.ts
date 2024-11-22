#!/usr/bin/env tsx

import {makeFile} from "../src/util/pathUtils";
import {readFileSync} from "node:fs";
import {logDone} from "../src/util/logger";

// const shouldGen = !!process.env.GKH_HELP_INFO_GEN
//
// if (!shouldGen) {
//     logWarning(`not found process.env.GKH_HELP_INFO_GEN; please set "export GKH_HELP_INFO_GEN=true" and retry.`)
//     process.exit(0)
// }

(async function readme_gen() {
    // if (!existsSync('lib')) {
    //     logRunning("building for lib/ ...")
    //     execSync(`npm run build`);
    //     logDone()
    // }
    const {gkhProgram} = await import('../src/index')
    const mainFunctions = gkhProgram.commands.map(
        c => `- [x] [${c.name()} - ${c.description()}](#${c.name()})`
    ).join("\n")

    const helpInformation = gkhProgram.commands.map(c => `
### <a id="${c.name()}">${c.name()}</a>
\`\`\`
${c.helpInformation().replace(`Usage: `,`Usage: gkh`)}
\`\`\``).join(`\n`);


    const rt = readFileSync('scripts/readme_template.md')
    const newReadme = rt
        .toString()
        .replace("{{mainFunctions}}", mainFunctions)
        .replace("{{helpInformation}}", helpInformation)

    makeFile('README.md', newReadme, true)
    logDone(`updated README.md`)

})()
