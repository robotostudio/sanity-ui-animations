import { env } from "@sanity-ui-animations/env/server";
import { client } from "@sanity-ui-animations/sanity/client";
import { defineEnableDraftMode } from "next-sanity/draft-mode";

export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: env.SANITY_API_READ_TOKEN }),
});
