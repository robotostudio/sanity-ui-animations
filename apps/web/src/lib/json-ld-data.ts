"use cache";

import { sanityFetch } from "@sanity-ui-animations/sanity/live";
import { querySettingsData } from "@sanity-ui-animations/sanity/query";

import { handleErrors } from "@/utils";

export async function getJsonLdSettings() {
  // sanityFetch (not raw client.fetch) registers Sanity Live tags so settings edits invalidate this.
  const [res] = await handleErrors(
    sanityFetch({
      query: querySettingsData,
      perspective: "published",
      stega: false,
    })
  );
  return res?.data;
}
