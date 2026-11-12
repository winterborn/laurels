import { Dashboard } from './Dashboard.js';

// Each page starts at the top, like a cut.
history.scrollRestoration = 'manual';

const page = document.getElementById('page');
const household = document.querySelector('.household');
const account = document.querySelector('.account');
const dashboard = new Dashboard(page, household, account);
await dashboard.start();
