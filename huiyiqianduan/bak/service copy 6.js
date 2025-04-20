// service.js - 无纸化会议系统统一数据控制器

// 数据控制器对象
const MeetingService = {
    // 数据相关变量
    meetingData: null,
    isDataFetching: false,
    dataFetchTimer: null,
    isDataFetchEnabled: true,
    
    // 事件监听器集合
    eventListeners: {},
    
    // 初始化服务
    init: function() {
        console.log('初始化会议数据服务');
        
        // 确保plus环境完全就绪
        if (!this.initializePlus()) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // 从本地存储初始化数据
        this.initializeFromStorage();
        // 设置定时数据获取
        this.setupDataFetchTimer();
        // 立即开始数据获取
        this.getJsonData();
    },
    
    // 初始化plus环境
    initializePlus: function() {
        if (typeof plus === 'undefined' || typeof plus.downloader === 'undefined') {
            console.error('plus环境未完全初始化');
            return false;
        }
        return true;
    },
    
    // 从本地存储初始化数据
    initializeFromStorage: function() {
        try {
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                console.log('本地存储的数据内容:', storedData);
                const data = JSON.parse(storedData);
                console.log('从本地存储获取到数据');
                this.meetingData = data;
                this.triggerEvent('dataInit', data);
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
        }
    },
    
    // 获取JSON数据
    getJsonData: function() {
        if (this.isDataFetching) {
            return;
        }
        
        this.isDataFetching = true;
        console.log('开始获取会议数据');

        try {
            const url = 'http://123.56.40.178/data.json';
            // 指定固定的文件路径，避免生成多个文件
            const targetPath = '_downloads/data.json';
            const dtask = plus.downloader.createDownload(url, {
                timeout: 5000,
                retry: 1,
                filename: targetPath // 指定固定的文件名，覆盖之前的文件
            }, this.handleDownloadComplete.bind(this));
            
            dtask.addEventListener('statechanged', this.handleStateChange.bind(this));
            dtask.start();
        } catch (error) {
            this.handleError('下载任务创建失败', error);
        }
    },
    
    // 处理下载完成
    handleDownloadComplete: function(d, status) {
        if (status !== 200) {
            this.handleError('下载失败', { status });
            return;
        }
        
        plus.io.resolveLocalFileSystemURL(d.filename, 
            (entry) => this.readDownloadedFile(entry),
            (error) => this.handleError('解析文件URL失败', error)
        );
    },
    
    // 读取下载的文件
    readDownloadedFile: function(entry) {
        entry.file(
            (file) => {
                const reader = new plus.io.FileReader();
                reader.onloadend = (e) => {
                    // 读取完成后解析数据
                    this.parseJsonData(e.target.result);
                    // 读取完成后删除文件，避免占用存储空间
                    entry.remove(
                        () => console.log('临时文件已删除'),
                        (err) => console.error('删除临时文件失败:', err)
                    );
                };
                reader.readAsText(file);
            },
            (error) => this.handleError('读取文件失败', error)
        );
    },
    
    // 解析JSON数据
    parseJsonData: function(content) {
        try {
            const jsonData = JSON.parse(content);
            if (!this.meetingData || this.meetingData.id !== jsonData.id) {
                const jsonString = JSON.stringify(jsonData);
                console.log('更新本地存储的数据内容:', jsonString);
                plus.storage.setItem('meetingData', jsonString);
                this.updateData(jsonData);
            } else {
                this.triggerEvent('dataUpdate', jsonData);
            }
        } catch (error) {
            this.handleError('JSON解析错误', error);
        } finally {
            this.isDataFetching = false;
        }
    },
    
    // 处理下载状态变化
    handleStateChange: function(task, status) {
        if (status === 404) {
            this.handleError('请求的资源不存在');
        } else if (status === 0) {
            this.triggerEvent('networkError', { error: '网络连接不可用' });
            this.isDataFetching = false;
        }
    },
    
    // 统一错误处理
    handleError: function(message, error = null) {
        console.error(message, error);
        this.triggerEvent('dataUpdateError', { error: message });
        this.isDataFetching = false;
    },
    
    // 更新数据并触发事件
    updateData: function(jsonData) {
        if (!jsonData || !jsonData.id) {
            this.handleError('无效的会议数据');
            return;
        }
        
        const isNewData = !this.meetingData;
        const isIdChanged = !isNewData && this.meetingData.id !== jsonData.id;
        
        this.meetingData = jsonData;
        
        if (isNewData) {
            this.triggerEvent('dataInit', jsonData);
        } else if (isIdChanged) {
            this.triggerEvent('idChanged', jsonData);
            // 当会议ID变化时，自动打开loading.html页面
            console.log('会议ID已变化，打开loading.html页面');
            plus.webview.open('loading.html', 'loading', {
                scrollIndicator: 'none',
                scalable: false
            });
        } else {
            this.triggerEvent('dataUpdate', jsonData);
        }
    },
    
    // 设置数据获取定时器
    setupDataFetchTimer: function() {
        if (this.dataFetchTimer) {
            clearInterval(this.dataFetchTimer);
        }
        
        this.dataFetchTimer = setInterval(() => {
            if (this.isDataFetchEnabled) {
                try {
                    const storedData = plus.storage.getItem('meetingData');
                    if (storedData) {
                        console.log('定时检测时本地存储的数据内容:', storedData);
                    }
                } catch (error) {
                    console.error('读取本地存储数据失败：', error);
                }
                this.getJsonData();
            }
        }, 10000);
    },
    
    // 获取当前会议数据
    getMeetingData: function() {
        return this.meetingData;
    },
    
    // 暂停数据检测
    pauseDataFetch: function() {
        this.isDataFetchEnabled = false;
    },
    
    // 恢复数据检测
    resumeDataFetch: function() {
        this.isDataFetchEnabled = true;
        this.getJsonData();
    },
    
    // 事件注册
    addEventListener: function(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    },
    
    // 事件移除
    removeEventListener: function(eventName, callback) {
        if (!this.eventListeners[eventName]) return;
        this.eventListeners[eventName] = this.eventListeners[eventName].filter(
            listener => listener !== callback
        );
    },
    
    // 触发事件
    triggerEvent: function(eventName, data) {
        if (!this.eventListeners[eventName]) return;
        this.eventListeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`事件处理器错误 (${eventName}):`, error);
            }
        });
    }
};

// 在plusready事件中初始化服务
document.addEventListener('plusready', function() {
    // 添加数据初始化完成事件监听，自动跳转到main页面
    MeetingService.addEventListener('dataInit', function(data) {
        console.log('数据初始化完成，自动跳转到main页面');
        setTimeout(function() {
            gotoMain();
        }, 2000); // 延迟1秒后跳转，确保数据完全加载
    });
    
    MeetingService.init();
});

// 导出服务对象
window.MeetingService = MeetingService;

// 添加进入系统功能
window.gotoMain = function() {
    plus.webview.open('main.html', 'main', {
        scrollIndicator: 'none',
        scalable: false
    });
};