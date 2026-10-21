# Roboto Studio brand guidelines

Machine-readable twin of [robotostudio.com/design](https://robotostudio.com/design), for any agent producing an asset that carries the Roboto name. Roboto Studio (robotostudio.com) is a Sanity and Next.js agency. "Roboto" is fine on second reference.

This file holds the globals. Three guides build on it and never contradict it. Read this file, then the guide for the thing you are making.

| Guide | Covers |
|---|---|
| [charts.md](https://robotostudio.com/design/charts.md) | data visualization on the site: Voltage series palette, chart chrome, MDX chart components, KPI tiles, Mermaid diagrams |
| [reports.md](https://robotostudio.com/design/reports.md) | Roboto-branded HTML and PDF documents (reports, audits, proposals, contracts): frame, components, monochrome charts, print rules, writing rules |
| [motion.md](https://robotostudio.com/design/motion.md) | every animation on the site, page UI and Scenes: motion roles, springs, Scene modes, Scene look and choreography |

## Logo

Two marks: the R glyph (standalone icon) and the wordmark (full lockup). The R mark ships in dark, light, and pink; the wordmark in dark and light. Every variant ships as SVG, the source format, and as PNG for tools that can't render SVG (2048px wide; the square and rounded tiles are 1200x1200).

| Asset | Use case | URL |
|---|---|---|
| R mark, dark bg | icon on black/dark surfaces | `https://robotostudio.com/brand/roboto-r-dark.svg` / `.png` |
| R mark, light bg | icon on white/light surfaces | `https://robotostudio.com/brand/roboto-r-light.svg` / `.png` |
| R mark, pink | hot pink accent recolor | `https://robotostudio.com/brand/roboto-r-pink.svg` / `.png` |
| Wordmark, dark bg | full lockup on dark surfaces | `https://robotostudio.com/brand/roboto-wordmark-dark.svg` / `.png` |
| Wordmark, light bg | full lockup on light surfaces | `https://robotostudio.com/brand/roboto-wordmark-light.svg` / `.png` |
| R mark, square tile | app icons, avatars, favicons | `https://robotostudio.com/brand/roboto-r-square-dark.png` |
| R mark, rounded tile | avatars where the host platform forces a rounded frame | `https://robotostudio.com/brand/roboto-r-rounded-dark.png` |

- "Dark" files go on dark backgrounds (the mark renders white, or the R sits on a black tile). "Light" files go on light backgrounds (the mark renders black). Never swap them.
- Pink is the only sanctioned recolor, and only through the pink assets. Never recolor the logo otherwise.
- The mark and its tile stay sharp-cornered. Never stretch, skew, or rotate the mark.
- Clear space on every side is at least the width of one stroke of the R.

## Colors

| Role | Value | Notes |
|---|---|---|
| Black | `#000000` | primary text and dark backgrounds |
| White | `#FFFFFF` | primary background and light-background text |
| Gray scale | Tailwind zinc | never Tailwind gray |
| Accent (hot pink) | `#FF00A8` | the pink R mark and small, deliberate accent moments; never a primary UI color, never a large surface |

Light and dark mode, both from the zinc ramp:

| Role | Light | Dark |
|---|---|---|
| Page background | `#FFFFFF` | `#141414` |
| Text | zinc-950 `#09090B` | `#FAFAFA` |
| Muted text | zinc-500 `#71717A` | zinc-400 `#A1A1AA` |
| Hairline border | zinc-200 `#E4E4E7` | zinc-800 `#27272A` |
| Muted surface | zinc-100 `#F4F4F5` | zinc-800 `#27272A` |

Charts are the only place color carries meaning; their five-hue palette is in charts.md. Green and red are reserved for deltas and pass/fail states.

## Typography

- Geist for everything. Geist Mono only for labels and machine strings (code, paths, IDs, URLs, figures), never body copy or headings.
- Weight 400 for headings and body. Strong is 500. Nothing is bold. Hierarchy comes from size and color.
- Sentence case for all UI text, wherever the brand appears: "Get started", not "Get Started".
- Labels are Geist Mono, 10px, uppercase, letter-spaced (2px on the site, 0.05em in documents), muted zinc. They mark eyebrows, metadata, axis ticks, and captions.

## Surfaces

- Hairline borders, 1px zinc-200 (zinc-800 in dark mode), divide content. Grid cells share one line, never doubled.
- Sharp corners on everything in the page: cards, containers, buttons, images, inputs, tables, chart frames, the logo's tile.
- The one exception is floating chrome. Fixed-position pills, pickers, and toolbars that hover over content are rounded frosted glass: translucent background, backdrop blur, a bright top edge.

## Motion

- One motion language for the whole site: every animation names a role (press, enter, exit, move, glide, reveal, drawer, sweep), never a raw curve. The roles, springs and Scene rules are in [motion.md](https://robotostudio.com/design/motion.md).
- Scenes, the animated illustrations on service pages, are the second exception to sharp corners: they depict product UI, so their Panels are rounded glass.

## Downloads

- Asset pack, all variants, both formats: `https://robotostudio.com/brand/roboto-brand-assets.zip`
- Guidelines with visual examples: [robotostudio.com/design](https://robotostudio.com/design)
