
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

/** Extract JSON from Gemini text response — with auto-repair for truncated JSON */
export function extractJSON(text) {
  // Nettoie les backticks markdown
  let clean = text.replace(/```json|\n```|```/g, '').trim();
  
  // Trouve le premier { et le dernier }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  
  if (firstBrace === -1) {
    console.warn('🔍 Pas de JSON trouvé dans:', text.slice(0, 200));
    return null;
  }
  
  // Extrait le JSON brut
  let jsonStr = lastBrace > firstBrace 
    ? clean.substring(firstBrace, lastBrace + 1)
    : clean.substring(firstBrace);
  
  // Supprime les caractères de contrôle (retours ligne dans les strings, tabs, etc.)
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  // Compacte les espaces multiples
  jsonStr = jsonStr.replace(/\s+/g, ' ');
  
  // Essai 1: Parse direct
  try {
    const result = JSON.parse(jsonStr);
    console.log('✅ JSON parsé directement');
    return result;
  } catch (e) {
    console.warn('⚠️ Premier échec JSON:', e.message);
  }
  
  // Essai 2: Réparation automatique du JSON tronqué
  let repaired = jsonStr;
  
  // Supprime la dernière valeur incomplète (clé sans valeur, valeur coupée)
  // Cas: ,"key  ou  ,"key":  ou  ,"key":"val  ou  ,"key":123
  repaired = repaired
    .replace(/,\s*"[^"]*"?\s*:?\s*"?[^",}\]]*$/, '')  // trailing incomplete kv
    .replace(/,\s*$/, '')                                     // trailing comma
    .replace(/:\s*$/, ': null')                                // trailing colon
    .replace(/,\s*\]/, ']')                                  // comma before ]
    .replace(/,\s*\}/, '}');                                 // comma before }
  
  // Ferme les guillemets ouverts
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  
  // Ferme les crochets et accolades manquants
  let openBrackets = (repaired.match(/\[/g) || []).length;
  let closeBrackets = (repaired.match(/\]/g) || []).length;
  let openBraces = (repaired.match(/\{/g) || []).length;
  let closeBraces = (repaired.match(/\}/g) || []).length;
  
  while (closeBrackets < openBrackets) { repaired += ']'; closeBrackets++; }
  while (closeBraces < openBraces) { repaired += '}'; closeBraces++; }
  
  try {
    const result = JSON.parse(repaired);
    console.log('✅ JSON réparé avec succès (' + Object.keys(result).length + ' clés)');
    return result;
  } catch (e2) {
    console.error('❌ Échec réparation:', e2.message);
    console.error('📝 JSON tronqué (fin):', repaired.slice(-200));
  }
  
  // Essai 3: Coupe tout après la dernière propriété valide
  try {
    // Trouve la dernière virgule suivie d'une clé complète
    const lastValidComma = repaired.lastIndexOf('",');
    if (lastValidComma > 0) {
      let truncated = repaired.substring(0, lastValidComma + 1);
      // Re-ferme les brackets
      openBrackets = (truncated.match(/\[/g) || []).length;
      closeBrackets = (truncated.match(/\]/g) || []).length;
      openBraces = (truncated.match(/\{/g) || []).length;
      closeBraces = (truncated.match(/\}/g) || []).length;
      while (closeBrackets < openBrackets) { truncated += ']'; }
      while (closeBraces < openBraces) { truncated += '}'; }
      const result = JSON.parse(truncated);
      console.log('✅ JSON récupéré par troncature (' + Object.keys(result).length + ' clés)');
      return result;
    }
  } catch (e3) {
    console.error('❌ Échec total du parsing JSON');
  }
  
  return null;
}\]]*$/, '');
  
  let openBraces = (repaired.match(/\{/g) || []).length;
  let closeBraces = (repaired.match(/\}/g) || []).length;
  let openBrackets = (repaired.match(/\[/g) || []).length;
  let closeBrackets = (repaired.match(/\]/g) || []).length;
  
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  
  while (closeBrackets < openBrackets) { repaired += ']'; closeBrackets++; }
  while (closeBraces < openBraces) { repaired += '}'; closeBraces++; }
  
  try {
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, ' ');
    const result = JSON.parse(repaired);
    console.log('✅ JSON réparé avec succès');
    return result;
  } catch (e2) {
    console.error('❌ Échec réparation JSON:', repaired.slice(0, 300));
  }
  
  return null;
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
