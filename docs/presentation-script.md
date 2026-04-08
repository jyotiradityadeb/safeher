# Presentation Script

## 1. Opening

Good morning. Our project is **Federated Learning Based Gesture Threat Detection for Women Safety**.

The goal is to help a user quickly send an emergency alert using a predefined distress gesture, while also protecting privacy through federated learning.

## 2. Problem Statement

In many dangerous situations, a person may not have enough time to unlock the phone, type a message, or call for help.

So we designed a mobile-first system that can:

- detect a distress gesture,
- trigger an emergency alert,
- attach live location,
- notify trusted contacts,
- and improve the gesture model without sending raw personal gesture data to the server.

## 3. Solution Overview

Our system has four main parts:

1. Mobile app
2. Backend server
3. Admin dashboard
4. Federated learning pipeline

The mobile app captures gestures and performs local detection.
The backend manages users, contacts, alerts, and model updates.
The admin dashboard shows alerts in real time.
The federated learning module aggregates model updates from devices without sharing raw data.

## 4. Privacy Advantage

The most important research idea in our project is privacy.

Instead of uploading raw user gesture traces, devices can train locally and send only model updates.
These updates are aggregated on the server to improve the global model.

This reduces privacy risk and makes the system better suited for sensitive safety applications.

## 5. Demo Flow

Now I will show the prototype.

1. First, I log in to the admin dashboard using the demo admin account.
2. Next, I seed a demo federated model round to show the ML metrics.
3. Then I trigger a demo distress alert, either from the mobile app or directly from the dashboard.
4. The dashboard immediately shows the alert, confidence score, delivery status, and location link.
5. This demonstrates the complete emergency-response workflow.

## 6. What Is Working In The Prototype

- user authentication
- emergency contacts
- distress gesture capture
- local inference fallback
- alert creation with location
- real-time admin visibility
- federated learning simulation
- TensorFlow Lite export pipeline

## 7. Future Scope

In the full version, we will improve:

- real trained gesture model quality
- stronger production mobile deployment
- real provider integrations for all notifications
- richer federated orchestration
- stronger security and monitoring

## 8. Closing

This project combines mobile computing, machine learning, privacy-preserving AI, and real-time safety response into one system.

Thank you.
