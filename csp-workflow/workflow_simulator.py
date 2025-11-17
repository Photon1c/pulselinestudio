from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Dict, List

from analyzer import analyze_assignments
from csp_solver import assign_tasks_to_agents
from task_generator import generate_tasks


@dataclass(frozen=True)
class Scenario:
    key: str
    label: str
    description: str
    min_duration: int = 1
    max_duration: int = 8
    task_multiplier: float = 1.0
    belt_speed: float = 1.0
    color: str = "#4caf50"
    queue_bias: float = 0.0


SCENARIOS: Dict[str, Scenario] = {
    "standard": Scenario(
        key="standard",
        label="Balanced Ops",
        description="Classic operations floor where inflow roughly matches processing capacity.",
        min_duration=2,
        max_duration=8,
        task_multiplier=1.0,
        belt_speed=1.0,
        color="#4caf50",
    ),
    "focus": Scenario(
        key="focus",
        label="Deep Work Pods",
        description="Fewer high-impact, longer tasks that test endurance instead of volume.",
        min_duration=5,
        max_duration=12,
        task_multiplier=0.65,
        belt_speed=0.6,
        color="#2196f3",
    ),
    "lucy": Scenario(
        key="lucy",
        label="Workload Spike",
        description="Chocolate belt chaos: frantic inflow of small tasks that overwhelm slow processing.",
        min_duration=1,
        max_duration=3,
        task_multiplier=2.25,
        belt_speed=2.0,
        color="#ff4081",
        queue_bias=0.35,
    ),
}


def _build_office_layout(agent_count: int, spacing: float = 6.0) -> Dict:
    if agent_count == 0:
        return {"rows": 0, "cols": 0, "positions": []}

    cols = math.ceil(math.sqrt(agent_count))
    rows = math.ceil(agent_count / cols)
    origin_x = (cols - 1) / 2
    origin_z = (rows - 1) / 2

    positions = []
    for agent_id in range(agent_count):
        row = agent_id // cols
        col = agent_id % cols
        positions.append(
            {
                "agent_id": agent_id,
                "x": (col - origin_x) * spacing,
                "z": (row - origin_z) * spacing,
            }
        )

    return {"rows": rows, "cols": cols, "cell_size": spacing, "positions": positions}


def _build_timeline(agents: List[List[int]]) -> List[Dict]:
    timeline = []
    for agent_id, task_stack in enumerate(agents):
        cursor = 0
        for seq, duration in enumerate(task_stack):
            segment = {
                "agent_id": agent_id,
                "sequence": seq,
                "start": cursor,
                "duration": duration,
                "end": cursor + duration,
            }
            timeline.append(segment)
            cursor += duration
    return timeline


def run_workflow_simulation(
    num_agents: int,
    num_tasks: int,
    max_minutes: int,
    mode: str = "standard",
    belt_multiplier: float = 1.0,
) -> Dict:
    scenario = SCENARIOS.get(mode, SCENARIOS["standard"])
    belt_multiplier = max(0.2, float(belt_multiplier or 1.0))
    adjusted_tasks = max(1, int(num_tasks * scenario.task_multiplier * belt_multiplier))
    tasks = generate_tasks(adjusted_tasks, scenario.min_duration, scenario.max_duration)

    agents, agent_times, feasible, backlog = assign_tasks_to_agents(tasks, num_agents, max_minutes)
    stats = analyze_assignments(agent_times, max_minutes)
    timeline = _build_timeline(agents)
    backlog_minutes = sum(backlog)

    processed_minutes = sum(agent_times)
    throughput_ratio = (
        processed_minutes / (processed_minutes + backlog_minutes) if processed_minutes else 0
    )
    arrival_rate = round(adjusted_tasks / max_minutes, 3) if max_minutes else adjusted_tasks
    belt_speed = scenario.belt_speed * belt_multiplier

    agents_payload = [
        {
            "id": idx,
            "tasks": stack,
            "total_time": agent_times[idx],
            "utilization": stats["utilization_by_agent"][idx] if stats["utilization_by_agent"] else 0,
        }
        for idx, stack in enumerate(agents)
    ]

    return {
        "parameters": {
            "requested_agents": num_agents,
            "requested_tasks": num_tasks,
            "max_minutes": max_minutes,
            "scenario_key": scenario.key,
            "belt_multiplier": belt_multiplier,
        },
        "scenario": asdict(scenario),
        "feasible": feasible,
        "agents": agents_payload,
        "agent_times": agent_times,
        "timeline": timeline,
        "stats": stats,
        "office_layout": _build_office_layout(len(agents)),
        "backlog": {
            "count": len(backlog),
            "total_minutes": backlog_minutes,
            "tasks": backlog[:100],
        },
        "metrics": {
            "processed_minutes": processed_minutes,
            "throughput_ratio": round(throughput_ratio, 3),
            "arrival_rate": arrival_rate,
            "belt_speed": belt_speed,
            "belt_multiplier": belt_multiplier,
            "queue_bias": scenario.queue_bias,
        },
    }
