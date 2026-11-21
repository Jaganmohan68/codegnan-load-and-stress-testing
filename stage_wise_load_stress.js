import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = "https://staging.codegnan.com";

const TOTAL_VUS = 10;
const TEST_DURATION_SECONDS = 60;
// const HTTP_TIMEOUT = "30s";

const STAGE = Number(__ENV.STAGE || 1);

if (!Number.isInteger(STAGE) || STAGE < 1) {
  throw new Error("STAGE must be a positive integer.");
}

const REQUESTS_PER_VU = STAGE;
const EXPECTED_TOTAL_REQUESTS = TOTAL_VUS * REQUESTS_PER_VU;

const REQUEST_INTERVAL = TEST_DURATION_SECONDS / REQUESTS_PER_VU;

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

if (urls.length !== TOTAL_VUS) {
  throw new Error(`Expected ${TOTAL_VUS} URLs, but found ${urls.length}`);
}

if (new Set(urls).size !== urls.length) {
  throw new Error("Duplicate endpoints found.");
}

// ==================================================
// 3. CUSTOM METRICS
// ==================================================

const totalRequests = new Counter("total_requests");
const successfulRequests = new Counter("successful_requests");
const failedRequests = new Counter("failed_requests");

const gateway504Errors = new Counter("gateway_504_errors");
const clientTimeouts = new Counter("client_timeouts");
const transportErrors = new Counter("transport_errors");

const responseTime = new Trend("overall_response_time", true);

// Separate endpoint response-time metrics
const endpointTrends = urls.map((url, index) => ({
  endpoint: url,
  metric: new Trend(`endpoint_${index + 1}_response_time`, true),
}));

// ==================================================
// 4. K6 OPTIONS
// ==================================================

export const options = {
  scenarios: {
    stage_load_test: {
      executor: "per-vu-iterations",
      vus: TOTAL_VUS,
      iterations: REQUESTS_PER_VU,
      maxDuration: "5m",
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
// 5. HELPER FUNCTIONS
// ==================================================

function round(value, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(decimals));
}

function getMetricValue(data, metricName, statistic) {
  const metric = data.metrics[metricName];

  if (!metric || !metric.values) {
    return null;
  }

  return round(metric.values[statistic]);
}

function percentage(value, total) {
  if (!total) return 0;
  return round((value / total) * 100);
}

// ==================================================
// 6. SETUP
// ==================================================

export function setup() {
  console.log("");
  console.log("==================================================");
  console.log(`       STAGE ${STAGE} - CONTROLLED LOAD TEST`);
  console.log("==================================================");

  console.log(`Base URL             : ${BASE_URL}`);
  console.log(`Virtual Users        : ${TOTAL_VUS}`);
  console.log(`Requests per VU      : ${REQUESTS_PER_VU}`);
  console.log(`Expected Requests    : ${EXPECTED_TOTAL_REQUESTS}`);
  console.log(`Request Interval     : ${REQUEST_INTERVAL} seconds`);
  console.log(`Target Duration      : ${TEST_DURATION_SECONDS} seconds`);

  console.log("");
  console.log("VU TO ENDPOINT MAPPING");
  console.log("--------------------------------------------------");

  urls.forEach((url, index) => {
    console.log(`VU ${index + 1} -> ${url}`);
  });

  console.log("==================================================");
  console.log("");

  return {
    startedAt: Date.now(),
  };
}

// ==================================================
// 7. MAIN TEST FUNCTION
// ==================================================

export default function () {
  const vu = __VU;
  const iteration = __ITER + 1;

  // Each VU is assigned exactly one endpoint.
  const endpointIndex = vu - 1;
  const endpoint = urls[endpointIndex];

  const requestStart = Date.now();

  const fullUrl = `${BASE_URL}${endpoint}`;

  console.log(
    `[REQUEST] Stage ${STAGE} | VU ${vu} | ` +
      `Request ${iteration}/${REQUESTS_PER_VU} | ${endpoint}`,
  );

  const response = http.get(fullUrl, {
    // timeout: HTTP_TIMEOUT,

    tags: {
      stage: `stage_${STAGE}`,
      endpoint: endpoint,
      endpoint_number: String(vu),
      assigned_vu: String(vu),
    },
  });

  const elapsed = response.timings.duration;

  totalRequests.add(1);
  responseTime.add(elapsed);
  endpointTrends[endpointIndex].metric.add(elapsed);

  const isSuccessful = check(response, {
    "HTTP status is 200": (r) => r.status === 200,
  });

  if (isSuccessful) {
    successfulRequests.add(1);

    console.log(
      `[SUCCESS] VU ${vu} | ${endpoint} | ` +
        `Status: ${response.status} | ` +
        `Response: ${round(elapsed)} ms`,
    );
  } else {
    failedRequests.add(1);

    console.log(
      `[FAILED] VU ${vu} | ${endpoint} | ` +
        `Status: ${response.status} | ` +
        `Response: ${round(elapsed)} ms`,
    );
  }

  if (response.status === 504) {
    gateway504Errors.add(1);
  }

  if (response.status === 0) {
    if (response.error && response.error.includes("timeout")) {
      clientTimeouts.add(1);
    } else {
      transportErrors.add(1);
    }
  }

  // Pace requests evenly across approximately 60 seconds.
  // The interval is measured from the start of this iteration.
  const iterationElapsed = (Date.now() - requestStart) / 1000;

  const remainingWait = REQUEST_INTERVAL - iterationElapsed;

  if (remainingWait > 0 && iteration < REQUESTS_PER_VU) {
    console.log(`[WAIT] VU ${vu} | Waiting ${round(remainingWait)} seconds`);

    sleep(remainingWait);
  }
}

// ==================================================
// 8. FINAL REPORT
// ==================================================

export function handleSummary(data) {
  const actualRequests = data.metrics.total_requests?.values?.count || 0;

  const successful = data.metrics.successful_requests?.values?.count || 0;

  const failed = data.metrics.failed_requests?.values?.count || 0;

  const errors504 = data.metrics.gateway_504_errors?.values?.count || 0;

  const timeouts = data.metrics.client_timeouts?.values?.count || 0;

  const transport = data.metrics.transport_errors?.values?.count || 0;

  const actualDuration = data.state.testRunDurationMs / 1000;

  const checksRate = data.metrics.checks?.values?.rate || 0;

  const failedRate = data.metrics.http_req_failed?.values?.rate || 0;

  const responseStats = {
    average: getMetricValue(data, "overall_response_time", "avg"),
    minimum: getMetricValue(data, "overall_response_time", "min"),
    median: getMetricValue(data, "overall_response_time", "med"),
    maximum: getMetricValue(data, "overall_response_time", "max"),
    p90: getMetricValue(data, "overall_response_time", "p(90)"),
    p95: getMetricValue(data, "overall_response_time", "p(95)"),
    p99: getMetricValue(data, "overall_response_time", "p(99)"),
  };

  const endpointReports = urls.map((url, index) => {
    const metricName = `endpoint_${index + 1}_response_time`;

    const requestsForEndpoint = data.metrics[metricName]?.values?.count || 0;

    const endpointSuccess = data.metrics[`http_reqs`]?.values?.count
      ? null
      : null;

    return {
      vu: index + 1,
      endpoint_number: index + 1,
      endpoint: url,
      requests: requestsForEndpoint,
      response_time_ms: {
        average: getMetricValue(data, metricName, "avg"),
        minimum: getMetricValue(data, metricName, "min"),
        maximum: getMetricValue(data, metricName, "max"),
        p90: getMetricValue(data, metricName, "p(90)"),
        p95: getMetricValue(data, metricName, "p(95)"),
        p99: getMetricValue(data, metricName, "p(99)"),
      },
    };
  });

  // Determine threshold results from actual metrics.
  const thresholdResults = {};

  for (const [metricName, metric] of Object.entries(data.metrics)) {
    if (metric.thresholds) {
      for (const [thresholdName, threshold] of Object.entries(
        metric.thresholds,
      )) {
        thresholdResults[`${metricName}: ${thresholdName}`] = threshold.ok
          ? "PASS"
          : "FAIL";
      }
    }
  }

  const expectedCountPass = actualRequests === EXPECTED_TOTAL_REQUESTS;

  const summary = {
    test_name: `Stage ${STAGE} - Controlled Load Test`,

    test_configuration: {
      base_url: BASE_URL,
      stage: STAGE,
      total_endpoints: urls.length,
      virtual_users: TOTAL_VUS,
      requests_per_vu: REQUESTS_PER_VU,
      request_interval_seconds: REQUEST_INTERVAL,
      target_duration_seconds: TEST_DURATION_SECONDS,
      actual_duration_seconds: round(actualDuration),
      expected_total_requests: EXPECTED_TOTAL_REQUESTS,
      actual_total_requests: actualRequests,

      vu_endpoint_mapping: urls.map((endpoint, index) => ({
        vu: index + 1,
        endpoint_number: index + 1,
        endpoint: endpoint,
        expected_requests: REQUESTS_PER_VU,
      })),
    },

    request_summary: {
      total_requests: actualRequests,
      successful_requests: successful,
      failed_requests: failed,
      success_rate_percent: percentage(successful, actualRequests),
      failed_rate_percent: percentage(failed, actualRequests),
      check_pass_rate_percent: round(checksRate * 100),
    },

    error_summary: {
      gateway_504_errors: errors504,
      client_timeouts: timeouts,
      transport_errors: transport,
    },

    overall_response_time_ms: responseStats,

    endpoint_wise_performance: endpointReports,

    threshold_validation: {
      expected_request_count: expectedCountPass ? "PASS" : "FAIL",

      ...thresholdResults,
    },
  };

  // Human-readable console report.
  let output = "";

  function line(value = "") {
    output += value + "\n";
  }

  function heading(value) {
    line("");
    line("==================================================");
    line(value);
    line("==================================================");
  }

  heading(`STAGE ${STAGE} FINAL REPORT`);

  line("1. TEST CONFIGURATION");
  line("--------------------------------------------------");
  line(`Base URL                 : ${BASE_URL}`);
  line(`Virtual Users            : ${TOTAL_VUS}`);
  line(`Requests per VU          : ${REQUESTS_PER_VU}`);
  line(`Expected Requests        : ${EXPECTED_TOTAL_REQUESTS}`);
  line(`Actual Requests          : ${actualRequests}`);
  line(`Target Duration          : ${TEST_DURATION_SECONDS} seconds`);
  line(`Actual Duration          : ${round(actualDuration)} seconds`);

  heading("2. REQUEST SUMMARY");

  line(`Total Requests           : ${actualRequests}`);
  line(`Successful Requests      : ${successful}`);
  line(`Failed Requests          : ${failed}`);
  line(`Success Rate             : ${percentage(successful, actualRequests)}%`);
  line(`Failure Rate             : ${percentage(failed, actualRequests)}%`);
  line(`Check Pass Rate          : ${round(checksRate * 100)}%`);

  heading("3. ERROR SUMMARY");

  line(`Gateway 504 Errors       : ${errors504}`);
  line(`Client Timeouts          : ${timeouts}`);
  line(`Transport Errors         : ${transport}`);

  heading("4. OVERALL RESPONSE TIME (ms)");

  line(`Average                  : ${responseStats.average}`);
  line(`Minimum                  : ${responseStats.minimum}`);
  line(`Median                   : ${responseStats.median}`);
  line(`Maximum                  : ${responseStats.maximum}`);
  line(`P90                      : ${responseStats.p90}`);
  line(`P95                      : ${responseStats.p95}`);
  line(`P99                      : ${responseStats.p99}`);

  heading("5. ENDPOINT-WISE PERFORMANCE");

  line("VU | Requests | Average(ms) | Minimum(ms) | Maximum(ms) | P95(ms)");

  line("--------------------------------------------------");

  endpointReports.forEach((item) => {
    const r = item.response_time_ms;

    line(
      `${item.vu} | ${item.requests} | ` +
        `${r.average} | ${r.minimum} | ${r.maximum} | ${r.p95}`,
    );

    line(`   Endpoint: ${item.endpoint}`);
  });

  heading("6. THRESHOLD VALIDATION");

  line(`Expected Request Count   : ${expectedCountPass ? "PASS" : "FAIL"}`);

  for (const [name, status] of Object.entries(thresholdResults)) {
    line(`${name} : ${status}`);
  }

  heading("END OF REPORT");

  const jsonOutput = JSON.stringify(summary, null, 4);

  console.log(output);

  return {
    stdout: output,
    [`stage_${STAGE}_summary.json`]: jsonOutput,
  };
}
