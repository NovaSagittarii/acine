## Setup

Tested on Windows 11 (decent emulator support).
Have an installation of Python and NodeJS.

> Can get it with [chocolately](https://chocolatey.org/install)
>
> ```sh
> choco install git python nvm
> nvm use 20.10.0 # or lts
> ```

1. Precommit setup

   ```sh
   pip install uv
   python -m uv sync
   python -m uv tool run pre-commit
   python -m uv tool run pre-commit install
   ```

2. Install dependencies

   ```sh
   npm i  # does a prepare cascade
   ```

3. Build protobufs (if changed)

   ```sh
   npm run build  # run protoc
   npm test       # run basic tests
   ```

4. Run

   ```sh
   npm run dev          # starts backend/frontend/test watchers
   npm run dev:testenv  # starts testenv (tkinter app)
   ```
