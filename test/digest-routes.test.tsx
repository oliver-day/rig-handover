import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow, Night, RunLine } from '../src/digest/types.js';

let runsDir = '';

const line = (l: RunLine) => JSON.stringify(l);

// Written out of order on purpose: the routes must sort by job.
const JOBS = ['alpha-sync', 'beta-export', 'gamma-clean'];

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-'));
  const full: RunLine[] = [
    { at: '2026-01-01T02:00:00+01:00', job: 'gamma-clean', status: 'ok', owner: 'sam' },
    { at: '2026-01-01T02:05:00+01:00', job: 'beta-export', status: 'retry', owner: null },
    { at: '2026-01-01T02:10:00+01:00', job: 'beta-export', status: 'retry', owner: null },
    { at: '2026-01-01T02:15:00+01:00', job: 'beta-export', status: 'retry', owner: null },
    { at: '2026-01-01T02:20:00+01:00', job: 'beta-export', status: 'ok', owner: null },
    { at: '2026-01-01T03:00:00+01:00', job: 'alpha-sync', status: 'ok', owner: 'kim' },
    { at: '2026-01-01T03:30:00+01:00', job: 'alpha-sync', status: 'fail', owner: 'kim', error: 'timeout' },
  ];
  fs.writeFileSync(path.join(runsDir, '2026-01-01.jsonl'), full.map(line).join('\n') + '\n');
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-01-03.jsonl'),
    line({ at: '2026-01-03T01:00:00+01:00', job: 'alpha-sync', status: 'ok', owner: 'kim' }) +
      '\n{"at":"2026-01-03T01:05:00+01:00","job":"beta-exp\n',
  );
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

// Job names in the order they appear in <td> cells.
function jobsInPage(html: string): string[] {
  const cells = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => (m[1] ?? '').trim());
  return cells.filter((c) => JOBS.includes(c));
}

describe('GET /digest/:night', () => {
  it('renders the table sorted by job, with — for a null owner and warn marks', async () => {
    const res = await app().request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    const idx = JOBS.map((j) => html.indexOf(j));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(html).toContain('—');
    expect(html).toContain('warn');
  });

  it('404s for a night with no file', async () => {
    expect((await app().request('/digest/2026-01-09')).status).toBe(404);
  });

  it('404s for an invalid night', async () => {
    expect((await app().request('/digest/not-a-night')).status).toBe(404);
  });

  it('says "nothing ran" for an empty file', async () => {
    const res = await app().request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders and reports lines that did not parse', async () => {
    const res = await app().request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("did not parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('returns sorted rows and badLines 0', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r: DigestRow) => r.job)).toEqual(JOBS);
  });

  it('404s for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-01-09')).status).toBe(404);
  });

  it('returns no rows for the empty night', async () => {
    const res = await app().request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line', async () => {
    const res = await app().request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-sync']);
  });
});

describe('page and JSON agree', () => {
  it('lists the same jobs in the same order', async () => {
    const html = await (await app().request('/digest/2026-01-01')).text();
    const body = (await (await app().request('/api/digest/2026-01-01')).json()) as Night;
    expect(jobsInPage(html)).toEqual(body.rows.map((r) => r.job));
  });
});
