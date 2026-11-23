"""Genera el sitio estático (HTML con el texto en español ya escrito, para Google) y app.js con ES/EN."""
import html, json, os, re, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
SITE = "https://atrapo.vercel.app"

ES, EN = {}, {}
def add(key, es, en):
    ES[key], EN[key] = es, en

# ---------------------------------------------------------------- comunes
add("nav.home", "Inicio", "Home")
add("nav.atrapo", "Atrapo", "Atrapo")
add("nav.alargo", "Alargo", "Alargo")
add("dl.forMac", "Descargar para Mac", "Download for Mac")
add("dl.forWin", "Descargar para Windows", "Download for Windows")
add("dl.default", "Descargar", "Download")
add("dl.mobile", "Son apps de ordenador. Ábrela desde tu Mac o PC.", "These are computer apps. Open this page on your Mac or PC.")
add("dl.meta", "Versión {v} · {size}", "Version {v} · {size}")
add("dl.others", "¿Otro sistema? Mac con Intel, Mac con Apple Silicon o Windows, abajo.", "Another system? Intel Mac, Apple Silicon Mac or Windows, below.")
add("dl.title", "Descargas", "Downloads")
add("dl.macArm", "Mac con Apple Silicon (M1 o posterior)", "Mac with Apple Silicon (M1 or later)")
add("dl.macIntel", "Mac con Intel", "Mac with Intel")
add("dl.win", "Windows 10 y 11 (64 bits)", "Windows 10 and 11 (64-bit)")
add("dl.soon", "Disponible muy pronto.", "Coming very soon.")
add("dl.version", "Versión {v}, {date}.", "Version {v}, {date}.")
add("inst.title", "La primera vez que la abres", "The first time you open it")
add("inst.mac1", "Abre el archivo <code>.dmg</code> y arrastra la app a la carpeta Aplicaciones.", "Open the <code>.dmg</code> file and drag the app into the Applications folder.")
add("inst.mac2", "Ábrela desde Aplicaciones. macOS dirá que no puede verificarla: pulsa <b>Hecho</b>. (En macOS 14 o anterior: clic derecho sobre la app, <b>Abrir</b>.)", "Open it from Applications. macOS will say it can't verify it: click <b>Done</b>. (On macOS 14 or earlier: right-click the app, <b>Open</b>.)")
add("inst.mac3", "Ve a <b>Ajustes del Sistema, Privacidad y seguridad</b>, baja hasta el aviso de la app y pulsa <b>Abrir de todos modos</b>.", "Go to <b>System Settings, Privacy &amp; Security</b>, scroll to the app's notice and click <b>Open Anyway</b>.")
add("inst.mac4", "Confirma con tu contraseña. Solo hace falta esta primera vez.", "Confirm with your password. You only need to do this once.")
add("inst.macCmd", "Sin ningún aviso: abre la app <b>Terminal</b>, pega esta línea y pulsa Intro. Descarga, comprueba e instala la app por ti.", "With no warning at all: open the <b>Terminal</b> app, paste this line and press Enter. It downloads, verifies and installs the app for you.")
add("inst.win1", "Ejecuta el instalador <code>.exe</code> que has descargado.", "Run the <code>.exe</code> installer you downloaded.")
add("inst.win2", "Si aparece «Windows protegió su PC», pulsa <b>Más información</b> y luego <b>Ejecutar de todas formas</b>.", "If you see “Windows protected your PC”, click <b>More info</b> and then <b>Run anyway</b>.")
add("inst.win3", "Si Windows 11 dice «Control Inteligente de Aplicaciones bloqueó una aplicación», ese aviso no tiene botón para continuar. Abre <b>Seguridad de Windows, Control de aplicaciones y navegador, Configuración del Control inteligente de aplicaciones</b> y elige <b>Desactivado</b>. Ojo: una vez desactivado no se puede volver a activar sin reinstalar Windows. Después ejecuta el instalador otra vez.", "If Windows 11 says “Smart App Control blocked an app”, that notice has no button to continue. Open <b>Windows Security, App &amp; browser control, Smart App Control settings</b> and choose <b>Off</b>. Careful: once it's off it can't be turned back on without reinstalling Windows. Then run the installer again.")
add("inst.win4", "Sigue el instalador y abre la app desde el menú Inicio.", "Follow the installer and open the app from the Start menu.")
add("inst.why", "Son proyectos independientes y gratuitos, y no pagan los certificados de Apple y Microsoft (cientos de euros al año). Por eso tu sistema pide una confirmación la primera vez. El aviso no significa que haya un virus, pero si prefieres no confiar, no las instales.", "These are independent, free projects and don't pay for Apple and Microsoft certificates (hundreds of euros a year). That's why your system asks for confirmation the first time. The warning doesn't mean there's a virus, but if you'd rather not trust them, don't install them.")
add("foot.nobrand", "Atrapo y Alargo no tienen relación con Spotify, YouTube, Pinterest ni ninguna otra marca citada; sus nombres solo indican con qué enlaces funciona Atrapo.", "Atrapo and Alargo are not affiliated with Spotify, YouTube, Pinterest or any other brand mentioned; their names only say which links Atrapo works with.")
add("foot.code", 'Código abierto (licencia MIT): <a href="https://github.com/gabirz74/atrapo">Atrapo</a> y <a href="https://github.com/gabirz74/alargo">Alargo</a> en GitHub. Los instaladores aún no están firmados.', 'Open source (MIT license): <a href="https://github.com/gabirz74/atrapo">Atrapo</a> and <a href="https://github.com/gabirz74/alargo">Alargo</a> on GitHub. The installers are not signed yet.')
add("foot.privacy", 'Privacidad: ninguna de las dos apps envía tus datos a ningún sitio. <a href="https://github.com/gabirz74/atrapo/blob/main/PRIVACY.md">Más información</a>.', 'Privacy: neither app sends your data anywhere. <a href="https://github.com/gabirz74/atrapo/blob/main/PRIVACY.md">More</a>.')

# ---------------------------------------------------------------- portada
add("hub.title", "Dos apps gratuitas para tu música.", "Two free apps for your music.")
add("hub.lede", "Atrapo descarga. Alargo alarga. Para Mac y Windows, de código abierto, sin cuentas y sin pagar nada.", "Atrapo downloads. Alargo extends. For Mac and Windows, open source, no accounts and nothing to pay.")
add("hub.atrapo.kind", "Descarga música, vídeo e imágenes pegando un enlace.", "Download music, video and images by pasting a link.")
add("hub.atrapo.p", "Playlists enteras de Spotify en un .zip, YouTube en la calidad que quieras y Pinterest en su resolución original.", "Whole Spotify playlists in a .zip, YouTube in the quality you want and Pinterest at original resolution.")
add("hub.alargo.kind", "Crea versiones extended de tus canciones.", "Create extended versions of your songs.")
add("hub.alargo.p", "Intro instrumental con ritmo, final en acapela y control total sobre cada empalme. Pensada para DJs.", "Rhythmic instrumental intro, acapella ending and full control over every join. Made for DJs.")
add("hub.more", "Saber más", "Learn more")
add("tl.intro", "<b>Intro</b> instrumental", "Instrumental <b>intro</b>")
add("tl.song", "Tu canción, entera", "Your song, whole")
add("tl.acap", "<b>Acapela</b> final", "Final <b>acapella</b>")

# ---------------------------------------------------------------- Atrapo
A = {
 "a.title": ("Atrapo: descarga música, vídeo e imágenes pegando un enlace", "Atrapo: download music, video and images by pasting a link"),
 "a.ph": ("Pega un enlace", "Paste a link"),
 "a.lede": ("Una app para Mac y Windows. Pega un enlace de Spotify, YouTube, Pinterest y más, y guarda los archivos originales en tu ordenador. Gratis, sin cuentas y sin el límite de 100 canciones.", "An app for Mac and Windows. Paste a link from Spotify, YouTube, Pinterest and more, and keep the original files on your computer. Free, no accounts, and no 100-song limit."),
 "a.what.title": ("Qué hace", "What it does"),
 "a.what.spotify.t": ("Playlists enteras de Spotify", "Whole Spotify playlists"),
 "a.what.spotify.p": ("Pega una playlist de cualquier tamaño y recibe un solo .zip con todas las canciones, con título, artista, álbum y portada.", "Paste a playlist of any size and get a single .zip with every song, tagged with title, artist, album and cover art."),
 "a.what.youtube.t": ("YouTube: vídeo o solo audio", "YouTube: video or audio only"),
 "a.what.youtube.p": ("Elige la calidad: hasta 4K en vídeo o el audio original sin recomprimir. También MP3, M4A, FLAC, subtítulos y recortes.", "Pick the quality: up to 4K video, or the original audio untouched. Also MP3, M4A, FLAC, subtitles and trimming."),
 "a.what.pinterest.t": ("Pinterest, en original", "Pinterest, original size"),
 "a.what.pinterest.p": ("Pines, tableros y perfiles con imágenes y vídeos a su resolución original y con el nombre que tenían.", "Pins, boards and profiles with images and videos at their original resolution and original names."),
 "a.what.local.t": ("Todo en tu ordenador", "Everything on your computer"),
 "a.what.local.p": ("No hay servidor ni cuenta. Los archivos van directos a tu carpeta de descargas y nadie más ve lo que bajas.", "No server, no account. Files go straight to your downloads folder and nobody else sees what you download."),
 "a.more": ("y más", "and more"),
 "a.update": ("Atrapo actualiza solo su motor de descargas; cuando haya una versión nueva de la app te lo avisará dentro de ella.", "Atrapo updates its download engine by itself; when there's a new version of the app it will tell you inside."),
 "a.legal": ("Descarga solo contenido que tengas derecho a usar: eres responsable de lo que descargas. Atrapo funciona en tu ordenador y no envía ni guarda tus enlaces ni tus archivos.", "Only download content you have the right to use: you are responsible for what you download. Atrapo runs on your computer and doesn't send or store your links or your files."),
}
for k, (e, n) in A.items(): add(k, e, n)

# ---------------------------------------------------------------- Alargo
L = {
 "l.title": ("Alargo: crea versiones extended de tus canciones para DJ", "Alargo: create extended versions of your songs for DJing"),
 "l.tag": ("Convierte cualquier canción en una versión extended.", "Turn any song into an extended version."),
 "l.lede": ("Una app para Mac y Windows que añade una intro instrumental con ritmo, deja el último estribillo en acapela y te deja ajustarlo todo. Gratis, sin cuentas y con IA que funciona en tu ordenador.", "An app for Mac and Windows that adds a rhythmic instrumental intro, leaves the last chorus as an acapella and lets you tweak everything. Free, no accounts, with AI that runs on your computer."),
 "l.how.title": ("Cómo funciona", "How it works"),
 "l.s1.t": ("Suelta una canción", "Drop a song"),
 "l.s1.p": ("MP3, WAV, FLAC, M4A y más. Puedes soltar varias a la vez y se analizan en cola.", "MP3, WAV, FLAC, M4A and more. Drop several at once and they're analysed in a queue."),
 "l.s2.t": ("La IA la analiza", "The AI analyses it"),
 "l.s2.p": ("Separa voz, batería y bajo, detecta el tempo, dónde entra cada frase y cuál es el último estribillo.", "It separates vocals, drums and bass, finds the tempo, where each phrase starts and which is the last chorus."),
 "l.s3.t": ("Escúchala y ajústala", "Listen and tweak"),
 "l.s3.p": ("Arrastra la intro, la entrada de la voz y la acapela por la línea de tiempo. Escucha cada empalme por separado.", "Drag the intro, the vocal entry and the acapella along the timeline. Audition each join on its own."),
 "l.s4.t": ("Expórtala", "Export it"),
 "l.s4.p": ("MP3 a 320 kbps, WAV o FLAC, con título, artista y BPM en las etiquetas.", "MP3 at 320 kbps, WAV or FLAC, with title, artist and BPM in the tags."),
 "l.feat.title": ("Hecha para ajustarla a tu gusto", "Built to be tweaked"),
 "l.f1.t": ("Intro a tu medida", "An intro your way"),
 "l.f1.p": ("Instrumental completo, solo batería o batería y bajo. De 4 a 16 compases, con bucle y volumen automático o manual.", "Full instrumental, drums only, or drums and bass. 4 to 16 bars, with looping and automatic or manual level."),
 "l.f2.t": ("La voz entra donde quieras", "Vocals enter where you want"),
 "l.f2.p": ("Elige dónde retoma la canción y afina al milisegundo. La IA propone la entrada; tú decides.", "Choose where the song resumes and fine-tune to the millisecond. The AI suggests the entry; you decide."),
 "l.f3.t": ("Acapela final", "Final acapella"),
 "l.f3.p": ("De 4 a 32 compases sobre el estribillo que prefieras, con el apagado del instrumental y el fundido a tu gusto.", "4 to 32 bars over the chorus you prefer, with the instrumental fade-out and the tail fade to taste."),
 "l.f4.t": ("Rejilla de compases", "Bar grid"),
 "l.f4.p": ("Ves los compases sobre la forma de onda y puedes afinar la rejilla si un golpe no coincide.", "See the bars over the waveform and nudge the grid if a hit doesn't line up."),
 "l.f5.t": ("Todo reversible", "Everything reversible"),
 "l.f5.p": ("Deshacer, rehacer y volver a la sugerencia de la IA cuando quieras. Lo que oyes es lo que exportas.", "Undo, redo and go back to the AI suggestion any time. What you hear is what you export."),
 "l.f6.t": ("Privada y sin límites", "Private and unlimited"),
 "l.f6.p": ("Los modelos de IA son de código abierto y se ejecutan en tu ordenador. Sin cuentas, sin suscripción, sin subir nada.", "The AI models are open source and run on your computer. No accounts, no subscription, nothing uploaded."),
 "l.f7.t": ("Efectos de DJ", "DJ effects"),
 "l.f7.p": ("Filtros que se abren, subidas de ruido, platillos invertidos, bocina de aire, golpes de entrada, eco y reverb al final… con estilos Suave, Intenso y Épico (reggaetón y club) y cada efecto ajustable.", "Opening filters, noise risers, reverse cymbals, air horn, entry hits, echo and reverb at the end… with Soft, Intense and Epic (reggaeton and club) styles and every effect adjustable."),
 "l.f8.t": ("Con su portada", "With its cover art"),
 "l.f8.p": ("El archivo exportado conserva la portada de la canción, con una franja «EXTENDED» opcional para distinguirlo del original.", "The exported file keeps the song's cover art, with an optional “EXTENDED” strip to tell it apart from the original."),
 "l.f9.t": ("Tú eliges la melodía de la intro", "You choose the intro's melody"),
 "l.f9.p": ("La IA propone un trozo, pero puedes marcar con el ratón el que quieras o elegir entre las melodías que más se repiten. Incluso mezclar la batería, el bajo y la melodía de partes distintas.", "The AI suggests a section, but you can pick any with the mouse or choose among the most repeated melodies. You can even mix drums, bass and melody from different parts."),
 "l.f10.t": ("Corta lo que sobra", "Cut what you don't need"),
 "l.f10.p": ("Quita partes de la canción o huecos sin sonido con el ratón, y mira los tiempos (kicks) en rojo sobre la onda, como en tu programa de DJ.", "Remove parts of the song or silent gaps with the mouse, and see the beats (kicks) in red over the waveform, like in your DJ software."),
 "l.first.title": ("Antes de empezar", "Before you start"),
 "l.first.p": ("La app pesa unos 140 MB. La primera vez descarga su motor de IA, una sola vez: unos 2,2 GB en calidad alta o 1,6 GB en calidad rápida. Después funciona sin internet. Cada canción analizada guarda sus pistas (80–150 MB) hasta que la quitas de la biblioteca, y en Ajustes puedes desinstalar el motor.", "The app is about 140 MB. The first time it downloads its AI engine, once: about 2.2 GB in high quality or 1.6 GB in fast quality. After that it works offline. Each analysed song keeps its stems (80–150 MB) until you remove it from the library, and in Settings you can uninstall the engine."),
 "l.first.p2": ("En un Windows sin tarjeta gráfica el análisis tarda más: elige la calidad rápida en Ajustes.", "On a Windows PC without a graphics card analysis takes longer: choose fast quality in Settings."),
}
for k, (e, n) in L.items(): add(k, e, n)

# ---------------------------------------------------------------- helpers HTML
def I(key, tag="span", cls="", extra=""):
    c = f' class="{cls}"' if cls else ""
    return f'<{tag}{c} data-i18n="{key}"{extra}>{html.escape(ES[key], quote=False)}</{tag}>'
def H(key, tag="span", cls="", extra=""):
    c = f' class="{cls}"' if cls else ""
    return f'<{tag}{c} data-i18n-html="{key}"{extra}>{ES[key]}</{tag}>'

def bars(n, lo, hi, seed):
    out = []
    for i in range(n):
        h = lo + (hi - lo) * (0.5 + 0.5 * __import__("math").sin(seed + i * 1.37) * __import__("math").cos(i * 0.61))
        out.append(f'<i style="height:{int(h)}%"></i>')
    return "".join(out)

def timeline(mini=False):
    cls = "tl mini" if mini else "tl"
    return f'''<div class="{cls}" role="img" aria-label="{html.escape(ES['hub.alargo.kind'])}">
  <div class="tl-bar"><div class="tl-intro">{bars(9,30,80,1)}</div><div class="tl-song">{bars(26,25,92,3)}</div><div class="tl-acap">{bars(9,30,85,5)}</div></div>
  <div class="tl-labels">{I('tl.intro','span','', '').replace('data-i18n=','data-i18n-html=') if False else H('tl.intro')}{H('tl.song')}{H('tl.acap')}</div>
</div>'''

def ldjson(name, desc, url, icon):
    return json.dumps({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": name, "description": desc, "url": url,
        "applicationCategory": "MultimediaApplication", "operatingSystem": "macOS, Windows", "image": SITE + icon,
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}, "license": "https://opensource.org/licenses/MIT"}, ensure_ascii=False)

def head(page, title_key, desc_es, path, icon, accent):
    return f'''<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(ES[title_key] if title_key in ES else title_key)}</title>
    <meta name="description" content="{html.escape(desc_es)}" />
    <link rel="canonical" href="{SITE}{path}" />
    <meta name="theme-color" content="{accent}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="{html.escape(ES[title_key] if title_key in ES else title_key)}" />
    <meta property="og:description" content="{html.escape(desc_es)}" />
    <meta property="og:url" content="{SITE}{path}" />
    <meta property="og:image" content="{SITE}{icon}" />
    <meta name="twitter:card" content="summary" />
    <link rel="icon" href="{icon.replace('-512.png', '.svg')}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="{icon}" />
    <link rel="preload" href="/bricolage.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/style.css" />
    @@LD@@
  </head>
  <body class="{page}" data-page="{page}">
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/" aria-label="Atrapo y Alargo"><span class="pair"><img src="/icon-atrapo.svg" alt="" width="26" height="26" /><img src="/icon-alargo.svg" alt="" width="26" height="26" /></span></a>
        <nav class="nav" aria-label="Apps">
          <a href="/"{' aria-current="page"' if page == 'hub' else ''}>{I('nav.home')}</a>
          <a href="/atrapo"{' aria-current="page"' if page == 'atrapo' else ''}>{I('nav.atrapo')}</a>
          <a href="/alargo"{' aria-current="page"' if page == 'alargo' else ''}>{I('nav.alargo')}</a>
        </nav>
        <div class="lang" role="group" aria-label="Idioma / Language">
          <button type="button" data-lang="es" aria-pressed="true">ES</button>
          <button type="button" data-lang="en" aria-pressed="false">EN</button>
        </div>
      </header>
      <main>
'''

def foot(extra=""):
    return f'''      </main>
      <footer>
        {extra}
        {H('foot.code','p')}
        {H('foot.privacy','p')}
        {I('foot.nobrand','p')}
      </footer>
    </div>
    <script src="/app.js"></script>
  </body>
</html>
'''

def dl_table(prod):
    rows = [("mac-arm64", "dl.macArm"), ("mac-x64", "dl.macIntel"), ("win-x64", "dl.win")]
    tr = "".join(f'<tr><td><a href="#" data-dl="{prod}:{k}" aria-disabled="true">{I(lbl)}</a></td><td data-size="{prod}:{k}"></td></tr>' for k, lbl in rows)
    return f'''        <section id="descargas" aria-labelledby="h-dl">
          {I('dl.title','h2','',' id="h-dl"')}
          <table class="dl"><tbody>{tr}</tbody></table>
          <p class="why" data-version="{prod}"></p>
        </section>
'''

def install(prod, name, cmd):
    return f'''        <section aria-labelledby="h-install">
          {I('inst.title','h2','',' id="h-install"')}
          <div class="install">
            <div>
              <h3>macOS</h3>
              <ol>{H('inst.mac1','li')}{H('inst.mac2','li')}{H('inst.mac3','li')}{H('inst.mac4','li')}</ol>
              {H('inst.macCmd','p','why',' style="margin-top:1.25rem"')}
              <pre class="cmd"><code>{cmd}</code></pre>
            </div>
            <div>
              <h3>Windows</h3>
              <ol>{H('inst.win1','li')}{H('inst.win2','li')}{H('inst.win3','li')}{H('inst.win4','li')}</ol>
            </div>
          </div>
          {I('inst.why','p','why')}
        </section>
'''

def main_cta(prod):
    return f'''<div class="cta reveal d2">
            <a class="btn" data-main="{prod}" href="#descargas" aria-disabled="true"><span data-main-label>{html.escape(ES['dl.default'])}</span></a>
            <small data-main-meta="{prod}"></small>
          </div>
          {I('dl.others','p','others reveal d2')}'''

os.makedirs(OUT + "/atrapo", exist_ok=True)
os.makedirs(OUT + "/alargo", exist_ok=True)

# ---------------------------------------------------------------- páginas
def write(path, text):
    with open(os.path.join(OUT, path), "w", encoding="utf-8") as f:
        f.write(text)

# portada
hub_desc = ES["hub.lede"] + " Atrapo: descarga música, vídeo e imágenes. Alargo: versiones extended para DJ."
t = head("hub", "hub.title", hub_desc, "/", "/icon-atrapo-512.png", "#2740f5").replace("<title>Dos apps gratuitas para tu música.</title>", "<title>Atrapo y Alargo: apps gratuitas para tu música (Mac y Windows)</title>")
t += f'''        <div class="hub">
          <h1 class="hub-title" data-i18n="hub.title">{ES['hub.title']}</h1>
          {I('hub.lede','p','lede reveal d1')}
          <div class="rows">
            <article class="row atrapo">
              <div>
                <h2><a href="/atrapo">Atrapo</a></h2>
                {I('hub.atrapo.kind','p','kind')}
              </div>
              <div class="side">
                {I('hub.atrapo.p','p')}
                <div class="go"><a class="btn sm" data-main="atrapo" href="/atrapo#descargas"><span data-main-label>{ES['dl.default']}</span></a><a class="more" href="/atrapo">{I('hub.more')}</a></div>
              </div>
            </article>
            <article class="row alargo">
              <div>
                <h2><a href="/alargo">Alargo</a></h2>
                {I('hub.alargo.kind','p','kind')}
              </div>
              <div class="side">
                {timeline(True)}
                <p style="margin-top:1.1rem">{I('hub.alargo.p')}</p>
                <div class="go"><a class="btn sm" data-main="alargo" href="/alargo#descargas"><span data-main-label>{ES['dl.default']}</span></a><a class="more" href="/alargo">{I('hub.more')}</a></div>
              </div>
            </article>
          </div>
        </div>
'''
t += foot()
t = t.replace("@@LD@@", f'<script type="application/ld+json">{ldjson("Atrapo", ES["a.lede"], SITE + "/atrapo", "/icon-atrapo-512.png")}</script>\n    <script type="application/ld+json">{ldjson("Alargo", ES["l.lede"], SITE + "/alargo", "/icon-alargo-512.png")}</script>')
write("index.html", t)

# Atrapo
t = head("atrapo", "a.title", ES["a.lede"], "/atrapo", "/icon-atrapo-512.png", "#2740f5")
t += f'''        <div class="hero">
          <h1 class="sr" data-i18n="a.title">{ES['a.title']}</h1>
          <p class="field" aria-hidden="true"><span class="ph" id="ph">{ES['a.ph']}</span><span class="typed" id="typed"></span><span class="caret"></span></p>
          <div class="rule"></div>
          {I('a.lede','p','lede reveal d1')}
          {main_cta('atrapo')}
        </div>
        <section aria-labelledby="h-what">
          {I('a.what.title','h2','',' id="h-what"')}
          <div class="cols">
            <div>{I('a.what.spotify.t','h3')}{I('a.what.spotify.p','p')}</div>
            <div>{I('a.what.youtube.t','h3')}{I('a.what.youtube.p','p')}</div>
            <div>{I('a.what.pinterest.t','h3')}{I('a.what.pinterest.p','p')}</div>
            <div>{I('a.what.local.t','h3')}{I('a.what.local.p','p')}</div>
          </div>
          <p class="sources"><span>YouTube</span><span>Spotify</span><span>Pinterest</span><span>SoundCloud</span><span>TikTok</span><span>Instagram</span><span>X</span><span>Reddit</span><span>Vimeo</span><span>Bandcamp</span>{I('a.more')}</p>
        </section>
'''
t += dl_table("atrapo").replace('<p class="why" data-version="atrapo"></p>', f'<p class="why"><span data-version="atrapo"></span> {I("a.update")}</p>')
t += install("atrapo", "Atrapo", "curl -fsSL https://atrapo.vercel.app/install.sh | bash")
t += foot(I("a.legal", "p"))
t = t.replace("@@LD@@", f'<script type="application/ld+json">{ldjson("Atrapo", ES["a.lede"], SITE + "/atrapo", "/icon-atrapo-512.png")}</script>')
write("atrapo/index.html", t)

# Alargo
t = head("alargo", "l.title", ES["l.lede"], "/alargo", "/icon-alargo-512.png", "#4a3df0")
t += f'''        <div class="hero">
          <h1 class="hub-title">Alargo</h1>
          {I('l.tag','p','lede reveal d1',' style="margin-top:1rem;color:var(--ink);font-size:clamp(1.3rem,2.6vw,1.8rem);font-weight:500;letter-spacing:-0.02em"')}
          {timeline()}
          {I('l.lede','p','lede reveal d1')}
          {main_cta('alargo')}
        </div>
        <section aria-labelledby="h-how">
          {I('l.how.title','h2','',' id="h-how"')}
          <ol class="steps">
            <li>{I('l.s1.t','b')}{I('l.s1.p')}</li>
            <li>{I('l.s2.t','b')}{I('l.s2.p')}</li>
            <li>{I('l.s3.t','b')}{I('l.s3.p')}</li>
            <li>{I('l.s4.t','b')}{I('l.s4.p')}</li>
          </ol>
        </section>
        <section aria-labelledby="h-feat">
          {I('l.feat.title','h2','',' id="h-feat"')}
          <div class="cols">
            <div>{I('l.f1.t','h3')}{I('l.f1.p','p')}</div>
            <div>{I('l.f2.t','h3')}{I('l.f2.p','p')}</div>
            <div>{I('l.f3.t','h3')}{I('l.f3.p','p')}</div>
            <div>{I('l.f4.t','h3')}{I('l.f4.p','p')}</div>
            <div>{I('l.f5.t','h3')}{I('l.f5.p','p')}</div>
            <div>{I('l.f6.t','h3')}{I('l.f6.p','p')}</div>
            <div>{I('l.f7.t','h3')}{I('l.f7.p','p')}</div>
            <div>{I('l.f8.t','h3')}{I('l.f8.p','p')}</div>
            <div>{I('l.f9.t','h3')}{I('l.f9.p','p')}</div>
            <div>{I('l.f10.t','h3')}{I('l.f10.p','p')}</div>
          </div>
        </section>
        <section aria-labelledby="h-first">
          {I('l.first.title','h2','',' id="h-first"')}
          {I('l.first.p','p','why',' style="margin-top:0"')}
          {I('l.first.p2','p','why')}
        </section>
'''
t += dl_table("alargo")
t += install("alargo", "Alargo", "curl -fsSL https://atrapo.vercel.app/alargo/install.sh | bash")
t += foot()
t = t.replace("@@LD@@", f'<script type="application/ld+json">{ldjson("Alargo", ES["l.lede"], SITE + "/alargo", "/icon-alargo-512.png")}</script>')
write("alargo/index.html", t)

# robots + sitemap
write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{SITE}{p}</loc></url>\n" for p in ("/", "/atrapo", "/alargo")) + "</urlset>\n")

# app.js
js = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.template.js"), encoding="utf-8").read()
js = js.replace("/*T*/", json.dumps({"es": ES, "en": EN}, ensure_ascii=False))
write("app.js", js)
print("ok", len(ES), "claves")
