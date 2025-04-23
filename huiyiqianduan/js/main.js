// 更新标题文字
function updateTitleText() {
    try {
        // 从设置中获取标题文字
        const storedSettings = plus.storage.getItem('option');
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            if (parsedSettings && parsedSettings.option && parsedSettings.option.titleText) {
                const titleText = parsedSettings.option.titleText;
                // 不输出标题文字相关提示

                // 更新页面上的标题文字
                const logoTextElement = document.querySelector('.logo-text');
                if (logoTextElement) {
                    logoTextElement.textContent = titleText;
                    // 不输出标题文字相关提示

                    // 确保标题文字始终显示
                    logoTextElement.style.display = '';
                    // 添加日志以跟踪标题文字更新
                    console.log('标题文字已更新为:', titleText);
                } else {
                    console.error('找不到logo-text元素');
                }
            } else {
                console.log('设置中没有标题文字配置');
            }
        } else {
            console.log('未找到设置数据');
        }
    } catch (error) {
        console.error('读取标题文字设置失败:', error);
    }
}

document.addEventListener('plusready', function() {
    //console.log("plusready");

    // 设置当前页面的ID为'main'，便于其他页面找到并操作它
    const currentWebview = plus.webview.currentWebview();
    currentWebview.id = 'main';
    console.log('已设置当前页面ID为: main');

    // 检查并管理main页面，确保只有一个实例
    const cleaned = checkAndManageMainPage(true); // 保留当前页面
    if (cleaned) {
        console.log('main页面单例检查完成，已清理多余实例');
    } else {
        console.log('main页面单例检查完成，无需清理');
    }

    // 添加页面关闭事件监听
    currentWebview.addEventListener('close', function() {
        console.log('main页面即将关闭，通知service模块');
        // 获取service页面
        const serviceView = plus.webview.getWebviewById('service');
        if (serviceView) {
            // 在service页面中执行监测页面关闭的方法
            serviceView.evalJS('if (typeof MeetingService !== "undefined") { MeetingService.monitorPageClosing(); }');
        }
    });

    // 打印所有页面信息，用于调试
    const webviews = plus.webview.all();
    console.log('当前所有页面:', webviews.map(w => w.id || 'unknown').join(', '));

    // 禁止返回
    plus.key.addEventListener('backbutton', function() {
        plus.nativeUI.confirm('确认退出？', function(e) {
            if (e.index > 0) {
                plus.runtime.quit();
            }
        }, '退出程序', ['取消', '确定']);
    }, false);

    // 更新当前时间显示
    function updateCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        document.getElementById('current-time').textContent = timeString;
    }

    // 初始化时执行
    // 启动时间更新
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // 更新标题文字
    updateTitleText();

    // 确保图标和标题文字显示
    const logoElement = document.querySelector('.logo img');
    const logoTextElement = document.querySelector('.logo-text');

    if (logoElement) {
        logoElement.style.display = '';
        console.log('plusready事件中确保图标显示');
    }

    if (logoTextElement) {
        logoTextElement.style.display = '';
        console.log('plusready事件中确保标题文字显示');
    }

    // 添加点击时间区域打开设置页面的功能
    // 初始化点击计数器和时间戳
    let timeClickCount = 0;
    let firstClickTime = 0;

    // 为时间显示区域添加点击事件监听
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.addEventListener('click', function() {
            const currentTime = new Date().getTime();

            // 如果是第一次点击或者距离第一次点击已超过3秒，重置计数和时间戳
            if (timeClickCount === 0) {
                // 第一次点击，开始计时
                timeClickCount = 1;
                firstClickTime = currentTime;
                console.log('开始计时，时间区域点击次数：', timeClickCount);

                // 设置3秒后的超时处理，如果没有完成3次点击，重置计数器
                setTimeout(function() {
                    if (timeClickCount < 3) {
                        console.log('3秒内未完成3次点击，重置计数器');
                        timeClickCount = 0;
                        firstClickTime = 0;
                    }
                }, 3000);
            } else if ((currentTime - firstClickTime) <= 3000) {
                // 在3秒内的连续点击，增加计数
                timeClickCount++;
                console.log('时间区域点击次数：', timeClickCount);

                // 如果点击次数达到3次，打开设置页面
                if (timeClickCount >= 3) {
                    // 重置计数器和时间戳
                    timeClickCount = 0;
                    firstClickTime = 0;
                    // 打开设置页面
                    console.log('3秒内连续点击3次，打开设置页面');
                    openOptionPage();
                }
            } else {
                // 超过3秒，这次点击成为新的第一次点击
                timeClickCount = 1;
                firstClickTime = currentTime;
                console.log('超时重新开始计时，时间区域点击次数：', timeClickCount);

                // 设置新的3秒超时处理
                setTimeout(function() {
                    if (timeClickCount < 3) {
                        console.log('3秒内未完成3次点击，重置计数器');
                        timeClickCount = 0;
                        firstClickTime = 0;
                    }
                }, 3000);
            }
        });
    }

    // 从本地存储读取数据并更新页面
    if (typeof plus !== 'undefined' && plus.storage) {
        try {
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                const jsonData = JSON.parse(storedData);
                updateMeetingInfo(jsonData);
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
        }
    }
});

function updateMeetingInfo(jsonData) {
    // 检查数据有效性
    if (!jsonData || !jsonData.id) {
        console.error('无效的会议数据');
        return;
    }

    // 输出本地存储的title和time信息
    console.log('从本地存储读取的title:', jsonData.title);
    console.log('从本地存储读取的time:', jsonData.time);

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

    // 更新页面内容
    document.getElementById('meeting-id').textContent = jsonData.id;
    if (titleElement && jsonData.title) {
        titleElement.textContent = jsonData.title;
    }
    if (introElement && jsonData.time) {
        introElement.textContent = jsonData.time;
    }
}

// 添加页面可见性变化监听，在页面显示时更新数据
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && typeof plus !== 'undefined' && plus.storage) {
        try {
            console.log('页面变为可见状态，更新数据和样式');

            // 确保图标和标题文字显示
            const logoElement = document.querySelector('.logo img');
            const logoTextElement = document.querySelector('.logo-text');

            if (logoElement) {
                logoElement.style.display = '';
                console.log('确保图标显示');
            }

            if (logoTextElement) {
                logoTextElement.style.display = '';
                console.log('确保标题文字显示');
            }

            // 更新标题文字
            updateTitleText();

            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                const jsonData = JSON.parse(storedData);
                if (jsonData && jsonData.title && jsonData.time) {
                    const titleElement = document.querySelector('.meeting-title-text');
                    const introElement = document.querySelector('.meeting-intro-text');
                    if (titleElement) titleElement.textContent = jsonData.title;
                    if (introElement) introElement.textContent = jsonData.time;
                    console.log('更新会议标题和时间成功');
                } else {
                    console.error('无效的会议数据');
                    plus.webview.close();
                }
            } else {
                console.log('未找到会议数据，关闭页面');
                plus.webview.close();
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
            plus.webview.close();
        }
    }
});

// 参加会议按钮点击事件处理函数
function openMeetingDetail() {
    if (typeof plus !== 'undefined') {
        // 在HTML5+环境下使用plus.webview.open打开list.html页面
        console.log('打开会议详情页面');
        plus.webview.open('list.html', 'list', {}, '', 'slide-in-right');
    } else {
        // 在非plus环境下使用普通的页面跳转
        console.log('非plus环境，使用普通页面跳转');
        window.location.href = 'list.html';
    }
}

// 设置页面打开函数
function openOptionPage() {
    if (typeof plus !== 'undefined') {
        // 在HTML5+环境下使用plus.webview.open打开option.html页面
        console.log('打开设置页面');
        plus.webview.open('option.html', 'option', {}, '', 'slide-in-right');
    } else {
        // 在非plus环境下使用普通的页面跳转
        console.log('非plus环境，使用普通页面跳转');
        window.location.href = 'option.html';
    }
}



/**
 * 监听网络状态并更新页面左下角指示灯颜色
 * 绿色代表网络正常，红色代表网络断开
 */
function updateNetworkIndicator(isOnline) {
    var indicator = document.getElementById('network-status-indicator');
    if (!indicator) return;
    if (isOnline) {
        indicator.style.backgroundColor = '#4caf50';
        indicator.style.boxShadow = '0 0 6px #4caf50';
        indicator.title = '网络已连接';
    } else {
        indicator.style.backgroundColor = '#f44336';
        indicator.style.boxShadow = '0 0 6px #f44336';
        indicator.title = '网络未连接';
    }
}

// 页面加载后初始化网络状态指示灯
window.addEventListener('DOMContentLoaded', function() {
    updateNetworkIndicator(navigator.onLine);
});

// 监听浏览器原生网络事件
window.addEventListener('online', function() {
    updateNetworkIndicator(true);
});
window.addEventListener('offline', function() {
    updateNetworkIndicator(false);
});

// 若service页面有更精确的网络检测，可通过plus.webview通信机制通知main页面
if (typeof plus !== 'undefined' && plus.webview) {
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'network-status') {
            updateNetworkIndicator(event.data.online);
        }
    });
}


