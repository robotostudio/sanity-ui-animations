import type { InputProps } from "sanity";
import { describe, expect, it } from "vitest";

import { lockInput } from "./animation-document-input";

describe("lockInput", () => {
  it("makes a primitive input and its element read-only", () => {
    const props = {
      readOnly: false,
      elementProps: { id: "prompt", readOnly: false },
    } as unknown as InputProps;

    expect(lockInput(props)).toMatchObject({
      readOnly: true,
      elementProps: { id: "prompt", readOnly: true },
    });
  });

  it("makes an object input read-only", () => {
    const props = { readOnly: false, members: [] } as unknown as InputProps;

    const locked = lockInput(props);
    expect(locked).toMatchObject({ readOnly: true, members: [] });
    expect("elementProps" in locked).toBe(false);
  });
});
