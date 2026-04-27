# Modern Editor Setup Instructions

## Installation Complete ✓

The modern AI text editor has been successfully installed with all dependencies:

- Tailwind CSS
- Radix UI components (Dropdown Menu, Tooltip, Separator)
- Lucide React icons
- TipTap extensions (Text Align, Underline, Highlight, Task List)

## Running the Application

### Development Mode

To run the application in development mode:

```bash
cd apps/lacon-desktop
pnpm dev
```

This will start the Electron app with hot-reload enabled.

### Building the Application

To build the application for production:

```bash
# From the root directory
pnpm build

# Or just the desktop app
pnpm build:app
```

### Packaging the Application

To create distributable packages:

```bash
# Windows
pnpm package:app:win

# macOS
pnpm package:app:mac

# Or just create a directory build
pnpm package:app
```

## Known Issues & Solutions

### TypeScript Errors During Build

If you encounter TypeScript errors about missing exports from `@tiptap/react`, this is because the workspace packages need to be built first:

```bash
# Build all packages from root
pnpm build
```

### Path Alias Issues

The project uses TypeScript path aliases (`@/renderer/*`, etc.). These are configured in:
- `tsconfig.json` - for TypeScript
- `vite.config.ts` - for Vite bundler

If you see "Cannot find module '@/renderer/lib/utils'" errors, ensure both configs have matching path aliases.

## Toggling Between Old and New Editor

In `src/renderer/App.tsx`, you can toggle between the old and new editor:

```tsx
// Set to true for modern editor, false for old editor
const [useModernEditor, setUseModernEditor] = useState(true)
```

## File Structure

```
apps/lacon-desktop/
├── src/renderer/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── DropdownMenu.tsx
│   │   │   └── Tooltip.tsx
│   │   ├── ModernEditor.tsx      # Main editor component
│   │   └── ModernEditorDemo.tsx  # Demo wrapper
│   ├── lib/
│   │   └── utils.ts         # Utility functions
│   └── styles/
│       └── globals.css      # Tailwind + custom styles
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
└── docs/
    └── MODERN_EDITOR.md     # Detailed documentation
```

## Next Steps

1. Run `pnpm dev` from `apps/lacon-desktop` directory
2. The modern editor should load automatically
3. Test all toolbar features:
   - AI Toolkit dropdown
   - Zoom controls
   - Headings and lists
   - Text formatting (bold, italic, etc.)
   - Text alignment
   - Floating AI input at bottom

## Customization

See `docs/MODERN_EDITOR.md` for detailed customization options including:
- Zoom levels
- Page dimensions
- Color scheme
- Editor extensions
- Styling

## Troubleshooting

### Editor Not Loading

1. Check browser console for errors
2. Ensure all dependencies are installed: `pnpm install`
3. Clear cache: `rm -rf node_modules/.vite`

### Styling Issues

1. Ensure Tailwind is processing correctly
2. Check that `globals.css` is imported in `main.tsx`
3. Verify PostCSS config is correct

### TypeScript Errors

1. Run type check: `pnpm typecheck`
2. Ensure all path aliases are configured
3. Build workspace packages if needed: `pnpm build` from root

## Support

For more information, see:
- `docs/MODERN_EDITOR.md` - Detailed editor documentation
- `README.md` - General project documentation
- TipTap docs: https://tiptap.dev
- Tailwind docs: https://tailwindcss.com
- Radix UI docs: https://www.radix-ui.com
