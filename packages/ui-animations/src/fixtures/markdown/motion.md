# Roboto Studio motion guidelines

Every animation on robotostudio.com: page UI (presses, menus, drawers, reveals) and Scenes, the animated illustrations embedded in service pages. One motion language covers both. The globals are in [design.md](https://robotostudio.com/design.md).

## Principles

1. Name the role, not the curve. Every animation is one of the roles below; if none fits, question the animation before inventing a curve.
2. Responses are fast, choreography is slow. A press lands in 140ms; a cursor crossing a Scene takes 1.5s. Same curves, different durations.
3. Exits are quicker than enters and never ease in.
4. Springs only where something physical happens: a release, a layout change, a pointer being followed.
5. Reduced motion keeps opacity and colour changes, drops movement and blur, and ships with the animation, never after it.

## Roles

| Role | Use | Curve | Duration |
|---|---|---|---|
| press | anything pressable: `:active` scale 0.97 | `cubic-bezier(0.23, 1, 0.32, 1)` | 140ms |
| enter | popovers, menus, tooltips, content swaps; scale from 0.96, never from 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 180 to 240ms |
| exit | close, dismiss, swap out | `cubic-bezier(0.23, 1, 0.32, 1)` | 120 to 160ms |
| move | tab indicators, repositions, reorders | `cubic-bezier(0.8, 0, 0.2, 1)` | 240 to 320ms |
| glide | choreography: cursor travel, fans, Scene repositions | `cubic-bezier(0.8, 0, 0.2, 1)` | 1200 to 1750ms, 50ms stagger; a hop of 60px or less takes 400ms |
| reveal | sections entering on scroll, once | `cubic-bezier(0.23, 1, 0.32, 1)` | 500ms, 16px rise, 50ms stagger, at most 8 items |
| drawer | sheets and the mobile nav | `cubic-bezier(0.32, 0.72, 0, 1)` | 340ms open, 260ms close |
| sweep | progress, spinners, anything constant | linear | the length of the track |

Hover colour changes run 150ms on the enter curve. Blur on content swaps never exceeds 4px.

Switches, tabs and segmented controls show their selection with a clip path, never a sliding indicator under recoloured text. Draw the labels twice: the plain row, then a selected-style copy laid exactly over it (`aria-hidden`, no pointer events) and clipped with `inset()` to the selected segment, rounded to match. Animate the `clip-path` on the move role, so the text turns over exactly where the edge passes it ([the technique](https://emilkowal.ski/ui/the-magic-of-clip-path)). Because the two rows must stay aligned, the press scales the whole control, not one segment.

## Springs

| Spring | Use | Motion config |
|---|---|---|
| snap | layout and size changes | `{ type: "spring", duration: 0.3, bounce: 0 }` |
| pop | a release after a press, with about 2% overshoot | `{ type: "spring", stiffness: 400, damping: 22, mass: 1 }` |
| track | following the pointer: tilt, parallax | `{ type: "spring", stiffness: 150, damping: 25, mass: 0.5 }` |

## Scenes

A Scene is a square React component that depicts product UI telling one story. It is built from Scene parts, which are separate from the site's own components and share only these tokens, the type scale and the colours.

### Modes

Every Scene declares one:

- **Ambient**: loops seamlessly while in view. Reduced motion shows a chosen still moment.
- **Intro**: plays once when it scrolls into view, then rests. Reduced motion shows the rest state.
- **Interactive**: the reader drives it. Reduced motion keeps the interaction and drops the movement.

Any mode may also react to the pointer (hover, proximity) on the track spring.

### Canvas

- Square only. Designed at its desktop size in real CSS pixels, on the site's type scale, then scaled down uniformly on smaller screens.
- Ambient and Intro Scenes are `role="img"` with a label, and their inner UI is hidden from assistive tech. Interactive Scenes expose real, labelled controls.
- Pause a Scene off-screen only when that measurably helps performance and adds no real complexity.

### Look

- **Ground**: the Paper Shaders mesh gradient in five neutral tones over a flat base, swirling slowly under a film grain. Static under reduced motion.
- **Panels** are rounded glass: a 16px window corner, inner corners equal to 16px minus their inset, translucent fill over a 22px backdrop blur, a 1px bright top edge, and no drop shadow. Cards inside a window are solid, so glass never stacks on glass within a window. Separate windows may overlap; the upper window's glass then sits over the lower one.
- **Window chrome** reads as a real Apple product: a Scene that shows an app copies its macOS layout and proportions (Safari's centred address field, Messages' bubbles and composer, the traffic lights 12px across, 8px apart and 20px in). The traffic lights are always neutral grey, never red, yellow and green; the window behind uses a lighter grey, as macOS dims an inactive window.
- **Tide** `#9FDCCF` is the one accent, used once per Scene on the action that matters most, never on a control. Text on Tide is Ink `#0B0C0E`. Everything else is neutral.
- **Badges** are fully round pills, 28px tall, with a 6px dot and a 12% fill of their status colour: success `#2E9E6B`, warning `#C98A0B`, error `#D6453D`, info `#3B6FD8`. A neutral badge is `#F1F0EC` with a 1px `#E3E2DD` border and no dot.
- **Controls** (checkboxes, toggles, radios, segmented controls) use Ink, never the accent. A checked checkbox is an Ink fill with a white tick (the tick is 58% of the box, stroke 2.4 on a 20-unit path); an unchecked one is the card colour with a 1px `#C9CCCF` border. Corners are a quarter of the box: 4px at 16px, 6px at 24px. In dark, Ink swaps for the text colour and the tick for the card colour.

| Token | Light | Dark |
|---|---|---|
| Ground tones | `#F8F7F4` `#E7E5DF` `#D2D1CB` `#B0B3B6` `#9A9EA3` | `#08090A` `#131416` `#1E1F22` `#3A3C40` `#4A4D52` |
| Glass fill | `#FFFFFF` at 55% | `#1A1B1D` at 55% |
| Card | `#FFFFFF` | `#1A1B1D` |
| Hairline | `#E3E2DD` | `#2E2F30` |
| Text | `#0B0C0E` | `#FAFAF8` |
| Secondary text | `#6B6E73` | `#A4A4A4` |
| Tide | `#9FDCCF` | `#9FDCCF` |

### Choreography

- **Cursor travel** glides between targets and arcs slightly, so it swoops rather than slides. It rests just off the target, never covering it. Duration follows distance: a hop to a neighbouring target (60px or less) takes 400ms, rising to the full glide at 240px, because a long glide over a short hop reads as hesitating.
- **A click** has two beats: the cursor settles for 100ms, presses to 0.8 scale about its tip over 80ms, holds 50ms, then releases on the pop spring. The target presses with it, and the result (a tick, a state change) lands on the release.
- **A tick**: the Ink fill fades up over 120ms on the enter curve, then the mark strokes in over 180ms, starting 40ms later. A tick never unticks in reverse; it clears by fading out whole on the exit role.
