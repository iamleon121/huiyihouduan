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

// 用于跟踪是否正在获取数据的标志
let isDataFetching = false;

function getJsonData() {
    if (!initializePlus()) {
        console.error('plus对象未初始化');
        return;
    }
    
    // 如果已经在获取数据，则跳过
    if (isDataFetching) {
        console.log('已有数据获取任务正在进行，跳过');
        return;
    }
    
    isDataFetching = true;
    console.log('开始获取会议数据');

    // 首先尝试从storage中读取数据
    let lastStoredData = null;
    try {
        const storedData = plus.storage.getItem('meetingData');
        if (storedData) {
            lastStoredData = JSON.parse(storedData);
            console.log('从本地存储获取到数据');
            // 立即使用缓存数据更新UI
            updateMeetingInfo(lastStoredData);
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
        }, function(d, status) {
            // 完成数据获取，重置标志
            isDataFetching = false;
            console.log('数据获取完成，重置获取标志');
            
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
                // 请求失败，重置数据获取标志
                isDataFetching = false;
                console.log('请求资源不存在，重置获取标志');
                
                if (lastStoredData) {
                    console.log('使用本地缓存数据');
                    updateMeetingInfo(lastStoredData);
                }
            }
        });
        
        dtask.start();
    } catch (error) {
        console.error('下载任务创建失败：', error);
        // 发生异常，重置数据获取标志
        isDataFetching = false;
        console.log('下载任务创建失败，重置获取标志');
        
        if (lastStoredData) {
            console.log('使用本地缓存数据');
            updateMeetingInfo(lastStoredData);
        }
    }
}

// 用于跟踪上次日志输出时间的变量
let lastLogTime = 0;
const LOG_THROTTLE_MS = 5000; // 5秒内不重复输出相同日志

// 用于跟踪是否已经初始化过会议ID的标志
let meetingIdInitialized = false;

function updateMeetingInfo(jsonData) {
    const titleElement = document.querySelector('.meeting-title-text');
    const introElement = document.querySelector('.meeting-intro-text');
    const idElement = document.getElementById('meeting-id');
    
    console.log('更新会议信息，当前数据:', JSON.stringify(jsonData));
    
    // 如果id元素不存在，创建一个隐藏的元素来存储id
    if (!idElement) {
        console.log('创建会议ID元素');
        const newIdElement = document.createElement('div');
        newIdElement.id = 'meeting-id';
        newIdElement.style.display = 'none';
        document.body.appendChild(newIdElement);
    }
    
    const currentId = document.getElementById('meeting-id').textContent;
    console.log('当前会议ID:', currentId, '新会议ID:', jsonData.id, '初始化状态:', meetingIdInitialized);
    
    // 如果是首次初始化且当前ID为空，直接设置ID而不触发跳转
    if (!meetingIdInitialized && (!currentId || currentId === '')) {
        console.log('首次初始化会议ID，设置为:', jsonData.id);
        document.getElementById('meeting-id').textContent = jsonData.id;
        if (titleElement && jsonData.title) {
            titleElement.textContent = jsonData.title;
        }
        if (introElement && jsonData.intro) {
            introElement.textContent = jsonData.intro;
        }
        meetingIdInitialized = true;
        lastLogTime = Date.now();
        return;
    }
    
    // 只有当id存在且与当前id不同时才更新内容并触发跳转
    if (jsonData.id && currentId !== jsonData.id && meetingIdInitialized) {
        console.log('检测到新的会议ID，从', currentId, '变为', jsonData.id);
        document.getElementById('meeting-id').textContent = jsonData.id;
        if (titleElement && jsonData.title) {
            titleElement.textContent = jsonData.title;
        }
        if (introElement && jsonData.intro) {
            introElement.textContent = jsonData.intro;
        }
        // 重置日志时间戳
        lastLogTime = Date.now();
        
        // 数据更新后，3秒后跳转到loading页面
        setTimeout(function() {
            if (initializePlus()) {
                console.log('数据已更新，3秒后跳转到loading页面');
                // 修改打开方式，设置show和waiting为false，隐藏当前页面而不是关闭它
                plus.webview.open('loading.html', 'loading', {show:false, waiting:false});
                // 隐藏当前页面
                const currentWebview = plus.webview.currentWebview();
                currentWebview.hide();
            } else {
                console.error('plus未初始化，无法跳转');
            }
        }, 3000);
    } else {
        // 添加节流控制，避免短时间内重复输出相同日志
        const now = Date.now();
        if (now - lastLogTime > LOG_THROTTLE_MS) {
            console.log('会议ID未变化或未完成初始化，保持当前内容');
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