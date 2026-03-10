# Flow Design System
Based on Gloo Workspace component library

## Color Palette

### Backgrounds
- **Page background**: `#F8F7F4` (warm cream/off-white)
- **Surface/cards**: `#FFFFFF` (pure white with subtle border)
- **Sidebar**: `#F3F2EF` (slightly darker warm gray)
- **Sidebar active**: `#FFFFFF` or very light blue tint
- **Input fields**: `#FFFFFF` with `#E8E6E1` border

### Text
- **Primary**: `#1A1A1A` (near-black charcoal)
- **Secondary**: `#6B6B6B` (medium gray)
- **Tertiary/muted**: `#9B9B9B` (light gray)
- **Inverse**: `#FFFFFF` (on dark backgrounds)

### Accent
- **Blue (primary action)**: `#3B82F6` (active states, links, send button)
- **Blue dot**: `#3B82F6` (active indicator in sidebar/nav)
- **Blue light**: `#EBF5FF` (selected/hover backgrounds)

### Status
- **Active/success**: `#10B981` (green badges)
- **Warning/pending**: `#F59E0B` (amber)
- **Error/urgent**: `#EF4444` (red)
- **Closed**: `#0EA5E9` (teal/cyan badge)

### Interactive
- **Dropdown hover**: `#FEF3C7` (warm amber/yellow — signature Gloo hover)
- **Button hover**: `#F3F2EF` (subtle warm gray)
- **Card hover**: subtle shadow lift, no color change

### Borders
- **Default**: `#E8E6E1` (warm light gray)
- **Subtle**: `#F0EFEC` (barely visible, card separation)
- **Focus ring**: `#3B82F6` with 2px offset

### Chat
- **User message bubble**: `#F5F0E8` (warm tan/cream)
- **User message text**: `#1A1A1A`
- **AI response**: no bubble, plain text on page background
- **Thread separator**: dotted line `#D4D2CE`

## Typography

### Font
- **Family**: Inter (with system fallback stack)
- **Rendering**: antialiased

### Scale
- **xs**: 11px / 0.6875rem (timestamps, meta)
- **sm**: 13px / 0.8125rem (secondary text, badges)
- **base**: 14px / 0.875rem (body text, messages)
- **lg**: 16px / 1rem (card titles, nav items)
- **xl**: 20px / 1.25rem (page titles)
- **2xl**: 24px / 1.5rem (section headers)

### Weight
- **Regular**: 400 (body text)
- **Medium**: 500 (labels, nav items)
- **Semibold**: 600 (card titles, emphasis)
- **Bold**: 700 (page titles only)

## Spacing

### Base unit: 4px
- **xs**: 4px (inner element gaps)
- **sm**: 8px (tight spacing)
- **md**: 12px (standard gap)
- **lg**: 16px (card padding, section gaps)
- **xl**: 24px (page padding, major sections)
- **2xl**: 32px (between sections)

## Border Radius
- **sm**: 6px (badges, small elements)
- **md**: 8px (buttons, inputs)
- **lg**: 12px (cards, panels)
- **xl**: 16px (dialog/modal)
- **full**: 9999px (avatars, pills)

## Components

### Sidebar (Desktop)
- Width: 240px
- Background: `#F3F2EF`
- Logo/brand at top
- Text-based nav items (no heavy icons)
- Active item: white background or blue dot indicator
- Collapsible sections with chevron

### Cards
- Background: white
- Border: 1px `#E8E6E1`
- Border radius: 12px
- Padding: 16px
- Hover: subtle shadow lift (`0 2px 8px rgba(0,0,0,0.06)`)

### Chat Bubbles
- User (right-aligned): warm cream `#F5F0E8`, rounded 16px, max-width 70%
- AI (left-aligned): no bubble, plain text, full width
- Timestamp + name above bubble, right-aligned for user
- Small circular avatar next to name

### Buttons
- Primary: `#3B82F6` bg, white text, 8px radius
- Secondary/outline: white bg, `#E8E6E1` border, dark text
- Ghost: transparent bg, dark text, hover `#F3F2EF`
- Icon buttons: 32x32px, ghost style
- Active/selected: light blue bg `#EBF5FF`

### Badges/Pills
- Small: 11px font, 4px 8px padding, full radius
- Status colors: green (Active), cyan (Closed), amber (Pending)
- Category: light bg with colored text

### Dropdowns
- White background, subtle border
- Item padding: 8px 12px
- Hover: warm amber `#FEF3C7` (signature)
- Selected: checkmark icon, amber highlight
- Separator: 1px `#F0EFEC`

### Page Header
- White background card spanning full width
- Title left-aligned, semibold
- Right side: avatar stack + action buttons
- Bottom border or card shadow

### Input Fields
- White bg, `#E8E6E1` border, 8px radius
- Placeholder: `#9B9B9B`
- Focus: `#3B82F6` border
- Height: 40px standard, 48px for chat input

### Tab Bar
- Horizontal pills, `#F3F2EF` background
- Active tab: white bg with subtle shadow
- Text: medium weight, 13px

## Layout

### Desktop (≥768px)
- Left sidebar: 240px fixed
- Main content: fluid, max-width ~800px centered
- Optional right panel: 320px (thread view, details)

### Mobile (<768px)
- No sidebar — bottom navigation (pill style)
- Full-width content with 16px padding
- Stacked layout, no side panels
- Bottom nav: 5 items max, pill shape, floating above content

## Animation
- Transitions: 150ms ease-out (standard), 200ms for layout shifts
- Card hover: scale(1.01) + shadow
- Button press: scale(0.98)
- Page transitions: fade 150ms

## Dark Mode (future)
- Not in scope yet — Gloo reference is light-only
- When added: swap cream → dark charcoal, maintain warm undertone
