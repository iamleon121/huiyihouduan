document.addEventListener('DOMContentLoaded', () => {
    // 获取当前页面的文件名
    const currentPath = window.location.pathname.split('/').pop();
    
    // 设置导航栏的活动项
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const contentArea = document.querySelector('.content-area');

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
        buttons += `<button class="btn-action view" data-id="${meeting.id}">查看</button> `;
        if (!isOngoing && !isFinished) { // Can edit only if not started or finished
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
         console.log("attachActionListeners called, but body is commented out for debugging."); // Keep body commented
         /* --- Temporarily comment out the entire body for debugging ---
        // Start Button Listener
        container.querySelectorAll('.btn-action.start:not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached'); // Mark as attached
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;

                if (window.confirm(`确定要开始会议 "${meetingName}" 吗？此操作将同步文件并更新状态。`)) {
                    console.log(`开始会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/meetings/${meetingId}/status`, {
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

        // Delete Button Listener
        container.querySelectorAll('.btn-action.delete:not(.disabled):not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached');
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;
                if (window.confirm(`确定要删除会议 "${meetingName}" 吗？`)) {
                    console.log(`删除会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
                    .then(response => {
                        if (!response.ok && response.status !== 204) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        console.log('Meeting deleted successfully');
                        row.remove();
                        // Update total count (simple approach)
                        const paginationSpan = document.querySelector('.pagination-container span');
                        const currentCount = document.querySelectorAll('.data-table tbody tr').length;
                        if (paginationSpan) paginationSpan.textContent = `共 ${currentCount} 条`;

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
             button.addEventListener('click', async (e) => { // Make async
                 const meetingId = e.target.dataset.id;
                 console.log(`Attempting to view meeting ID: ${meetingId}`);
                 openViewModal(meetingId); // Call function to open and populate view modal
             });
        });

         // Edit Button Listener
         container.querySelectorAll('.btn-action.edit:not(.disabled):not(.listener-attached)').forEach(button => {
             button.classList.add('listener-attached');
             button.addEventListener('click', async (e) => { // Make async
                 const meetingId = e.target.dataset.id;
                 console.log(`Attempting to edit meeting ID: ${meetingId}`);
                 try {
                     const response = await fetch(`/api/meetings/${meetingId}`);
                     if (!response.ok) {
                         throw new Error(`HTTP error! status: ${response.status}`);
                     }
                     const meetingData = await response.json();
                     console.log('Fetched meeting data for edit:', meetingData);
                     openModal(meetingData); // Open modal with fetched data
                 } catch (error) {
                     console.error('Error fetching meeting details for edit:', error);
                     alert(`加载会议详情失败: ${error.message}`);
                 }
             });
         });

         // Add Meeting Button Listener - Attach only once (logic moved to loadContent)
         /* This listener is now attached within loadContent after the button is rendered
         const addMeetingButton = document.getElementById('add-meeting-btn');
         if (addMeetingButton && !addMeetingButton.classList.contains('listener-attached')) {
             addMeetingButton.classList.add('listener-attached');
             addMeetingButton.addEventListener('click', () => {
                 alert('新增会议功能待实现');
             });
         }
         */ // End of attachActionListeners body comment
    }

    // --- Main function to load content based on link ---
    async function loadContent(link) {
        if (!link) return;

        navLinks.forEach(el => el.classList.remove('active'));
        link.classList.add('active');

        const pageTitle = link.querySelector('span').textContent;
        const pageId = link.getAttribute('href');

        contentArea.innerHTML = `<h1>${pageTitle}</h1><p>加载中...</p>`; // Show loading state

        if (pageId === '?id=1') { // 会议管理
            try {
                const response = await fetch('/api/meetings/');
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
                                <td>${meeting.time || '-'}</td>
                                <td>${renderStatus(meeting.status)}</td>
                                <td>${renderActionButtons(meeting)}</td>
                            </tr>
                        `;
                    });
                }

                const meetingListHtml = `
                    <h1>会议管理</h1>
                    <div class="controls-bar">
                         <div class="filters">
                             <input type="text" placeholder="会议名称">
                             <input type="text" placeholder="会议状态">
                             <button class="btn btn-secondary">查询</button>
                             <button class="btn btn-outline">重置</button>
                         </div>
                         <button class="btn btn-primary" id="add-meeting-btn">新增会议</button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>会议名称</th>
                                    <th>会议介绍</th>
                                    <th>会议时间</th>
                                    <th>会议状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableBodyHtml}
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination-container">
                        <span>共 ${meetings.length} 条</span>
                        <select>
                            <option>10 条/页</option>
                            <option>20 条/页</option>
                        </select>
                        <button disabled><</button> <!-- Changed < to < -->
                        <span>1</span>
                        <button>></button> <!-- Changed > to > -->
                    </div>
                `;
                contentArea.innerHTML = meetingListHtml;

                // Attach listeners to the newly added content
                attachActionListeners(contentArea);

                // Attach listener for the Add Meeting button specifically after it's rendered
                const renderedAddButton = contentArea.querySelector('#add-meeting-btn');
                if (renderedAddButton) {
                    // Ensure listener isn't attached multiple times if content reloads
                    if (!renderedAddButton.hasAttribute('data-listener-attached')) {
                        renderedAddButton.setAttribute('data-listener-attached', 'true');
                        renderedAddButton.onclick = () => openModal(); // Open modal for new meeting
                    }
                }

            } catch (error) {
                 console.error('Failed to load meetings:', error);
                 contentArea.innerHTML = `<h1>${pageTitle}</h1><p style="color: var(--danger-color);">加载会议列表失败: ${error.message}</p>`;
            }
        } else { // 其他菜单项
            // Temporarily comment out the innerHTML assignment to isolate the error
            // contentArea.innerHTML = `<h1>${pageTitle}</h1><p>这里是 ${pageTitle} 的内容。</p>`;
            console.log(`Rendering content for: ${pageTitle}`); // Log instead
            // Temporarily comment out the innerHTML assignment to isolate the error // Restored original logic
            contentArea.innerHTML = `<h1>${pageTitle}</h1><p>这里是 ${pageTitle} 的内容。</p>`; // Restored
        } // Restored
    }

    // 根据当前页面初始化相应功能
    
    // 会议管理页面
    if (currentPath === 'huiyi-meeting.html' || currentPath === '') {
        initMeetingPage();
    }
    
    // 文件管理页面
    else if (currentPath === 'huiyi-document.html') {
        initDocumentPage();
    }
    
    // 系统管理页面
    else if (currentPath === 'huiyi-system.html') {
        initSystemPage();
    }
    
    // 会议管理页面初始化
    function initMeetingPage() {
        fetchMeetings();
        
        // 添加会议按钮事件绑定
        const addMeetingBtn = document.getElementById('add-meeting-btn');
        if (addMeetingBtn) {
            addMeetingBtn.addEventListener('click', () => openModal());
        }
        
        // 模态框关闭按钮事件绑定
        const closeModalBtn = document.querySelector('#meetingModal .close');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        if (cancelModalBtn) {
            cancelModalBtn.addEventListener('click', closeModal);
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
    }
    
    // 文件管理页面初始化
    function initDocumentPage() {
        fetchFiles();
        
        // 上传文件按钮事件绑定
        const addFileBtn = document.getElementById('add-file-btn');
        if (addFileBtn) {
            addFileBtn.addEventListener('click', openFileModal);
        }
        
        // 文件模态框关闭按钮事件绑定
        const closeFileBtn = document.querySelector('#fileModal .close');
        const cancelFileBtn = document.getElementById('cancelFileBtn');
        
        if (closeFileBtn) {
            closeFileBtn.addEventListener('click', closeFileModal);
        }
        
        if (cancelFileBtn) {
            cancelFileBtn.addEventListener('click', closeFileModal);
        }
        
        // 文件表单提交事件绑定
        const fileForm = document.getElementById('fileForm');
        if (fileForm) {
            fileForm.addEventListener('submit', handleFileFormSubmit);
        }
    }
    
    // 系统管理页面初始化
    function initSystemPage() {
        fetchUsers();
        
        // 新增用户按钮事件绑定
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', openUserModal);
        }
        
        // 用户模态框关闭按钮事件绑定
        const closeUserBtn = document.querySelector('#userModal .close');
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        
        if (closeUserBtn) {
            closeUserBtn.addEventListener('click', closeUserModal);
        }
        
        if (cancelUserBtn) {
            cancelUserBtn.addEventListener('click', closeUserModal);
        }
        
        // 用户表单提交事件绑定
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', handleUserFormSubmit);
        }
        
        // 系统设置表单提交事件绑定
        const systemSettingsForm = document.getElementById('systemSettingsForm');
        if (systemSettingsForm) {
            systemSettingsForm.addEventListener('submit', handleSystemSettingsSubmit);
        }
        
        // 主题选项点击事件绑定
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', handleThemeSelection);
        });
    }

    // 会议管理页面函数
    async function fetchMeetings() {
        const contentArea = document.querySelector('.content-area');
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';
        
        try {
            const response = await fetch('/api/meetings/');
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
                            <td>${meeting.time || '-'}</td>
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

    // 文件相关函数
    function fetchFiles() {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;
        
        // 模拟文件数据
        setTimeout(() => {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无文件数据</td></tr>';
            
            // 更新计数
            updatePaginationCount(0);
        }, 500);
    }
    
    function openFileModal() {
        const fileModal = document.getElementById('fileModal');
        if (fileModal) {
            fileModal.style.display = 'block';
        }
    }
    
    function closeFileModal() {
        const fileModal = document.getElementById('fileModal');
        if (fileModal) {
            fileModal.style.display = 'none';
        }
    }
    
    function handleFileFormSubmit(event) {
        event.preventDefault();
        // 模拟文件上传
        alert('文件上传功能待实现');
        closeFileModal();
    }
    
    // 系统管理相关函数
    function fetchUsers() {
        const tableBody = document.querySelector('.system-section:first-child .data-table tbody');
        if (!tableBody) return;
        
        // 模拟用户数据
        setTimeout(() => {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
        }, 500);
    }
    
    function openUserModal() {
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.style.display = 'block';
        }
    }
    
    function closeUserModal() {
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.style.display = 'none';
        }
    }
    
    function handleUserFormSubmit(event) {
        event.preventDefault();
        // 模拟用户保存
        alert('用户保存功能待实现');
        closeUserModal();
    }
    
    function handleSystemSettingsSubmit(event) {
        event.preventDefault();
        // 模拟设置保存
        alert('系统设置保存功能待实现');
    }
    
    function handleThemeSelection() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        this.classList.add('active');
    }
    
    // 通用函数
    function updatePaginationCount(count) {
        const paginationSpan = document.querySelector('.pagination-container span');
        if (paginationSpan) {
            paginationSpan.textContent = `共 ${count} 条`;
        }
    }

    // --- View Modal Logic ---
    const viewMeetingModal = document.getElementById('viewMeetingModal');
    const closeViewModalBtn = document.getElementById('closeViewModalBtn');
    const viewMeetingDetailsContainer = document.getElementById('viewMeetingDetails');
    const closeViewModalX = viewMeetingModal.querySelector('.close'); // Get the 'X' button

    async function openViewModal(meetingId) {
        viewMeetingDetailsContainer.innerHTML = '<p>加载中...</p>'; // Show loading
        viewMeetingModal.style.display = 'block';

        try {
            const response = await fetch(`/api/meetings/${meetingId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const meetingData = await response.json();
            console.log('Fetched meeting data for view:', meetingData);

            // Format date/time nicely for display
            let formattedTime = '未设置';
            if (meetingData.time) {
                try {
                    formattedTime = new Date(meetingData.time).toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' });
                } catch (e) {
                    console.error("Error formatting view time:", e);
                    formattedTime = meetingData.time; // Show raw if formatting fails
                }
            }

            let detailsHtml = `
                <p><strong>会议名称:</strong> ${meetingData.title || '-'}</p>
                <p><strong>会议介绍:</strong> ${meetingData.intro || '-'}</p>
                <p><strong>会议时间:</strong> ${formattedTime}</p>
                <p><strong>会议状态:</strong> ${renderStatus(meetingData.status)}</p>
                <p><strong>会议 ID:</strong> ${meetingData.id}</p>
                <h3>议程项 (${meetingData.agenda_items?.length || 0})</h3>
            `;

            if (meetingData.agenda_items && meetingData.agenda_items.length > 0) {
                detailsHtml += '<ul>';
                meetingData.agenda_items.forEach((item, index) => {
                    detailsHtml += `
                        <li>
                            <h4>议程 ${index + 1}: ${item.title || '无标题'}</h4>
                            <div class="agenda-detail"><strong>报告人:</strong> ${item.reporter || '-'}</div>
                            <div class="agenda-detail"><strong>预计时间:</strong> ${item.duration_minutes ? item.duration_minutes + ' 分钟' : '-'}</div>
                            <div class="agenda-detail"><strong>关联文件:</strong> <span class="json-data">${JSON.stringify(item.files || [])}</span></div>
                            <div class="agenda-detail"><strong>关联页码:</strong> <span class="json-data">${JSON.stringify(item.pages || [])}</span></div>
                            <div class="agenda-detail"><strong>议程 ID:</strong> ${item.id}</div>
                        </li>
                    `;
                });
                detailsHtml += '</ul>';
            } else {
                detailsHtml += '<p>无议程项。</p>';
            }

            viewMeetingDetailsContainer.innerHTML = detailsHtml;

        } catch (error) {
            console.error('Error fetching meeting details for view:', error);
            viewMeetingDetailsContainer.innerHTML = `<p style="color: var(--danger-color);">加载会议详情失败: ${error.message}</p>`;
        }
    }

    function closeViewModal() {
        viewMeetingModal.style.display = 'none';
    }

    // Add listeners for closing the view modal
    if (closeViewModalBtn) {
        closeViewModalBtn.onclick = closeViewModal;
    }
    if (closeViewModalX) {
        closeViewModalX.onclick = closeViewModal;
    }
     // Also close if clicking outside the view modal content
     window.addEventListener('click', function(event) {
         if (event.target == viewMeetingModal) {
             closeViewModal();
         }
     });

    // --- Modal Logic ---
    const meetingModal = document.getElementById('meetingModal');
    const closeModalBtn = meetingModal.querySelector('.close');
    const cancelModalBtn = document.getElementById('cancelModalBtn'); // Added cancel button
    const meetingForm = document.getElementById('meetingForm');
    const agendaItemsContainer = document.getElementById('agendaItemsContainer');
    const addAgendaItemBtn = document.getElementById('addAgendaItemBtn');
    const modalTitle = document.getElementById('modalTitle');
    const meetingIdInput = document.getElementById('meetingId'); // For storing ID during edit

    // Function to open the modal
    function openModal(meetingData = null) {
        meetingForm.reset(); // Clear previous data
        agendaItemsContainer.innerHTML = ''; // Clear previous agenda items
        meetingIdInput.value = ''; // Clear ID

        if (meetingData) {
            // Populate form for editing
            modalTitle.textContent = '编辑会议';
            meetingIdInput.value = meetingData.id;
            document.getElementById('meetingTitle').value = meetingData.title || '';
            document.getElementById('meetingIntro').value = meetingData.intro || '';
            // Format datetime-local (requires YYYY-MM-DDTHH:mm)
            if (meetingData.time) {
                 // Assuming meetingData.time is in a format JS can parse (like ISO 8601)
                 // Or adjust based on the actual format from the API
                 try {
                    const date = new Date(meetingData.time);
                    // Pad month, day, hours, minutes with leading zeros if necessary
                    const pad = (num) => num.toString().padStart(2, '0');
                    const formattedDateTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                    document.getElementById('meetingTime').value = formattedDateTime;
                 } catch (e) {
                     console.error("Error parsing meeting time:", meetingData.time, e);
                     document.getElementById('meetingTime').value = ''; // Clear if invalid
                 }
            } else {
                 document.getElementById('meetingTime').value = '';
            }


            // Populate agenda items
            if (meetingData.agenda_items && meetingData.agenda_items.length > 0) {
                meetingData.agenda_items.forEach((item, index) => addAgendaItem(item, index));
            }
        } else {
            // Setup for new meeting
            modalTitle.textContent = '新增会议';
            addAgendaItem(); // Add one empty agenda item by default for new meetings
        }
        meetingModal.style.display = 'block';
    }

    // Function to close the modal
    function closeModal() {
        meetingModal.style.display = 'none';
    }

    // Function to add an agenda item section to the form
    function addAgendaItem(itemData = null, index = null) {
        const itemIndex = (index !== null) ? index : agendaItemsContainer.children.length;
        const newItemHtml = `
            <div class="agenda-item" data-index="${itemIndex}">
                <h4>议程 ${itemIndex + 1}</h4>
                <input type="hidden" name="agenda[${itemIndex}][id]" value="${itemData?.id || ''}" /> <!-- For editing existing items -->

                <label for="agendaTitle_${itemIndex}">标题:</label>
                <input type="text" id="agendaTitle_${itemIndex}" name="agenda[${itemIndex}][title]" value="${itemData?.title || ''}" required />

                <label for="agendaReporter_${itemIndex}">报告人:</label>
                <input type="text" id="agendaReporter_${itemIndex}" name="agenda[${itemIndex}][reporter]" value="${itemData?.reporter || ''}" />

                <label for="agendaTime_${itemIndex}">预计时间 (分钟):</label>
                <input type="number" id="agendaTime_${itemIndex}" name="agenda[${itemIndex}][duration_minutes]" value="${itemData?.duration_minutes || ''}" />

                <!-- TODO: Add file/page selection logic here if needed -->
                <label for="agendaFiles_${itemIndex}">关联文件 (JSON):</label>
                <input type="text" id="agendaFiles_${itemIndex}" name="agenda[${itemIndex}][files]" value="${JSON.stringify(itemData?.files || [])}" />

                <label for="agendaPages_${itemIndex}">关联页码 (JSON):</label>
                <input type="text" id="agendaPages_${itemIndex}" name="agenda[${itemIndex}][pages]" value="${JSON.stringify(itemData?.pages || [])}" />


                <button type="button" class="removeAgendaItemBtn btn btn-danger">删除此议程</button>
            </div>
        `;
        agendaItemsContainer.insertAdjacentHTML('beforeend', newItemHtml);
    }


    // Event Listeners for Modal
    if (closeModalBtn) {
        closeModalBtn.onclick = closeModal;
    }
    if (cancelModalBtn) { // Added
        cancelModalBtn.onclick = closeModal;
    }

    // Close modal if clicked outside the content area
    window.onclick = function(event) {
        if (event.target == meetingModal) {
            closeModal();
        }
    }

    // Add Agenda Item Button
    if (addAgendaItemBtn) {
        addAgendaItemBtn.onclick = () => addAgendaItem(); // Call the function without args for new item
    }

     // Remove Agenda Item Button (using event delegation)
     agendaItemsContainer.addEventListener('click', function(event) {
         if (event.target.classList.contains('removeAgendaItemBtn')) {
             event.target.closest('.agenda-item').remove();
             // Re-index remaining items visually (optional, depends on how backend handles indices)
             agendaItemsContainer.querySelectorAll('.agenda-item').forEach((item, newIndex) => {
                 item.querySelector('h4').textContent = `议程 ${newIndex + 1}`;
                 // Update input names/ids if necessary, though backend might handle gaps
             });
         }
     });


    // Handle Form Submission
    meetingForm.onsubmit = async function(event) {
        event.preventDefault();
        const formData = new FormData(meetingForm);
        const meetingId = formData.get('id');
        const meetingData = {
            title: formData.get('title'),
            intro: formData.get('intro'),
            time: formData.get('time') ? new Date(formData.get('time')).toISOString() : null, // Convert to ISO string for backend
            agenda_items: []
        };

        // Collect agenda items
        const agendaItemElements = agendaItemsContainer.querySelectorAll('.agenda-item');
        agendaItemElements.forEach((itemElement, index) => {
            // Use a consistent way to get the index, maybe from data-attribute if re-indexing is complex
            const itemIndex = itemElement.dataset.index; // Or just use loop index if names are updated
            const agendaItem = {
                // Include ID only if it exists (for updates)
                id: formData.get(`agenda[${itemIndex}][id]`) || undefined,
                title: formData.get(`agenda[${itemIndex}][title]`),
                reporter: formData.get(`agenda[${itemIndex}][reporter]`),
                duration_minutes: parseInt(formData.get(`agenda[${itemIndex}][duration_minutes]`), 10) || null,
                // Parse JSON strings back into arrays/objects
                files: JSON.parse(formData.get(`agenda[${itemIndex}][files]`) || '[]'),
                pages: JSON.parse(formData.get(`agenda[${itemIndex}][pages]`) || '[]')
            };
             // Only add valid items (e.g., with a title)
             if (agendaItem.title) {
                 meetingData.agenda_items.push(agendaItem);
             }
        });

        const apiUrl = meetingId ? `/api/meetings/${meetingId}` : '/api/meetings/';
        const method = meetingId ? 'PUT' : 'POST';

        console.log('Submitting meeting data:', JSON.stringify(meetingData, null, 2)); // Log data being sent

        try {
            const response = await fetch(apiUrl, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(meetingData)
            });

            if (!response.ok) {
                const errorData = await response.json(); // Try to get error details
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.detail || response.statusText}`);
            }

            const result = await response.json();
            console.log('Meeting saved successfully:', result);
            closeModal();
            // Refresh the meeting list - find the currently active link and reload its content
            const activeLink = document.querySelector('.sidebar-nav a.active');
            if (activeLink) {
                await loadContent(activeLink); // Reload content
            } else {
                await loadContent(document.querySelector('.sidebar-nav a[href="?id=1"]')); // Fallback
            }
            alert(`会议 "${result.title}" 已成功${meetingId ? '更新' : '创建'}！`);

        } catch (error) {
            console.error('Error saving meeting:', error);
            alert(`保存会议失败: ${error.message}`);
        }
    }

    // ... (Keep Modal Logic and View Modal Logic as they were) ...

}); // End of DOMContentLoaded

