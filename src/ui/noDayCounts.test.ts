/**
 * Guard for D2: no screen may show a number of days. The UI gets progress only as a
 * stage name from `stageFor`, so it must never touch the raw timestamps or day maths.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_DIRS = ['src/entrypoints', 'src/ui'];
// `.attempts`: the attempt log exists only for graduation and is never shown (D24).
const FORBIDDEN = [/stageStartedAt/, /\bDAY_MS\b/, /graduatedAt/, /\.attempts\b/];

function uiSourceFiles(): string[] {
  return UI_DIRS.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.(tsx?|html)$/.test(f) && !f.endsWith('.test.ts'))
      .map((f) => path.join(dir, f)),
  );
}

describe('no day counts in the UI', () => {
  it('finds the UI files to check', () => {
    expect(uiSourceFiles().length).toBeGreaterThan(3);
  });

  it.each(uiSourceFiles())('%s never reads raw progress timestamps', (file) => {
    const source = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN) expect(source).not.toMatch(pattern);
  });

  it('no message string talks about a count of days', () => {
    const messages = JSON.parse(readFileSync('public/_locales/en/messages.json', 'utf8')) as Record<string, { message: string }>;
    const counted = Object.entries(messages).filter(([, m]) => /\$\w+\$\s*days?\b|\d+\s*days?\b/i.test(m.message));
    expect(counted).toEqual([]);
  });
});
