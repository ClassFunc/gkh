#!/usr/bin/env zx

const f = fs.readFileSync("docs/helpInformation.md")
const rt = fs.readFileSync('scripts/readme_template.md')

const newReadme = rt.toString().replace("{{helpInformation}}", f.toString())
fs.writeFileSync('readme.md', newReadme)
