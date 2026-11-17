// Spike helper: downloads the OISD NSFW list (~9 MB) into spike-data/. Not committed.
import { writeFile, mkdir } from 'node:fs/promises';

const url = 'https://nsfw.oisd.nl/domainswild2';
const res = await fetch(url);
if (!res.ok) throw new Error(`${url} → ${res.status}`);
await mkdir('spike-data', { recursive: true });
await writeFile('spike-data/oisd-nsfw.txt', await res.text());
console.log('saved spike-data/oisd-nsfw.txt');
