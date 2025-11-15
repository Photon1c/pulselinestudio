const SCENARIOS = {
  standard: {
    key: "standard",
    label: "Balanced Ops",
    description: "Classic operations floor where inflow roughly matches processing capacity.",
    min_duration: 2,
    max_duration: 8,
    task_multiplier: 1.0,
    belt_speed: 1.0,
    color: "#4caf50",
    queue_bias: 0,
  },
  focus: {
    key: "focus",
    label: "Deep Work Pods",
    description: "Fewer high-impact, longer tasks that test endurance instead of volume.",
    min_duration: 5,
    max_duration: 12,
    task_multiplier: 0.65,
    belt_speed: 0.6,
    color: "#2196f3",
    queue_bias: 0,
  },
  lucy: {
    key: "lucy",
    label: "I Love Lucy",
    description: "Chocolate belt chaos: frantic inflow of small tasks that overwhelm slow processing.",
    min_duration: 1,
    max_duration: 3,
    task_multiplier: 2.25,
    belt_speed: 2.0,
    color: "#ff4081",
    queue_bias: 0.35,
  },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTasks(count, minDuration, maxDuration) {
  return Array.from({ length: count }, () => randInt(minDuration, maxDuration));
}

function assignTasksToAssistants(tasks, assistantCount, maxMinutes) {
  const assistants = Array.from({ length: assistantCount }, () => []);
  const assistantTimes = Array.from({ length: assistantCount }, () => 0);
  const backlog = [];

  const sorted = [...tasks].sort((a, b) => b - a);
  sorted.forEach((task) => {
    let bestIndex = -1;
    let maxRemaining = -1;
    for (let i = 0; i < assistantCount; i++) {
      const remaining = maxMinutes - assistantTimes[i];
      if (task <= remaining && remaining > maxRemaining) {
        bestIndex = i;
        maxRemaining = remaining;
      }
    }
    if (bestIndex >= 0) {
      assistants[bestIndex].push(task);
      assistantTimes[bestIndex] += task;
    } else {
      backlog.push(task);
    }
  });

  return { assistants, assistantTimes, backlog, feasible: backlog.length === 0 };
}

function analyzeAssignments(assistantTimes, maxMinutes) {
  if (!assistantTimes.length) {
    return {
      total_agents: 0,
      overloaded_agents: [],
      max_time_used: 0,
      min_time_used: 0,
      average_time_used: 0,
      utilization_by_agent: [],
      average_utilization: 0,
    };
  }
  const overloaded = [];
  const utilization = assistantTimes.map((time, idx) => {
    if (time > maxMinutes) overloaded.push(idx);
    return Number((time / maxMinutes).toFixed(4));
  });
  const avgUtil = utilization.reduce((sum, val) => sum + val, 0) / utilization.length;
  const total = assistantTimes.reduce((sum, val) => sum + val, 0);
  return {
    total_agents: assistantTimes.length,
    overloaded_agents: overloaded,
    max_time_used: Math.max(...assistantTimes),
    min_time_used: Math.min(...assistantTimes),
    average_time_used: total / assistantTimes.length,
    utilization_by_agent: utilization,
    average_utilization: Number(avgUtil.toFixed(4)),
  };
}

function buildOfficeLayout(count, spacing = 6) {
  if (!count) {
    return { rows: 0, cols: 0, positions: [] };
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const originX = (cols - 1) / 2;
  const originZ = (rows - 1) / 2;
  const positions = [];
  for (let id = 0; id < count; id++) {
    const row = Math.floor(id / cols);
    const col = id % cols;
    positions.push({
      agent_id: id,
      x: (col - originX) * spacing,
      z: (row - originZ) * spacing,
    });
  }
  return { rows, cols, cell_size: spacing, positions };
}

function buildTimeline(assistants) {
  const timeline = [];
  assistants.forEach((stack, id) => {
    let cursor = 0;
    stack.forEach((duration, seq) => {
      timeline.push({
        agent_id: id,
        sequence: seq,
        start: cursor,
        duration,
        end: cursor + duration,
      });
      cursor += duration;
    });
  });
  return timeline;
}

export function runWorkflowSimulation({
  numAssistants,
  numTasks,
  maxMinutes,
  mode = "standard",
  beltMultiplier = 1,
}) {
  const scenario = SCENARIOS[mode] || SCENARIOS.standard;
  const beltFactor = Math.max(0.2, Number(beltMultiplier) || 1);
  const adjustedTasks = Math.max(1, Math.round(numTasks * scenario.task_multiplier * beltFactor));
  const tasks = generateTasks(adjustedTasks, scenario.min_duration, scenario.max_duration);
  const { assistants, assistantTimes, backlog, feasible } = assignTasksToAssistants(
    tasks,
    numAssistants,
    maxMinutes
  );
  const stats = analyzeAssignments(assistantTimes, maxMinutes);
  const timeline = buildTimeline(assistants);
  const backlogMinutes = backlog.reduce((sum, val) => sum + val, 0);
  const processedMinutes = assistantTimes.reduce((sum, val) => sum + val, 0);
  const throughputRatio = processedMinutes
    ? processedMinutes / (processedMinutes + backlogMinutes)
    : 0;
  const arrivalRate = maxMinutes ? Number((adjustedTasks / maxMinutes).toFixed(3)) : adjustedTasks;
  const beltSpeed = scenario.belt_speed * beltFactor;
  const layout = buildOfficeLayout(assistants.length);
  const agentsPayload = assistants.map((stack, idx) => ({
    id: idx,
    tasks: stack,
    total_time: assistantTimes[idx],
    utilization: stats.utilization_by_agent[idx] || 0,
  }));

  return {
    parameters: {
      requested_agents: numAssistants,
      requested_tasks: numTasks,
      max_minutes: maxMinutes,
      scenario_key: scenario.key,
      belt_multiplier: beltFactor,
    },
    scenario,
    feasible,
    agents: agentsPayload,
    agent_times: assistantTimes,
    timeline,
    stats,
    office_layout: layout,
    backlog: {
      count: backlog.length,
      total_minutes: backlogMinutes,
      tasks: backlog.slice(0, 100),
    },
    metrics: {
      processed_minutes: processedMinutes,
      throughput_ratio: Number(throughputRatio.toFixed(3)),
      arrival_rate: arrivalRate,
      belt_speed: Number(beltSpeed.toFixed(2)),
      belt_multiplier: beltFactor,
      queue_bias: scenario.queue_bias,
    },
  };
}

