import { z } from "zod";
import { GlobalCommandInputSchema } from "@/types/GlobalCommandInputSchema";
import {
  getCommandInputDeclarationCode,
  getParsedData,
} from "@/util/commandParser";
import { readTemplate } from "@/commands/index";
import {camelCase} from "lodash";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
  name: z.string()
  // from commander;
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";
// const makeX_DIR = "make_schema";
const SCHEMA_DIR = "schemas";

export function make_schema() {
  const data = getParsedData(arguments, CommandInputSchema);
  commandInputDeclarationCode = getCommandInputDeclarationCode(data);
  const code = get_code(data);
  // implementations
  const schemaName = camelCase(data.name.replace("/", "_") );
  const flowWriteTo = srcPath('flows', schemaName, SCHEMA_DIR, `${schemaName}.ts`)
  const doneWriteFlow = makeFile(flowWriteTo, code, data.force)
  if (doneWriteFlow) {
    logDone(flowWriteTo)
  }
}

function get_code(data: ICommandInput) {
  // work with input
  return readTemplate({
    dir: `make_schema`,
    name: `defineSchema`,
    data: data,
  });
}
