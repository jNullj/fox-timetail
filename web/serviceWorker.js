const cacheName = 'FoxTimeTail-0.2.0'
const filesToCache = [
    '/',
    '/js/home.js',
    '/css/home.css',
    '/icons/main.svg',
    '/icons/history.svg',
    '/icons/settings.svg',
    '/home.html',
    '/modal.mjs',
    '/historyModal.mjs',
]
const callsToSync = [
    '/api/enter',
    '/api/exit',
]

// The install event is triggered when the service worker is first installed.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(cacheName)
        .then(cache => cache.addAll(filesToCache))
    )
})

const deleteCache = async (key) => {
    await caches.delete(key)
}
  
const deleteOldCaches = async () => {
    const cacheKeepList = [
        cacheName,
    ]
    const keyList = await caches.keys()
    const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key))
    await Promise.all(cachesToDelete.map(deleteCache))
}
  
self.addEventListener("activate", (event) => {
    event.waitUntil(deleteOldCaches())
})

// The fetch event is triggered whenever a resource is requested.
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => {
            const url = new URL(event.request.url)
            if (callsToSync.includes(url.pathname)) {
                // Open a transaction to the database
                let dbReq = indexedDB.open('apiPendingRequests', 1)

                dbReq.onsuccess = function(event) {
                    let db = event.target.result
                    let tx = db.transaction('apiPendingRequestsStore', 'readwrite')
                    let store = tx.objectStore('apiPendingRequestsStore')
                    let req = store.add({path: url.pathname, time: new Date()})
                    req.onsuccess = function() {
                        self.registration.sync.register('syncPendingApiRequests')
                    }
                };

                dbReq.onupgradeneeded = function(event) {
                    let db = event.target.result
                    db.createObjectStore('apiPendingRequestsStore', { autoIncrement: true })
                };

                dbReq.onerror = function(event) {
                    console.log('error opening database ' + event.target.errorCode);
                };
            }
        })
    )
})

// The sync event is triggered whenever the service worker is able to sync.
self.addEventListener('sync', event => {
    if (event.tag === 'syncPendingApiRequests') {
        let dbReq = indexedDB.open('apiPendingRequests', 1)

        dbReq.onsuccess = function(event) {
            let db = event.target.result
            let tx = db.transaction('apiPendingRequestsStore', 'readwrite')
            let store = tx.objectStore('apiPendingRequestsStore')
            let req = store.openCursor()
            req.onsuccess = async function() {
                const curser = req.result
                if (!curser) { return }
                const key = curser.key
                const pendingRequest = curser.value
                fetch(pendingRequest.path, { method: 'POST', body: JSON.stringify({ time: pendingRequest.time }), headers: { 'Content-Type': 'application/json' }})
                .then(res => {
                    if (res.ok) {
                        db.transaction('apiPendingRequestsStore', 'readwrite')
                        .objectStore('apiPendingRequestsStore')
                        .delete(key)
                    }
                })
                curser.continue()
            }
        }

        dbReq.onupgradeneeded = function(event) {
            let db = event.target.result
            db.createObjectStore('apiPendingRequestsStore', { autoIncrement: true })
        }

        dbReq.onerror = function(event) {
            console.log('error opening database ' + event.target.errorCode)
        }
    }
})