# Cuaderno
App de notas tipo Notion: páginas de bloques (Markdown, imágenes, dibujo, voz, LaTeX)
y "cuadernos orgánicos" (tablero con post-its, montones y modo cuaderno).

- Especificación completa: docs/SPEC.md. Prototipo de referencia: prototype/cuaderno-completo.html
  (abrirlo para copiar comportamiento y estilo, no su código).
- Monorepo: apps/web (React + TS + Vite), apps/api (FastAPI), packages/shared.
- Interfaz en español. Local-first: todo funciona sin conexión (Dexie).
- Trabajar solo en la fase pedida. Cada fase termina con pruebas que pasan
  (Vitest / Playwright / pytest) y una lista de lo que quedó hecho.
- Nunca guardar imágenes ni audio en base64 dentro de los documentos: usar archivos (Blob) con fileId.
- Probar siempre en 1366×900 y en 390×844 con touch.