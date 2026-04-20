import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Configuración de Gemini en el SERVIDOR (Seguro)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
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

  // Vite middleware para desarrollo o archivos estáticos para producción
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IrisAI Server running on http://localhost:${PORT}`);
  });
}

startServer();
