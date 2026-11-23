(() => {
  const T = {"es": {"nav.home": "Inicio", "nav.atrapo": "Atrapo", "nav.alargo": "Alargo", "dl.forMac": "Descargar para Mac", "dl.forWin": "Descargar para Windows", "dl.default": "Descargar", "dl.mobile": "Son apps de ordenador. Ábrela desde tu Mac o PC.", "dl.meta": "Versión {v} · {size}", "dl.others": "¿Otro sistema? Mac con Intel, Mac con Apple Silicon o Windows, abajo.", "dl.title": "Descargas", "dl.macArm": "Mac con Apple Silicon (M1 o posterior)", "dl.macIntel": "Mac con Intel", "dl.win": "Windows 10 y 11 (64 bits)", "dl.soon": "Disponible muy pronto.", "dl.version": "Versión {v}, {date}.", "inst.title": "La primera vez que la abres", "inst.mac1": "Abre el archivo <code>.dmg</code> y arrastra la app a la carpeta Aplicaciones.", "inst.mac2": "Ábrela desde Aplicaciones. macOS dirá que no puede verificarla: pulsa <b>Hecho</b>. (En macOS 14 o anterior: clic derecho sobre la app, <b>Abrir</b>.)", "inst.mac3": "Ve a <b>Ajustes del Sistema, Privacidad y seguridad</b>, baja hasta el aviso de la app y pulsa <b>Abrir de todos modos</b>.", "inst.mac4": "Confirma con tu contraseña. Solo hace falta esta primera vez.", "inst.macCmd": "Sin ningún aviso: abre la app <b>Terminal</b>, pega esta línea y pulsa Intro. Descarga, comprueba e instala la app por ti.", "inst.win1": "Ejecuta el instalador <code>.exe</code> que has descargado.", "inst.win2": "Si aparece «Windows protegió su PC», pulsa <b>Más información</b> y luego <b>Ejecutar de todas formas</b>.", "inst.win3": "Si Windows 11 dice «Control Inteligente de Aplicaciones bloqueó una aplicación», ese aviso no tiene botón para continuar. Abre <b>Seguridad de Windows, Control de aplicaciones y navegador, Configuración del Control inteligente de aplicaciones</b> y elige <b>Desactivado</b>. Ojo: una vez desactivado no se puede volver a activar sin reinstalar Windows. Después ejecuta el instalador otra vez.", "inst.win4": "Sigue el instalador y abre la app desde el menú Inicio.", "inst.why": "Son proyectos independientes y gratuitos, y no pagan los certificados de Apple y Microsoft (cientos de euros al año). Por eso tu sistema pide una confirmación la primera vez. El aviso no significa que haya un virus, pero si prefieres no confiar, no las instales.", "foot.nobrand": "Atrapo y Alargo no tienen relación con Spotify, YouTube, Pinterest ni ninguna otra marca citada; sus nombres solo indican con qué enlaces funciona Atrapo.", "foot.code": "Código abierto (licencia MIT): <a href=\"https://github.com/gabirz74/atrapo\">Atrapo</a> y <a href=\"https://github.com/gabirz74/alargo\">Alargo</a> en GitHub. Los instaladores aún no están firmados.", "foot.privacy": "Privacidad: ninguna de las dos apps envía tus datos a ningún sitio. <a href=\"https://github.com/gabirz74/atrapo/blob/main/PRIVACY.md\">Más información</a>.", "hub.title": "Dos apps gratuitas para tu música.", "hub.lede": "Atrapo descarga. Alargo alarga. Para Mac y Windows, de código abierto, sin cuentas y sin pagar nada.", "hub.atrapo.kind": "Descarga música, vídeo e imágenes pegando un enlace.", "hub.atrapo.p": "Playlists enteras de Spotify en un .zip, YouTube en la calidad que quieras y Pinterest en su resolución original.", "hub.alargo.kind": "Crea versiones extended de tus canciones.", "hub.alargo.p": "Intro instrumental con ritmo, final en acapela y control total sobre cada empalme. Pensada para DJs.", "hub.more": "Saber más", "tl.intro": "<b>Intro</b> instrumental", "tl.song": "Tu canción, entera", "tl.acap": "<b>Acapela</b> final", "a.title": "Atrapo: descarga música, vídeo e imágenes pegando un enlace", "a.ph": "Pega un enlace", "a.lede": "Una app para Mac y Windows. Pega un enlace de Spotify, YouTube, Pinterest y más, y guarda los archivos originales en tu ordenador. Gratis, sin cuentas y sin el límite de 100 canciones.", "a.what.title": "Qué hace", "a.what.spotify.t": "Playlists enteras de Spotify", "a.what.spotify.p": "Pega una playlist de cualquier tamaño y recibe un solo .zip con todas las canciones, con título, artista, álbum y portada.", "a.what.youtube.t": "YouTube: vídeo o solo audio", "a.what.youtube.p": "Elige la calidad: hasta 4K en vídeo o el audio original sin recomprimir. También MP3, M4A, FLAC, subtítulos y recortes.", "a.what.pinterest.t": "Pinterest, en original", "a.what.pinterest.p": "Pines, tableros y perfiles con imágenes y vídeos a su resolución original y con el nombre que tenían.", "a.what.local.t": "Todo en tu ordenador", "a.what.local.p": "No hay servidor ni cuenta. Los archivos van directos a tu carpeta de descargas y nadie más ve lo que bajas.", "a.more": "y más", "a.update": "Atrapo actualiza solo su motor de descargas; cuando haya una versión nueva de la app te lo avisará dentro de ella.", "a.legal": "Descarga solo contenido que tengas derecho a usar: eres responsable de lo que descargas. Atrapo funciona en tu ordenador y no envía ni guarda tus enlaces ni tus archivos.", "l.title": "Alargo: crea versiones extended de tus canciones para DJ", "l.tag": "Convierte cualquier canción en una versión extended.", "l.lede": "Una app para Mac y Windows que añade una intro instrumental con ritmo, deja el último estribillo en acapela y te deja ajustarlo todo. Gratis, sin cuentas y con IA que funciona en tu ordenador.", "l.how.title": "Cómo funciona", "l.s1.t": "Suelta una canción", "l.s1.p": "MP3, WAV, FLAC, M4A y más. Puedes soltar varias a la vez y se analizan en cola.", "l.s2.t": "La IA la analiza", "l.s2.p": "Separa voz, batería y bajo, detecta el tempo, dónde entra cada frase y cuál es el último estribillo.", "l.s3.t": "Escúchala y ajústala", "l.s3.p": "Arrastra la intro, la entrada de la voz y la acapela por la línea de tiempo. Escucha cada empalme por separado.", "l.s4.t": "Expórtala", "l.s4.p": "MP3 a 320 kbps, WAV o FLAC, con título, artista y BPM en las etiquetas.", "l.feat.title": "Hecha para ajustarla a tu gusto", "l.f1.t": "Intro a tu medida", "l.f1.p": "Instrumental completo, solo batería o batería y bajo. De 4 a 16 compases, con bucle y volumen automático o manual.", "l.f2.t": "La voz entra donde quieras", "l.f2.p": "Elige dónde retoma la canción y afina al milisegundo. La IA propone la entrada; tú decides.", "l.f3.t": "Acapela final", "l.f3.p": "De 4 a 32 compases sobre el estribillo que prefieras, con el apagado del instrumental y el fundido a tu gusto.", "l.f4.t": "Rejilla de compases", "l.f4.p": "Ves los compases sobre la forma de onda y puedes afinar la rejilla si un golpe no coincide.", "l.f5.t": "Todo reversible", "l.f5.p": "Deshacer, rehacer y volver a la sugerencia de la IA cuando quieras. Lo que oyes es lo que exportas.", "l.f6.t": "Privada y sin límites", "l.f6.p": "Los modelos de IA son de código abierto y se ejecutan en tu ordenador. Sin cuentas, sin suscripción, sin subir nada.", "l.f7.t": "Efectos de DJ", "l.f7.p": "Filtros que se abren, subidas de ruido, golpes de entrada, eco y reverb al final… con estilos Suave e Intenso y cada efecto ajustable.", "l.f8.t": "Con su portada", "l.f8.p": "El archivo exportado conserva la portada de la canción, con una franja «EXTENDED» opcional para distinguirlo del original.", "l.first.title": "Antes de empezar", "l.first.p": "La app pesa unos 140 MB. La primera vez descarga su motor de IA, una sola vez: unos 2,2 GB en calidad alta o 1,6 GB en calidad rápida. Después funciona sin internet. Cada canción analizada guarda sus pistas (80–150 MB) hasta que la quitas de la biblioteca, y en Ajustes puedes desinstalar el motor.", "l.first.p2": "En un Windows sin tarjeta gráfica el análisis tarda más: elige la calidad rápida en Ajustes."}, "en": {"nav.home": "Home", "nav.atrapo": "Atrapo", "nav.alargo": "Alargo", "dl.forMac": "Download for Mac", "dl.forWin": "Download for Windows", "dl.default": "Download", "dl.mobile": "These are computer apps. Open this page on your Mac or PC.", "dl.meta": "Version {v} · {size}", "dl.others": "Another system? Intel Mac, Apple Silicon Mac or Windows, below.", "dl.title": "Downloads", "dl.macArm": "Mac with Apple Silicon (M1 or later)", "dl.macIntel": "Mac with Intel", "dl.win": "Windows 10 and 11 (64-bit)", "dl.soon": "Coming very soon.", "dl.version": "Version {v}, {date}.", "inst.title": "The first time you open it", "inst.mac1": "Open the <code>.dmg</code> file and drag the app into the Applications folder.", "inst.mac2": "Open it from Applications. macOS will say it can't verify it: click <b>Done</b>. (On macOS 14 or earlier: right-click the app, <b>Open</b>.)", "inst.mac3": "Go to <b>System Settings, Privacy &amp; Security</b>, scroll to the app's notice and click <b>Open Anyway</b>.", "inst.mac4": "Confirm with your password. You only need to do this once.", "inst.macCmd": "With no warning at all: open the <b>Terminal</b> app, paste this line and press Enter. It downloads, verifies and installs the app for you.", "inst.win1": "Run the <code>.exe</code> installer you downloaded.", "inst.win2": "If you see “Windows protected your PC”, click <b>More info</b> and then <b>Run anyway</b>.", "inst.win3": "If Windows 11 says “Smart App Control blocked an app”, that notice has no button to continue. Open <b>Windows Security, App &amp; browser control, Smart App Control settings</b> and choose <b>Off</b>. Careful: once it's off it can't be turned back on without reinstalling Windows. Then run the installer again.", "inst.win4": "Follow the installer and open the app from the Start menu.", "inst.why": "These are independent, free projects and don't pay for Apple and Microsoft certificates (hundreds of euros a year). That's why your system asks for confirmation the first time. The warning doesn't mean there's a virus, but if you'd rather not trust them, don't install them.", "foot.nobrand": "Atrapo and Alargo are not affiliated with Spotify, YouTube, Pinterest or any other brand mentioned; their names only say which links Atrapo works with.", "foot.code": "Open source (MIT license): <a href=\"https://github.com/gabirz74/atrapo\">Atrapo</a> and <a href=\"https://github.com/gabirz74/alargo\">Alargo</a> on GitHub. The installers are not signed yet.", "foot.privacy": "Privacy: neither app sends your data anywhere. <a href=\"https://github.com/gabirz74/atrapo/blob/main/PRIVACY.md\">More</a>.", "hub.title": "Two free apps for your music.", "hub.lede": "Atrapo downloads. Alargo extends. For Mac and Windows, open source, no accounts and nothing to pay.", "hub.atrapo.kind": "Download music, video and images by pasting a link.", "hub.atrapo.p": "Whole Spotify playlists in a .zip, YouTube in the quality you want and Pinterest at original resolution.", "hub.alargo.kind": "Create extended versions of your songs.", "hub.alargo.p": "Rhythmic instrumental intro, acapella ending and full control over every join. Made for DJs.", "hub.more": "Learn more", "tl.intro": "Instrumental <b>intro</b>", "tl.song": "Your song, whole", "tl.acap": "Final <b>acapella</b>", "a.title": "Atrapo: download music, video and images by pasting a link", "a.ph": "Paste a link", "a.lede": "An app for Mac and Windows. Paste a link from Spotify, YouTube, Pinterest and more, and keep the original files on your computer. Free, no accounts, and no 100-song limit.", "a.what.title": "What it does", "a.what.spotify.t": "Whole Spotify playlists", "a.what.spotify.p": "Paste a playlist of any size and get a single .zip with every song, tagged with title, artist, album and cover art.", "a.what.youtube.t": "YouTube: video or audio only", "a.what.youtube.p": "Pick the quality: up to 4K video, or the original audio untouched. Also MP3, M4A, FLAC, subtitles and trimming.", "a.what.pinterest.t": "Pinterest, original size", "a.what.pinterest.p": "Pins, boards and profiles with images and videos at their original resolution and original names.", "a.what.local.t": "Everything on your computer", "a.what.local.p": "No server, no account. Files go straight to your downloads folder and nobody else sees what you download.", "a.more": "and more", "a.update": "Atrapo updates its download engine by itself; when there's a new version of the app it will tell you inside.", "a.legal": "Only download content you have the right to use: you are responsible for what you download. Atrapo runs on your computer and doesn't send or store your links or your files.", "l.title": "Alargo: create extended versions of your songs for DJing", "l.tag": "Turn any song into an extended version.", "l.lede": "An app for Mac and Windows that adds a rhythmic instrumental intro, leaves the last chorus as an acapella and lets you tweak everything. Free, no accounts, with AI that runs on your computer.", "l.how.title": "How it works", "l.s1.t": "Drop a song", "l.s1.p": "MP3, WAV, FLAC, M4A and more. Drop several at once and they're analysed in a queue.", "l.s2.t": "The AI analyses it", "l.s2.p": "It separates vocals, drums and bass, finds the tempo, where each phrase starts and which is the last chorus.", "l.s3.t": "Listen and tweak", "l.s3.p": "Drag the intro, the vocal entry and the acapella along the timeline. Audition each join on its own.", "l.s4.t": "Export it", "l.s4.p": "MP3 at 320 kbps, WAV or FLAC, with title, artist and BPM in the tags.", "l.feat.title": "Built to be tweaked", "l.f1.t": "An intro your way", "l.f1.p": "Full instrumental, drums only, or drums and bass. 4 to 16 bars, with looping and automatic or manual level.", "l.f2.t": "Vocals enter where you want", "l.f2.p": "Choose where the song resumes and fine-tune to the millisecond. The AI suggests the entry; you decide.", "l.f3.t": "Final acapella", "l.f3.p": "4 to 32 bars over the chorus you prefer, with the instrumental fade-out and the tail fade to taste.", "l.f4.t": "Bar grid", "l.f4.p": "See the bars over the waveform and nudge the grid if a hit doesn't line up.", "l.f5.t": "Everything reversible", "l.f5.p": "Undo, redo and go back to the AI suggestion any time. What you hear is what you export.", "l.f6.t": "Private and unlimited", "l.f6.p": "The AI models are open source and run on your computer. No accounts, no subscription, nothing uploaded.", "l.f7.t": "DJ effects", "l.f7.p": "Opening filters, noise risers, entry hits, echo and reverb at the end… with Soft and Intense styles and every effect adjustable.", "l.f8.t": "With its cover art", "l.f8.p": "The exported file keeps the song's cover art, with an optional “EXTENDED” strip to tell it apart from the original.", "l.first.title": "Before you start", "l.first.p": "The app is about 140 MB. The first time it downloads its AI engine, once: about 2.2 GB in high quality or 1.6 GB in fast quality. After that it works offline. Each analysed song keeps its stems (80–150 MB) until you remove it from the library, and in Settings you can uninstall the engine.", "l.first.p2": "On a Windows PC without a graphics card analysis takes longer: choose fast quality in Settings."}};
  const page = document.body.dataset.page;
  const TITLES = {
    hub: { es: "Atrapo y Alargo: apps gratuitas para tu música (Mac y Windows)", en: "Atrapo and Alargo: free apps for your music (Mac and Windows)" },
    atrapo: { es: T.es["a.title"], en: T.en["a.title"] },
    alargo: { es: T.es["l.title"], en: T.en["l.title"] },
  };
  const PRODUCTS = { atrapo: "/version.json", alargo: "/alargo/version.json" };
  const releases = {};
  const platform = { os: null, arch: "arm64" };
  let lang = new URLSearchParams(location.search).get("lang");
  try { lang = lang || localStorage.getItem("site-lang"); } catch { /* storage blocked */ }
  lang = lang || (navigator.language || "es").toLowerCase().slice(0, 2);
  if (!T[lang]) lang = "es";

  const fmt = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
  const mb = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.round(b / 1e6) + " MB");
  const keyFor = () => (platform.os === "win" ? "win-x64" : platform.os === "mac" ? (platform.arch === "x64" ? "mac-x64" : "mac-arm64") : null);

  function renderText() {
    document.documentElement.lang = lang;
    document.title = TITLES[page][lang];
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T[lang][el.dataset.i18n] ?? ""));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = T[lang][el.dataset.i18nHtml] ?? ""));
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    const ph = document.getElementById("ph");
    if (ph) ph.textContent = T[lang]["a.ph"];
    renderDownloads();
  }

  function renderDownloads() {
    const t = T[lang];
    document.querySelectorAll("[data-dl]").forEach((a) => {
      const [prod, key] = a.dataset.dl.split(":");
      const d = releases[prod]?.downloads?.[key];
      const size = document.querySelector(`[data-size="${a.dataset.dl}"]`);
      if (d?.url) {
        a.href = d.url;
        a.removeAttribute("aria-disabled");
        size.textContent = mb(d.size);
      } else {
        a.removeAttribute("href");
        a.setAttribute("aria-disabled", "true");
        size.textContent = releases[prod] ? t["dl.soon"] : "";
      }
    });
    document.querySelectorAll("[data-version]").forEach((el) => {
      const r = releases[el.dataset.version];
      el.textContent = r ? fmt(t["dl.version"], { v: r.version, date: r.date ?? "" }) : "";
    });
    document.querySelectorAll("[data-main]").forEach((main) => {
      const prod = main.dataset.main;
      const label = main.querySelector("[data-main-label]");
      const meta = document.querySelector(`[data-main-meta="${prod}"]`);
      const r = releases[prod];
      const k = keyFor();
      const d = k && r?.downloads?.[k];
      if (platform.os === "mobile") {
        if (meta) { main.style.display = "none"; meta.textContent = t["dl.mobile"]; }
        return;
      }
      label.textContent = platform.os === "win" ? t["dl.forWin"] : platform.os === "mac" ? t["dl.forMac"] : t["dl.default"];
      if (d?.url) {
        main.href = d.url;
        main.removeAttribute("aria-disabled");
        if (meta) meta.textContent = fmt(t["dl.meta"], { v: r.version, size: mb(d.size) });
      } else if (r) {
        main.removeAttribute("aria-disabled");
      }
    });
  }

  async function detect() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|Android/i.test(ua)) platform.os = "mobile";
    else if (/Windows/i.test(ua)) platform.os = "win";
    else if (/Macintosh|Mac OS X/i.test(ua)) {
      platform.os = "mac";
      try {
        const hi = await navigator.userAgentData?.getHighEntropyValues?.(["architecture"]);
        if (hi?.architecture === "x86") platform.arch = "x64";
      } catch { /* keep the default: Apple Silicon */ }
    }
  }

  document.querySelectorAll(".lang button").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      try { localStorage.setItem("site-lang", lang); } catch { /* storage blocked */ }
      renderText();
      resetTyping();
    }),
  );

  // Atrapo: el titular escribe enlaces de ejemplo, como quien usa la app.
  const typed = document.getElementById("typed");
  const field = document.querySelector(".field");
  const EXAMPLES = ["open.spotify.com/playlist/37i9dQZF1DX", "youtube.com/watch?v=dQw4w9WgXcQ", "pinterest.com/pinterest/official-news"];
  let timer, run = 0;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => (timer = setTimeout(r, ms)));
  function resetTyping() {
    if (!typed) return;
    run++;
    clearTimeout(timer);
    typed.textContent = "";
    field.classList.remove("has-text");
    document.getElementById("ph").style.display = "";
    if (!reduce) void loop(run);
  }
  async function loop(id) {
    await wait(1700);
    for (let i = 0; id === run; i = (i + 1) % EXAMPLES.length) {
      document.getElementById("ph").style.display = "none";
      field.classList.add("has-text");
      for (const ch of EXAMPLES[i]) {
        if (id !== run) return;
        typed.textContent += ch;
        await wait(38 + Math.random() * 40);
      }
      await wait(1700);
      while (typed.textContent && id === run) {
        typed.textContent = typed.textContent.slice(0, -2);
        await wait(14);
      }
      if (id !== run) return;
      document.getElementById("ph").style.display = "";
      field.classList.remove("has-text");
      await wait(900);
    }
  }

  renderText();
  void detect().then(renderDownloads);
  for (const [prod, url] of Object.entries(PRODUCTS)) {
    fetch(url, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { releases[prod] = j; renderDownloads(); } })
      .catch(() => undefined);
  }
  resetTyping();
})();
