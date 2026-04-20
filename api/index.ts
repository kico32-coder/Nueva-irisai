import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json({ limit: '10mb' }));

// API segura para Gemini
app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurado en el servidor" });
    }

    const { contents, systemInstruction } = req.body;
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
      }
    });
    
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error en backend:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
});

// Manejo de archivos estáticos y rutas SPA (Solo para local dev o si Vercel no maneja el ruteo)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

// Esto permite que funcione localmente con 'npm run dev'
if (process.env.NODE_ENV !== "production") {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IrisAI Server running on http://localhost:${PORT}`);
  });
}

export default app;
