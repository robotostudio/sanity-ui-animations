import { useScene } from "../context";

/**
 * The neutral backdrop: a CSS mesh gradient over the theme's five ground
 * tones, standing in for a Paper Shaders mesh.
 */
export function Ground() {
  const { theme } = useScene();
  const [lightest, light, mid, dark, darkest] = theme.groundTones;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: light,
        backgroundImage: [
          `radial-gradient(at 12% 8%, ${lightest} 0px, transparent 55%)`,
          `radial-gradient(at 88% 18%, ${mid} 0px, transparent 50%)`,
          `radial-gradient(at 20% 92%, ${dark} 0px, transparent 55%)`,
          `radial-gradient(at 92% 88%, ${darkest} 0px, transparent 45%)`,
        ].join(", "),
      }}
    />
  );
}
