# Cuaderno — especificación para construir con Claude Code

Nov 22, 2026 · @martin

## Cómo usar este documento

Cuaderno es una app de notas tipo Notion, más libre y personalizable: páginas con bloques Markdown, dictado por voz, dibujo con lápiz, imágenes y LaTeX, más un tipo de página propio, el **cuaderno orgánico**, donde las notas se pegan como post-its alrededor de un tema central, se mueven libremente y se apilan en cuadernos que se hojean. Debe funcionar en PC, tablet y celular.

El prototipo funcional (`cuaderno-completo.html`, un solo archivo) es la referencia de comportamiento y estilo: ante cualquier duda, Claude Code debe abrirlo y copiar cómo se comporta, no cómo está programado.

Pasos para trabajar con Claude Code:

1. Crea el repositorio vacío `cuaderno/` y copia el prototipo en `prototype/cuaderno-completo.html`.
2. Exporta este documento a Markdown y guárdalo como `docs/SPEC.md`.
3. Crea `CLAUDE.md` en la raíz con el texto de la sección *Plan por fases* (bloque "CLAUDE.md inicial").
4. Abre Claude Code en la carpeta y pega el prompt de la **Fase 0**. Avanza una fase por sesión.
5. Al cerrar cada fase, revisa los criterios de aceptación, prueba en el navegador del PC y en el celular, y haz un commit antes de seguir.

Regla de oro para Claude Code: construir por fases pequeñas y verificables, con pruebas, sin adelantar funciones de fases siguientes.

## Stack técnico y estructura

Una sola app web en React + TypeScript, instalable como PWA y empaquetada después con Capacitor (Android/iOS) y Tauri (PC). Backend en FastAPI. La app es *local-first*: todo se guarda primero en el dispositivo y después se sincroniza.

| Capa | Elección | Para qué |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Una base de código para todas las pantallas |
| Estilos | Tailwind CSS + variables CSS | Temas, acento y fuentes configurables |
| Estado | Zustand | Estado global simple (página actual, ajustes) |
| Base local | Dexie (IndexedDB) | Páginas, notas, imágenes y audio sin conexión |
| Editor de bloques | TipTap (ProseMirror) con extensiones propias | Markdown, menú /, bloques personalizados |
| LaTeX | KaTeX + extensión mhchem | Fórmulas en bloque y en línea, química |
| Dibujo | Canvas propio + perfect-freehand | Trazos con presión del lápiz |
| Gestos | Pointer Events (+ @use-gesture/react opcional) | Arrastre libre y deslizar entre notas |
| Voz | MediaRecorder + Web Speech API; Whisper en el backend | Grabar y transcribir |
| Backend | FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL | API, cuentas y sincronización |
| Archivos | Almacenamiento S3 compatible (MinIO en local) | Imágenes y audios |
| Transcripción | faster-whisper | Audio a texto en español |
| Empaquetado | vite-plugin-pwa, Capacitor, Tauri | Celular, tablet y PC |
| Pruebas | Vitest, Playwright, pytest | Unidad, extremo a extremo y API |

&#91;embedded content: arquitectura · dispositivo y servidor\]

La app nunca espera al servidor: escribe en Dexie y la cola sube los cambios cuando hay red; el servidor solo guarda, entrega archivos y transcribe.

Estructura del repositorio (monorepo):

```text
cuaderno/
├─ CLAUDE.md
├─ docs/SPEC.md                 ← este documento
├─ prototype/cuaderno-completo.html
├─ apps/
│  ├─ web/                      ← React + Vite
│  │  └─ src/
│  │     ├─ app/                ← rutas, layout, barra lateral
│  │     ├─ features/
│  │     │  ├─ pages/           ← editor de bloques
│  │     │  ├─ organic/         ← tablero, notas, lector, montones
│  │     │  ├─ drawing/         ← lienzo y miniaturas
│  │     │  ├─ math/            ← KaTeX, editor y plantillas
│  │     │  ├─ voice/           ← dictado y grabación
│  │     │  └─ settings/        ← temas y estilos
│  │     ├─ lib/                ← db (Dexie), sync, markdown, imágenes
│  │     └─ components/ui/
│  └─ api/                      ← FastAPI
│     └─ app/ (main.py, models/, routers/, services/)
└─ packages/shared/             ← tipos y esquemas compartidos
```

## Modelo de datos

Cada página es un documento JSON con versión; hay dos tipos, `page` (bloques) y `organic` (tablero). Las imágenes y audios se guardan como archivos aparte y el documento solo guarda su `fileId`, nunca el contenido en base64.

```ts
// Coordenadas lógicas de dibujo: ancho fijo 1000, alto = h. Punto = [x, y, presión 0..1]
type Stroke = { t: 'pen' | 'hl'; c: string /* 'ink' o color hex */; w: number; pts: [number, number, number][] };

type Block =
  | { id: string; type: 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'num' | 'quote' | 'code'; html: string }
  | { id: string; type: 'todo'; html: string; checked: boolean }
  | { id: string; type: 'math'; tex: string }                      // LaTeX en bloque
  | { id: string; type: 'img'; fileId: string; cap: string; size: 's' | 'm' | 'l' }
  | { id: string; type: 'draw'; strokes: Stroke[]; h: number }
  | { id: string; type: 'divider' }
  | { id: string; type: 'link'; pageId: string };                  // enlace a subpágina
// LaTeX en línea dentro de html: <span class="tex" data-tex="E=mc^2"></span>

type PageBase = { id: string; parentId: string | null; title: string; icon: string;
                  createdAt: string; updatedAt: string; version: number; deletedAt?: string };
type Page = PageBase & { kind: 'page'; blocks: Block[] };

type Center = {
  mode: 'text' | 'draw' | 'image';
  html: string;                         // modo texto
  strokes: Stroke[]; h: number;         // modo lápiz
  fileId?: string; imgMode: 'postal' | 'fondo'; cap: string;   // modo imagen
  bgFileId?: string; bgScope: 'hoja' | 'tablero'; bgDim: number; // fondo de la hoja (texto/lápiz), bgDim 0..0.75
};

type Note = {
  id: string; kind: 'md' | 'voice' | 'draw' | 'img'; title: string;
  color: 'amarillo' | 'rosa' | 'menta' | 'cielo' | 'lila' | 'papel';
  x: number; y: number;   // posición normalizada 0..1 del centro de la tarjeta en el tablero
  g: string;              // grupo: notas con el mismo g forman un montón (nota suelta: g = id)
  blocks?: Block[];                                  // md (puede incluir math, img, draw)
  strokes?: Stroke[]; h?: number;                    // draw
  fileId?: string; cap?: string;                     // img
  audioFileId?: string; dur?: number; text?: string; // voice
  createdAt: string;
};

type OrganicStyle = { bg: 'pizarra' | 'corcho' | 'papel' | 'noche' | 'menta'; ink: string;
                      font: 'mano' | 'marcador' | 'limpia' };
type OrganicPage = PageBase & { kind: 'organic'; center: Center; notes: Note[]; style: OrganicStyle };

type Settings = { skin: 'auto' | 'light' | 'dark' | 'sepia'; accent: string; font: 'sans' | 'serif' | 'mono';
                  size: 's' | 'm' | 'l'; width: 'normal' | 'wide'; lang: 'es-CL' | 'es-ES' | 'es-MX' | 'en-US';
                  penOnly: boolean };
```

Reglas del modelo:

- El orden del arreglo `notes` es el orden de navegación del lector y el orden de las hojas dentro de un montón.
- Las posiciones `x, y` son relativas al tablero, así la distribución se ve igual en PC y celular.
- Todas las notas de un montón comparten `x, y`; al apilar, las notas movidas se reubican justo después de la última del montón destino.
- El color `'ink'` en un trazo significa "el color de tinta actual" y se resuelve al dibujar.

## Editor de páginas

El editor de páginas funciona como Notion: bloques que se crean escribiendo Markdown o desde el menú `/`, con imágenes, dibujo, voz y LaTeX como bloques más.

| Función | Comportamiento esperado |
| --- | --- |
| Páginas y subpáginas | Árbol en la barra lateral, expandible; crear, duplicar, eliminar (con confirmación y subpáginas); icono emoji y título editables; migas de pan arriba |
| Atajos Markdown al inicio de línea | `#`, `##`, `###` + espacio = títulos; `-`, `*` = lista; `1.` = numerada; `[]` o `[x]` = tarea; `>` = cita; ```` ``` ```` = código; `---` = separador; `$$` = ecuación |
| Formato en línea | `**negrita**`, `*cursiva*`, `` `código` ``, `~~tachado~~`, `[texto](url)` y `$fórmula$` se convierten al salir del bloque; Ctrl+B / Ctrl+I |
| Menú `/` | Se abre al escribir `/` en un párrafo vacío, filtra sin tildes, flechas + Enter; incluye todos los bloques, voz y subpágina |
| Teclado | Enter divide el bloque (las listas continúan; lista vacía + Enter = párrafo); Backspace al inicio convierte a párrafo o une con el anterior; flechas saltan entre bloques |
| Pegar | Texto con varias líneas se convierte en bloques desde Markdown (incluye `$$...$$`); pegar una imagen crea un bloque de imagen |
| Imágenes | Subir, cámara (en celular), pegar o arrastrar; se reducen a máx. 1600 px (JPEG 85 %); pie editable; tamaño pequeño / mediano / completo |
| Dibujo | Lápiz con presión, resaltador, borrador por trazo, 6 colores (el primero = tinta del tema), grosor 1–12, deshacer, borrar todo, "más espacio"; opción "solo el lápiz dibuja" |
| Dictado | Botón Voz: reconocimiento continuo en el idioma elegido, texto provisional en una burbuja, el texto final se agrega al bloque activo |
| Ecuación LaTeX (bloque) | Vista renderizada; al tocarla se abre el editor: código con vista previa en vivo, 22 botones de símbolos que dejan el cursor en el hueco, Plantillas, Ctrl+Enter o Esc para terminar |
| Fórmula en línea | `$...$` dentro del texto; se muestra como fórmula atómica; al tocarla se abre un editor pequeño con vista previa, Listo y Quitar. `$500 y $300` no se convierte |
| Opciones de bloque | Asa a la izquierda: convertir en otro tipo, mover arriba/abajo, duplicar, eliminar |
| Buscar | Busca en títulos y contenido de todas las páginas, incluidas notas orgánicas y código LaTeX |
| Exportar | Copiar la página como Markdown; LaTeX como `$...$` y `$$...$$` |

Plantillas LaTeX incluidas: fórmula cuadrática, matriz 2×2, sistema de ecuaciones, pasos alineados, derivada, integral definida, límite, sumatoria, probabilidad condicional y química (`\ce{2H2 + O2 -> 2H2O}`).

## Cuaderno orgánico

El cuaderno orgánico es un tablero con un tema central y notas tipo post-it alrededor, que el usuario mueve libremente, apila en montones y recorre como un cuaderno. Sirve para asociar notas a un concepto o evento con un estilo menos sobrio.

**Tablero**

- El centro queda fijo en la mitad del tablero. Cada nota (o montón) se une al centro con una línea curva en el color de tinta, terminada en un punto.
- Proporciones: tablero de alto = 62 % del ancho (entre 560 y 900 px) en pantallas anchas, y 1,5 veces el ancho en celular. Tarjeta de 17 % del ancho (entre 112 y 200 px), alto = 0,88 × ancho. Centro de 38 % del ancho (máx. 440 px; 60 % en celular).
- Tarjetas: color post-it, cinta adhesiva arriba, leve rotación fija por nota (–3° a 3°), icono del tipo, título en la letra del cuaderno y número de orden. Vista previa según el tipo: texto (5 líneas), fórmula renderizada, onda de audio + duración + transcripción, miniatura del dibujo o foto.
- Botón "+" en la esquina y barra inferior: Nota, LaTeX, Voz, Lápiz, Imagen y Estilo. Arrastrar imágenes sobre el tablero crea notas de imagen.
- Las notas nuevas se ubican en el primer espacio libre de un anillo de posiciones: primero las cuatro esquinas, luego arriba, abajo, izquierda y derecha. "Reacomodar en círculo" las reparte de nuevo.

**Centro**

- Tres modos: Texto (letra grande manuscrita, levemente rotada), Lápiz (lienzo) o Imagen (como postal con borde blanco y texto, o de fondo de todo el tablero).
- En modo Texto o Lápiz se puede poner una imagen de fondo: "Solo la hoja" (tarjeta con la imagen y el texto encima, con sombra) o "Todo el tablero", con un deslizador para oscurecerla (0–75 %, por defecto 25 %). En modo Lápiz se dibuja sobre la foto y la miniatura respeta la posición real de los trazos.

**Arrastre libre y montones**

- Con mouse o lápiz se arrastra directo (desde 6 px de movimiento). Con el dedo: mantener presionado 240 ms y luego arrastrar; un deslizamiento rápido sigue desplazando la página.
- Si al soltar el centro de la tarjeta queda a menos de 0,55 × su ancho de otra, se apilan; la de destino se marca con borde punteado mientras se arrastra.
- Un montón muestra la nota de arriba, hasta dos hojas asomando detrás con sus colores y un contador con el número de hojas. El montón entero se puede mover.

**Lector**

- Tocar el centro o una nota suelta abre el lector: recorre centro → nota 1 → nota 2 → … y vuelve al centro (cíclico). Se avanza con botones, deslizando el dedo (más de 70 px), flechas del teclado o puntos de navegación.
- En cada nota se puede editar el título, cambiar el color, moverla antes o después en el orden y eliminarla (con confirmación).
- Editor según tipo: Markdown usa el mismo editor de bloques de las páginas; Lápiz usa el lienzo con los colores del tablero; Imagen permite cambiar la foto y escribir una descripción; Voz permite grabar (con transcripción en vivo), subir un audio (máx. 15 MB), quitarlo y editar la transcripción.

**Modo cuaderno (al abrir un montón)**

- Solo recorre las hojas del montón ("Hoja 2 de 3").
- Aspecto de cuaderno de colegio: papel crema `#fffdf6` liso, sin líneas guía ni margen, con anillos de espiral a la izquierda.
- Todo el texto escrito usa la misma letra que los títulos del cuaderno (manuscrita por defecto), en 1,4 em; los títulos de bloque van más grandes y el código sigue en monoespaciada.
- Al pasar de hoja, una hoja gira 180° sobre el borde izquierdo (0,6 s) mostrando el título de la hoja anterior. Sin animación si el sistema pide movimiento reducido.
- Botón "Sacar del montón": deja la nota suelta al lado. Si queda una sola hoja, el lector se cierra.

## Personalización y diseño adaptable

Hay dos niveles de personalización: la apariencia general de la app (botón "Aa") y el estilo propio de cada cuaderno orgánico (botón Estilo).

**Apariencia general**

- Tema: Automático, Claro, Oscuro o Sepia. Acento: `#3b5bdb`, `#0c8599`, `#2b8a3e`, `#e8590c`, `#d6336c`, `#7048e8`.
- Fuente del documento: Sans (Inter), Serif (Literata) o Mono (JetBrains Mono). Tamaño de texto: 15, 16 o 18 px. Ancho de página: normal (760 px) o ancho (1120 px).
- Idioma del dictado: es-CL, es-ES, es-MX o en-US. Opción "Solo el lápiz dibuja".

**Estilo de cada cuaderno orgánico**

| Fondo | Color de fondo | Tinta por defecto | Textura |
| --- | --- | --- | --- |
| Pizarra | `#1b1b1b` | `#ffb43f` | Ninguna |
| Corcho | `#b98b5d` | `#3a2412` | Grano de puntos claros y oscuros |
| Papel | `#f6f1e4` | `#2f4ba0` | Puntos cada 22 px |
| Noche | `#16163d` | `#ffd3e6` | Dos resplandores suaves |
| Menta | `#dff6ec` | `#0b6e52` | Ninguna |

- Tintas elegibles: `#ffb43f`, `#f4f4f4`, `#ff6b6b`, `#ffd3e6`, `#2f4ba0`, `#0b6e52`, `#3a2412`, `#1b1b1b`. Al cambiar el fondo, la tinta vuelve a la de ese fondo.
- Letra: Manuscrita (Caveat), Marcador (Patrick Hand) o Limpia (Inter).
- Colores de post-it: amarillo `#ffe27a`, rosa `#ffb8d2`, menta `#a3f0d6`, cielo `#acd8ff`, lila `#d7c8ff`, papel `#fff8ea`. Las notas nuevas los van rotando.

**Adaptación a pantallas**

- Más de 860 px: barra lateral fija de 264 px. Menos de 860 px: la barra lateral es un cajón que se abre con ☰ y se cierra tocando fuera.
- Menos de 600 px: tarjetas con letra más chica (título 16 px, texto 12 px) y sin número; el lector ocupa toda la pantalla.
- Barra de bloques flotante abajo, con desplazamiento horizontal si no cabe; respeta las zonas seguras (`env(safe-area-inset-*)`).
- Zonas táctiles de al menos 44 px, inputs de 16 px (evita el zoom en iOS), foco visible.
- Respetar `prefers-reduced-motion`.
- Las fuentes (Inter, Literata, JetBrains Mono, Caveat, Patrick Hand) y KaTeX deben ir incluidas en la app, no cargadas desde internet, para que funcione sin conexión.

## Backend FastAPI

El backend guarda cada página como un documento JSON versionado (columna `jsonb` en PostgreSQL), los archivos en almacenamiento S3 compatible y transcribe audio con faster-whisper. La app sigue funcionando sin conexión y sincroniza cuando vuelve la red.

| Método y ruta | Qué hace |
| --- | --- |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` | Cuenta con correo y contraseña; tokens JWT de acceso y renovación |
| `GET /pages?since=<fecha>` | Páginas cambiadas desde la última sincronización, incluidas las eliminadas (`deletedAt`) |
| `PUT /pages/{id}` | Crea o actualiza una página; recibe `version` y responde 409 si el servidor tiene una más nueva |
| `DELETE /pages/{id}` | Borrado lógico (marca `deletedAt`) |
| `POST /files` | Sube imagen o audio (máx. 15 MB); devuelve `fileId` |
| `GET /files/{id}` | Descarga con URL firmada y solo para su dueño |
| `POST /transcribe` | Recibe un `fileId` de audio y el idioma; devuelve el texto |
| `GET /pages/{id}/export.md` | Exporta la página a Markdown |

Sincronización (versión 1, simple):

1. Cada cambio local se guarda en Dexie y se agrega a una cola de pendientes.
2. Con conexión, la cola sube los archivos primero y después las páginas.
3. Ante un 409, se descarga la versión del servidor. Si cambiaron bloques o notas distintos, se combinan por `id`; si chocan, gana la más reciente y la otra se guarda como "copia en conflicto".
4. Al abrir la app y cada 60 s se piden los cambios con `GET /pages?since=`.

Versión 2 (más adelante): edición colaborativa en tiempo real con Yjs.

Seguridad: cada usuario solo ve sus páginas y archivos; validar tamaño y tipo MIME de lo que se sube; limpiar en el servidor el HTML de los bloques con la misma lista de etiquetas permitidas que el cliente (`b, i, code, s, u, a, br, span.tex`).

## Plan por fases y prompts para Claude Code

Son 10 fases. Cada una deja algo usable y probado antes de pasar a la siguiente. Pega el prompt de la fase en Claude Code, revisa los criterios y haz commit.

**CLAUDE.md inicial** (guárdalo en la raíz del repositorio):

```markdown
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
```

1. **Fase 0: base del proyecto**

   ```text
   Lee CLAUDE.md y docs/SPEC.md. Crea el monorepo: apps/web con React + TypeScript + Vite + Tailwind + Zustand + Dexie + Vitest + Playwright, apps/api con FastAPI + pytest, y packages/shared con los tipos del modelo de datos de la sección "Modelo de datos". Agrega ESLint, Prettier y scripts para dev, test y build. Deja una página vacía que diga "Cuaderno" y una prueba que pase.
   ```

   Criterios: `npm run dev` abre la app; `npm test` y `pytest` pasan; los tipos compilan.
2. **Fase 1: páginas y editor de bloques**

   ```text
   Implementa la barra lateral con árbol de páginas y subpáginas, búsqueda, migas de pan, título e icono editables, y el editor de bloques con TipTap según la sección "Editor de páginas": atajos Markdown, formato en línea, menú /, Enter/Backspace, pegar Markdown, opciones de bloque y exportar a Markdown. Guarda todo en Dexie. Compara el comportamiento con el prototipo.
   ```

   Criterios: los atajos de la tabla funcionan; recargar no pierde nada; exportar y volver a pegar el Markdown da los mismos bloques.
3. **Fase 2: imágenes y dibujo**

   ```text
   Agrega bloques de imagen (subir, cámara, pegar, arrastrar; reducción a 1600 px; pie; tamaños) guardando los archivos como Blob en Dexie con fileId. Agrega el bloque de dibujo con canvas y perfect-freehand: coordenadas lógicas de ancho 1000, presión, resaltador, borrador por trazo, colores, grosor, deshacer, más espacio y la opción "solo el lápiz dibuja".
   ```

   Criterios: dibujar con mouse y con touch; la imagen sobrevive a una recarga; los trazos se ven igual al cambiar el ancho de la ventana.
4. **Fase 3: LaTeX**

   ```text
   Integra KaTeX y mhchem empaquetados localmente (sin CDN). Crea el bloque Ecuación (atajo $$, menú /) con editor, vista previa en vivo, 22 botones de símbolos y las plantillas listadas, y la fórmula en línea con $...$ y su editor emergente. Incluye LaTeX en la exportación y al pegar Markdown.
   ```

   Criterios: funciona sin internet; `$500 y $300` no se convierte; `\ce{H2O}` se ve bien.
5. **Fase 4: voz**

   ```text
   Agrega el dictado con Web Speech API (idioma configurable, texto provisional en burbuja, texto final al bloque activo) y un servicio de grabación con MediaRecorder reutilizable para las notas de voz. Muestra mensajes claros si el navegador no lo soporta o si el micrófono está bloqueado.
   ```

   Criterios: dictar en Chrome escritorio y Android; sin soporte aparece un aviso y nada se rompe.
6. **Fase 5: cuaderno orgánico (tablero y lector)**

   ```text
   Implementa el tipo de página organic según la sección "Cuaderno orgánico": tablero con centro (texto, lápiz, imagen postal/fondo, imagen de fondo de la hoja), tarjetas de los 4 tipos con vistas previas, líneas al centro, botón + y barra propia, y el lector con navegación cíclica, deslizar, teclado, color, orden y eliminar. Las notas Markdown usan el mismo editor de bloques.
   ```

   Criterios: crear una nota de cada tipo y recorrerlas con el dedo en celular; la imagen de fondo de la hoja se ve en el editor y en el tablero.
7. **Fase 6: arrastre libre, montones y modo cuaderno**

   ```text
   Agrega el arrastre libre con posiciones normalizadas (x, y) y espera de 240 ms en touch, el apilado por cercanía con resaltado del destino, la vista de montón con hojas asomando y contador, y el modo cuaderno: papel liso con espiral, letra del cuaderno, animación de pasar hoja y "Sacar del montón". Agrega "Reacomodar en círculo".
   ```

   Criterios: arrastrar no hace scroll y hacer scroll no arrastra; apilar 3 notas y hojearlas; la distribución se ve igual en PC y celular.
8. **Fase 7: personalización, responsive y PWA**

   ```text
   Implementa la sección "Personalización y diseño adaptable": temas, acentos, fuentes, tamaños, ancho, estilos del cuaderno orgánico y las reglas de pantalla. Incluye las fuentes localmente. Configura vite-plugin-pwa para que la app se instale y funcione sin conexión.
   ```

   Criterios: Lighthouse PWA en verde; la app abre en modo avión; los cuatro temas se leen bien.
9. **Fase 8: backend, cuentas y sincronización**

   ```text
   Implementa la API de la sección "Backend FastAPI" con PostgreSQL, Alembic, MinIO y JWT, la cola de sincronización en el cliente con manejo de 409, y /transcribe con faster-whisper. Agrega docker-compose para levantar todo en local.
   ```

   Criterios: editar en el PC y ver el cambio en el celular; editar sin red y que se sincronice al volver; un audio subido se transcribe.
10. **Fase 9: apps nativas**

    ```text
    Empaqueta la app web con Capacitor (Android e iOS) y con Tauri (Windows, macOS, Linux). Pide permisos de micrófono y cámara de forma nativa y verifica que el lápiz, el arrastre y el dictado funcionen dentro de cada app.
    ```

    Criterios: instalar en un celular Android y en el PC, y crear una nota de cada tipo.

## Lecciones del prototipo y riesgos

El prototipo resolvió el diseño; estas son las trampas que encontró y que la versión real debe evitar desde el principio.

| Tema | Lo que pasó en el prototipo | Qué hacer en la versión real |
| --- | --- | --- |
| Imágenes y audio | Se guardaban en base64 dentro del documento: pesa mucho y hace lenta la sincronización | Blob en Dexie + archivo en el servidor, referenciado por `fileId` |
| Editor | `contenteditable` hecho a mano: difícil manejar cursor, pegar y fórmulas atómicas | TipTap con extensiones propias para cada tipo de bloque |
| Micrófono | Bloqueado dentro de vistas incrustadas (iframes) | Probar voz en la app instalada o en el navegador; en Capacitor pedir el permiso nativo |
| Dictado en iOS | Web Speech API es limitada en Safari | Grabar audio y transcribir en el backend con Whisper como alternativa |
| Arrastre en touch | El arrastre competía con el scroll | Espera de 240 ms + `touch-action: pan-y` + cancelar `touchmove` solo mientras se arrastra |
| Fuentes y KaTeX | Cargados desde internet fallan sin conexión | Empaquetarlos con la app |
| Posiciones | En píxeles se descuadraban entre pantallas | Coordenadas normalizadas 0..1 (ya en el modelo) |
| Animaciones | Pueden molestar o no terminar | Respetar `prefers-reduced-motion` y quitar los elementos animados con un tiempo máximo |

Preguntas abiertas para decidir antes de la Fase 8:

- ¿Los cuadernos se podrán compartir con otras personas o son solo personales?
- ¿La transcripción con Whisper corre en tu servidor (necesita CPU o GPU) o se usa un servicio pagado?
- ¿Dónde se hospeda el backend (por ejemplo Railway, Render o un VPS)?
- ¿Se necesita reconocer la escritura a mano y convertirla a texto (ML Kit Digital Ink o MyScript)?
