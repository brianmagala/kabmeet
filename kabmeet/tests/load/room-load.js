import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 25 },
    { duration: '30s', target: 75 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.KABMEET_BASE_URL || 'http://localhost:3000';

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const sessions = http.get(`${BASE_URL}/api/sessions`);
  check(sessions, { 'sessions 200': (r) => r.status === 200 });

  sleep(1);
}
