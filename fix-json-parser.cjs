// fix-json-parser.cjs — Lance avec: node fix-json-parser.cjs
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'modules', 'api.js');
console.log('⚡ Correction du parser JSON dans', filePath);

let content = fs.readFileSync(filePath, 'utf8');

// Trouve la fonction extractJSON
const startMarker = 'export function extractJSON';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('❌ extractJSON non trouvée');
  process.exit(1);
}

// Trouve la fin de la fonction (prochaine export function ou fin de bloc)
let braceCount = 0;
let funcStart = content.indexOf('{', startIdx);
let funcEnd = -1;
for (let i = funcStart; i < content.length; i++) {
  if (content[i] === '{') braceCount++;
  if (content[i] === '}') braceCount--;
  if (braceCount === 0) {
    funcEnd = i + 1;
    break;
  }
}

if (funcEnd === -1) {
  console.log('❌ Fin de extractJSON non trouvée');
  process.exit(1);
}

console.log(`📍 extractJSON trouvée: caractères ${startIdx} à ${funcEnd}`);

const newFunction = `export function extractJSON(text) {
  // Nettoie les backticks markdown
  let clean = text.replace(/\`\`\`json|\\n\`\`\`|\`\`\`/g, '').trim();
  
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
  jsonStr = jsonStr.replace(/[\\x00-\\x1F\\x7F]/g, ' ');
  
  // Compacte les espaces multiples
  jsonStr = jsonStr.replace(/\\s+/g, ' ');
  
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
    .replace(/,\\s*"[^"]*"?\\s*:?\\s*"?[^",}\\]]*$/, '')  // trailing incomplete kv
    .replace(/,\\s*$/, '')                                     // trailing comma
    .replace(/:\\s*$/, ': null')                                // trailing colon
    .replace(/,\\s*\\]/, ']')                                  // comma before ]
    .replace(/,\\s*\\}/, '}');                                 // comma before }
  
  // Ferme les guillemets ouverts
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  
  // Ferme les crochets et accolades manquants
  let openBrackets = (repaired.match(/\\[/g) || []).length;
  let closeBrackets = (repaired.match(/\\]/g) || []).length;
  let openBraces = (repaired.match(/\\{/g) || []).length;
  let closeBraces = (repaired.match(/\\}/g) || []).length;
  
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
      openBrackets = (truncated.match(/\\[/g) || []).length;
      closeBrackets = (truncated.match(/\\]/g) || []).length;
      openBraces = (truncated.match(/\\{/g) || []).length;
      closeBraces = (truncated.match(/\\}/g) || []).length;
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
}`;

content = content.substring(0, startIdx) + newFunction + content.substring(funcEnd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ extractJSON remplacée !');
console.log('\n🚀 Maintenant lance:');
console.log('   git add -A');
console.log('   git commit -m "fix: robust JSON parser with auto-repair"');
console.log('   git push origin master');
