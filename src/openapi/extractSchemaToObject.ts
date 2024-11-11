import {z, ZodDefault, ZodOptional, ZodTypeAny} from "zod";
import {get} from "lodash";

export function extractSchemaToObject(schema?: z.ZodTypeAny): any {
    if (!schema)
        return null
    // console.log(schema._def)
    const typeName = schema._def.typeName
    // console.log(" -- schema def:", schema._def)

    if (typeName === "ZodObject") {
        const obj: any = {};
        for (const [key, value] of Object.entries((schema as z.ZodObject<any>).shape)) {
            // console.log({key, value})
            obj[key] = extractSchemaToObject(value as ZodTypeAny);
        }
        // console.log(obj)
        return obj;
    } else if (typeName === "ZodArray") {
        return [extractSchemaToObject(schema._def.type)]; // Handle array items
    } else if (typeName === "ZodOptional" || typeName === "ZodNullable") {
        return extractSchemaToObject((schema as ZodOptional<any>).unwrap()); // Unwrap optional/nullable
    } else if (typeName === "ZodDefault") {
        return extractTypeName((schema as ZodDefault<any>).array().element)
    } else {
        // Handle other Zod types (e.g., strings, numbers) with default values
        return schema._def.typeName;
    }
}

function extractTypeName(obj: any) {
    let typeName = get(obj, '_def.typeName')
    if (!get(obj, '_def.innerType') && typeName) {
        return typeName
    } else {
        return extractTypeName(get(obj, '_def.innerType'))
    }
}
