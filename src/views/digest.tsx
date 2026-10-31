import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';
const show = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? dash : String(v));

// Marked rows: 3 or more retries, or the last run failed. The "!" keeps the mark visible
// without colour.
const marked = (r: DigestRow) => r.retries >= 3 || r.lastStatus === 'fail';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? "line didn't" : "lines didn't"} parse
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr class={marked(r) ? 'warn' : undefined}>
                <td>{marked(r) ? `! ${show(r.job)}` : show(r.job)}</td>
                <td>{show(r.owner)}</td>
                <td>{show(r.runs)}</td>
                <td>{show(r.retries)}</td>
                <td>{show(r.lastStatus)}</td>
                <td>{show(r.lastError)}</td>
                <td>{show(r.firstAt)}</td>
                <td>{show(r.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
