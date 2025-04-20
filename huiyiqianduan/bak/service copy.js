// service.js - 无纸化会议系统统一数据控制器

// 数据控制器对象
const MeetingService = {
    // 数据相关变量
    meetingData: null,
    isDataFetching: false,
    meetingIdInitialized: false,
    dataFetchTimer: null,
    isDataFetchEnabled: true,
    plusReadyInitialized: false,
    
    // 事件监听器集合
    eventListeners: {},
    
    // 初始化服务
    init: function() {
        console.log('初始化会议数据服务');
        if (this.plusReadyInitialized) {
            console.log('数据服务已经初始化过，跳过');
            return;
        }
        
        // 确保plus环境完全就绪
        if (!this.initializePlus() || typeof plus.downloader === 'undefined') {
            console.error('plus环境未完全初始化');
            // 添加重试机制
            setTimeout(() => {
                this.init();
            }, 500);
            return;
        }
        
        this.plusReadyInitialized = true;
        this.setupDataFetchTimer();
        this.setupVisibilityChangeListener();
        
        // 确保服务在初始化后立即开始工作
        this.isDataFetchEnabled = true;
        this.isDataFetching = false;
        
        // 立即开始数据获取
        this.getJsonData();
    },
    
    // 初始化plus环境
    initializePlus: function() {
        if (typeof plus === 'undefined') {
            console.error('plus对象未初始化');
            return false;
        }
        return true;
    },
    
    // 获取JSON数据
    getJsonData: function() {
        if (!this.initializePlus()) {
            console.error('plus对象未初始化');
            return;
        }
        
        // 如果已经在获取数据，则跳过
        if (this.isDataFetching) {
            console.log('已有数据获取任务正在进行，跳过');
            return;
        }
        
        this.isDataFetching = true;
        console.log('开始获取会议数据');

        // 首先尝试从storage中读取数据
        let lastStoredData = null;
        try {
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                lastStoredData = JSON.parse(storedData);
                console.log('从本地存储获取到数据:', typeof storedData === 'object' ? JSON.stringify(storedData) : storedData);
                // 立即使用缓存数据更新，但标记为临时更新
                this.updateData(lastStoredData, true);
            } else {
                console.log('本地存储中没有会议数据');
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
        }

        try {
            const url = 'http://123.56.40.178/data.json';
            const dtask = plus.downloader.createDownload(url, {
                timeout: 5000,  // 设置5秒超时
                retry: 1        // 允许重试1次
            }, (d, status) => {
                console.log('下载任务完成，状态码：' + status);
                
                if (status == 200) {
                    plus.io.resolveLocalFileSystemURL(d.filename, (entry) => {
                        entry.file((file) => {
                            const reader = new plus.io.FileReader();
                            reader.onloadend = (e) => {
                                try {
                                    const jsonData = JSON.parse(e.target.result);
                                    // 检查ID是否变化
                                    if (this.meetingData && this.meetingData.id !== jsonData.id) {
                                        console.log('检测到ID变化，更新本地存储:', typeof jsonData === 'object' ? JSON.stringify(jsonData) : jsonData);
                                        // 存储新的数据到storage
                                        plus.storage.setItem('meetingData', JSON.stringify(jsonData));
                                    } else if (!this.meetingData) {
                                        // 首次加载数据，存储到本地
                                        console.log('首次加载数据，存储到本地:', typeof jsonData === 'object' ? JSON.stringify(jsonData) : jsonData);
                                        plus.storage.setItem('meetingData', JSON.stringify(jsonData));
                                    }
                                    // 使用最终数据更新，非临时更新
                                    this.updateData(jsonData, false);
                                    // 数据处理完成后重置标志
                                    this.isDataFetching = false;
                                    console.log('数据处理完成，重置获取标志');
                                } catch (error) {
                                    console.error('JSON解析错误：', error);
                                    if (lastStoredData) {
                                        console.log('使用本地缓存数据');
                                        // 使用缓存数据更新，但标记为最终更新
                                        this.updateData(lastStoredData, false);
                                    } else {
                                        plus.nativeUI.toast('数据解析失败');
                                        // 触发数据更新错误事件
                                        this.triggerEvent('dataUpdateError', { error: '数据解析失败' });
                                    }
                                    // 数据处理完成后重置标志
                                    this.isDataFetching = false;
                                    console.log('JSON解析失败，重置获取标志');
                                }
                            }
                            reader.readAsText(file);
                        }, (error) => {
                            console.error('读取文件失败：', error);
                            if (lastStoredData) {
                                console.log('使用本地缓存数据');
                                // 使用缓存数据更新，但标记为最终更新
                                this.updateData(lastStoredData, false);
                            } else {
                                // 触发数据更新错误事件
                                this.triggerEvent('dataUpdateError', { error: '读取文件失败' });
                            }
                            // 数据处理完成后重置标志
                            this.isDataFetching = false;
                            console.log('读取文件失败，重置获取标志');
                        });
                    }, (error) => {
                        console.error('解析文件URL失败：', error);
                        if (lastStoredData) {
                            console.log('使用本地缓存数据');
                            // 使用缓存数据更新，但标记为最终更新
                            this.updateData(lastStoredData, false);
                        } else {
                            // 触发数据更新错误事件
                            this.triggerEvent('dataUpdateError', { error: '解析文件URL失败' });
                        }
                        // 数据处理完成后重置标志
                        this.isDataFetching = false;
                        console.log('解析文件URL失败，重置获取标志');
                    });
                } else {
                    console.error('下载JSON文件失败，状态码：' + status);
                    // 检查网络状态
                    if (status === 0 || status === 400) {
                        console.log('网络连接不可用或请求错误，跳过本地存储操作');
                        // 触发网络错误事件
                        this.triggerEvent('networkError', { error: '网络连接不可用或请求错误' });
                    } else if (lastStoredData) {
                        console.log('使用本地缓存数据');
                        // 使用缓存数据更新，但标记为最终更新
                        this.updateData(lastStoredData, false);
                    } else {
                        plus.nativeUI.toast('数据下载失败');
                        // 触发数据更新错误事件
                        this.triggerEvent('dataUpdateError', { error: '数据下载失败' });
                    }
                    // 数据处理完成后重置标志
                    this.isDataFetching = false;
                    console.log('下载失败，重置获取标志');
                }
            });
            
            dtask.addEventListener('statechanged', (task, status) => {
                if (status === 404) {
                    console.error('请求的资源不存在');
                    
                    if (lastStoredData) {
                        console.log('使用本地缓存数据');
                        // 使用缓存数据更新，但标记为最终更新
                        this.updateData(lastStoredData, false);
                    } else {
                        // 触发数据更新错误事件
                        this.triggerEvent('dataUpdateError', { error: '请求的资源不存在' });
                    }
                } else if (status === 0) {
                    console.log('网络连接不可用，跳过本地存储操作');
                    // 触发网络错误事件
                    this.triggerEvent('networkError', { error: '网络连接不可用' });
                    // 数据处理完成后重置标志
                    this.isDataFetching = false;
                    console.log('请求资源不存在，重置获取标志');
                }
            });
            
            dtask.start();
        } catch (error) {
            console.error('下载任务创建失败：', error);
            
            if (lastStoredData) {
                console.log('使用本地缓存数据');
                // 使用缓存数据更新，但标记为最终更新
                this.updateData(lastStoredData, false);
            } else {
                // 触发数据更新错误事件
                this.triggerEvent('dataUpdateError', { error: '下载任务创建失败' });
            }
            
            // 发生异常，重置数据获取标志
            this.isDataFetching = false;
            console.log('下载任务创建失败，重置获取标志');
        }
    },
    
    // 更新数据并触发事件
    updateData: function(jsonData, isTemporary = false) {
        // 检查数据有效性
        if (!jsonData || !jsonData.id) {
            console.error('无效的会议数据');
            // 触发数据更新错误事件
            this.triggerEvent('dataUpdateError', { error: '无效的会议数据' });
            return;
        }
        
        // 添加日志，标记是临时更新还是最终更新
        if (isTemporary) {
            console.log('临时更新数据，等待网络数据');
        } else {
            console.log('最终更新数据，使用网络或最终缓存数据');
        }
        
        // 检查ID是否初始化
        if (!this.meetingIdInitialized) {
            console.log('首次初始化会议ID，设置为:', jsonData.id);
            this.meetingIdInitialized = true;
            this.meetingData = jsonData;
            // 触发数据初始化事件
            this.triggerEvent('dataInit', jsonData);
            return;
        }
        
        // 检查ID是否变化
        if (this.meetingData && this.meetingData.id !== jsonData.id && !isTemporary) {
            console.log('检测到新的会议ID，从', this.meetingData.id, '变为', jsonData.id);
            this.meetingData = jsonData;
            // 触发ID变化事件
            this.triggerEvent('idChanged', jsonData);
        } else {
            // 如果是临时更新或ID没有变化
            if (isTemporary) {
                console.log('临时更新：会议ID未变化或未完成初始化');
                if (!this.meetingData) {
                    this.meetingData = jsonData;
                }
                // 触发临时数据更新事件
                this.triggerEvent('tempDataUpdate', jsonData);
            } else {
                console.log('会议ID未变化，更新数据');
                this.meetingData = jsonData;
                // 触发数据更新事件
                this.triggerEvent('dataUpdate', jsonData);
            }
        }
    },
    
    // 设置数据获取定时器
    setupDataFetchTimer: function() {
        console.log('设置数据获取定时器');
        // 清理已存在的定时器
        if (this.dataFetchTimer) {
            console.log('清理已存在的定时器');
            clearInterval(this.dataFetchTimer);
            this.dataFetchTimer = null;
        }
        
        try {
            // 立即执行一次获取数据
            console.log('立即执行一次数据获取');
            this.getJsonData();
            // 每10秒执行一次获取数据
            console.log('设置10秒间隔的数据获取定时器');
            this.dataFetchTimer = setInterval(() => {
                // 只有当启用标志为true时才执行ID检测
                if (this.isDataFetchEnabled) {
                    this.getJsonData();
                } else {
                    console.log('ID定时检测已暂停');
                }
            }, 10000);
        } catch (error) {
            console.error('初始化数据获取失败：', error);
            if (this.initializePlus()) {
                plus.nativeUI.toast('初始化失败，请重试');
            }
        }
    },
    
    // 添加页面可见性变化监听函数
    setupVisibilityChangeListener: function() {
        console.log('设置页面可见性变化监听');
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('页面变为可见，启用数据检测');
                this.isDataFetchEnabled = true;
                // 页面变为可见时立即执行一次数据获取
                this.getJsonData();
            } else {
                console.log('页面变为不可见，暂停数据检测');
                this.isDataFetchEnabled = false;
            }
        });
    },
    
    // 暂停数据检测
    pauseDataFetch: function() {
        console.log('暂停数据检测');
        this.isDataFetchEnabled = false;
    },
    
    // 恢复数据检测
    resumeDataFetch: function() {
        console.log('恢复数据检测');
        this.isDataFetchEnabled = true;
        // 立即执行一次数据获取
        this.getJsonData();
    },
    
    // 获取当前会议数据
    getMeetingData: function() {
        return this.meetingData;
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
    MeetingService.init();
});

// 导出服务对象
window.MeetingService = MeetingService;