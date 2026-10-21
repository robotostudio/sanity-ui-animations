import { sanityFetch } from "@sanity-ui-animations/sanity/live";
import { queryAnimationIndex } from "@sanity-ui-animations/sanity/query";
import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { getSEOMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return getSEOMetadata({
    title: "Animations",
    description: "UI animations generated in Sanity Studio.",
    slug: "/animations",
  });
}

export default async function AnimationsIndexPage() {
  const animations = await getPublishedAnimations();
  return (
    <main className="bg-background">
      <Breadcrumbs
        crumbs={[{ label: "Home", href: "/" }, { label: "Animations" }]}
      />
      <div className="container grid gap-10 pt-12 pb-24 md:pt-16">
        <h1 className="text-balance font-normal text-4xl tracking-tight sm:text-5xl">
          Animations
        </h1>
        {animations.length > 0 ? (
          <ul className="grid gap-2">
            {animations.map((animation) => (
              <li key={animation._id}>
                <Link
                  className="text-lg underline-offset-4 hover:underline"
                  href={`/animations/${animation.slug}`}
                >
                  {animation.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No animations yet.</p>
        )}
      </div>
    </main>
  );
}

async function getPublishedAnimations() {
  "use cache";
  const { data } = await sanityFetch({
    query: queryAnimationIndex,
    perspective: "published",
    stega: false,
  });
  return data ?? [];
}
