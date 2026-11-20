import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const base_url = "https://staging.codegnan.com";
const endpoint_path = "/intensive-pro/";

// const endpoint_path = "/full-stack-java-training-course-in-vijayawada/"; 
// const endpoint_path = "/java-full-stack-course-in-visakhapatnam/";

// const endpoint_path ="/full-stack-java-training-course-in-hyderabad/";
// const endpoint_path ="/python-full-stack-training-course-in-vijayawada/";
// const endpoint_path ="/python-full-stack-course-in-visakhapatnam/";
// const endpoint_path="/python-full-stack-developer-course-in-hyderabad/";
// const endpoint_path="/data-analytics-course-in-vijayawada/";
// const endpoint_path = "/data-analytics-course-in-visakhapatnam/";
// const endpoint_path = "/data-analytics-course-in-hyderabad/";
// const endpoint_path ="/courses/data-science-with-agentic-ai-course-in-vijayawada/";
// const endpoint_path = "/courses/data-science-with-agentic-ai-course-in-hyderabad/";
// const endpoint_path ="/courses/data-science-with-agentic-ai-course-in-visakhapatnam/";
// const endpoint_path ="/courses/career-restart-full-stack-software-engineering-program/";
// const endpoint_path="/job-accelerator-program/";


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

//   stress: {
//     executor: "ramping-vus",
//     startVUs: 0,
//     stages: [
//   { duration: '1m', target: 10 }, { duration: '3m', target: 10 },
//   { duration: '30s', target: 20 }, { duration: '3m', target: 20 },
//   { duration: '30s', target: 30 }, { duration: '3m', target: 30 },
//   { duration: '30s', target: 40 }, { duration: '3m', target: 40 },
//   { duration: '30s', target: 60 }, { duration: '3m', target: 60 },
//   { duration: '1m', target: 0 },
// ],
//     gracefulRampDown: "30s",
//   },
};

// ---------------- THRESHOLDS ----------------
const thresholds =
  TYPE === "stress"
    ? {
        http_req_failed: ["rate<0.10"],
        http_req_duration: ["p(95)<1000"],
      }
    : {
        http_req_duration: ["p(90)<1000", "p(95)<1000", "p(99)<1000"],
        http_req_failed: ["rate<0.01"],
        checks: ["rate>0.99"],
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

// ---------------- SETUP ----------------
export function setup() {
  if (!base_url || !endpoint_path) {
    throw new Error("base_url or endpoint_path is empty");
  }
  if (!scenarios[TYPE]) {
    throw new Error(`TYPE "${TYPE}" must be "load" or "stress"`);
  }
  console.log(`Starting ${TYPE} test on ${base_url}${endpoint_path}`);
}

// ---------------- MAIN ----------------
export default function () {
  const response = http.get(`${base_url}${endpoint_path}`, {
    tags: { endpoint: "single-endpoint" },
    timeout: "30s", // give up after 30s instead of waiting the default 60s
  });

  requestCounter.add(1);

  const ok = check(response, {
    "status is 200": (r) => r.status === 200,
  });

  // Add 1 or 0 every time, so both counters always appear in the summary
  successCounter.add(ok ? 1 : 0);
  failCounter.add(ok ? 0 : 1);

  const ms = Math.round(response.timings.duration);

  if (ok) {
    if (LOG_EVERY_REQUEST) {
      console.log(
        `[OK]   VU ${__VU} | GET ${endpoint_path} | status ${response.status} | ${ms} ms`,
      );
    }
  } else {
    console.error(
      `[FAIL] VU ${__VU} | GET ${endpoint_path} | status ${response.status} | ${ms} ms | error: ${response.error || "none"}`,
    );
  }

  sleep(1);
}