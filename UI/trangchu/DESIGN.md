---
name: Kinetic Ether
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbc9cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#859397'
  outline-variant: '#3c494c'
  surface-tint: '#2fd9f4'
  primary: '#8aebff'
  on-primary: '#00363e'
  primary-container: '#22d3ee'
  on-primary-container: '#005763'
  inverse-primary: '#006877'
  secondary: '#ffb783'
  on-secondary: '#4f2500'
  secondary-container: '#d97722'
  on-secondary-container: '#451f00'
  tertiary: '#d8daff'
  on-tertiary: '#131e8c'
  tertiary-container: '#b6bcff'
  on-tertiary-container: '#3842ab'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a2eeff'
  primary-fixed-dim: '#2fd9f4'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#ffdcc5'
  secondary-fixed-dim: '#ffb783'
  on-secondary-fixed: '#301400'
  on-secondary-fixed-variant: '#713700'
  tertiary-fixed: '#e0e0ff'
  tertiary-fixed-dim: '#bdc2ff'
  on-tertiary-fixed: '#000767'
  on-tertiary-fixed-variant: '#2f3aa3'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  stat-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

The design system is engineered for a high-stakes, competitive esports environment, blending the precision of high-tech interfaces with the ethereal qualities of a fantasy setting. The visual direction, "Clean Sci-Fi Fantasy," prioritizes information density and split-second readability without sacrificing atmosphere.

The aesthetic leans heavily into **Glassmorphism** and **Minimalism**. It avoids the weathered, grimy textures common in the genre in favor of pristine, high-performance surfaces. UI elements should feel like light-projected overlays—low friction, luminous, and responsive. The goal is to evoke a sense of focused aggression and tactical clarity, ensuring players feel they are operating a high-end combat interface.

## Colors

The palette is anchored by a deep navy/slate foundation to provide maximum contrast for luminous UI elements. 

- **Primary (Cyan):** Reserved strictly for player-controlled actions, friendly units, and positive progress. It represents the player's "will" within the game.
- **Secondary (Amber/Orange):** Used for opponent indicators, incoming threats, and critical warnings. It creates immediate visual tension against the cool background.
- **Tertiary (Indigo):** Used for neutral elements, secondary systems, or "magical" utility actions that fall outside the direct player/opponent conflict.
- **Neutral/Surface:** A range of slates used for panel backgrounds, employing semi-transparency to maintain a sense of depth and spatial awareness of the battlefield behind the UI.

## Typography

Typography is categorized into three functional groups:

1.  **Identity & Headers (Geist):** A sharp, technical sans-serif used for major UI headings, tower names, and victory/defeat screens. It conveys a modern, "built" feel.
2.  **General UI & Reading (Inter):** Used for tooltips, descriptions, and setting menus. It provides neutral, high-legibility grounding for dense information.
3.  **Data & Counters (JetBrains Mono):** A monospaced font used for all numerical values, resource counts, timers, and cooldowns. The fixed width prevents "jitter" in the UI as numbers fluctuate rapidly during gameplay.

Use All-Caps for labels and headers to enhance the "command console" feel, but maintain Sentence-case for long-form descriptions to ensure readability.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a 12-column structure for desktop. In-game HUD elements should be anchored to the corners and edges (safe areas) to keep the center of the screen clear for the battlefield.

- **HUD Anchoring:** Vital stats (Health/Mana) occupy the bottom-center or bottom-left/right. Resource counters occupy the top-right.
- **Spacing Rhythm:** Based on a 4px base unit. Gaps between related buttons should be 8px (2 units), while separation between distinct UI panels should be 24px (6 units).
- **Safe Margins:** A 32px safe area is maintained from all screen edges on desktop to prevent visual clutter and ensure elements don't feel "cramped" against the bezel.

## Elevation & Depth

Depth is achieved through **Glassmorphism** and layering rather than traditional drop shadows.

- **Surface Tiers:** Use `rgba(30, 41, 59, 0.7)` for primary panels. Apply a `backdrop-filter: blur(12px)` to create a separation between the UI and the chaotic game world.
- **Inner Glows:** Instead of shadows, use 1px inner borders (strokes) with a subtle glow. Player panels use a cyan inner-stroke (20% opacity), while opponent panels use amber.
- **Z-Axis:** Active modals or hover states should increase in background opacity (up to 90%) and add a subtle cyan/amber "outer bloom" (0 0 15px) to simulate light emission.

## Shapes

The design system utilizes **Soft** roundedness (0.25rem) to maintain a modern feel, but introduces "Chamfered" visual accents to reinforce the sci-fi theme.

- **Corner Styling:** While containers use standard 4px radii, decorative elements and active states should incorporate 45-degree clipped corners (chamfers) on the top-right or bottom-left.
- **Borders:** Keep borders ultra-thin (1px). Use linear gradients for borders (e.g., from primary color to transparent) to suggest "energy" flowing through the UI frame.

## Components

### Buttons
- **Action Buttons:** Large, rectangular with 1px borders. Primary actions use a solid cyan-to-transparent gradient fill. Secondary actions are ghost buttons with cyan text.
- **Aggressive Actions:** Buttons related to attacking or deploying units use the Amber secondary color.

### Panels & Cards
- **Game Cards:** Used for tower selection. Feature a 70% dark slate background, backdrop blur, and a top-weighted inner glow.
- **Tooltips:** 100% opaque slate backgrounds to ensure text readability over the moving game world.

### Inputs & Counters
- **HUD Counters:** Monospaced digits with a subtle "flicker" animation when values change.
- **Resource Bars:** Flat, no-gradient fills. The background of the bar should be a dark, 30% opaque version of the fill color.

### Lists
- **Kill Feed / Logs:** Compact, monospaced text. Use cyan/amber text prefixes to denote which team triggered the event. No background containers for the feed to minimize screen real estate usage.