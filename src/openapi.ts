import {z} from "zod";
import {extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry} from '@asteasolutions/zod-to-openapi';
import * as yaml from "yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import {configDotenv} from "dotenv";
import {upperFirst} from "lodash";
import {allFlowsDir} from "./util/allFlowsDir";

configDotenv()
extendZodWithOpenApi(z);

// const voidSchema = z.void().openapi({
//     type: "null", // Specify the OpenAPI type as null for ZodVoid
//     description: "Represents a void value.",
// }).optional();
const neverSchema = z.never().openapi(
    {
        param: {
            name: "ZodNever"
        },
        type: "null",
        description: "Represents a never value.",
    }
)

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
fs.readdirSync(allFlowsDir()).forEach(
    flowDir => {
        const dir = path.join(allFlowsDir(), flowDir)
        // check `dir` has flows.ts or flows.js
        if (!fs.existsSync(dir + "/flows.ts") && !fs.existsSync(dir + "/flows.js")) {
            console.warn("flow folder `" + flowDir + "`shoud have flows.ts or flows.js")
        } else {
            const flowList = require(dir + "/flows") // /flows is flows.ts|.js
            if (flowList) {
                // console.log({flowsObj: flowList, flowDir})
                registryFlowInDir(/*dir,*/ {flowList, tags: [String(flowDir)]})
            }
        }
    })

const registryFlowInDirInputSchema = z.object(
    {
        flowList: z.record(z.any()),
        tags: z.array(z.string())
    }
)


export const FlowSchema = z.object({
    name: z.string(),
    inputSchema: z.any().optional(),
    outputSchema: z.any().optional(),
    streamSchema: z.any().optional()
})
export type IFlowSchema = z.infer<typeof FlowSchema>

function registryFlowInDir({flowList, tags}: z.infer<typeof registryFlowInDirInputSchema>) {
    // console.log("---- flowsObj:", flowsObj)
    const flowConfigs: Array<IFlowSchema> = []
    for (const [key, flowObj] of Object.entries(flowList)) {
        let flowConfig: IFlowSchema = {
            name: "",
            inputSchema: null,
            outputSchema: null,
            streamSchema: null,
        }
        // console.log(
        //     "-- flowName:", flowObj.name,
        // )
        for (const [field, fieldValue] of Object.entries(flowObj as any)) {
            const takeFields = [
                "name",
                "inputSchema",
                "outputSchema",
                "streamSchema",

            ]
            if (!takeFields.includes(field)) {
                continue
            }

            if (field === "name") {
                flowConfig.name = fieldValue! as string
            }
            if (field === "inputSchema") {
                flowConfig.inputSchema = fieldValue
            }
            if (field === "outputSchema") {
                flowConfig.outputSchema = fieldValue
            }
            if (field === "streamSchema") {
                flowConfig.streamSchema = fieldValue
            }
        }
        flowConfigs.push(flowConfig)
    }
    if (!flowConfigs || flowConfigs.length === 0) {
        return
    }
    // console.log({flowConfigs})
    for (const flowConf of flowConfigs) {

        const isQueryStreamable = flowConf.streamSchema && (Object.keys(flowConf.streamSchema).length > 0)
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
                    schema: flowConf.streamSchema
                }
            } : undefined;
        // console.log({requestQueryStreamable})
        const parameters = isQueryStreamable ? [streamableParam] : []
        let inputSchema = flowConf.inputSchema ?? z.nullable(z.any());
        // console.log(inputSchema._def.typeName)
        if (inputSchema?._def?.typeName === "ZodVoid") {
            inputSchema = z.nullable(z.any())
        }

        let outputSchema = flowConf.outputSchema ?? z.nullable(z.any());
        // console.log(outputSchema?._def?.typeName)
        // if (outputSchema?._def?.typeName === "ZodNever") {
        //     outputSchema = neverSchema;
        // }
        const INSchemaName = `${upperFirst(flowConf.name)}IN`
        const OUTSchemaName = `${upperFirst(flowConf.name)}OUT`
        registry.register(INSchemaName, z.object({data: inputSchema}))
        registry.register(OUTSchemaName, z.object({result: outputSchema}))
        console.log(
            `  |-- openapi registerPath: /${flowConf.name}`,
            ` 🏷️`, tags,
            isQueryStreamable ? "✅ streamable" : ""
        )
        try {
            registry.registerPath({
                method: 'post',
                path: `/${flowConf.name}`,
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
            console.error((e as Error).message)
        }
    }
}

function getOpenApiDocumentation() {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
        openapi: "3.0.1",
        info: {
            title: "Your API title",
            description: `${process.env.API_ENDPOINT}`,
            version: "1.0.0",
        },
        servers: [
            {
                url: process.env.API_ENDPOINT!,
                description: "The production server.",
            },
            {
                url: "http://localhost:4001",
                description: "The local server."
            }
        ],
    });
}

function writeDocumentation() {
    // OpenAPI JSON
    const docs = getOpenApiDocumentation();


    // YAML equivalent
    let fileContent = `
# This doc generated at ${new Date().toLocaleString()} 

${yaml.stringify(docs)}
    `

    const name = "api"

    fs.writeFileSync(
        docsDir(`${name}.yaml`),
        fileContent,
        {
            encoding: 'utf-8',
        }
    );
    // HTML equivalent
    let html = fs.readFileSync(
        docsDir("api/swaggerUIBundle.html")
    ).toString()
    html = html.replace(
        "{{openapi_url}}",
        `${process.env.DOCS_ENDPOINT}/${name}.yaml`
    ).replace(
        "{{description}}",
        docs.info.description!
    ).replace(
        "{{title}}",
        docs.info.title
    )
    fs.writeFileSync(
        docsDir(`${name}.html`),
        html, {
            encoding: 'utf-8',
        }
    );
}

function docsDir(otherPath: string) {
    const docsDir = path.resolve('docs')
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, {recursive: true})
    }
    return path.resolve(docsDir, otherPath)
}

writeDocumentation();