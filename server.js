const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// 💖 ROOMS + VOTES + USER BLOCK
const rooms = {};
const votes = {};
const votedUsers = {};

// 🔥 CREATE ROOM
app.get("/create-room", (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8);

  rooms[roomId] = [];
  votes[roomId] = { leave: 0, run: 0 };
  votedUsers[roomId] = {};

  res.json({ roomId });
});

// 🔥 GET MESSAGES
app.get("/room/:id", (req, res) => {
  res.json(rooms[req.params.id] || []);
});

// 🔥 SEND MESSAGE
app.post("/room/:id", (req, res) => {
  const { message } = req.body;

  if (!rooms[req.params.id]) {
    rooms[req.params.id] = [];
  }

  rooms[req.params.id].push(message);

  res.json({ success: true });
});

// 🔥 VOTING (1 user = 1 vote)
app.post("/vote/:id", (req, res) => {
  const { type, userId } = req.body;

  if (!votes[req.params.id]) {
    votes[req.params.id] = { leave: 0, run: 0 };
    votedUsers[req.params.id] = {};
  }

  if (votedUsers[req.params.id][userId]) {
    return res.json({ error: "Już głosowałaś 😏" });
  }

  votes[req.params.id][type]++;
  votedUsers[req.params.id][userId] = true;

  res.json(votes[req.params.id]);
});

// 🔥 GET VOTES
app.get("/vote/:id", (req, res) => {
  res.json(votes[req.params.id] || { leave: 0, run: 0 });
});

// 🔑 OPENAI
const openai = new OpenAI({
  apiKey: "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"
});

// 🔥 ANALYZE
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const roastMode = req.body.roastMode === "true";
    const context = req.body.context || "";

    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku" });
    }

    // 📸 OCR API
    const imageBuffer = fs.readFileSync(req.file.path);

    const ocrRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: "K86012982788957"
      },
      body: new URLSearchParams({
        base64Image: "data:image/png;base64," + imageBuffer.toString("base64"),
        language: "eng"
      })
    });

    const ocrData = await ocrRes.json();

    const text =
      ocrData?.ParsedResults?.[0]?.ParsedText || "Brak tekstu";

    // 🧹 usuń plik
    fs.unlinkSync(req.file.path);

    // 🛑 fallback jeśli OCR słaby
    if (!text || text.length < 5) {
      return res.json({
        score: "?",
        type: "Nieczytelne",
        flags: [],
        roast: "Girl... nic tu nie widać 💀"
      });
    }

    // 🤖 AI ANALIZA
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: `
Przeanalizuj tę rozmowę:

"${text}"

Kontekst:
"${context}"

Tryb: ${roastMode ? "ROAST (śmieszny, genzie vibe, trochę złośliwy 😏)" : "NORMAL"}

Zwróć JSON:
{
  "score": number,
  "type": "typ",
  "flags": ["lista"],
  "roast": "komentarz"
}

ODPOWIEDZ TYLKO JSON.
`
        }
      ]
    });

    let aiText = completion.choices[0].message.content;

    // 🔥 CLEAN JSON
    const start = aiText.indexOf("{");
    const end = aiText.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
      aiText = aiText.substring(start, end + 1);
    }

    let parsed;

    try {
      parsed = JSON.parse(aiText);
    } catch {
      return res.json({
        score: "?",
        type: "AI error",
        flags: [],
        roast: aiText
      });
    }

    res.json(parsed);

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// 🚀 START (RENDER SAFE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server działa");
});
});