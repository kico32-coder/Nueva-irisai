import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurado en Vercel" });
    }

    const { contents, systemInstruction } = req.body;
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: { systemInstruction, maxOutputTokens: 2048 }
    });
    
    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
