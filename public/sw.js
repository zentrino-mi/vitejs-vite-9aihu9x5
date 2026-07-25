self.addEventListener('push', function(event) {
    const options = {
      body: event.data ? event.data.text() : 'Neue Info in der Band-App!',
      icon: '/icon.png',
      badge: '/icon.png'
    };
    event.waitUntil(
      self.registration.showNotification("Burnin' Bugs", options)
    );
  });