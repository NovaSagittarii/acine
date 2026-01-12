# acine

acine is an image-based automation tool that uses a navigation graph
overlaid with a dependency graph to simplify the scheduling of and iterative
changes to an automation process.

> [!NOTE]
> acine is still in development.

## Setup

Tested on Windows 11, it has decent emulator support.
Have an installation of Python and NodeJS.

> Can get it with [chocolately](https://chocolatey.org/install)
>
> ```sh
> choco install git python nvm
> nvm use 20.10.0 # or lts
> ```

> Installing [Task](https://taskfile.dev/docs/installation#winget)
>
> ```sh
> winget install Task.Task
> ```

1. Install dependencies

   ```sh
   pip install uv  # this project uses uv package manager
   npm i           # does a prepare cascade (installs all deps)
   ```

2. $\scriptsize\texttt{DEV}$ Build protobufs (when they change)

   ```sh
   npm run build  # run protoc
   ```

3. $\scriptsize\texttt{DEV}$ Precommit setup

   ```sh
   python -m uv sync
   python -m uv tool run pre-commit
   python -m uv tool run pre-commit install
   ```

4. $\scriptsize\texttt{DEV}$ Run

   ```sh
   npm run dev          # starts backend/frontend/test watchers
   npm run dev:testenv  # starts testenv (lightweight tkinter app)
   ```

   > [!NOTE]
   > Opening the example routine in the editor will launch
   > testenv so it's unlikely you need to run it via npm run.

5. Run

   ```sh
   npm run main:build   # run this once (build editor)
   npm run editor       # run editor program (web on :4173, background on :9000)
   npm run background   # run one routine
   npm start            # run multischeduler
   ```

   > [!CAUTION]
   > Do not expose backend publicly, app runs arbitrary startCommand to
   > launch application if window is not open.

## Compatibility Notes

acine uses [AutoHotkey](https://www.autohotkey.com/) via the
[ahk](https://github.com/spyoungtech/ahk) Python package to simulate inputs.
In windowed mode (useful if you want to still use the device), there are
issues with Unity/UE-based games (they read from hardware mouse location,
ignoring mouse events sent to window).

Tested on Windows 11 Pro.

| Platform                                                                                                       | OS                   | Windowed support                | Display Off support                                 | Update support  |
| -------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------- | --------------------------------------------------- | --------------- |
| [crosvm](https://github.com/google/crosvm) / [Google Play Games beta](https://play.google.com/googleplaygames) | win32                | :white_check_mark:              | :white_check_mark:                                  | :x:             |
| [Mumu Emulator](https://www.mumuplayer.com)                                                                    | win32                | :white_check_mark:              | :warning: non-minimized active RDP session can work | :warning:       |
| Unity / Unreal Engine                                                                                          | win32 (probably any) | :x: virtual mouse does not work | :grey_question:                                     | :grey_question: |

### crosvm / Google Play Games beta

Works without issues. Update is a bit broken since it opens the launcher.

### MuMu Emulator

Updating apps works fine due to the usable tab UI, however upon launch, there
is a new window for the emulator update (stalls opening emulator).

MuMu emulator window stops refreshing upon display off, to get around this
restriction, you can have an active non-minimized RDP session connected to
itself via [node-rdpjs](https://github.com/citronneur/node-rdpjs) or really any
RDP client (such as [FreeRDP](https://www.freerdp.com/)).
Windows RDP client (mstsc) doesn't want to connect to itself, raises this error:

> Your computer could not connect to another console session on the remote
> computer because you already have a console session in progress.

Node-based script (7.14MB, 6.8MiB)

```js
// node-rdpjs doesn't support NLA so disable requiring NLA
// npm i node-rdpjs                                         # node=0.10.x (veryold)
// npm i node-rdpjs@https://github.com/t-system/node-rdpjs  # node>=8.5.0
var rdp = require("node-rdpjs");
var client = rdp
  .createClient({
    domain: "my_domain",
    userName: "my_username",
    password: "my_password",
    enablePerf: true,
    autoLogin: true,
    decompress: false,
    screen: { width: 1920, height: 1280 },
    locale: "en",
    logLevel: "INFO",
  })
  .on("connect", function () {})
  .on("close", function () {})
  .on("bitmap", function (bitmap) {})
  .on("error", function (err) {})
  .connect("XXX.XXX.XXX.XXX", 3389);
```

For FreeRDP, install `wfreerdp.exe` from the nightly builds page (8.5MiB)
and run the following (at the time of writing, there's no help text):

```batch
wfreerdp.exe /w:1920 /h:1280 /v:localhost
wfreerdp.exe /w:1920 /h:1280 /v:localhost /u:USERNAME
```
