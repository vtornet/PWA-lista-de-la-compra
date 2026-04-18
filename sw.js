// ============================================
// SERVICE WORKER - LISTA DE LA COMPRA PWA
// ============================================

const CACHE_NAME = 'shopping-list-pwa-v4';
const STATIC_CACHE = 'static-v4';
const DYNAMIC_CACHE = 'dynamic-v4';

// Assets to cache immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS.map(asset => new Request(asset, { cache: 'no-cache' })));
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker install failed:', error);
            })
    );
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH EVENT - NETWORK FIRST STRATEGY
// ============================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external URLs (except images)
    if (url.origin !== self.location.origin) {
        // Cache images from external URLs
        if (request.destination === 'image') {
            event.respondWith(
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    return cache.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            // Update cache in background
                            fetch(request).then((networkResponse) => {
                                if (networkResponse && networkResponse.ok) {
                                    cache.put(request, networkResponse.clone());
                                }
                            }).catch(() => {});
                            return cachedResponse;
                        }
                        // Not in cache, fetch from network
                        return fetch(request).then((networkResponse) => {
                            if (networkResponse && networkResponse.ok) {
                                cache.put(request, networkResponse.clone());
                            }
                            return networkResponse;
                        }).catch(() => {
                            // Return a placeholder for failed image requests
                            return new Response('', {
                                status: 404,
                                statusText: 'Not Found'
                            });
                        });
                    });
                })
            );
        }
        return;
    }

    // Network-first strategy for HTML, JS, CSS
    if (request.destination === 'document' ||
        request.destination === 'script' ||
        request.destination === 'style') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Update cache
                    const responseClone = networkResponse.clone();
                    caches.open(STATIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-first strategy for other static assets
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return a custom offline page for HTML requests
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// ============================================
// MESSAGE EVENT
// ============================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

// ============================================
// BACKGROUND SYNC (for future use)
// ============================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-shopping-list') {
        event.waitUntil(
            // Sync logic here
            Promise.resolve()
        );
    }
});

// ============================================
// PUSH NOTIFICATIONS (for future use)
// ============================================

self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Tienes una actualización en tu lista',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: './'
        }
    };

    event.waitUntil(
        self.registration.showNotification('Lista de la Compra', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || './')
    );
});
