// 显示错误信息的函数
function showErrorMessage(message) {
    const fileContent = document.getElementById('fileContent');
    fileContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="color: #666; margin-bottom: 20px;">${message}</div>
            <button onclick="goBack()" style="background-color: #ff6b00; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#ff8533'" onmouseout="this.style.backgroundColor='#ff6b00'">返回列表</button>
        </div>
    `;
}

// 返回函数
function goBack() {
    if (typeof plus !== 'undefined') {
        console.log('返回list页面');
        plus.webview.close('file');
    } else {
        console.log('返回上一页');
        window.history.back();
    }
}

document.addEventListener('plusready', function() {
    // 检查并创建私有文档目录，同时列出目录中的文件
    plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
        fs.root.getDirectory('documents', { create: true }, function(dirEntry) {
            console.log('私有文档目录已就绪');
            
            // 创建目录读取器
            const directoryReader = dirEntry.createReader();
            
            // 读取目录内容
            directoryReader.readEntries(function(entries) {
                console.log('documents目录文件列表：');
                const urlParams = new URLSearchParams(window.location.search);
                const searchFilename = urlParams.get('filename');
                const searchJpgFilename = searchFilename ? searchFilename + '.jpg' : null;
                
                console.log('正在查找的文件名：', searchJpgFilename);
                
                let fileFound = false;
                entries.forEach(function(entry) {
                    console.log(`目录中的文件：${entry.name}, 类型：${entry.isDirectory ? '目录' : '文件'}`);
                    
                    if (searchJpgFilename && entry.name === searchJpgFilename) {
                        fileFound = true;
                        console.log('找到匹配的文件！');
                    } else if (searchJpgFilename) {
                        console.log(`文件名差异：\n期望文件名：${searchJpgFilename}\n实际文件名：${entry.name}`);
                    }
                });
                
                if (searchJpgFilename && !fileFound) {
                    console.log('警告：未在目录中找到要查找的文件！');
                }
            }, function(error) {
                console.error('读取目录内容失败：', error);
            });
        }, function(error) {
            console.error('创建私有文档目录失败：', error);
            showErrorMessage('无法创建文件存储目录');
        });
    }, function(error) {
        console.error('获取文件系统失败：', error);
        showErrorMessage('无法访问文件系统');
    });

    // 禁止返回
    plus.key.addEventListener('backbutton', function() {
        console.log('返回list页面');
        plus.webview.close('file');
    }, false);

    // 从URL获取文件名参数
    const urlParams = new URLSearchParams(window.location.search);
    const filename = urlParams.get('filename');
    
    if (filename) {
        const jpgFilename = filename + '.jpg';
        console.log('当前加载的文件名：', jpgFilename);
        
        // 检查文件是否存在于documents目录
        plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
            fs.root.getDirectory('documents', { create: false }, function(dirEntry) {
                const filePath = '_doc/documents/' + jpgFilename;
                plus.io.resolveLocalFileSystemURL(filePath, function(entry) {
                    console.log('文件存在：', jpgFilename);
                    // 读取文件内容
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            // 读取完成，显示图片内容
                            const fileContent = document.getElementById('fileContent');
                            fileContent.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: auto; display: block; margin: 0; padding: 0;">`;
                        };
                        reader.onerror = function(e) {
                            console.error('读取文件内容失败：', e);
                            tryReadFromStorage();
                        };
                        reader.readAsDataURL(file);
                    }, function(error) {
                        console.error('获取文件对象失败：', error);
                        tryReadFromStorage();
                    });
                }, function(error) {
                    console.error('文件不存在：', jpgFilename, error);
                    tryReadFromStorage();
                });
            }, function(error) {
                console.error('访问documents目录失败：', error);
                tryReadFromStorage();
            });
        }, function(error) {
            console.error('获取文件系统失败：', error);
            tryReadFromStorage();
        });
        // 更新标题
        const headerTitle = document.querySelector('.header-title');
        if (headerTitle) {
            headerTitle.textContent = filename;
        }
        
        // 从本地存储获取文件内容的函数
        function tryReadFromStorage() {
            if (typeof plus !== 'undefined' && plus.storage) {
                try {
                    const fileContent = plus.storage.getItem(filename);
                    if (fileContent) {
                        document.getElementById('fileContent').textContent = fileContent;
                    } else {
                        showErrorMessage('未找到文件内容');
                    }
                } catch (error) {
                    console.error('读取本地存储文件内容失败：', error);
                    showErrorMessage('读取文件内容失败');
                }
            } else {
                showErrorMessage('无法访问本地存储');
            }
        }
    } else {
        showErrorMessage('未指定文件名');
    }
});

// 在非plus环境下的返回按钮事件处理
// 更新当前时间的函数
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    document.getElementById('current-time').textContent = timeString;
}

// 在DOMContentLoaded事件中添加放大镜功能
document.addEventListener('DOMContentLoaded', function() {
    // 禁用右键菜单和长按选择
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    document.addEventListener('touchstart', function(e) {
        // 移除preventDefault调用以允许触摸事件正常工作
    }, { passive: true });

    // 绑定返回按钮事件
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (typeof plus !== 'undefined') {
                console.log('返回list页面');
                plus.webview.close('file');
            } else {
                console.log('返回上一页');
                window.history.back();
            }
        });
    }
    
    // 初始化时间显示并设置定时器
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // 添加放大镜功能
    initMagnifier();
});

// 初始化放大镜功能
function initMagnifier() {
    const fileContent = document.getElementById('fileContent');
    let longPressTimer;
    let magnifier = null;
    let isLongPress = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const LONG_PRESS_DURATION = 1500; // 修改为2秒
    const MOVE_THRESHOLD = 10; // 移动阈值，超过这个距离则取消长按
    
    // 创建放大镜元素
    function createMagnifier() {
        if (magnifier) return;
        
        magnifier = document.createElement('div');
        magnifier.id = 'magnifier';
        magnifier.style.cssText = `
            position: absolute;
            width: 300px;
            height: 160px;
            background-repeat: no-repeat;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 1001;
            pointer-events: none;
            display: none;
            border: 2px solid #fff;
            overflow: hidden;
        `;
        document.body.appendChild(magnifier);
    }
    
    // 触摸开始事件
    fileContent.addEventListener('touchstart', function(e) {
        const img = fileContent.querySelector('img');
        if (!img) return;
        
        createMagnifier();
        
        clearTimeout(longPressTimer);
        isLongPress = false;
        
        // 记录初始触摸位置
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        longPressTimer = setTimeout(function() {
            isLongPress = true;
            updateMagnifier(touch, img);
            magnifier.style.display = 'block';
        }, LONG_PRESS_DURATION);
    }, { passive: false });
    
    // 触摸移动事件
    fileContent.addEventListener('touchmove', function(e) {
        if (isLongPress) {
            e.preventDefault(); // 阻止页面滚动
            
            const touch = e.touches[0];
            const img = fileContent.querySelector('img');
            if (!img) return;
            
            updateMagnifier(touch, img);
            return;
        }
        
        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);
        
        // 如果移动距离超过阈值，取消长按
        if (moveX > MOVE_THRESHOLD || moveY > MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            if (magnifier) {
                magnifier.style.display = 'none';
            }
            isLongPress = false;
        }
    }, { passive: false });
    
    // 触摸结束事件
    fileContent.addEventListener('touchend', function() {
        clearTimeout(longPressTimer);
        if (magnifier) {
            magnifier.style.display = 'none';
        }
        isLongPress = false;
    });
    
    // 触摸取消事件
    fileContent.addEventListener('touchcancel', function() {
        clearTimeout(longPressTimer);
        if (magnifier) {
            magnifier.style.display = 'none';
        }
        isLongPress = false;
    });
    
    // 更新放大镜位置和内容
    function updateMagnifier(touch, img) {
        const imgRect = img.getBoundingClientRect();
        const touchX = touch.clientX - imgRect.left;
        const touchY = touch.clientY - imgRect.top;
        
        if (touchX < 0 || touchX > imgRect.width || touchY < 0 || touchY > imgRect.height) {
            magnifier.style.display = 'none';
            return;
        }
        
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const magX = touch.clientX - 120;
        const magY = touch.clientY + scrollY - 200;
        
        magnifier.style.left = `${magX}px`;
        magnifier.style.top = `${magY}px`;
        
        const zoom = 2;
        const bgX = -touchX * zoom + 120;
        const bgY = -touchY * zoom + 80;
        
        magnifier.style.backgroundImage = `url(${img.src})`;
        magnifier.style.backgroundSize = `${imgRect.width * zoom}px ${imgRect.height * zoom}px`;
        magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }
}