---
name: Zenithal Minimalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 640px
  gutter: 24px
  margin-base: 32px
  stack-lg: 64px
  stack-md: 32px
  stack-sm: 16px
---

## Brand & Style

This design system is anchored in the concept of "The Essential Void." It prioritizes content and contemplation over interface, stripping away all non-functional ornamentation to create a digital sanctuary for micro-blogging. 

The aesthetic is a pure expression of **Minimalism**, bordering on high-fashion editorial. It avoids the clutter of traditional social media by using extreme whitespace as a functional element to separate ideas. The interface is designed to feel "invisible"—only becoming apparent when the user intends to interact. The emotional response should be one of calm, focus, and intellectual clarity.

## Colors

The palette is strictly monochrome, utilizing a range of grays to establish hierarchy without the distraction of hue.

- **Primary (#000000):** Used for primary text and core structural icons. 
- **Secondary (#737373):** Used for secondary information, timestamps, and meta-data.
- **Neutral (#F5F5F5):** Used for subtle background shifts to differentiate content blocks without using borders.
- **Surface (#FFFFFF):** The primary canvas color.

Interactions are signaled by a shift from gray to black, rather than a color change.

## Typography

Typography is the primary driver of the UI. We use **Geist** for its precise, technical, yet highly legible characteristics. 

- **Headlines:** Use tight letter spacing and bold weights to create a strong visual anchor.
- **Body:** Generous line-height (1.6) is mandatory to ensure the "Zen" reading experience. 
- **Labels:** Use uppercase for the smallest labels to maintain authority and structure even at small scales.
- **Micro-copy:** Timestamps and count indicators should be kept in `label-sm` with a secondary gray color.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for the main content column to ensure readability on wide screens, centered with generous outer margins.

- **Content Width:** The main feed is restricted to a narrow `640px` to mimic the feel of a printed column or a classic notebook.
- **Vertical Rhythm:** We use a "stack" system. Posts are separated by `stack-lg` (64px) to give each thought its own breathing room.
- **Mobile:** On mobile, margins reduce to `20px`, but the vertical rhythm remains aggressive to prevent the feed from feeling cramped.

## Elevation & Depth

This design system rejects shadows and physical metaphors. Depth is achieved solely through **Tonal Layers** and whitespace.

- **Base Layer:** The pure white surface.
- **Hover/Active States:** Instead of raising an element with a shadow, we use a subtle background tint (`#F5F5F5`) or a 1px solid black underline for text links.
- **Overlays:** Modals or menus should not have shadows. Use a solid 1px black border or a full-screen white takeover to maintain the flat, minimalist integrity.

## Shapes

The shape language is "Soft-Modern." While the brand is serious, ultra-sharp corners can feel aggressive. 

A minimal radius of `0.25rem` (4px) is applied to buttons and input fields to subtly soften the interface without making it feel "bubbly" or playful. This maintains the professional, architectural feel of the design system.

## Components

### Buttons
Primary buttons are solid black with white text. Secondary buttons are transparent with a 1px light gray border that turns black on hover. Transition speeds should be slow (300ms) to reflect the "Zen" personality.

### Input Fields
Inputs are simple bottom-borders (1px). When focused, the border transitions to black. No background fill is used unless the input is disabled.

### Chips/Tags
Tags are rendered in `label-sm`, wrapped in a subtle `#F5F5F5` background with no border. They should appear almost as plain text until hovered.

### Cards/Post Items
Posts do not use containers or borders. They are identified by their typography (Headline + Body) and separated by significant vertical whitespace. 

### Interactive Hints
Icons for "Like" or "Share" should remain at 30% opacity until the user's cursor enters the post area, at which point they fade in to 100%. This reduces visual noise during the reading process.