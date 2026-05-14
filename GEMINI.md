# Customizing VisionAI Intelligence

VisionAI is built with flexibility in mind. You can easily modify the AI's behavior by adjusting the orchestration logic in `src/services/geminiService.ts`.

## 🧠 Modifying the Prompt

If you want the AI to focus on specific details (e.g., medical identification, architectural analysis, or plant species), update the `prompt` string in `analyzeImage`.

**Example for specialized detection:**
```typescript
const prompt = `You are a botanist. Identify any plants in this image. 
Provide the scientific name, health status, and growth requirements.
Return results in JSON.`;
```

## 🔄 Changing Models

We use `gemini-3-flash-preview` for high-speed analysis. For tasks requiring advanced reasoning or coding explanation, you can switch to `gemini-3.1-pro-preview`.

## 🗣️ Voice Personalization

The TTS features use `gemini-3.1-flash-tts-preview`. You can choose from different prebuilt voices:
- `Kore` (Default)
- `Puck`
- `Charon`
- `Fenrir`
- `Zephyr` (Deep/Technical)

Update the `voiceName` in `App.tsx`'s `speakResult` function to change the persona.

## 📦 Data Schema

If you modify the `responseSchema` in the service, ensure you also update the `VisionAnalysis` interface to match the new structure.
