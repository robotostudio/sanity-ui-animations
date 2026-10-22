/**
 * Stand-in for the `sanity` package inside the harness only (see
 * `vite.config.ts`). It covers the hooks the generator components call, and
 * reads the document from `HarnessDocumentContext` instead of a form.
 */
import { createContext, useContext } from "react";

export type HarnessDocument = Record<string, unknown> & { _id: string };

export type HarnessContextValue = {
  document: HarnessDocument;
  client: unknown;
  patch: (attrs: Record<string, unknown>) => void;
};

export const HarnessDocumentContext = createContext<HarnessContextValue>({
  document: { _id: "drafts.harness" },
  client: undefined,
  patch: () => undefined,
});

const get = (value: unknown, path: (string | number)[]): unknown =>
  path.reduce<unknown>(
    (current, segment) =>
      current && typeof current === "object"
        ? (current as Record<string | number, unknown>)[segment]
        : undefined,
    value
  );

export const useFormValue = (path: (string | number)[]) =>
  get(useContext(HarnessDocumentContext).document, path);

export const useClient = () => useContext(HarnessDocumentContext).client;

export const getPublishedId = (id: string) => id.replace(/^drafts\./, "");

export const getDraftId = (id: string) =>
  id.startsWith("drafts.") ? id : `drafts.${id}`;

export const useDocumentOperation = () => {
  const { patch } = useContext(HarnessDocumentContext);
  return {
    patch: {
      disabled: false,
      execute: (patches: { set?: Record<string, unknown> }[]) => {
        for (const item of patches) {
          if (item.set) {
            patch(item.set);
          }
        }
      },
    },
  };
};
