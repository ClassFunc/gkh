#!/usr/bin/env node

import {Command, Option} from "commander";
import {docs_gen} from "./commands/docs_gen";
import {make_flow} from "./commands/make_flow";
import make_rag from "./commands/make_rag";
import {VERSION} from "./version";
import {make_ai} from "./commands/make_ai";

// ENDS_IMPORT_DONOTREMOVETHISLINE
const gkhProgram = new Command();

gkhProgram
    .addOption(new Option("-f, --force", "force write").default(false))
    .option("-v, --version", "version.txt", () => {
        console.log(`Version: ${VERSION}`);
        process.exit(0);
    });
gkhProgram
    .command("make:ai")
    .description("make ai instance")
    .option("-n, --name <name>", "name of ai instance", "ai")
    .action(make_ai);

gkhProgram
    .command("docs:gen")
    .description("generate openapi documents")
    .option("-n, --name <name>", "name of yaml file; defauls: api", "api")
    .option(
        "-o, --out <dir>",
        "output docs directory; defaults: ./docs",
        "./docs",
    )
    .option("-e, --env-file <env-file>", "env file path; defaults: .env", ".env")
    .action(docs_gen);
gkhProgram
    .command("make:flow")
    .argument("<name>", "name of flow, separated by / , ex: users/list")
    .option("-d, --directory [directory]", "flows dir name", "flows")
    .option(
        "-s, --stream [stream]",
        "streaming flow or not; default: false",
        false,
    )
    .description("generate a flow")
    .action(make_flow);
gkhProgram
    .command("make:rag")
    .argument("<name>", "rag name; ex: menuQA")
    .option(
        "-t, --type [type]",
        "type of vectorstore; supported 'firestore', 'local', 'simple'",
        "local",
    )
    .option("-l, --limit [limit]", "retriever's limit; default: 5", parseInt)
    .option(
        "-c, --collection [collection]",
        "firestore collection",
        "yourFirestoreCollection",
    )
    .option("-cf, --contentField [contentField]", "contentField", "contentField")
    .option(
        "-vf, --vectorField [vectorField]",
        `vectorField; default: $contentField + '_embedding'`,
        "",
    )
    .description("generate a rag")
    .action(make_rag);

// NEXT_COMMAND__DONOTREMOVETHISLINE

if (!process.env.GKH_HELP_INFO_GEN) {
    gkhProgram.parse();
}

export {gkhProgram};
