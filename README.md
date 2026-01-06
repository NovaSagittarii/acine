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

## Compatibility Notes

acine uses [AutoHotkey](https://www.autohotkey.com/) via the
[ahk](https://github.com/spyoungtech/ahk) Python package to simulate inputs.
In windowed mode (useful if you want to still use the device), there are
issues with Unity/UE-based games (they read from hardware mouse location,
ignoring mouse events sent to window).

| Platform                                                                                                       | OS                   | Windowed support                | Screenless support (i.e. laptop closed, screen off) |
| -------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------- | --------------------------------------------------- |
| [crosvm](https://github.com/google/crosvm) / [Google Play Games beta](https://play.google.com/googleplaygames) | win32                | :white_check_mark:              | :white_check_mark:                                  |
| [Mumu Emulator](https://www.mumuplayer.com)                                                                    | win32                | :white_check_mark:              | :warning: non-minimized active RDP session can work |
| Unity / Unreal Engine                                                                                          | win32 (probably any) | :x: virtual mouse does not work | :grey_question:                                     |
