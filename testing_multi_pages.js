import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = "https://staging.codegnan.com";

const MODE = "rotate"; 

const PAGES = [

  { name: "jfs_hyd", path: "/full-stack-java-training-course-in-hyderabad/" },
  { name: "pfs_vij", path: "/python-full-stack-training-course-in-vijayawada/"},
  { name: "pfs_viz", path: "/python-full-stack-course-in-visakhapatnam/" },
  { name: 'pfs_dev_hyd', path: '/python-full-stack-developer-course-in-hyderabad/' },
  { name: 'data_anl_vij', path: '/data-analytics-course-in-vijayawada/' },

];

const successRequests = new Counter("success_requests");
const failedRequests = new Counter("failed_requests");

const thresholds = {
  http_req_failed: ["rate<0.01"], // less than 1% failed requests
  http_req_duration: ["p(95)<1000", "p(99)<1000"], // 95% and 99% of requests faster than 1 second
};

for (const page of PAGES) {
  thresholds[`http_req_duration{page:${page.name}}`] = ["p(95)<1000","p(99)<1000"];
  thresholds[`http_req_failed{page:${page.name}}`] = ["rate<0.01"];


}

export const options = {
  // stages: [
  //   { duration: '2m', target: 10 },  
  //   { duration: '10m', target: 10 }, 
  //   { duration: '1m', target: 0 },   
  // ],

  // stages: [
  // { duration: "2m",  target: 10 },  // ramp up
  // { duration: "40m", target: 10 },  // hold at peak
  // { duration: "1m",  target: 0 },   // ramp down
  // ],
    stages: [
    { duration: "3m",  target: 30 },  // ramp up
    { duration: "11m", target: 30 },  // hold at peak
    { duration: "1m",  target: 0 },   // ramp down
    ],

  thresholds: thresholds,
   summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// export const options = {
//   vus: 2,
//   duration: "5m",
//   thresholds: thresholds,
//   summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
// };



function choosePage() {
if (MODE === "rotate") {
    return PAGES[(__VU - 1 + __ITER) % PAGES.length];
  }
  if (MODE === "random") {
    return PAGES[Math.floor(Math.random() * PAGES.length)];
  }
  return PAGES[(__VU - 1) % PAGES.length];
}

export default function () {
  const page = choosePage();


  const res = http.get(`${BASE_URL}${page.path}`, {
    tags: { page: page.name },
    timeout: "30s",
  });
  const ms = Math.round(res.timings.duration);

  // Only check for 200 OK
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
  });

  // Count success or failure, and print the status of EVERY request
  if (ok) {
    successRequests.add(1, { page: page.name });

    console.log(
      `[PASS] VU ${__VU} | ${page.name} | GET ${page.path} | status ${res.status} | ${ms} ms`,
    );
  } else {
    failedRequests.add(1, { page: page.name });

    console.error(
      `[FAIL] VU ${__VU} | ${page.name} | GET ${page.path} | status ${res.status} | ${ms} ms | error: ${res.error || "none"}`,
    );
  }

  sleep(1);
}



