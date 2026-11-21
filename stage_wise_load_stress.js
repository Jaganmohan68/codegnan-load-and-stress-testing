
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

// Each VU sends STAGE requests.
// Example: Stage 3 = 3 requests per VU.

const REQUESTS_PER_VU = STAGE;

const EXPECTED_REQUESTS = TOTAL_VUS * REQUESTS_PER_VU;

// Distribute requests evenly across 60 seconds.
// Stage 1 = 60 seconds
// Stage 2 = 30 seconds
// Stage 3 = 20 seconds
// Stage 4 = 15 seconds

const REQUEST_INTERVAL =
    TEST_DURATION_SECONDS / REQUESTS_PER_VU;

// ==================================================
// 2. FIRST 10 ENDPOINTS
// ==================================================

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
    throw new Error(
        `Expected ${TOTAL_VUS} endpoints, found ${urls.length}.`
    );
}

if (new Set(urls).size !== urls.length) {
    throw new Error("Duplicate endpoints found.");
}

// ==================================================
// 3. K6 OPTIONS
// ==================================================

export const options = {

    scenarios: {

        stage_load_test: {

            executor: "per-vu-iterations",

            vus: TOTAL_VUS,

            iterations: REQUESTS_PER_VU,

            // Allow enough time for the final interval
            // and for slow HTTP responses.
            maxDuration: "2m",
        },
    },

    thresholds: {

        http_req_duration: [
            "p(90)<1000",
            "p(95)<1000",
            "p(99)<1000",
        ],

        http_req_failed: [
            "rate<0.01",
        ],

        checks: [
            "rate>0.99",
        ],

        gateway_504_errors: [
            "count==0",
        ],

        client_timeouts: [
            "count==0",
        ],
    },

    summaryTrendStats: [
        "avg",
        "min",
        "med",
        "max",
        "p(90)",
        "p(95)",
        "p(99)",
    ],
};

// ==================================================
// 4. CUSTOM METRICS
// ==================================================

const requestCounter = new Counter("endpoint_requests");

const successCounter = new Counter("successful_requests");

const failureCounter = new Counter("failed_requests");

const gateway504Counter = new Counter("gateway_504_errors");

const clientTimeoutCounter = new Counter("client_timeouts");

const transportErrorCounter = new Counter("transport_errors");

const endpointResponseTime = new Trend(
    "endpoint_response_time",
    true
);

const h1Capture = new Trend(
    "endpoint_h1_capture",
    true
);

// ==================================================
// 5. H1 EXTRACTION
// ==================================================

function extractH1(html) {

    if (!html) {
        return "H1_NOT_FOUND";
    }

    const match = html.match(
        /<h1\b[^>]*>([\s\S]*?)<\/h1>/i
    );

    if (!match) {
        return "H1_NOT_FOUND";
    }

    return match[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim() || "H1_EMPTY";
}

// ==================================================
// 6. SETUP
// ==================================================

export function setup() {

    console.log("==========================================");
    console.log(`          STAGE ${STAGE} LOAD TEST`);
    console.log("==========================================");

    console.log(`Base URL          : ${BASE_URL}`);
    console.log(`Virtual Users     : ${TOTAL_VUS}`);
    console.log(`Duration          : 1 minute`);
    console.log(`Endpoints         : ${urls.length}`);
    console.log(`Requests per VU   : ${REQUESTS_PER_VU}`);
    console.log(`Expected Requests : ${EXPECTED_REQUESTS}`);
    console.log(
        `Request Interval : ${REQUEST_INTERVAL.toFixed(2)} seconds`
    );

    console.log("------------------------------------------");
    console.log("VU ENDPOINT ASSIGNMENT");
    console.log("------------------------------------------");

    for (let i = 0; i < TOTAL_VUS; i++) {

        console.log(
            `VU ${i + 1} -> ${urls[i]}`
        );
    }

    console.log("==========================================");
}

// ==================================================
// 7. MAIN TEST EXECUTION
// ==================================================

export default function () {

    // Each VU permanently uses its own endpoint.
    //
    // VU 1  -> Endpoint 1
    // VU 2  -> Endpoint 2
    // ...
    // VU 10 -> Endpoint 10

    const endpointIndex = __VU - 1;

    const endpoint = urls[endpointIndex];

    const targetURL = `${BASE_URL}${endpoint}`;

    const requestNumber = __ITER + 1;

    const iterationStart = Date.now();

    const timestamp = new Date().toISOString();

    console.log("------------------------------------------");

    console.log(
        `[REQUEST START] ${timestamp} | ` +
        `STAGE ${STAGE} | ` +
        `VU ${__VU} | ` +
        `Request ${requestNumber}/${REQUESTS_PER_VU} | ` +
        `Endpoint: ${endpoint}`
    );

    // ----------------------------------------------
    // HTTP GET REQUEST
    // ----------------------------------------------

    const response = http.get(targetURL, {

        tags: {
            stage: String(STAGE),
            endpoint: endpoint,
            endpoint_number: String(endpointIndex + 1),
            assigned_vu: String(__VU),
            request_number: String(requestNumber),
        },

        // timeout: HTTP_TIMEOUT,
    });

    const responseTime = response.timings.duration;

    const h1 = extractH1(response.body);

    const responseTimestamp = new Date().toISOString();

    // ----------------------------------------------
    // REQUEST COUNTERS
    // ----------------------------------------------

    requestCounter.add(1, {
        stage: String(STAGE),
        endpoint: endpoint,
        assigned_vu: String(__VU),
    });

    endpointResponseTime.add(responseTime, {
        stage: String(STAGE),
        endpoint: endpoint,
        assigned_vu: String(__VU),
    });

    h1Capture.add(responseTime, {
        stage: String(STAGE),
        url: endpoint,
        h1_tag: h1,
        status: String(response.status),
        assigned_vu: String(__VU),
        request_number: String(requestNumber),
    });

    // ----------------------------------------------
    // HTTP STATUS CHECK
    // ----------------------------------------------

    const passed = check(response, {

        "HTTP status is 200": (r) => r.status === 200,

    });

    if (passed) {

        successCounter.add(1);

    } else {

        failureCounter.add(1);

    }

    // ----------------------------------------------
    // ERROR CLASSIFICATION
    // ----------------------------------------------

    const errorMessage = response.error || "";

    if (response.status === 504) {

        gateway504Counter.add(1);

        console.error(
            `[504 ERROR] Stage ${STAGE} | ` +
            `VU ${__VU} | Endpoint ${endpoint} | ` +
            `${errorMessage}`
        );

    } else if (response.status === 0) {

        if (/timeout|timed out|deadline exceeded/i.test(errorMessage)) {

            clientTimeoutCounter.add(1);

            console.error(
                `[TIMEOUT] Stage ${STAGE} | ` +
                `VU ${__VU} | Endpoint ${endpoint} | ` +
                `${errorMessage || "Request timed out"}`
            );

        } else {

            transportErrorCounter.add(1);

            console.error(
                `[TRANSPORT ERROR] Stage ${STAGE} | ` +
                `VU ${__VU} | Endpoint ${endpoint} | ` +
                `${errorMessage || "No HTTP response"}`
            );
        }

    } else if (!passed) {

        console.error(
            `[HTTP ERROR] Stage ${STAGE} | ` +
            `VU ${__VU} | Endpoint ${endpoint} | ` +
            `Status ${response.status} | ${errorMessage}`
        );
    }

    // ----------------------------------------------
    // CMD OUTPUT
    // ----------------------------------------------

    if (passed) {

        console.log(
            `[SUCCESS] Stage ${STAGE} | ` +
            `VU ${__VU} | ` +
            `Status ${response.status} | ` +
            `Response Time ${responseTime.toFixed(2)} ms`
        );

    } else {

        console.log(
            `[FAILED] Stage ${STAGE} | ` +
            `VU ${__VU} | ` +
            `Status ${response.status} | ` +
            `Response Time ${responseTime.toFixed(2)} ms`
        );
    }

    console.log(
        `[H1 TAG] ${endpoint} | ${h1}`
    );

    console.log(
        `[RESPONSE TIME] ${responseTimestamp} | ` +
        `${responseTime.toFixed(2)} ms`
    );

    // ----------------------------------------------
    // REQUEST PACING
    // ----------------------------------------------

    // Spread each VU's requests across 60 seconds.
    //
    // Stage 1: 1 request at approximately 0 seconds.
    // Stage 2: 2 requests at approximately 0, 30 seconds.
    // Stage 3: 3 requests at approximately 0, 20, 40 seconds.
    //
    // The final iteration also waits for the remaining
    // interval so the test lasts approximately 1 minute.

    const elapsedSeconds =
        (Date.now() - iterationStart) / 1000;

    const remainingTime =
        REQUEST_INTERVAL - elapsedSeconds;

    if (remainingTime > 0) {

        console.log(
            `[WAIT] Stage ${STAGE} | VU ${__VU} | ` +
            `Waiting ${remainingTime.toFixed(2)} seconds`
        );

        sleep(remainingTime);
    }
}

// ==================================================
// 8. FINAL JSON REPORT
// ==================================================

export function handleSummary(data) {

    function getMetric(name, field) {

        const metric = data.metrics[name];

        if (!metric || !metric.values) {
            return 0;
        }

        return metric.values[field] ?? 0;
    }

    const totalRequests = getMetric(
        "endpoint_requests",
        "count"
    );

    const successfulRequests = getMetric(
        "successful_requests",
        "count"
    );

    const failedRequests = getMetric(
        "failed_requests",
        "count"
    );

    const failedRate = totalRequests > 0
        ? failedRequests / totalRequests
        : 0;

    const checkPassRate = getMetric(
        "checks",
        "rate"
    );

    const report = {

        test_name: `Stage ${STAGE} - Endpoint Load Test`,

        test_configuration: {

            stage: STAGE,

            base_url: BASE_URL,

            virtual_users: TOTAL_VUS,

            duration_seconds: TEST_DURATION_SECONDS,

            total_endpoints: urls.length,

            requests_per_vu: REQUESTS_PER_VU,

            request_interval_seconds: REQUEST_INTERVAL,

            expected_total_requests: EXPECTED_REQUESTS,

            actual_total_requests: totalRequests,

            endpoint_assignment: "One fixed endpoint per VU",
        },

        request_summary: {

            total_requests: totalRequests,

            successful_requests: successfulRequests,

            failed_requests: failedRequests,

            failed_rate: failedRate,

            check_pass_rate: checkPassRate,
        },

        error_summary: {

            gateway_504_errors: getMetric(
                "gateway_504_errors",
                "count"
            ),

            client_timeouts: getMetric(
                "client_timeouts",
                "count"
            ),

            transport_errors: getMetric(
                "transport_errors",
                "count"
            ),
        },

        response_time_ms: {

            average: getMetric("endpoint_response_time", "avg"),

            minimum: getMetric("endpoint_response_time", "min"),

            median: getMetric("endpoint_response_time", "med"),

            maximum: getMetric("endpoint_response_time", "max"),

            p90: getMetric("endpoint_response_time", "p(90)"),

            p95: getMetric("endpoint_response_time", "p(95)"),

            p99: getMetric("endpoint_response_time", "p(99)"),
        },

        threshold_validation: {

            expected_request_count:
                totalRequests === EXPECTED_REQUESTS,

            p90_below_1000ms:
                getMetric("http_req_duration", "p(90)") < 1000,

            p95_below_1000ms:
                getMetric("http_req_duration", "p(95)") < 1000,

            p99_below_1000ms:
                getMetric("http_req_duration", "p(99)") < 1000,

            failed_rate_below_1_percent:
                failedRate < 0.01,

            checks_above_99_percent:
                checkPassRate > 0.99,

            zero_504_errors:
                getMetric("gateway_504_errors", "count") === 0,

            zero_client_timeouts:
                getMetric("client_timeouts", "count") === 0,
        },
    };

    const prefix = `stage_${STAGE}`;

    return {

        [`${prefix}_summary.json`]:
            JSON.stringify(report, null, 4),

        [`${prefix}_k6_summary.json`]:
            JSON.stringify(data, null, 4),
    };
}
