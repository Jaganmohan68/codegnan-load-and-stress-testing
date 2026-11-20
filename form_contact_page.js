// form_load_test.js
import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

const BASE_URL = "https://staging.codegnan.com/wp-admin/admin-ajax.php";

const PAGE = {
  post_id: "25",
  form_id: "4058de9",
  referer_title: "Contact Us - Codegnan",
  queried_id: "25",
};
 

export const options = {
  scenarios: {
    one_page_load: {
      executor: "shared-iterations",
      vus: 1, // concurrent users
      iterations: 3, // total requests
      maxDuration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const payload = {
    action: "elementor_pro_forms_send_form",
    post_id: PAGE.post_id,
    form_id: PAGE.form_id,
    referer_title: PAGE.referer_title,
    queried_id: PAGE.queried_id,

    // Same values on every request
    "form_fields[name]": "jitendra",
    "form_fields[email]": "jitendra@codegnan.com",
    "form_fields[mobile]": "+919798967570",
    "form_fields[course]": "Python Full Stack",
    change_name_mobile: "+919798967570",
  };

  const res = http.post(BASE_URL, payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    tags: { name: "elementor_form_submit" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "submission successful": (r) => /"success"\s*:\s*true/.test(r.body),
    "redirects to thank-you": (r) => /thank-you/.test(r.body),
  });

  sleep(1);
}
