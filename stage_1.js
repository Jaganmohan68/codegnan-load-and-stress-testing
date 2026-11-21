import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = "https://staging.codegnan.com";

const urls = [
  "/testimonials/",
  "/bangalore/",
  "/learn-software-testing/",
  "/sairam-uppugundla/",
  "/kishor-kumar/",
  "/learn-data-science/",
  "/refunds-cancellations/",
  "/jitendra-chautharia/",
  "/learn-machine-learning/",
  "/our-team/",
];

// ==================================================
// 3. TEST CONFIGURATION
// ==================================================

const TOTAL_VUS = 10;

// Pass MINUTES=1, 2, 3, etc. from CMD.
const TEST_MINUTES = Number(__ENV.MINUTES || 1);

const REQUEST_INTERVAL = 60;
const HTTP_TIMEOUT = "30s";

const TOTAL_ENDPOINTS = urls.length;
const EXPECTED_REQUESTS = TOTAL_VUS * TEST_MINUTES;

// ==================================================
// 4. VALIDATION
// ==================================================

if (TOTAL_ENDPOINTS !== TOTAL_VUS) {
  throw new Error(`Expected ${TOTAL_VUS} endpoints, found ${TOTAL_ENDPOINTS}`);
}

if (!Number.isInteger(TEST_MINUTES) || TEST_MINUTES < 1) {
  throw new Error("MINUTES must be a positive integer.");
}

if (!BASE_URL) {
  throw new Error("Base URL is missing.");
}

if (new Set(urls).size !== TOTAL_ENDPOINTS) {
  throw new Error("Duplicate endpoint paths found.");
}

const requestCounter = new Counter("endpoint_requests");

const successCounter = new Counter("successful_requests");

const failureCounter = new Counter("failed_requests");

const gateway504Counter = new Counter("gateway_504_errors");

const clientTimeoutCounter = new Counter("client_timeouts");

const endpointResponseTime = new Trend("endpoint_response_time", true);

// Stores response time along with H1 and endpoint tags
// in the raw k6 JSON output.
const h1Capture = new Trend("endpoint_h1_capture", true);

// ==================================================
// 6. K6 OPTIONS
// ==================================================

export const options = {
  scenarios: {
    stage_1_load: {
      executor: "per-vu-iterations",

      vus: TOTAL_VUS,

      // Each VU executes exactly TEST_MINUTES iterations.
      iterations: TEST_MINUTES,

      // Allow time for the final 60-second interval.
      maxDuration: `${TEST_MINUTES + 1}m`,
    },
  },

  thresholds: {
    http_req_duration: ["p(90)<1000", "p(95)<1000", "p(99)<1000"],

    http_req_failed: ["rate<0.01"],

    checks: ["rate>0.99"],

    gateway_504_errors: ["count==0"],

    client_timeouts: ["count==0"],
  },

  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ==================================================
// 7. H1 EXTRACTION FUNCTION
// ==================================================

function extractH1(html) {
  if (!html) {
    return "H1_NOT_FOUND";
  }

  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

  if (!match) {
    return "H1_NOT_FOUND";
  }

  return (
    match[1]
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim() || "H1_EMPTY"
  );
}

export function setup() {
  console.log("\n");
  console.log("==================================================");
  console.log("              STAGE 1 LOAD TEST");
  console.log("==================================================");

  console.log(`Base URL          : ${BASE_URL}`);
  console.log(`Total Endpoints   : ${TOTAL_ENDPOINTS}`);
  console.log(`Virtual Users     : ${TOTAL_VUS}`);
  console.log(`Test Duration     : ${TEST_MINUTES} minute(s)`);
  console.log(`Requests per VU   : ${TEST_MINUTES}`);
  console.log(`Expected Requests : ${EXPECTED_REQUESTS}`);

  console.log("==================================================");
  console.log("              VU ENDPOINT MAPPING");
  console.log("==================================================");

  for (let i = 0; i < TOTAL_ENDPOINTS; i++) {
    console.log(`VU ${i + 1} ---> Endpoint ${i + 1} ---> ${urls[i]}`);
  }

  console.log("==================================================");
  console.log("              TEST EXECUTION STARTED");
  console.log("==================================================\n");

  return {
    startTime: Date.now(),
  };
}

// ==================================================
// 9. MAIN TEST EXECUTION
// ==================================================

export default function () {
  const endpointIndex = __VU - 1;

  const endpoint = urls[endpointIndex];

  const targetURL = `${BASE_URL}${endpoint}`;

  // Iteration number for this VU.
  const requestNo = __ITER + 1;

  const iterationStart = Date.now();

  const timestamp = new Date().toISOString();

  // ==================================================
  // DISPLAY REQUEST IN CMD
  // ==================================================

  console.log(
    `\n[REQUEST START] ${timestamp} | ` +
      `VU ${__VU} | ` +
      `Request ${requestNo}/${TEST_MINUTES} | ` +
      `Endpoint ${endpointIndex + 1}/${TOTAL_ENDPOINTS} | ` +
      `URL: ${targetURL}`,
  );

  // ==================================================
  // SEND GET REQUEST
  // ==================================================

  const response = http.get(targetURL, {
    tags: {
      endpoint: endpoint,

      endpoint_number: String(endpointIndex + 1),

      assigned_vu: String(__VU),

      request_number: String(requestNo),
    },

    timeout: HTTP_TIMEOUT,
  });

  requestCounter.add(1, {
    endpoint: endpoint,
    assigned_vu: String(__VU),
  });

  // ==================================================
  // RESPONSE VALIDATION
  // ==================================================

  const passed = check(response, {
    "HTTP status is 200": (r) => r.status === 200,
  });

  successCounter.add(passed ? 1 : 0, {
    endpoint: endpoint,
  });

  failureCounter.add(passed ? 0 : 1, {
    endpoint: endpoint,
  });

  // ==================================================
  // RESPONSE INFORMATION
  // ==================================================

  const responseTime = response.timings.duration;

  const h1 = extractH1(response.body);

  const responseTimestamp = new Date().toISOString();

  endpointResponseTime.add(responseTime, {
    endpoint: endpoint,

    assigned_vu: String(__VU),
  });

  h1Capture.add(responseTime, {
    url: endpoint,

    h1_tag: h1,

    status: String(response.status),

    assigned_vu: String(__VU),

    endpoint_number: String(endpointIndex + 1),

    request_number: String(requestNo),
  });

  // ==================================================
  // ERROR HANDLING
  // ==================================================

  if (response.status === 504) {
    gateway504Counter.add(1);

    console.error(
      `[504 ERROR] VU ${__VU} | ` +
        `${endpoint} | ` +
        `${responseTime.toFixed(2)} ms`,
    );
  } else if (response.status === 0) {
    clientTimeoutCounter.add(1);

    console.error(
      `[TIMEOUT] VU ${__VU} | ` +
        `${endpoint} | ` +
        `${response.error || "No response"}`,
    );
  } else if (!passed) {
    console.error(
      `[FAILED] VU ${__VU} | ` +
        `${endpoint} | ` +
        `HTTP ${response.status} | ` +
        `${responseTime.toFixed(2)} ms`,
    );
  } else {
    console.log(
      `[SUCCESS] ${responseTimestamp} | ` +
        `VU ${__VU} | ` +
        `Request ${requestNo} | ` +
        `Endpoint ${endpointIndex + 1} | ` +
        `${endpoint} | ` +
        `HTTP ${response.status} | ` +
        `Response: ${responseTime.toFixed(2)} ms | ` +
        `H1: ${h1}`,
    );
  }

  // ==================================================
  // MAINTAIN 60-SECOND REQUEST INTERVAL
  // ==================================================

  const elapsedSeconds = (Date.now() - iterationStart) / 1000;

  const remainingTime = REQUEST_INTERVAL - elapsedSeconds;

  if (remainingTime > 0) {
    console.log(
      `[WAIT] VU ${__VU} | ` + `Waiting ${remainingTime.toFixed(2)} seconds`,
    );

    sleep(remainingTime);
  }
}

// ==================================================
// 10. FINAL SUMMARY REPORT
// ==================================================

export function handleSummary(data) {
  const metrics = data.metrics;

  const duration = metrics.http_req_duration?.values || {};

  const totalRequests = metrics.endpoint_requests?.values?.count || 0;

  const successfulRequests = metrics.successful_requests?.values?.count || 0;

  const failedRequests = metrics.failed_requests?.values?.count || 0;

  const gateway504Errors = metrics.gateway_504_errors?.values?.count || 0;

  const clientTimeouts = metrics.client_timeouts?.values?.count || 0;

  const failedRate = metrics.http_req_failed?.values?.rate ?? 0;

  const checkRate = metrics.checks?.values?.rate ?? 0;

  const report = {
    test_name: "Stage 1 - Controlled Load Test",

    test_configuration: {
      base_url: BASE_URL,

      total_endpoints: TOTAL_ENDPOINTS,

      virtual_users: TOTAL_VUS,

      duration_minutes: TEST_MINUTES,

      request_interval_seconds: REQUEST_INTERVAL,

      requests_per_vu: TEST_MINUTES,

      expected_total_requests: EXPECTED_REQUESTS,

      actual_total_requests: totalRequests,

      vu_endpoint_mapping: urls.map((endpoint, index) => ({
        vu: index + 1,

        endpoint_number: index + 1,

        endpoint: endpoint,

        expected_requests: TEST_MINUTES,
      })),
    },

    request_summary: {
      total_requests: totalRequests,

      successful_requests: successfulRequests,

      failed_requests: failedRequests,

      failed_rate: failedRate,

      check_pass_rate: checkRate,
    },

    error_summary: {
      gateway_504_errors: gateway504Errors,

      client_timeouts: clientTimeouts,
    },

    overall_response_time_ms: {
      average: duration.avg || 0,

      minimum: duration.min || 0,

      median: duration.med || 0,

      maximum: duration.max || 0,

      p90: duration["p(90)"] || 0,

      p95: duration["p(95)"] || 0,

      p99: duration["p(99)"] || 0,
    },

    threshold_validation: {
      expected_request_count: totalRequests === EXPECTED_REQUESTS,

      p90_under_1000ms:
        duration["p(90)"] !== undefined && duration["p(90)"] < 1000,

      p95_under_1000ms:
        duration["p(95)"] !== undefined && duration["p(95)"] < 1000,

      p99_under_1000ms:
        duration["p(99)"] !== undefined && duration["p(99)"] < 1000,

      failed_rate_under_1_percent: failedRate < 0.01,

      checks_above_99_percent: checkRate > 0.99,

      zero_504_errors: gateway504Errors === 0,

      zero_client_timeouts: clientTimeouts === 0,
    },
  };

  console.log("\n");
  console.log("==================================================");
  console.log("              STAGE 1 FINAL REPORT");
  console.log("==================================================");

  console.log(JSON.stringify(report, null, 4));

  console.log("==================================================");

  return {
    "stage_1_summary.json": JSON.stringify(report, null, 4),

    "stage_1_k6_summary.json": JSON.stringify(data, null, 4),
  };
}
