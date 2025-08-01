import {z} from "zod";
import {extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry} from '@asteasolutions/zod-to-openapi';
import * as yaml from "yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import {configDotenv} from "dotenv";
import {compact, get, isEmpty, pick, upperFirst} from "lodash";
import {buildOutFlowsPath, getPakageJson} from "@/util/pathUtils";
import {logDone, logError, logInfo, logRunning, logWarning} from "@/util/logger";
import {IDocsGenInputSchema} from "@/commands/docs_gen";
import {ActionMetadata} from 'genkit'

extendZodWithOpenApi(z);

// const voidSchema = z.void().openapi({
//     type: "null", // Specify the OpenAPI type as null for ZodVoid
//     description: "Represents a void value.",
// }).optional();
// const neverSchema = z.never().openapi(
//     {
//         param: {
//             name: "ZodNever"
//         },
//         type: "null",
//         description: "Represents a never value.",
//     }
// )

z.unknown().openapi(
    {
        type: "null",
        description: "Represents a unknown value.",
    }
)

z.void().openapi(
    {
        type: "null",
        description: "Represents a void value.",
    }
)


const registry = new OpenAPIRegistry();


const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

const ApiKeyAuth = registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-KEY',
});


// read all flows in /flows dir
fs.readdirSync(buildOutFlowsPath()).forEach(
    flowDir => {
        const dir = path.join(buildOutFlowsPath(), flowDir)
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            return;
        }

        const flowsJs = path.join(dir, 'flows.js')

        try {
            const flowList = require(flowsJs) // /flows is flows.ts|.js
            if (flowList) {
                registryFlowInDir({flowList, tags: [String(flowDir)]})
            }
        } catch (e: any) {
            logError(e)
        }
    })

const RegistryFlowInDirInputSchema = z.object(
    {
        flowList: z.record(z.any()),
        tags: z.array(z.string())
    }
)

function registryFlowInDir({flowList, tags}: z.infer<typeof RegistryFlowInDirInputSchema>) {
    logInfo(tags)
    let actionMetadataList: Array<ActionMetadata<any, any, any>> = []
    for (let [dir, flowObj] of Object.entries(flowList)) {
        // console.group(dir)
        // console.log(flowObj)
        const isFlow = (get(flowObj, '__action.actionType') || get(flowObj, 'flow.__action.actionType')) === 'flow'
        if (!isFlow)
            continue
        const flowAction = get(flowObj, '__action')
        // logInfo(flowAction)
        actionMetadataList.push(flowAction)
        // console.groupEnd()
    }

    actionMetadataList = compact(actionMetadataList)
    if (isEmpty(actionMetadataList)) {
        return
    }
    // logWarning(actionMetadataList.map(t => pick(t, ['name', 'actionType'])))

    // logInfo(flowConfigs)
    for (const meta of actionMetadataList) {
        // logInfo('registering', meta.name);
        try {
            const isQueryStreamable = !!meta.streamSchema && (Object.keys(meta.streamSchema).length > 0)
            const streamableParam = isQueryStreamable ?
                {
                    name: 'stream',
                    in: 'query',
                    schema: {
                        type: "boolean",
                        default: false
                    }
                } : undefined;
            // console.log(flowConf.streamSchema)
            const streamableResponsesContent = isQueryStreamable ?
                {
                    'text/event-stream': {
                        schema: meta.streamSchema
                    }
                } : undefined;
            const parameters = isQueryStreamable ? [streamableParam] : []

            let inputSchema = meta.inputSchema ?? z.nullable(z.any());

            if (inputSchema?._def?.typeName === "ZodVoid") {
                inputSchema = z.nullable(z.any())
            }

            let outputSchema = meta.outputSchema ?? z.nullable(z.any());
            // console.log(outputSchema?._def?.typeName)
            // if (outputSchema?._def?.typeName === "ZodNever") {
            //     outputSchema = neverSchema;
            // }
            const INSchemaName = `${upperFirst(meta.name)}IN`
            const OUTSchemaName = `${upperFirst(meta.name)}OUT`
            // console.log({
            //     INSchemaName,
            //     OUTSchemaName,
            // })
            registry.register(INSchemaName, z.object({data: inputSchema}))
            registry.register(OUTSchemaName, z.object({result: outputSchema}))
            console.log(
                `  |-- openapi registerPath: /${meta.name}`,
                ` 🏷️`, tags,
                isQueryStreamable ? "✅ streamable" : ""
            )
            registry.registerPath({
                method: 'post',
                path: `/${meta.name}`,
                security: [
                    {
                        [bearerAuth.name]: []
                    },
                    {
                        [ApiKeyAuth.name]: []
                    }
                ],
                // description: FEUsageDescriptionTemplate(flowConf, tags),
                // summary: `import use${upperFirst(tags[0])}Api from @/app/docs/api/uses/use${upperFirst(tags[0])}Api`,
                tags,
                // @ts-ignore
                parameters,
                request: {
                    body: {
                        content: {
                            'application/json':
                                {
                                    schema: {
                                        $ref: `#/components/schemas/${INSchemaName}`
                                    }
                                }
                        },
                    }
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json':
                                {
                                    schema: {
                                        $ref: `#/components/schemas/${OUTSchemaName}`
                                    }
                                },
                            ...streamableResponsesContent
                        },
                    },
                    204: {
                        description: 'No content - successful operation',
                    },
                },
            })
        } catch (e) {
            logError('[registryFlowInDir] error:', e)
            return;
        }
    }
}


function getOpenApiDocumentation() {
    //read package.json

    const pkgJson = getPakageJson()
    const generator = new OpenApiGeneratorV3(registry.definitions);
    let apiEndpoint = process.env.API_ENDPOINT
    if (!apiEndpoint) {
        logWarning("Please add process.env.API_ENDPOINT; skip to using http://localhost:4001")
        apiEndpoint = "http://localhost:4001"
    }
    return generator.generateDocument({
        openapi: "3.0.1",
        info: {
            title: pkgJson?.name,
            description: pkgJson?.description ?? "",
            version: pkgJson?.version ?? "1.0.0",
        },
        servers: [
            {
                url: apiEndpoint,
                description: "The production server.",
            },
            {
                url: "http://localhost:4001",
                description: "The local server."
            }
        ],
    });
}


export function writeDocumentation(options: IDocsGenInputSchema) {
    let {out = './docs', name = 'api', envFile = '.env'} = options

    configDotenv({path: envFile})

    // OpenAPI JSON
    const generatedContent = getOpenApiDocumentation();

    // YAML equivalent
    let yamlContent = `
# This doc is generated at ${new Date().toLocaleString()} 

${yaml.stringify(generatedContent)}
`;

    let docsEndpoint = process.env.DOCS_ENDPOINT
    if (!docsEndpoint) {
        logWarning("Please add process.env.DOCS_ENDPOINT; skip to using http://localhost:4001")
        docsEndpoint = "http://localhost:4001"
    }

    const wPath = docsDir(out, `${name}.yaml`)
    logRunning(`writing to ${wPath}`)
    fs.writeFileSync(
        wPath,
        yamlContent,
        {
            encoding: 'utf-8',
        }
    );
    // HTML equivalent

    let html = swaggerUIBundleHTML
        .replace(
            "{{docs_enpoint}}",
            docsEndpoint
        ).replace(
            "{{description}}",
            generatedContent.info.description!
        ).replace(
            "{{title}}",
            generatedContent.info.title
        ).replace(
            /{{name}}/g,
            name,
        )
    fs.writeFileSync(
        docsDir(out, `${name}.html`),
        html,
        {
            encoding: 'utf-8',
        }
    );
    logDone(`docs available at: ${process.env.DOCS_ENDPOINT}`)
}

function docsDir(out: string, otherPath: string) {
    const docsDir = path.resolve(out)
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, {recursive: true})
    }
    return path.resolve(docsDir, otherPath)
}


const swaggerUIBundleHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="description" content="{{description}}"/>
    <title>{{title}}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"/>
    <link rel="icon" type="image/x-icon" href="/{{name}}_favicon.ico">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
<script>
    window.onload = () => {
        window.ui = SwaggerUIBundle({
            url: '{{docs_enpoint}}/{{name}}.yaml',
            dom_id: '#swagger-ui',
        });
    };
</script>
</body>
</html>
`