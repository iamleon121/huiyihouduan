/**
 * event-handlers.js
 * Handles UI events such as button clicks and form submissions.
 */
import { fetchMeetings } from './data-loader.js';
import { openModal, openViewModal } from '../views/modal-manager.js';
import { showConfirm, showSuccess, showError, showInfo } from '../utils/notifications.js';

// Cache for meeting data
let meetingsCache = [];

/**
 * Attaches event listeners to action buttons in the meeting table
 */
export function attachActionListeners() {
    console.log('Attaching meeting action listeners...');
    
    // Get all view buttons
    const viewButtons = document.querySelectorAll('.btn-action.view');
    viewButtons.forEach(button => {
        button.addEventListener('click', handleViewMeeting);
    });
    
    // Get all edit buttons
    const editButtons = document.querySelectorAll('.btn-action.edit:not(.disabled)');
    editButtons.forEach(button => {
        button.addEventListener('click', handleEditMeeting);
    });
    
    // Get all delete buttons
    const deleteButtons = document.querySelectorAll('.btn-action.delete:not(.disabled)');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteMeeting);
    });
    
    // Get all start buttons
    const startButtons = document.querySelectorAll('.btn-action.start');
    startButtons.forEach(button => {
        button.addEventListener('click', handleStartMeeting);
    });
}

/**
 * Attaches event listener to the new meeting button
 */
export function attachNewMeetingListener() {
    console.log('Attaching new meeting button listener...');
    
    const newMeetingButton = document.getElementById('btn-new-meeting');
    if (newMeetingButton) {
        newMeetingButton.addEventListener('click', () => {
            openModal('create');
        });
    }
}

/**
 * Attaches event listeners for search and filters
 */
export function attachSearchAndFilterListeners() {
    console.log('Attaching search and filter listeners...');
    
    // Search input
    const searchInput = document.getElementById('meeting-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Status filters
    const statusFilters = document.querySelectorAll('.status-filter');
    statusFilters.forEach(filter => {
        filter.addEventListener('click', handleStatusFilter);
    });
}

/**
 * Attaches event listeners for room actions
 */
export function attachRoomActionListeners() {
    console.log('Attaching room action listeners...');
    
    // View room details
    const viewButtons = document.querySelectorAll('.room-btn-view');
    viewButtons.forEach(button => {
        button.addEventListener('click', handleViewRoom);
    });
    
    // Edit room
    const editButtons = document.querySelectorAll('.room-btn-edit');
    editButtons.forEach(button => {
        button.addEventListener('click', handleEditRoom);
    });
    
    // Delete room
    const deleteButtons = document.querySelectorAll('.room-btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteRoom);
    });
}

/**
 * Attaches event listeners for user actions
 */
export function attachUserActionListeners() {
    console.log('Attaching user action listeners...');
    
    // View user details
    const viewButtons = document.querySelectorAll('.user-btn-view');
    viewButtons.forEach(button => {
        button.addEventListener('click', handleViewUser);
    });
    
    // Edit user
    const editButtons = document.querySelectorAll('.user-btn-edit');
    editButtons.forEach(button => {
        button.addEventListener('click', handleEditUser);
    });
    
    // Delete user
    const deleteButtons = document.querySelectorAll('.user-btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteUser);
    });
}

/**
 * Updates the meetings cache with new data
 * @param {Array} meetings - The new meetings data
 */
export function updateMeetingsCache(meetings) {
    meetingsCache = meetings;
}

/**
 * Handles clicking the view button for a meeting
 * @param {Event} event - The click event
 */
async function handleViewMeeting(event) {
    const meetingId = event.target.dataset.id;
    console.log(`View meeting requested for ID: ${meetingId}`);
    
    // First try to find the meeting in the cache
    let meeting = meetingsCache.find(m => m.id.toString() === meetingId);
    
    if (!meeting) {
        // If not in cache, fetch it from the server
        try {
            const response = await fetch(`/api/meetings/${meetingId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const apiMeeting = await response.json();
            
            // 转换API返回的数据格式以匹配前端期望的格式
            meeting = {
                id: apiMeeting.id,
                name: apiMeeting.title,
                date: apiMeeting.time ? apiMeeting.time.split(' ')[0] : '',
                start_time: apiMeeting.time ? apiMeeting.time.split(' ')[1] : '',
                end_time: apiMeeting.time ? apiMeeting.time.split(' ')[1] : '',
                room_id: 1,
                room_name: '默认会议室',
                status: apiMeeting.status || '未开始',
                description: apiMeeting.intro || ''
            };
        } catch (error) {
            console.error('Error fetching meeting details:', error);
            showError('无法加载会议详情');
            return;
        }
    }
    
    // Open the view modal with the meeting data
    openViewModal(meeting);
}

/**
 * Handles clicking the edit button for a meeting
 * @param {Event} event - The click event
 */
async function handleEditMeeting(event) {
    const meetingId = event.target.dataset.id;
    console.log(`Edit meeting requested for ID: ${meetingId}`);
    
    // First try to find the meeting in the cache
    let meeting = meetingsCache.find(m => m.id.toString() === meetingId);
    
    if (!meeting) {
        // If not in cache, fetch it from the server
        try {
            const response = await fetch(`/api/meetings/${meetingId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const apiMeeting = await response.json();
            
            // 转换API返回的数据格式以匹配前端期望的格式
            meeting = {
                id: apiMeeting.id,
                name: apiMeeting.title,
                date: apiMeeting.time ? apiMeeting.time.split(' ')[0] : '',
                start_time: apiMeeting.time ? apiMeeting.time.split(' ')[1] : '',
                end_time: apiMeeting.time ? apiMeeting.time.split(' ')[1] : '',
                room_id: 1,
                room_name: '默认会议室',
                status: apiMeeting.status || '未开始',
                description: apiMeeting.intro || ''
            };
        } catch (error) {
            console.error('Error fetching meeting details for edit:', error);
            showError('无法加载会议详情进行编辑');
            return;
        }
    }
    
    // Open the edit modal with the meeting data
    openModal('edit', meeting);
}

/**
 * Handles clicking the delete button for a meeting
 * @param {Event} event - The click event
 */
async function handleDeleteMeeting(event) {
    const meetingId = event.target.dataset.id;
    console.log(`Delete meeting requested for ID: ${meetingId}`);
    
    // Confirm before deleting
    const confirmed = await showConfirm('确定要删除此会议吗？此操作无法撤销。');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/meetings/${meetingId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Show success message
        showSuccess('会议已成功删除');
        
        // Refresh the meeting list
        fetchMeetings();
    } catch (error) {
        console.error('Error deleting meeting:', error);
        showError(`删除会议失败: ${error.message}`);
    }
}

/**
 * Handles clicking the start button for a meeting
 * @param {Event} event - The click event
 */
async function handleStartMeeting(event) {
    const meetingId = event.target.dataset.id;
    console.log(`Start meeting requested for ID: ${meetingId}`);
    
    try {
        // 使用API更新会议状态为"进行中"
        const response = await fetch(`/api/meetings/${meetingId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: '进行中' })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Show success message
        showSuccess('会议已开始');
        
        // Refresh the meeting list
        fetchMeetings();
    } catch (error) {
        console.error('Error starting meeting:', error);
        showError(`开始会议失败: ${error.message}`);
    }
}

/**
 * Handles searching meetings
 * @param {Event} event - The input event
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log(`Searching for: ${searchTerm}`);
    
    // Get all meeting rows
    const tableRows = document.querySelectorAll('#meeting-table tbody tr');
    
    // If no rows or just a loading/empty message row, exit
    if (!tableRows.length || (tableRows.length === 1 && tableRows[0].cells.length === 1)) {
        return;
    }
    
    // Filter rows based on search term
    tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Handles clicking on status filter buttons
 * @param {Event} event - The click event
 */
function handleStatusFilter(event) {
    const statusFilter = event.target.closest('.status-filter');
    const status = statusFilter.dataset.status;
    console.log(`Filter by status: ${status}`);
    
    // Update active filter
    document.querySelectorAll('.status-filter').forEach(filter => {
        filter.classList.remove('active');
    });
    statusFilter.classList.add('active');
    
    // Get all meeting rows
    const tableRows = document.querySelectorAll('#meeting-table tbody tr');
    
    // If no rows or just a loading/empty message row, exit
    if (!tableRows.length || (tableRows.length === 1 && tableRows[0].cells.length === 1)) {
        return;
    }
    
    // Show all rows if "all" filter is selected
    if (status === 'all') {
        tableRows.forEach(row => {
            row.style.display = '';
        });
        return;
    }
    
    // Filter rows based on status
    tableRows.forEach(row => {
        // Status is typically in the 6th column (index 5)
        const statusCell = row.cells[5];
        if (statusCell && statusCell.textContent.includes(status)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Handles clicking the view button for a room
 * @param {Event} event - The click event
 */
function handleViewRoom(event) {
    const roomId = event.target.dataset.id;
    console.log(`View room requested for ID: ${roomId}`);
    
    // TODO: Implement room view functionality
    showInfo(`查看会议室信息 (ID: ${roomId}) - 此功能尚未实现`);
}

/**
 * Handles clicking the edit button for a room
 * @param {Event} event - The click event
 */
function handleEditRoom(event) {
    const roomId = event.target.dataset.id;
    console.log(`Edit room requested for ID: ${roomId}`);
    
    // TODO: Implement room edit functionality
    showInfo(`编辑会议室 (ID: ${roomId}) - 此功能尚未实现`);
}

/**
 * Handles clicking the delete button for a room
 * @param {Event} event - The click event
 */
async function handleDeleteRoom(event) {
    const roomId = event.target.dataset.id;
    console.log(`Delete room requested for ID: ${roomId}`);
    
    // TODO: Implement room delete functionality
    showInfo(`删除会议室 (ID: ${roomId}) - 此功能尚未实现`);
}

/**
 * Handles clicking the view button for a user
 * @param {Event} event - The click event
 */
function handleViewUser(event) {
    const userId = event.target.dataset.id;
    console.log(`View user requested for ID: ${userId}`);
    
    // TODO: Implement user view functionality
    showInfo(`查看用户信息 (ID: ${userId}) - 此功能尚未实现`);
}

/**
 * Handles clicking the edit button for a user
 * @param {Event} event - The click event
 */
function handleEditUser(event) {
    const userId = event.target.dataset.id;
    console.log(`Edit user requested for ID: ${userId}`);
    
    // TODO: Implement user edit functionality
    showInfo(`编辑用户 (ID: ${userId}) - 此功能尚未实现`);
}

/**
 * Handles clicking the delete button for a user
 * @param {Event} event - The click event
 */
async function handleDeleteUser(event) {
    const userId = event.target.dataset.id;
    console.log(`Delete user requested for ID: ${userId}`);
    
    // TODO: Implement user delete functionality
    showInfo(`删除用户 (ID: ${userId}) - 此功能尚未实现`);
}
