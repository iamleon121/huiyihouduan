/**
 * modal-manager.js
 * Manages modal dialogs for creating, editing, and viewing meetings.
 */
import { fetchMeetings } from '../controllers/data-loader.js';
import { showSuccess, showError } from '../utils/notifications.js';

// Modal state
let currentModalMode = 'create'; // 'create', 'edit', or 'view'
let currentMeetingData = null;

// DOM elements
const meetingModalOverlay = document.createElement('div');
meetingModalOverlay.className = 'modal-overlay';

const viewModalOverlay = document.createElement('div');
viewModalOverlay.className = 'modal-overlay';

/**
 * Creates the meeting modal structure if it doesn't exist
 */
function createModalStructure() {
    // Check if modal already exists
    if (document.getElementById('meeting-modal')) {
        return;
    }
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'meeting-modal';
    modalContainer.className = 'modal';
    
    // Create modal content
    meetingModalOverlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">新建会议</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="meeting-form">
                    <input type="hidden" id="meeting-id">
                    
                    <div class="form-group">
                        <label for="meeting-name">会议名称</label>
                        <input type="text" id="meeting-name" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="meeting-date">日期</label>
                        <input type="date" id="meeting-date" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="meeting-start-time">开始时间</label>
                        <input type="time" id="meeting-start-time" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="meeting-end-time">结束时间</label>
                        <input type="time" id="meeting-end-time" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="meeting-room">会议室</label>
                        <select id="meeting-room" required>
                            <option value="">请选择会议室</option>
                            <!-- Rooms will be loaded dynamically -->
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="meeting-description">会议描述</label>
                        <textarea id="meeting-description" rows="4"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" id="modal-cancel" class="btn-secondary">取消</button>
                        <button type="submit" id="modal-submit" class="btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Append overlay to modal container
    modalContainer.appendChild(meetingModalOverlay);
    
    // Append modal to the document body
    document.body.appendChild(modalContainer);
    
    // Add event listeners
    const closeButton = meetingModalOverlay.querySelector('.modal-close');
    closeButton.addEventListener('click', closeModal);
    
    const cancelButton = meetingModalOverlay.querySelector('#modal-cancel');
    cancelButton.addEventListener('click', closeModal);
    
    const form = meetingModalOverlay.querySelector('#meeting-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Load meeting rooms
    loadMeetingRooms();
}

/**
 * Creates the view modal structure if it doesn't exist
 */
function createViewModalStructure() {
    // Check if modal already exists
    if (document.getElementById('view-modal')) {
        return;
    }
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'view-modal';
    modalContainer.className = 'modal';
    
    // Create modal content
    viewModalOverlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>会议详情</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div id="meeting-details" class="meeting-details">
                    <p>加载中...</p>
                </div>
                <div class="modal-actions">
                    <button type="button" id="view-modal-close" class="btn-secondary">关闭</button>
                </div>
            </div>
        </div>
    `;
    
    // Append overlay to modal container
    modalContainer.appendChild(viewModalOverlay);
    
    // Append modal to the document body
    document.body.appendChild(modalContainer);
    
    // Add event listeners
    const closeButton = viewModalOverlay.querySelector('.modal-close');
    closeButton.addEventListener('click', closeViewModal);
    
    const closeActionButton = viewModalOverlay.querySelector('#view-modal-close');
    closeActionButton.addEventListener('click', closeViewModal);
}

/**
 * Opens the meeting modal for creating or editing a meeting
 * @param {string} mode - 'create' or 'edit'
 * @param {Object} [meetingData] - Meeting data for editing
 */
export function openModal(mode, meetingData = null) {
    // Create modal structure if it doesn't exist
    createModalStructure();
    
    // Set modal mode and data
    currentModalMode = mode;
    currentMeetingData = meetingData;
    
    // Update modal title
    const modalTitle = meetingModalOverlay.querySelector('#modal-title');
    modalTitle.textContent = mode === 'create' ? '新建会议' : '编辑会议';
    
    // Get form elements
    const form = meetingModalOverlay.querySelector('#meeting-form');
    const idInput = form.querySelector('#meeting-id');
    const nameInput = form.querySelector('#meeting-name');
    const dateInput = form.querySelector('#meeting-date');
    const startTimeInput = form.querySelector('#meeting-start-time');
    const endTimeInput = form.querySelector('#meeting-end-time');
    const roomSelect = form.querySelector('#meeting-room');
    const descInput = form.querySelector('#meeting-description');
    
    // Reset form
    form.reset();
    
    // Populate form if editing
    if (mode === 'edit' && meetingData) {
        idInput.value = meetingData.id;
        nameInput.value = meetingData.name;
        
        // Format date and time if needed
        if (meetingData.date) {
            dateInput.value = meetingData.date;
        }
        
        if (meetingData.start_time) {
            startTimeInput.value = meetingData.start_time;
        }
        
        if (meetingData.end_time) {
            endTimeInput.value = meetingData.end_time;
        }
        
        if (meetingData.room_id) {
            roomSelect.value = meetingData.room_id;
        }
        
        if (meetingData.description) {
            descInput.value = meetingData.description;
        }
    }
    
    // Show the modal
    const modalContainer = document.getElementById('meeting-modal');
    modalContainer.classList.add('active');
    meetingModalOverlay.style.opacity = '1';
    
    // Focus on the first input field
    setTimeout(() => {
        nameInput.focus();
    }, 100);
}

/**
 * Opens the view modal for displaying meeting details
 * @param {Object} meetingData - Meeting data to display
 */
export function openViewModal(meetingData) {
    // Create view modal structure if it doesn't exist
    createViewModalStructure();
    
    // Get details container
    const detailsContainer = viewModalOverlay.querySelector('#meeting-details');
    
    // Show loading state
    detailsContainer.innerHTML = '<p>加载中...</p>';
    
    // Show the modal
    const modalContainer = document.getElementById('view-modal');
    modalContainer.classList.add('active');
    viewModalOverlay.style.opacity = '1';
    
    // Populate details if data provided
    if (meetingData) {
        // Format the meeting details
        const roomName = meetingData.room_name || '未指定';
        const description = meetingData.description || '无描述';
        
        detailsContainer.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">会议名称:</span>
                <span class="detail-value">${meetingData.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">会议日期:</span>
                <span class="detail-value">${meetingData.date}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">开始时间:</span>
                <span class="detail-value">${meetingData.start_time}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">结束时间:</span>
                <span class="detail-value">${meetingData.end_time}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">会议室:</span>
                <span class="detail-value">${roomName}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">状态:</span>
                <span class="detail-value">${meetingData.status}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">描述:</span>
                <div class="detail-value description">${description}</div>
            </div>
        `;
    } else {
        detailsContainer.innerHTML = '<p class="error-message">无法加载会议详情</p>';
    }
}

/**
 * Closes the meeting modal
 */
export function closeModal() {
    const modalContainer = document.getElementById('meeting-modal');
    if (modalContainer) {
        meetingModalOverlay.style.opacity = '0';
        setTimeout(() => {
            modalContainer.classList.remove('active');
        }, 300);
    }
}

/**
 * Closes the view modal
 */
export function closeViewModal() {
    const modalContainer = document.getElementById('view-modal');
    if (modalContainer) {
        viewModalOverlay.style.opacity = '0';
        setTimeout(() => {
            modalContainer.classList.remove('active');
        }, 300);
    }
}

/**
 * Handles form submission for creating or editing a meeting
 * @param {Event} event - The form submit event
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Get form elements
    const form = event.target;
    const idInput = form.querySelector('#meeting-id');
    const nameInput = form.querySelector('#meeting-name');
    const dateInput = form.querySelector('#meeting-date');
    const startTimeInput = form.querySelector('#meeting-start-time');
    const endTimeInput = form.querySelector('#meeting-end-time');
    const roomSelect = form.querySelector('#meeting-room');
    const descInput = form.querySelector('#meeting-description');
    
    // Validate form
    if (!nameInput.value || !dateInput.value || !startTimeInput.value || !endTimeInput.value || !roomSelect.value) {
        showError('请填写所有必填字段');
        return;
    }
    
    // 创建一个唯一的会议ID（如果是新建会议）
    const meetingId = currentModalMode === 'create' 
        ? `meeting-${Date.now()}` 
        : idInput.value;
    
    // 组合日期和时间
    const meetingTime = `${dateInput.value} ${startTimeInput.value}`;
    
    // 创建符合后端API期望格式的会议数据
    const apiMeetingData = {
        id: meetingId,
        title: nameInput.value,
        intro: descInput.value,
        time: meetingTime,
        status: currentModalMode === 'create' ? '未开始' : undefined,
        part: [] // 空的议程项列表
    };
    
    try {
        let response;
        
        if (currentModalMode === 'create') {
            // 发送创建请求
            response = await fetch('/api/meetings/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiMeetingData)
            });
        } else if (currentModalMode === 'edit') {
            // 发送更新请求
            response = await fetch(`/api/meetings/${meetingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiMeetingData)
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Meeting saved:', result);
        
        // 显示成功消息
        const successMsg = currentModalMode === 'create' 
            ? '会议创建成功' 
            : '会议更新成功';
        showSuccess(successMsg);
        
        // 关闭模态框
        closeModal();
        
        // 刷新会议列表
        fetchMeetings();
    } catch (error) {
        console.error('Error saving meeting:', error);
        const errorMsg = currentModalMode === 'create' 
            ? '创建会议失败' 
            : '更新会议失败';
        showError(`${errorMsg}: ${error.message}`);
    }
}

/**
 * Loads meeting rooms for the room select dropdown
 */
async function loadMeetingRooms() {
    const roomSelect = document.querySelector('#meeting-room');
    if (!roomSelect) return;
    
    try {
        // 在实际项目中，这里应该是API调用
        // 暂时使用模拟数据，因为后端API尚未实现会议室功能
        const rooms = [
            {
                id: 1,
                name: '大会议室',
                capacity: 50,
                available: true
            },
            {
                id: 2,
                name: '中会议室',
                capacity: 30,
                available: true
            },
            {
                id: 3,
                name: '小会议室',
                capacity: 15,
                available: true
            },
            {
                id: 4,
                name: '多功能厅',
                capacity: 100,
                available: false
            }
        ];
        
        // Clear existing options except the placeholder
        roomSelect.innerHTML = '<option value="">请选择会议室</option>';
        
        // Add room options
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `${room.name} (容量: ${room.capacity})`;
            // Disable option if room is not available
            if (!room.available) {
                option.disabled = true;
                option.textContent += ' - 已占用';
            }
            roomSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading meeting rooms:', error);
        roomSelect.innerHTML = '<option value="">无法加载会议室</option>';
    }
}

// Initialize modal system
document.addEventListener('DOMContentLoaded', () => {
    createModalStructure();
    createViewModalStructure();
});
