import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface DetectionResult {
  objectName: string;
  confidence: number;
  description?: string;
  category: string;
  searchUrl?: string;
  boundingBox?: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
}

export interface VisionAnalysis {
  objects: DetectionResult[];
  summary: string;
  ocrText?: string;
  detectedLanguage?: string;
  sources?: { title: string; url: string }[];
}

const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });

export const analyzeImage = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<VisionAnalysis> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: "Briefly identify objects and OCR text. Include name, confidence, category, and specific functional detail. JSON only: { objects: [{ objectName, confidence, category, description, searchUrl }], summary, ocrText }" },
      { inlineData: { data: base64Image, mimeType } }
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          objects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                objectName: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                description: { type: Type.STRING, description: "Detailed description including where to find more info, origin, and functional details." },
                category: { type: Type.STRING },
                searchUrl: { type: Type.STRING, description: "A Google Search or official specification URL for this specific item." },
                boundingBox: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER }
                  }
                }
              },
              required: ["objectName", "confidence", "category"]
            }
          },
          summary: { type: Type.STRING },
          ocrText: { type: Type.STRING },
          detectedLanguage: { type: Type.STRING }
        },
        required: ["objects", "summary"]
      }
    }
  });

  const analysis = JSON.parse(response.text || "{}") as VisionAnalysis;
  
  // Extract grounding sources
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    analysis.sources = chunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title || "Reference Source",
        url: chunk.web.uri
      }));
  }

  return analysis;
};

export const generateSpeech = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate speech");
  }

  return base64Audio;
};
