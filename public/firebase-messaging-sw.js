importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7EBZmmkdOqePROf0UoJNfrNwbaRwpFdY',
  authDomain: 'nextbench-a11ed.firebaseapp.com',
  projectId: 'nextbench-a11ed',
  messagingSenderId: '14134258818',
  appId: '1:14134258818:web:74ce98ecdef47ab383589b'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Nextbench Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: '/logo.png',
    data: { link: payload.data?.link || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — navigate to the link from the notification data
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';
  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a matching window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
