# ImgREC - Intelligent Object Detection System

ImgREC is a professional-grade image recognition and object detection platform powered by Google's Gemini 1.5 Flash model. It provides high-precision analysis, OCR capabilities, and a seamless developer-centric user interface.

## 🚀 Features

- **Object Detection**: Identify multiple objects with confidence scores.
- **Classification**: Categorize objects into taxonomic groups.
- **OCR Engine**: Extract text from images with support for multiple languages.
- **Voice Assistant**: Integrated AI-powered speech output for analysis summaries.
- **Webcam Integration**: Capture and analyze images directly from your camera.
- **Dark/Light Mode**: Full theme customization for different environments.
- **Persistent History**: Keeps track of your last 20 scans locally (syncable with Firebase).
- **Admin Dashboard**: System metrics and model status monitoring.

## 🛠️ Tech Stack

- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion.
- **Backend**: Express.js (Node.js).
- **AI**: Gemini 1.5 Flash API (Vision + TTS).
- **Icons**: Lucide React.
- **Storage**: LocalStorage (Migration to Firebase ready).

## 📦 Project Structure

```text
/src
  /components     # UI components (shadcn/ui)
  /lib            # Shared utilities
  /services       # Gemini API orchestration
  App.tsx         # Main Dashboard logic
server.ts         # Express server entry point
metadata.json     # App configuration
```

## ⚙️ Setup & Deployment

1. **Environment Variables**:
   Ensure `GEMINI_API_KEY` is set in your environment (Secrets panel in AI Studio).
   
2. **Installation**:
   ```bash
   npm install
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

## 🔒 Security

- **Safe Uploads**: Client-side validation for file types and sizes.
- **Private Keys**: API keys are managed via secure environment variables.
- **Authentication**: Ready for Firebase Auth integration.

Designed with precision by ImgREC Systems.
