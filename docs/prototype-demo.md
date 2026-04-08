# Prototype Demo Runbook

This runbook is optimized for a college presentation prototype.

## Goal

Show the full women-safety concept quickly:

1. User logs in on mobile
2. Distress gesture is detected
3. Alert is generated with live location
4. Admin dashboard shows the alert in real time
5. Federated learning metrics appear on the dashboard

## Fastest Demo Setup

### Option 1: Backend + Admin only

1. Start the stack:
   - `docker compose up --build`
2. Open the admin dashboard:
   - `http://localhost:5173`
3. Login with:
   - `admin@safeher.app`
   - `admin123`
4. Click:
   - `Seed Demo Model`
   - `Trigger Demo Alert`

This is the fastest path if you need a reliable live demo in a short time.

### Option 2: Mobile + Backend + Admin

1. Start backend and MongoDB
2. Seed demo data
3. Run the mobile Expo app
4. Login as:
   - `demo@safeher.app`
   - `password123`
5. Draw the distress gesture on the home screen
6. Show the admin dashboard updating live

## Presentation Flow

### Slide 1

- Problem statement: women safety and delayed response during emergencies

### Slide 2

- Solution overview: gesture-triggered emergency alert app with privacy-preserving federated learning

### Slide 3

- Architecture:
  - mobile app
  - backend server
  - MongoDB
  - admin dashboard
  - federated aggregation

### Live Demo

1. Show admin login
2. Show seeded model metrics
3. Trigger a demo alert
4. Explain:
   - gesture detection
   - live location link
   - trusted contact notifications
   - federated learning updates without sharing raw user data

## Key Talking Points

- Distress gestures are detected locally on the device
- Raw gesture traces do not need to be sent to the backend
- Emergency alerts include location and timestamp
- Federated learning protects privacy by sharing only model updates
- The admin dashboard helps monitor alerts and model performance

## Recommended For Prototype

- Use simulated delivery results if Twilio or Firebase are not configured
- Use dashboard demo buttons if mobile device setup is unstable
- Focus on concept clarity and real-time alert flow
