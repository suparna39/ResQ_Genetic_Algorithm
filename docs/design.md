# design.md
## AI Ambulance Allocation System — Design System & UI Architecture

This document defines the end-to-end design direction for the project.  
The design goal is a **premium black-and-monochrome interface** with a strict visual language, elegant motion, strong hierarchy, and a polished product feel.

---

# 1. Design Philosophy

The interface should feel:

- **clinical**
- **modern**
- **minimal**
- **trustworthy**
- **premium**
- **fast**
- **high-contrast**
- **intuitive**

The system should avoid decorative clutter and instead use:
- strong whitespace control
- monochrome contrast
- sharp typography
- subtle borders
- soft shadows
- smooth motion
- clear data hierarchy

The final experience should feel like a combination of:
- a high-end SaaS dashboard
- a real-time logistics control panel
- a clean medical operations console

---

# 2. Visual Theme

## Theme Name
**Black Monochrome Command UI**

## Color System

Use a strict grayscale palette.

### Base Colors
- Background: near-black
- Surface: dark gray
- Elevated surface: slightly lighter gray
- Border: muted gray
- Primary text: white
- Secondary text: light gray
- Accent: grayscale only, no bright colors

### Suggested Palette
- `#050505` — main background
- `#0A0A0A` — deep surface
- `#111111` — card background
- `#1A1A1A` — hover surface
- `#2A2A2A` — border gray
- `#EDEDED` — main text
- `#B0B0B0` — secondary text
- `#7A7A7A` — muted text

### Rules
- Do not use rainbow colors.
- Avoid saturated gradients.
- Use grayscale icons and UI indicators.
- Use status changes only through subtle contrast, icons, or text labels.
- Keep the system visually disciplined.

---

# 3. Typography

Typography should be modern, compact, and highly readable.

## Recommended Fonts
- **Inter**
- **Geist**
- **Manrope**
- **Plus Jakarta Sans**

## Typographic Style
- Large bold titles
- Medium-weight section headers
- Clean body text
- Small monospace labels for IDs, timestamps, and technical metadata

## Hierarchy
- Page title: large and bold
- Section title: medium bold
- Card title: semibold
- Body: regular
- Metadata: small, muted, monospace

## Text Rules
- Keep sentence length short on dashboards.
- Use concise labels.
- Avoid overly verbose copy on operational screens.
- Use strong numeric emphasis for ETA, priority, and distance.

---

# 4. UI Framework

## Core Stack
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Framer Motion**
- **Lucide React**
- **Recharts**
- **Leaflet or Google Maps**
- **Socket.IO client**

## Why shadcn/ui
shadcn provides:
- consistency
- accessibility
- a clean component base
- customizable primitives
- perfect fit for a monochrome product

## Why Framer Motion
Use Framer Motion for:
- page transitions
- card entrance animations
- map panel transitions
- dashboard state changes
- hover effects
- modal animations

## Why Charts
Use Recharts or similar for:
- emergency trends
- ambulance usage
- response time analytics
- hourly demand patterns

---

# 5. Motion Design Rules

Motion should be subtle, not flashy.

## Motion Principles
- smooth
- purposeful
- fast
- non-distracting
- slightly premium

## Animation Types
- fade in
- slide up
- soft scale
- hover elevation
- route draw animation
- panel reveal
- drawer open/close
- status pulse

## Motion Timing
- quick interactions: 150–200ms
- panel transitions: 220–300ms
- modal and route reveal: 250–400ms

## Motion Rules
- Do not overuse bounce.
- Do not use chaotic motion.
- Use motion to guide attention, not to entertain.
- Respect reduced-motion preferences.

---

# 6. Layout System

## Global Layout
The app should use a three-layer structure:

1. **Top bar** for global navigation and status
2. **Side navigation** for role-based dashboard access
3. **Content area** for dashboards, forms, maps, and analytics

## Layout Pattern
- Left sidebar on desktop
- Collapsible sidebar on smaller screens
- Sticky header
- Content in clean cards and panels
- Full-height map layout on tracking screens

## Spacing
Use generous spacing:
- page padding: 24–32px
- card padding: 20–24px
- section gap: 24–40px
- internal compact spacing for tables and forms

---

# 7. Core UI Style

## Card Design
Cards should feel like operational modules.

### Card Style
- dark surface
- 1px border
- soft shadow
- subtle hover lift
- rounded corners
- clean title + metric
- optional footer action

## Buttons
- primary button: white background, black text
- secondary button: dark surface, light border
- ghost button: transparent
- destructive action: still monochrome, but with stronger contrast and warning text

## Inputs
- dark input background
- visible border
- clear focus ring in grayscale
- compact label above field
- helper text in muted gray

## Tables
Tables should be:
- dense
- readable
- striped or softly separated
- sticky headers when necessary

## Badges
Use grayscale semantic badges:
- pending
- assigned
- en route
- picked up
- completed
- cancelled

Avoid bright color semantics. Use contrast, outline, and icon support instead.

---

# 8. End-to-End Product Structure

## Public Pages
These pages should explain the product clearly.

- landing page
- how it works
- emergency service overview
- login / register

## Patient Dashboard
Focus:
- request ambulance
- track ambulance
- see ETA
- view route map
- see status timeline

## Driver Dashboard
Focus:
- active assignment
- route navigation
- pickup status
- live location share
- trip progress

## Admin Dashboard
Focus:
- request queue
- ambulance fleet
- AI priority scores
- GA assignment results
- analytics
- overrides

---

# 9. Page-by-Page Design Direction

## 9.1 Landing Page
The landing page should feel like a premium product showcase.

### Sections
- hero
- feature grid
- process explanation
- live dashboard preview
- testimonials or trust indicators
- footer

### Hero Style
- large title
- sharp monochrome visual
- CTA buttons
- animated device mockup
- map / dashboard preview

### Visual Pattern
Use:
- split hero layout
- left side for copy
- right side for animated UI preview

---

## 9.2 Patient Dashboard
The patient dashboard should be simple and reassuring.

### Key Panels
- emergency request form
- request status card
- live ambulance map
- ETA card
- route progress timeline

### Visual Priorities
- clear emergency state
- large ETA number
- obvious ambulance marker
- calm and stable motion

---

## 9.3 Driver Dashboard
The driver dashboard should feel operational and efficient.

### Key Panels
- assigned request card
- navigation map
- patient details
- trip status actions
- live route information

### Visual Priorities
- route clarity
- one primary action at a time
- large pickup CTA
- compact operational info

---

## 9.4 Admin Dashboard
The admin dashboard should feel like a control center.

### Key Panels
- request queue
- active ambulances
- priority scoring panel
- GA allocation result
- analytics charts
- manual action controls

### Visual Priorities
- density without clutter
- clear sorting
- fast scanning
- strong hierarchy

---

# 10. Map UI Design

The map is one of the most important parts of the product.

## Map Rules
- full-width or dominant panel
- dark map theme if supported
- custom monochrome markers
- route line in subtle contrast
- live movement indicator
- ETA overlay
- distance overlay

## Map Elements
- patient pin
- ambulance pin
- hospital pin
- route line
- status badge
- mini legend

## Map Behavior
- animate marker movement
- highlight selected ambulance
- allow focus/zoom
- support route re-centering

---

# 11. Data Display Style

This product is data-heavy, so data design matters.

## Use Metrics Cards For
- total requests
- active ambulances
- average response time
- critical requests
- completed trips
- pending assignments

## Use Charts For
- hourly demand
- response time trend
- ambulance utilization
- priority distribution
- city hotspot pattern

## Use Timelines For
- request received
- priority assigned
- ambulance dispatched
- ambulance en route
- patient picked up
- trip completed

---

# 12. Component Library

## Reusable Components
- `AppShell`
- `Sidebar`
- `Topbar`
- `StatCard`
- `PriorityBadge`
- `RequestCard`
- `AmbulanceCard`
- `HospitalCard`
- `AssignmentCard`
- `LiveMap`
- `RoutePanel`
- `Timeline`
- `AnalyticsChart`
- `DataTable`
- `FilterBar`
- `SearchInput`
- `ConfirmDialog`
- `StatusStepper`

## Design Requirement
Every component should follow the same:
- spacing
- typography
- border system
- grayscale theme
- motion language

---

# 13. 3D / Premium Visual Prompt Direction

If 3D visuals or generated illustrations are used, they should stay within the same visual system.

## 3D Style Rules
- monochrome 3D only
- soft lighting
- reflective black surfaces
- minimal scene clutter
- no colorful sci-fi neon
- clean product-render aesthetic

## Suitable 3D Assets
- ambulance product renders
- dashboard isometric panels
- emergency route diagrams
- hospital architecture blocks
- abstract data tunnels
- city map slabs

## Prompt Style Direction
The prompts should describe:
- black matte surfaces
- grayscale lighting
- minimal futuristic medical technology
- premium SaaS presentation
- strong shadows
- glass-like dark panels
- clean technical realism

---

# 14. File Structure for UI Implementation

```text
frontend/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (patient)/
│   │   ├── (ambulance)/
│   │   ├── (admin)/
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── maps/
│   │   ├── charts/
│   │   └── animations/
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   ├── hooks/
│   ├── types/
│   └── styles/
│
└── public/
    ├── icons/
    ├── illustrations/
    └── animations/
```

---

# 15. Page Flow Structure

## User Journey Flow
1. User opens landing page
2. User logs in or registers
3. User lands in role-specific dashboard
4. Patient creates emergency request
5. System allocates ambulance
6. Live tracking starts
7. Trip completes
8. Admin reviews analytics

## Dashboard Flow
- dashboard home
- active task screen
- detailed modal or drawer
- tracking panel
- final completion state

---

# 16. Empty States and Loading States

## Empty States
Use elegant minimal illustrations or monochrome placeholders.

Examples:
- no active emergency
- no ambulances online
- no assignments yet

## Loading States
Use:
- skeleton cards
- loading bars
- pulsing dots
- subtle shimmer on panels

Do not over-animate loading.

---

# 17. Accessibility Rules

The design must remain accessible.

## Requirements
- strong contrast
- readable text sizes
- keyboard navigation
- focus states
- screen-reader-friendly labels
- reduced-motion support

## Practical Rules
- do not depend only on color
- use icons and text with status indicators
- maintain legible font sizes on mobile

---

# 18. Responsive Design Rules

## Desktop
- multi-panel dashboard
- visible sidebar
- map + detail split views

## Tablet
- collapsible sidebar
- stacked cards
- responsive map panels

## Mobile
- bottom navigation or compact sidebar
- single-column layouts
- full-screen tracking view
- simplified action buttons

---

# 19. Design Quality Checklist

Before finalizing the UI, ensure:
- the theme is strictly monochrome
- there is no visual noise
- cards are aligned consistently
- map panels are polished
- motion is subtle
- typography is consistent
- dashboards are easy to scan
- the product feels premium and serious

---

# 20. Final Design Vision

The final product should look like a **high-end emergency operations platform** with:

- black monochrome visual identity
- shadcn component consistency
- elegant animations through Framer Motion
- strong dashboard hierarchy
- map-driven live tracking
- premium product feel
- professional presentation quality

This is not just a student project UI.  
It should feel like a **real operational system** built for speed, clarity, and trust.
