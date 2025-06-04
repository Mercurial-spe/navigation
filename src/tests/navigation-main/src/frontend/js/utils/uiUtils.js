/**
 * UI工具模块 - 负责处理UI相关的工具函数
 */

// 消息自动消失的延迟时间（毫秒）
const MESSAGE_TIMEOUT = 3000;

/**
 * 创建缩放信息提示
 * @param {HTMLElement} container - 父容器元素
 * @returns {HTMLElement} 创建的缩放信息元素
 */
function createScaleInfo(container) {
  const scaleInfo = document.getElementById('scale-info') || document.createElement('div');
  
  if (!scaleInfo.id) {
    scaleInfo.id = 'scale-info';
    scaleInfo.textContent = '缩放: 1.000';
    container.appendChild(scaleInfo);
  }
  
  return scaleInfo;
}

/**
 * 更新缩放信息
 * @param {HTMLElement} scaleInfo - 缩放信息元素
 * @param {number} ratio - 缩放比例
 */
function updateScaleInfo(scaleInfo, ratio) {
  scaleInfo.textContent = `缩放: ${ratio.toFixed(3)}`;
}

/**
 * 显示加载消息
 * @param {HTMLElement} container - 父容器元素
 * @param {string} message - 消息文本
 * @returns {HTMLElement} 创建的消息元素
 */
function showLoadingMessage(container, message) {
  // 移除可能存在的相同ID元素
  removeElement('loading-nearby');
  
  const loadingElement = document.createElement('div');
  loadingElement.id = 'loading-nearby';
  loadingElement.className = 'loading';
  loadingElement.textContent = message;
  
  container.appendChild(loadingElement);
  return loadingElement;
}

/**
 * 显示结果消息
 * @param {HTMLElement} container - 父容器元素
 * @param {string} message - 消息文本
 * @returns {HTMLElement} 创建的消息元素
 */
function showResultMessage(container, message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message success';
  messageElement.textContent = message;
  container.appendChild(messageElement);
  
  // 添加到控制台
  addConsoleMessage(message, 'success');
  
  // 2秒后自动移除消息
  setTimeout(() => {
    messageElement.style.opacity = '0';
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300);
  }, 2000);
}

/**
 * 显示错误消息
 * @param {HTMLElement} container - 父容器元素
 * @param {string} message - 消息文本
 * @returns {HTMLElement} 创建的消息元素
 */
function showErrorMessage(container, message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message error';
  messageElement.textContent = message;
  container.appendChild(messageElement);
  
  // 添加到控制台
  addConsoleMessage(message, 'error');
  
  // 3秒后自动移除消息
  setTimeout(() => {
    messageElement.style.opacity = '0';
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300);
  }, 3000);
}

/**
 * 显示通用消息
 * @param {HTMLElement} container - 父容器元素
 * @param {string} message - 消息文本
 * @param {string} type - 消息类型（success或error）
 * @returns {HTMLElement} 创建的消息元素
 */
function showMessage(container, message, type = '') {
  // 移除之前的消息
  removeElement('message');
  
  const messageElement = document.createElement('div');
  messageElement.id = 'message';
  messageElement.className = `message ${type}`;
  messageElement.textContent = message;
  
  container.appendChild(messageElement);
  
  // 设置自动消失
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.style.opacity = '0';
      setTimeout(() => removeElement('message'), 300);
    }
  }, MESSAGE_TIMEOUT);
  
  return messageElement;
}

/**
 * 创建并显示一个信息框
 * @param {Object} data - 要在信息框中显示的数据对象
 * @param {string} title - 信息框的标题 (可选)
 * @param {number} x - 信息框的 x 坐标 (可选, 仅当需要动态定位时)
 * @param {number} y - 信息框的 y 坐标 (可选, 仅当需要动态定位时)
 * @returns {HTMLElement} 创建的信息框元素
 */
function showInfoBox(data, title = '详细信息', x = null, y = null) {
  // 移除已存在的信息框
  removeElement('info-box-container');

  const infoBoxContainer = document.createElement('div');
  infoBoxContainer.id = 'info-box-container';
  infoBoxContainer.className = 'info-box-container';

  const infoBox = document.createElement('div');
  infoBox.className = 'info-box';

  const INFO_BOX_TIMEOUT = 5000; // 信息框自动消失时间 (毫秒)
  let autoCloseTimer = null;

  function closeInfoBox() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
    if (infoBoxContainer.parentNode) {
      infoBoxContainer.style.opacity = '0';
      // infoBox.style.transform = 'translateY(-10px)'; // 可选: 向上移出动画
      setTimeout(() => {
        if (infoBoxContainer.parentNode) {
          infoBoxContainer.parentNode.removeChild(infoBoxContainer);
        }
      }, 300); // 等待动画完成
    }
  }

  // 如果提供了 x 和 y 坐标，则进行定位
  if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
    // 简单的偏移，避免直接在鼠标指针下生成，可以根据需要调整
    const offsetX = 0;
    const offsetY = 0;
    infoBox.style.left = `${x + offsetX}px`;
    infoBox.style.top = `${y + offsetY}px`;

    // 确保信息框不会超出屏幕边界
    // 延迟获取尺寸，确保元素已渲染
    setTimeout(() => {
        const boxRect = infoBox.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        if (boxRect.right > bodyRect.right - 10) { // 10px buffer
            infoBox.style.left = `${document.body.clientWidth - boxRect.width - 10}px`;
        }
        if (boxRect.left < 10) {
             infoBox.style.left = `10px`;
        }
        if (boxRect.bottom > bodyRect.bottom - 10) {
            infoBox.style.top = `${document.body.clientHeight - boxRect.height - 10}px`;
        }
        if (boxRect.top < 10) {
            infoBox.style.top = `10px`;
        }
    }, 0);

  } else {
    // 如果没有提供坐标或坐标无效，则居中显示
    console.warn('InfoBox: 无效或缺失坐标，信息框将居中显示。', `X: ${x}, Y: ${y}`);
    infoBox.style.left = '50%';
    infoBox.style.top = '50%';
    infoBox.style.transform = 'translate(-50%, -50%)';
  }

  // 添加标题
  const titleElement = document.createElement('h3');
  titleElement.textContent = title;
  infoBox.appendChild(titleElement);

  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.className = 'info-box-close';
  closeButton.innerHTML = '&times;'; 
  closeButton.onclick = closeInfoBox; // 点击关闭按钮时关闭
  infoBox.appendChild(closeButton);

  // 添加数据内容
  const contentElement = document.createElement('ul');
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const listItem = document.createElement('li');
      listItem.innerHTML = `<strong>${key}:</strong> ${data[key]}`;
      contentElement.appendChild(listItem);
    }
  }
  infoBox.appendChild(contentElement);

  infoBoxContainer.appendChild(infoBox);
  // 将信息框附加到 document.body 以确保 z-index 和 fixed positioning 生效
  document.body.appendChild(infoBoxContainer);

  // 设置自动消失
  autoCloseTimer = setTimeout(closeInfoBox, INFO_BOX_TIMEOUT);

  return infoBoxContainer;
}

/**
 * 移除元素
 * @param {string} elementId - 要移除元素的ID
 */
function removeElement(elementId) {
  const element = document.getElementById(elementId);
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 创建控制按钮
 * @param {HTMLElement} container - 父容器元素
 * @param {string} id - 按钮ID
 * @param {string} text - 按钮文本
 * @param {Function} clickHandler - 点击处理函数
 * @param {Object} position - 位置对象，包含top、left和right属性
 * @returns {HTMLElement} 创建的按钮元素
 */
function createControlButton(container, id, text, clickHandler, position) {
  const button = document.createElement('button');
  button.id = id;
  button.className = 'control-button';
  button.textContent = text;
  
  // 只有传递position参数时才设置绝对定位
  if (position) {
    button.style.position = 'absolute';
    if (position.top) button.style.top = position.top;
    if (position.right !== undefined) {
      button.style.right = position.right;
    } else if (position.left !== undefined) {
      button.style.left = position.left;
    }
  }
  
  button.addEventListener('click', clickHandler);
  
  container.appendChild(button);
  return button;
}

/**
 * 添加消息到控制台
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 (普通消息不需要，可选: 'error', 'warning', 'success')
 */
function addConsoleMessage(message, type = '') {
  const consoleOutput = document.getElementById('consoleOutput');
  if (!consoleOutput) return;
  
  const lineElement = document.createElement('div');
  lineElement.className = `console-line ${type}`;
  
  // 添加时间戳
  const now = new Date();
  const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
  
  lineElement.textContent = `${timestamp} ${message}`;
  consoleOutput.appendChild(lineElement);
  
  // 添加后强制触发滚动条刷新
  consoleOutput.style.overflow = 'hidden';
  setTimeout(() => {
    consoleOutput.style.overflow = 'scroll';
    // 自动滚动到底部
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }, 0);
}

export {
  createScaleInfo,
  updateScaleInfo,
  showLoadingMessage,
  showResultMessage,
  showErrorMessage,
  showMessage,
  showInfoBox,
  removeElement,
  createControlButton,
  addConsoleMessage
}; 