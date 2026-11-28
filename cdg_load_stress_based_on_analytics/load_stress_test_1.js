// codegnan-load-test.js


import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ---------- Configuration ----------
const BASE_URL = 'https://staging.codegnan.com';
const VU_COUNT = 25;
const DURATION = '1m';
const DURATION_SEC = 60;
const SEND_INTERVAL_SEC = DURATION_SEC / VU_COUNT;   // 2.4s between requests
const REQUEST_TIMEOUT = __ENV.TIMEOUT || '30s';
const P95_LIMIT_MS = 1000;
const FAIL_RATE_LIMIT = 0.01;

const ENDPOINTS = [
  { slug: 'home',               path: '/' },
  { slug: 'job-accelerator',    path: '/job-accelerator-program/' },
  { slug: 'placement',          path: '/placement/' },
  { slug: 'fs-java-vijayawada', path: '/full-stack-java-training-course-in-vijayawada/' },
];

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MOBILE_UA  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const VU_LIST = Array.from({ length: VU_COUNT }, (_, i) => i + 1);

// ---------- Custom metrics ----------
const http504 = new Counter('http_504');
const clientTimeouts = new Counter('client_timeouts');

// ---------- Thresholds (informational only) ----------
function buildThresholds() {
  const t = {
    'http_req_duration': [`p(95)<${P95_LIMIT_MS}`],
    'http_req_failed': [`rate<${FAIL_RATE_LIMIT}`],
  };
  for (const ep of ENDPOINTS) {
    const s = `endpoint:${ep.slug}`;
    t[`http_req_duration{${s}}`] = [`p(95)<${P95_LIMIT_MS}`];
    t[`http_req_failed{${s}}`]   = [`rate<${FAIL_RATE_LIMIT}`];
    t[`checks{${s}}`]            = ['rate>0.99'];
    t[`http_504{${s}}`]          = ['count==0'];
    t[`client_timeouts{${s}}`]   = ['count==0'];
  }
  return t;
}

// ---------- Options ----------
// Each of the 25 VUs runs exactly ONE iteration: sleep, then one request.
export const options = {
  scenarios: {
    one_request_per_vu: {
      executor: 'per-vu-iterations',
      vus: VU_COUNT,
      iterations: 1,
      maxDuration: DURATION,
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds(),
};

// ---------- Test logic ----------
export default function () {
  const vu = __VU;

  // Spread the 25 requests evenly across the minute:
  // VU1 -> 0s, VU2 -> 2.4s, VU3 -> 4.8s, ... VU25 -> 57.6s
  sleep((vu - 1) * SEND_INTERVAL_SEC);

  const idx = (vu - 1) % ENDPOINTS.length;          // VU1->ep1, VU2->ep2, ..., VU5->ep1
  const ep = ENDPOINTS[idx];
  // VUs 1-4 desktop, 5-8 mobile, 9-12 desktop, ... so every endpoint gets both
  const device = Math.floor((vu - 1) / ENDPOINTS.length) % 2 === 0 ? 'desktop' : 'mobile';

  const res = http.get(BASE_URL + ep.path, {
    headers: {
      'User-Agent': device === 'desktop' ? DESKTOP_UA : MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    tags: { endpoint: ep.slug, device: device, name: ep.path },
    timeout: REQUEST_TIMEOUT,
  });

  // ---- Per-request status printed to the terminal ----
  const statusText = res.status === 0 ? 'FAILED' : `${res.status} ${res.status_text || ''}`.trim();
  const errorPart = res.error ? ` | ERROR: ${res.error}` : '';
  console.log(`VU${vu} | ${ep.slug} | ${device} | ${statusText} | ${res.timings.duration.toFixed(0)} ms${errorPart}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is HTML': (r) => typeof r.body === 'string' && r.body.indexOf('<html') !== -1,
    'response < 3s': (r) => r.timings.duration < P95_LIMIT_MS,
  }, { endpoint: ep.slug, device: device });

  if (res.status === 504) {
    http504.add(1, { endpoint: ep.slug, device: device });
  }
  if (res.status === 0 && /timeout|deadline/i.test(res.error || '')) {
    clientTimeouts.add(1, { endpoint: ep.slug, device: device });
  }
}

// ---------- Report ----------
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d));
const pct = (x) => (x == null || Number.isNaN(x) ? '-' : (x * 100).toFixed(2) + '%');

export function handleSummary(data) {
  const m = data.metrics;
  const today = new Date().toISOString().slice(0, 10);

  const thOk = (key) => {
    const t = m[key] && m[key].thresholds;
    return !t || Object.values(t).every((x) => x.ok);
  };

  const rows = ENDPOINTS.map((ep, i) => {
    const sub = (metric) => m[`${metric}{endpoint:${ep.slug}}`];
    const val = (metric, key) => {
      const s = sub(metric);
      return s && s.values ? s.values[key] : null;
    };

    const assignedVUs = VU_LIST.filter((vu) => (vu - 1) % ENDPOINTS.length === i).length;
    const actual = val('http_reqs', 'count') ?? 0;
    const expected = assignedVUs;                    // exactly 1 request per VU
    const failedCount = val('http_req_failed', 'passes') ?? 0;
    const failedRate = val('http_req_failed', 'rate') ?? 0;
    const checkPass = val('checks', 'rate');
    const e504 = val('http_504', 'count') ?? 0;
    const timeouts = val('client_timeouts', 'count') ?? 0;
    const p95 = val('http_req_duration', 'p(95)');

    const desktopLoad = (m[`http_reqs{endpoint:${ep.slug},device:desktop}`]?.values?.count ?? 0) > 0;
    const mobileLoad  = (m[`http_reqs{endpoint:${ep.slug},device:mobile}`]?.values?.count ?? 0) > 0;

    const thresholdsOk = [
      `http_req_duration{endpoint:${ep.slug}}`,
      `http_req_failed{endpoint:${ep.slug}}`,
      `checks{endpoint:${ep.slug}}`,
      `http_504{endpoint:${ep.slug}}`,
      `client_timeouts{endpoint:${ep.slug}}`,
    ].every(thOk);

    const pageOk =
      actual === expected &&
      (p95 ?? Infinity) < P95_LIMIT_MS &&
      failedRate < FAIL_RATE_LIMIT &&
      e504 === 0 &&
      timeouts === 0;

    return {
      'Stage': 'S1 - Paced (1 req / 2.4s)',
      'Date': today,
      'Virtual Users': assignedVUs,
      'Duration (min)': 1,
      'Requests per VU': assignedVUs ? f(actual / assignedVUs, 0) : '0',
      'Endpoint': ep.path,
      'Expected Requests': expected,
      'Actual Requests': actual,
      'Request Count Check': actual === expected ? 'PASS' : 'FAIL',
      'Failed Requests': failedCount,
      'Failed Rate': pct(failedRate),
      'Check Pass Rate': pct(checkPass),
      '504 Errors': e504,
      'Client Timeouts': timeouts,
      'Avg (ms)': f(val('http_req_duration', 'avg')),
      'Median (ms)': f(val('http_req_duration', 'med')),
      'p90 (ms)': f(val('http_req_duration', 'p(90)')),
      'p95 (ms)': f(p95),
      'p99 (ms)': f(val('http_req_duration', 'p(99)')),
      'Max (ms)': f(val('http_req_duration', 'max')),
      'Threshold Status (info only)': thresholdsOk ? 'PASS' : 'BREACHED',
      'Desktop Browser Load (Yes/No)': desktopLoad ? 'Yes' : 'No',
      'Mobile Load (Yes/No)': mobileLoad ? 'Yes' : 'No',
      'Result (Page Load)': pageOk ? 'PASS' : 'FAIL',
    };
  });

  let stdout = '\n==================== CODEGNAN LOAD TEST REPORT ====================\n';
  for (const r of rows) {
    stdout += `\n[${r['Endpoint']}]\n`;
    for (const [k, v] of Object.entries(r)) {
      if (k !== 'Endpoint') stdout += `  ${k.padEnd(32)}: ${v}\n`;
    }
  }
  stdout += `\nTotal requests: ${rows.reduce((s, r) => s + r['Actual Requests'], 0)} (expected ${VU_COUNT})\n`;

  const header = Object.keys(rows[0]).join(',');
  const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n');

  return {
    stdout,
    'codegnan-load-report.csv': csv,
    'codegnan-load-report.json': JSON.stringify(rows, null, 2),
  };
}