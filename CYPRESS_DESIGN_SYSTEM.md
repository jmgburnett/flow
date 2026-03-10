# Cypress Design System — Extracted from Figma

Source: Figma file `UA7g21UklfSbtc2fXvNOHS` (🟡 Cypress: Foundations)

## Fonts
- **Display/Headings:** F37 Jan (weight 250, -0.4 letter-spacing)
- **Body:** F37 Zagma Text Trial (weights 200-700, 16px/24px base)
- **Icons:** Font Awesome 6 Pro (Phosphor icons in component library)

## Color Palette

### Core Surfaces
- `page`: #fafaf9 (warm off-white)
- `card`: #fafaf9 
- `home`: #eeedeb (warm light gray)
- `deep/brand`: #f0ede3 (cream)
- `stage/rail`: #fafaf9 @ 82% opacity (frosted)
- `accent/harmony/raised/splash`: #2a2a28 (near-black warm)

### Primary / Brand
- `content studio`: #003642 (dark teal)
- `Menu Item`: #08a39e (teal/green)
- `Selection Indicator`: #f9d65d (yellow gold)
- `glow`: #7089ff (blue/purple)
- `Subtract`: #0d99c0 (bright cyan)
- `teal accents`: #1bd4ed (bright cyan-teal)

### Text
- `Text/Number/Supporting text`: #151313 (near-black)
- `Metadata`: #42423c (dark gray)
- `Label/workspace`: #1b1a18 @ 64% (muted dark)
- `Icon`: #737373 (medium gray)
- `Title`: #22221f @ 64%

### Utility
- `Divider/Button/Image border`: #e5e4e0 (warm light border)
- `utils - progress`: #059961 (green)
- `utils - status bg`: #d3f8d9 @ 64% (light green)
- `WCAG contrast`: #1d5f48 (dark green)
- `Swatch/success`: #00c980 @ 4%

## Spacing Scale (8px baseline grid)
0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128...

### Usage
- 8px: related elements (proximity)
- 16px: unrelated elements (separation)
- 24px: sub-sections
- 32px: section separation

## Border Radius
- Default: rounded-xl (12px)
- Cards: 12px
- Buttons: varies by component

## Materials & Elevation

### Glass
- `backdrop-blur: 16px`
- Shadow: `0 0 80px rgba(204,216,255,1.0)`, `0 0 40px rgba(21,21,19,0.04)`

### Paper 01 (lowest)
- `backdrop-blur: 12px`
- Shadow: `40px 40px 80px rgba(21,21,19,0.08)`, `10px 5px 20px rgba(21,21,19,0.08)`, `-20px 5px 40px rgba(21,21,19,0.08)`

### Paper 02
- Same as Paper 01

### Paper 03
- Same as Paper 01

### Elevation Levels
1. **Level 1:** `backdrop-blur: 12px`, `0 4px 8px -1px rgba(21,21,19,0.04)`, `0 2px 2px rgba(21,21,19,0.04)`
2. **Level 2:** `backdrop-blur: 12px`, `0 8px 20px -4px rgba(21,21,19,0.04)`, `0 4px 16px rgba(21,21,19,0.04)`
3. **Level 3:** `backdrop-blur: 12px`, `16px 16px 18px -8px rgba(21,21,19,0.08)`, `-16px 4px 18px -8px rgba(21,21,19,0.08)`
4. **Level 4:** `backdrop-blur: 12px`, `40px 40px 80px rgba(21,21,19,0.08)`, `10px 5px 20px rgba(21,21,19,0.08)`, `-20px 5px 40px rgba(21,21,19,0.08)`

### Interaction Surface
- `backdrop-blur: 8px`
- Same shadow as Level 4
