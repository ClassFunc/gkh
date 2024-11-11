async function gen_docs() {
    console.log("this is gen:docs cmd");
    await import("../openapi.ts");
}

export { gen_docs };
