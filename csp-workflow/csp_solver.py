def assign_tasks_to_agents(tasks, num_agents, max_minutes=450):
    """
    Greedy longest-processing-time heuristic that fills each agent's
    available minutes. Returns any tasks that could not be scheduled so the
    UI can visualize backlog-heavy scenarios (e.g., I Love Lucy mode).
    """
    agents = [[] for _ in range(num_agents)]
    agent_times = [0] * num_agents
    backlog = []

    for task in sorted(tasks, reverse=True):  # Greedy: assign longest tasks first
        # Find agent with most remaining time
        best_agent = None
        max_remaining = -1
        for i in range(num_agents):
            remaining = max_minutes - agent_times[i]
            if task <= remaining and remaining > max_remaining:
                best_agent = i
                max_remaining = remaining

        if best_agent is not None:
            agents[best_agent].append(task)
            agent_times[best_agent] += task
        else:
            backlog.append(task)

    feasible = len(backlog) == 0
    return agents, agent_times, feasible, backlog
