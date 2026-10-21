import {
  definePortableTextField,
  portableTextMemberTypes,
} from "@sanity-ui-animations/sanity-blocks/internal/sanity-rich-text";
import { defineType } from "sanity";

// Reuse the shared portable-text members from @sanity-ui-animations/sanity-blocks instead
// of redefining them (notably the code block) here.
export const richText = defineType({
  name: "richText",
  type: "array",
  of: definePortableTextField(portableTextMemberTypes).of,
});

export {
  definePortableTextField as customRichText,
  portableTextMemberTypes as memberTypes,
} from "@sanity-ui-animations/sanity-blocks/internal/sanity-rich-text";
