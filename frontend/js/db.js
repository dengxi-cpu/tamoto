// IndexedDB 存储工具 - 用于存储头像等大体积数据
// 相比 localStorage（5-10MB 限制），IndexedDB 拥有大得多的存储空间

const AVATAR_DB_NAME = 'OCAvatarDB';
const AVATAR_STORE_NAME = 'avatars';
const DB_VERSION = 1;

let _db = null;

function openAvatarDB() {
    return new Promise((resolve, reject) => {
        if (_db) return resolve(_db);

        const request = indexedDB.open(AVATAR_DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
                db.createObjectStore(AVATAR_STORE_NAME);
            }
        };

        request.onsuccess = function (e) {
            _db = e.target.result;
            resolve(_db);
        };

        request.onerror = function (e) {
            console.error('IndexedDB 打开失败:', e);
            reject(e);
        };
    });
}

function saveAvatarData(key, dataUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openAvatarDB();
            const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
            tx.objectStore(AVATAR_STORE_NAME).put(dataUrl, key);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        } catch (e) {
            console.warn('IndexedDB 写入失败，回退到 localStorage:', e);
            reject(e);
        }
    });
}

function getAvatarData(key) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openAvatarDB();
            const tx = db.transaction(AVATAR_STORE_NAME, 'readonly');
            const request = tx.objectStore(AVATAR_STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        } catch (e) {
            console.warn('IndexedDB 读取失败:', e);
            reject(e);
        }
    });
}

function deleteAvatarData(key) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openAvatarDB();
            const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
            tx.objectStore(AVATAR_STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        } catch (e) {
            console.warn('IndexedDB 删除失败:', e);
            reject(e);
        }
    });
}
