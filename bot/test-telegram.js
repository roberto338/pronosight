// ══════════════════════════════════════════════
// bot/test-telegram.js — Test connexion Telegram
// Usage : node bot/test-telegram.js
// ══════════════════════════════════════════════

import 'dotenv/config';
import { sendAlert } from './telegram.js';

console.log('\n🧪 Test connexion Telegram\n');
console.log('   Token   :', process.env.TELEGRAM_BOT_TOKEN ? '✅ présent' : '❌ manquant');
console.log('   Channel :', process.env.TELEGRAM_CHANNEL_ID || '❌ manquant');
console.log('');

try {
  await sendAlert(
    '🎙️ Victor opérationnel !\nPronoSight v4.1 connecté au channel.\n\nAnalyses quotidiennes :\n🌅 07h00 — Analyse du matin\n🌆 13h00 — Refresh du soir\n🔍 23h30 — Vérification résultats',
    'success'
  );
  console.log('\n✅ Message envoyé avec succès — vérifie le channel Telegram\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
}
