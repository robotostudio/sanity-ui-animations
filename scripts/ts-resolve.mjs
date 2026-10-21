/**
 * Lets `node` run the repo's TypeScript scripts with its built-in type
 * stripping. Workspace packages import their siblings without an extension
 * (`./scene-spec`), which Node's resolver will not guess, so retry those
 * relative specifiers with `.ts`. Use with `node --import ./scripts/ts-resolve.mjs`.
 */
import { register } from "node:module";

register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!relative || /\\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    return next(specifier + ".ts", context);
  }
}
`)}`
);
