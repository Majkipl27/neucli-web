# Neucli Web

Visual editor for Neucli configurations. Build and manage your CMS structures with an intuitive drag-and-drop interface.

## Overview

Neucli Web provides the frontend interface for managing block-based configurations. It allows users to visually arrange nodes, edit properties, and export the resulting configuration to YAML.

## Tech Stack

- Framework: React 18
- Build Tool: Vite
- Language: TypeScript
- Styling: Tailwind CSS
- Data Handling: js-yaml

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

An architectural rewrite is in progress. See `NOTES.md` for the current plan,
known UX issues, and the block-registry contract.

The target layout is:

- `src/document/`: document types, zod schema, pure tree operations, commands, YAML I/O.
- `src/store/`: zustand stores (document with undo/redo, selection, UI).
- `src/blocks/`: one `*.block.tsx` file per block type; auto-registered.
- `src/shell/`: editor chrome (Toolbar, LeftSidebar, Canvas, RightPanel, YamlDrawer).
- `src/tailwind/`: shared className-token primitives.

Until Phase 3 lands, legacy files in `src/editor/` still render the editor.

## License

Private.
