from flask_frozen import Freezer

import shutil
from pathlib import Path

from web_app import app

BASE_DIR = Path(__file__).resolve().parent
BUILD_DIR = BASE_DIR / "build"

app.config["FREEZER_DESTINATION"] = str(BUILD_DIR)
app.config["FREEZER_REMOVE_EXTRA_FILES"] = True


def main() -> None:
  if BUILD_DIR.exists():
    shutil.rmtree(BUILD_DIR)
  freezer = Freezer(app)
  freezer.freeze()


if __name__ == "__main__":
  main()

