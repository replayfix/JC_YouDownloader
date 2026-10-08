# JC_YouDownloader

 
A modern, cross-platform desktop application for downloading videos using yt-dlp.
Built with Tauri 2.0 (Rust) and SvelteKit, providing a clean and intuitive interface for managing video downloads.

[**한국어**](docs/README.ko.md) | [**日本語**](docs/README.ja.md) | [**中文(简体)**](docs/README.zh-CN.md) | [**中文(繁體)**](docs/README.zh-TW.md) | [**Español**](docs/README.es.md) | [**Français**](docs/README.fr.md) | [**Deutsch**](docs/README.de.md) | [**Português**](docs/README.pt-BR.md) | [**Русский**](docs/README.ru.md) | [**Tiếng Việt**](docs/README.vi.md)

## Features

- Video & playlist download with format and quality selection
- Cross-platform support (Windows, macOS, Linux)
- Concurrent download queue with cancel and retry
- Download history with search
- Clean desktop UI built for yt-dlp

<details>
<summary>Advanced Features</summary>

- Automatic yt-dlp and FFmpeg dependency detection with installation guide
- Filename template customization (simple & advanced modes)
- Cookie support for authenticated content
- Duplicate download detection
- Multi-language support
- 4 color themes (Dark, Violet, Red, Light)

</details>

> **💡 Tip:** The app automatically sets up yt-dlp, FFmpeg, and Deno on first launch (bundled with the app and downloaded/updated as needed). The auto-managed yt-dlp build self-extracts on each run, so its first startup can be slow. For **significantly faster** metadata fetching and downloads, pre-install them via your system package manager — [Homebrew](https://brew.sh/) on macOS (`brew install yt-dlp ffmpeg`), [winget](https://learn.microsoft.com/windows/package-manager/winget/) on Windows (`winget install yt-dlp.yt-dlp ffmpeg`), or `apt`/`pacman` on Linux. By default the app detects and prefers the system-installed versions on your PATH.

## Build from Source

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (package manager)
- Platform-specific dependencies for [Tauri 2.0](https://v2.tauri.app/start/prerequisites/)

### Steps

```bash
# Clone the repository
git clone https://github.com/replayfix/JC_YouDownloader.git
cd JC_YouDownloader

# Install frontend dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

The production build output will be in `src-tauri/target/release/bundle/`.

## Credits & Third-party Licenses

JC_YouDownloader is based on [Yummy-Yt-Dlp by shlifedev](https://github.com/shlifedev/Yummy-Yt-Dlp).
The application name, package name (`jc-youdownloader`), and identifier
(`com.jc.youdownloader`) belong to this adaptation. Windows portable updates
use signed ZIP files published in this repository's GitHub Releases.

This app bundles or downloads the following open-source binaries:

- **yt-dlp** — The Unlicense — https://github.com/yt-dlp/yt-dlp
- **FFmpeg** — GPLv3 — bundled GPL builds: https://github.com/BtbN/FFmpeg-Builds (Windows/Linux), https://github.com/vanloctech/ffmpeg-macos (macOS); source: https://ffmpeg.org
- **Deno** — MIT — https://github.com/denoland/deno

FFmpeg is licensed under the GNU General Public License v3. The exact GPL build shipped with each release is linked above, with corresponding source available from the FFmpeg project and the build providers.

## License

This project is licensed under the [MIT License](LICENSE).
## Probar desde Visual Studio Code

Abre la carpeta del proyecto, abre una terminal y ejecuta:

```powershell
npm run desktop
```

La aplicación se abre en modo desarrollo y recarga la interfaz al guardar
cambios. Usa un puerto disponible y cierra sus procesos al detenerlo con
`Ctrl+C`. En PowerShell también puedes usar
`npm.cmd run desktop`.

El comando usa npm para iniciar la interfaz y busca Rust en la terminal o
en la ubicación habitual de rustup. Si usas una instalación de Rust en otra
carpeta, crea `.desktop.local.json` en la raíz del proyecto:

```json
{
  "cargoHome": "D:/Herramientas/Rust/cargo",
  "rustupHome": "D:/Herramientas/Rust/rustup"
}
```

Sustituye esas rutas por las de tu equipo. Este archivo se excluye de Git.
Al clonar el repositorio, instala las dependencias con
`npm ci --ignore-scripts`. Windows también necesita Microsoft C++ Build Tools
y WebView2 para ejecutar la aplicación de Tauri.

## Portable para Windows

Para generar el ejecutable con Node.js, Rust y Microsoft C++ Build Tools:

```powershell
npm ci --ignore-scripts
npm run build:portable
```

El resultado es `portable/JC_YouDownloader.exe`. Copia la carpeta completa,
con `portable.flag` y `binaries`. La configuración y el historial se guardan
 en `Data`; las descargas se guardan por defecto en `Descargas`.

## Actualizaciones del portable

El portable de Windows consulta:

```text
https://github.com/replayfix/JC_YouDownloader/releases/latest/download/latest.json
```

El botón «Buscar actualizaciones» descarga un ZIP cuya firma se verifica antes
de aplicarlo. Después de cerrar la aplicación, reemplaza el ejecutable y las
herramientas incluidas, y vuelve a abrir el programa. Conserva `Data`,
`Descargas` y las demás carpetas del usuario. Los archivos reemplazados se
guardan en `.updates` para recuperar la versión anterior si falla el reemplazo.
Las descargas activas deben terminar antes de actualizar.

En modo desarrollo se pueden consultar las versiones, pero la actualización
se aplica desde el portable publicado. Hasta la primera publicación, el
programa mostrará que todavía no hay versiones disponibles.

Para publicar una versión: GitHub → Actions → **Publicar portable Windows** →
**Run workflow**. Puedes indicar una versión mayor o dejarla vacía para
incrementar el último parche. La acción prueba, compila, comprime y firma el
portable, y publica el ZIP, su firma y `latest.json`. Los cambios de código
por sí solos no publican una versión.

Los secretos `TAURI_SIGNING_PRIVATE_KEY` y
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` están configurados en GitHub Actions.
La copia local de la clave y su contraseña está en `.updater-keys`, excluida
de Git. Conserva una copia segura de esa carpeta para futuras publicaciones.
Las versiones antiguas que no incluyen este actualizador necesitan descargar
manualmente el primer portable con esta función; las siguientes se actualizan
desde la aplicación.
