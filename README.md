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
   pip install uv                          # install uv (for venv)
   python -m uv venv --seed --python 3.12  # init venv
   # then activate venv
   pip install -r requirements.txt         # for pre-commit hooks
   pre-commit
   pre-commit install
   ```

2. Build protobufs

   ```sh
   cd proto       # go to /proto
   npm i          # setup envs (does a prepare cascade)
   npm run build  # run protoc
   npm test       # run basic tests
   ```

3. Setup backend

   ```sh
   cd backend  # go to /backend
   python -m uv venv --seed
   .venv/Scripts/activate  # activate venv
   pip install uv
   uv pip install -r requirements.txt
   uv pip install -e . ../proto/dist/py
   python main.py  # start server
   ```

4. Setup frontend

   ```sh
   cd frontend  # go to /frontend
   npm i
   npm i ../proto/dist/ts
   npm run dev  # start frontend
   ```
