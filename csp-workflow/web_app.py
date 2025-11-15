from __future__ import annotations

import mimetypes
import json
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, render_template, request

from workflow_simulator import SCENARIOS, run_workflow_simulation

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

BASE_DIR = Path(__file__).resolve().parent
SETTINGS_PATH = BASE_DIR / "settings.json"


def load_settings() -> Dict[str, Any]:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {
            "defaults": {"num_agents": 6, "num_tasks": 120, "max_minutes": 480, "mode": "standard"},
            "ui": {"auto_run_on_load": True},
        }


APP_SETTINGS = load_settings()

app = Flask(__name__, static_folder="static", template_folder="templates")


@app.route("/threejs/")
def threejs_portal():
    scenario_meta = {
        key: {"label": scenario.label, "description": scenario.description}
        for key, scenario in SCENARIOS.items()
    }
    return render_template("threejs.html", scenarios=scenario_meta, config=APP_SETTINGS)


@app.route("/api/simulate", methods=["POST"])
def simulate():
    payload: Dict[str, Any] = request.get_json(silent=True) or {}
    defaults = APP_SETTINGS.get("defaults", {})
    num_agents = int(payload.get("num_agents", defaults.get("num_agents", 6)))
    num_tasks = int(payload.get("num_tasks", defaults.get("num_tasks", 120)))
    max_minutes = int(payload.get("max_minutes", defaults.get("max_minutes", 480)))
    mode = payload.get("mode", defaults.get("mode", "standard"))

    belt_value = payload.get("belt_multiplier", APP_SETTINGS.get("ui", {}).get("belt_default", 1))
    try:
        belt_multiplier = float(belt_value)
    except (TypeError, ValueError):
        belt_multiplier = 1.0

    result = run_workflow_simulation(num_agents, num_tasks, max_minutes, mode, belt_multiplier)
    return jsonify(result), 200


# Expose config for the frozen site with a friendly extension so Frozen-Flask
# emits config.json instead of a bare "config" file.
@app.route("/config.json", methods=["GET"])
def config():
    return jsonify(APP_SETTINGS), 200


@app.route("/")
def index():
    return render_template(
        "landing.html",
        message="Launch the Three.js office to explore workflow dynamics.",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5001)
