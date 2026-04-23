// db.js — IndexedDB wrapper for LoreChat

const DB_NAME = 'lorechat';
const DB_VERSION = 1;
const STORES = ['bots', 'chats', 'adventures', 'stories', 'settings'];

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = async (e) => {
      _db = e.target.result;
      resolve(_db);
      // Seed the "You" bot if it doesn't exist yet
      const tx = _db.transaction('bots', 'readonly');
      const req2 = tx.objectStore('bots').get('you-bot');
      req2.onsuccess = () => {
        if (!req2.result) {
          const tx2 = _db.transaction('bots', 'readwrite');
          tx2.objectStore('bots').put({
            id: 'you-bot',
            name: 'You',
            persona: '',
            color: '#5865f2',
            emoji: '🧑',
            isYou: true,
            createdAt: Date.now()
          });
        }
      };
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOne(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putOne(store, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteOne(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Export all data to JSON
async function exportAllData() {
  const data = {};
  for (const store of STORES) {
    data[store] = await getAll(store);
  }
  return data;
}

// Import all data from JSON
async function importAllData(data) {
  for (const store of STORES) {
    if (data[store]) {
      await clearStore(store);
      for (const item of data[store]) {
        await putOne(store, item);
      }
    }
  }
}

const DB = { getAll, getOne, putOne, deleteOne, clearStore, generateId, exportAllData, importAllData };