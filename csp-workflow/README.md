# Pulseline Studio

Immersive Three.js visualizer driven by a lightweight Flask API. Use it to stress-test assistant staffing, visualize queue pressure, and demo how different operational scenarios behave on a buzzing office floor.

A command center where staffing, queue pressure, and live production health pulse alive. Run scenarios through a Flask-powered simulator, watch the conveyor belt, backlog cubes, and beam effects respond in real time, and navigate the map. Adjust the control panel as you dial in arrival rates, belt speed, and assistant counts. This repository houses a starting template for more complex world models around this project.


## Project Layout

```
csp-workflow/
├─ analyzer.py              # Utilization + stats helpers
├─ csp_solver.py            # Greedy longest-processing-time allocator
├─ main.py                  # CLI runner that reuses the simulator pipeline
├─ netlify.toml             # Netlify Dev / proxy config
├─ requirements.txt
├─ settings.json            # UI + API defaults (assistants, tasks, etc.)
├─ static/
│  ├─ css/threejs.css
│  └─ js/threejs_scene.js   # Scene logic + visual effects
├─ templates/
│  ├─ landing.html
│  └─ threejs.html
├─ web_app.py               # Flask wires everything together
└─ workflow_simulator.py    # Scenario definitions + orchestration
```

## Quick Start

```bash
cd AGIworld/csp-workflow
python -m venv .venv
.venv\Scripts\activate          # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python web_app.py
# Navigate to http://localhost:5001/threejs
```

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

### Local Netlify preview

`netlify.toml` is set up so `netlify dev` spins up Flask for you:

```bash
netlify dev
# Netlify proxies http://localhost:8888 -> Flask on port 5001
```

The `[dev]` block runs `python web_app.py`, while the redirect stanza pipes every request through the Flask server.

### Production hosting

1. Deploy the Flask service to your preferred host (Render, Railway, Fly.io, etc.) and note its public URL.
2. Update the `[[redirects]]` `to =` field in `netlify.toml` to point to that URL instead of `http://localhost:5001`.
3. Install the Netlify CLI and deploy the static shell:

   ```bash
   netlify deploy --prod --dir static
   ```

   Netlify serves the CSS/JS bundle from `static/` and transparently proxies all routes to your Flask backend using the redirect rule.

Alternatively, skip Netlify entirely and run `gunicorn -b 0.0.0.0:5001 web_app:app` wherever you typically host Python services.

## Next ideas

- Persist scenario runs for historical comparisons.
- Add assistant tooltips (task load, idle time) on hover.
- Experiment with WebSockets to stream incremental updates from the solver instead of batching per simulation.

