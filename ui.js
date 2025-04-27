        let groups = [];
        let currentGroupId = 'default';
        let quizMode = false;
        let quizCheckButton = null; // Tham chiếu đến nút Kiểm tra/Tiếp theo/Thử lại
        let quizPauseButton = null; // Tham chiếu đến nút Tạm dừng
        let quizAnswerInput = null; // Tham chiếu đến ô nhập câu trả lời quiz
        let quizFeedback = null;    // Tham chiếu đến phần phản hồi
        let quizScoreDisplay = null; // Tham chiếu đến hiển thị điểm
        let quizQuestionDisplay = null; // Tham chiếu đến hiển thị câu hỏi
        let groupManagementView = null;
        let hierarchyView = document.getElementById('hierarchy-view'); // <-- THÊM DÒNG NÀY
        let flashcardView = document.getElementById('flashcard-view');
        let mindmapView = document.getElementById('mindmap-view');
        let flashcardViewTitle = document.getElementById('flashcard-view-title');
        let backToGroupsButton = document.getElementById('back-to-groups-btn'); // Ví dụ
        let mindmapViewTitle = document.getElementById('mindmap-view-title');
        let mindmapMarkdownInput = document.getElementById('mindmap-markdown-input');
        let mindmapSvgElement = document.getElementById('mindmap-svg');
        let backToFlashcardsButton = document.getElementById('back-to-flashcards-btn');
        let saveMindmapButton = document.getElementById('save-mindmap-btn');
        let currentMindmapInstance = null;

        // Hàm chuyển đổi giao diện
        function toggleTheme() {
            const isDark = document.getElementById('theme-switch').checked;
            if (isDark) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        }

        function applyInitialTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
                // Cập nhật trạng thái của checkbox nếu cần
                const themeSwitch = document.getElementById('theme-switch');
                if (themeSwitch) themeSwitch.checked = true;
            }
            // Không cần render lại mindmap ở đây vì nó sẽ được render khi người dùng mở view
        }
        applyInitialTheme();

        function initGroups() {
            const select = document.getElementById('group-select');
            if (!select) return; // Thêm kiểm tra tồn tại
            select.innerHTML = ''; // Xóa các option cũ
        
            const fragment = document.createDocumentFragment(); // Tạo fragment
        
            const topLevelFolders = groups.filter(g => !g.parentId && g.cards === undefined);
            const topLevelGroups = groups.filter(g => !g.parentId && Array.isArray(g.cards));
        
            topLevelFolders.forEach(folder => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = folder.name;
                optgroup.dataset.id = folder.id;
        
                const childGroups = groups.filter(g => g.parentId === folder.id);
                if (childGroups.length > 0) {
                    childGroups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = `${group.name} (${group.cards.length} thẻ)`;
                        // option.selected = group.id === currentGroupId; // Sẽ đặt selected sau khi thêm vào select
                        optgroup.appendChild(option);
                    });
                } else {
                    const placeholderOption = document.createElement('option');
                    placeholderOption.disabled = true;
                    placeholderOption.textContent = "(Thư mục trống)";
                    optgroup.appendChild(placeholderOption);
                }
                fragment.appendChild(optgroup); // Thêm optgroup vào fragment
            });
        
            if (topLevelGroups.length > 0) {
                const independentOptgroup = document.createElement('optgroup');
                independentOptgroup.label = "--- Nhóm Độc Lập ---";
                topLevelGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = `${group.name} (${group.cards.length} thẻ)`;
                    // option.selected = group.id === currentGroupId;
                    independentOptgroup.appendChild(option);
                });
                fragment.appendChild(independentOptgroup); // Thêm optgroup vào fragment
            }
        
            select.appendChild(fragment); // Chỉ một lần append vào DOM
        
            // Xử lý selected sau khi đã thêm tất cả options
            if (!currentGroupId && groups.length > 0) {
                const firstSelectableGroup = groups.find(g => Array.isArray(g.cards));
                if (firstSelectableGroup) {
                    currentGroupId = firstSelectableGroup.id;
                } else {
                    currentGroupId = null;
                }
            }
        
            if (currentGroupId) {
                select.value = currentGroupId; // Đặt giá trị cho select sẽ tự động chọn option đúng
            } else {
                 select.selectedIndex = -1; // Không chọn gì nếu không có currentGroupId
            }
        
            // Gọi các hàm cập nhật khác
            populateParentFolderSelect();
            checkPausedQuiz();
            updateUIForSelectedItem();
            populateMoveTargetSelect();
        }

        // Hàm tô màu sự khác biệt
        function highlightDiff(wrong, correct) {
            const wrongWords = wrong.trim().split(/\s+/);
            const correctWords = correct.trim().split(/\s+/);
            let result = [];

            const maxLength = Math.max(wrongWords.length, correctWords.length);
            for (let i = 0; i < maxLength; i++) {
                const wrongWord = wrongWords[i] || '';
                const correctWord = correctWords[i] || '';
                if (wrongWord.toLowerCase() === correctWord.toLowerCase()) { // So sánh không phân biệt hoa thường
                    result.push(correctWord);
                } else {
                    // Hiển thị từ đúng màu đỏ, từ sai gạch ngang 
                     result.push(`<span style="color: red; font-weight: bold;">${correctWord || '[thiếu]'}</span>` + (wrongWord ? ` <s style="color: grey;">${wrongWord}</s>` : ''));
                }
            }
            return result.join(' ');
        }

        // Hàm điền các thư mục vào dropdown chọn thư mục cha
        function populateParentFolderSelect() {
            const parentSelect = document.getElementById('parent-folder-select');
            if (!parentSelect) return;
            parentSelect.innerHTML = '<option value="">-- Chọn thư mục cha --</option>'; // Reset

            const fragment = document.createDocumentFragment(); // Tạo fragment
            const folders = groups.filter(g => !g.parentId && g.cards === undefined);

            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.name;
                fragment.appendChild(option); // Thêm vào fragment
            });

            parentSelect.appendChild(fragment); // Chỉ một lần append
        }

        // Thêm listener để hiện/ẩn dropdown chọn thư mục cha
        document.getElementById('new-item-type').addEventListener('change', function() {
            const parentSelect = document.getElementById('parent-folder-select');
            if (this.value === 'group') {
                populateParentFolderSelect(); // Hàm này cần tạo để điền các thư mục vào dropdown
                parentSelect.style.display = 'inline-block'; // Hoặc 'block' tùy layout
            } else {
                parentSelect.style.display = 'none';
            }
        });

        function populateMoveTargetSelect() {
            const moveSelect = document.getElementById('move-target-folder-select');
            const currentItem = groups.find(g => g.id === currentGroupId);
            const moveButton = document.getElementById('move-item-btn');

            if (!moveSelect || !moveButton) {
                console.error("Không tìm thấy phần tử moveSelect hoặc moveButton.");
                return;
            }

            // Reset nội dung và tạo fragment
            moveSelect.innerHTML = `
                <option value="">-- Di chuyển đến thư mục --</option>
                <option value="root">-- Di chuyển ra ngoài (Thành mục độc lập) --</option>
            `;
            const fragment = document.createDocumentFragment();

            // Xử lý disable ban đầu
            const disableControls = !currentItem;
            moveSelect.disabled = disableControls;
            moveButton.disabled = disableControls;
            if (disableControls) return; // Dừng nếu không có mục nào được chọn

            // Lọc và thêm các thư mục đích vào fragment
            const potentialTargets = groups.filter(g =>
                g.cards === undefined && g.id !== currentGroupId
            );

            potentialTargets.forEach(folder => {
                if (currentItem.parentId !== folder.id) { // Đã kiểm tra currentItem tồn tại ở trên
                    const option = document.createElement('option');
                    option.value = folder.id;
                    option.textContent = folder.name;
                    fragment.appendChild(option);
                }
            });

            moveSelect.appendChild(fragment); // Thêm các thư mục đích

            // Xử lý disable option "root"
            const rootOption = moveSelect.querySelector('option[value="root"]');
            if (rootOption) {
                rootOption.disabled = !currentItem.parentId; // Disable nếu không có parentId
            }
        }

        function renderCards() {
            const container = document.getElementById('flashcards');
            if (!container) {
                console.error("Không tìm thấy container #flashcards.");
                return;
            }
            container.innerHTML = ''; // Xóa nội dung cũ
            const currentGroup = groups.find(g => g.id === currentGroupId);
        
            // Kiểm tra và hiển thị thông báo nếu cần
            if (!flashcardView || flashcardView.classList.contains('hidden') || !currentGroup || !Array.isArray(currentGroup.cards)) {
                container.innerHTML = '<p style="text-align: center; margin-top: 20px;">Chọn một nhóm bài học từ danh sách để xem thẻ.</p>';
                // Ẩn các control không liên quan nếu đang không xem nhóm bài học
                const addCardSection = document.querySelector('.add-card');
                const quizControls = document.getElementById('quiz-controls');
                if(addCardSection) addCardSection.classList.add('hidden');
                if(quizControls) quizControls.classList.add('hidden');
                return;
            }
        
            // Hiện lại các control nếu đang xem nhóm bài học
            document.querySelector('.add-card')?.classList.remove('hidden'); // Optional chaining
            document.getElementById('quiz-controls')?.classList.remove('hidden');
        
            if (currentGroup.cards.length === 0) {
                container.innerHTML = "<p>Nhóm này chưa có thẻ nào. Hãy thêm thẻ!</p>";
                return; // Dừng nếu không có thẻ
            }
        
            const fragment = document.createDocumentFragment(); // Tạo fragment
        
            currentGroup.cards.forEach((card, index) => {
                const cardEl = document.createElement('div');
                cardEl.className = 'flashcard';
                // Lưu trữ index trực tiếp trên element để dễ truy xuất trong event delegation
                cardEl.dataset.cardIndex = index;
        
                // Sử dụng textContent cho phần tĩnh, innerHTML cho phần có input/button
                const questionDiv = document.createElement('div');
                questionDiv.innerHTML = `<strong>Q:</strong> <input type="text" class="card-input question-input" data-input-type="question" value="${escapeHtml(card.question)}">`; // Thêm class question-input
        
                const answerDiv = document.createElement('div');
                answerDiv.className = `answer-display ${card.showAnswer ? '' : 'hidden'}`;
                answerDiv.innerHTML = `<strong>A:</strong> <input type="text" class="card-input answer-input" data-input-type="answer" value="${escapeHtml(card.answer)}">`; // Thêm class answer-input
        
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-button';
                deleteButton.textContent = 'Xóa'; // Dùng textContent
        
                cardEl.appendChild(questionDiv);
                cardEl.appendChild(answerDiv);
                cardEl.appendChild(deleteButton);
        
                fragment.appendChild(cardEl); // Thêm vào fragment
            });
        
            container.appendChild(fragment); // Chỉ một lần append
        }
        
        // --- QUAN TRỌNG: Triển khai Event Delegation ---
        // Đoạn code này nên đặt ở hàm khởi tạo UI hoặc nơi nào đó chạy một lần
        const flashcardsContainer = document.getElementById('flashcards');
        if (flashcardsContainer) {
            flashcardsContainer.addEventListener('click', (event) => {
                const target = event.target;
                const cardElement = target.closest('.flashcard');
                if (!cardElement) return;
        
                const cardIndex = parseInt(cardElement.dataset.cardIndex, 10); // Lấy index từ data attribute
        
                // Xử lý nút xóa
                if (target.matches('.delete-button')) {
                    // Gọi hàm xóa thẻ (cần đảm bảo hàm deleteCard tồn tại và nhận index)
                    // Ví dụ: deleteCardAndUpdateUI(cardIndex);
                    console.log("Delete card index:", cardIndex); // Placeholder
                    return;
                }
        
                // Xử lý toggle hiển thị câu trả lời (chỉ khi click vào vùng trống)
                if (!target.matches('input, button')) {
                     const answerDiv = cardElement.querySelector('.answer-display');
                     if (answerDiv) {
                         answerDiv.classList.toggle('hidden');
                         // Có thể cần cập nhật trạng thái showAnswer trong mảng groups[...].cards[cardIndex]
                     }
                }
            });
        
            // Listener riêng cho sự kiện 'change' trên input
            flashcardsContainer.addEventListener('change', (event) => {
                const target = event.target;
                if (target.matches('.card-input')) { // Chỉ xử lý input trong thẻ
                    const cardElement = target.closest('.flashcard');
                    if (!cardElement) return;
                    const cardIndex = parseInt(cardElement.dataset.cardIndex, 10);
                    const inputType = target.dataset.inputType; // "question" hoặc "answer"
        
                    // Gọi hàm sửa thẻ (cần đảm bảo hàm editCard tồn tại)
                    // Ví dụ: editCardAndUpdateUI(cardIndex, inputType, target.value);
                    console.log(`Edit card index: ${cardIndex}, type: ${inputType}, value: ${target.value}`); // Placeholder
                }
            });
        }

        function showToastNotification(message, type = "info") {
            console.log(`[${type.toUpperCase()}] Notification: ${message}`);
        }

        // Hàm chống XSS cơ bản khi hiển thị value trong input
        function escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') return unsafe;
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }

        function updateUIForSelectedItem() {
            const selectedItem = groups.find(g => g.id === currentGroupId);

            if (selectedItem && Array.isArray(selectedItem.cards)) {
                // Đây là một nhóm bài học -> Hiển thị view flashcard
                showFlashcardView(selectedItem);
            } else {
                // Đây là một thư mục hoặc không chọn gì -> Hiển thị view quản lý
                showGroupManagementView();
                // Có thể thêm logic để hiển thị thông tin thư mục trong groupManagementView nếu muốn
                // Ví dụ: Hiển thị danh sách nhóm con của thư mục đã chọn
            }
            // Cập nhật dropdown di chuyển (vẫn cần thiết ở view quản lý)
            populateMoveTargetSelect();
        }
        
        function updateScoreDisplay() {
            quizScoreDisplay.textContent = `Đã thuộc: ${masteredCount}/${quizSessionCards.length}`;
        }

        function checkPausedQuiz() {
            const savedProgress = JSON.parse(localStorage.getItem('quizProgress') || 'null');
            const resumeButtonContainer = document.getElementById('quiz-controls');
            let resumeButton = document.getElementById('resume-quiz-btn');

            // Xóa nút Resume cũ nếu có
            if (resumeButton) {
                resumeButton.remove();
            }

            if (savedProgress && savedProgress.groupId === currentGroupId) {
                // Tìm tên nhóm đã lưu
                const groupName = groups.find(g => g.id === savedProgress.groupId)?.name || 'Nhóm đã lưu';
                const savedTime = new Date(savedProgress.timestamp).toLocaleString();

                // Tạo nút Resume mới
                resumeButton = document.createElement('button');
                resumeButton.id = 'resume-quiz-btn';
                resumeButton.className = 'resume-button';
                resumeButton.textContent = `Tiếp tục Quiz (${groupName} - ${savedProgress.mastered}/${savedProgress.cardIds.length} thuộc)`;
                resumeButton.title = `Lưu lúc: ${savedTime}`;
                resumeButton.onclick = resumeQuiz;

                // Thêm nút vào container (ví dụ: bên cạnh nút Start)
                resumeButtonContainer.appendChild(resumeButton);
                 document.getElementById('start-quiz-btn').textContent = "Bắt đầu Quiz Mới"; // Đổi text nút start
            } else {
                 // Nếu không có progress hoặc không khớp nhóm, đảm bảo nút Start là mặc định
                 document.getElementById('start-quiz-btn').textContent = "Bắt đầu Quiz";
            }
        }

        // Hàm helper để cập nhật trạng thái các nút quản lý
        function updateManagementControlsState() {
            const renameInput = document.getElementById('rename-item');
            const renameButton = document.querySelector('button[onclick="renameCurrentItem()"]');
            const deleteButton = document.querySelector('button[onclick="deleteCurrentItem()"]');
            const moveSelect = document.getElementById('move-target-folder-select');
            const moveButton = document.getElementById('move-item-btn');

            const currentItemExists = groups.some(g => g.id === currentGroupId);

            if (renameInput) renameInput.disabled = !currentItemExists;
            if (renameButton) renameButton.disabled = !currentItemExists;
            if (deleteButton) deleteButton.disabled = !currentItemExists;
            // populateMoveTargetSelect đã xử lý disable moveSelect/moveButton
        }

        // hiển thị view quản lý nhóm/thư mục
        function showGroupManagementView() {
            // Bây giờ hàm này sẽ hiển thị hierarchy-view
            const hierarchyView = document.getElementById('hierarchy-view');
            const flashcardView = document.getElementById('flashcard-view');
            const mindmapView = document.getElementById('mindmap-view');

            if (hierarchyView) hierarchyView.classList.remove('hidden');
            if (mindmapView) mindmapView.classList.add('hidden'); 
            if (flashcardView) flashcardView.classList.add('hidden');
            
            // Render lại cấu trúc cây mỗi khi quay lại view này để đảm bảo cập nhật
            renderHierarchyView();
        }

        function showFlashcardView(group) {
            if (!group || !Array.isArray(group.cards)) {
                console.error("Không thể hiển thị flashcard view: group không hợp lệ.");
                showGroupManagementView(); // Quay lại view chính nếu có lỗi
                return;
            }
            const hierarchyView = document.getElementById('hierarchy-view');
            const flashcardView = document.getElementById('flashcard-view');
            const mindmapView = document.getElementById('mindmap-view');
            const flashcardViewTitle = document.getElementById('flashcard-view-title');
        
            if (hierarchyView) hierarchyView.classList.add('hidden');
            if (mindmapView) mindmapView.classList.add('hidden');
            if (flashcardView) flashcardView.classList.remove('hidden');
            if (flashcardViewTitle) flashcardViewTitle.textContent = `Flashcards: ${escapeHtml(group.name)}`;
        
            // Các logic ẩn/hiện .add-card, #quiz-controls, #quiz-container bên trong flashcardView
            const addCardSection = flashcardView.querySelector('.add-card');
            const quizControls = flashcardView.querySelector('#quiz-controls');
            const flashcardsContainer = flashcardView.querySelector('#flashcards');
            const quizContainer = flashcardView.querySelector('#quiz-container');
        
            if (addCardSection) addCardSection.classList.remove('hidden');
            if (quizControls) quizControls.classList.remove('hidden');
            if (flashcardsContainer) flashcardsContainer.classList.remove('hidden');
            if (quizContainer) quizContainer.classList.add('hidden'); // Đảm bảo quiz ẩn khi mới vào view
           
            const controlsContainer = flashcardView.querySelector('#quiz-controls'); // Hoặc một vị trí phù hợp khác
            let openMindmapBtn = document.getElementById('open-mindmap-btn');
            if (!openMindmapBtn) {
                openMindmapBtn = document.createElement('button');
                openMindmapBtn.id = 'open-mindmap-btn';
                openMindmapBtn.textContent = ' Mở Mind Map';
                openMindmapBtn.style.marginLeft = '10px'; // Khoảng cách
                if (controlsContainer) {
                    controlsContainer.appendChild(openMindmapBtn); // Thêm vào cạnh nút Start Quiz
                } else {
                    // Hoặc thêm vào vị trí khác nếu #quiz-controls không phù hợp
                    flashcardView.insertBefore(openMindmapBtn, flashcardView.firstChild);
                }
            }
            // Gắn sự kiện (luôn cập nhật sự kiện để đảm bảo đúng group)
            openMindmapBtn.onclick = () => {
                showMindmapView(group); // Gọi hàm hiển thị view mind map
            }
            renderCards(); // Render thẻ cho nhóm này
            checkPausedQuiz(); // Kiểm tra quiz đang tạm dừng cho nhóm này
        }
        


        function renderHierarchyView() {
            const container = document.getElementById('hierarchy-container');
            if (!container) {
                console.error("Không tìm thấy #hierarchy-container.");
                return;
            }
            container.innerHTML = ''; // Xóa nội dung cũ
        
            const fragment = document.createDocumentFragment(); // Tạo fragment
        
            const topLevelFolders = groups.filter(g => !g.parentId && g.cards === undefined);
            const topLevelGroups = groups.filter(g => !g.parentId && Array.isArray(g.cards));
        
            // Render thư mục gốc và nhóm con
            topLevelFolders.forEach(folder => {
                const folderElement = document.createElement('div');
                folderElement.className = 'hierarchy-item folder-item'; // Class để xác định là thư mục
                folderElement.dataset.id = folder.id; // Lưu ID vào data attribute
                folderElement.innerHTML = `<span class="item-name folder-name">📁 ${escapeHtml(folder.name)}</span>`;
                fragment.appendChild(folderElement);
        
                const childGroups = groups.filter(g => g.parentId === folder.id);
                childGroups.forEach(group => {
                    const groupElement = document.createElement('div');
                    groupElement.className = 'hierarchy-item group-item child-group'; // Class để xác định là nhóm con
                    groupElement.dataset.id = group.id; // Lưu ID
                    groupElement.innerHTML = `<span class="item-name group-name">📄 ${escapeHtml(group.name)} (${group.cards.length} thẻ)</span>`;
                    fragment.appendChild(groupElement);
                });
            });
        
            // Render các nhóm độc lập
            if (topLevelGroups.length > 0) {
                const independentHeader = document.createElement('h4');
                independentHeader.textContent = "Nhóm Độc Lập";
                independentHeader.style.marginTop = "15px";
                fragment.appendChild(independentHeader);
        
                topLevelGroups.forEach(group => {
                    const groupElement = document.createElement('div');
                    groupElement.className = 'hierarchy-item group-item top-level-group'; // Class để xác định nhóm độc lập
                    groupElement.dataset.id = group.id; // Lưu ID
                    groupElement.innerHTML = `<span class="item-name group-name">📄 ${escapeHtml(group.name)} (${group.cards.length} thẻ)</span>`;
                    fragment.appendChild(groupElement);
                });
            }
        
            // Kiểm tra nếu không có gì để hiển thị
            if (fragment.childElementCount === 0) { // Kiểm tra fragment trước khi append
                 container.innerHTML = '<p>Chưa có thư mục hoặc nhóm nào. Hãy tạo mới!</p>';
            } else {
                 container.appendChild(fragment); // Chỉ một lần append
            }
        
            // Cập nhật các thành phần UI khác
            populateParentFolderSelect();
            populateMoveTargetSelect();
            updateManagementControlsState();
        }
        
        // --- QUAN TRỌNG: Triển khai Event Delegation ---
        // Đoạn code này nên đặt ở hàm khởi tạo UI hoặc nơi nào đó chạy một lần
        const hierarchyContainer = document.getElementById('hierarchy-container');
        if (hierarchyContainer) {
            hierarchyContainer.addEventListener('click', (event) => {
                const targetItem = event.target.closest('.hierarchy-item'); // Tìm phần tử cha gần nhất có class hierarchy-item
                if (!targetItem) return; // Click không vào item nào
        
                const itemId = targetItem.dataset.id; // Lấy ID từ data attribute
                const selectedItem = groups.find(g => g.id === itemId);
        
                if (!selectedItem) return; // Không tìm thấy item tương ứng
        
                currentGroupId = itemId; // Cập nhật ID hiện tại
        
                if (targetItem.classList.contains('group-item')) {
                    // Nếu click vào nhóm (con hoặc độc lập) -> hiển thị flashcard
                    showFlashcardView(selectedItem);
                } else if (targetItem.classList.contains('folder-item')) {
                    // Nếu click vào thư mục -> chỉ chọn thư mục (không chuyển view)
                    console.log("Selected folder:", itemId);
                    // Có thể thêm class 'selected' để highlight
                    // Cập nhật các nút quản lý và dropdown di chuyển
                    updateManagementControlsState();
                    populateMoveTargetSelect();
                     // Xóa highlight cũ (nếu có) và thêm highlight mới
                     document.querySelectorAll('#hierarchy-container .hierarchy-item.selected').forEach(el => el.classList.remove('selected'));
                     targetItem.classList.add('selected');
                }
            });
        }
        
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args); // Gọi hàm gốc với đúng ngữ cảnh và tham số
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Tạo phiên bản debounced của hàm render hiện có trong ui.js
        // Đặt dòng này ở scope phù hợp, có thể là global trong ui.js hoặc trong hàm khởi tạo UI
        const debouncedRenderMindmapPreview = debounce(renderCurrentMindmapPreview, 400);
        

        async function showMindmapView(group) {
            if (!group || !group.id) {
                console.error("Không thể hiển thị mindmap view: group không hợp lệ.");
                return;
            }
            console.log(`Showing mindmap view for group: ${group.name} (${group.id})`);

            // Ẩn các view khác
            if (hierarchyView) {
                hierarchyView.classList.add('hidden');
            } else {
                console.error("UI Error: Không tìm thấy phần tử #hierarchy-view!");
            }
            if (flashcardView) {
                flashcardView.classList.add('hidden');
            } else {
                console.error("UI Error: Không tìm thấy phần tử #flashcard-view!");
            }

            // Hiện view mindmap
            if (mindmapView) {
                mindmapView.classList.remove('hidden');
            } else {
                console.error("UI Error: Không tìm thấy phần tử #mindmap-view!");
                return;
            }

            // Cập nhật tiêu đề
            if (mindmapViewTitle) {
                mindmapViewTitle.textContent = `Mind Map: ${escapeHtml(group.name)}`;
            }

            // Xóa nội dung cũ và hủy instance cũ
            if (mindmapMarkdownInput) mindmapMarkdownInput.value = '';
            if (mindmapSvgElement) mindmapSvgElement.innerHTML = '';
            if (currentMindmapInstance) {
                try {
                    currentMindmapInstance.destroy();
                } catch (e) {
                    console.warn("Lỗi khi hủy instance Markmap cũ:", e);
                }
                currentMindmapInstance = null;
            }

            // Tải nội dung markdown từ DB
            try {
                const mindmapData = await getMindmapDB(group.id);
                let markdownContent = '';
                if (mindmapData && typeof mindmapData.markdown === 'string') {
                    markdownContent = mindmapData.markdown;
                } else {
                    markdownContent = `# ${escapeHtml(group.name)}\n\n- Nhánh chính 1\n  - Nhánh con 1.1\n- Nhánh chính 2`;
                    console.log("Chưa có mindmap hoặc dữ liệu không hợp lệ, tạo nội dung mặc định.");
                }

                if (mindmapMarkdownInput) {
                    mindmapMarkdownInput.value = markdownContent;

                    // --- BỔ SUNG TẠI ĐÂY ---
                    // Xóa listener cũ (nếu có) để tránh gắn nhiều lần
                    mindmapMarkdownInput.removeEventListener('input', debouncedRenderMindmapPreview);
                    // Gắn listener mới cho sự kiện input, gọi hàm render đã debounce
                    mindmapMarkdownInput.addEventListener('input', debouncedRenderMindmapPreview);
                    // --- KẾT THÚC BỔ SUNG ---
                }

                // Render mindmap ban đầu
                renderCurrentMindmapPreview();

            } catch (error) {
                console.error("Lỗi khi tải hoặc render mindmap:", error);
                if (mindmapMarkdownInput) {
                    mindmapMarkdownInput.value = `# Lỗi khi tải mindmap\n\n${error}`;
                }
                showToastNotification("Lỗi khi tải mindmap.", "error");
            }
        }

        // Hàm render preview mindmap
        function renderCurrentMindmapPreview() {
            const mindmapMarkdownInput = document.getElementById('mindmap-markdown-input');
            const mindmapSvgElement = document.getElementById('mindmap-svg'); // Đảm bảo ID này đúng với SVG trong HTML

            if (!mindmapMarkdownInput || !mindmapSvgElement) {
                console.error("Không tìm thấy phần tử input hoặc SVG cho mindmap.");
                return;
            }
            
            const markdown = mindmapMarkdownInput.value;
            if (!markdown.trim()) {
                mindmapSvgElement.innerHTML = '<p style="text-align: center; padding: 20px;">Nhập nội dung Markdown để xem trước.</p>';
                if (currentMindmapInstance) {
                    try { // Thêm try-catch để đảm bảo an toàn khi hủy
                       currentMindmapInstance.destroy();
                    } catch(e) {
                       console.warn("Lỗi khi hủy instance Markmap cũ:", e);
                    }
                    currentMindmapInstance = null;
                }
                return;
            }

            try {
                // Hủy instance cũ trước khi tạo mới
                if (currentMindmapInstance) {
                     try { // Thêm try-catch
                        currentMindmapInstance.destroy();
                     } catch(e) {
                        console.warn("Lỗi khi hủy instance Markmap cũ:", e);
                     }
                     currentMindmapInstance = null; // Đảm bảo gán null ngay cả khi destroy lỗi
                }

                // Kiểm tra xem thư viện markmap đã tải chưa
                if (typeof markmap === 'undefined' || typeof markmap.Transformer === 'undefined' || typeof markmap.Markmap === 'undefined') {
                    console.error("Lỗi: Thư viện Markmap (markmap, markmap.Transformer hoặc markmap.Markmap) chưa được tải đúng cách.");
                    mindmapSvgElement.innerHTML = `<p style="color: red; padding: 10px;">Lỗi: Thư viện Markmap chưa được tải đúng cách. Vui lòng kiểm tra file HTML.</p>`;
                    return; // Dừng thực thi nếu thư viện thiếu
                }

                // Sử dụng markmap.Transformer để biến đổi Markdown
                const { Transformer } = markmap; // Lấy Transformer từ đối tượng markmap
                const transformerInstance = new Transformer();
                const { root, features } = transformerInstance.transform(markdown); // Sử dụng transform

                // Sử dụng markmap.Markmap để render SVG
                currentMindmapInstance = new markmap.Markmap(mindmapSvgElement, undefined, { // Sử dụng markmap.Markmap
                    autoFit: true, // Tự động điều chỉnh kích thước
                    duration: 500, // Animation duration
                });
                
                currentMindmapInstance.setData(root); // Cập nhật dữ liệu cho mindmap

            } catch (error) {
                console.error("Lỗi khi render Markmap:", error);
                mindmapSvgElement.innerHTML = `<p style="color: red; padding: 10px;">Lỗi render Markmap: ${error.message}</p>`;
                if (currentMindmapInstance) {
                    try {
                       currentMindmapInstance.destroy();
                    } catch(e) {
                       console.warn("Lỗi khi hủy instance Markmap sau khi gặp lỗi render:", e);
                    }
                   currentMindmapInstance = null;
               }
            }
        }
