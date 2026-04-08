# Step-by-Step Implementation

## 1. Authentication

- Mobile users sign up and log in through FastAPI JWT routes.
- The app stores the token in memory for the starter build; production should persist it securely with SecureStore or Keychain.

## 2. Gesture Detection

- The mobile app records touch points using `PanResponder`.
- Feature extraction converts raw points into duration, speed, distance, and direction-change signals.
- A local inference service flags emergency gestures without sending raw touch traces to the backend.

## 3. Emergency Alerts

- When the distress gesture is detected, the app requests location permission.
- It posts an alert payload with GPS coordinates and feature summary to `/api/alerts`.
- The backend stores the alert and generates a live map link for emergency contacts and admin visibility.

## 4. Federated Learning

- Each client locally fine-tunes a model on-device.
- Instead of uploading raw samples, clients send model weights and metrics to `/api/federated/updates`.
- The backend aggregates updates with weighted averaging and publishes a new global model snapshot.

## 5. Push and Background Tracking

- The mobile app registers a push token after login and posts it to `/api/devices`.
- Background location tracking sends periodic GPS updates to `/api/locations`.
- The backend can fan out Firebase-backed push notifications when an alert is triggered.

## 6. TFLite Inference Path

- `mobile/src/services/tfliteService.ts` attempts to load a bundled TensorFlow Lite model.
- If the native TFLite runtime is unavailable, the app falls back to the lightweight rules-based inference service.
- `ml/scripts/train_tflite_model.py` exports both the `.tflite` model and a label manifest.
- `ml/scripts/publish_mobile_model.py` copies the exported model into the mobile assets directory.

## 7. Validation Layer

- Backend service tests cover auth, contacts, alert creation, and federated aggregation.
- Backend route tests cover health, auth, contacts, alerts, and federated API behavior.
- ML smoke tests cover dataset generation helpers and federated averaging logic.
- Admin tests cover dashboard rendering and realtime alert updates.
- Mobile tests cover gesture feature extraction and local inference rules.
- GitHub Actions runs these checks automatically on pushes and pull requests.

## 8. Admin Security

- Admin-only endpoints use a role check on the authenticated user.
- The dashboard requires admin login before it requests protected metrics endpoints.
- The seeded admin account is intended only for local development and demos.
