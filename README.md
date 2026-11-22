# Cuaderno

App de notas local-first. Especificación: [docs/SPEC.md](docs/SPEC.md).

## Requisitos

- Node.js 20.19+ (probado con 26 LTS)
- Python 3.11+

## Primeros pasos

```sh
npm install
npm run setup:api                          # crea apps/api/.venv e instala FastAPI + pytest
npx -w @cuaderno/web playwright install chromium   # solo para pruebas e2e
```

## Scripts (desde la raíz)

| Script              | Qué hace                                           |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | App web en http://localhost:5173                   |
| `npm run dev:api`   | API en http://localhost:8000 (uvicorn con recarga) |
| `npm test`          | Comprueba los tipos de `packages/shared` + Vitest  |
| `npm run test:api`  | pytest de la API                                   |
| `npm run test:e2e`  | Playwright en 1366×900 y 390×844 con touch         |
| `npm run test:all`  | Todo lo anterior                                   |
| `npm run build`     | Comprueba tipos y genera `apps/web/dist`           |
| `npm run typecheck` | `tsc` en todos los paquetes                        |
| `npm run lint`      | ESLint                                             |
| `npm run format`    | Prettier (`format:check` para solo verificar)      |

## Estructura

```text
apps/web         React + TS + Vite + Tailwind + Zustand + Dexie
apps/api         FastAPI + pytest
packages/shared  Tipos del modelo de datos (@cuaderno/shared)
```
