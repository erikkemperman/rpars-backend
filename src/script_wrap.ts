// PRE

const NOTIFICATION = 'rpars.notification';

function getToday() {
  return getDay(Date.now());
}

function getYesterday() {
  return getDay(Date.now() - 24 * 60 * 60 * 1000);
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
  return getSummary(date, 'sleep');
}

function getActivitySummary(date) {
  return getSummary(date, 'activity');
}

function getReadinessSummary(date) {
  return getSummary(date, 'readiness');
}

function getSummary(date, type) {
  const summary = JSON.parse(localStorage.getItem('rpars.' + type) || 'null');
  console.log(type + ' summary', date, summary[date]);
  return summary[date] || undefined;
}

function showMessage(date, key, title, subtitle, content, expire) {
  _show(date, key, title, subtitle, content, expire, 'message', undefined);
}

function showQuestion(date, key, title, subtitle, content, options, expire) {
  _show(date, key, title, subtitle, content, expire, 'question', options);
}

function _show(date, key, title, subtitle, content, expire, type, options) {
  if (key.length > 92) {
    key = key.substr(0, 92);
    console.warn(`Notice: max key length is 92, truncating to '${key}'`);
  }
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
