import { brotliDecompressSync } from "zlib";
import https from "https";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end("Método não permitido");
  }

  const { deckUrl } = req.query;

  if (!deckUrl || typeof deckUrl !== "string") {
    return res.status(400).json({ error: "Parâmetro 'deckUrl' inválido" });
  }

  const idMatch = deckUrl.match(/\/deck\/([a-zA-Z0-9]+)/);
  const id = idMatch ? idMatch[1] : null;
  if (!id) return res.status(400).json({ error: "URL de deck inválida" });

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

            const deckList = json.leader
              .map((leader) => {
                const count = 1;
                const name = cardName;
                const title = title ? ` - ${title}` : "";
                const number = Number(defaultCardNumber);
                return `${count} ${name}${title} (${number})`;
              })
              .join("\n");

            deckList = json.base
              .map((base) => {
                const count = 1;
                const name = cardName;
                const number = Number(defaultCardNumber);
                return `${count} ${name} (${number})`;
              })
              .join("\n");

            deckList += json.shuffledDeck
              .filter((card) => card.count > 0)
              .map((card) => {
                const count = card.count + card.sideboardCount;
                const name = card.card.cardName;
                const title = card.card.title ? ` - ${card.card.title}` : "";
                const number = Number(card.card.defaultCardNumber);
                return `${count} ${name}${title} (${number})`;
              })
              .join("\n");

            res.setHeader("Content-Type", "text/plain");
            res.send(deckList);
          } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao processar o deck" });
          }
        });
      }
    )
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar o deck" });
    });
}
