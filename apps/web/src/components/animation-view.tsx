import { Logger } from "@sanity-ui-animations/logger";

import { AnimationScene } from "@/components/animation-scene";
import { resolveAnimationScene } from "@/lib/animation-scene";

const logger = new Logger("AnimationView");

type AnimationViewProps = Readonly<{
  title: string;
  /** The stored `scene`, as the dataset holds it. */
  scene: unknown;
}>;

/**
 * Renders a published animation. A scene with validation errors never reaches
 * `<Scene>`: readers get a neutral line instead, and the issues go to the
 * server log for whoever has to fix the document.
 */
export function AnimationView({ title, scene }: AnimationViewProps) {
  const result = resolveAnimationScene(scene);
  if (!result.renderable) {
    logger.warn(`Refusing to render "${title}"`, result.errors);
  }

  return (
    <div className="container grid gap-10 pt-12 pb-24 md:pt-16">
      <h1 className="text-balance font-normal text-4xl tracking-tight sm:text-5xl">
        {title}
      </h1>
      <div className="mx-auto w-full max-w-[min(40rem,80svh)]">
        {result.renderable ? (
          <AnimationScene scene={result.scene} />
        ) : (
          <p className="grid aspect-square place-items-center rounded-lg border border-dashed text-muted-foreground">
            This animation isn’t available right now.
          </p>
        )}
      </div>
    </div>
  );
}
