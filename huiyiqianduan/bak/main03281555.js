function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').textContent = `${hours}:${minutes}`;
}

function initializePlus() {
    if (typeof plus === 'undefined') {
        console.error('plus对象未初始化');
        return false;
    }
    return true;
}

let timeUpdateTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    updateTime();
    if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer);
    }
    timeUpdateTimer = setInterval(updateTime, 1000);
});

function getJsonData() {
    if (!initializePlus()) {
        console.error('plus对象未初始化');
        return;
    }

    // 首先尝试从storage中读取数据
    let lastStoredData = null;
    try {
        const storedData = plus.storage.getItem('meetingData');
        if (storedData) {
            lastStoredData = JSON.parse(storedData);
            // 立即使用缓存数据更新UI
            updateMeetingInfo(lastStoredData);
        }
    } catch (error) {
        console.error('读取本地存储数据失败：', error);
    }

    try {
        const url = 'http://123.56.40.178/data.json';
        const dtask = plus.downloader.createDownload(url, {
            timeout: 5000,  // 设置5秒超时
            retry: 1        // 允许重试1次
        }, function(d, status) {
            if (status == 200) {
                plus.io.resolveLocalFileSystemURL(d.filename, function(entry) {
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            try {
                                const jsonData = JSON.parse(e.target.result);
                                // 存储新的数据到storage
                                plus.storage.setItem('meetingData', JSON.stringify(jsonData));
                                updateMeetingInfo(jsonData);
                            } catch (error) {
                                console.error('JSON解析错误：', error);
                                if (lastStoredData) {
                                    console.log('使用本地缓存数据');
                                    updateMeetingInfo(lastStoredData);
                                } else {
                                    plus.nativeUI.toast('数据解析失败');
                                }
                            }
                        }
                        reader.readAsText(file);
                    }, function(error) {
                        console.error('读取文件失败：', error);
                        if (lastStoredData) {
                            console.log('使用本地缓存数据');
                            updateMeetingInfo(lastStoredData);
                        }
                    });
                }, function(error) {
                    console.error('解析文件URL失败：', error);
                    if (lastStoredData) {
                        console.log('使用本地缓存数据');
                        updateMeetingInfo(lastStoredData);
                    }
                });
            } else {
                console.error('下载JSON文件失败，状态码：' + status);
                if (lastStoredData) {
                    console.log('使用本地缓存数据');
                    updateMeetingInfo(lastStoredData);
                } else {
                    plus.nativeUI.toast('数据下载失败');
                }
            }
        });
        
        dtask.addEventListener('statechanged', function(task, status) {
            if (status === 404) {
                console.error('请求的资源不存在');
                if (lastStoredData) {
                    console.log('使用本地缓存数据');
                    updateMeetingInfo(lastStoredData);
                }
            }
        });
        
        dtask.start();
    } catch (error) {
        console.error('下载任务创建失败：', error);
        if (lastStoredData) {
            console.log('使用本地缓存数据');
            updateMeetingInfo(lastStoredData);
        }
    }
}

// 用于跟踪上次日志输出时间的变量
let lastLogTime = 0;
const LOG_THROTTLE_MS = 5000; // 5秒内不重复输出相同日志

function updateMeetingInfo(jsonData) {
    const titleElement = document.querySelector('.meeting-title-text');
    const introElement = document.querySelector('.meeting-intro-text');
    const idElement = document.getElementById('meeting-id');
    
    // 如果id元素不存在，创建一个隐藏的元素来存储id
    if (!idElement) {
        const newIdElement = document.createElement('div');
        newIdElement.id = 'meeting-id';
        newIdElement.style.display = 'none';
        document.body.appendChild(newIdElement);
    }
    
    const currentId = document.getElementById('meeting-id').textContent;
    
    // 只有当id存在且与当前id不同时才更新内容
    if (jsonData.id && currentId !== jsonData.id) {
        console.log('检测到新的会议ID，更新内容');
        document.getElementById('meeting-id').textContent = jsonData.id;
        if (titleElement && jsonData.title) {
            titleElement.textContent = jsonData.title;
        }
        if (introElement && jsonData.intro) {
            introElement.textContent = jsonData.intro;
        }
        // 重置日志时间戳
        lastLogTime = Date.now();
    } else {
        // 添加节流控制，避免短时间内重复输出相同日志
        const now = Date.now();
        if (now - lastLogTime > LOG_THROTTLE_MS) {
            console.log('会议ID未变化，保持当前内容');
            lastLogTime = now;
        }
    }
}

let dataFetchTimer = null;

// 所有涉及plus的操作都放在plusready事件中
let plusReadyInitialized = false;

// 添加一个函数来处理定时器的创建和管理
function setupDataFetchTimer() {
    console.log('设置数据获取定时器');
    // 清理已存在的定时器
    if (dataFetchTimer) {
        console.log('清理已存在的定时器');
        clearInterval(dataFetchTimer);
        dataFetchTimer = null;
    }
    
    try {
        // 立即执行一次获取数据
        console.log('立即执行一次数据获取');
        getJsonData();
        // 每10秒执行一次获取数据
        console.log('设置10秒间隔的数据获取定时器');
        dataFetchTimer = setInterval(getJsonData, 10000);
    } catch (error) {
        console.error('初始化数据获取失败：', error);
        plus.nativeUI.toast('初始化失败，请重试');
    }
}

// 使用一次性事件监听器，确保plusready事件只被处理一次
document.addEventListener('plusready', function plusReadyHandler() {
    // 防止重复初始化
    if (plusReadyInitialized) {
        console.log('plusready已经初始化过，跳过');
        return;
    }
    
    console.log('plusready事件触发，初始化应用');
    plusReadyInitialized = true;
    
    // 移除事件监听器，确保只执行一次
    document.removeEventListener('plusready', plusReadyHandler);

    if (!initializePlus()) {
        console.error('plus初始化失败');
        return;
    }

    window.openMeetingDetail = function() {
        if (!initializePlus()) {
            plus.nativeUI.toast('系统未就绪，请稍后再试');
            return;
        }
        plus.webview.open('list.html', 'list', {});
    }
    
    // 设置数据获取定时器
    setupDataFetchTimer();
});