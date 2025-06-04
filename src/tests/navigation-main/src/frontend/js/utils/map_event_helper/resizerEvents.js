import { addConsoleMessage } from '../uiUtils.js';

/**
 * 全局调整Sigma.js渲染器尺寸的函数，便于多处共享
 * @param {Object} mapData - 包含渲染器的地图数据对象
 */
function resizeSigmaRenderers(mapData) {
  if (mapData && mapData.clusterRenderer && mapData.originalRenderer) {
    const clusterRenderer = mapData.clusterRenderer;
    const originalRenderer = mapData.originalRenderer;
    const mapContainer = document.getElementById('map-container');
    
    // 确保容器存在
    if (!mapContainer) return;
    
    // 获取容器和画布
    const clusterDom = clusterRenderer.getContainer();
    const originalDom = originalRenderer.getContainer();
    const mapWidth = mapContainer.offsetWidth;
    const mapHeight = mapContainer.offsetHeight;
    
    // 触发全局尺寸调整事件
    const resizeEvent = new Event('resize');
    window.dispatchEvent(resizeEvent);
    
    // 调整集群图层的尺寸
    if (clusterDom) {
      const canvas = clusterDom.querySelector('canvas');
      if (canvas) {
        canvas.width = mapWidth;
        canvas.height = mapHeight;
      }
    }
    
    // 调整原始图层的尺寸
    if (originalDom) {
      const canvas = originalDom.querySelector('canvas');
      if (canvas) {
        canvas.width = mapWidth;
        canvas.height = mapHeight;
      }
    }
    
    console.log(`渲染器大小已调整为 ${mapWidth}x${mapHeight}`);
  }
}

/**
 * 初始化分隔条调整功能
 * @param {Object} mapData - 包含渲染器等数据的地图对象
 */
function initResizers(mapData) {
  const mainResizer = document.getElementById('main-resizer');
  const mapContainer = document.getElementById('map-container');
  const bottomSection = document.querySelector('.bottom-section');
  
  if (!mainResizer || !mapContainer || !bottomSection) {
    console.error('找不到必要的DOM元素，无法初始化分隔条');
    return;
  }
  
  let startY = 0;
  let startHeight = 0;
  let startBottomHeight = 0;
  
  const onMouseDown = function(e) {
    // 记录初始位置和高度
    startY = e.clientY;
    startHeight = mapContainer.offsetHeight;
    startBottomHeight = bottomSection.offsetHeight;
    
    // 添加事件监听
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // 添加拖动时的样式
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    mainResizer.classList.add('active');
    
    // 阻止默认事件和冒泡
    e.preventDefault();
    e.stopPropagation();
    
    // 记录到控制台
    addConsoleMessage('开始调整区域大小');
  };
  
  const onMouseMove = function(e) {
    // 计算移动的距离
    const deltaY = e.clientY - startY;
    const containerHeight = mapContainer.parentElement.offsetHeight;
    
    // 计算新的高度（确保最小高度）
    const newMapHeight = Math.max(100, Math.min(containerHeight - 100, startHeight + deltaY));
    const newBottomHeight = containerHeight - newMapHeight;
    
    // 计算百分比
    const mapPercent = (newMapHeight / containerHeight) * 100;
    const bottomPercent = 100 - mapPercent;
    
    // 应用新的高度 - 只更新CSS样式，保持流畅拖动
    mapContainer.style.height = `${mapPercent}%`;
    bottomSection.style.top = `${mapPercent}%`;
    bottomSection.style.height = `${bottomPercent}%`;
    mainResizer.style.top = `${mapPercent}%`;
  
    e.preventDefault();
  };
  
  const onMouseUp = function() {
    // 移除事件监听
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // 移除拖动时的样式
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    mainResizer.classList.remove('active');
    
    // 拖动结束后更新渲染器尺寸
    console.log("拖动结束，更新渲染器大小");
    resizeSigmaRenderers(mapData);
    
    // 手动触发渲染器刷新以确保图谱正确显示
    if (mapData && mapData.clusterRenderer && mapData.originalRenderer) {
      mapData.clusterRenderer.refresh();
      mapData.originalRenderer.refresh();
      console.log("Sigma.js 渲染器已刷新 (拖动结束)");
    }
    
    // 记录到控制台
    const mapPercent = Math.round((mapContainer.offsetHeight / mapContainer.parentElement.offsetHeight) * 100);
    addConsoleMessage(`区域大小已调整为 ${mapPercent}:${100-mapPercent}`);
  };
  
  // 绑定鼠标按下事件
  mainResizer.addEventListener('mousedown', onMouseDown);
  
  // 双击重置为默认比例
  mainResizer.addEventListener('dblclick', function() {
    mapContainer.style.height = '60%';
    bottomSection.style.top = '60%';
    bottomSection.style.height = '40%';
    mainResizer.style.top = '60%';
    
    // 更新渲染器大小
    resizeSigmaRenderers(mapData);
    
    // 手动触发渲染器刷新
    if (mapData && mapData.clusterRenderer && mapData.originalRenderer) {
      mapData.clusterRenderer.refresh();
      mapData.originalRenderer.refresh();
      console.log("Sigma.js 渲染器已刷新 (双击重置)");
    }
    
    // 记录到控制台
    addConsoleMessage('区域大小已重置为默认比例 60:40');
  });
}

export { initResizers, resizeSigmaRenderers };
