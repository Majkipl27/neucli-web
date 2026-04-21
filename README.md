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

Create an optimized manufacturing build:

```bash
pnpm build
```

## Project Structure

- `src/editor/`: Core editing components (Canvas, Toolbars, Sidebars).
- `src/editor/PreviewCanvas.tsx`: High-fidelity preview of the current configuration.
- `src/editor/YamlDrawer.tsx`: Direct YAML manipulation and export.
- `src/editor/types.ts`: Centralized type definitions for nodes and configurations.

## License

Private.
