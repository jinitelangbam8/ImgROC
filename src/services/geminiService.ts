import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DetectionResult {
  objectName: string;
  confidence: number;
  description: string;
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

export const analyzeImage = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<VisionAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this image for object detection, classification, and OCR. 
  Identify the main objects, their categories, and confidence scores (0-1). 
  If possible, provide normalized bounding box coordinates [ymin, xmin, ymax, xmax] for each object.
  Also, extract any visible text (OCR) and identify the dominant language.
  
  Return the results in strict JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
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

  try {
    return JSON.parse(response.text.trim()) as VisionAnalysis;
  } catch (err) {
    console.error("JSON Parse Error:", response.text);
    throw new Error("Failed to parse AI analysis result.");
  }
};
