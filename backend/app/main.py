from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import get_settings
from app.db.database import get_database
from app.db.database import close_mongo_connection, connect_to_mongo
from app.services.safety_service import SafetyService
from app.utils.logging import configure_logging, log_event
from app.utils.realtime import realtime_manager


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


settings = get_settings()
configure_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")
evidence_dir = Path(__file__).resolve().parents[1] / "data" / "evidence"
evidence_dir.mkdir(parents=True, exist_ok=True)
app.mount("/evidence", StaticFiles(directory=evidence_dir), name="evidence")


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
        log_event(
            "http.request.failed",
            method=request.method,
            path=request.url.path,
            host=request.client.host if request.client else "unknown",
            elapsed_ms=elapsed_ms,
            error=str(error),
        )
        raise
    elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
    log_event(
        "http.request.completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        host=request.client.host if request.client else "unknown",
        elapsed_ms=elapsed_ms,
    )
    return response


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "status": "ok",
        "health": "/api/health",
        "docs": "/docs",
    }


@app.get("/public/live-room/{access_token}", response_class=HTMLResponse)
async def public_live_room_page(access_token: str, db=Depends(get_database)):
    room = await SafetyService(db).get_public_live_room(access_token)
    if room is None:
        return HTMLResponse("<h2>Live room not found.</h2>", status_code=404)

    return HTMLResponse(
        f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SafeHer Live Room</title>
    <style>
      body {{ font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 16px; }}
      .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 14px; margin-bottom: 12px; }}
      h1 {{ margin-top: 0; font-size: 24px; }}
      .muted {{ color: #cbd5e1; }}
      a {{ color: #f97316; }}
      li {{ margin-bottom: 8px; }}
      .badge {{ display: inline-block; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700; margin-top: 8px; }}
      .badge-fresh {{ background: #14532d; color: #dcfce7; border: 1px solid #22c55e; }}
      .badge-warn {{ background: #78350f; color: #fef3c7; border: 1px solid #f59e0b; }}
      .badge-stale {{ background: #7f1d1d; color: #fee2e2; border: 1px solid #ef4444; }}
      .input {{ width: 100%; max-width: 320px; margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; }}
      .button {{ margin-top: 10px; padding: 10px 14px; border-radius: 10px; border: none; background: #f97316; color: #0f172a; font-weight: 700; cursor: pointer; }}
      .button:disabled {{ opacity: 0.6; cursor: default; }}
    </style>
  </head>
  <body>
    <h1>SafeHer Live Room</h1>
    <div class="card">
      <div>Room code: <strong>{room["room_code"]}</strong></div>
      <div class="muted">Status: <span id="status">{room["status"]}</span></div>
      <div class="muted">Last update: <span id="updated">{room["updated_at"]}</span></div>
      <div class="muted" id="coords-line"></div>
      <div id="freshness-badge" class="badge badge-stale">Location status: waiting for updates</div>
      <div id="map-holder"></div>
    </div>
    <div class="card">
      <h3>Trusted Contacts</h3>
      <ul id="participants"></ul>
    </div>
    <div class="card">
      <h3>Acknowledgements</h3>
      <div class="muted">Confirm you have seen this alert so others know who is aware.</div>
      <input id="ack-name" class="input" maxlength="80" placeholder="Your name (e.g., Priya)" />
      <br />
      <button id="ack-btn" class="button" onclick="acknowledgeViewed()">I Viewed This Alert</button>
      <button id="eta-btn" class="button" onclick="sendOnMyWay()">I'm On My Way</button>
      <div class="muted" id="ack-status"></div>
      <ul id="receipts"></ul>
    </div>
    <div class="card">
      <h3>Live Updates</h3>
      <ul id="timeline"></ul>
    </div>
    <script>
      const token = {access_token!r};
      let latestLocationAt = null;

      function setFreshnessBadge() {{
        const badge = document.getElementById("freshness-badge");
        if (!badge) return;
        if (!latestLocationAt) {{
          badge.className = "badge badge-stale";
          badge.textContent = "Location status: no live updates yet";
          return;
        }}
        const ageSeconds = Math.max(Math.floor((Date.now() - new Date(latestLocationAt).getTime()) / 1000), 0);
        if (ageSeconds <= 45) {{
          badge.className = "badge badge-fresh";
          badge.textContent = `Location updated ${{ageSeconds}}s ago`;
          return;
        }}
        if (ageSeconds <= 120) {{
          badge.className = "badge badge-warn";
          badge.textContent = `Location updated ${{ageSeconds}}s ago`;
          return;
        }}
        badge.className = "badge badge-stale";
        badge.textContent = `Location stale (${{ageSeconds}}s ago)`;
      }}

      function renderReceipts(receipts) {{
        const receiptsList = document.getElementById("receipts");
        receiptsList.innerHTML = "";
        (receipts || []).slice().sort((left, right) => new Date(right.acknowledged_at) - new Date(left.acknowledged_at)).forEach((receipt) => {{
          const li = document.createElement("li");
          const when = receipt.acknowledged_at ? new Date(receipt.acknowledged_at).toLocaleString() : "unknown time";
          li.textContent = `${{receipt.contact_name || "Contact"}} viewed alert at ${{when}}`;
          receiptsList.appendChild(li);
        }});
        if (!receiptsList.childNodes.length) {{
          const li = document.createElement("li");
          li.textContent = "No acknowledgements yet.";
          receiptsList.appendChild(li);
        }}
      }}

      async function acknowledgeViewed() {{
        const input = document.getElementById("ack-name");
        const status = document.getElementById("ack-status");
        const button = document.getElementById("ack-btn");
        const name = (input.value || "").trim();
        if (!name) {{
          status.textContent = "Please enter your name first.";
          return;
        }}
        status.textContent = "Saving acknowledgement...";
        button.disabled = true;
        try {{
          const res = await fetch(`/api/public/live-room/${{token}}/ack`, {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ contact_name: name }}),
          }});
          if (!res.ok) {{
            status.textContent = "Could not save acknowledgement.";
            return;
          }}
          status.textContent = `Thanks, ${{name}}. Acknowledgement saved.`;
          await refresh();
        }} catch {{
          status.textContent = "Could not save acknowledgement.";
        }} finally {{
          button.disabled = false;
        }}
      }}

      async function sendOnMyWay() {{
        const input = document.getElementById("ack-name");
        const status = document.getElementById("ack-status");
        const name = (input.value || "").trim();
        if (!name) {{
          status.textContent = "Enter your name first.";
          return;
        }}
        status.textContent = "Updating timeline...";
        try {{
          const res = await fetch(`/api/public/live-room/${{token}}/note`, {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{
              contact_name: name,
              message: "I am on my way.",
            }}),
          }});
          if (!res.ok) {{
            status.textContent = "Could not update timeline.";
            return;
          }}
          status.textContent = `${{name}} marked on-the-way.`;
          await refresh();
        }} catch {{
          status.textContent = "Could not update timeline.";
        }}
      }}

      async function refresh() {{
        try {{
          const res = await fetch(`/api/public/live-room/${{token}}`);
          if (!res.ok) return;
          const data = await res.json();
          document.getElementById("status").textContent = data.status;
          document.getElementById("updated").textContent = new Date(data.updated_at).toLocaleString();
          const participants = document.getElementById("participants");
          participants.innerHTML = "";
          (data.participants || []).forEach((p) => {{
            const li = document.createElement("li");
            li.textContent = `${{p.name || "Contact"}}${{p.relationship ? " (" + p.relationship + ")" : ""}}`;
            participants.appendChild(li);
          }});
          renderReceipts(data.receipts || []);
          const timeline = document.getElementById("timeline");
          timeline.innerHTML = "";
          (data.timeline || []).slice().reverse().forEach((item) => {{
            const li = document.createElement("li");
            li.textContent = `${{new Date(item.created_at).toLocaleString()}} - ${{item.message}}`;
            timeline.appendChild(li);
          }});
          const mapHolder = document.getElementById("map-holder");
          const coordsLine = document.getElementById("coords-line");
          mapHolder.innerHTML = data.map_link ? `<a href="${{data.map_link}}" target="_blank" rel="noreferrer">Open live location</a>` : "";
          if (data.live_location && data.live_location.latitude != null && data.live_location.longitude != null) {{
            const at = data.live_location.recorded_at
              ? new Date(data.live_location.recorded_at).toLocaleString()
              : "unknown time";
            latestLocationAt = data.live_location.recorded_at || null;
            coordsLine.textContent = `Current: ${{data.live_location.latitude}}, ${{data.live_location.longitude}} (updated ${{at}})`;
          }} else {{
            latestLocationAt = null;
            coordsLine.textContent = "";
          }}
          setFreshnessBadge();
        }} catch {{}}
      }}
      refresh();
      setInterval(refresh, 5000);
      setInterval(setFreshnessBadge, 1000);
    </script>
  </body>
</html>
        """
    )


@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await realtime_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket)
