import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { runWorkflowSimulation } from "./simulator.js";

const appConfig = window.APP_CONFIG || {};
const viewport = document.getElementById("viewport");
const agentsInput = document.getElementById("agentsInput");
const tasksInput = document.getElementById("tasksInput");
const minutesInput = document.getElementById("minutesInput");
const modeSelect = document.getElementById("modeSelect");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const spikeBtn = document.getElementById("spikeBtn");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const beltSlider = document.getElementById("beltSlider");
const beltValue = document.getElementById("beltValue");
const cycleBarFill = document.getElementById("cycleBarFill");
const assistantsPanel = document.getElementById("assistantsPanel");
const instructionsPanel = document.getElementById("instructionsPanel");
const overlayToggle = document.getElementById("overlayToggle");
const overlayEl = document.getElementById("overlay");
const controlsPanel = document.querySelector(".panel--controls");
const controlsCollapseBtn = document.getElementById("controlsCollapse");
const statusPill = document.getElementById("statusPill");
const fpsCounter = document.getElementById("fpsCounter");

const metricUtil = document.getElementById("metric-util");
const metricBacklog = document.getElementById("metric-backlog");
const metricBacklogCount = document.getElementById("metric-backlog-count");
const metricArrival = document.getElementById("metric-arrival");
const metricThroughput = document.getElementById("metric-throughput");
const metricAssistants = document.getElementById("metric-assistants");
const metricFlow = document.getElementById("metric-flow");
const metricBelt = document.getElementById("metric-belt");
const metricTasksAssistant = document.getElementById("metric-tasks-assistant");
const controlBacklogMinutes = document.getElementById("control-backlog-minutes");
const controlBacklogCount = document.getElementById("control-backlog-count");
const metricBacklogMinutesAlt = null;
const metricBacklogCountAlt = null;

let renderer, scene, camera, controls, clock;
let isPaused = false;
let hasRun = false;
let speedMultiplier = Number(speedSlider?.value) || 1;
let beltMultiplier = Number(beltSlider?.value) || appConfig?.ui?.belt_default || 1;
let agentMotionBoost = 0;
let instructionsVisible = false;
let fpsLastUpdate = performance.now();
let fpsFrameCount = 0;
let assistantsSnapshot = [];
let introTime = 0;
const introDuration = 6;
let introComplete = false;
const keyState = {};
const cameraHome = { position: new THREE.Vector3(24, 26, 32), target: new THREE.Vector3(0, 0, 0) };
const introStartPosition = new THREE.Vector3(0, 60, -85);
const cubiclesGroup = new THREE.Group();
const agentsGroup = new THREE.Group();
const queueGroup = new THREE.Group();
const clearingGroup = new THREE.Group();
const dispatchGroup = new THREE.Group();
const backlogPileGroup = new THREE.Group();
const agentMeshes = new Map();
let beltMesh;
const queueBoxes = [];
const backlogStacks = [];
const clearingPulses = [];
const dispatchBeams = [];
const layoutState = { positions: [] };
const queueState = { speed: 1, backlogCount: 0, arrivalRate: 0, throughputRatio: 0 };

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);

  const width = window.innerWidth;
  const height = window.innerHeight;
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.copy(introStartPosition);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.target.copy(cameraHome.target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;

  clock = new THREE.Clock();

  const hemiLight = new THREE.HemisphereLight(0xb7c9ff, 0x0b0d14, 1.1);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(30, 50, 20);
  scene.add(dirLight);

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x090c14,
    metalness: 0.2,
    roughness: 0.85,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  beltMesh = createBelt();
  queueGroup.add(beltMesh);

  scene.add(cubiclesGroup);
  scene.add(agentsGroup);
  scene.add(queueGroup);
  scene.add(backlogPileGroup);
  scene.add(clearingGroup);
  scene.add(dispatchGroup);

  window.addEventListener("resize", handleResize);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  animate();
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  runIntroAnimation(delta);
  controls.update();
  handleKeyboard(delta);
  if (!isPaused) {
    animateQueue(elapsed);
    animateClearingPulses(delta);
    animateDispatchBeams(delta);
    animateAgents(elapsed);
    agentMotionBoost = Math.max(0, agentMotionBoost - delta * 0.5);
  }
  updateFpsCounter();
  renderer.render(scene, camera);
}

function animateQueue(elapsed) {
  if (!queueBoxes.length) return;
  const speed = (queueState.speed || 1) * speedMultiplier;
  const spacing = 2.2;
  queueBoxes.forEach((entry, index) => {
    const loopLen = 32;
    const baseOffset = (elapsed * speed) % loopLen;
    const indexOffset = index * spacing;
    const totalOffset = (baseOffset + indexOffset) % loopLen;
    entry.mesh.position.x = -17 + totalOffset;
    if (entry.spacer) {
      entry.spacer.position.x = -17 + totalOffset + spacing * 0.5;
    }
    const hueShift = (elapsed * 0.12 + index * 0.05) % 1;
    entry.briefcaseBody.material.color.setHSL(0.08 + hueShift * 0.15, entry.backlog ? 0.75 : 0.45, entry.backlog ? 0.5 : 0.6);
  });
}

function createBelt() {
  const beltGeo = new THREE.BoxGeometry(32, 0.4, 3);
  const beltMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d38,
    metalness: 0.35,
    roughness: 0.4,
  });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.set(0, 0.2, -10);
  belt.receiveShadow = true;
  return belt;
}

function buildCubicles(layout) {
  layoutState.positions = layout?.positions || [];
  while (cubiclesGroup.children.length) {
    const child = cubiclesGroup.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }

  const deskGeo = new THREE.BoxGeometry(3, 0.8, 2);
  const wallGeo = new THREE.BoxGeometry(0.1, 2, 2.5);
  layout.positions.forEach((pos) => {
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x1b1f2f,
      metalness: 0.1,
      roughness: 0.7,
    });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(pos.x, 0.4, pos.z);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2c3148,
      metalness: 0.05,
      roughness: 0.9,
    });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(pos.x - 1.5, 1, pos.z);

    const rightWall = leftWall.clone();
    rightWall.position.x = pos.x + 1.5;

    cubiclesGroup.add(desk, leftWall, rightWall);
  });
}

function syncAgents(agents, layout) {
  const activeIds = new Set();
  agents.forEach((agent, index) => {
    const seat = layout.positions[index];
    if (!seat) return;
    let mesh = agentMeshes.get(agent.id);
    if (!mesh) {
      const geo = new THREE.CylinderGeometry(0.5, 0.7, 2.2, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x7ef29d,
        emissive: 0x000000,
        metalness: 0.3,
        roughness: 0.4,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      agentsGroup.add(mesh);
      agentMeshes.set(agent.id, mesh);
      mesh.userData.wobbleOffset = Math.random() * Math.PI * 2;
    }
    const util = clamp(agent.utilization || 0, 0, 1);
    mesh.material.color.set(colorFromUtil(util));
    mesh.position.set(seat.x, 1.2, seat.z);
    mesh.scale.y = 0.9 + util * 0.8;
    mesh.userData.baseY = 1.2;
    mesh.userData.baseX = seat.x;
    mesh.userData.baseZ = seat.z;
    mesh.userData.util = util;
    activeIds.add(agent.id);
  });

  agentMeshes.forEach((mesh, id) => {
    if (!activeIds.has(id)) {
      agentsGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      agentMeshes.delete(id);
    }
  });
}

function updateQueue(backlogCount, beltSpeed, arrivalRate, throughputRatio) {
  queueBoxes.forEach((entry) => {
    if (entry.mesh) {
      queueGroup.remove(entry.mesh);
      // Dispose of all children (briefcase body and handle)
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    if (entry.spacer) {
      queueGroup.remove(entry.spacer);
      if (entry.spacer.geometry) entry.spacer.geometry.dispose();
      if (entry.spacer.material) {
        if (Array.isArray(entry.spacer.material)) {
          entry.spacer.material.forEach((mat) => mat.dispose());
        } else {
          entry.spacer.material.dispose();
        }
      }
    }
  });
  queueBoxes.length = 0;
  backlogStacks.forEach((mesh) => {
    backlogPileGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  backlogStacks.length = 0;

  const inflowUnits = Math.max(Math.round(arrivalRate * 5), 4);
  const displayCount = Math.min(backlogCount + inflowUnits, 24);
  const spacing = 2.2;
  for (let i = 0; i < displayCount; i++) {
    const bodyGeo = new THREE.BoxGeometry(1.4, 0.9, 0.5);
    const handleGeo = new THREE.TorusGeometry(0.25, 0.05, 12, 24, Math.PI);
    const isBacklog = i < backlogCount;
    const severity = backlogCount ? i / backlogCount : i / Math.max(displayCount, 1);
    const color = isBacklog
      ? severity > 0.66
        ? 0xff5f5f
        : severity > 0.33
        ? 0xffc857
        : 0xf4f991
      : 0x78e8ff;
    const matBody = new THREE.MeshStandardMaterial({
      color,
      emissive: isBacklog ? 0x1a0a0a : 0x051012,
      metalness: 0.2,
      roughness: 0.4,
    });
    const matHandle = new THREE.MeshStandardMaterial({
      color: 0x151515,
      metalness: 0.5,
      roughness: 0.25,
    });
    const briefcase = new THREE.Mesh(bodyGeo, matBody);
    const handle = new THREE.Mesh(handleGeo, matHandle);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.55, 0);
    const group = new THREE.Group();
    group.add(briefcase);
    group.add(handle);
    group.position.set(-17 + i * spacing, 0.8, -10 + Math.sin(i * 0.35) * 0.35);
    queueGroup.add(group);
    
    const entry = { mesh: group, backlog: isBacklog, briefcaseBody: briefcase };
    
    if (i < displayCount - 1) {
      const spacerGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
      const spacerMat = new THREE.MeshStandardMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
      });
      const spacer = new THREE.Mesh(spacerGeo, spacerMat);
      spacer.position.set(-17 + i * spacing + spacing * 0.5, 0.8, -10);
      queueGroup.add(spacer);
      entry.spacer = spacer;
    }
    
    queueBoxes.push(entry);
  }
  queueState.speed = Math.max(0.5, beltSpeed);
  queueState.arrivalRate = arrivalRate;
  queueState.throughputRatio = throughputRatio;
  const cleared = Math.max(queueState.backlogCount - backlogCount, 0);
  const backlogDelta = backlogCount - queueState.backlogCount;
  queueState.backlogCount = backlogCount;
  beltMesh.material.color.set(backlogCount > 18 ? 0xff5f5f : backlogCount > 10 ? 0xffc857 : 0x2a2d38);
  if (cleared) {
    spawnClearingPulses(cleared);
  }
  if (backlogDelta <= 0) {
    spawnDispatchBeams(Math.max(1, Math.round(arrivalRate * 1.5)));
  }
  updateBacklogPile(backlogCount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function colorFromUtil(util) {
  const clamped = clamp(util, 0, 1);
  const color = new THREE.Color();
  const hue = (0.33 - 0.33 * clamped + 1) % 1;
  color.setHSL(hue, 0.65, 0.5);
  return color;
}

async function runScenario(modeShortcut, triggerButton, silent = false) {
  const payload = {
    num_agents: Number(agentsInput.value),
    num_tasks: Number(tasksInput.value),
    max_minutes: Number(minutesInput.value),
    mode: modeShortcut || modeSelect.value,
    belt_multiplier: beltMultiplier,
  };
  console.log("runScenario called with payload:", {
    num_agents: payload.num_agents,
    num_tasks: payload.num_tasks,
    max_minutes: payload.max_minutes,
    mode: payload.mode,
    belt_multiplier: payload.belt_multiplier
  });
  const activeButton = silent ? null : triggerButton || playBtn;
  setLoading(true, activeButton);
  try {
    const data = runWorkflowSimulation({
      numAssistants: payload.num_agents,
      numTasks: payload.num_tasks,
      maxMinutes: payload.max_minutes,
      mode: payload.mode,
      beltMultiplier: payload.belt_multiplier,
    });
    console.log("runWorkflowSimulation returned:", {
      agentsLength: data.agents?.length,
      requestedAgents: data.parameters?.requested_agents,
      backlogCount: data.backlog?.count,
      backlogMinutes: data.backlog?.total_minutes,
      agentIds: data.agents?.map(a => a.id)
    });
    applySimulation(data);
  } catch (error) {
    console.error("Simulation failed", error);
  } finally {
    setLoading(false, activeButton);
    if (!silent) {
      flashButtonState(activeButton || playBtn);
    }
  }
}

function applySimulation(data) {
  if (!data) {
    console.error("applySimulation: no data provided");
    return;
  }
  console.log("applySimulation:", {
    agentsCount: data.agents?.length,
    requestedAgents: data.parameters?.requested_agents,
    backlogCount: data.backlog?.count,
    backlogMinutes: data.backlog?.total_minutes,
    agents: data.agents?.map(a => ({ id: a.id, tasks: a.tasks?.length }))
  });
  assistantsSnapshot = data.agents || [];
  buildCubicles(data.office_layout);
  syncAgents(data.agents, data.office_layout);
  updateQueue(
    data.backlog.count,
    data.metrics.belt_speed,
    data.metrics.arrival_rate,
    data.metrics.throughput_ratio
  );
  updateMetricsPanel(data);
  isPaused = false;
  hasRun = true;
  agentMotionBoost = 1.2;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function updateMetricsPanel(data) {
  if (!data) {
    console.warn("updateMetricsPanel: no data provided");
    return;
  }
  const assistants = data.agents || [];
  console.log("updateMetricsPanel called with:", {
    assistantsLength: assistants.length,
    requestedAgents: data.parameters?.requested_agents,
    backlogCount: data.backlog?.count,
    backlogMinutes: data.backlog?.total_minutes
  });
  const scenarioMeta = window.SCENARIO_META?.[data.parameters?.scenario_key];
  const label = scenarioMeta?.label || data.scenario?.label || "Unknown";
  const status = data.feasible ? "Flowing" : "Overflow";
  if (statusPill) {
    statusPill.innerHTML = `<span>${status}</span> · ${label}`;
    statusPill.style.background = data.feasible
      ? "rgba(126, 242, 157, 0.2)"
      : "rgba(255, 107, 129, 0.2)";
  }

  const avgUtil = safeNumber(data.stats?.average_utilization || 0);
  const utilPercent = Math.round(avgUtil * 100);
  const throughputRatio = safeNumber(data.metrics?.throughput_ratio || 0);
  const throughputPct = Math.round(throughputRatio * 100);
  const processedMinutes = safeNumber(data.metrics?.processed_minutes || 0);
  const maxMinutes = safeNumber(data.parameters?.max_minutes || 0);
  const completionRate = maxMinutes > 0 ? processedMinutes / maxMinutes : 0;
  const arrivalRate = safeNumber(data.metrics?.arrival_rate || 0);
  const flowDelta = safeNumber(arrivalRate - completionRate);

  if (metricUtil) metricUtil.textContent = `${utilPercent}%`;
  const totalMinutes = safeNumber(data.backlog?.total_minutes || 0);
  const backlogTasks = safeNumber(data.backlog?.count || 0);
  const formattedMinutes = formatNumber(Math.round(totalMinutes));
  const formattedTasks = formatNumber(Math.round(backlogTasks));
  if (metricBacklog) metricBacklog.textContent = formattedMinutes;
  if (metricBacklogCount) metricBacklogCount.textContent = formattedTasks;
  if (controlBacklogMinutes) controlBacklogMinutes.textContent = formattedMinutes;
  if (controlBacklogCount) controlBacklogCount.textContent = formattedTasks;
  const tasksPerAssistant = assistants.length
    ? assistants.reduce((sum, agent) => sum + (agent.tasks?.length || 0), 0) / assistants.length
    : 0;
  if (metricTasksAssistant) metricTasksAssistant.textContent = `${tasksPerAssistant.toFixed(1)}`;
  if (metricArrival) metricArrival.textContent = `${arrivalRate.toFixed(3)}/min`;
  if (metricThroughput) metricThroughput.textContent = `${throughputPct}%`;
  const requestedAgents = safeNumber(data.parameters?.requested_agents || 0);
  const actualAgents = assistants.length;
  console.log("Setting assistant count:", { actualAgents, requestedAgents });
  if (metricAssistants) metricAssistants.textContent = `${actualAgents} / ${requestedAgents}`;
  if (metricFlow) metricFlow.textContent = `${flowDelta >= 0 ? "+" : ""}${flowDelta.toFixed(2)}/min`;
  if (metricBelt) metricBelt.textContent = `${safeNumber(data.metrics?.belt_speed || 1).toFixed(1)}x`;
  updateProductionCycle(throughputPct, backlogTasks);
  renderAssistantsPanel(assistants);
}

function spawnClearingPulses(count) {
  const spawnCount = Math.min(count, 6);
  for (let i = 0; i < spawnCount; i++) {
    const geo = new THREE.SphereGeometry(0.3, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7ef29d,
      emissive: 0x112211,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-8 + Math.random() * 16, 0.6, -10);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5 + Math.random() * 0.5, 4 + Math.random() * 1.5).normalize();
    clearingGroup.add(mesh);
    clearingPulses.push({
      mesh,
      life: 1.6,
      direction: dir,
      speed: 6 + Math.random() * 2,
    });
  }
}

function animateClearingPulses(delta) {
  for (let i = clearingPulses.length - 1; i >= 0; i--) {
    const pulse = clearingPulses[i];
    pulse.life -= delta;
    pulse.mesh.position.addScaledVector(pulse.direction, pulse.speed * delta);
    pulse.mesh.material.opacity = Math.max(0, pulse.mesh.material.opacity - delta * 0.8);
    if (pulse.life <= 0) {
      clearingGroup.remove(pulse.mesh);
      pulse.mesh.geometry.dispose();
      pulse.mesh.material.dispose();
      clearingPulses.splice(i, 1);
    }
  }
}

function spawnDispatchBeams(count) {
  if (!layoutState.positions.length) return;
  const spawnTotal = Math.min(count, layoutState.positions.length * 2);
  for (let i = 0; i < spawnTotal; i++) {
    const seat = layoutState.positions[Math.floor(Math.random() * layoutState.positions.length)];
    const start = new THREE.Vector3((Math.random() - 0.5) * 18, 1.2 + Math.random() * 0.6, -11 + Math.random());
    const end = new THREE.Vector3(seat.x + (Math.random() - 0.5) * 1.5, 1.5, seat.z + (Math.random() - 0.5) * 1.5);
    const geo = new THREE.ConeGeometry(0.25, 0.9, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7df0ff,
      emissive: 0x113344,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    dispatchGroup.add(mesh);
    dispatchBeams.push({
      mesh,
      start,
      end,
      progress: 0,
      speed: 0.8 + Math.random() * 0.6,
    });
  }
}

function animateDispatchBeams(delta) {
  for (let i = dispatchBeams.length - 1; i >= 0; i--) {
    const beam = dispatchBeams[i];
    beam.progress += delta * beam.speed;
    const t = Math.min(beam.progress, 1);
    beam.mesh.position.lerpVectors(beam.start, beam.end, t);
    beam.mesh.scale.setScalar(0.8 + Math.sin(t * Math.PI) * 0.2);
    if (t >= 1) {
      dispatchGroup.remove(beam.mesh);
      beam.mesh.geometry.dispose();
      beam.mesh.material.dispose();
      dispatchBeams.splice(i, 1);
    }
  }
}

function setLoading(isLoading, activeButton) {
  [playBtn, spikeBtn].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle("btn--loading", isLoading && btn === activeButton);
  });
  if (playBtn) {
    playBtn.textContent = isLoading && activeButton === playBtn ? "Running..." : "Run";
  }
  if (spikeBtn) {
    spikeBtn.textContent = isLoading && activeButton === spikeBtn ? "Spiking..." : "Workload Spike";
  }
}

function initUI() {
  applyConfigDefaults();
  setInstructionsVisible(false);
  setupOverlayControls();
  playBtn.addEventListener("click", () => {
    if (isPaused && hasRun) {
      isPaused = false;
      return;
    }
    runScenario(undefined, playBtn);
  });
  pauseBtn.addEventListener("click", () => {
    isPaused = true;
  });
  spikeBtn.addEventListener("click", () => {
    modeSelect.value = "lucy";
    runScenario("lucy", spikeBtn);
  });
  if (speedSlider) {
    speedSlider.addEventListener("input", () => {
      speedMultiplier = Number(speedSlider.value);
      if (speedValue) {
        speedValue.textContent = `${speedMultiplier.toFixed(1)}x`;
      }
    });
    speedMultiplier = Number(speedSlider.value);
    if (speedValue) speedValue.textContent = `${speedMultiplier.toFixed(1)}x`;
  }
  if (beltSlider) {
    beltSlider.addEventListener("input", () => {
      beltMultiplier = Number(beltSlider.value);
      updateBeltDisplay();
    });
    beltSlider.addEventListener("change", () => {
      if (hasRun) {
        runScenario();
      }
    });
    beltMultiplier = Number(beltSlider.value);
    updateBeltDisplay();
  }
}

function applyConfigDefaults() {
  const defaults = appConfig?.defaults || {};
  if (defaults.num_agents) agentsInput.value = defaults.num_agents;
  if (defaults.num_tasks) tasksInput.value = defaults.num_tasks;
  if (defaults.max_minutes) minutesInput.value = defaults.max_minutes;
  if (defaults.mode) modeSelect.value = defaults.mode;
  const ui = appConfig?.ui || {};
  if (beltSlider && ui.belt_default) {
    beltSlider.value = ui.belt_default;
    beltMultiplier = Number(beltSlider.value);
    updateBeltDisplay();
  }
}

function setupOverlayControls() {
  if (overlayToggle && overlayEl) {
    overlayToggle.addEventListener("click", () => {
      overlayEl.classList.toggle("overlay--hidden");
      overlayToggle.classList.toggle("overlay-toggle--active");
    });
  }
  if (controlsCollapseBtn && controlsPanel) {
    controlsCollapseBtn.addEventListener("click", () => {
      controlsPanel.classList.toggle("panel--collapsed");
      controlsCollapseBtn.textContent = controlsPanel.classList.contains("panel--collapsed") ? "+" : "–";
    });
  }
}

initThree();
initUI();
if (appConfig?.ui?.auto_run_on_load !== false) {
  runScenario(undefined, null, true);
}

function animateAgents(elapsed) {
  const wobbleAmp = 0.05 + agentMotionBoost * 0.12;
  agentMeshes.forEach((mesh) => {
    const offset = mesh.userData.wobbleOffset || 0;
    const util = mesh.userData.util || 0;
    const speed = 1 + util * 1.8 + agentMotionBoost * 0.5;
    const wobble = Math.sin(elapsed * speed + offset) * (wobbleAmp * (1 + util));
    mesh.position.y = (mesh.userData.baseY || 1.2) + wobble;
    mesh.rotation.z = Math.sin(elapsed * (0.8 + util) + offset) * wobbleAmp * 0.6;
    mesh.rotation.x = Math.cos(elapsed * (0.6 + util * 0.5) + offset) * wobbleAmp * 0.4;
  });
}

function handleKeyDown(event) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (event.code === "KeyI") {
    event.preventDefault();
    setInstructionsVisible(!instructionsVisible);
    return;
  }
  if (event.code === "KeyP") {
    event.preventDefault();
    isPaused = !isPaused;
    return;
  }
  keyState[event.code] = true;
  if (event.code === "KeyR") {
    resetCamera();
  }
}

function handleKeyUp(event) {
  keyState[event.code] = false;
}

function handleKeyboard(delta) {
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const speed = 15 * delta;

  if (keyState["KeyW"]) move.addScaledVector(forward, speed);
  if (keyState["KeyS"]) move.addScaledVector(forward, -speed);
  if (keyState["KeyA"]) move.addScaledVector(right, -speed);
  if (keyState["KeyD"]) move.addScaledVector(right, speed);
  if (keyState["KeyQ"]) move.addScaledVector(up, -speed);
  if (keyState["KeyE"]) move.addScaledVector(up, speed);

  if (move.lengthSq() > 0) {
    camera.position.add(move);
    controls.target.add(move);
    controls.update();
  }
}

function resetCamera() {
  camera.position.copy(cameraHome.position);
  controls.target.copy(cameraHome.target);
  controls.update();
}

function updateBeltDisplay() {
  if (beltValue) {
    beltValue.textContent = `${beltMultiplier.toFixed(1)}x`;
  }
}

function updateProductionCycle(throughputPct, backlogCount) {
  if (!cycleBarFill) return;
  const pct = clamp(throughputPct, 0, 100);
  cycleBarFill.style.width = `${pct}%`;
  if (backlogCount > 15) {
    cycleBarFill.style.background = "linear-gradient(90deg, #ff5f5f, #ffc857)";
  } else if (backlogCount > 5) {
    cycleBarFill.style.background = "linear-gradient(90deg, #ffc857, #7ef29d)";
  } else {
    cycleBarFill.style.background = "linear-gradient(90deg, #78e8ff, #7ef29d)";
  }
}

function renderAssistantsPanel(agents = []) {
  if (!assistantsPanel) return;
  if (!agents.length) {
    assistantsPanel.innerHTML = "<p>Assistants will appear here after you run a simulation.</p>";
    return;
  }
  const fragment = document.createDocumentFragment();
  agents.forEach((agent) => {
    const agentId = safeNumber(agent.id);
    const label = `A${agentId}`;
    const row = document.createElement("div");
    row.className = "assistant-row";
    const taskCount = agent.tasks?.length || 0;
    const avg = taskCount > 0 && agent.total_time ? safeNumber(agent.total_time) / taskCount : 0;
    const avgLabel = formatDuration(avg);
    row.innerHTML = `<strong>${label}</strong><span>${taskCount} tasks · ${avgLabel}/task</span>`;
    fragment.appendChild(row);
  });
  assistantsPanel.innerHTML = "";
  assistantsPanel.appendChild(fragment);
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
  }
  return `${minutes.toFixed(1)}m`;
}

function setInstructionsVisible(state) {
  instructionsVisible = !!state;
  if (instructionsPanel) {
    instructionsPanel.classList.toggle("is-visible", instructionsVisible);
    instructionsPanel.setAttribute("aria-hidden", String(!instructionsVisible));
  }
}

function updateBacklogPile(backlogCount) {
  if (backlogCount <= 0) return;
  const layers = Math.min(Math.ceil(backlogCount / 12), 6);
  for (let layer = 0; layer < layers; layer++) {
    const count = Math.min(backlogCount - layer * 12, 12);
    for (let i = 0; i < count; i++) {
      const bookWidth = 0.6 + Math.random() * 0.4;
      const bookHeight = 0.7 + Math.random() * 0.4;
      const bookDepth = 0.9;
      const geo = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
      const hue = 0.02 + layer * 0.04 + i * 0.01;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL((hue % 1), 0.6, 0.55),
        emissive: 0x0a0a0a,
        roughness: 0.35,
        metalness: 0.15,
      });
      const book = new THREE.Mesh(geo, mat);
      book.position.set(-26 + i * 1.1 + (layer % 2) * 0.4, 0.35 + layer * 0.55, -13 + Math.sin(i) * 0.2);
      book.rotation.y = (Math.random() - 0.5) * 0.4;
      backlogPileGroup.add(book);
      backlogStacks.push(book);
    }
  }
}

function updateFpsCounter() {
  if (!fpsCounter) return;
  fpsFrameCount += 1;
  const now = performance.now();
  const elapsed = now - fpsLastUpdate;
  if (elapsed >= 500) {
    const fps = Math.round((fpsFrameCount / elapsed) * 1000);
    fpsCounter.textContent = `FPS: ${fps}`;
    fpsFrameCount = 0;
    fpsLastUpdate = now;
  }
}

function flashButtonState(button) {
  if (!button) return;
  button.classList.add("btn--flash");
  setTimeout(() => button.classList.remove("btn--flash"), 450);
}

function runIntroAnimation(delta) {
  if (introComplete) return;
  introTime += delta;
  const t = Math.min(introTime / introDuration, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  const angle = THREE.MathUtils.lerp(-Math.PI / 2.5, Math.PI / 6, eased);
  const radius = THREE.MathUtils.lerp(85, cameraHome.position.length(), eased);
  const height = THREE.MathUtils.lerp(introStartPosition.y, cameraHome.position.y, eased);
  camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  camera.lookAt(cameraHome.target);
  if (t >= 1) {
    introComplete = true;
    camera.position.copy(cameraHome.position);
    controls.enabled = true;
    controls.target.copy(cameraHome.target);
  }
}
