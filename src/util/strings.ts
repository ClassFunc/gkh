export const isIncludes = (src: string, text: string): boolean => {
    const srcJS = src
        .replace(/["']/g, '"')
        .replace(/\s/g, '')
    const textJS =
        text
            .replace(/["']/g, '"')
            .replace(/\s/g, '')

    return srcJS.includes(textJS)
}
