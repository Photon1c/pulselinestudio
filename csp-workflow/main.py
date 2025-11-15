from __future__ import annotations

import json
from pathlib import Path

from workflow_simulator import run_workflow_simulation

BASE_DIR = Path(__file__).resolve().parent
SETTINGS_PATH = BASE_DIR / "settings.json"


def load_settings() -> dict:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {
            "defaults": {"num_agents": 6, "num_tasks": 120, "max_minutes": 480, "mode": "standard"},
        }


def summarize(result: dict) -> str:
    stats = result.get("stats", {})
    metrics = result.get("metrics", {})
    backlog = result.get("backlog", {})
    backlog_minutes = backlog.get("total_minutes", 0)
    backlog_tasks = backlog.get("count", 0)
    util = round((stats.get("average_utilization") or 0) * 100, 1)
    throughput = round((metrics.get("throughput_ratio") or 0) * 100, 1)
    arrival = metrics.get("arrival_rate", 0)
    belt_speed = metrics.get("belt_speed", 1)
    status = "FLOW" if result.get("feasible") else "OVERFLOW"
    agents = result.get("agents", [])
    parameters = result.get("parameters", {})
    return (
        f"[{status}] {result['scenario']['label']}\n"
        f"Assistants: {len(agents)}/{parameters.get('requested_agents', len(agents))} "
        f"| Avg Utilization: {util}% | Throughput: {throughput}%\n"
        f"Backlog: {backlog_tasks} tasks / {backlog_minutes} minutes "
        f"| Arrival Rate: {arrival}/min | Belt: {belt_speed}x"
    )


if __name__ == "__main__":
    settings = load_settings()
    defaults = settings.get("defaults", {})
    ui = settings.get("ui", {})
    result = run_workflow_simulation(
        defaults.get("num_agents", 6),
        defaults.get("num_tasks", 120),
        defaults.get("max_minutes", 480),
        defaults.get("mode", "standard"),
        ui.get("belt_default", 1),
    )
    print(summarize(result))
