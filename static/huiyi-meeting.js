document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();

    // 添加全局事件监听器，确保在页面切换时重置按钮状态
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // 页面变为可见时，重置所有表单按钮状态
            resetAllFormButtonStates();
        }
    });

    // 页面初始加载
    initMeetingPage();

    // 会议管理页面初始化
    function initMeetingPage() {
        // 重置所有表单按钮状态
        resetAllFormButtonStates();

        fetchMeetings();

        // 添加会议按钮事件绑定
        const addMeetingBtn = document.getElementById('add-meeting-btn');
        if (addMeetingBtn) {
            addMeetingBtn.addEventListener('click', () => openEditView());
        }

        // 返回列表按钮事件绑定
        const backToListBtn = document.getElementById('back-to-list-btn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', returnToListView);
        }

        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', returnToListView);
        }

        // 添加议程项按钮事件绑定
        const addAgendaItemBtn = document.getElementById('addAgendaItemBtn');
        if (addAgendaItemBtn) {
            addAgendaItemBtn.addEventListener('click', () => addAgendaItem());
        }

        // 会议表单提交事件绑定
        const meetingForm = document.getElementById('meetingForm');
        if (meetingForm) {
            meetingForm.addEventListener('submit', handleMeetingFormSubmit);
        }

        // 查看会议模态框关闭按钮事件绑定
        const closeViewModalElements = document.querySelectorAll('#viewMeetingModal .close, #closeViewModalBtn');
        closeViewModalElements.forEach(element => {
            element.addEventListener('click', closeViewModal);
        });

        // 查询和重置按钮事件绑定
        const queryBtn = document.querySelector('.filters .btn-secondary');
        if (queryBtn) {
            queryBtn.addEventListener('click', handleQueryMeetings);
        }

        const resetBtn = document.querySelector('.filters .btn-outline');
        if (resetBtn) {
            resetBtn.addEventListener('click', handleResetQuery);
        }

        // 为输入框添加回车键支持
        const filterInputs = document.querySelectorAll('.filters input');
        filterInputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 防止表单提交
                    handleQueryMeetings();
                }
            });
        });
    }

    // --- Helper function to render status span ---
    function renderStatus(status) {
        let className = '';
        switch (status) {
            case '未开始': className = 'status-upcoming'; break;
            case '进行中': className = 'status-ongoing'; break;
            case '已结束': className = 'status-finished'; break;
            default: className = 'status-unknown'; status = '未知'; // Handle unexpected status
        }
        return `<span class="status ${className}">${status}</span>`;
    }

    // --- Helper function to render action buttons ---
    function renderActionButtons(meeting) {
        const isUpcoming = meeting.status === '未开始';
        const isOngoing = meeting.status === '进行中';
        const isFinished = meeting.status === '已结束';

        let buttons = '';
        if (isUpcoming) {
            buttons += `<button class="btn-action start" data-id="${meeting.id}">开始会议</button> `;
        }
        if (isOngoing) {
            buttons += `<button class="btn-action end" data-id="${meeting.id}">结束会议</button> `;
        }
        if (isFinished) {
            buttons += `<button class="btn-action restart" data-id="${meeting.id}">重新开始</button> `;
        }
        buttons += `<button class="btn-action view" data-id="${meeting.id}">查看</button> `;
        if (!isOngoing) { // Can edit if not ongoing (including finished meetings)
             buttons += `<button class="btn-action edit" data-id="${meeting.id}">编辑</button> `;
        } else {
             buttons += `<button class="btn-action edit disabled" data-id="${meeting.id}" disabled>编辑</button> `;
        }
         if (!isOngoing) { // Can delete only if not ongoing
             buttons += `<button class="btn-action delete" data-id="${meeting.id}">删除</button>`;
         } else {
             buttons += `<button class="btn-action delete disabled" data-id="${meeting.id}" disabled>删除</button>`;
         }
        return buttons;
    }

    // --- Function to attach listeners to buttons within a container (or row) ---
    function attachActionListeners(container) {
        // Start Button Listener
        container.querySelectorAll('.btn-action.start:not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached'); // Mark as attached
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;

                if (window.confirm(`确定要开始会议 "${meetingName}" 吗？此操作将同步文件并更新状态。`)) {
                    console.log(`开始会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/v1/meetings/${meetingId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: '进行中' })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(updatedMeeting => {
                        console.log('Meeting status updated:', updatedMeeting);
                        const statusCell = row.querySelector('td:nth-child(4)'); // 4th cell is status
                        if (statusCell) statusCell.innerHTML = renderStatus(updatedMeeting.status);
                        const actionCell = row.querySelector('td:last-child');
                        if (actionCell) {
                             actionCell.innerHTML = renderActionButtons(updatedMeeting);
                             // Re-attach listeners ONLY to the newly rendered buttons in this specific row
                             attachActionListeners(actionCell);
                        }
                    })
                    .catch(error => {
                        console.error('Error starting meeting:', error);
                        alert(`开始会议失败: ${error.message}`);
                    });
                } else {
                    console.log(`取消开始会议: ${meetingName}`);
                }
            });
        });

        // End Button Listener
        container.querySelectorAll('.btn-action.end:not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached'); // Mark as attached
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;

                if (window.confirm(`确定要结束会议 "${meetingName}" 吗？此操作将更新会议状态为已结束。`)) {
                    console.log(`结束会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/v1/meetings/${meetingId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: '已结束' })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(updatedMeeting => {
                        console.log('Meeting status updated:', updatedMeeting);
                        const statusCell = row.querySelector('td:nth-child(4)'); // 4th cell is status
                        if (statusCell) statusCell.innerHTML = renderStatus(updatedMeeting.status);
                        const actionCell = row.querySelector('td:last-child');
                        if (actionCell) {
                             actionCell.innerHTML = renderActionButtons(updatedMeeting);
                             // Re-attach listeners ONLY to the newly rendered buttons in this specific row
                             attachActionListeners(actionCell);
                        }
                    })
                    .catch(error => {
                        console.error('Error ending meeting:', error);
                        alert(`结束会议失败: ${error.message}`);
                    });
                } else {
                    console.log(`取消结束会议: ${meetingName}`);
                }
            });
        });

        // Restart Button Listener
        container.querySelectorAll('.btn-action.restart:not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached'); // Mark as attached
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;

                if (window.confirm(`确定要重新开始会议 "${meetingName}" 吗？此操作将更新会议状态为进行中。`)) {
                    console.log(`重新开始会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/v1/meetings/${meetingId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: '进行中' })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(updatedMeeting => {
                        console.log('Meeting status updated:', updatedMeeting);
                        const statusCell = row.querySelector('td:nth-child(4)'); // 4th cell is status
                        if (statusCell) statusCell.innerHTML = renderStatus(updatedMeeting.status);
                        const actionCell = row.querySelector('td:last-child');
                        if (actionCell) {
                             actionCell.innerHTML = renderActionButtons(updatedMeeting);
                             // Re-attach listeners ONLY to the newly rendered buttons in this specific row
                             attachActionListeners(actionCell);
                        }
                    })
                    .catch(error => {
                        console.error('Error restarting meeting:', error);
                        alert(`重新开始会议失败: ${error.message}`);
                    });
                } else {
                    console.log(`取消重新开始会议: ${meetingName}`);
                }
            });
        });

        // Delete Button Listener
        container.querySelectorAll('.btn-action.delete:not(.disabled):not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached');
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;
                if (window.confirm(`确定要删除会议 "${meetingName}" 吗？`)) {
                    console.log(`删除会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/v1/meetings/${meetingId}`, { method: 'DELETE' })
                    .then(response => {
                        if (!response.ok && response.status !== 204) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        console.log('Meeting deleted successfully');
                        row.remove();
                        // Update total count
                        updatePaginationCount(document.querySelectorAll('.data-table tbody tr').length);
                    })
                    .catch(error => {
                        console.error('Error deleting meeting:', error);
                        alert(`删除会议失败: ${error.message}`);
                    });
                }
            });
        });

        // View Button Listener
        container.querySelectorAll('.btn-action.view:not(.listener-attached)').forEach(button => {
             button.classList.add('listener-attached');
             button.addEventListener('click', async (e) => {
                 const meetingId = e.target.dataset.id;
                 console.log(`Attempting to view meeting ID: ${meetingId}`);
                 openViewModal(meetingId);
             });
        });

        // Edit Button Listener
        container.querySelectorAll('.btn-action.edit:not(.disabled):not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached');
            button.addEventListener('click', async (e) => {
                const meetingId = e.target.dataset.id;
                console.log(`Attempting to edit meeting ID: ${meetingId}`);
                try {
                    const response = await fetch(`/api/v1/meetings/${meetingId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const meetingData = await response.json();
                    console.log('Fetched meeting data for edit:', meetingData);
                    openEditView(meetingData);
                } catch (error) {
                    console.error('Error fetching meeting details for edit:', error);
                    alert(`加载会议详情失败: ${error.message}`);
                }
            });
        });
    }

    // 会议管理页面函数
    async function fetchMeetings() {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';

        try {
            const response = await fetch('/api/v1/meetings/');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const meetings = await response.json();

            let tableBodyHtml = '';
            if (meetings.length === 0) {
                tableBodyHtml = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无会议</td></tr>';
            } else {
                meetings.forEach(meeting => {
                    tableBodyHtml += `
                        <tr data-id="${meeting.id}">
                            <td>${meeting.title || '-'}</td>
                            <td>${meeting.intro || '-'}</td>
                            <td>${meeting.time ? meeting.time.replace('T', ' ') : '-'}</td>
                            <td>${renderStatus(meeting.status)}</td>
                            <td>${renderActionButtons(meeting)}</td>
                        </tr>
                    `;
                });
            }

            tableBody.innerHTML = tableBodyHtml;

            // 更新计数
            updatePaginationCount(meetings.length);

            // 附加操作按钮事件
            attachActionListeners(tableBody);

        } catch (error) {
            console.error('Failed to load meetings:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">加载会议列表失败: ${error.message}</td></tr>`;
        }
    }

    // 页面视图切换相关函数
    function openEditView(meetingData = null) {
        const meetingListView = document.getElementById('meeting-list-view');
        const meetingEditView = document.getElementById('meeting-edit-view');
        const meetingForm = document.getElementById('meetingForm');
        const agendaItemsContainer = document.getElementById('agendaItemsContainer');
        const editViewTitle = document.getElementById('edit-view-title');
        const meetingIdInput = document.getElementById('meetingId');

        meetingForm.reset(); // 清除之前的数据
        agendaItemsContainer.innerHTML = ''; // 清除之前的议程项
        meetingIdInput.value = ''; // 清除ID

        // 重置保存按钮状态
        const submitButton = meetingForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<span class="icon">💾</span> 保存会议';
        }

        // 移除保存状态消息
        const saveStatusMessage = meetingForm.querySelector('.save-status-message');
        if (saveStatusMessage) {
            saveStatusMessage.remove();
        }

        if (meetingData) {
            // 填充表单进行编辑
            editViewTitle.textContent = '编辑会议';
            meetingIdInput.value = meetingData.id;
            document.getElementById('meetingTitle').value = meetingData.title || '';
            document.getElementById('meetingIntro').value = meetingData.intro || '';

            // 格式化日期时间 (需要 YYYY-MM-DDTHH:mm 格式)
            if (meetingData.time) {
                try {
                    const date = new Date(meetingData.time);
                    // 用前导零填充月、日、小时、分钟
                    const pad = (num) => num.toString().padStart(2, '0');
                    const formattedDateTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                    document.getElementById('meetingTime').value = formattedDateTime;
                } catch (e) {
                    console.error("解析会议时间出错:", meetingData.time, e);
                    document.getElementById('meetingTime').value = ''; // 无效则清除
                }
            } else {
                document.getElementById('meetingTime').value = '';
            }

            // 填充议程项
            if (meetingData.agenda_items && meetingData.agenda_items.length > 0) {
                meetingData.agenda_items.forEach((item, index) => {
                    // 添加议程项
                    addAgendaItem(item, index);

                    // 显示已上传的文件
                    if (item.files && item.files.length > 0) {
                        setTimeout(() => {
                            displayExistingFiles(item.files, index);
                        }, 100); // 等待议程项元素创建完成
                    }
                });
            }
        } else {
            // 设置新会议
            editViewTitle.textContent = '新增会议';
            addAgendaItem(); // 默认为新会议添加一个空的议程项
        }

        // 切换视图
        meetingListView.style.display = 'none';
        meetingEditView.style.display = 'block';
    }

    // 返回列表视图
    function returnToListView() {
        const meetingListView = document.getElementById('meeting-list-view');
        const meetingEditView = document.getElementById('meeting-edit-view');

        // 重置保存按钮状态
        const submitButton = document.querySelector('#meetingForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<span class="icon">💾</span> 保存会议';
        }

        // 移除保存状态消息
        const saveStatusMessage = document.querySelector('.save-status-message');
        if (saveStatusMessage) {
            saveStatusMessage.remove();
        }

        meetingEditView.style.display = 'none';
        meetingListView.style.display = 'block';
    }

    // 添加议程项
    function addAgendaItem(itemData = null, index = null) {
        const agendaItemsContainer = document.getElementById('agendaItemsContainer');
        const itemIndex = (index !== null) ? index : agendaItemsContainer.children.length;
        const newItemHtml = `
            <div class="agenda-item" data-index="${itemIndex}">
                <h4>议程 ${itemIndex + 1}</h4>
                <input type="hidden" name="agenda[${itemIndex}][position]" value="${itemIndex + 1}" />

                <label for="agendaTitle_${itemIndex}">标题:</label>
                <input type="text" id="agendaTitle_${itemIndex}" name="agenda[${itemIndex}][title]" value="${itemData?.title || ''}" required />

                <label for="agendaReporter_${itemIndex}">议程文件上传:</label>

                <div class="file-upload-container">
                    <div class="file-upload-area" id="fileUploadArea_${itemIndex}">
                        <div class="file-upload-prompt">
                            <i class="upload-icon">📄</i>
                            <p>拖拽文件到此处或</p>
                            <button type="button" class="btn btn-outline file-select-btn" id="fileSelectBtn_${itemIndex}">选择文件</button>
                            <p class="file-hint">支持PDF文件，可多选</p>
                        </div>
                        <input type="file" id="agendaFiles_${itemIndex}" name="agenda[${itemIndex}][files]" accept=".pdf" multiple style="display: none;" />
                    </div>
                    <div class="selected-files" id="selectedFiles_${itemIndex}">
                        <div class="file-queue-header" style="display: none;">
                            <h5>待上传文件</h5>
                            <button type="button" class="btn btn-primary upload-files-btn" id="uploadFilesBtn_${itemIndex}">上传全部</button>
                        </div>
                        <ul class="file-queue" id="fileQueue_${itemIndex}"></ul>
                    </div>
                </div>

                ${itemIndex > 0 ? `<button type="button" class="btn removeAgendaItemBtn" data-index="${itemIndex}">移除此议程</button>` : ''}
            </div>
        `;

        // Add the new item to the container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newItemHtml.trim();
        const newItem = tempDiv.firstChild;
        agendaItemsContainer.appendChild(newItem);

        // Attach event listener to the remove button if present
        const removeButton = newItem.querySelector('.removeAgendaItemBtn');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                if (!isNaN(index)) {
                    agendaItemsContainer.querySelector(`.agenda-item[data-index="${index}"]`).remove();
                }
            });
        }

        // 添加文件上传相关事件监听器
        const fileInput = newItem.querySelector(`#agendaFiles_${itemIndex}`);
        const selectedFilesDiv = newItem.querySelector(`#selectedFiles_${itemIndex}`);
        const fileUploadArea = newItem.querySelector(`#fileUploadArea_${itemIndex}`);
        const fileSelectBtn = newItem.querySelector(`#fileSelectBtn_${itemIndex}`);
        const fileQueueHeader = selectedFilesDiv.querySelector('.file-queue-header');
        const fileQueue = newItem.querySelector(`#fileQueue_${itemIndex}`);
        const uploadFilesBtn = newItem.querySelector(`#uploadFilesBtn_${itemIndex}`);

        // 存储待上传文件的数组
        const pendingFiles = [];

        // 更新文件队列显示
        function updateFileQueue() {
            if (pendingFiles.length > 0) {
                fileQueueHeader.style.display = 'flex';

                let fileListHTML = '';
                pendingFiles.forEach((file, idx) => {
                    fileListHTML += `
                    <li class="file-item" data-index="${idx}">
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                        <button type="button" class="btn-remove-file" data-index="${idx}">×</button>
                    </li>`;
                });
                fileQueue.innerHTML = fileListHTML;

                // 添加删除文件事件
                fileQueue.querySelectorAll('.btn-remove-file').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const idx = parseInt(this.dataset.index);
                        if (!isNaN(idx) && idx >= 0 && idx < pendingFiles.length) {
                            pendingFiles.splice(idx, 1);
                            updateFileQueue();
                        }
                    });
                });
            } else {
                fileQueueHeader.style.display = 'none';
                fileQueue.innerHTML = '';
            }
        }

        // 处理文件选择
        function handleFileSelect(files) {
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    // 检查是否为PDF文件
                    if (files[i].type === 'application/pdf') {
                        pendingFiles.push(files[i]);
                    }
                }
                updateFileQueue();
            }
        }

        // 文件选择按钮点击事件
        if (fileSelectBtn) {
            fileSelectBtn.addEventListener('click', function(e) {
                e.preventDefault();
                fileInput.click();
            });
        }

        // 文件选择变化事件
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                handleFileSelect(this.files);
                // 重置input以允许选择相同文件
                this.value = '';
            });
        }

        // 拖拽相关事件
        if (fileUploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                fileUploadArea.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            // 拖拽样式
            fileUploadArea.addEventListener('dragenter', function() {
                this.classList.add('drag-over');
            }, false);

            fileUploadArea.addEventListener('dragover', function() {
                this.classList.add('drag-over');
            }, false);

            fileUploadArea.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            }, false);

            // 处理文件拖放
            fileUploadArea.addEventListener('drop', function(e) {
                this.classList.remove('drag-over');
                handleFileSelect(e.dataTransfer.files);
            }, false);
        }

        // 上传按钮点击事件
        if (uploadFilesBtn) {
            uploadFilesBtn.addEventListener('click', async function() {
                if (pendingFiles.length === 0) {
                    alert('没有待上传的文件');
                    return;
                }

                // 获取议程项元素
                const agendaItem = this.closest('.agenda-item');
                const agendaItemIndex = parseInt(agendaItem.dataset.index);

                // 显示上传进度
                const fileQueue = agendaItem.querySelector('.file-queue');
                const fileItems = fileQueue.querySelectorAll('.file-item');
                fileItems.forEach(item => {
                    const progressBar = document.createElement('div');
                    progressBar.className = 'upload-progress';
                    progressBar.innerHTML = '<div class="progress-bar"></div><span class="progress-text">准备上传...</span>';
                    item.appendChild(progressBar);
                });

                try {
                    // 创建FormData对象
                    const formData = new FormData();
                    pendingFiles.forEach(file => {
                        formData.append('files', file);
                    });

                    // 发送临时文件上传请求
                    const response = await fetch('/api/v1/pdf/upload-temp', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
                    }

                    const result = await response.json();
                    console.log('上传成功:', result);

                    // 将上传的文件信息存储到议程项中
                    const uploadedFilesContainer = agendaItem.querySelector('.uploaded-files-container') || createUploadedFilesContainer(agendaItem);
                    const uploadedFilesList = uploadedFilesContainer.querySelector('.uploaded-files-list');

                    // 添加上传的文件到列表中
                    result.uploaded_files.forEach(file => {
                        // 创建隐藏输入字段存储文件信息
                        const fileInfoInput = document.createElement('input');
                        fileInfoInput.type = 'hidden';
                        fileInfoInput.name = `agenda[${agendaItemIndex}][temp_files][]`;
                        fileInfoInput.value = JSON.stringify(file);
                        agendaItem.appendChild(fileInfoInput);

                        // 添加文件到可视化列表
                        const fileItem = document.createElement('li');
                        fileItem.className = 'uploaded-file-item';
                        fileItem.innerHTML = `
                            <div class="file-info">
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                            </div>
                            <div class="file-actions">
                                <a href="${file.url}" target="_blank" class="btn-view-file">查看</a>
                                <button type="button" class="btn-remove-uploaded-file" data-temp-id="${file.temp_id}">×</button>
                            </div>
                        `;
                        uploadedFilesList.appendChild(fileItem);

                        // 添加删除按钮事件
                        const removeBtn = fileItem.querySelector('.btn-remove-uploaded-file');
                        removeBtn.addEventListener('click', function() {
                            // 移除隐藏输入字段
                            const tempId = this.dataset.tempId;
                            const inputs = agendaItem.querySelectorAll(`input[name="agenda[${agendaItemIndex}][temp_files][]"]`);
                            inputs.forEach(input => {
                                const fileInfo = JSON.parse(input.value);
                                if (fileInfo.temp_id === tempId) {
                                    input.remove();
                                }
                            });

                            // 移除列表项
                            fileItem.remove();

                            // 如果没有文件了，隐藏容器
                            if (uploadedFilesList.children.length === 0) {
                                uploadedFilesContainer.style.display = 'none';
                            }
                        });
                    });

                    // 显示已上传文件容器
                    uploadedFilesContainer.style.display = 'block';

                    // 清空队列
                    pendingFiles.length = 0;
                    updateFileQueue();

                    // 显示成功消息
                    alert(`成功上传 ${result.uploaded_files.length} 个文件`);

                } catch (error) {
                    console.error('文件上传错误:', error);
                    alert(`文件上传失败: ${error.message}`);

                    // 移除进度条
                    fileItems.forEach(item => {
                        const progressBar = item.querySelector('.upload-progress');
                        if (progressBar) {
                            progressBar.remove();
                        }
                    });
                }
            });
        }


    }

    // 处理会议表单提交
    function handleMeetingFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const meetingId = formData.get('id');

        // 检查同一会议下是否有重复的议程项标题
        let agendaElements = form.querySelectorAll('.agenda-item');
        const titles = [];
        agendaElements.forEach(element => {
            const index = element.dataset.index;
            const title = element.querySelector(`input[name="agenda[${index}][title]"]`).value.trim();
            if (title) {
                titles.push(title);
            }
        });

        // 检查重复标题
        const duplicateTitles = titles.filter((title, index) => titles.indexOf(title) !== index);
        if (duplicateTitles.length > 0) {
            alert(`同一会议下存在重复的议程项标题: ${[...new Set(duplicateTitles)].join(', ')}`);
            return;
        }

        // 获取并禁用保存按钮
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="icon">⏳</span> 正在保存...';

        // 显示提示信息
        const saveStatusMessage = document.createElement('div');
        saveStatusMessage.className = 'save-status-message';
        saveStatusMessage.innerHTML = '正在保存会议并处理文件，请稍候...';
        saveStatusMessage.style.color = '#007bff';
        saveStatusMessage.style.marginTop = '10px';
        form.querySelector('.form-actions').appendChild(saveStatusMessage);

        // 收集会议基本信息
        const meetingData = {
            id: meetingId || generateUUID(), // 如果没有ID，生成一个新的UUID
            title: formData.get('title'),
            intro: formData.get('intro'),
            time: formData.get('time'),
            status: '未开始'
        };

        // 收集议程项信息
        agendaElements = form.querySelectorAll('.agenda-item');
        const agendaItems = [];

        agendaElements.forEach(element => {
            const index = element.dataset.index;
            const position = parseInt(index) + 1;
            const agendaItemTitle = element.querySelector(`input[name="agenda[${index}][title]"]`).value;

            // 收集已上传的临时文件信息
            const tempFileInputs = element.querySelectorAll(`input[name="agenda[${index}][temp_files][]"]`);
            const tempFiles = [];

            tempFileInputs.forEach(input => {
                try {
                    const fileInfo = JSON.parse(input.value);
                    tempFiles.push(fileInfo);
                } catch (e) {
                    console.error('解析文件信息失败:', e);
                }
            });

            // 收集已存在的文件信息
            const existingFileInputs = element.querySelectorAll(`input[name="agenda[${index}][existing_files][]"]`);
            const existingFiles = [];

            existingFileInputs.forEach(input => {
                try {
                    const fileInfo = JSON.parse(input.value);
                    existingFiles.push(fileInfo);
                } catch (e) {
                    console.error('解析已存在文件信息失败:', e);
                }
            });

            // 合并所有文件信息
            const allFiles = [...tempFiles, ...existingFiles];

            agendaItems.push({
                position: position, // 使用位置作为议程项的标识
                title: agendaItemTitle,
                files: allFiles, // 将所有文件信息传给后端
                pages: []
            });
        });

        // 将议程项添加到会议数据中
        if (meetingId) {
            // 更新会议时使用part字段
            meetingData.part = agendaItems;
        } else {
            // 创建会议时使用part字段
            meetingData.part = agendaItems;
        }

        console.log('Submitting meeting data:', meetingData);

        // 确定是创建还是更新
        const method = meetingId ? 'PUT' : 'POST';
        const url = meetingId ? `/api/v1/meetings/${meetingId}` : '/api/v1/meetings/';

        // 更新保存状态消息
        saveStatusMessage.innerHTML = '正在保存会议信息...';

        // 先保存会议基本信息
        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(savedMeeting => {
            console.log('Meeting saved successfully:', savedMeeting);
            saveStatusMessage.innerHTML = '会议信息已保存，正在处理文件...';

            // 保存成功后，处理文件上传
            const uploadPromises = [];

            // 遍历所有议程项，检查是否有文件需要上传
            savedMeeting.agenda_items.forEach((agendaItem, index) => {
                const agendaElement = agendaElements[index];
                if (!agendaElement) return; // 如果前端和后端的议程项数量不匹配，跳过

                const agendaIndex = agendaElement.dataset.index;
                const fileInput = agendaElement.querySelector(`#agendaFiles_${agendaIndex}`);

                if (fileInput && fileInput.files.length > 0) {
                    // 创建FormData对象用于文件上传
                    const fileFormData = new FormData();
                    for (let i = 0; i < fileInput.files.length; i++) {
                        fileFormData.append('files', fileInput.files[i]);
                    }

                    // 更新上传状态
                    saveStatusMessage.innerHTML = `正在上传议程项 "${agendaItem.title}" 的文件...`;

                    // 添加上传请求到promises数组
                    const uploadPromise = fetch(`/api/v1/meetings/${savedMeeting.id}/upload?position=${index+1}`, {
                        method: 'POST',
                        body: fileFormData
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`文件上传失败: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(result => {
                        console.log(`议程项 ${agendaItem.position} 的文件上传成功:`, result);
                        return result;
                    });

                    uploadPromises.push(uploadPromise);
                }
            });

            // 等待所有文件上传完成
            if (uploadPromises.length > 0) {
                saveStatusMessage.innerHTML = '所有文件正在处理中，这可能需要一些时间...';
                return Promise.all(uploadPromises).then(() => savedMeeting);
            }

            return savedMeeting;
        })
        .then(finalResult => {
            console.log('All operations completed successfully:', finalResult);
            saveStatusMessage.innerHTML = '<span style="color:green;">✓ 保存成功! 正在跳转...</span>';

            // 重置按钮状态，以防下次编辑时状态保留
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;

            // 延迟一秒后返回列表页面，使用户能看到保存成功的提示
            setTimeout(() => {
                // 再次确保按钮状态被重置
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                }

                // 返回列表视图并刷新会议列表
                returnToListView();
                fetchMeetings(); // 刷新会议列表
            }, 1000);
        })
        .catch(error => {
            console.error('Error during meeting save or file upload:', error);
            // 还原按钮状态，允许用户重试
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            saveStatusMessage.innerHTML = `<span style="color:red;">❌ 操作失败: ${error.message}</span>`;
            alert(`操作失败: ${error.message}`);

            // 3秒后自动移除错误消息
            setTimeout(() => {
                if (saveStatusMessage.parentNode) {
                    saveStatusMessage.remove();
                }
            }, 3000);
        });
    }

    // 生成UUID函数
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 显示已存在的文件
    function displayExistingFiles(files, agendaItemIndex) {
        if (!files || !files.length) return;

        console.log(`显示议程项 ${agendaItemIndex} 的已存在文件:`, files);

        // 获取议程项元素
        const agendaItem = document.querySelector(`.agenda-item[data-index="${agendaItemIndex}"]`);
        if (!agendaItem) {
            console.error(`找不到议程项元素: ${agendaItemIndex}`);
            return;
        }

        // 创建或获取已上传文件容器
        const uploadedFilesContainer = agendaItem.querySelector('.uploaded-files-container') || createUploadedFilesContainer(agendaItem);
        const uploadedFilesList = uploadedFilesContainer.querySelector('.uploaded-files-list');

        // 清空列表
        uploadedFilesList.innerHTML = '';

        // 添加文件到列表
        files.forEach(file => {
            try {
                // 如果文件是字符串，尝试解析为JSON
                let fileInfo = file;
                if (typeof file === 'string') {
                    try {
                        fileInfo = JSON.parse(file);
                    } catch (e) {
                        // 如果不是JSON，则创建一个简单的文件对象
                        fileInfo = {
                            name: file,
                            url: file,
                            size: 0
                        };
                    }
                }

                // 获取文件名和大小
                const fileName = fileInfo.name || '未命名文件';
                const fileSize = fileInfo.size ? (fileInfo.size / 1024).toFixed(2) + ' KB' : '未知大小';
                const fileUrl = fileInfo.url || '#';

                // 创建隐藏输入字段存储文件信息
                const fileInfoInput = document.createElement('input');
                fileInfoInput.type = 'hidden';
                fileInfoInput.name = `agenda[${agendaItemIndex}][existing_files][]`;
                fileInfoInput.value = JSON.stringify(fileInfo);
                agendaItem.appendChild(fileInfoInput);

                // 添加文件到可视化列表
                const fileItem = document.createElement('li');
                fileItem.className = 'uploaded-file-item';

                // 为文件项生成唯一ID，用于解绑操作
                // 如果文件来自文档管理页面，使用文件的实际ID
                const fileId = fileInfo.id || document.querySelectorAll('.uploaded-file-item').length;
                const filePath = fileInfo.path || '';

                fileItem.innerHTML = `
                    <div class="file-info">
                        <span class="file-name">${fileName}</span>
                        <span class="file-size">${fileSize}</span>
                    </div>
                    <div class="file-actions">
                        <a href="${fileUrl}" target="_blank" class="btn-view-file">查看</a>
                        <button type="button" class="btn-remove-uploaded-file"
                            data-file-url="${fileUrl}"
                            data-file-id="${fileId}"
                            data-file-path="${filePath}">×</button>
                    </div>
                `;
                uploadedFilesList.appendChild(fileItem);

                // 添加删除按钮事件
                const removeBtn = fileItem.querySelector('.btn-remove-uploaded-file');
                removeBtn.addEventListener('click', async function() {
                    // 获取文件信息
                    const fileUrl = this.dataset.fileUrl;
                    const fileId = this.dataset.fileId || '';
                    const filePath = this.dataset.filePath || '';

                    // 确认是否要删除文件
                    if (!confirm(`确定要从会议中移除此文件吗？文件将被解绑并移动到临时文件夹。`)) {
                        return;
                    }

                    try {
                        // 调用API解绑文件
                        if (fileId) {
                            const response = await fetch(`/api/v1/documents/${fileId}/unbind`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || errorData.detail || `解绑失败 (${response.status})`);
                            }

                            const result = await response.json();
                            console.log('文件解绑成功:', result);
                        }
                    } catch (error) {
                        console.error('文件解绑失败:', error);
                        alert(`文件解绑失败: ${error.message}`);
                    }

                    // 移除隐藏输入字段
                    const inputs = agendaItem.querySelectorAll(`input[name="agenda[${agendaItemIndex}][existing_files][]"]`);
                    inputs.forEach(input => {
                        try {
                            const info = JSON.parse(input.value);
                            if (info.url === fileUrl) {
                                input.remove();
                            }
                        } catch (e) {
                            console.error('解析文件信息失败:', e);
                        }
                    });

                    // 移除列表项
                    fileItem.remove();

                    // 如果没有文件了，隐藏容器
                    if (uploadedFilesList.children.length === 0) {
                        uploadedFilesContainer.style.display = 'none';
                    }
                });
            } catch (e) {
                console.error('处理文件信息时出错:', e, file);
            }
        });

        // 显示已上传文件容器
        uploadedFilesContainer.style.display = 'block';
    }

    // 创建已上传文件容器
    function createUploadedFilesContainer(agendaItem) {
        const container = document.createElement('div');
        container.className = 'uploaded-files-container';
        container.innerHTML = `
            <div class="uploaded-files-header">
                <h5>已上传文件</h5>
            </div>
            <ul class="uploaded-files-list"></ul>
        `;

        // 插入到文件上传区域之后
        const fileUploadContainer = agendaItem.querySelector('.file-upload-container');
        fileUploadContainer.parentNode.insertBefore(container, fileUploadContainer.nextSibling);

        return container;
    }

    // 查看会议详情
    async function openViewModal(meetingId) {
        const viewMeetingModal = document.getElementById('viewMeetingModal');
        const viewMeetingDetails = document.getElementById('viewMeetingDetails');

        // Show modal with loading state
        viewMeetingModal.style.display = 'block';
        viewMeetingDetails.innerHTML = '<p>加载中...</p>';

        try {
            const response = await fetch(`/api/v1/meetings/${meetingId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const meeting = await response.json();
            console.log('Fetched meeting for view:', meeting);

            // Format the meeting date and time
            let formattedTime = 'N/A';
            if (meeting.time) {
                try {
                    const date = new Date(meeting.time);
                    formattedTime = date.toLocaleString('zh-CN').replace('T', ' ');
                } catch (e) {
                    console.error('Error formatting time:', e);
                }
            }

            // Build the HTML for agenda items
            let agendaItemsHtml = '';
            if (meeting.agenda_items && meeting.agenda_items.length > 0) {
                agendaItemsHtml = '<h3>会议议程</h3><ul>';
                meeting.agenda_items.forEach((item) => {
                    let filesHtml = '';
                    if (item.files && item.files.length > 0) {
                        filesHtml = '<p><strong>相关文件:</strong></p><ul class="file-list">';
                        item.files.forEach(file => {
                            filesHtml += `<li><a href="${file.url}" target="_blank">${file.name}</a> (${(file.size / 1024).toFixed(2)} KB)</li>`;
                        });
                        filesHtml += '</ul>';
                    }

                    agendaItemsHtml += `
                        <li class="agenda-detail">
                            <h4>议程 ${item.position}: ${item.title || '无标题'}</h4>
                            ${filesHtml}
                        </li>
                    `;
                });
                agendaItemsHtml += '</ul>';
            } else {
                agendaItemsHtml = '<p><em>未设置议程项</em></p>';
            }

            // Populate the details view
            viewMeetingDetails.innerHTML = `
                <h3>${meeting.title || '未命名会议'}</h3>
                <p><strong>介绍:</strong> ${meeting.intro || '无介绍'}</p>
                <p><strong>时间:</strong> ${formattedTime}</p>
                <p><strong>状态:</strong> ${meeting.status || '未知'}</p>
                ${agendaItemsHtml}
            `;

        } catch (error) {
            console.error('Error fetching meeting details:', error);
            viewMeetingDetails.innerHTML = `<p style="color: var(--danger-color);">加载会议详情失败: ${error.message}</p>`;
        }
    }

    // 关闭查看会议详情模态框
    function closeViewModal() {
        const viewMeetingModal = document.getElementById('viewMeetingModal');
        viewMeetingModal.style.display = 'none';
    }

    // 更新总数计数
    function updatePaginationCount(count) {
        const totalCountSpan = document.querySelector('.total-count-container span');
        if (totalCountSpan) {
            totalCountSpan.textContent = `共 ${count} 条`;
        }
    }

    // 重置所有表单按钮状态
    function resetAllFormButtonStates() {
        console.log('重置所有表单按钮状态');

        // 重置会议表单的保存按钮
        const meetingForm = document.getElementById('meetingForm');
        if (meetingForm) {
            const submitButton = meetingForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<span class="icon">💾</span> 保存会议';
            }

            // 移除保存状态消息
            const saveStatusMessage = meetingForm.querySelector('.save-status-message');
            if (saveStatusMessage) {
                saveStatusMessage.remove();
            }
        }
    }

    // 检查登录状态
    function checkLoginStatus() {
        const currentUser = sessionStorage.getItem('currentUser');
        if (!currentUser) {
            // 未登录，重定向到登录页
            window.location.href = '/';
            return;
        }

        // 更新用户信息显示
        updateUserInfo(JSON.parse(currentUser));
    }

    // 更新顶部用户信息显示
    function updateUserInfo(userInfo) {
        const userInfoElem = document.querySelector('.user-info');
        if (userInfoElem) {
            // 添加用户名和退出按钮
            userInfoElem.innerHTML = `
                ${userInfo.username} (${userInfo.role === 'admin' ? '管理员' : '普通用户'})
                <a href="#" id="logoutBtn" style="margin-left: 10px; color: var(--primary-color); text-decoration: none;">退出</a>
            `;

            // 绑定退出按钮事件
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
        }
    }

    // 处理退出登录
    function handleLogout(e) {
        e.preventDefault();

        if (confirm('确定要退出登录吗？')) {
            // 清除登录信息
            sessionStorage.removeItem('currentUser');

            // 重定向到登录页
            window.location.href = '/';
        }
    }

    // 会议查询功能
    async function handleQueryMeetings() {
        const filterInputs = document.querySelectorAll('.filters input');
        const titleFilter = filterInputs[0].value.trim();
        const statusFilter = filterInputs[1].value.trim();

        // 显示查询条件提示
        let queryConditions = [];
        if (titleFilter) queryConditions.push(`会议名称: "${titleFilter}"`);
        if (statusFilter) queryConditions.push(`会议状态: "${statusFilter}"`);

        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';

        try {
            const response = await fetch('/api/v1/meetings/');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const meetings = await response.json();

            // 筛选会议
            const filteredMeetings = meetings.filter(meeting => {
                // 标题匹配 - 使用模糊匹配
                const matchTitle = !titleFilter || (meeting.title && meeting.title.toLowerCase().includes(titleFilter.toLowerCase()));

                // 状态匹配 - 使用更精确的匹配逻辑
                let matchStatus = false;
                if (!statusFilter) {
                    matchStatus = true; // 无筛选条件时匹配所有
                } else if (meeting.status) {
                    const statusLower = statusFilter.toLowerCase();
                    const meetingStatusLower = meeting.status.toLowerCase();

                    // 状态完全匹配
                    if (meetingStatusLower === statusLower) {
                        matchStatus = true;
                    }
                    // 针对常见状态的部分匹配
                    else if (meetingStatusLower === '未开始' && ('未开始'.includes(statusLower) || statusLower.includes('未') || statusLower.includes('开始'))) {
                        matchStatus = true;
                    }
                    else if (meetingStatusLower === '进行中' && ('进行中'.includes(statusLower) || statusLower.includes('进行') || statusLower.includes('中'))) {
                        matchStatus = true;
                    }
                    else if (meetingStatusLower === '已结束' && ('已结束'.includes(statusLower) || statusLower.includes('已') || statusLower.includes('结束'))) {
                        matchStatus = true;
                    }
                    // 兼容以前的逻辑 - 部分包含
                    else if (meetingStatusLower.includes(statusLower)) {
                        matchStatus = true;
                    }
                }

                return matchTitle && matchStatus;
            });

            let tableBodyHtml = '';

            // 添加查询条件提示行
            if (queryConditions.length > 0) {
                const queryMessage = `当前查询条件: ${queryConditions.join(', ')} (共 ${filteredMeetings.length} 条结果)`;
                tableBodyHtml += `<tr class="query-info"><td colspan="5" style="text-align: left; color: var(--text-color); padding: 5px 10px; font-size: 0.9em; background-color: #f5f5f5;">${queryMessage}</td></tr>`;
            }

            if (filteredMeetings.length === 0) {
                tableBodyHtml += '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">没有匹配的会议</td></tr>';
            } else {
                filteredMeetings.forEach(meeting => {
                    tableBodyHtml += `
                        <tr data-id="${meeting.id}">
                            <td>${meeting.title || '-'}</td>
                            <td>${meeting.intro || '-'}</td>
                            <td>${meeting.time ? meeting.time.replace('T', ' ') : '-'}</td>
                            <td>${renderStatus(meeting.status)}</td>
                            <td>${renderActionButtons(meeting)}</td>
                        </tr>
                    `;
                });
            }

            tableBody.innerHTML = tableBodyHtml;

            // 更新计数
            updatePaginationCount(filteredMeetings.length);

            // 附加操作按钮事件
            attachActionListeners(tableBody);

        } catch (error) {
            console.error('Failed to query meetings:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">查询会议失败: ${error.message}</td></tr>`;
        }
    }

    // 重置查询条件
    function handleResetQuery() {
        const filterInputs = document.querySelectorAll('.filters input');
        filterInputs.forEach(input => {
            input.value = '';
        });

        // 重新加载所有会议
        fetchMeetings();
    }
});