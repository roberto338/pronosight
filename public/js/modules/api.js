
// ══════════════════════════════════════════════
// api.js — Tous les appels API (version GEMINI)
// ══════════════════════════════════════════════

import { ODDS_SPORT_MAP, BOOKMAKERS_EU, FD_COMP_MAP } from './config.js';
import { state } from './state.js';

// ══════════════════════════════════════════════
// GEMINI API (via /api/gemini)
// ══════════════════════════════════════════════
export async function callGemini(messages, { useSearch = false, maxTokens = 1000, model = null } = {}) {
  const baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://pronosight2.onrender.com';

  const url = `${baseUrl}/api/gemini`;

  console.log('📤 Envoi à:', url);

  const body = {
    messages,
    useSearch,
    maxTokens,
    model: model || null
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('📥 Statut réponse:', resp.status);

    if (!resp.ok) {
      const text = await resp.text();
      console.error('❌ Erreur HTTP:', resp.status, text);
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    console.log('✅ Réponse reçue:', data);

    if (data.error) {
      throw new Error(data.error.message || 'Erreur API');
    }

    return data;

  } catch (e) {
    console.error('❌ Erreur fetch:', e);
    throw e;
  }
}

export const callClaude = callGemini;

// ══════════════════════════════════════════════
// EXTRACTION TEXTE
// ══════════════════════════════════════════════
export function extractText(data) {
  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

// ══════════════════════════════════════════════
// EXTRACTION JSON ROBUSTE
// ══════════════════════════════════════════════
export function extractJSON(text) {

  if (!text) return null;

  console.log('🔍 Texte brut reçu:', text.substring(0, 200) + '...');

  let clean = text;

  // supprimer balises markdown
  clean = clean.replace(/```json/gi, '').replace(/```/g, '');

  // supprimer caractères invisibles
  clean = clean.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // guillemets typographiques
  clean = clean.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  clean = clean.trim();

  // supprimer duplication de JSON
  const matchesBlocks = clean.split(/(?=\{"matches")/);
  if (matchesBlocks.length > 1) {
    clean = matchesBlocks[0];
  }

  // chercher premier JSON valide
  const firstBrace = clean.indexOf('{');
  if (firstBrace === -1) {
    console.warn("⚠️ Aucun JSON détecté");
    return null;
  }

  // extraction par comptage d'accolades
  let depth = 0;
  let endIndex = -1;

  for (let i = firstBrace; i < clean.length; i++) {

    if (clean[i] === '{') depth++;
    if (clean[i] === '}') depth--;

    if (depth === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    console.warn("⚠️ JSON incomplet");
    return null;
  }

  let jsonString = clean.substring(firstBrace, endIndex + 1);

  console.log("📊 JSON extrait:", jsonString.substring(0, 200));

  try {
    return JSON.parse(jsonString);
  }
  catch (e) {

    console.warn("⚠️ JSON.parse erreur:", e.message);

    // tentative réparation newlines
    try {
      const fixed = jsonString
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

      return JSON.parse(fixed);
    }
    catch {}

    // extraction objets match individuels
    try {

      const matches = jsonString.match(/\{"team1":"[^"]*","team2":"[^"]*","date":"[^"]*","time":"[^"]*"/g);

      if (matches && matches.length) {

        console.log(`✅ ${matches.length} matchs reconstruits`);

        return {
          matches: matches.map(m => {
            const fixed = m + '"}';
            return JSON.parse(fixed);
          })
        };
      }

    } catch {}

    console.error("❌ Impossible de parser JSON");
    return null;
  }
}

// ══════════════════════════════════════════════
// THESPORTSDB
// ══════════════════════════════════════════════
export async function tsdbFetch(endpoint, params = {}) {

  const qs = new URLSearchParams(params).toString();
  const url = `/api/tsdb/${endpoint}${qs ? '?' + qs : ''}`;

  try {

    const resp = await fetch(url);
    const data = await resp.json();
    return data;

  } catch {

    return { events: [] };

  }
}

// ══════════════════════════════════════════════
// ODDS API
// ══════════════════════════════════════════════
export async function fetchRealOdds(team1, team2, leagueId) {

  const sportKey = ODDS_SPORT_MAP[leagueId] || 'soccer_epl';

  try {

    const resp = await fetch(`/api/odds/${sportKey}?` + new URLSearchParams({
      regions: 'eu',
      markets: 'h2h',
      oddsFormat: 'decimal',
      bookmakers: BOOKMAKERS_EU.join(',')
    }));

    if (!resp.ok) return null;

    const games = await resp.json();
    if (!Array.isArray(games)) return null;

    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const n1 = normalize(team1);
    const n2 = normalize(team2);

    const match = games.find(g => {

      const hn = normalize(g.home_team || '');
      const an = normalize(g.away_team || '');

      return (
        (hn.includes(n1) || n1.includes(hn)) &&
        (an.includes(n2) || n2.includes(an))
      );

    });

    if (!match) return null;

    const oddsMap = {};

    (match.bookmakers || []).forEach(bk => {

      const h2h = (bk.markets || []).find(m => m.key === 'h2h');
      if (!h2h) return;

      const outcomes = h2h.outcomes || [];

      const home = outcomes.find(o => o.name === match.home_team);
      const away = outcomes.find(o => o.name === match.away_team);
      const draw = outcomes.find(o => o.name === 'Draw');

      if (home && away) {

        oddsMap[bk.title] = {
          home: home.price,
          draw: draw ? draw.price : null,
          away: away.price
        };

      }

    });

    if (!Object.keys(oddsMap).length) return null;

    return {
      bookmakers: oddsMap,
      count: Object.keys(oddsMap).length,
      home_team: match.home_team,
      away_team: match.away_team
    };

  } catch (e) {

    console.warn("Odds API:", e.message);
    return null;

  }
}

// ══════════════════════════════════════════════
// API STATUS
// ══════════════════════════════════════════════
export async function fetchApiStatus() {

  try {

    const resp = await fetch('/api/status');
    state.apiStatus = await resp.json();
    return state.apiStatus;

  } catch {

    state.apiStatus = { claude:false, gemini:false, odds:false, footballData:false };
    return state.apiStatus;

  }
}
