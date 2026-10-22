import type { GenerationClient } from "@sanity-ui-animations/ui-animations";

export type FakeRun = "pending" | "error";

/**
 * A `GenerationClient` whose Agent Actions call never answers (`pending`,
 * to hold the loading state) or fails (`error`). Writes succeed and are
 * dropped: the harness never spends a credit.
 */
export function fakeClient(run: FakeRun): GenerationClient {
  const patch = {
    set: () => patch,
    setIfMissing: () => patch,
    append: () => patch,
    commit: async () => ({}),
  };
  return {
    agent: {
      action: {
        generate: () =>
          run === "pending"
            ? new Promise(() => undefined)
            : Promise.reject(
                Object.assign(
                  new Error(
                    "Agent Actions request failed: the model did not return a scene."
                  ),
                  { statusCode: 500 }
                )
              ),
      },
    },
    getDocument: async (id) => ({ _id: id, _type: "animation" }),
    createIfNotExists: async () => ({}),
    patch: () => patch,
  };
}
