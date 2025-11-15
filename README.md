# Pulseline Studio

Immersive Three.js visualizer driven by a lightweight Flask API. Use it to stress-test assistant staffing, visualize queue pressure, and demo how different operational scenarios behave on a buzzing office floor.

A command center where staffing, queue pressure, and live production health pulse alive. Run scenarios through a Flask-powered simulator, watch the conveyor belt, backlog cubes, and beam effects respond in real time, and navigate the map. Adjust the control panel as you dial in arrival rates, belt speed, and assistant counts. This repository houses a starting template for more complex world models around this project.


## Project Layout

```
csp-workflow/
├─ analyzer.py              # Utilization + stats helpers
├─ csp_solver.py            # Greedy longest-processing-time allocator
├─ freeze.py                # Frozen-Flask builder that outputs /build
├─ main.py                  # CLI runner that reuses the simulator pipeline
├─ netlify.toml             # Netlify build config (static-only)
├─ requirements.txt
├─ settings.json            # UI + API defaults (assistants, tasks, etc.)
├─ static/
│  ├─ css/threejs.css
│  └─ js/threejs_scene.js   # Scene logic + visual effects
├─ templates/
│  ├─ landing.html
│  └─ threejs.html
├─ web_app.py               # Flask wires everything together (dev preview)
└─ workflow_simulator.py    # Scenario definitions + orchestration
```

## Quick Start

```bash
cd AGIworld/csp-workflow
python -m venv .venv
.venv\Scripts\activate          # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python web_app.py               # dev server with live templates
# Navigate to http://localhost:5001/threejs
```

### Freezing to a static site

Pulseline Studio now runs entirely in the browser (simulation logic was ported to JavaScript), so you can generate a Netlify-ready bundle via Frozen-Flask:

```bash
pip install -r requirements.txt
python freeze.py
# Static assets land in ./build
```

Set Netlify’s publish directory to `build` (or run `netlify dev --dir build` locally).

### Updating defaults

Edit `settings.json` to change the initial number of assistants, tasks, max minutes, and the default scenario key. The same file also controls UI limits and whether the scene auto-runs on load. Values feed both the Flask API (fallback payloads) and the Three.js panel, so you only need to update them in one place.

### Live metrics & cues

The panel now surfaces:

- Avg utilization + throughput %
- Backlog minutes and task counts
- Arrival rate, belt speed, and flow delta (arrival vs. effective completion rate)
- Active assistant tally that reflects staffing decisions
- Production cycle bar that tracks throughput vs. backlog pressure
- Assistant card that shows average time-per-task for each assistant

The conveyor belt, backlog cubes, dispatch beams, and clearing pulses animate based on those metrics, so pressing **Simulate** immediately gives feedback beyond just assistant colors. A hero badge announces “Pulseline Studio” on load, **press `I`** any time to toggle the instructions card, and **press `P`** to pause/resume without touching the UI.

### CLI sanity checks

`python main.py` loads the same defaults from `settings.json`, runs `run_workflow_simulation`, and prints a concise summary (flow/overflow, utilization, throughput, backlog). Use it inside CI or when iterating on solver tweaks.

## Deployment

### Netlify build

`netlify.toml` now runs:

```
pip install -r requirements.txt && python freeze.py
```

and publishes the generated `build/` folder. No Netlify Functions or proxy redirects are required anymore—everything (including the workflow simulator) happens in the browser. Use `netlify deploy --prod --dir build` if you prefer manual control.

## Next ideas

- Persist scenario runs for historical comparisons.
- Add assistant tooltips (task load, idle time) on hover.
- Experiment with WebSockets to stream incremental updates from the solver instead of batching per simulation.

