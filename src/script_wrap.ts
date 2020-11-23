// PRE

const KEY = 'rpars.notification'

function getDate() {
  return new Date().toISOString().slice(0, 10);
}

function showMessage(key, title, subtitle, content, expire) {
  _show(key, title, subtitle, content, expire, 'message', undefined);
}

function _show(key, title, subtitle, content, expire, type, options) {
  const now = Date.now();
  const notifications = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const date in Object.keys(notifications)) {
    for (const key in Object.keys(notifications[date])) {
      const items = [];
      for (const item in notifications[date][key]) {
        if (item['expire'] >= now) {
          items.push(item);
        }
      }
      notifications[date][key] = items;
    }
  }
  const date = getDate();
  if (typeof notifications[date] === 'undefined') {
    notifications[date] = {};
  }
  if (typeof notifications[date][key] === 'undefined') {
    notifications[date][key] = [];
  }
  notifications[date][key].push({
    'title': title,
    'subtitle': subtitle,
    'content': content,
    'expire': now + expire,
    'type': type,
    'options': options,
    'status': 'unread'
  });
  localStorage.setItem(key, notifications);
}

//<--BODY-->//

// POST
