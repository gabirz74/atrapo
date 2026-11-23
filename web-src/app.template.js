(() => {
  const T = /*T*/;
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
