import {getPakageJson} from "@/util/pathUtils";

export const detectGenkitVersion = () => {
    //    detect from package.json
    const v = getPakageJson(
        'dependencies.genkit'
    ) as string;
    return v
}

export const isGenkit0x = () => {
    const v = detectGenkitVersion()
    return v.split('.')?.[0]?.includes('0')
}
export const isGenkit1x = async () => {
    const v = detectGenkitVersion()
    return v.split('.')?.[0]?.includes('1')
}

