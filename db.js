const DB_NAME = 'FlashcardAppDB';
const DB_VERSION = 4; // Tăng version nếu thay đổi cấu trúc (thêm/xóa object store/index)
const GROUP_STORE_NAME = 'groups';
const MINDMAP_STORE_NAME = 'mindmaps'; // <-- Thêm tên store mới
let db; // Biến lưu trữ đối tượng database

// Mở (hoặc tạo) cơ sở dữ liệu
    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) { // Nếu đã mở, trả về ngay
                return resolve(db);
            }
            console.log(`Mở ${DB_NAME} version ${DB_VERSION}`);
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Lỗi khi mở IndexedDB:", event.target.error);
                reject("Lỗi khi mở DB");
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log("IndexedDB đã mở thành công.");
                resolve(db);
            };

        // Chỉ chạy khi tạo DB lần đầu hoặc nâng cấp version
        request.onupgradeneeded = (event) => {
            console.log("Chạy onupgradeneeded...");
            const tempDb = event.target.result;
            const oldVersion = event.oldVersion; // Lấy version cũ
            console.log(`Nâng cấp DB từ version ${oldVersion} lên ${DB_VERSION}`);

            // Tạo store 'groups' nếu chưa có
            if (!tempDb.objectStoreNames.contains(GROUP_STORE_NAME)) {
                console.log(`Tạo object store: ${GROUP_STORE_NAME}`);
                tempDb.createObjectStore(GROUP_STORE_NAME, { keyPath: 'id' });
            }

            // Tạo store 'mindmaps' nếu nâng cấp LÊN version 2 (hoặc cao hơn) và nó chưa tồn tại
            // Kiểm tra oldVersion < 2 là đúng đắn ở đây
            if (!tempDb.objectStoreNames.contains(MINDMAP_STORE_NAME)) {
                console.log(`Tạo object store: ${MINDMAP_STORE_NAME}`);
                // keyPath sẽ là groupId để liên kết mindmap với nhóm flashcard
                tempDb.createObjectStore(MINDMAP_STORE_NAME, { keyPath: 'groupId' });
            }
            };
        });
    }

    async function getAllGroupsDB() {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(GROUP_STORE_NAME, 'readonly');
            const store = transaction.objectStore(GROUP_STORE_NAME);
            const request = store.getAll(); // Lấy tất cả object

            request.onerror = (event) => {
                console.error("Lỗi khi lấy tất cả nhóm:", event.target.error);
                reject("Lỗi đọc dữ liệu nhóm");
            };

            request.onsuccess = (event) => {
                resolve(event.target.result || []); // Trả về mảng kết quả hoặc mảng rỗng
            };
        });
    }

    async function saveGroupDB(group) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(GROUP_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(GROUP_STORE_NAME);
            const request = store.put(group); // put sẽ thêm mới hoặc cập nhật nếu key đã tồn tại

            request.onerror = (event) => {
                console.error("Lỗi khi lưu nhóm:", event.target.error, 'Data:', group); // Thêm log data
                reject("Lỗi lưu dữ liệu nhóm");
            };

            request.onsuccess = (event) => {
                console.log('saveGroupDB thành công! Key:', event.target.result, 'Data:', group); // Thêm log data
                resolve(event.target.result);
            };
        });
    }

    async function deleteGroupDB(groupId) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(GROUP_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(GROUP_STORE_NAME);
            const request = store.delete(groupId);

            request.onerror = (event) => {
                console.error("Lỗi khi xóa nhóm:", event.target.error);
                reject("Lỗi xóa dữ liệu nhóm");
            };

            request.onsuccess = (event) => {
                console.log(`Đã xóa nhóm ID: ${groupId}`);
                resolve();
            };
        });
    }

// Lấy một nhóm cụ thể bằng ID (hữu ích cho việc cập nhật thẻ)
    async function getGroupByIdDB(groupId) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(GROUP_STORE_NAME, 'readonly');
            const store = transaction.objectStore(GROUP_STORE_NAME);
            const request = store.get(groupId);
        
            request.onerror = (event) => {
                console.error(`Lỗi khi lấy nhóm ID ${groupId}:`, event.target.error);
                reject("Lỗi đọc dữ liệu nhóm");
            };

            request.onsuccess = (event) => {
                resolve(event.target.result); // Trả về group object hoặc undefined nếu không tìm thấy
            };
        });
    }


    
    // --- Các hàm CRUD cho Mindmap ---

    async function getMindmapDB(groupId) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            // Kiểm tra store tồn tại trước khi tạo transaction
            if (!dbInstance.objectStoreNames.contains(MINDMAP_STORE_NAME)) {
                console.warn(`Object store ${MINDMAP_STORE_NAME} không tồn tại.`);
                return resolve(null); // Trả về null nếu store chưa được tạo
            }
            const transaction = dbInstance.transaction(MINDMAP_STORE_NAME, 'readonly');
            const store = transaction.objectStore(MINDMAP_STORE_NAME);
            const request = store.get(groupId); // Lấy mindmap bằng groupId

            request.onerror = (event) => {
                console.error(`Lỗi khi lấy mindmap cho group ${groupId}:`, event.target.error);
                reject("Lỗi đọc dữ liệu mindmap");
            };

            request.onsuccess = (event) => {
                // event.target.result có thể là object { groupId: '...', markdown: '...' } hoặc undefined
                resolve(event.target.result);
            };
        });
    }

    async function saveMindmapDB(groupId, markdownContent) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            if (!dbInstance.objectStoreNames.contains(MINDMAP_STORE_NAME)) {
                console.error(`Object store ${MINDMAP_STORE_NAME} không tồn tại. Không thể lưu.`);
                return reject(`Object store ${MINDMAP_STORE_NAME} không tồn tại.`);
            }
            const transaction = dbInstance.transaction(MINDMAP_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(MINDMAP_STORE_NAME);
            const mindmapData = { groupId: groupId, markdown: markdownContent };
            const request = store.put(mindmapData); // put sẽ thêm mới hoặc cập nhật

            request.onerror = (event) => {
                console.error("Lỗi khi lưu mindmap:", event.target.error, 'Data:', mindmapData);
                reject("Lỗi lưu dữ liệu mindmap");
            };

            request.onsuccess = (event) => {
                console.log('saveMindmapDB thành công! Key:', event.target.result);
                resolve(event.target.result);
            };
        });
    }

    async function deleteMindmapDB(groupId) {
        const dbInstance = await openDB();
        return new Promise((resolve, reject) => {
            if (!dbInstance.objectStoreNames.contains(MINDMAP_STORE_NAME)) {
                console.warn(`Object store ${MINDMAP_STORE_NAME} không tồn tại. Không cần xóa.`);
                return resolve(); // Coi như thành công nếu store không có
            }
            const transaction = dbInstance.transaction(MINDMAP_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(MINDMAP_STORE_NAME);
            const request = store.delete(groupId);

            request.onerror = (event) => {
                console.error("Lỗi khi xóa mindmap:", event.target.error);
                reject("Lỗi xóa dữ liệu mindmap");
            };

            request.onsuccess = (event) => {
                console.log(`Đã xóa mindmap cho group ID: ${groupId}`);
                resolve();
            };
        });
    }
