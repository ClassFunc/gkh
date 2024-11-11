import {logInfo} from "../util/logger";
import {WriteDocumentationInputSchema} from "../openapi";

async function docs_gen(options: any) {
    logInfo("generating openapi docs...")
    // console.log(name,options)
    // logWarning(name, options)
    console.log(options)
    require('../openapi').writeDocumentation(options as WriteDocumentationInputSchema)
}


export {docs_gen};
