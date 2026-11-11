# Neucli Web

Visual editor for Neucli configurations. Build and manage your CMS structures with an intuitive drag-and-drop interface.

## Overview

Neucli Web provides the frontend interface for managing block-based configurations. It allows users to visually arrange nodes, edit properties, and export the resulting configuration to YAML.

## Tech Stack

- Framework: React 19
- Build Tool: Vite
- Language: TypeScript
- Styling: Tailwind CSS
- Data Handling: yaml, with validation from `neucli/core`

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
pnpm i
```

### Development

Run the development server:

```bash
pnpm dev
```

### Building for Production

Create an optimized production build:

```bash
pnpm build
```

## Project Structure

The editor reads and writes the same YAML format as the CLI. The format, its validation and every class decision come from the CLI repo as `neucli/core`, linked from `../neucli`, so clone both repos side by side. The plan lives in `../neucli/ROADMAP.md`.

- `src/document/`: types, tree operations (paths reach into named slots), commands, YAML import/export, insert palette, bundled examples, breakpoint-aware style reads/writes (`style.ts`), detach (`detach.ts`), theme token references (`tokens.ts`), component authoring (`components.ts`: create from selection, rename, props, text binding, presets, layouts), interactions (`interactions.ts`: state in scope, state styles) and `scope.ts`, which lets the canvas edit a page or a main component through the same paths.
- `src/store/`: zustand stores (document with undo/redo, selection, UI) and `useValidated`, the document as core validates it.
- `src/canvas/`: the page rendered in an iframe with Tailwind v4 compiled in the browser, and the selection/hover overlay. Preview runs the page's interactions with neucli/core's action and condition helpers.
- `src/panel/`: the auto layout panel (`StylePanel`), the Interactions section (state, previewed values, actions, visibleWhen, state styles) and their controls: scrubbable number fields, segmented buttons, the color picker.
- `src/shell/`: editor chrome (Toolbar, LeftSidebar, LayerTree, Canvas, RightPanel, YamlDrawer), the component panel and the Create component dialog.

## License

MIT. See `LICENSE`.
