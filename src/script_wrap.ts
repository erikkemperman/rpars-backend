// PRE

const NOTIFICATION = 'rpars.notification';
const SLEEP = 'rpars.sleep';
const ACTIVITY = 'rpars.activity';
const READINESS = 'rpars.readiness';

function getToday() {
  return getDay(0);
}

function getYesterday() {
  return getDay(1);
}

function getDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatSeconds(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.round((seconds % 3600) / 60);
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  return hours + 'h' + (minutes < 10 ? '0' : '') + minutes + 'm';
}

function getSleepSummary(date) {
  const summary = JSON.parse(localStorage.getItem(SLEEP) || 'null');
  console.log('Sleep summary', date, summary[date]);
  return summary[date] || undefined;
}

function getActivitySummary(date) {
  const summary = JSON.parse(localStorage.getItem(ACTIVITY) || 'null');
  console.log('Activity summary', date, summary[date]);
  return summary[date] || undefined;
}

function getReadinessSummary(date) {
  const summary = JSON.parse(localStorage.getItem(READINESS) || 'null');
  console.log('Readiness summary', date, summary[date]);
  return summary[date] || undefined;
}

function showMessage(date, key, title, subtitle, content, expire) {
  _show(date, key, title, subtitle, content, expire, 'message', undefined);
}

function showQuestion(date, key, title, subtitle, content, options, expire) {
  _show(date, key, title, subtitle, content, expire, 'question', options);
}

function _show(date, key, title, subtitle, content, expire, type, options) {
  const now = Date.now();
  const notifications = JSON.parse(localStorage.getItem(NOTIFICATION) || '{}');
  for (const d of Object.keys(notifications)) {
    for (const k of Object.keys(notifications[d])) {
      if (notifications[d][k]['expire'] < now) {
        delete notifications[d][k];
        console.log('Remove expired notification ' + d + ' ' + k);
      }
    }
    if (Object.keys(notifications[d]).length === 0) {
      delete notifications[d];
    }
  }
  if (typeof notifications[date] === 'undefined') {
    notifications[date] = {};
  }
  let status = 'unread';
  if (typeof notifications[date][key] !== 'undefined') {
    status = notifications[date][key]['status']
  }
  notifications[date][key] = {
    'date': date,
    'key': key,
    'title': title,
    'subtitle': subtitle,
    'content': content,
    'time': now,
    'expire': expire,
    'type': type,
    'options': options,
    'status': status
  };
  localStorage.setItem(NOTIFICATION, JSON.stringify(notifications));
}

//<--BODY-->//

// POST
