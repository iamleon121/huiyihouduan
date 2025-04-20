// 更新加载状态文本
function updateLoadingText(text) {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

// 显示错误信息
function showError(message) {
    updateLoadingText(message);
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) {
        spinner.style.borderTopColor = '#ff4444';
    }
}

document.addEventListener('plusready', function() {
    // 检查本地存储是否存在
    console.log('plusready事件触发，初始化应用');
    updateLoadingText('正在检查系统数据...');

    // 尝试从设置中读取标题文字
    try {
        const storedSettings = plus.storage.getItem('option');
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            if (parsedSettings && parsedSettings.option && parsedSettings.option.titleText) {
                const titleText = parsedSettings.option.titleText;
                console.log('从设置中读取的标题文字:', titleText);

                // 更新页面上的标题文字
                const logoTextElement = document.querySelector('.logo-text');
                if (logoTextElement) {
                    logoTextElement.textContent = titleText;
                }
            }
        }
    } catch (error) {
        console.error('读取标题文字设置失败:', error);
    }

    function checkLocalStorage() {
        try {
            // 检查meetingData是否存在
            const storageData = plus.storage.getItem('meetingData');
            // 检查option是否存在
            const optionData = plus.storage.getItem('option');

            // 如果option不存在，创建默认option数据
            if (!optionData) {
                console.log('option数据不存在，创建默认数据');
                updateLoadingText('正在初始化系统配置...');
                createOptionStorage();
            }

            if (storageData) {
                updateLoadingText('正在加载应用...');
                // 如果本地存储存在，直接跳转到service页面
                navigateToService();
            } else {
                // 如果本地存储不存在，直接创建默认数据
                updateLoadingText('正在初始化系统数据...');
                createLocalStorage();
            }
        } catch (e) {
            console.error('检查本地存储失败:', e);
            showError('系统初始化失败，正在尝试重新初始化...');
            createLocalStorage();
            createOptionStorage(); // 同时创建option数据
        }
    }

    // 创建本地存储
    function createLocalStorage() {
        try {
            // 直接创建默认数据 {"id":"1"}
            plus.storage.setItem('meetingData', JSON.stringify({id: "1"}));
            console.log('已创建默认本地存储数据');
            updateLoadingText('数据初始化完成，正在启动应用...');
            navigateToService();
        } catch (e) {
            console.error('创建本地存储失败:', e);
            showError('系统初始化失败');
            setTimeout(() => {
                plus.nativeUI.alert('初始化数据失败，请重启应用', function() {
                    plus.runtime.quit();
                }, '错误');
            }, 1000);
        }
    }

    // 创建option本地存储
    function createOptionStorage() {
        try {
            // 创建默认option数据
            const defaultOption = {
                option: {
                    server: '192.168.110.10',
                    intertime: '10',
                    titleText: '政协阜新市委员会' // 默认标题文字
                }
            };
            plus.storage.setItem('option', JSON.stringify(defaultOption));
            console.log('已创建默认option数据:', JSON.stringify(defaultOption));
        } catch (e) {
            console.error('创建option存储失败:', e);
            showError('系统配置初始化失败');
            setTimeout(() => {
                plus.nativeUI.alert('初始化配置失败，请重启应用', function() {
                    plus.runtime.quit();
                }, '错误');
            }, 1000);
        }
    }

    // 创建本地存储函数已在上方定义

    // 跳转到service页面
    function navigateToService() {
        plus.webview.open('service.html', 'service', {
            scrollIndicator: 'none',
            scalable: false
        });
    }

    // 启动检查
    checkLocalStorage();
});
