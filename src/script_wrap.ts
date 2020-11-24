// PRE

const KEY = 'rpars.notification';
const SLEEP = 'rpars.sleep';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday() {
  return new Date(Date.now() - 24*60*60*1000).toISOString().slice(0, 10);
}

function getSleepSummary(date) {
  const sleep_summary = JSON.parse(localStorage.getItem(SLEEP) || '{}');
  return sleep_summary[date];
}

function showMessage(key, title, subtitle, content, expire) {
  _show(key, title, subtitle, content, expire, 'message', undefined);
}

function showQuestion(key, title, subtitle, content, options, expire) {
  _show(key, title, subtitle, content, expire, 'question', options);
}

function _show(key, title, subtitle, content, expire, type, options) {
  const now = Date.now();
  const notifications = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const date of Object.keys(notifications)) {
    for (const k of Object.keys(notifications[date])) {
      if (notifications[date][k]['expire'] < now) {
        delete notifications[date][k];
      }
    }
  }
  const date = getToday();
  if (typeof notifications[date] === 'undefined') {
    console.log('is empty');
    notifications[date] = {};
  }
  notifications[date][key] = {
    'title': title,
    'subtitle': subtitle,
    'content': content,
    'time': now,
    'expire': now + expire * 1000,
    'type': type,
    'options': options,
    'status': 'unread'
  };
  localStorage.setItem(KEY, JSON.stringify(notifications));
}

//<--BODY-->//

// POST
