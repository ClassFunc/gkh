import {readFileSync} from "node:fs";
import handlebars from "handlebars";

export function readTemplate(
    {
        dir,
        name,
        data,
        addtionsData
    }: {
        dir: string;
        name: string;
        data: Record<string, any>;
        addtionsData?: Record<string, any>
    }) {
    if (!name.endsWith(`.ts.hbs`)) {
        name += `.ts.hbs`
    }
    const fContent = readFileSync(__dirname + `/${dir}/templates/${name}`).toString()
    return handlebars.compile(fContent, {
        noEscape: true
    })({...data, ...addtionsData}).toString();
}