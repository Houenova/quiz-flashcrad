/**
 * Chờ cho toàn bộ cấu trúc HTML (DOM) được tải xong
 * trước khi bắt đầu chạy logic chính của ứng dụng.
 */
const API_BASE_URL = 'http://127.0.0.1:5000/api';
document.addEventListener('DOMContentLoaded', () => {
    // Gọi hàm khởi tạo chính từ lớp App (app.js)
    // Giả sử bạn có một đối tượng App hoặc hàm initializeApp toàn cục trong app.js
    if (typeof initializeApp === 'function') {
        initializeApp(); // Gọi hàm khởi tạo chính nằm trong app.js
    } else {
        console.error("Lỗi: Hàm initializeApp không được tìm thấy. Đảm bảo app.js đã được tải đúng cách.");
        alert("Không thể khởi động ứng dụng. Vui lòng kiểm tra console.");
    }
});