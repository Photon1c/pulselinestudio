def analyze_assignments(agent_times, max_minutes=450):
    if not agent_times:
        return {
            "total_agents": 0,
            "overloaded_agents": [],
            "max_time_used": 0,
            "min_time_used": 0,
            "average_time_used": 0,
            "utilization_by_agent": [],
            "average_utilization": 0,
        }

    overloads = [i for i, t in enumerate(agent_times) if t > max_minutes]
    utilization_by_agent = [round(t / max_minutes, 4) for t in agent_times]
    average_utilization = sum(utilization_by_agent) / len(utilization_by_agent)
    return {
        "total_agents": len(agent_times),
        "overloaded_agents": overloads,
        "max_time_used": max(agent_times),
        "min_time_used": min(agent_times),
        "average_time_used": sum(agent_times) / len(agent_times),
        "utilization_by_agent": utilization_by_agent,
        "average_utilization": round(average_utilization, 4),
    }
