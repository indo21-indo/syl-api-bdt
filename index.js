import express from "express";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import multer from "multer";
import path from "path";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Multer setup for image upload
const upload = multer({ dest: "uploads/" });

// Google GenAI (AI Studio API Key)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// ---------------- Helper ----------------
function saveBase64Image(base64Data, prefix = "image") {
  const filename = `${prefix}-${Date.now()}.png`;
  const filepath = path.join(process.cwd(), filename);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filepath, buffer);
  return filename;
}

// ---------------- Routes ----------------

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

// Text → Image
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ text: prompt }]
    });

    let imagePath = null;
    for (const part of response.parts) {
      if (part.inlineData) {
        imagePath = saveBase64Image(part.inlineData.data, "generated");
      }
    }

    if (!imagePath) return res.status(500).json({ error: "No image returned" });

    res.json({ message: "Image generated successfully", imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Image → Image Edit
app.post("/edit", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!req.file || !prompt) return res.status(400).json({ error: "Image and prompt required" });

    const base64Image = fs.readFileSync(req.file.path).toString("base64");

    const contents = [
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: base64Image } }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents
    });

    let editedPath = null;
    for (const part of response.parts) {
      if (part.inlineData) {
        editedPath = saveBase64Image(part.inlineData.data, "edited");
      }
    }

    fs.unlinkSync(req.file.path); // remove temp upload

    if (!editedPath) return res.status(500).json({ error: "No edited image returned" });

    res.json({ message: "Image edited successfully", editedPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download image
app.get("/download/:filename", (req, res) => {
  const file = path.join(process.cwd(), req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send("File not found");
  res.download(file);
});

// ---------------- Start server ----------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
