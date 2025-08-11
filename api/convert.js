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

            // Construir as seções do deck separadamente
            // Leader é um objeto único, não um array
            const leaderSection = json.leader
              ? (() => {
                  const count = 1;
                  const name = json.leader.cardName;
                  const title = json.leader.title
                    ? ` - ${json.leader.title}`
                    : "";
                  const number = Number(json.leader.defaultCardNumber);
                  return `${count} ${name}${title} (${number})`;
                })()
              : "";

            // Base também é um objeto único, não um array
            const baseSection = json.base
              ? (() => {
                  const count = 1;
                  const name = json.base.cardName;
                  const number = Number(json.base.defaultCardNumber);
                  return `${count} ${name} (${number})`;
                })()
              : "";

            // shuffledDeck é um array - separar deck principal do sideboard
            const deckSection =
              json.shuffledDeck
                ?.filter((card) => card.count > 0)
                .map((card) => {
                  const count = card.count;
                  const name = card.card.cardName;
                  const title = card.card.title ? ` - ${card.card.title}` : "";
                  const number = Number(card.card.defaultCardNumber);
                  return `${count} ${name}${title} (${number})`;
                })
                .join("\n") || "";

            // Sideboard separado
            const sideboardSection =
              json.shuffledDeck
                ?.filter((card) => card.sideboardCount > 0)
                .map((card) => {
                  const count = card.sideboardCount;
                  const name = card.card.cardName;
                  const title = card.card.title ? ` - ${card.card.title}` : "";
                  const number = Number(card.card.defaultCardNumber);
                  return `${count} ${name}${title} (${number})`;
                })
                .join("\n") || "";

            // Retornar as seções separadas em JSON
            const result = {
              leader: leaderSection,
              base: baseSection,
              mainDeck: deckSection,
              sideboard: sideboardSection
            };

            res.setHeader("Content-Type", "application/json");
            res.json(result);
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
