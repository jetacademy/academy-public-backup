const fs=require('fs');const f='src/lib/hermes-help/prompts.ts';let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{if(!s.includes(a))throw new Error('missing '+a.slice(0,60));s=s.replace(a,b);};
rep('${AI_EMPLOYEE_METHOD}\n${mode === "business"','${AI_EMPLOYEE_METHOD}\n\n${CLASS_CHANNEL_GUIDE}\n${mode === "business"');
rep('1. Fakta tentang Hermes & OpenRouter HANYA dari DOKUMEN, METODE KELAS, dan CATATAN INSTRUKTUR di bawah.','1. Fakta tentang Hermes & OpenRouter HANYA dari DOKUMEN, METODE KELAS, PANDUAN KELAS, dan CATATAN INSTRUKTUR.');
rep(`  if (/openrouter\.ai\/docs\/(faq|quickstart|cookbook\/coding-agents\/hermes-integration)/.test(doc.url)) w *= 1.2;`,
`  if (/openrouter\.ai\/docs\/(faq|quickstart|cookbook\/coding-agents\/hermes-integration)/.test(doc.url)) w *= 1.2;
  // Kelas memakai WhatsApp biasa (bridge Baileys, scan QR) — dahulukan halamannya di atas
  // WhatsApp Business Cloud API (Meta app) yang tidak diajarkan.
  if (/\/docs\/user-guide\/messaging\/whatsapp(#|$)/.test(doc.url)) w *= 1.25;
  else if (/\/docs\/user-guide\/messaging\/whatsapp-cloud/.test(doc.url)) w *= 0.6;`);
fs.writeFileSync(f,s);console.log('ok');
