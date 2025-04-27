        async function initializeApp() {
            if (localStorage.getItem('theme') === 'dark') {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-switch').checked = true;
            } else {
                document.body.classList.remove('dark-mode');
            }

            quizCheckButton = document.getElementById('quiz-check-btn');
            quizPauseButton = document.getElementById('quiz-pause-btn');
            quizAnswerInput = document.getElementById('quiz-answer'); // Gán giá trị ở đây
            quizFeedback = document.getElementById('quiz-feedback');
            quizScoreDisplay = document.getElementById('quiz-score');
            quizQuestionDisplay = document.getElementById('quiz-question');
            const questionInput = document.getElementById('question'); // Lấy tham chiếu luôn ở đây
            const answerInput = document.getElementById('answer');     // Lấy tham chiếu luôn ở đây
            groupManagementView = document.getElementById('group-management-view');
            flashcardView = document.getElementById('flashcard-view');
            flashcardViewTitle = document.getElementById('flashcard-view-title');
            backToGroupsButton = document.getElementById('back-to-groups-btn'); // Lấy nút quay lại
            mindmapView = document.getElementById('mindmap-view');
            mindmapViewTitle = document.getElementById('mindmap-view-title');
            mindmapMarkdownInput = document.getElementById('mindmap-markdown-input');
            mindmapSvgElement = document.getElementById('mindmap-svg');
            backToFlashcardsButton = document.getElementById('back-to-flashcards-btn');
            saveMindmapButton = document.getElementById('save-mindmap-btn');
            renderMindmapButton = document.getElementById('render-mindmap-btn');
            console.log("Bắt đầu khởi tạo ứng dụng...");

            try {
                await openDB();
                // --- BƯỚC CHUYỂN ĐỔI (Migration) - Chỉ chạy một lần ---
                const migrationDone = localStorage.getItem('indexedDB_migration_complete');
                if (!migrationDone) {
                    console.log("Kiểm tra dữ liệu localStorage cũ để chuyển đổi...");
                    const oldLocalStorageData = localStorage.getItem('groups');
                    if (oldLocalStorageData) {
                        try {
                            const oldGroups = JSON.parse(oldLocalStorageData);
                            if (Array.isArray(oldGroups) && oldGroups.length > 0) {
                                console.log(`Tìm thấy ${oldGroups.length} nhóm cũ trong localStorage. Bắt đầu chuyển đổi...`);
                                // Kiểm tra xem DB có trống không trước khi ghi đè
                                const currentDBGroups = await getAllGroupsDB();
                                if (currentDBGroups.length === 0) {
                                    // Chỉ chuyển đổi nếu DB trống để tránh ghi đè dữ liệu mới hơn
                                    for (const group of oldGroups) {
                                        // Đảm bảo group có ID hợp lệ (localStorage cũ có thể không có)
                                        if (!group.id) {
                                            group.id = Date.now().toString() + Math.random().toString(36).substring(2, 9); // Tạo ID nếu thiếu
                                            console.warn(`Nhóm "${group.name}" thiếu ID, đã tạo ID mới: ${group.id}`);
                                        }
                                        // Đảm bảo cards là mảng
                                        if (!Array.isArray(group.cards)) {
                                            group.cards = [];
                                        }
                                        await saveGroupDB(group);
                                    }
                                    console.log("Chuyển đổi dữ liệu từ localStorage sang IndexedDB thành công!");
                                    // Đánh dấu đã hoàn thành chuyển đổi
                                    localStorage.setItem('indexedDB_migration_complete', 'true');
                                    // Không xóa localStorage ngay, để phòng trường hợp cần kiểm tra lại
                                    // localStorage.removeItem('groups');
                                } else {
                                    console.log("IndexedDB đã có dữ liệu, bỏ qua chuyển đổi từ localStorage.");
                                    localStorage.setItem('indexedDB_migration_complete', 'true'); // Đánh dấu đã kiểm tra
                                }
                            } else {
                                console.log("Không có dữ liệu hợp lệ trong localStorage cũ hoặc mảng rỗng.");
                                localStorage.setItem('indexedDB_migration_complete', 'true'); // Đánh dấu đã kiểm tra
                            }
                        } catch (parseError) {
                            console.error("Lỗi khi đọc hoặc chuyển đổi dữ liệu localStorage cũ:", parseError);
                            // Vẫn đánh dấu để không thử lại liên tục nếu dữ liệu lỗi
                            localStorage.setItem('indexedDB_migration_complete', 'true');
                        }
                    } else {
                        console.log("Không tìm thấy dữ liệu 'groups' trong localStorage cũ.");
                        localStorage.setItem('indexedDB_migration_complete', 'true'); // Đánh dấu đã kiểm tra
                    }
                }
                // --- KẾT THÚC BƯỚC CHUYỂN ĐỔI ---


                // Load dữ liệu nhóm từ IndexedDB (bây giờ có thể chứa dữ liệu đã chuyển đổi)
                groups = await getAllGroupsDB();
                console.log('>>> Dữ liệu nhóm được gán vào biến groups:', JSON.stringify(groups)); // Log quan trọng!

                if (groups.length === 0) {
                    console.log("Không có nhóm nào trong DB, tạo nhóm mặc định.");
                    const defaultGroup = { id: 'default', name: 'Mặc định', cards: [] };
                    await saveGroupDB(defaultGroup); // Lưu nhóm mặc định vào DB
                    groups.push(defaultGroup); // Thêm vào mảng hiện tại
                }

                if (backToGroupsButton) {
                    backToGroupsButton.addEventListener('click', () => {
                        // Có thể hỏi xác nhận nếu đang trong quiz
                        if (quizMode) {
                            if (!confirm("Bạn đang trong quiz. Quay lại sẽ hủy tiến trình quiz hiện tại. Bạn có chắc chắn?")) {
                                return;
                            }
                            forceEndQuiz(); // Kết thúc quiz nếu người dùng xác nhận quay lại
                        }
                        showGroupManagementView(); // Hiển thị lại view quản lý
                    });
                } else {
                    console.warn("Không tìm thấy nút #back-to-groups-btn");
                }

                initGroups();
                updateUIForSelectedItem();
                checkPausedQuiz()

                        // --- Event Listeners ---
                // Thêm thẻ khi nhấn Enter ở ô câu trả lời (phần thêm thẻ)
                document.getElementById('answer').addEventListener('keypress', function(e) {
                });

                answerInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        addCard();
                    }
                });

                // Xử lý Enter trong ô trả lời quiz
                quizAnswerInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault(); // Ngăn submit form (nếu có)
                        // Kích hoạt hành động hiện tại của nút Kiểm tra/Tiếp theo/Thử lại
                        if (quizCheckButton && !quizAnswerInput.disabled) { // Chỉ kích hoạt nếu input đang bật
                            quizCheckButton.click();
                        }
                    }
                });
                

                // Tab navigation
                questionInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        answerInput.focus();
                    }
                });
                // Listener thứ hai cho 'answer' (xem lại có cần không)
                answerInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            questionInput.focus();
                        } else {
                            document.querySelector('.add-card button').focus();
                        }
                    }
                });

                if (backToFlashcardsButton) {
                    backToFlashcardsButton.addEventListener('click', () => {
                        // Quay lại view flashcard của nhóm hiện tại
                        const currentGroup = groups.find(g => g.id === currentGroupId);
                        if (currentGroup) {
                            showFlashcardView(currentGroup);
                        } else {
                            showGroupManagementView(); // Nếu không tìm thấy nhóm thì về view chính
                        }
                    });
                }
                if (saveMindmapButton) {
                    saveMindmapButton.addEventListener('click', saveCurrentMindmap); // Hàm này sẽ tạo ở app.js
                }
                if (renderMindmapButton) {
                    renderMindmapButton.addEventListener('click', renderCurrentMindmapPreview); // Hàm này sẽ tạo ở ui.js
                }

                // --- KẾT THÚC DI CHUYỂN EVENT LISTENERS ---
                    } catch (error) {
                        console.error("Lỗi khởi tạo ứng dụng với IndexedDB:", error);
                        alert("Không thể tải dữ liệu nhóm. Vui lòng thử tải lại trang.");
                        // Có thể hiển thị thông báo lỗi trên UI
                    }
        }
               
        async function createItem() {
            const nameInput = document.getElementById('new-item-name');
            const typeSelect = document.getElementById('new-item-type');
            const parentSelect = document.getElementById('parent-folder-select'); // Thêm cái này
        
            const itemName = nameInput.value.trim();
            const itemType = typeSelect.value; // 'folder' or 'group'
            const parentId = (itemType === 'group') ? parentSelect.value : null; // Chỉ lấy parentId nếu là 'group'
        
            if (!itemName) {
                alert("Vui lòng nhập tên.");
                return;
            }
            if (itemType === 'group' && !parentId) {
                alert("Vui lòng chọn thư mục cha cho nhóm bài học.");
                return;
            }
        
            const newItemId = Date.now().toString();
            const newItem = {
                id: newItemId,
                name: itemName,
                parentId: parentId, // Thêm parentId
                cards: (itemType === 'group') ? [] : undefined // Thư mục không có thẻ trực tiếp (hoặc bạn có thể để là [])
                // isFolder: (itemType === 'folder') // Có thể thêm cờ này nếu muốn phân biệt rõ ràng hơn
            };
        
            // --- Tạm thời lấy nút Tạo bằng cách khác vì ID đã đổi ---
            const createButton = document.querySelector('.group-management button[onclick="createItem()"]');
            if (createButton) {
                createButton.classList.add('loading');
                createButton.disabled = true;
            }
            // --- Kết thúc phần tạm thời ---
        
        
            try {
                await saveGroupDB(newItem);
                groups.push(newItem);
                initGroups(); // Cập nhật UI (bao gồm cả dropdown cha)
                nameInput.value = '';
                parentSelect.value = ''; // Reset dropdown cha
                parentSelect.style.display = 'none'; // Ẩn lại dropdown cha
                typeSelect.value = 'folder'; // Reset loại về thư mục
                changeGroup(newItemId); // Chuyển sang mục mới tạo
                showToastNotification(`Đã tạo ${itemType === 'folder' ? 'thư mục' : 'nhóm'} thành công!`, "success");
            } catch (error) {
                showToastNotification(`Lỗi khi tạo: ${error.message || error}`, "error");
                console.error("Lỗi createItem:", error);
            } finally {
                 if (createButton) {
                    createButton.classList.remove('loading');
                    createButton.disabled = false;
                 }
            }
        }

        async function renameCurrentItem() {
            const newNameInput = document.getElementById('rename-item'); // Đổi ID
            const newName = newNameInput.value.trim();
            if (!newName) {
                alert("Vui lòng nhập tên mới.");
                return;
            }
            const currentItem = groups.find(g => g.id === currentGroupId);
            if (!currentItem) return;
        
            const originalName = currentItem.name;
            currentItem.name = newName;
        
            try {
                await saveGroupDB(currentItem);
                initGroups(); // Cập nhật tên trong select/optgroup
                newNameInput.value = '';
                checkPausedQuiz(); // Cập nhật nút Resume nếu cần
            } catch (error) {
                alert("Lỗi khi đổi tên.");
                console.error("Lỗi renameCurrentItem:", error);
                currentItem.name = originalName; // Hoàn tác
                initGroups();
            }
        }

        async function deleteCurrentItem() {
            const itemToDelete = groups.find(g => g.id === currentGroupId);
            if (!itemToDelete) return;
        
            let confirmMessage = '';
            let deleteChildren = false;
        
            // Kiểm tra xem đây là thư mục hay nhóm
            const isFolder = !itemToDelete.parentId && itemToDelete.cards === undefined; // Hoặc dùng cờ isFolder
            const childGroups = groups.filter(g => g.parentId === currentGroupId);
        
            if (isFolder) {
                if (childGroups.length > 0) {
                    confirmMessage = `Xóa thư mục "${itemToDelete.name}"?\n\nBạn muốn:\n1. Xóa cả thư mục VÀ ${childGroups.length} nhóm con bên trong?\n2. Chỉ xóa thư mục (các nhóm con sẽ trở thành nhóm độc lập)?`;
                    // Sử dụng prompt hoặc modal tùy chỉnh để có lựa chọn tốt hơn confirm
                    const choice = prompt(confirmMessage + "\n\nNhập 1 hoặc 2:", "1");
                    if (choice === '1') {
                        confirmMessage = `XÁC NHẬN: Xóa thư mục "${itemToDelete.name}" VÀ ${childGroups.length} nhóm con?`;
                        deleteChildren = true;
                    } else if (choice === '2') {
                        confirmMessage = `XÁC NHẬN: Chỉ xóa thư mục "${itemToDelete.name}"? (Nhóm con sẽ được giữ lại)`;
                        deleteChildren = false;
                    } else {
                        return; // Người dùng hủy
                    }
                } else {
                    confirmMessage = `Xóa thư mục rỗng "${itemToDelete.name}"?`;
                    deleteChildren = true; // Xóa thư mục rỗng thì coi như xóa con (không có)
                }
            } else { // Đây là nhóm bài học
                // Kiểm tra quiz đang tạm dừng (logic giữ nguyên)
                const savedProgress = JSON.parse(localStorage.getItem('quizProgress') || 'null');
                if (savedProgress && savedProgress.groupId === currentGroupId) {
                     if (!confirm("Nhóm này có tiến trình quiz đang tạm dừng. Xóa nhóm cũng sẽ xóa tiến trình này. Bạn có chắc chắn?")) {
                         return;
                     }
                     localStorage.removeItem('quizProgress');
                     checkPausedQuiz(); // Cập nhật UI nút resume
                }
                confirmMessage = `Xóa nhóm "${itemToDelete.name}" và toàn bộ ${itemToDelete.cards.length} thẻ bên trong?`;
            }
        
        
            if (confirm(confirmMessage)) {
                try {
                    await deleteGroupDB(currentGroupId);
                    const idsToDelete = [currentGroupId];
                    if (isFolder && deleteChildren) {
                        childGroups.forEach(child => idsToDelete.push(child.id));
                    }
        
                    // Xóa khỏi DB
                    for (const id of idsToDelete) {
                        await deleteGroupDB(id);
                    }
                    
                    if (!isFolder) { // Chỉ xóa mindmap nếu mục bị xóa là nhóm
                        await deleteMindmapDB(currentGroupId); // Gọi hàm xóa mindmap
                    }

                    // Cập nhật mảng groups trong bộ nhớ
                    if (isFolder && !deleteChildren) {
                        // Chỉ xóa thư mục, cập nhật parentId của con thành null
                        groups = groups.filter(g => g.id !== currentGroupId); // Xóa thư mục
                        groups.forEach(g => {
                            if (g.parentId === currentGroupId) {
                                g.parentId = null; // Mồ côi nhóm con
                                // Cần lưu lại thay đổi parentId này vào DB
                                saveGroupDB(g).catch(err => console.error("Lỗi cập nhật parentId cho nhóm mồ côi:", err));
                            }
                        });
                    } else {
                        // Xóa thư mục và con HOẶC xóa nhóm đơn lẻ
                        groups = groups.filter(g => !idsToDelete.includes(g.id));
                    }
        
        
                    // Chọn lại nhóm khác làm nhóm hiện tại
                    const firstSelectableGroup = groups.find(g => Array.isArray(g.cards)) || groups.find(g => g.cards === undefined); // Ưu tiên nhóm có thẻ, rồi đến thư mục
                    currentGroupId = firstSelectableGroup ? firstSelectableGroup.id : null;
        
        
                    if (!currentGroupId && groups.length === 0) {
                        // Nếu không còn gì, tạo lại nhóm mặc định (logic giữ nguyên)
                        console.log("Không còn mục nào, tạo lại nhóm mặc định.");
                        const defaultGroup = { id: 'default', name: 'Mặc định', parentId: null, cards: [] };
                        await saveGroupDB(defaultGroup);
                        groups.push(defaultGroup);
                        currentGroupId = 'default';
                    }
        
                    initGroups(); // Cập nhật select box
                    updateUIForSelectedItem(); // Cập nhật UI dựa trên mục mới được chọn
        
                } catch (error) {
                    alert("Lỗi khi xóa.");
                    console.error("Lỗi deleteCurrentItem:", error);
                    // Cân nhắc việc rollback nếu có lỗi phức tạp
                }
            }
        }

        async function moveCurrentItem() {
            const itemToMove = groups.find(g => g.id === currentGroupId);
            const targetSelect = document.getElementById('move-target-folder-select');
            const targetFolderId = targetSelect.value;
        
            if (!itemToMove) {
                alert("Vui lòng chọn một mục để di chuyển.");
                return;
            }
        
            if (!targetFolderId) {
                alert("Vui lòng chọn thư mục đích hoặc chọn 'Di chuyển ra ngoài'.");
                return;
            }
        
            // Kiểm tra các trường hợp không hợp lệ (ví dụ: di chuyển vào chính nó đã được lọc ở populate)
            // Thêm kiểm tra nếu di chuyển thư mục cha vào thư mục con (phức tạp hơn)
        
            const originalParentId = itemToMove.parentId; // Lưu lại để hoàn tác nếu lỗi
        
            // Cập nhật parentId
            if (targetFolderId === 'root') {
                itemToMove.parentId = null; // Di chuyển ra làm mục gốc
            } else {
                itemToMove.parentId = targetFolderId; // Di chuyển vào thư mục đã chọn
            }
        
            // Lưu vào DB
            try {
                await saveGroupDB(itemToMove);
                // Cập nhật UI
                initGroups(); // Vẽ lại cấu trúc
                // Có thể thêm thông báo thành công
                showToastNotification(`Đã di chuyển "${itemToMove.name}" thành công!`, "success");
                // Reset dropdown di chuyển
                targetSelect.value = "";
                populateMoveTargetSelect(); // Cập nhật lại các tùy chọn di chuyển cho mục hiện tại
        
            } catch (error) {
                alert("Lỗi khi di chuyển mục.");
                console.error("Lỗi moveCurrentItem:", error);
                // Hoàn tác thay đổi trong bộ nhớ nếu lưu DB lỗi
                itemToMove.parentId = originalParentId;
                initGroups(); // Vẽ lại cấu trúc cũ
            }
        }

        function changeGroup(itemId) {
            // Nếu đang trong quiz, không cho đổi nhóm (hoặc hỏi xác nhận hủy quiz)
            if (quizMode) {
                if (!confirm("Bạn đang trong quiz. Chuyển nhóm sẽ hủy tiến trình quiz hiện tại. Bạn có chắc chắn?")) {
                    // Đặt lại select về giá trị cũ
                    document.getElementById('group-select').value = currentGroupId;
                    return;
                }
                // Nếu xác nhận, kết thúc quiz hiện tại mà không lưu
                forceEndQuiz();
            }
            currentGroupId = itemId; // Bây giờ itemId có thể là ID của thư mục hoặc nhóm
            document.getElementById('group-select').value = currentGroupId; // Đảm bảo select được cập nhật
            updateUIForSelectedItem(); // Gọi hàm cập nhật UI
            checkPausedQuiz();
            populateMoveTargetSelect();
        }

        async function editCard(index, field, value) {
            const currentGroup = groups.find(g => g.id === currentGroupId);
            if (!currentGroup || !currentGroup.cards[index]) return;
        
            const trimmedValue = value.trim();
            const cardToEdit = currentGroup.cards[index];
            const originalValue = cardToEdit[field]; // Lưu giá trị cũ
        
            if (!trimmedValue) {
                alert("Câu hỏi và câu trả lời không được để trống!");
                renderCards(); // Render lại để reset input về giá trị cũ (originalValue)
                return;
            }
        
            // Cập nhật giá trị trong mảng bộ nhớ
            cardToEdit[field] = trimmedValue;
        
            try {
                await saveGroupDB(currentGroup); // Lưu toàn bộ group đã cập nhật vào DB
                // Không cần render lại ngay nếu thành công, vì input đã cập nhật
            } catch (error) {
                alert("Lỗi khi cập nhật thẻ.");
                console.error("Lỗi editCard:", error);
                // Hoàn tác thay đổi trong bộ nhớ nếu lưu DB lỗi
                cardToEdit[field] = originalValue;
                renderCards(); // Render lại để hiển thị giá trị cũ
            }
        }

        async function addCard() {
            const questionInput = document.getElementById('question');
            const answerInput = document.getElementById('answer');
            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();
        
            if (question && answer) {
                const currentGroup = groups.find(g => g.id === currentGroupId);
                if (!currentGroup) {
                    alert("Lỗi: Không tìm thấy nhóm hiện tại để thêm thẻ.");
                    return;
                }
        
                const newCard = {
                    // Có thể thêm ID duy nhất cho thẻ nếu cần xóa/sửa chính xác hơn sau này
                    // id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    question,
                    answer,
                    showAnswer: false
                };
        
                currentGroup.cards.push(newCard); // Thêm vào mảng trong bộ nhớ
        
                try {
                    await saveGroupDB(currentGroup); // Lưu toàn bộ group đã cập nhật vào DB
                    renderCards(); // Cập nhật danh sách thẻ UI
                    initGroups(); // Cập nhật số lượng thẻ trong select
                    questionInput.value = '';
                    answerInput.value = '';
                    questionInput.focus();
                } catch (error) {
                    alert("Lỗi khi thêm thẻ mới.");
                    console.error("Lỗi addCard:", error);
                    // Hoàn tác: Xóa thẻ vừa thêm khỏi mảng nếu lưu DB lỗi
                    currentGroup.cards.pop();
                    renderCards();
                    initGroups();
                }
            } else {
                alert("Vui lòng nhập cả câu hỏi và câu trả lời.");
            }
        }

        async function deleteCard(index) {
            const currentGroup = groups.find(g => g.id === currentGroupId);
            if (!currentGroup || !currentGroup.cards[index]) return;
        
            const cardToDelete = currentGroup.cards[index];
        
            if (confirm(`Bạn có chắc muốn xóa thẻ:\nQ: ${cardToDelete.question}\nA: ${cardToDelete.answer}`)) {
                const removedCard = currentGroup.cards.splice(index, 1)[0]; // Xóa khỏi mảng và lưu lại phòng lỗi
        
                try {
                    await saveGroupDB(currentGroup); // Lưu group đã cập nhật vào DB
                    renderCards(); // Cập nhật UI
                    initGroups(); // Cập nhật số lượng thẻ
                } catch (error) {
                    alert("Lỗi khi xóa thẻ.");
                    console.error("Lỗi deleteCard:", error);
                    // Hoàn tác: Thêm thẻ lại vào mảng nếu lưu DB lỗi
                    currentGroup.cards.splice(index, 0, removedCard);
                    renderCards();
                    initGroups();
                }
            }
        }

        function startQuiz(resume = false) {
            if (!resume) {
                 // Nếu bắt đầu quiz mới, xóa tiến trình cũ nếu có
                 localStorage.removeItem('quizProgress');
                 checkPausedQuiz(); // Ẩn nút Resume nếu có

                const currentGroup = groups.find(g => g.id === currentGroupId);
                if (!currentGroup || currentGroup.cards.length === 0) {
                    alert("Vui lòng thêm thẻ vào nhóm này trước!");
                    return;
                }

                // Tạo mảng thẻ cho phiên quiz
                quizSessionCards = currentGroup.cards.map(card => ({
                    ...card, // Sao chép thuộc tính gốc (question, answer)
                    correctStreak: 0,
                    isMastered: false
                }));

                // Reset trạng thái
                currentQuizIndex = 0;
                masteredCount = 0;

            } else {
                // Logic resume đã xử lý việc khôi phục state trong resumeQuiz()
                 if (quizSessionCards.length === 0) {
                     console.error("Lỗi: Không thể tiếp tục quiz, không có dữ liệu thẻ.");
                     alert("Đã xảy ra lỗi khi tiếp tục quiz. Vui lòng bắt đầu lại.");
                     forceEndQuiz();
                     return;
                 }
            }


            if (quizSessionCards.length === 0) {
                 alert("Nhóm này không có thẻ nào để học!");
                 return;
            }

            const quizContainer = flashcardView.querySelector('#quiz-container');
            const flashcardsContainer = flashcardView.querySelector('#flashcards');
            const addCardSection = flashcardView.querySelector('.add-card');
            const quizControls = flashcardView.querySelector('#quiz-controls'); // Nút Start/Resume

            if (!quizContainer || !flashcardsContainer || !addCardSection || !quizControls) {
                console.error("Lỗi: Không tìm thấy các thành phần UI cần thiết cho quiz.");
                return;
            }

            quizMode = true;
            if (quizContainer) quizContainer.classList.remove('hidden');
            if (flashcardsContainer) flashcardsContainer.classList.add('hidden');
            if (addCardSection) addCardSection.classList.add('hidden');
            if (quizControls) quizControls.classList.add('hidden'); // Ẩn nút Start/Resume

            updateScoreDisplay(); // Hàm này cần lấy quizScoreDisplay bên trong quizContainer
            showNextQuestion();
        }

        function endQuiz() {
            alert(`Chúc mừng! Bạn đã thuộc tất cả ${quizSessionCards.length} thẻ trong nhóm này!`);
            localStorage.removeItem('quizProgress'); // Xóa tiến trình đã lưu khi hoàn thành
            forceEndQuiz(); // Gọi hàm dọn dẹp chung
        }

        // Hàm kết thúc quiz (do hoàn thành, tạm dừng, hoặc hủy)
        


        // --- Chức năng Tạm dừng / Tiếp tục ---
        function pauseQuiz() {
            if (!quizMode) return;
            const cardIdsInSession = quizSessionCards.map(card => card.id || card.question); // Dùng ID nếu có, hoặc question làm key tạm

            const quizState = {
                groupId: currentGroupId,
                cardIds: cardIdsInSession,
                cardStates: quizSessionCards.map(card => ({ // Lưu trạng thái riêng của từng thẻ
                    id: card.id || card.question, // Key để khớp
                    correctStreak: card.correctStreak,
                    isMastered: card.isMastered
                })),
                currentIndex: currentQuizIndex, // Vẫn lưu index hiện tại
                mastered: masteredCount,
                timestamp: Date.now()
            };
        

            try {
                localStorage.setItem('quizProgress', JSON.stringify(quizState));
                alert("Quiz đã được tạm dừng. Bạn có thể tiếp tục sau.");
                forceEndQuiz();
            } catch (e) {
                // Kiểm tra lỗi cụ thể hơn nếu có thể
                if (e.name === 'QuotaExceededError') {
                     alert("Không thể lưu tiến trình quiz do hết dung lượng lưu trữ trình duyệt (localStorage). Hãy thử xóa bớt dữ liệu duyệt web hoặc giảm số lượng thẻ trong nhóm.");
                } else {
                     alert("Không thể lưu tiến trình quiz. Đã xảy ra lỗi không mong muốn.");
                }
                console.error("Lỗi khi lưu tiến trình quiz:", e);
            }
        }

        function resumeQuiz() {
            const savedProgress = JSON.parse(localStorage.getItem('quizProgress') || 'null');
            if (!savedProgress || !savedProgress.cardIds) { // Kiểm tra có cardIds không
                alert("Không tìm thấy tiến trình quiz đã lưu hoặc dữ liệu không hợp lệ.");
                localStorage.removeItem('quizProgress'); // Xóa dữ liệu không hợp lệ
                checkPausedQuiz();
                return;
            }

            const targetGroup = groups.find(g => g.id === savedProgress.groupId);
            if (!targetGroup) {
                alert(`Nhóm của quiz đã lưu (ID: ${savedProgress.groupId}) không còn tồn tại. Không thể tiếp tục.`);
                localStorage.removeItem('quizProgress');
                checkPausedQuiz();
                return;
            }
        
            // Khôi phục trạng thái
            currentGroupId = savedProgress.groupId;
            masteredCount = savedProgress.mastered;
            currentQuizIndex = savedProgress.currentIndex; // Sẽ được điều chỉnh lại trong showNextQuestion
        
            // Tái tạo quizSessionCards từ dữ liệu gốc và trạng thái đã lưu
            quizSessionCards = savedProgress.cardIds.map(cardIdOrQuestion => {
                const originalCard = targetGroup.cards.find(c => (c.id || c.question) === cardIdOrQuestion);
                const savedState = savedProgress.cardStates.find(s => s.id === cardIdOrQuestion);
        
                if (!originalCard) {
                    console.warn(`Không tìm thấy thẻ gốc với ID/Question: ${cardIdOrQuestion}`);
                    return null; // Bỏ qua thẻ không tìm thấy
                }
        
                return {
                    ...originalCard, // Lấy question, answer từ thẻ gốc
                    correctStreak: savedState ? savedState.correctStreak : 0,
                    isMastered: savedState ? savedState.isMastered : false
                };
            }).filter(card => card !== null); // Loại bỏ các thẻ không tìm thấy
        
            if (quizSessionCards.length === 0) {
                 alert("Không thể khôi phục thẻ cho quiz. Có thể thẻ đã bị xóa.");
                 localStorage.removeItem('quizProgress');
                 checkPausedQuiz();
                 return;
            }
        
        
            document.getElementById('group-select').value = currentGroupId;
            renderCards();
        
            startQuiz(true); // Gọi startQuiz với cờ resume = true
        }

        function forceEndQuiz() {
            quizMode = false;
            const quizContainer = flashcardView.querySelector('#quiz-container');
            const flashcardsContainer = flashcardView.querySelector('#flashcards');
            const addCardSection = flashcardView.querySelector('.add-card');
            const quizControls = flashcardView.querySelector('#quiz-controls'); // Nút Start/Resume

            if (quizContainer) quizContainer.classList.add('hidden');
            if (flashcardsContainer) flashcardsContainer.classList.remove('hidden'); // Hiện lại danh sách thẻ
            if (addCardSection) addCardSection.classList.remove('hidden');      // Hiện lại phần thêm thẻ
            if (quizControls) quizControls.classList.remove('hidden');       // Hiện lại nút Start/Resume

            // Reset trạng thái quiz
            quizSessionCards = [];
            currentQuizIndex = 0;
            masteredCount = 0;
            const scoreDisplay = quizContainer?.querySelector('#quiz-score');
            const feedbackDisplay = quizContainer?.querySelector('#quiz-feedback');
            const answerInput = quizContainer?.querySelector('#quiz-answer');
            const checkButton = quizContainer?.querySelector('#quiz-check-btn');


            if (scoreDisplay) scoreDisplay.textContent = '';
            if (feedbackDisplay) feedbackDisplay.innerHTML = '';
            if (answerInput) {
                answerInput.value = '';
                answerInput.disabled = false;
            }
            if (checkButton) {
                checkButton.textContent = 'Kiểm tra';
                checkButton.onclick = checkAnswer; // Gán lại hàm gốc
            }

            checkPausedQuiz(); // Kiểm tra lại nút Resume
        }

        function showNextQuestion() {
            // Kiểm tra xem tất cả đã master chưa
            if (masteredCount >= quizSessionCards.length) {
                endQuiz();
                return;
            }

            // Tìm thẻ chưa master tiếp theo
            let attempts = 0; // Ngăn vòng lặp vô hạn nếu có lỗi logic
            let foundIndex = -1;

            // Bắt đầu tìm từ vị trí sau vị trí hiện tại
            let searchIndex = (currentQuizIndex + 1) % quizSessionCards.length;

            while (attempts < quizSessionCards.length) {
                 if (!quizSessionCards[searchIndex].isMastered) {
                     foundIndex = searchIndex;
                     break;
                 }
                 searchIndex = (searchIndex + 1) % quizSessionCards.length;
                 attempts++;
            }

            // Nếu không tìm thấy (trường hợp này không nên xảy ra nếu masteredCount < length)
            if (foundIndex === -1) {
                // Có thể tất cả đã master, kiểm tra lại
                if (quizSessionCards.every(card => card.isMastered)) {
                    endQuiz();
                    return;
                } else {
                    // Lỗi logic không mong muốn, thử tìm từ đầu
                    console.warn("Không tìm thấy thẻ chưa master tiếp theo, thử tìm lại từ đầu.");
                    foundIndex = quizSessionCards.findIndex(card => !card.isMastered);
                    if (foundIndex === -1) {
                        console.error("Lỗi nghiêm trọng: Không tìm thấy thẻ chưa master nào dù masteredCount chưa đủ.");
                        alert("Đã xảy ra lỗi trong quá trình quiz. Quiz sẽ kết thúc.");
                        forceEndQuiz();
                        return;
                    }
                }
            }

            currentQuizIndex = foundIndex;
            const currentCard = quizSessionCards[currentQuizIndex];

            console.log('Hiển thị câu hỏi tiếp theo. Index:', currentQuizIndex);
            console.log('Thẻ hiện tại (currentCard):', JSON.stringify(currentCard));
            

            quizQuestionDisplay.textContent = currentCard.question;
            quizAnswerInput.value = '';
            quizFeedback.innerHTML = ''; // Xóa phản hồi cũ
            quizCheckButton.textContent = 'Kiểm tra';
            quizCheckButton.onclick = checkAnswer; // Gán lại hàm checkAnswer
            quizAnswerInput.disabled = false; // Đảm bảo ô nhập được kích hoạt
            quizAnswerInput.focus();
            quizPauseButton.disabled = false; // Kích hoạt nút Pause
        }

        function checkAnswer() {
            const currentAnswerInput = flashcardView?.querySelector('#quiz-answer');
            const currentFeedback = flashcardView?.querySelector('#quiz-feedback');
            const currentCheckButton = flashcardView?.querySelector('#quiz-check-btn');
            const currentPauseButton = flashcardView?.querySelector('#quiz-pause-btn');

            if (!currentAnswerInput || !currentFeedback || !currentCheckButton || !currentPauseButton) {
                console.error("Lỗi: Không tìm thấy element quiz cần thiết trong checkAnswer.");
                forceEndQuiz();
                return;
            }

            quizAnswerInput.disabled = true; // Vô hiệu hóa ô nhập tạm thời
            quizPauseButton.disabled = true; // Vô hiệu hóa Pause khi đang xử lý
            // Xóa animation cũ trước khi thêm mới
            quizFeedback.classList.remove('animate-correct', 'animate-wrong');
            // Dùng requestAnimationFrame để đảm bảo class được xóa trước khi thêm lại
            requestAnimationFrame(() => {
                if (userAnswer === correctAnswer) {
                    currentCard.correctStreak++;
                    if (currentCard.correctStreak >= 2) {
                        if (!currentCard.isMastered) {
                            currentCard.isMastered = true;
                            masteredCount++;
                            updateScoreDisplay();
                        }
                        quizFeedback.innerHTML = `<span class="correct">Đúng rồi! Đã thuộc câu này! 🎉 (${currentCard.correctStreak}/2)</span><br>Nhấn Enter hoặc nút 'Tiếp theo' để qua câu sau.`;
                    } else {
                        quizFeedback.innerHTML = `<span class="correct">Đúng rồi! 👍 (Lần ${currentCard.correctStreak}/2)</span><br>Nhấn Enter hoặc nút 'Tiếp theo' để qua câu sau.`;
                    }

                        // Thêm animation đúng
                        quizFeedback.classList.add('animate-correct');

                        quizCheckButton.textContent = 'Tiếp theo';
                        quizCheckButton.onclick = showNextQuestion;
                        quizCheckButton.focus();
                        quizPauseButton.disabled = false;

                    } else {
                        currentCard.correctStreak = 0;
                        quizFeedback.innerHTML = `
                            <span class="wrong">Sai rồi 😢</span>
                            <div>Đáp án đúng: ${originalCorrectAnswer}</div>
                            <div>So sánh: ${highlightDiff(userAnswer, originalCorrectAnswer)}</div>
                            <br><strong>Hãy thử lại câu này!</strong>
                        `;

                        // Thêm animation sai
                        // Lấy phần tử span chứa chữ "Sai rồi" để thêm animation
                        const wrongSpan = quizFeedback.querySelector('.wrong');
                        if (wrongSpan) {
                            wrongSpan.classList.add('animate-wrong');
                        }


                        quizCheckButton.textContent = 'Thử lại';
                        quizCheckButton.onclick = checkAnswer;
                        quizAnswerInput.disabled = false;
                        quizAnswerInput.focus();
                        quizAnswerInput.select();
                        quizPauseButton.disabled = false;
                    }
                        }
            );
        }

        async function saveCurrentMindmap() {
            if (!currentGroupId) {
                showToastNotification("Lỗi: Không xác định được nhóm hiện tại.", "error");
                return;
            }
            if (!mindmapMarkdownInput) {
                showToastNotification("Lỗi: Không tìm thấy ô nhập liệu Markdown.", "error");
                return;
            }

            const markdownContent = mindmapMarkdownInput.value;
            const saveButton = document.getElementById('save-mindmap-btn');

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = '💾 Đang lưu...';
            }

            try {
                await saveMindmapDB(currentGroupId, markdownContent); // Gọi hàm từ db.js
                showToastNotification("Đã lưu Mind Map thành công!", "success");
                // Có thể render lại preview sau khi lưu nếu muốn
                // renderCurrentMindmapPreview();
            } catch (error) {
                console.error("Lỗi khi lưu mindmap:", error);
                showToastNotification(`Lỗi khi lưu Mind Map: ${error}`, "error");
            } finally {
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '💾 Lưu Mind Map';
                }
            }
        }

