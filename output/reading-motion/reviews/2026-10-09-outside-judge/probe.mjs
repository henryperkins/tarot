import { alignReadingPassages } from './snapshot/src/lib/narrativePassageAligner.js';
const input = JSON.parse(process.argv[2] || '{}');
if (typeof input.rawText !== 'string' || input.rawText.length > 50000 || !Array.isArray(input.cards)) throw new Error('Provide rawText and an array of canonical card names.');
const result = alignReadingPassages({ rawText: input.rawText, cards: input.cards.map((name,index)=>({name,index})), artworkEdition: 'rws-immanuelle-vector', sourceComplete: input.sourceComplete !== false });
console.log(JSON.stringify(result,null,2));
