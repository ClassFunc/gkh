import {jsonSchemaToZod} from "json-schema-to-zod";
import {jsonSchemaToZod as jsonSchemaToZod2} from "@n8n/json-schema-to-zod";
import {logError, logInfo} from "@/util/logger";

export const toZodSchemaString = (jsonSchema: any) => {
    if (typeof jsonSchema === "string") {
        try {
            jsonSchema = JSON.parse(jsonSchema)
            logInfo('parsed json:', jsonSchema)
        } catch (e) {
            logError('[toZodSchemaString] error:', e)
        }
    }
    return jsonSchemaToZod(jsonSchema)
}

export const toZodSchemaObject = (jsonSchema: any) => {
    return jsonSchemaToZod2(jsonSchema)
}