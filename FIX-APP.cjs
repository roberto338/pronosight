// FIX-APP.cjs — Corrige les doublons dans app.js
// Lance avec: node FIX-APP.cjs
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'app.js');
console.log('⚡ Correction de app.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Problème: lignes 422-435 ont un bloc de vérification puis une redéclaration
// On remplace tout le bloc entre "const text = extractText(data)" et le check "if (!d)"
// par une version propre sans doublons

const oldBlock = `    // ⚠️ VÉRIFICATION DU JSON AVANT PARSING
    const text = extractText(data);
    console.log('📝 Longueur réponse:', text.length);
    
    // Si la réponse est trop courte ou semble tronquée
    if (text.length < 100 || !text.includes('}') || (text.match(/{/g) || []).length !== (text.match(/}/g) || []).length) {
      console.warn('⚠️ Réponse suspecte, utilisation du plan B');
      throw new Error('Réponse tronquée');
    }
    
    let d = extractJSON(text);
    const text = extractText(data);
    let d = extractJSON(text);`;

const newBlock = `    const text = extractText(data);
    console.log('📝 Longueur réponse:', text.length);
    let d = extractJSON(text);`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  console.log('✅ Bloc dupliqué corrigé');
} else {
  // Essai alternatif: cherche les lignes individuellement
  console.log('⚠️ Bloc exact non trouvé, recherche alternative...');
  
  // Cherche la double déclaration
  const doubleConst = '    const text = extractText(data);\n    let d = extractJSON(text);';
  const lines = content.split('\n');
  let fixed = false;
  
  for (let i = 0; i < lines.length - 1; i++) {
    // Cherche "const text = extractText" suivi plus tard par un autre "const text = extractText"
    if (lines[i].includes('const text = extractText(data)') && 
        lines.slice(i+1, i+10).some(l => l.includes('const text = extractText(data)'))) {
      // Supprime le premier bloc de vérification et la redéclaration
      let endIdx = i;
      for (let j = i+1; j < Math.min(i+15, lines.length); j++) {
        if (lines[j].includes('let d = extractJSON(text)')) {
          endIdx = j;
        }
      }
      // Remplace tout par une seule version
      const replacement = [
        '    const text = extractText(data);',
        "    console.log('📝 Longueur réponse:', text.length);",
        '    let d = extractJSON(text);'
      ];
      lines.splice(i, endIdx - i + 1, ...replacement);
      content = lines.join('\n');
      fixed = true;
      console.log(`✅ Doublons supprimés (lignes ${i} à ${endIdx})`);
      break;
    }
  }
  
  if (!fixed) {
    console.log('⚠️ Pas de doublon trouvé — le fichier est peut-être déjà propre');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('💾 app.js sauvegardé');

// Vérification
const check = fs.readFileSync(filePath, 'utf8');
const constTextCount = (check.match(/const text = extractText/g) || []).length;
const letDCount = (check.match(/let d = extractJSON/g) || []).length;
console.log(`\n📋 Vérification:`);
console.log(`  "const text = extractText" apparaît: ${constTextCount} fois (doit être 1)`);
console.log(`  "let d = extractJSON" apparaît: ${letDCount} fois (doit être 1)`);

if (constTextCount === 1 && letDCount === 1) {
  console.log('  ✅ Pas de doublons');
} else {
  console.log('  ⚠️ Doublons restants — vérification manuelle nécessaire');
}

console.log('\n🚀 Maintenant lance:');
console.log('   git add -A');
console.log('   git commit -m "v4.1: clean api.js + fix app.js duplicates"');
console.log('   git push origin master');
