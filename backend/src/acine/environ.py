import os
from pathlib import Path
from typing import List


def get_start_command_candidates() -> List[str]:
    candidates: List[str] = []
    appdata_path = os.environ.get("APPDATA")
    if appdata_path:
        for lnk_path in Path(
            appdata_path,
            "Microsoft/Windows/Start Menu/Programs/Google Play Games",
        ).glob("*.lnk"):
            with open(lnk_path, "rb") as f:
                nonnull = f.read().replace(bytes([0]), bytes())
                start = nonnull.find("googleplaygames://".encode())
                end = nonnull.find("&lid=1&pid=1".encode()) + len("&lid=1&pid=1")
                # making the assumption that lid=1&pid=1 never changes
                url = nonnull[start:end].decode()
                candidates.append(f'start "" "{url}"')
                # WARNING: url contains ampersand and can break when run in cmd.exe
                # see https://stackoverflow.com/a/44513397
    return candidates


if __name__ == "__main__":
    print(get_start_command_candidates())
