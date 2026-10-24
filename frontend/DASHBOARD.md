# ThinkNet Frontend - Dashboard Workspace

This is the core dashboard shell for ThinkNet. All features (Build, Data, Train, Evaluate, Deploy, Agents) wrap around this unified workspace.

## Structure
- `index.html` - Main dashboard layout matching the industry-grade design
- `styles.css` - Dark theme design system
- `app.js` - Core interaction logic

## Next Steps
1. Initialize Tauri v2 around this frontend
2. Implement the node graph with real connections (SVG/Canvas)
3. Add module switching for Data / Train / Evaluate / etc.
4. Connect to Rust backend for IPC
5. Integrate Python AI processes for compute estimation, training, etc.

## Design System
- Dark theme with accent purple (#7c5cfc)
- Node-based visual architecture builder
- Consistent panels, toolbars, and states
- 60 FPS target with CSS transforms

## Running (for development)
Open `index.html` in a browser, or serve with:
```
npx serve .
```
