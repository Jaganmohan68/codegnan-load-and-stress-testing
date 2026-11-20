import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import exec from "k6/execution";

const BASE_URL = "https://staging.codegnan.com";
const LOG_EVERY_REQUEST = true; // false = print failures only (recommended for stress)

const successRequests = new Counter("success_requests");
const failedRequests = new Counter("failed_requests");

const STAGES = [
  { seconds: 60, target: 10 },
  { seconds: 180, target: 10 },
  { seconds: 30, target: 20 }, 
  { seconds: 180, target: 20 },
  { seconds: 30, target: 30 },
  { seconds: 180, target: 30 },
  { seconds: 30, target: 40 },
  { seconds: 180, target: 40 },
  { seconds: 30, target: 60 },
  { seconds: 180, target: 60 },
  { seconds: 60, target: 0 },
];

// Build a list of steps with their end time and a label
let t = 0;
let prev = 0;
const STEPS = STAGES.map((s) => {
  t += s.seconds;
  const label = s.target === prev ? `hold_${s.target}` : `ramp_to_${s.target}`;
  prev = s.target;
  return { endSec: t, label: label };
});

// Which step are we in right now?
function currentStep() {
  const elapsedSec = exec.instance.currentTestRunDuration / 1000;
  for (const s of STEPS) {
    if (elapsedSec <= s.endSec) return s.label;
  }
  return STEPS[STEPS.length - 1].label;
}

const thresholds = {
  http_req_failed: ["rate<0.01"], // less than 1% failed requests
  http_req_duration: ["p(95)<1000", "p(99)<1000"], // 95% and 99% under 1 second
};

// These always pass; they only make k6 print results per step
for (const s of STEPS) {
  thresholds[`success_requests{step:${s.label}}`] = ["count>=0"];
  thresholds[`failed_requests{step:${s.label}}`] = ["count>=0"];
  thresholds[`http_req_duration{step:${s.label}}`] = ["p(95)>=0"];
}

export const options = {
  stages: STAGES.map((s) => ({ duration: `${s.seconds}s`, target: s.target })),
  thresholds: thresholds,
};

export default function () {
  // Note the step, time and active VUs when the request STARTS
  const step = currentStep();
  const activeVUs = exec.instance.vusActive;
  const startTime = new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  const res = http.get(BASE_URL, {
    timeout: "30s",
    tags: { step: step },
  });
  const ms = Math.round(res.timings.duration);

  // Only check for 200 OK
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (ok) {
    successRequests.add(1, { step: step });

    if (LOG_EVERY_REQUEST) {
      console.log(
        `[OK]   ${startTime} | ${step} | active VUs ${activeVUs} | VU ${__VU} | status ${res.status} | ${ms} ms`,
      );
    }
  } else {
    failedRequests.add(1, { step: step });

    console.error(
      `[FAIL] ${startTime} | ${step} | active VUs ${activeVUs} | VU ${__VU} | status ${res.status} | ${ms} ms | error: ${res.error || "none"}`,
    );
  }

  sleep(1);
}
