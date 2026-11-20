import http from 'k6/http';
import { check, group } from 'k6';
import { sleep } from 'k6';

const BASE_URL ='https://staging.codegnan.com/wp-admin/admin-ajax.php';

const REQUESTS_PER_PAGE = 1;


const CONTACT = {
  name: 'jitendra',
  email: 'jitendra@codegnan.com',
  mobile: '+919798967570',
  mobileWithoutCode: '9798967570',
};

// data from raw.json
const PAGES = [
  { name: 'Vijayawada Python Full Stack', post_id: '7373', form_id: '6a2c038', referer_title: 'python-training-in-vijayawada/ course_1', queried_id: '7373', message: 'I am interested in Python Full Stack training' },
  { name: 'Hyderabad Python', post_id: '12194', form_id: '64ddb9e8', referer_title: 'python-training-course-in-hyderabad/ course_2', queried_id: '12194', message: 'I am interested in Python training' },
  { name: 'Vijayawada Java Full Stack', post_id: '8517', form_id: '01f3567', referer_title: 'full-stack-java-training-course-in-vijayawada/ and form_fields[field_c22fe1e] 1.', queried_id: '8517', message: 'I am interested in full stack java training course..' },
  { name: 'Vizag Java Full Stack', post_id: '27399', form_id: '517cbeb2', referer_title: 'java-full-stack-course-in-visakhapatnam/ 2.', queried_id: '27399', message: 'I am interested in full stack java training course..' },
  { name: 'Vijayawada Python Full Stack Developer Course', post_id: '10141', form_id: '7e654985', referer_title: '#1 Python Full Stack Developer Course Training in Vijayawada 4', queried_id: '10141', message: 'I am interested in full stack java training course..' },
//   { name: 'Hyderabad Python Full Stack', post_id: '7665', form_id: '4dff6924', referer_title: 'python-full-stack-developer-course-in-hyderabad/ 6', queried_id: '7665', message: "I'm interesed in the PFS in hyd" },
//   { name: 'Hyderabad Java Full Stack', post_id: '8777', form_id: '72064ada', referer_title: 'full-stack-java-training-course-in-hyderabad/ 3', queried_id: '8777', message: "I'm interesed in the JFS course" },
//   { name: 'Vizag Python Full Stack', post_id: '27387', form_id: '3a196372', referer_title: 'python-full-stack-course-in-visakhapatnam/ 5', queried_id: '27387', message: "I'm interesed in the PFS course" },
//   { name: 'Vijayawada Data Analytics', post_id: '23140', form_id: '60414d1a', referer_title: 'data-analytics-course-in-vijayawada/ 7', queried_id: '23140', message: "I'm interesed in data analyst" },
//   { name: 'Vizag Data Analytics', post_id: '28290', form_id: '60414d1a', referer_title: 'data-analytics-course-in-visakhapatnam/ 8 (form_fields[field_c22fe1e])', queried_id: '28290', message: "I'm interesed in data analyst" },
//   { name: 'Hyderabad Data Analytics', post_id: '28275', form_id: '60414d1a', referer_title: 'data-analytics-course-in-hyderabad/ 9 (form_fields[field_c22fe1e])', queried_id: '28275', message: "I'm interesed in data analyst" },
//   { name: 'Hyderabad Data Science', post_id: '49956', form_id: '197daf9', referer_title: 'data-analytics-course-in-hyderabad/ 11 ', queried_id: '49956', message: "I'm interesed in data science" },
//   { name: 'Vijayawada Data Science with Agentic AI', post_id: '49307', form_id: '197daf9', referer_title: 'data-science-with-agentic-ai-course-in-vijayawada/ 10', queried_id: '49307', message: "I'm interesed in data science" },
//   { name: 'Vizag Data Science with Agentic AI', post_id: '49309', form_id: '60b9c019', referer_title: 'data-science-with-agentic-ai-course-in-visakhapatnam/ 12', queried_id: '49309', message: "I'm interesed in data science" },
//   { name: 'Career Restart Full Stack', post_id: '52265', form_id: '797adae6', referer_title: 'career-restart-full-stack-software-engineering-program/ 13', queried_id: '52265', message: 'Full Stack software engineering program' },
];


const TOTAL_REQUESTS = PAGES.length * REQUESTS_PER_PAGE;

export const options = {
  scenarios: {
    all_pages_sequential: {
      executor: 'shared-iterations',
      vus: 1,                  
      iterations: TOTAL_REQUESTS,
      maxDuration: '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  // First REQUESTS_PER_PAGE iterations go to page 1, the next block to page 2, and so on
  const page = PAGES[Math.floor(__ITER / REQUESTS_PER_PAGE)];

  const payload = {
    action: 'elementor_pro_forms_send_form',
    post_id: page.post_id,
    form_id: page.form_id,
    referer_title: page.referer_title,
    queried_id: page.queried_id,
    change_name_mobile: CONTACT.mobileWithoutCode,
    'form_fields[name]': CONTACT.name,
    'form_fields[email]': CONTACT.email,
    'form_fields[phoneNumber]': CONTACT.mobile,
    'form_fields[message]': page.message,
  };

  group(page.name, function () {
    const res = http.post(BASE_URL, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      tags: { name: 'elementor_form_submit', page: page.name },
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'submission successful': (r) => /"success"\s*:\s*true/.test(r.body),
      'redirects to thank-you': (r) => /thank-you/.test(r.body),
    });
  });
  sleep(1)
}