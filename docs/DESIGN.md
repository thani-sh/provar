---
name: Provar Design System
colors:
  surface: "#10131a"
  surface-dim: "#10131a"
  surface-bright: "#363941"
  surface-container-lowest: "#0b0e15"
  surface-container-low: "#191b23"
  surface-container: "#1d2027"
  surface-container-high: "#272a31"
  surface-container-highest: "#32353c"
  on-surface: "#e1e2ec"
  on-surface-variant: "#c2c6d6"
  inverse-surface: "#e1e2ec"
  inverse-on-surface: "#2e3038"
  outline: "#8c909f"
  outline-variant: "#424754"
  surface-tint: "#adc6ff"
  primary: "#adc6ff"
  on-primary: "#002e6a"
  primary-container: "#4d8eff"
  on-primary-container: "#00285d"
  inverse-primary: "#005ac2"
  secondary: "#c0c1ff"
  on-secondary: "#1000a9"
  secondary-container: "#3131c0"
  on-secondary-container: "#b0b2ff"
  tertiary: "#ffb786"
  on-tertiary: "#502400"
  tertiary-container: "#df7412"
  on-tertiary-container: "#461f00"
  error: "#ffb4ab"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  primary-fixed: "#d8e2ff"
  primary-fixed-dim: "#adc6ff"
  on-primary-fixed: "#001a42"
  on-primary-fixed-variant: "#004395"
  secondary-fixed: "#e1e0ff"
  secondary-fixed-dim: "#c0c1ff"
  on-secondary-fixed: "#07006c"
  on-secondary-fixed-variant: "#2f2ebe"
  tertiary-fixed: "#ffdcc6"
  tertiary-fixed-dim: "#ffb786"
  on-tertiary-fixed: "#311400"
  on-tertiary-fixed-variant: "#723600"
  background: "#10131a"
  on-background: "#e1e2ec"
  surface-variant: "#32353c"
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: "600"
    lineHeight: "1.2"
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.3"
  title-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: "500"
    lineHeight: "1.4"
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.5"
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: "400"
    lineHeight: "1.6"
  label-xs:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: "600"
    lineHeight: "1"
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  grid-dot-gap: 20px
---

## Brand & Style

The design system is engineered for local end-to-end testing, prioritizing a focused, low-strain environment for developers. The aesthetic blends **Minimalism** with **High-Contrast Technical** elements, utilizing a "Deep Night" substrate to reduce eye fatigue during long debugging sessions.

The emotional response should be one of precision, stability, and absolute control. By using a dark, structured environment punctuated by high-energy accents, the system communicates that it is a powerful utility rather than a consumer toy. Key visual markers include a subtle dotted grid background that reinforces the feeling of a "workbench" or "canvas."

## Colors

The palette is rooted in a deep charcoal base (`#0f172a`), creating a vast, non-distracting workspace.

- **Primary Actions:** Use a high-vibrancy Electric Blue (`#3b82f6`) or Deep Indigo (`#6366f1`) to draw immediate attention to execution triggers (e.g., "Run Test").
- **Hierarchy:** Text follows a strict contrast ratio. Primary information is rendered in "Off-White" (`#f8fafc`), while metadata, labels, and inactive states use "Cool Gray" (`#94a3b8`).
- **Feedback:** Success states utilize emerald greens, while failures/errors use a high-saturation crimson to stand out against the dark background.

## Typography

This design system utilizes **Geist** for its core UI, a typeface specifically designed for developer tools, offering extreme legibility and a systematic feel.

For technical data, logs, and test scripts, **JetBrains Mono** is employed to maintain character distinction (like 0 vs O) which is critical in testing environments.

- **Scale:** Keep body text at 14px for density, allowing more data on screen.
- **Micro-labels:** Use uppercase 11px labels for section headers to maximize vertical space.

## Layout & Spacing

The system employs a **Fixed Sidebar / Fluid Content** model. The sidebar remains locked at 260px for navigation, while the main staging area expands to show test results and code.

- **Dotted Grid:** A background pattern of `1px` dots (Color: `#1e293b`) spaced at `20px` intervals provides a sense of alignment and scale without being visually heavy.
- **Rhythm & Spacing:** An 8px linear scale is used for all padding and margins. Ensure consistent vertical rhythm: maintain equal spacing above and below section headers (e.g., `16px` top and bottom) to create distinct grouping.
- **Safe Areas:** Main content containers should maintain a `24px` (lg) padding from the edge of the application window.

## Elevation & Depth

In this dark context, depth is communicated through **Tonal layering** rather than heavy shadows.

1. **Level 0 (Background):** `#0f172a` with the dotted grid.
2. **Level 1 (Panels/Cards):** `#1e293b`. These appear "raised" by being slightly lighter than the background.
3. **Level 2 (Modals/Popovers):** `#334155`. These use a very soft, high-spread shadow (`0 20px 25px -5px rgba(0,0,0,0.5)`) to separate them from the workspace.
4. **Borders:** Use subtle `1px` solid borders (`#334155`) for all panels to define boundaries in the absence of light-mode shadows.

## Shapes

Following the established brand identity, the design system uses significant rounding to soften the technical nature of the tool.

- **Main Panels/Cards:** `12px` to `16px` radius.
- **Inner Elements (Buttons/Inputs/Chips):** Must follow visual concentricity. If a panel has a `12px` radius and `8px` padding, the inner element should have a `4px` radius (`12 - 8`). As a general fallback, use a `6px` to `8px` radius. Never use fully rounded "pill" shapes for inputs.

## Components

- **Buttons:** Primary buttons use a solid Electric Blue fill with white text. Secondary buttons use a "Ghost" style (transparent fill, white border) that turns subtle gray on hover.
- **Cards:** Large containers with `16px` rounding and `#1e293b` background. Headers within cards should have a bottom border of `1px solid #334155`.
- **Input Fields:** Darker than the panels (`#0f172a`), with a `1px` border that glows blue (`#3b82f6`) only when focused. Use `body-md` (14px) typography to match the surrounding text scale.
- **Test Status Chips:** Use a "Pill" shape (full rounding). Use low-opacity backgrounds with high-opacity text (e.g., Green text on a 10% opacity green background).
- **Execution Bar:** A sticky bottom or top bar that houses the "Play," "Pause," and "Stop" actions, distinctively styled with high-contrast icons.
- **Monaco Editor Integration:** Code views should use a theme that matches the palette, specifically targeting the `Slate` or `Oceanic` color schemes.
