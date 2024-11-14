#!/usr/bin/env node

const {gkhProgram} = require("../lib/index")
const {makeFile} = require("../lib/util/pathUtils")
const fs = require('node:fs')
const {logSuccess} = require("../lib/util/logger");


const mainFunctions = gkhProgram.commands.map(
    c => `- [x] [${c.name()} - ${c.description()}](#${c.name()})`
).join("\n")

const helpInformation = gkhProgram.commands.map(c => `
### <a id="${c.name()}">${c.name()}</a>
\`\`\`
${c.helpInformation()}
\`\`\``).join(`\n`);


const rt = fs.readFileSync('scripts/readme_template.md')
const newReadme = rt
    .toString()
    .replace("{{mainFunctions}}", mainFunctions)
    .replace("{{helpInformation}}", helpInformation)

makeFile('README.md', newReadme, true)
logSuccess(`README.md updated`)

