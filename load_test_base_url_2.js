import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import exec from "k6/execution";

const BASE_URL = "https://staging.codegnan.com";
const LOG_EVERY_REQUEST = __ENV.LOG !== "off"; 

export const options = {
  stages: [
    { duration: "1m", target: 1 },
    { duration: "10m", target: 10 },
    { duration: "1m", target: 1 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000", "p(99)<1000"],
    checks: ["rate>0.99"],
    gateway_504_errors: ["count==0"], 
    client_timeouts: ["count==0"],    
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ---------------- COUNTERS ----------------
const successRequests = new Counter("success_requests");
const failedRequests = new Counter("failed_requests");
const gateway504Counter = new Counter("gateway_504_errors");
const clientTimeoutCounter = new Counter("client_timeouts");

// ---------------- SETUP ----------------
export function setup() {
  console.log(`Starting test on ${BASE_URL}`);
  return { startTime: Date.now() };
}

// ---------------- MAIN ----------------
export default function (data) {
  // Global request number across all VUs (1 iteration = 1 request here)
  const requestNo = exec.scenario.iterationInTest + 1;
  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);
  const activeVUs = exec.instance.vusActive;

  const res = http.get(BASE_URL, { timeout: "30s" });
  const ms = Math.round(res.timings.duration);
  const time = new Date().toISOString();
  const info = `request #${requestNo} | ${elapsed}s into test | VU ${__VU} | active VUs ${activeVUs} | ${ms} ms`;

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (ok) {
    successRequests.add(1);
    if (LOG_EVERY_REQUEST) {
      console.log(`[OK] ${time} | ${info} | status ${res.status}`);
    }
  } else {
    failedRequests.add(1);

    if (res.status === 504) {
      gateway504Counter.add(1);
      console.error(`[504] ${time} | ${info} | gateway timeout from server`);
    } else if (res.status === 0) {
      clientTimeoutCounter.add(1);
      console.error(`[TIMEOUT] ${time} | ${info} | ${res.error || "no response"}`);
    } else {
      console.error(`[FAIL] ${time} | ${info} | status ${res.status}`);
    }
  }

  sleep(1);
}