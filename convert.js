import express from "express";
import { brotliDecompressSync } from "zlib";
import * as z from "zod";
import https from "https";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(process.cwd(), "public")));

function getDeckIdFromUrl(url) {
  const match = url.match(/\/deck\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function formatDeck(shuffledDeck) {
  return shuffledDeck
    .filter((cardEntry) => cardEntry.count > 0) // só cartas com count > 0
    .map((cardEntry) => {
      const count = cardEntry.count;
      const name = cardEntry.card.cardName;
      const title = cardEntry.card.title ? ` - ${cardEntry.card.title}` : "";
      const number = Number(cardEntry.card.defaultCardNumber);
      return `${count} ${name}${title} (${number})`;
    })
    .join("\n");
}

const querySchema = z.object({
  deckUrl: z.string().url(),
});

app.get("/api/convert", async (req, res) => {
  try {
    const { deckUrl } = querySchema.parse(req.query);
    const id = getDeckIdFromUrl(deckUrl);

    const deckData = await new Promise((resolve, reject) => {
      https
        .get(
          `https://swudb.com/api/deck/${id}`,
          { headers: { "Accept-Encoding": "br" } },
          (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              try {
                const compressed = Buffer.concat(chunks);
                const decompressed = brotliDecompressSync(compressed);
                const json = JSON.parse(decompressed.toString("utf-8"));
                resolve(json);
              } catch (err) {
                reject(err);
              }
            });
          }
        )
        .on("error", reject);
    });

    const output = formatDeck(deckData.shuffledDeck);

    res.type("text/plain").send(output);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter dados do deck." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
