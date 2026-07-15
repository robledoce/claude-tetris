# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Tetris implementado en JavaScript vanilla (HTML5 Canvas + CSS), sin dependencias, sin `package.json`, sin build ni bundler. Todo el proyecto son tres archivos: `index.html`, `style.css`, `game.js`.

## Cómo ejecutar / probar

No hay tests ni linter configurados. Para probar cambios, simplemente abrir `index.html` en el navegador o servir el directorio con un servidor estático:

```bash
open index.html                # macOS, abre directo
python3 -m http.server 8000    # o servidor local
npx serve .
```

No hay pasos de compilación: cualquier edición a `game.js`/`style.css`/`index.html` se refleja al recargar la página.

## Arquitectura

Todo el estado y la lógica del juego viven en variables globales y funciones top-level en `game.js` (sin clases, sin módulos). Piezas clave:

- **Tablero**: matriz `board[ROWS][COLS]` (20×10) donde cada celda es `0` (vacía) o un índice 1–7 que indica el color/tipo de pieza fija.
- **Piezas**: `PIECES` define las 7 formas estándar como matrices cuadradas; `current`/`next` son objetos `{ type, shape, x, y }`. La rotación (`rotateCW`) transpone + invierte filas; no hay tabla de rotación por estado (SRS), es una rotación matricial simple.
- **Wall kicks** (`tryRotate`): tras rotar, prueba desplazamientos `[0, -1, 1, -2, 2]` en x hasta encontrar una posición sin colisión.
- **Colisión** (`collide`): única función que valida límites del tablero y solapamiento con bloques fijos; toda la lógica de movimiento pasa por ella.
- **Game loop** (`loop`, dirigido por `requestAnimationFrame`): acumula delta time en `dropAccum` y baja la pieza cuando supera `dropInterval`; si no puede bajar, llama a `lockPiece()`.
- **Ciclo de fijado**: `lockPiece()` → `merge()` (graba la pieza en `board`) → `clearLines()` (elimina filas completas, recalcula `score`/`level`/`dropInterval`) → `spawn()` (promueve `next` a `current`, genera nueva `next`, detecta game over si la nueva pieza colisiona al aparecer).
- **Ghost piece**: `ghostY()` proyecta hacia abajo la posición final de `current` sin mutar estado; se dibuja con alpha reducido en `draw()`.
- **Render**: `draw()` pinta grid + tablero + ghost + pieza actual en `#board` (canvas principal); `drawNext()` pinta la vista previa en `#next-canvas`. Ambos comparten `drawBlock()`.
- **HUD**: `updateHUD()` sincroniza `score`/`lines`/`level` con el DOM tras cada cambio relevante.

### Ajustar tamaño de tablero

Si se cambia `COLS`, `ROWS` o `BLOCK` en `game.js`, hay que ajustar también `width`/`height` del `<canvas id="board">` en `index.html` para que coincidan (`COLS × BLOCK`, `ROWS × BLOCK`).

## Convenciones de comunicación (usuario)

- Responder siempre en español, de forma breve y directa, sin resúmenes finales.
