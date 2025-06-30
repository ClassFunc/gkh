import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData,} from "@/util/commandParser";
import {readTemplate} from "@/commands/index";
import {camelCase, upperFirst} from "lodash";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone, logError, logInfo} from "@/util/logger";
import {exec} from "node:child_process";
import {jsonToZod} from "json-to-zod";

const CommandInputSchema = GlobalCommandInputSchema.extend({
  name: z.string(),
  jsonPath: z.string().optional(),
  fromClipboard: z.boolean().default(false).optional(),
  // from commander;
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";
// const makeX_DIR = "make_schema";
const SCHEMA_DIR = "schemas";

export async function make_schema() {
  const data = getParsedData(arguments, CommandInputSchema);
  commandInputDeclarationCode = getCommandInputDeclarationCode(data);

  const schemaName = upperFirst(camelCase(data.name.replace("/", "_")));
  data.name = schemaName;

  let code;
  if (data.fromClipboard) {
    const clipboardData = await getClipboardData();
    // logInfo({clipboardData})
    let zodSchemaString = jsonToZod(JSON.parse(clipboardData))
    zodSchemaString = zodSchemaString.replace('const schema =', '')
    logInfo({zodSchemaString})
    code = defineSchemaFromClipboardJSONCode({...data, schemaString: zodSchemaString});
  } else {
    code = defineSchemaCode(data);
  }

  const flowWriteTo = srcPath(SCHEMA_DIR, `${schemaName}Schema.ts`)
  const doneWriteFlow = makeFile(flowWriteTo, code, data.force)
  if (doneWriteFlow) {
    logDone(flowWriteTo)
  }
}

function defineSchemaCode(data: ICommandInput) {
  // work with input
  return readTemplate({
    dir: `make_schema`,
    name: `defineSchema`,
    data: data,
  });
}

function defineSchemaFromClipboardJSONCode(data: ICommandInput & { schemaString: string; }) {
  // work with input
  return readTemplate({
    dir: `make_schema`,
    name: `defineSchemaFromClipboardJSON`,
    data: data,
  });
}

const getClipboardData = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec('pbpaste', (error, stdout, stderr) => {
      if (error) {
        logError(`[getClipboardData] error: ${error}`);
        reject(error)
        return;
      }
      return resolve(stdout)
    })
  })
}

