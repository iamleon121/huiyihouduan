// loading-service.js - 负责会议数据获取和同步的服务

// 会议数据服务对象
const LoadingService = {
    // 数据相关变量
    meetingData: null,
    isDataFetching: false,
    
    // 服务器配置
    serverBaseUrl: 'http://192.168.110.10:8000', // 默认服务器基础URL
    meetingDataUrl: 'http://192.168.110.10:8000/data.json', // 默认会议数据接口
    
    // 事件监听器集合
    eventListeners: {},
    
    // 初始化服务
    init: function() {
        console.log('初始化会议数据加载服务');
        
        // 确保plus环境完全就绪
        if (typeof plus === 'undefined') {
            console.error('plus环境未初始化');
            this.triggerEvent('error', { message: 'plus环境未初始化' });
            return false;
        }
        
        // 从本地存储加载配置
        this.loadConfig();
        
        // 从本地存储初始化数据
        this.initializeFromStorage();
        
        return true;
    },
    
    // 从本地存储加载配置
    loadConfig: function() {
        try {
            const storedSettings = plus.storage.getItem('option');
            if (storedSettings) {
                console.log('从本地存储加载配置:', storedSettings);
                const parsedSettings = JSON.parse(storedSettings);
                
                // 确保数据格式正确
                if (parsedSettings && parsedSettings.option) {
                    const options = parsedSettings.option;
                    
                    // 更新服务器基础URL
                    if (options.server) {
                        // 获取服务器地址和端口号
                        const serverAddress = options.server;
                        const serverPort = options.port || '8000';
                        
                        // 设置基础URL
                        this.serverBaseUrl = 'http://' + serverAddress + ':' + serverPort;
                        console.log('已设置服务器基础URL:', this.serverBaseUrl);
                        
                        // 设置会议数据接口URL
                        this.meetingDataUrl = this.serverBaseUrl + '/data.json';
                        console.log('已设置会议数据接口URL:', this.meetingDataUrl);
                    }
                }
            } else {
                console.log('未找到配置，使用默认设置');
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            this.triggerEvent('error', { message: '加载配置失败', details: error });
        }
    },
    
    // 从本地存储初始化数据
    initializeFromStorage: function() {
        try {
            // 加载会议数据
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                console.log('从本地存储获取到会议数据');
                const data = JSON.parse(storedData);
                this.meetingData = data;
                this.triggerEvent('dataInit', data);
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
            this.triggerEvent('error', { message: '读取本地存储数据失败', details: error });
        }
    },
    
    // 获取会议数据
    fetchMeetingData: function() {
        if (this.isDataFetching) {
            console.log('已有数据获取任务正在进行，跳过');
            return;
        }
        
        this.isDataFetching = true;
        console.log('开始获取会议数据，URL:', this.meetingDataUrl);
        
        // 使用plus.net.XMLHttpRequest获取JSON数据
        try {
            const xhr = new plus.net.XMLHttpRequest();
            
            // 设置超时时间
            xhr.timeout = 5000;
            
            // 设置事件处理
            xhr.onload = () => {
                if (xhr.status === 200) {
                    // 请求成功，解析JSON数据
                    this.parseJsonData(xhr.responseText);
                } else {
                    this.handleError('请求失败', { status: xhr.status, responseText: xhr.responseText });
                }
            };
            
            xhr.onerror = (e) => {
                this.handleError('网络请求错误', e);
            };
            
            xhr.ontimeout = () => {
                this.handleError('请求超时');
            };
            
            xhr.onabort = () => {
                this.handleError('请求被取消');
            };
            
            // 打开连接并发送请求
            xhr.open('GET', this.meetingDataUrl);
            xhr.send();
        } catch (error) {
            this.handleError('创建XMLHttpRequest失败', error);
        }
    },
    
    // 解析JSON数据
    parseJsonData: function(content) {
        try {
            const jsonData = JSON.parse(content);
            
            // 检查数据有效性
            if (!jsonData || !jsonData.id) {
                this.handleError('无效的会议数据');
                return;
            }
            
            // 检查数据是否有变化
            const isNewData = !this.meetingData;
            const isIdChanged = !isNewData && this.meetingData.id !== jsonData.id;
            
            // 更新数据
            this.meetingData = jsonData;
            
            // 保存到本地存储
            const jsonString = JSON.stringify(jsonData);
            console.log('更新本地存储的数据内容');
            plus.storage.setItem('meetingData', jsonString);
            
            // 触发相应事件
            if (isNewData) {
                this.triggerEvent('dataInit', jsonData);
            } else if (isIdChanged) {
                this.triggerEvent('idChanged', jsonData);
            } else {
                this.triggerEvent('dataUpdate', jsonData);
            }
            
            console.log('JSON数据解析成功');
        } catch (error) {
            this.handleError('JSON解析错误', error);
        } finally {
            // 确保在请求完成后重置数据获取状态
            this.isDataFetching = false;
        }
    },
    
    // 统一错误处理
    handleError: function(message, error = null) {
        // 输出更详细的错误信息
        console.error('错误类型:', message);
        console.error('错误详情:', error);
        console.error('请求URL:', this.meetingDataUrl);
        
        // 如果是请求失败，输出状态码
        if (message === '请求失败' && error && error.status) {
            console.error('状态码:', error.status);
        }
        
        this.triggerEvent('error', { message: message, details: error });
        this.isDataFetching = false;
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

// 导出服务对象
window.LoadingService = LoadingService;
