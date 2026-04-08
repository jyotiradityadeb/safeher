# Federated Learning Based Gesture Threat Detection for Women Safety

This monorepo contains a mobile-first safety platform that detects distress gestures on-device, triggers emergency alerts with live location, and improves the gesture model through federated learning without sending raw user gesture data to the server.

## Project Structure

- `mobile/` React Native Expo app for Android-first safety workflows
- `backend/` FastAPI backend for auth, contacts, alerts, admin, and FL aggregation
- `admin/` React dashboard for live monitoring and model metrics
- `ml/` training, feature extraction, TFLite export hooks, and federated simulation
- `docs/` architecture notes and API references

## Architecture Diagram

```text
+-------------------+          HTTPS / WebSocket          +----------------------+
| React Native App  |  --------------------------------> | FastAPI Backend      |
| - Auth            |                                     | - JWT Auth           |
| - Gesture Capture | <--------------------------------  | - Contacts API       |
| - Local Inference |     global model + alert status    | - Alerts API         |
| - GPS + Alerts    |                                     | - FL Aggregation     |
+---------+---------+                                     | - Admin Metrics      |
          |                                               +----------+-----------+
          | local samples / local training                           |
          v                                                          |
+-------------------+                                                |
| On-device ML      |                                                |
| - feature extract |                                                |
| - TFLite model    |                                                |
| - local fine-tune |                                                |
+---------+---------+                                                |
          | model deltas only                                        |
          +----------------------------------------------------------+
                                                                     |
                                                                     v
                                                        +----------------------+
                                                        | MongoDB              |
                                                        | - users              |
                                                        | - contacts           |
                                                        | - alerts             |
                                                        | - model_updates      |
                                                        +----------------------+
                                                                     |
                                                                     v
                                                        +----------------------+
                                                        | Admin Dashboard      |
                                                        | - live alerts        |
                                                        | - user activity      |
                                                        | - FL metrics         |
                                                        +----------------------+
```

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

### Mobile

```bash
cd mobile
npm install
copy .env.example .env
npx expo start
```

### Admin

```bash
cd admin
npm install
copy .env.example .env
npm run dev
```

### ML

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts\prepare_dataset.py
python scripts\train_model.py
python scripts\federated_simulation.py
python scripts\train_tflite_model.py
python scripts\publish_mobile_model.py
```

### Docker Local Stack

```bash
docker compose up --build
```

This starts MongoDB, the FastAPI backend on `http://localhost:8000`, and the admin dashboard on `http://localhost:5173`.
It also runs a one-shot seed container that creates the demo user, contacts, and admin account.

## Production-Oriented Additions

- Twilio SMS and WhatsApp delivery with simulated fallback when credentials are missing
- WebSocket live alert stream at `/ws/alerts`
- Secure mobile token persistence with Expo Secure Store
- Dockerized backend, MongoDB, and admin dashboard
- Push token registration and Firebase-ready notification hooks
- Background location tracking hooks for Android
- TFLite-ready mobile inference adapter with fallback rules engine
- Role-based admin access for dashboard and aggregation endpoints

## Real Mobile Model Flow

1. Generate features with `python scripts\prepare_dataset.py`
2. Train/export a TensorFlow Lite model with `python scripts\train_tflite_model.py`
3. Copy the exported model into the app with `python scripts\publish_mobile_model.py`
4. Set `EXPO_PUBLIC_USE_TFLITE=true` in `mobile/.env`
5. Build the mobile app with native module support

## Testing

### Backend

```bash
cd backend
pip install -r requirements.txt
pytest tests
```

This includes both service-layer tests and FastAPI route tests with dependency overrides.

### ML

```bash
cd ml
pip install pytest pandas numpy
pytest tests
```

### Admin

```bash
cd admin
npm install
npm test
```

Local admin credentials:

- `admin@safeher.app`
- `admin123`

### Mobile

```bash
cd mobile
npm install
npm test
```

## Continuous Integration

- GitHub Actions workflow: [.github/workflows/ci.yml](C:\Users\jyoti\OneDrive\Desktop\safeher\.github\workflows\ci.yml)
- Backend tests run on every push and pull request
- ML smoke tests run on every push and pull request
- Admin tests run on every push and pull request
- Mobile logic tests run on every push and pull request

## Prototype Demo

Use [prototype-demo.md](C:\Users\jyoti\OneDrive\Desktop\safeher\docs\prototype-demo.md) for the fastest college-presentation flow.
Use [presentation-script.md](C:\Users\jyoti\OneDrive\Desktop\safeher\docs\presentation-script.md) and [presentation-slides.md](C:\Users\jyoti\OneDrive\Desktop\safeher\docs\presentation-slides.md) for your viva/demo presentation.
