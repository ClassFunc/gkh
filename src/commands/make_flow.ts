import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {existsSync, readFileSync} from "node:fs";
import {camelCase, upperFirst} from "lodash";
import {logDone} from "@/util/logger";
import {isIncludes} from "@/util/strings";
import {readTemplate} from "@/commands/index";
import {isGenkit0x} from "@/util/detectGenkitVersion";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string().includes("/"),
    type: z.enum(["defineFlow", "onFlow", "onCallGenkit"]).default("defineFlow").optional(),
    stream: z.boolean().default(false).optional()
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const FLOWS_DIR = "flows";

export function make_flow() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const [name1, name2] = data.name.split("/");
    const flowName = camelCase(data.name.replace("/", "_") + "Flow");

    const code = getTemplateCode(data, flowName);

    const flowWriteTo = srcPath(FLOWS_DIR, name1, 'flows', `${flowName}.ts`)
    const exportWriteTo = srcPath(FLOWS_DIR, name1, "flows.ts")
    const doneWriteFlow = makeFile(flowWriteTo, code, data.force)
    if (doneWriteFlow) {
        logDone(flowWriteTo)
        if (!existsSync(exportWriteTo)) {
            makeFile(exportWriteTo, "")
        }
        let flowTsContent = readFileSync(exportWriteTo).toString()
        const onCallGenkitExport = data.type === 'onCallGenkit' ? `, onCall${upperFirst(flowName)}` : ""
        const exportCode = `export {${flowName} ${onCallGenkitExport}} from "./flows/${flowName}"`
        if (!isIncludes(flowTsContent, exportCode)) {
            flowTsContent += `\n` + exportCode
            const doneWriteExport = makeFile(exportWriteTo, flowTsContent, true)
            if (doneWriteExport) {
                logDone(exportWriteTo)
            }
        }
        // if (data.type === 'onFlow') {
        //     //write /src/flows/flows.ts
        //     const eCode = `export * from "./${name1}/flows"`;
        //     const superFlowPath = srcPath(`flows/flows.ts`)
        //     if (!existsSync(superFlowPath)) {
        //         makeFile(superFlowPath, '')
        //     }
        //     let superFLowTsContent = readFileSync(superFlowPath).toString()
        //     if (!superFLowTsContent.replace(/\s/g, '').includes(eCode.replace(/\s/g, ''))) {
        //         superFLowTsContent += `\n${eCode}`
        //     }
        //     const superFlowWriteDone = makeFile(superFlowPath, superFLowTsContent, true)
        //     if (superFlowWriteDone) {
        //         logDone(superFlowPath)
        //     }
        // }
    }

}

const getTemplateCode = (data: ICommandInput, flowName: string) => {
    let tplName = ''

    // batch for genkit > 1.0
    if ((data.type === 'onFlow') && !isGenkit0x())
        data.type = 'onCallGenkit'

    switch (data.type) {
        case 'onFlow':
            if (isGenkit0x())
                tplName = 'onFlow'

            break;
        case 'defineFlow':
            if (data.stream) {
                tplName = 'defineStreamingFlow'
            } else {
                tplName = 'defineFlow'
            }
            break;
        case 'onCallGenkit':
            tplName = 'onCallGenkit'
            break;
    }
    data = {
        ...data,
        ...{
            flowName,
            FlowName: upperFirst(flowName),
            commandInputDeclarationCode
        }
    };
    return readTemplate({name: tplName, data: data, dir: 'make_flow'})
}
