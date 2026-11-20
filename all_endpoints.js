
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import exec from "k6/execution";

const base_url = "https://staging.codegnan.com";

// ==================================================
// 1. WEBSITE URL ENDPOINTS
// Total: 289 URL entries
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
    "/terms-and-conditions/",
    "/sai-vardhan-python-full-stack-mentor-at-codegnan/",
    "/saketh-kallepu/",
    "/manohar-chary-vadla/",
    "/ravi-siva-ram-teja/",
    "/privacy-policy/",
    "/cancellation-policy/",
    "/refund-policy/",
    "/terms-conditions/",
    "/learn-python/",
    "/upcoming-events/",
    "/learn-java/",
    "/student-ambassador-program/",
    "/campus-hyderabad/",
    "/machine-learning-course-in-vijayawada/",
    "/our-community/",
    "/visakhapatnam-campus/",
    "/student-app-privacy-policy/",
    "/student-app-terms-of-use/",
    "/placement/",
    "/mern-stack-training-in-vijayawada/",
    "/gallery/",
    "/it-software-training-in-hyderabad/",
    "/mern-stack-training-in-hyderabad/",
    "/software-testing-training-course-in-bangalore/",
    "/software-testing-training-course-in-hyderabad/",
    "/core-java-training-course-in-hyderabad/",
    "/software-testing-course-in-pune/",
    "/software-testing-training-course-in-india/",
    "/faqs/",
    "/software-testing-training-in-chennai/",
    "/data-structures-and-algorithms-training-in-vijayawada/",
    "/java-training-course-in-pune/",
    "/java-training-course-in-chennai/",
    "/java-training-course-in-coimbatore/",
    "/c-language-syllabus/",
    "/python-syllabus/",
    "/java-training-course-in-india/",
    "/it-software-training-institute-in-vijayawada/",
    "/software-testing-training-in-visakhapatnam/",
    "/internships/",
    "/hyderabad/",
    "/contact-us/",
    "/c-programming-course-training-in-vijayawada/",
    "/data-analytics-course-in-hyderabad/",
    "/machine-learning-syllabus/",
    "/download-data-structures-pdf/",
    "/python-full-stack-developer-course-in-hyderabad/",
    "/java-full-stack-developer-course-in-hyderabad/",
    "/data-science-course-in-visakhapatnam/",
    "/core-java-training-course-in-bangalore/",
    "/data-science-course-training-in-vijayawada/",
    "/data-analytics-course-in-visakhapatnam/",
    "/data-science-training-course-in-india/",
    "/java-training-in-visakhapatnam/",
    "/job-accelerator-program/",
    "/machine-learning-training-in-vijayawada/",
    "/java-full-stack-course-in-visakhapatnam/",
    "/machine-learning-course-training-in-hyderabad/",
    "/full-stack-java-training-course-in-hyderabad/",
    "/python-full-stack-course-in-visakhapatnam/",
    "/data-science-course-training-in-hyderabad/",
    "/data-analytics-course-in-vijayawada/",
    "/python-full-stack-training-course-in-vijayawada/",
    "/python-course-in-visakhapatnam/",
    "/free-demo-class/",
    "/about-us/",
    "/it-software-training-institute-in-bangalore/",
    "/vijayawada-campus/",
    "/intensive-pro/",
    "/apply-as-mentor/",
    "/hackathon/",
    "/core-java-training-course-in-vijayawada/",
    "/software-testing-training-course-in-vijayawada/",
    "/java-course-in-visakhapatnam/",
    "/python-training-in-vijayawada/",
    "/english-coach-privacy-policy/",
    "/english-coach-delete-account/",
    "/software-testing-training-course-in-coimbatore/",
    "/saikiran-tarigopula/",
    "/web-development-with-python-certification/",
    "/full-stack-developer-course-in-vijayawada/",
    "/full-stack-java-training-course-in-vijayawada/",
    "/react-js-training-course-in-vijayawada/",
    "/full-stack-developer-course-in-hyderabad/",
    "/python-training-course-in-hyderabad/",
    "/python-course-in-hyderabad/",
    "/full-stack-developer-course-in-visakhapatnam/",
    "/java-full-stack-training-course-in-bangalore/",
    "/python-full-stack-developer-course-in-bangalore/",
    "/python-training-in-bangalore/",
    "/full-stack-developer-course-in-bangalore/",
    "/python-course-in-pune/",
    "/python-training-course-in-chennai/",
    "/python-training-course-in-coimbatore/",
    "/python-training-course-in-india/",
    "/blogs/",
    "/how-to-become-a-machine-learning-engineer/",
    "/best-data-science-training-institutes-in-hyderabad/",
    "/python-interview-questions/",
    "/best-python-full-stack-training-institutes-in-bangalore/",
    "/artificial-intelligence-applications/",
    "/codegnan-hyderabad-offers-job-ready-python-java-data-science-courses/",
    "/data-science-course-fees-and-duration/",
    "/data-science-interview-questions/",
    "/how-to-become-a-data-scientist-in-india/",
    "/how-to-become-a-java-full-stack-developer/",
    "/how-to-become-a-python-developer/",
    "/how-to-become-a-software-tester/",
    "/java-interview-questions/",
    "/machine-learning-course-fees-and-duration/",
    "/python-career-opportunities/",
    "/react-js-vs-angular-which-is-best-javascript-framework/",
    "/best-software-testing-courses-in-bangalore/",
    "/best-java-training-institutes-in-bangalore/",
    "/full-stack-developer-course-fees-and-duration/",
    "/future-scope-of-data-science-career-in-india/",
    "/best-java-training-institutes-in-hyderabad/",
    "/how-to-become-ai-software-developer-in-india/",
    "/how-to-become-a-python-full-stack-developer/",
    "/java-course-syllabus/",
    "/python-course-syllabus/",
    "/react-js-course-syllabus/",
    "/c-language-course-syllabus/",
    "/java-developer-salary-in-bangalore/",
    "/python-developer-salary-in-bangalore/",
    "/machine-learning-engineer-salary-in-hyderabad/",
    "/data-scientist-salary-in-hyderabad/",
    "/software-tester-salary-in-hyderabad/",
    "/data-science-course-syllabus/",
    "/python-developer-salary-in-hyderabad/",
    "/java-developer-salary-in-hyderabad/",
    "/full-stack-java-developer-course-syllabus/",
    "/software-testing-course-syllabus/",
    "/python-full-stack-developer-course-syllabus/",
    "/machine-learning-course-syllabus/",
    "/java-career-paths/",  //we have to check the h1 of this page
    "/data-science-career-paths/",
    "/software-testing-career-paths/",
    "/machine-learning-career-path/",
    "/java-projects/",
    "/python-projects/",
    "/react-js-projects/",
    "/c-programming-projects/",
    "/data-science-projects-for-beginners/",
    "/data-structure-and-algorithm-project-ideas/",
    "/machine-learning-projects/",
    "/software-testing-projects/",
    "/python-career-paths/",
    "/how-to-convince-your-parents-to-support-a-codegnan-tech-course/",
    "/data-structures-and-algorithms-course-syllabus/",
    "/how-to-become-a-java-developer/",
    "/blogs/",
    "/blogs/data-science-course-after-12th-complete-guide-for-students-in-2026/",
    "/blogs/bubble-sort-program-in-c-with-algorithm-example-output/",
    "/blogs/data-analyst-jobs-in-hyderabad-and-vijayawada/",
    "/blogs/what-is-concept-learning-in-machine-learning/",
    "/blogs/agentic-ai-beginners-guide/",
    "/blogs/10-c-programming-career-paths/",
    "/blogs/full-stack-developer-career-paths/",
    "/blogs/career-after-engineering-in-hyderabad/",
    "/blogs/complete-python-programming-roadmap-for-freshers/",
    "/blogs/machine-learning-interview-questions-and-answers/",
    "/blogs/top-programming-languages-for-jobs-in-india/",
    "/blogs/java-developer-salary-in-india/",
    "/blogs/how-to-start-learning-data-science/",
    "/blogs/top-10-python-libraries-you-must-know/",
    "/blogs/reactjs-developer-salary-in-india/",
    "/blogs/data-science-interview-questions-and-answers-for-freshers-experienced-2026/",
    "/blogs/armstrong-number-program-in-python-with-examples-code-explanation/",
    "/blogs/java-full-stack-vs-python-full-stack/",
    "/blogs/top-10-react-js-career-paths/",
    "/blogs/top-agentic-ai-trends/",
    "/blogs/agentic-ai-salary-salary-guide/",
    "/blogs/is-ai-going-to-replace-java-full-stack-developers/",
    "/blogs/full-stack-developer-salary-in-india/",
    "/blogs/modern-devops-with-multi-cloud-guide/",
    "/blogs/can-a-beginner-learn-python-full-stack-in-6-months/",
    "/blogs/best-full-stack-data-science-project-ideas-for-beginners-in-2026/",
    "/blogs/devops-engineer-salary-in-india/",
    "/blogs/python-tutorial-for-beginners-complete-step-by-step-guide/",
    "/blogs/chatgpt-tutorial-for-beginners/",
    "/blogs/sql-interview-questions/",
    "/blogs/java-interview-questions-and-answers-guide/",
    "/blogs/full-stack-developer-roadmap/",
    "/blogs/ai-engineer-roadmap-guide/",
    "/blogs/software-engineer-salary-in-india/",
    "/blogs/how-to-become-a-software-engineer-after-b-tech-bca-bsc/",
    "/blogs/100-java-programs-with-output/",
    "/blogs/ai-projects-for-final-year-students/",
    "/blogs/fibonacci-series-in-c-program/",
    "/blogs/sql-cheat-sheet/",
    "/blogs/how-to-start-a-career-in-software-testing/",
    "/blogs/prime-number-program-in-c/",
    "/blogs/celebrating-codegnans-journey/",
    "/blogs/factorial-program-in-c-code-logic-examples/",
    "/blogs/data-science-roadmap-for-beginners/",
    "/blogs/how-to-create-a-portfolio-for-java-full-stack-developers/",
    "/blogs/java-full-stack-technologies/",
    "/blogs/full-stack-developer-course-career-launch/",
    "/blogs/project-based-genai-learning-beginner-jobs/",
    "/blogs/devops-engineer-salary/",
    "/blogs/learn-python-without-a-programming-background/",
    "/blogs/how-to-build-generative-ai-and-agentic-ai-with-python/",
    "/blogs/cyber-security-ethical-hacking-the-complete-guide/",
    "/blogs/full-stack-data-science-with-gen-ai-and-agentic-ai-guide/",
    "/blogs/generative-ai-vs-agentic-ai/",
    "/blogs/how-to-build-an-ai-chatbot/",
    "/blogs/how-to-become-an-azure-data-engineer/",
    "/blogs/levels-of-software-testing-in-engineering/",
    "/blogs/how-to-crack-technical-interviews-as-a-fresher/",
    "/blogs/javascript-and-node-js-interview-questions-for-freshers/",
    "/blogs/resume-tips-for-freshers/",
    "/blogs/softw-testing-interview-questions-for-freshers-with-answersare/",
    "/blogs/prime-number-in-python/",
    "/blogs/how-build-an-ai-tool-server-with-python-mcp/",
    "/blogs/how-to-become-an-ai-native-software-engineer/",
    "/blogs/software-testing-strategies-complete-guide-with-examples/",
    "/blogs/tech-jobs-in-andhra-pradesh/",
    "/blogs/ai-course-in-hyderabad/",
    "/blogs/mern-stack-development-guide/",
    "/blogs/how-to-become-a-data-analyst/",
    "/blogs/tcs-nqt/",
    "/blogs/flask-vs-django-vs-fastapi/",
    "/blogs/python-pattern-programs/",
    "/blogs/data-science-and-ai-course-guide/",
    "/blogs/how-to-become-a-react-developer/",
    "/blogs/what-does-a-java-full-stack-developer-do-career-guide/",
    "/blogs/playwright-vs-selenium/",
    "/courses/",
    "/courses/ai-mern-stack-training-course-in-vijayawada/",
    "/courses/data-science-with-agentic-ai-course-in-hyderabad/",
    "/courses/ai-mern-stack-training-course-in-hyderabad/",
    "/courses/ai-mern-stack-training-course-in-visakhapatnam/",
    "/courses/data-science-with-agentic-ai-course-in-visakhapatnam/",
    "/courses/data-science-with-agentic-ai-course-in-vijayawada/",
    "/courses/career-restart-full-stack-software-engineering-program/",
    "/community/",
    "/community/design-hub/",
    "/community/outreach-hub/",
    "/community/code-hub/",
    "/mentor/",
    "/mentor/hari-krishna-koluru/",
    "/mentor/thota-kiran-kumar/",
    "/mentor/kollipati-v-s-naga-mallikharjuna-rao/",
    "/mentor/puneeth-s/",
    "/mentor/paruvu-yogitha/",
    "/mentor/anusha-chippala/",
    "/mentor/buddarapu-anand-kumar/",
    "/event/",
    "/event/dsa-using-python/",
    "/category/academy/",
    "/category/agentic-ai/",
    "/category/artificial-intelligence/",
    "/category/c-language/",
    "/category/course/",
    "/category/data-science/",
    "/category/devops/",
    "/category/full-stack/",
    "/category/java/",
    "/category/machine-learning/",
    "/category/mern/",
    "/category/offline-course/",
    "/category/online-academy/",
    "/category/online-course/",
    "/category/others/",
    "/category/python/",
    "/category/react-js/",
    "/category/software-testing/",
    "/category/sql/",
    "/community-category/backend/",
    "/community-category/networking/",
    "/community-category/ui-ux/",
    "/event-category/challenge/",
    "/author/lavanshu529/",
    "/author/jagan/",
    "/author/jituthecoder/",
    "/author/sairam/",
    "/author/snigdhabiswas/",

];

// ==================================================
// 2. TEST CONFIGURATION
// ==================================================

const TYPE = __ENV.TYPE || "load";
const LOG_EVERY_REQUEST = __ENV.LOG !== "off";

const TOTAL_VUS = 10;
const TOTAL_CYCLES = 3;

const TOTAL_URLS = urls.length;
const TOTAL_ITERATIONS = TOTAL_URLS * TOTAL_CYCLES;

// ==================================================
// 3. VALIDATION
// ==================================================

if (!base_url || TOTAL_URLS === 0) {
    throw new Error("Base URL or URL list is empty");
}

const EXPECTED_URLS = 289;

if (TOTAL_URLS !== EXPECTED_URLS) {
    throw new Error(
        `Expected ${EXPECTED_URLS} URLs, but found ${TOTAL_URLS} URLs`
    );
}

// Duplicate paths are allowed.
const uniqueURLCount = new Set(urls).size;

if (uniqueURLCount !== TOTAL_URLS) {
    console.warn(
        `Warning: ${TOTAL_URLS - uniqueURLCount} duplicate URL entr(y/ies) found.`
    );
}

if (TYPE !== "load") {
    throw new Error(`Invalid TYPE: ${TYPE}`);
}

// ==================================================
// 4. SCENARIO CONFIGURATION
// ==================================================

const scenarios = {
    load: {
        executor: "shared-iterations",
        vus: TOTAL_VUS,
        iterations: TOTAL_ITERATIONS,
    },
};

// ==================================================
// 5. THRESHOLDS
// ==================================================

const thresholds = {
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
};

// ==================================================
// 6. K6 OPTIONS
// ==================================================

export const options = {
    scenarios: {
        [TYPE]: scenarios[TYPE],
    },

    thresholds,

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
// 7. CUSTOM METRICS
// ==================================================

const requestCounter = new Counter("endpoint_requests");
const successCounter = new Counter("success_requests");
const failCounter = new Counter("failed_requests");

const gateway504Counter = new Counter("gateway_504_errors");
const clientTimeoutCounter = new Counter("client_timeouts");

// Captures response time and H1 details in JSON output.
const h1Capture = new Trend("endpoint_h1_capture");

// ==================================================
// 8. H1 EXTRACTION FUNCTION
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

    const h1Text = match[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();

    return h1Text || "H1_EMPTY";
}

// ==================================================
// 9. SETUP
// ==================================================

export function setup() {

    console.log("==========================================");
    console.log("       WEBSITE LOAD TEST STARTED");
    console.log("==========================================");

    console.log(`Base URL         : ${base_url}`);
    console.log(`Total URLs       : ${TOTAL_URLS}`);
    console.log(`Virtual Users    : ${TOTAL_VUS}`);
    console.log(`Total Cycles     : ${TOTAL_CYCLES}`);
    console.log(`Requests per URL : ${TOTAL_CYCLES}`);
    console.log(`Total Requests   : ${TOTAL_ITERATIONS}`);

    console.log("==========================================");

    return {
        startTime: Date.now(),
    };
}

// ==================================================
// 10. MAIN TEST EXECUTION
// ==================================================

export default function (data) {

    // Global iteration number (zero-based).
    const iteration = exec.scenario.iterationInTest;

    // Round-robin URL selection.
    const urlIndex = iteration % TOTAL_URLS;

    // Current cycle number.
    const cycleNumber =
        Math.floor(iteration / TOTAL_URLS) + 1;

    // Current URL number.
    const urlNumber = urlIndex + 1;

    // Select endpoint.
    const endpoint_path = urls[urlIndex];
    const target_url = `${base_url}${endpoint_path}`;

    // Global request number.
    const requestNo = iteration + 1;

    // Elapsed time.
    const elapsed = (
        (Date.now() - data.startTime) / 1000
    ).toFixed(1);

    // Active VUs.
    const activeVUs = exec.instance.vusActive;

    // ==================================================
    // SEND GET REQUEST
    // ==================================================

    const response = http.get(target_url, {

        tags: {
            endpoint: endpoint_path,
            url_number: String(urlNumber),
            cycle: String(cycleNumber),
        },

        timeout: "30s",
    });

    requestCounter.add(1);

    // ==================================================
    // RESPONSE VALIDATION
    // ==================================================

    const ok = check(response, {
        "status is 200": (r) => r.status === 200,
    });

    successCounter.add(ok ? 1 : 0);
    failCounter.add(ok ? 0 : 1);

    // ==================================================
    // REQUEST INFORMATION
    // ==================================================

    const ms = Math.round(response.timings.duration);
    const time = new Date().toISOString();

    const info =
        `Request #${requestNo} | ` +
        `Cycle ${cycleNumber}/${TOTAL_CYCLES} | ` +
        `URL ${urlNumber}/${TOTAL_URLS} | ` +
        `${elapsed}s into test | ` +
        `VU ${__VU} | ` +
        `Active VUs ${activeVUs} | ` +
        `${ms} ms`;

    // ==================================================
    // EXTRACT H1 TAG
    // ==================================================

    const h1Tag = extractH1(response.body);

    // Save H1 details as a custom Trend metric.
    // Each JSON Point contains the response time as its value
    // and the URL, H1, status, and cycle as tags.

    h1Capture.add(ms, {

        url: endpoint_path,
        h1_tag: h1Tag,
        status: String(response.status),
        cycle: String(cycleNumber),
        url_number: String(urlNumber),

    });

    if (LOG_EVERY_REQUEST) {
        console.log(
            `[H1] ${endpoint_path} | ${h1Tag}`
        );
    }

    // ==================================================
    // ERROR HANDLING
    // ==================================================

    if (response.status === 504) {

        gateway504Counter.add(1);

        console.error(
            `[504] ${time} | ${info} | Gateway timeout from server`
        );

    } else if (response.status === 0) {

        clientTimeoutCounter.add(1);

        console.error(
            `[TIMEOUT] ${time} | ${info} | ${response.error || "No response"}`
        );

    } else if (ok) {

        if (LOG_EVERY_REQUEST) {
            console.log(
                `[OK] ${time} | ${info} | Status ${response.status}`
            );
        }

    } else {

        console.error(
            `[FAIL] ${time} | ${info} | Status ${response.status}`
        );
    }

    
    sleep(1);
}

// ==================================================
// 11. FINAL SUMMARY REPORT
// ==================================================

export function handleSummary(data) {

    const metrics = data.metrics;

    const totalRequests =
        metrics.endpoint_requests?.values?.count || 0;

    const successfulRequests =
        metrics.success_requests?.values?.count || 0;

    const failedRequests =
        metrics.failed_requests?.values?.count || 0;

    const gateway504Errors =
        metrics.gateway_504_errors?.values?.count || 0;

    const clientTimeouts =
        metrics.client_timeouts?.values?.count || 0;

    const duration =
        metrics.http_req_duration?.values || {};

    const failedRate =
        metrics.http_req_failed?.values?.rate || 0;

    const checkRate =
        metrics.checks?.values?.rate || 0;

    const report = {

        test_configuration: {

            total_urls: TOTAL_URLS,
            virtual_users: TOTAL_VUS,
            total_cycles: TOTAL_CYCLES,
            requests_per_url: TOTAL_CYCLES,
            expected_total_requests: TOTAL_ITERATIONS,

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

        response_time_ms: {

            average: duration.avg || 0,
            minimum: duration.min || 0,
            median: duration.med || 0,
            maximum: duration.max || 0,
            p90: duration["p(90)"] || 0,
            p95: duration["p(95)"] || 0,
            p99: duration["p(99)"] || 0,

        },

        threshold_validation: {

            p90: duration["p(90)"] < 1000,
            p95: duration["p(95)"] < 1000,
            p99: duration["p(99)"] < 1000,
            failed_rate: failedRate < 0.01,
            checks: checkRate > 0.99,
            gateway_504: gateway504Errors === 0,
            client_timeouts: clientTimeouts === 0,

        },

    };

    console.log("\n========== FINAL LOAD TEST REPORT ==========\n");

    console.log(
        JSON.stringify(report, null, 4)
    );

    console.log("\n============================================\n");

    return {

        "final_report.json": JSON.stringify(report, null, 4),

    };
}
