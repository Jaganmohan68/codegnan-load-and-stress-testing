import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import exec from "k6/execution";

const base_url = "https://staging.codegnan.com";
const endpoint_path = "/intensive-pro/";

// const endpoint_path = "/full-stack-java-training-course-in-vijayawada/";
// const endpoint_path = "/java-full-stack-course-in-visakhapatnam/";
// const endpoint_path = "/full-stack-java-training-course-in-hyderabad/";
// const endpoint_path = "/python-full-stack-training-course-in-vijayawada/";
// const endpoint_path = "/python-full-stack-course-in-visakhapatnam/";
// const endpoint_path = "/python-full-stack-developer-course-in-hyderabad/";
// const endpoint_path = "/data-analytics-course-in-vijayawada/";
// const endpoint_path = "/data-analytics-course-in-visakhapatnam/";
// const endpoint_path = "/data-analytics-course-in-hyderabad/";
// const endpoint_path = "/courses/data-science-with-agentic-ai-course-in-vijayawada/";
// const endpoint_path = "/courses/data-science-with-agentic-ai-course-in-hyderabad/";
// const endpoint_path = "/courses/data-science-with-agentic-ai-course-in-visakhapatnam/";
// const endpoint_path = "/courses/career-restart-full-stack-software-engineering-program/";
// const endpoint_path = "/job-accelerator-program/";

const TYPE = __ENV.TYPE || "load";
const LOG_EVERY_REQUEST = __ENV.LOG !== "off";

// ---------------- TEST TYPES ----------------
const scenarios = {
  load: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 1 },
      { duration: "10m", target: 10 },
      { duration: "1m", target: 1 },
    ],
  },
};

// ---------------- THRESHOLDS ----------------
const thresholds = {
  http_req_duration: ["p(90)<1000", "p(95)<1000", "p(99)<1000"],
  http_req_failed: ["rate<0.01"],
  checks: ["rate>0.99"],
  gateway_504_errors: ["count==0"],   // run is marked failed if any 504 occurs
  client_timeouts: ["count==0"],      // run is marked failed if any client timeout occurs
};

export const options = {
  scenarios: { [TYPE]: scenarios[TYPE] },
  thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ---------------- COUNTERS (init context) ----------------
const requestCounter = new Counter("endpoint_requests");
const successCounter = new Counter("success_requests");
const failCounter = new Counter("failed_requests");
const gateway504Counter = new Counter("gateway_504_errors");
const clientTimeoutCounter = new Counter("client_timeouts");

// ---------------- SETUP ----------------
export function setup() {
  if (!base_url || !endpoint_path) {
    throw new Error("base_url or endpoint_path is empty");
  }
  if (!scenarios[TYPE]) {
    throw new Error(`TYPE "${TYPE}" must be "load"`);
  }
  console.log(`Starting ${TYPE} test on ${base_url}${endpoint_path}`);
  return { startTime: Date.now() };
}

// ---------------- MAIN ----------------
// ---------------- MAIN ----------------
export default function (data) {
  // Global request number across all VUs (1 iteration = 1 request here)
  const requestNo = exec.scenario.iterationInTest + 1;
  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);
  const activeVUs = exec.instance.vusActive;

  const response = http.get(`${base_url}${endpoint_path}`, {
    tags: { endpoint: "single-endpoint" },
    timeout: "30s",
  });

  requestCounter.add(1);

  const ok = check(response, {
    "status is 200": (r) => r.status === 200,
  });

  successCounter.add(ok ? 1 : 0);
  failCounter.add(ok ? 0 : 1);

  const ms = Math.round(response.timings.duration);
  const time = new Date().toISOString();
  const info = `request #${requestNo} | ${elapsed}s into test | VU ${__VU} | active VUs ${activeVUs} | ${ms} ms`;

  if (response.status === 504) {
    gateway504Counter.add(1);
    console.error(`[504] ${time} | ${info} | gateway timeout from server`);
  } else if (response.status === 0) {
    clientTimeoutCounter.add(1);
    console.error(`[TIMEOUT] ${time} | ${info} | ${response.error || "no response"}`);
  } else if (ok) {
    if (LOG_EVERY_REQUEST) {
      console.log(`[OK] ${time} | ${info} | status ${response.status}`);
    }
  } else {
    console.error(`[FAIL] ${time} | ${info} | status ${response.status}`);
  }

  sleep(1);
}