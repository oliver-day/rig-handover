import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countNight } from '../src/digest/counts.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board digest links', () => {
  it('links both nights to their digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    for (const night of ['2026-10-27', '2026-10-28']) {
      expect(html).toContain(`href="/digest/${night}"`);
      const c = countNight('runs', night);
      expect(c).not.toBeNull();
      expect(html).toContain(`ok ${c?.ok} · retry ${c?.retry} · fail ${c?.fail}`);
    }
  });

  it('has no counts for a night without a file', () => {
    expect(countNight('runs', '1999-01-01')).toBeNull();
  });
});
