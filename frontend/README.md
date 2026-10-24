# ThinkNet Frontend (Next.js + TypeScript)

Core dashboard workspace. All features wrap around this single shell.

## Tech
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**

## Structure
- `src/app/page.tsx` — Dashboard (Build view with node graph)
- `src/app/layout.tsx` — Root layout
- `src/app/globals.css` — Design tokens

## Development
```bash
cd frontend
npm install
npm run dev
```

## Next
- Extract components (Nav, Canvas, Node, Properties panel)
- Add real node connections (SVG)
- Section routing (Data / Train / Evaluate / etc.)
- Tauri v2 integration
