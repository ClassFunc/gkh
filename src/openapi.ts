import {z} from "zod";
import {extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry,} from "@asteasolutions/zod-to-openapi";
import * as yaml from "yaml";
import * as fs from "node:fs";
import * as path from "jsr:@std/path";
import {configDotenv} from "dotenv"; // import {FEUsageDescriptionTemplate} from "./openapi/templates/FEUsageDescriptionTemplate";
import {IFlowSchema} from "./openapi/schemas/IFlowSchema.ts";
import {capitalizeFirstLetter} from "./openapi/capitalizeFirstLetter.ts";
import process from "node:process";

configDotenv();
extendZodWithOpenApi(z);

// const voidSchema = z.void().openapi({
//     type: "null", // Specify the OpenAPI type as null for ZodVoid
//     description: "Represents a void value.",
// }).optional();
const neverSchema = z.never().openapi(
    {
        param: {
            name: "ZodNever",
        },
        type: "null",
        description: "Represents a never value.",
    },
);

z.unknown().openapi(
    {
        type: "null",
        description: "Represents a unknown value.",
    },
);

z.void().openapi(
    {
        type: "null",
        description: "Represents a void value.",
    },
);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
});

const ApiKeyAuth = registry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-API-KEY",
});

// read all flows in /flows dir
const __dirname: string = Deno.cwd();
console.log("cwd:", __dirname);
const allFlowsDir = path.join(__dirname, "flows");
console.log("reading flows in:", allFlowsDir);

for (const flowDirE of Deno.readDirSync(allFlowsDir)) {
    const flowName = flowDirE.name;
    const flowDir = path.join(allFlowsDir, flowName);
    // check `flowDir` has flows.ts or flows.js
    if (
        !fs.existsSync(flowDir + "/flows.ts") &&
        !fs.existsSync(flowDir + "/flows.js")
    ) {
        console.warn(
            "flow folder `" + flowName + "`shoud have flows.ts or flows.js",
        );
        continue;
    }

    console.log("importing flow at:", flowDir);
    const flowList = await import(flowDir + "/flows.ts"); // /flows is flows.ts|.js
    console.log(flowList);
    if (flowList) {
        // console.log({flowsObj: flowList, flowName})
        registryFlowInDir(/*flowDir,*/ {
            flowList,
            tags: [String(flowName)],
        });
    }
}
const registryFlowInDirInputSchema = z.object(
    {
        flowList: z.record(z.any()),
        tags: z.array(z.string()),
    },
);

function registryFlowInDir(
    { flowList, tags }: z.infer<typeof registryFlowInDirInputSchema>,
) {
    // console.log("---- flowsObj:", flowsObj)
    const flowConfigs: Array<IFlowSchema> = [];
    for (const [key, flowObj] of Object.entries(flowList)) {
        let flowConfig: IFlowSchema = {
            name: "",
            inputSchema: null,
            outputSchema: null,
            streamSchema: null,
        };
        // console.log(
        //     "-- flowName:", flowObj.name,
        // )
        for (const [field, fieldValue] of Object.entries(flowObj as any)) {
            const takeFields = [
                "name",
                "inputSchema",
                "outputSchema",
                "streamSchema",
            ];
            if (!takeFields.includes(field)) {
                continue;
            }

            if (field === "name") {
                flowConfig.name = fieldValue! as string;
            }
            if (field === "inputSchema") {
                flowConfig.inputSchema = fieldValue;
            }
            if (field === "outputSchema") {
                flowConfig.outputSchema = fieldValue;
            }
            if (field === "streamSchema") {
                flowConfig.streamSchema = fieldValue;
            }
        }
        flowConfigs.push(flowConfig);
    }
    if (!flowConfigs || flowConfigs.length === 0) {
        return;
    }
    // console.log({flowConfigs})
    for (const flowConf of flowConfigs) {
        const isQueryStreamable = flowConf.streamSchema &&
            (Object.keys(flowConf.streamSchema).length > 0);
        const streamableParam = isQueryStreamable
            ? {
                name: "stream",
                in: "query",
                schema: {
                    type: "boolean",
                    default: false,
                },
            }
            : undefined;
        // console.log(flowConf.streamSchema)
        const streamableResponsesContent = isQueryStreamable
            ? {
                "text/event-stream": {
                    schema: flowConf.streamSchema,
                },
            }
            : undefined;
        // console.log({requestQueryStreamable})
        const parameters = isQueryStreamable ? [streamableParam] : [];
        let inputSchema = flowConf.inputSchema ?? z.nullable(z.any());
        // console.log(inputSchema._def.typeName)
        if (inputSchema?._def?.typeName === "ZodVoid") {
            inputSchema = z.nullable(z.any());
        }

        let outputSchema = flowConf.outputSchema ?? z.nullable(z.any());
        // console.log(outputSchema?._def?.typeName)
        // if (outputSchema?._def?.typeName === "ZodNever") {
        //     outputSchema = neverSchema;
        // }
        const INSchemaName = `${capitalizeFirstLetter(flowConf.name)}IN`;
        const OUTSchemaName = `${capitalizeFirstLetter(flowConf.name)}OUT`;
        registry.register(INSchemaName, z.object({ data: inputSchema }));
        registry.register(OUTSchemaName, z.object({ result: outputSchema }));
        console.log(
            `  |-- openapi registerPath: /${flowConf.name}`,
            ` 🏷️`,
            tags,
            isQueryStreamable ? "✅ streamable" : "",
        );
        try {
            registry.registerPath({
                method: "post",
                path: `/${flowConf.name}`,
                security: [
                    {
                        [bearerAuth.name]: [],
                    },
                    {
                        [ApiKeyAuth.name]: [],
                    },
                ],
                // description: FEUsageDescriptionTemplate(flowConf, tags),
                // summary: `import use${capitalizeFirstLetter(tags[0])}Api from @/app/docs/api/uses/use${capitalizeFirstLetter(tags[0])}Api`,
                tags,
                // @ts-ignore
                parameters,
                request: {
                    body: {
                        content: {
                            "application/json": {
                                schema: {
                                    $ref:
                                        `#/components/schemas/${INSchemaName}`,
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref:
                                        `#/components/schemas/${OUTSchemaName}`,
                                },
                            },
                            ...streamableResponsesContent,
                        },
                    },
                    204: {
                        description: "No content - successful operation",
                    },
                },
            });
        } catch (e) {
            console.error((e as Error).message);
        }
    }
}

function getOpenApiDocumentation() {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
        openapi: "3.0.1",
        info: {
            title: "API genkit for akasach.io",
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
                description: "The local server.",
            },
        ],
    });
}

function writeDocumentation() {
    // OpenAPI JSON
    const docs = getOpenApiDocumentation();

    // YAML equivalent
    let fileContent = `
# This doc generated at ${
        new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" })
    } Asia/Saigon time)

${yaml.stringify(docs)}
    `;

    const name = "api";

    fs.writeFileSync(
        docsDir(`${name}.yaml`),
        fileContent,
        {
            encoding: "utf-8",
        },
    );
    // HTML equivalent
    let html = fs.readFileSync(
        docsDir("api/swaggerUIBundle.html"),
    ).toString();
    html = html.replace(
        "{{openapi_url}}",
        `${process.env.DOCS_ENDPOINT}/${name}.yaml`,
    ).replace(
        "{{description}}",
        docs.info.description!,
    ).replace(
        "{{title}}",
        docs.info.title,
    );
    fs.writeFileSync(
        docsDir(`${name}.html`),
        html,
        {
            encoding: "utf-8",
        },
    );
}

function docsDir(otherPath: string) {
    const docsDir = path.resolve("docs");
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }
    return path.resolve(docsDir, otherPath);
}

writeDocumentation();
