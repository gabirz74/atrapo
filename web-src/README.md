# Código fuente de la web (atrapo.vercel.app)

`build.py` genera las páginas de `../site` (portada, /atrapo y /alargo) y `app.js` a partir de los textos en español e inglés
que hay dentro del propio script y de `app.template.js`. Para cambiar un texto: edítalo en `build.py`, ejecuta `python3 build.py`
y despliega la carpeta `site/` en Vercel (`vercel deploy --prod`).

Al publicar una versión nueva de una app, actualiza `site/version.json` (Atrapo) o `site/alargo/version.json` (Alargo)
con la URL, el tamaño y el sha256 de cada instalador.
