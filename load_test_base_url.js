import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = 'https://staging.codegnan.com';
const LOG_EVERY_REQUEST = true;     // true = print a line for every successful request

const successRequests = new Counter('success_requests');
const failedRequests = new Counter('failed_requests');
  
export const options = {

  stages: [
    { duration: '1m', target: 1 },  
    { duration: '10m', target: 10 }, 
    { duration: '1m', target: 0 },   
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],     
    http_req_duration: ['p(95)<1000'], 
    http_req_duration: ['p(99)<1000'],  
  },
};

export default function () {
  const res = http.get(BASE_URL, { timeout: '30s' });
  const ms = Math.round(res.timings.duration);

  // Only check for 200 OK
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  if (ok) {
  successRequests.add(1);

  if (LOG_EVERY_REQUEST) {
    console.log(
      `[OK]   VU ${__VU} | GET ${BASE_URL} | status ${res.status} | ${ms} ms`,
    );
  }
} else {
  failedRequests.add(1);

  console.error(
    `[FAIL] VU ${__VU} | GET ${BASE_URL} | status ${res.status} | ${ms} ms | error: ${res.error || 'none'}`,
  );
}

  sleep(1);
}