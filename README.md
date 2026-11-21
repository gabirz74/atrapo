# Atrapo

Aplicación de escritorio (Mac y Windows) para descargar música, vídeo e imágenes pegando un enlace.
Todo ocurre en el ordenador del usuario: no hay servidor, cuentas ni límites impuestos por nosotros.

```
app/    La aplicación (Electron + React + TypeScript)
site/   La web de descarga (HTML estático, en Vercel)
```

## Qué hace

- **Spotify**: canciones, álbumes y playlists de cualquier tamaño. El audio se busca en YouTube y se guarda con título, artista, álbum, año, número de pista y carátula (MP3 320 por defecto, también M4A, Opus, FLAC u original).
- **YouTube**: vídeo (hasta 4K, MP4/MKV/WebM) o solo audio; listas y canales; subtítulos, recortes y división por capítulos.
- **Pinterest**: pines, tableros, secciones y perfiles en resolución original.
- **Más**: SoundCloud, TikTok, Instagram, X, Reddit, Vimeo, Bandcamp, Twitch, Facebook (todo lo que soporte yt-dlp).
- Varios enlaces a la vez, cola de descargas con progreso por elemento, listas en `.zip` o carpeta, claro/oscuro, ES/EN.
- Los archivos conservan su nombre original (solo se cambian los caracteres que el sistema de archivos no admite).

## Cómo funciona por dentro

| Pieza | Qué usa |
| --- | --- |
| Vídeo y audio | `yt-dlp` incluido en la app (se copia a la carpeta de datos del usuario y se actualiza solo) + `ffmpeg`. |
| JavaScript para YouTube | yt-dlp lo necesita; se le presta la propia app ejecutada en "modo Node" (`ELECTRON_RUN_AS_NODE`), así el usuario no instala nada. |
| Playlists de Spotify | La API oficial **no** entrega las canciones de una playlist a una app como esta (403 desde 2026) y la página embed se corta en 100. La app abre la playlist del reproductor web en una ventana oculta y lee todas las filas desplazando la lista. Canciones y álbumes sí usan la API con las claves incluidas. |
| Pinterest | Los mismos endpoints JSON públicos de su web, escritos en Node (sin Python). Reintenta los 403 aleatorios y prueba otras extensiones cuando una imagen original no es `.jpg`. |
| Guardado | Un archivo suelto va directo a la carpeta; varios van a una carpeta con el nombre de la lista (por defecto) o a un `.zip` sin recomprimir, a elección en Ajustes. Por defecto se guarda en la carpeta Descargas del ordenador. Nunca se sobrescribe nada: `nombre (2)`. |

## Desarrollo

Requisitos: Node 22 o superior.

```bash
cd app
npm install
npm run fetch-tools     # descarga yt-dlp y ffmpeg de tu plataforma (o: fetch-tools darwin-arm64 darwin-x64 win32-x64)
npm run dev             # abre la app con recarga en caliente
npm test                # tests de nombres de archivo, enlaces y emparejamiento
npm run typecheck
```

Las claves de Spotify van en `app/resources/spotify.json` (`{"clientId": "...", "clientSecret": "..."}`).
Ese archivo **no se sube a git**; se incluye dentro de los instaladores. El usuario puede sustituirlas por las suyas en Ajustes.

### Autocomprobación

La app instalada puede comprobarse sola, sin pantalla:

```bash
/Applications/Atrapo.app/Contents/MacOS/Atrapo --self-test
```

Comprueba las herramientas, que la ventana se pinta sin errores, que cada origen se lee y que se descargan de verdad un audio de YouTube y una canción de Spotify con carátula y etiquetas.

## Instaladores

```bash
cd app
npm run fetch-tools darwin-arm64 darwin-x64 win32-x64
node scripts/make-icons.cjs          # solo si cambia el icono (se ejecuta con: npx electron scripts/make-icons.cjs)
npm run dist                         # Mac Apple Silicon, Mac Intel y Windows en app/dist
```

- Se pueden construir los tres desde un Mac. El `.exe` de Windows recibe el icono y la versión con `resedit` (no hace falta Wine).
- **Sin firmar**: no pagamos los certificados de Apple ni Microsoft. macOS pide "Abrir de todos modos" la primera vez y Windows muestra SmartScreen. La web de descarga lo explica.
- Los instaladores no caben en un despliegue de Vercel (máx. 100 MB por archivo), así que se alojan en Vercel Blob y la web los enlaza desde `site/version.json`.

## Publicar una versión

1. Sube `version` en `app/package.json` y construye (`npm run dist`).
2. Sube los tres instaladores a Blob: `vercel blob put app/dist/<archivo> --access public --pathname downloads/<version>/<archivo> --rw-token <token>`.
3. Actualiza `site/version.json` (versión, fecha y las tres URLs) y despliega la web: `cd site && vercel deploy --prod`.
4. La app consulta `version.json` al abrirse y avisa si hay una versión nueva.

## Límites conocidos

- **Windows no está probado en un Windows real**: se construye y se valida desde macOS (estructura, icono, versión), pero no se ha ejecutado.
- Los orígenes cambian a menudo. yt-dlp se actualiza solo, pero la lectura de playlists de Spotify depende del diseño de su web y podría romperse.
- Las claves de Spotify van dentro del instalador y cualquiera puede extraerlas. Solo permiten leer datos públicos del catálogo; si hiciera falta, se rotan en el panel de Spotify.
- YouTube rechaza de vez en cuando una petición suelta; la app reintenta sola y, si sigue fallando, lo anota en el informe del `.zip`.
- Solo contenido que el usuario tenga derecho a descargar.
