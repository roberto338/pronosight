import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.ANTHROPIC_API_KEY;
const TODAY = new Date().toLocaleDateString("fr-FR");
const TODAY_ISO = new Date().toISOString().split("T")[0];

if (!API_KEY) { console.error("ANTHROPIC_API_KEY manquant"); process.exit(1); }

async function api(messages, opts = {}) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, ...opts, messages })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d;
}

async function searchMatches() {
  console.log("Recherche matchs du", TODAY);
  const d = await api(
    [{ role: "user", content: "List major football and basketball matches for " + TODAY + " and tomorrow. Teams, competition, likely winner. Leagues: Ligue 1, Premier League, La Liga, Bundesliga, Serie A, Champions League, NBA." }],
    { max_tokens: 1200, tools: [{ type: "web_search_20250305", name: "web_search" }] }
  );
  return d.content.map(b => b.type === "text" ? b.text : "").join(" ").trim() || "matches on " + TODAY;
}

async function generatePicks(info) {
  console.log("Generation picks...");
  const prompt = `Matches ${TODAY}:\n${info.slice(0, 2000)}\n\nGenerate the 5 best picks. Output ONLY a JSON array:\n[{"match":"TeamA vs TeamB","league":"Ligue 1","date":"${TODAY}","bet":"1","odds":1.75,"confidence":78,"proba":71,"ev":7.2,"stars":4,"reasoning":"explication","category":"safe"}]`;
  const d = await api(
    [{ role: "user", content: prompt }],
    { max_tokens: 1500, system: "Output ONLY a valid JSON array [ ... ]. No text. No backticks." }
  );
  const raw = d.content.map(b => b.type === "text" ? b.text : "").join("").trim();
  const si = raw.indexOf("["), ei = raw.lastIndexOf("]");
  if (si < 0) throw new Error("No JSON array: " + raw.slice(0, 200));
  return JSON.parse(raw.slice(si, ei + 1));
}

async function main() {
  try {
    const info = await searchMatches();
    const picks = await generatePicks(info);
    console.log(picks.length + " picks generes");
    const today = {
      date: TODAY_ISO, date_fr: TODAY, generated_at: new Date().toISOString(), picks,
      summary: {
        total_picks: picks.length,
        avg_confidence: Math.round(picks.reduce((a, p) => a + (p.confidence || 0), 0) / picks.length),
        avg_ev: Math.round(picks.reduce((a, p) => a + (p.ev || 0), 0) / picks.length * 10) / 10
      }
    };
    const dir = path.join(__dirname, "..", "picks");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "today.json"), JSON.stringify(today, null, 2));
    const histPath = path.join(dir, "history.json");
    let hist = [];
    if (fs.existsSync(histPath)) try { hist = JSON.parse(fs.readFileSync(histPath, "utf8")); } catch {}
    hist = hist.filter(h => h.date !== TODAY_ISO);
    hist.unshift({ date: TODAY_ISO, date_fr: TODAY, summary: today.summary });
    if (hist.length > 60) hist = hist.slice(0, 60);
    fs.writeFileSync(histPath, JSON.stringify(hist, null, 2));
    console.log("Done! " + picks.length + " picks saved.");
    picks.forEach(p => console.log("  " + p.match + " | " + p.bet + " @ " + p.odds + " | EV+" + p.ev + "%"));
  } catch (e) {
    console.error("ERREUR:", e.message);
    process.exit(1);
  }
}
main();
