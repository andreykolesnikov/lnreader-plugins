# LNReader Plugins - Agent Guidelines

This repository hosts plugins for LNReader, a novel reading app. All agents working here should understand the plugin system and follow the codebase conventions.

## Development Commands

### Primary Commands

- `npm run dev:start` - Full development workflow (builds multisrc plugins, generates index, starts dev server at localhost:3000)
- `npm run dev` - Start Vite dev server only
- `npm run build:compile` - Compile TypeScript (uses `tsconfig.production.json`)
- `npm run build:full` - Complete build: clean, build multisrc, compile, generate manifest
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Verify formatting without changes

### Plugin-Specific Commands

- `npm run build:multisrc` - Generate individual plugin files from multisrc templates
- `npm run build:icons` - Download and generate plugin icons
- `npm run clean:multisrc` - Remove generated multisrc plugin files
- `npm run check:sites` - Verify plugin sites are accessible

### Testing

**No automated tests exist.** Test plugins using the web interface:

1. Run `npm run dev:start`
2. Open http://localhost:3000
3. Use the interactive UI to test plugin functionality
4. Verify parsing of novels, chapters, and search results

## Code Style Guidelines

### TypeScript Configuration

- Target: ES5 (for React Native Hermes compatibility)
- Module: ES2020 with Bundler resolution
- Strict mode enabled
- Always use `type` keyword (enforced by linter: `@typescript-eslint/consistent-type-definitions`)

### Import Rules

- **CRITICAL**: Always use `@libs/fetch` - never `@/lib/fetch` (restricted import enforced by ESLint)
- Path aliases:
  - `@/*` → `./src/*`
  - `@plugins/*` → `./plugins/*`
  - `@libs/*` → `./src/libs/*`
- Standard imports:
  ```typescript
  import { fetchApi, fetchText, fetchFile } from '@libs/fetch';
  import { Plugin } from '@/types/plugin';
  import { Filters, FilterTypes } from '@libs/filterInputs';
  import { NovelStatus } from '@libs/novelStatus';
  import { Cheerio, load as parseHTML } from 'cheerio';
  import dayjs from 'dayjs';
  import { storage } from '@libs/storage';
  ```

### Formatting (Prettier)

- 2 spaces indentation (no tabs)
- Single quotes
- Trailing commas
- `arrowParens: 'avoid'` - Omit parens when possible
- `bracketSameLine: false` - JSX closing bracket on new line

### Linting Rules

- `@typescript-eslint/no-explicit-any: warn` - Avoid `any`, but allowed as warning
- `@typescript-eslint/no-unused-vars: warn` - Unused vars are warnings, not errors
- `@typescript-eslint/ban-ts-comment: off` - `@ts-ignore` allowed
- `no-undef: error` - All variables must be declared
- `no-case-declarations: warn` - Case block declarations are warnings
- Files with square brackets in names (e.g., `PluginName[source].ts`) are excluded from linting

### Naming Conventions

- Plugin classes: PascalCase (e.g., `FreeWebNovelPlugin`, `MadaraPlugin`)
- Constants: PascalCase (e.g., `NovelStatus`, `defaultCover`)
- Functions/variables: camelCase
- Plugin files: lowercase with hyphens or brackets (e.g., `freewebnovel.ts`, `DragonTea[madara].ts`)

### Plugin Structure

**Required properties:**

```typescript
class MyPlugin implements Plugin.PluginBase {
  id = 'unique.id';
  name = 'Plugin Name';
  site = 'https://example.com/';
  version = '1.0.0';
  icon = 'path/to/icon.png'; // Relative, no "static" prefix

  async popularNovels(pageNo: number, options): Promise<Plugin.NovelItem[]>;
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel>;
  async parseChapter(chapterPath: string): Promise<string>;
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]>;
}
```

**Optional properties:**

- `filters: Filters` - Search/filter options
- `customJS` / `customCSS` - Custom scripts/styles
- `imageRequestInit` - Custom headers for images
- `webStorageUtilized: boolean` - Requires localStorage/sessionStorage
- `resolveUrl` - Custom URL resolution

**Export pattern:**

```typescript
const plugin = new MyPlugin();
export default plugin;
```

### HTML Parsing

- Prefer Cheerio over htmlparser2 (cleaner API)
- For htmlparser2: define parsing states as enum
- Both approaches common in codebase - match existing plugin style

### Error Handling

- Throw descriptive errors with context: `throw new Error('Could not reach site (${result.status})')`
- Handle network errors gracefully
- Check `result.ok` before `result.text()`

### Date Handling

- Use dayjs for all date operations
- Output format: `dayjs().format('LL')` or 'YYYY-MM-DD' for `releaseTime`
- Parse relative dates (e.g., "2 hours ago") to absolute dates

### Storage

- `storage.get(key)` - Retrieve stored value
- `storage.set(key, value)` - Store value
- Use for plugin settings and user preferences

### Type Safety

- Never suppress type errors with `as any` unless absolutely necessary
- Use `Plugin.NovelItem`, `Plugin.SourceNovel`, `Plugin.ChapterItem` types
- Leverage TypeScript's inference where possible

### Multisrc Plugins

- Templates in `plugins/multisrc/{source-name}/template.ts`
- Generated plugins follow `[PluginName][sourceName].ts` pattern
- Sources defined in `sources.json` with metadata (id, sourceName, sourceSite, options, filters)
- Icons generated via `npm run build:icons` or manually added

### Version Management

- Format: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`, `2.2.4`)
- Increment when site structure changes or functionality updates
- Multisrc templates often use versionIncrements: `1.0.${8 + increments}`

### Icon Guidelines

- Size: 96x96px
- Path structure:
  - Single plugin: `icons/src/{lang}/{plugin-name}/icon.png`
  - Multisrc: `public/static/multisrc/{source-name}/{plugin-id}/icon.png`
- Plugin icon path is relative (no "static" prefix)

### Notes

- Node.js >= 20 required
- Plugins support multiple languages (organized in language folders: english, french, chinese, etc.)
- No automated testing - manual testing via web interface required
- Git hooks configured via husky (runs on pre-commit)
- lint-staged runs prettier on staged files
