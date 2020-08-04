const DB_NAME = 'CSplan'
const DB_VER = 1
let db

/**
 * @returns {Promise<IDBDatabase>}
 */
function getDB () {
  return new Promise((resolve, reject) => {
    if (db instanceof IDBDatabase) {
      resolve(db)
    }

    const req = indexedDB.open(DB_NAME, DB_VER)

    req.addEventListener('upgradeneeded', () => {
      db = req.result
      // Keys store is indexed by id
      db.createObjectStore('keys', { keyPath: 'id' })
      resolve(db)
    })

    req.addEventListener('error', () => {
      reject(req.error)
    })

    req.addEventListener('success', () => {
      db = req.result
      resolve(req.result)
    })
  })
}

function clearStore (storeName) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName)
    const req = store.clear()

    req.addEventListener('error', () => {
      reject(req.error)
    })

    req.addEventListener('success', () => {
      resolve(req.result)
    })
  })
}

export {
  getDB,
  clearStore
}
