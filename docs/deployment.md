# Deployment Guide

## Backend

1. Provision MongoDB Atlas or a managed MongoDB instance.
2. Deploy the FastAPI app to Render, Railway, Fly.io, or an EC2 container.
3. Set environment variables from `backend/.env.example`.
4. Expose HTTPS and configure CORS origins for mobile and admin clients.
5. Run `python scripts/seed_demo.py` after first deployment.
6. If using live monitoring, expose `/ws/alerts` through your reverse proxy or ingress.

## Mobile

1. Replace Expo demo configuration with production package identifiers.
2. Add Google Maps, Twilio, and Firebase credentials to Expo secrets.
3. If you enable TFLite, use a custom development build or prebuild workflow because `react-native-fast-tflite` is a native dependency.
4. Build Android APK or AAB using EAS Build.
5. Bundle the TensorFlow Lite model into `mobile/assets/models/gesture_model.tflite`.
6. Keep `mobile/assets/models/gesture_labels.json` in sync with the exported model labels.

## Admin Dashboard

1. Deploy the Vite build to Vercel, Netlify, or a static object store.
2. Set `VITE_API_BASE_URL` and `VITE_WS_URL`.
3. Restrict access behind an admin role or SSO in production.

## ML and Federated Learning

1. Train the base model offline using `ml/scripts/train_model.py`.
2. Export model weights and TFLite artifacts to `ml/models/`.
3. Upload the latest base model manifest to the backend.
4. Schedule periodic federated aggregation jobs or trigger them from the admin panel.

## Production Notes

- Twilio SMS and WhatsApp need approved sender configuration.
- Firebase Admin credentials are required on the backend if you want real push delivery instead of simulated push results.
- Expo push notifications can be sent through the Expo push API when the registered device provider is `expo`.
- Firebase Cloud Messaging remains the path for non-Expo/native device tokens.
- For background live location on Android, request foreground and background permissions.
- Encrypt stored emergency contacts and audit alert access for compliance.
- `docker-compose.yml` is for local development and demos, not hardened production orchestration.
