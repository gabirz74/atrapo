// Builds the installers: node scripts/build-dist.mjs [mac|mac-arm64|mac-x64|win|all]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Arch, build, Platform } from "electron-builder";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const which = process.argv[2] ?? "all";

/** Windows: stamp the icon and version info into the exe, without needing Wine. */
async function brandWindowsExe(context) {
  const { NtExecutable, NtExecutableResource, Data, Resource } = await import("resedit");
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const exe = NtExecutable.from(readFileSync(exePath));
  const res = NtExecutableResource.from(exe);
  const ico = Data.IconFile.from(readFileSync(path.join(root, "build", "icon.ico")));
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const group = groups[0];
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, group?.id ?? 1, group?.lang ?? 1033, ico.icons.map((i) => i.data));
  const [vi] = Resource.VersionInfo.fromEntries(res.entries);
  if (vi) {
    const v = pkg.version.split(".").map(Number);
    vi.setFileVersion(v[0] ?? 1, v[1] ?? 0, v[2] ?? 0, 0, 1033);
    vi.setProductVersion(v[0] ?? 1, v[1] ?? 0, v[2] ?? 0, 0, 1033);
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      { ProductName: "Atrapo", FileDescription: "Atrapo", InternalName: "Atrapo", OriginalFilename: "Atrapo.exe", CompanyName: "Atrapo", LegalCopyright: "Atrapo" },
    );
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  writeFileSync(exePath, Buffer.from(exe.generate()));
}

/** macOS: the app is edited after Electron signed it, so it must be signed again (ad hoc: no paid Apple account). */
function adHocSign(context) {
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
}

const base = (extraResources) => ({
  appId: "app.atrapo.desktop",
  productName: "Atrapo",
  copyright: "Atrapo",
  directories: { output: "dist", buildResources: "build" },
  files: ["out/**/*", "package.json"],
  extraResources,
  asar: true,
  compression: "normal",
  npmRebuild: false,
  afterPack: async (ctx) => {
    if (ctx.electronPlatformName === "win32") await brandWindowsExe(ctx);
    if (ctx.electronPlatformName === "darwin") adHocSign(ctx);
  },
});

const resources = (dir) => [
  { from: `resources/bin/${dir}`, to: "bin" },
  ...(existsSync("resources/spotify.json") ? [{ from: "resources/spotify.json", to: "spotify.json" }] : []),
];

const jobs = {
  "mac-arm64": () =>
    build({
      targets: Platform.MAC.createTarget("dmg", Arch.arm64),
      publish: "never",
      config: {
        ...base(resources("darwin-arm64")),
        mac: { category: "public.app-category.utilities", icon: "build/icon.icns", identity: null, hardenedRuntime: false, gatekeeperAssess: false, artifactName: "Atrapo-${version}-mac-apple-silicon.${ext}" },
        dmg: { title: "Atrapo", sign: false },
      },
    }),
  "mac-x64": () =>
    build({
      targets: Platform.MAC.createTarget("dmg", Arch.x64),
      publish: "never",
      config: {
        ...base(resources("darwin-x64")),
        mac: { category: "public.app-category.utilities", icon: "build/icon.icns", identity: null, hardenedRuntime: false, gatekeeperAssess: false, artifactName: "Atrapo-${version}-mac-intel.${ext}" },
        dmg: { title: "Atrapo", sign: false },
      },
    }),
  win: () =>
    build({
      targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
      publish: "never",
      config: {
        ...base(resources("win32-x64")),
        win: { icon: "build/icon.ico", signAndEditExecutable: false, artifactName: "Atrapo-${version}-windows-setup.${ext}" },
        nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: "Atrapo", installerIcon: "build/icon.ico", uninstallerIcon: "build/icon.ico", deleteAppDataOnUninstall: false },
      },
    }),
};

const order = which === "all" ? ["mac-arm64", "mac-x64", "win"] : which === "mac" ? ["mac-arm64", "mac-x64"] : [which];
for (const name of order) {
  if (!jobs[name]) throw new Error(`Unknown target "${name}". Use: ${Object.keys(jobs).join(", ")}, mac, all`);
  console.log(`\n=== Building ${name} ===`);
  await jobs[name]();
}
console.log("\nDone. Installers are in app/dist");
