import { GoogleGenAI, Type } from "@google/genai";

export interface DetectionResult {
  objectName: string;
  confidence: number;
  description?: string;
  category: string;
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
}

const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });

export const analyzeImage = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<VisionAnalysis> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: "Detailed object detection and OCR analysis. Return JSON only." },
      { inlineData: { data: base64Image, mimeType } }
    ],
    config: {
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
                description: { type: Type.STRING },
                category: { type: Type.STRING },
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

  return JSON.parse(response.text || "{}") as VisionAnalysis;
};
