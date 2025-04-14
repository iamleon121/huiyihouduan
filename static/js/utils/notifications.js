/**
 * notifications.js
 * 通知系统工具，用于显示各种类型的通知消息
 */

// 通知配置
const defaultConfig = {
    duration: 3000,     // 默认显示时间（毫秒）
    position: 'top-right', // 默认位置
    maxNotifications: 5  // 最大同时显示的通知数量
};

// 通知类型
const TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// 当前活动的通知列表
let activeNotifications = [];

/**
 * 创建并显示通知
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型
 * @param {string} title - 通知标题
 * @param {number} [duration] - 显示时间（毫秒）
 * @returns {Object} 通知对象
 */
function showNotification(message, type, title, duration = defaultConfig.duration) {
    console.log(`显示${type}通知: ${message}`);
    
    // 获取通知容器
    const container = getNotificationContainer();
    
    // 限制最大通知数量
    if (activeNotifications.length >= defaultConfig.maxNotifications) {
        const oldestNotification = activeNotifications[0];
        removeNotification(oldestNotification.id);
    }
    
    // 创建唯一ID
    const notificationId = 'notification-' + Date.now();
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = notificationId;
    
    // 根据类型确定标题
    let notificationTitle = title;
    if (!notificationTitle) {
        switch (type) {
            case TYPES.SUCCESS:
                notificationTitle = '成功';
                break;
            case TYPES.ERROR:
                notificationTitle = '错误';
                break;
            case TYPES.WARNING:
                notificationTitle = '警告';
                break;
            case TYPES.INFO:
                notificationTitle = '提示';
                break;
            default:
                notificationTitle = '提示';
        }
    }
    
    // 设置通知内容
    notification.innerHTML = `
        <div class="notification-header">
            <h3>${notificationTitle}</h3>
            <button class="notification-close">&times;</button>
        </div>
        <div class="notification-body">
            <p>${message}</p>
        </div>
    `;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 存储通知对象
    const notificationObj = {
        id: notificationId,
        element: notification,
        timer: null
    };
    
    activeNotifications.push(notificationObj);
    
    // 添加关闭按钮事件
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        removeNotification(notificationId);
    });
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 设置自动关闭计时器
    if (duration > 0) {
        notificationObj.timer = setTimeout(() => {
            removeNotification(notificationId);
        }, duration);
    }
    
    return notificationObj;
}

/**
 * 移除指定通知
 * @param {string} notificationId - 通知ID
 */
function removeNotification(notificationId) {
    const index = activeNotifications.findIndex(n => n.id === notificationId);
    if (index === -1) return;
    
    const notification = activeNotifications[index];
    const element = notification.element;
    
    // 清除计时器
    if (notification.timer) {
        clearTimeout(notification.timer);
    }
    
    // 移除动画
    element.classList.remove('show');
    
    // 动画结束后移除元素
    setTimeout(() => {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        activeNotifications.splice(index, 1);
    }, 300);
}

/**
 * 获取通知容器，如果不存在则创建
 * @returns {HTMLElement} 通知容器元素
 */
function getNotificationContainer() {
    let container = document.querySelector('.notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    return container;
}

/**
 * 显示成功通知
 * @param {string} message - 通知消息
 * @param {string} [title] - 通知标题
 * @param {number} [duration] - 显示时间
 * @returns {Object} 通知对象
 */
export function showSuccess(message, title = '成功', duration = defaultConfig.duration) {
    return showNotification(message, TYPES.SUCCESS, title, duration);
}

/**
 * 显示错误通知
 * @param {string} message - 通知消息
 * @param {string} [title] - 通知标题
 * @param {number} [duration] - 显示时间
 * @returns {Object} 通知对象
 */
export function showError(message, title = '错误', duration = defaultConfig.duration) {
    return showNotification(message, TYPES.ERROR, title, duration);
}

/**
 * 显示警告通知
 * @param {string} message - 通知消息
 * @param {string} [title] - 通知标题
 * @param {number} [duration] - 显示时间
 * @returns {Object} 通知对象
 */
export function showWarning(message, title = '警告', duration = defaultConfig.duration) {
    return showNotification(message, TYPES.WARNING, title, duration);
}

/**
 * 显示信息通知
 * @param {string} message - 通知消息
 * @param {string} [title] - 通知标题
 * @param {number} [duration] - 显示时间
 * @returns {Object} 通知对象
 */
export function showInfo(message, title = '提示', duration = defaultConfig.duration) {
    return showNotification(message, TYPES.INFO, title, duration);
}

/**
 * 显示一个永久通知（不会自动关闭）
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型
 * @param {string} [title] - 通知标题
 * @returns {Object} 通知对象
 */
export function showPermanent(message, type = TYPES.INFO, title) {
    return showNotification(message, type, title, 0);
}

/**
 * 关闭所有通知
 */
export function closeAll() {
    // 创建副本以避免在迭代过程中修改数组
    const notifications = [...activeNotifications];
    notifications.forEach(notification => {
        removeNotification(notification.id);
    });
}

/**
 * 显示确认对话框
 * @param {string} message - 确认消息
 * @param {string} [title] - 对话框标题
 * @returns {Promise<boolean>} 用户选择结果
 */
export function showConfirm(message, title = '请确认') {
    return new Promise(resolve => {
        // 为简单起见，使用内置的确认对话框
        // 在实际应用中，你可能想使用自定义模态对话框
        const result = window.confirm(message);
        resolve(result);
    });
}
