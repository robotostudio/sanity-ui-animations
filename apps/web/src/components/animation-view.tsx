import { AnimationScene } from "@/components/animation-scene";
import type { AnimationSceneResult } from "@/lib/animation-scene";

type AnimationViewProps = Readonly<{
  title: string;
  /** The stored scene after `resolveAnimationScene`. */
  scene: AnimationSceneResult;
}>;

/**
 * Renders a published animation. A scene with validation errors never reaches
 * `<Scene>`: readers get a neutral line instead.
 */
export function AnimationView({ title, scene }: AnimationViewProps) {
  return (
    <div className="container grid gap-10 pt-12 pb-24 md:pt-16">
      <h1 className="text-balance font-normal text-4xl tracking-tight sm:text-5xl">
        {title}
      </h1>
      <div className="mx-auto w-full max-w-[min(40rem,80svh)]">
        {scene.renderable ? (
          <AnimationScene scene={scene.scene} />
        ) : (
          <p className="grid aspect-square place-items-center rounded-lg border border-dashed text-muted-foreground">
            This animation isn’t available right now.
          </p>
        )}
      </div>
    </div>
  );
}
