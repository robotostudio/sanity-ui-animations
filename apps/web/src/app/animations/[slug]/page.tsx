import { Logger } from "@sanity-ui-animations/logger";
import {
  sanityFetch,
  sanityFetchStaticParams,
} from "@sanity-ui-animations/sanity/live";
import {
  queryAnimationBySlug,
  queryAnimationPaths,
} from "@sanity-ui-animations/sanity/query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnimationView } from "@/components/animation-view";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { resolveAnimationScene } from "@/lib/animation-scene";
import { getSEOMetadata } from "@/lib/seo";
import { PLACEHOLDER_SLUG } from "@/utils";

const logger = new Logger("AnimationSlug");

type AnimationParams = { slug: string };

export async function generateStaticParams(): Promise<AnimationParams[]> {
  try {
    const { data: slugs } = await sanityFetchStaticParams({
      query: queryAnimationPaths,
    });
    const paths = (slugs ?? []).filter(Boolean).map((slug) => ({ slug }));
    return paths.length > 0 ? paths : [{ slug: PLACEHOLDER_SLUG }];
  } catch (error) {
    logger.error("Error fetching animation paths", error);
    return [{ slug: PLACEHOLDER_SLUG }];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<AnimationParams>;
}): Promise<Metadata> {
  // Shares the page's cached published fetch rather than
  // `sanityFetchMetadata`: this route never follows the draft perspective.
  const { slug } = await params;
  const data = await getPublishedAnimation(slug);
  return getSEOMetadata({
    title: data?.title,
    description: data?.scene.renderable ? data.scene.scene.label : undefined,
    slug: `/animations/${slug}`,
  });
}

/**
 * Published only, even in draft mode: the Studio has its own live preview,
 * and only a published animation has passed the publish gate. `reactCode` is
 * never queried: compiled code stays in the Studio.
 */
export default async function AnimationSlugPage({
  params,
}: Readonly<{ params: Promise<AnimationParams> }>) {
  const { slug } = await params;
  const data = await getPublishedAnimation(slug);
  if (!data) {
    notFound();
  }
  return (
    <main className="bg-background">
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Animations", href: "/animations" },
          { label: data.title },
        ]}
      />
      <AnimationView scene={data.scene} title={data.title} />
    </main>
  );
}

// Cached published fetch, gated here so a refused scene is logged once per
// cache fill rather than on every render; a miss lets the caller return a
// real 404. No stega: steps refer to windows and elements by id, so encoded
// strings would break every reference.
async function getPublishedAnimation(slug: string) {
  "use cache";
  const { data } = await sanityFetch({
    query: queryAnimationBySlug,
    params: { slug },
    perspective: "published",
    stega: false,
  });
  if (!data) {
    return null;
  }
  const scene = resolveAnimationScene(data.scene);
  if (!scene.renderable) {
    logger.warn(`Refusing to render animation "${slug}"`, scene.errors);
  }
  return { title: data.title, scene };
}
