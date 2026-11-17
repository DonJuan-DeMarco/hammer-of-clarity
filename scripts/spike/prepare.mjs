// Spike: turn a domain list into (a) a static ruleset with ONE rule holding every
// domain and (b) a plain text file the service worker can load for the dynamic test.
// Usage: node scripts/spike/prepare.mjs <list.txt> [chunks]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { domainToASCII } from 'node:url';

const [, , listPath = 'spike-data/oisd-nsfw.txt'] = process.argv;
const SYNTHETIC = 'spike-test.example'; // harmless domain to navigate to in the e2e check

const text = await readFile(listPath, 'utf8');
const seen = new Set();
let nonAscii = 0;
for (const raw of text.split('\n')) {
  const line = raw.trim().toLowerCase();
  if (!line || line.startsWith('#')) continue;
  const ascii = /^[\x00-\x7f]*$/.test(line) ? line : (nonAscii++, domainToASCII(line));
  if (ascii) seen.add(ascii);
}
seen.add(SYNTHETIC);
const domains = [...seen];

const rule = (id, requestDomains) => ({
  id,
  priority: 1,
  action: { type: 'redirect', redirect: { extensionPath: '/block.html?c=adult' } },
  condition: { requestDomains, resourceTypes: ['main_frame', 'sub_frame'] },
});

await mkdir('public/spike', { recursive: true });
const ruleset = JSON.stringify([rule(1, domains)]);
await writeFile('public/spike/adult-static.json', ruleset);
await writeFile('public/spike/adult.txt', domains.join('\n'));
console.log(JSON.stringify({
  domains: domains.length,
  nonAsciiConverted: nonAscii,
  lastRealDomain: domains[domains.length - 2],
  staticJsonBytes: Buffer.byteLength(ruleset),
}));
