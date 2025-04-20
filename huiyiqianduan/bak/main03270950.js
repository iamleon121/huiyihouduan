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

document.addEventListener('DOMContentLoaded', function() {
    updateTime();
    setInterval(updateTime, 1000);
});

function getJsonData() {
    if (!initializePlus()) {
        console.error('plus对象未初始化');
        return;
    }

    try {
        const url = 'http://123.56.40.178/data.json';
        const dtask = plus.downloader.createDownload(url, {}, function(d, status) {
            if (status == 200) {
                plus.io.resolveLocalFileSystemURL(d.filename, function(entry) {
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            try {
                                const jsonData = JSON.parse(e.target.result);
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
                                } else {
                                    console.log('会议ID未变化，保持当前内容');
                                }
                            } catch (error) {
                                console.error('JSON解析错误：', error);
                                plus.nativeUI.toast('数据解析失败');
                            }
                        }
                        reader.readAsText(file);
                    });
                });
            } else {
                console.error('下载JSON文件失败，状态码：' + status);
                plus.nativeUI.toast('数据下载失败');
            }
        });
        dtask.start();
    } catch (error) {
        console.error('下载任务创建失败：', error);
    }
}

// 所有涉及plus的操作都放在plusready事件中
document.addEventListener('plusready', function() {
    if (!initializePlus()) return;

    window.openMeetingDetail = function() {
        if (!initializePlus()) {
            plus.nativeUI.toast('系统未就绪，请稍后再试');
            return;
        }
        plus.webview.open('list.html', 'list', {});
    }
    
    // 立即执行一次获取数据
    getJsonData();
    // 每10秒执行一次获取数据
    setInterval(getJsonData, 10000);
});