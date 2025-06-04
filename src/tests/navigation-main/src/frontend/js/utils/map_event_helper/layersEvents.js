import { addConsoleMessage } from '../uiUtils.js';
import { switchToZoomLevel } from '../../renderers/mapRenderer.js';
import { findClosestZoomLevel } from './sigmaEvents.js';


// 用于存储和管理网格拥堵叠加层的状态
const gridOverlayState = {
  canvas: null,
  ctx: null,
  currentData: null,
  isInitialized: false
};

/**
 * 初始化网格拥堵叠加层
 * @param {Object} mapData - 地图数据对象，包含渲染器
 */
function initGridOverlay(mapData) {
  if (gridOverlayState.isInitialized) return;
  
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) {
    console.error('找不到地图容器');
    return;
  }
  
  // 创建Canvas元素
  const gridCanvas = document.createElement('canvas');
  gridCanvas.id = 'grid-congestion-overlay';
  gridCanvas.style.position = 'absolute';
  gridCanvas.style.top = '0';
  gridCanvas.style.left = '0';
  gridCanvas.style.zIndex = '7'; // 在集群图层（z-index: 10）下方，但在其他图层之上
  gridCanvas.style.pointerEvents = 'none'; // 确保不会捕获鼠标事件
  gridCanvas.width = mapContainer.offsetWidth;
  gridCanvas.height = mapContainer.offsetHeight;
  
  // 设置初始透明度
  gridCanvas.style.opacity = '0.6';
  
  // 将Canvas元素添加到地图容器中
  mapContainer.appendChild(gridCanvas);
  
  // 保存状态
  gridOverlayState.canvas = gridCanvas;
  gridOverlayState.ctx = gridCanvas.getContext('2d');
  gridOverlayState.isInitialized = true;
  
  // 为了响应地图容器大小变化，添加窗口大小变化事件监听器
  window.addEventListener('resize', () => {
    if (gridOverlayState.canvas && mapData) { // Ensure mapData is available
      gridOverlayState.canvas.width = mapContainer.offsetWidth;
      gridOverlayState.canvas.height = mapContainer.offsetHeight;
      
      // 如果有数据，重新渲染
      if (gridOverlayState.currentData) {
        renderGridCongestion(mapData, gridOverlayState.currentData);
      }
    }
  });
  
  console.log('网格拥堵叠加层初始化完成');
}

/**
 * 根据拥堵度获取对应的颜色
 * @param {number} congestionRatio - 拥堵度（0-1之间）
 * @returns {string} - 对应的颜色值（RGBA格式）
 */
function getCongestionColor(congestionRatio) {
  // 设置一个拥堵比率的范围，使颜色更明显
  let normalizedRatio = Math.min(1.0, Math.max(0, congestionRatio));
  
  // 根据比率生成颜色：从绿色过渡到黄色，再到红色
  let r, g, b;
  
  // 新的颜色分配逻辑：将 0.6 视为最高拥堵度，0-0.6 从绿色过渡到红色
  const maxCongestionForColor = 0.6; // 60% 视为最高拥堵度对应的颜色阈值

  if (normalizedRatio >= maxCongestionForColor) {
    // 拥堵度达到或超过 60%，设为纯红色 (255, 0, 0)
    r = 255;
    g = 0;
    b = 0;
  } else {
    // 拥堵度在 0% 到 60% 之间，从绿色通过黄色过渡到红色
    // 将拥堵度映射到 0-1 范围进行颜色计算，0对应0%，1对应60%
    const gradientRatio = normalizedRatio / maxCongestionForColor;

    if (gradientRatio < 0.5) {
      // 0% 到 30% (映射到 gradientRatio 0 到 0.5): 绿色 (0, 255, 0) 到黄色 (255, 255, 0)
      r = Math.floor(255 * (gradientRatio / 0.5));
      g = 255;
      b = 0;
    } else {
      // 30% 到 60% (映射到 gradientRatio 0.5 到 1): 黄色 (255, 255, 0) 到红色 (255, 0, 0)
      r = 255;
      g = Math.floor(255 * (1 - (gradientRatio - 0.5) / 0.5));
      b = 0;
    }
  }
  
  // 使用半透明度，以便看到底层地图
  return `rgba(${r}, ${g}, ${b}, 0.4)`;
}

/**
 * 渲染网格拥堵数据
 * @param {Object} mapData - 地图数据对象，包含渲染器
 * @param {Object} gridData - 网格拥堵数据
 */
async function renderGridCongestion(mapData, gridData,mode='cluster') {
  if (!gridOverlayState.isInitialized) {
    return
  }
  if (mode!='cluster') {
    return
  }

  if (!mapData || !mapData.clusterRenderer) {
    console.error('mapData or clusterRenderer is not available in renderGridCongestion');
    return;
  }
  const { clusterRenderer } = mapData;
  const { ctx, canvas } = gridOverlayState;
  
  if (!ctx || !canvas) { // clusterRenderer check is done above
    console.error('渲染网格拥堵失败：Canvas上下文或Canvas元素未初始化');
    return;
  }
  
  // 清除当前画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 存储数据以便在窗口大小变化时重新渲染
  gridOverlayState.currentData = gridData;
  
  if (!gridData || !gridData.cells) {
      console.warn('网格数据无效或不包含cells，无法渲染。');
      return;
  }

  // 遍历网格数据
  gridData.cells.forEach(cell => {
    // 计算拥堵度（当前车辆数/总容量）
    const congestionRatio = cell.total_capacity > 0 ? cell.current_vehicles / cell.total_capacity : 0;
    
    // 根据拥堵度获取颜色
    const fillColor = getCongestionColor(congestionRatio);
    
    // 获取网格的地理坐标边界
    const { west, south, east, north } = cell.bounds;
    
    // 将地理坐标转换为屏幕坐标
    const topLeft = clusterRenderer.graphToViewport({ x: west, y: north });
    const bottomRight = clusterRenderer.graphToViewport({ x: east, y: south });
    
    // 绘制网格矩形
    ctx.fillStyle = fillColor;
    
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    
    // Add a check for valid width and height
    if (width <= 0 || height <= 0) {
        // console.warn('Skipping cell rendering due to invalid dimensions:', cell.bounds, width, height);
        return; // Skip rendering this cell
    }

    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    
    // 如果需要，绘制边框
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    
    // 可选：在网格中显示拥堵率文本
    if (width > 30 && height > 20) { // 只在网格足够大时显示文本
      const congestionText = `${Math.round(congestionRatio * 100)}%`;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`拥堵: ${congestionText} (车辆: ${cell.current_vehicles}/${cell.total_capacity})`, topLeft.x + width / 2, topLeft.y + height / 2);
    }
  });
  
  // console.log(`已渲染 ${gridData.cells.length} 个网格的拥堵数据`);
}



/**
 * 切换图层显示模式
 * @param {string} layerType - 图层类型，可选值: 'mixed', 'original', 'cluster'
 * @param {Object} mapData - 地图数据对象
 */
function switchLayer(layerType, mapData) {
  const { originalGraph, clusterGraph, originalRenderer, clusterRenderer, state } = mapData;
  const originalLayer = document.getElementById("original-layer");
  const clusterLayer = originalRenderer.getContainer().parentElement.querySelector(':scope > div:not(#original-layer)');
  const root = document.documentElement; // 获取根元素，用于设置CSS变量

  if (!originalLayer || !clusterLayer) {
    console.error("找不到图层容器元素");
    return;
  }

  state.mapLiveActive = false;

  // 如果存在网格叠加图层，隐藏
  if (gridOverlayState.canvas) {
    gridOverlayState.canvas.style.display = 'none';
  }

  switch(layerType) {
    case 'original':
      originalLayer.style.opacity = "1";
      originalLayer.style.webkitMask = "none";
      originalLayer.style.mask = "none";
      originalLayer.style.zIndex = "10";
      clusterLayer.style.display = "none";
      clusterLayer.style.zIndex = "5";
      gridOverlayState.canvas.style.display = 'none';
      state.lastOriginalCameraState = originalRenderer.getCamera().getState();
      originalRenderer.refresh();
      // 设置原始图层主题色和背景色
      root.style.setProperty('--theme-color', getComputedStyle(root).getPropertyValue('--original-theme').trim());
      root.style.setProperty('--current-sidebar-bg', getComputedStyle(root).getPropertyValue('--original-sidebar-bg').trim());
      root.style.setProperty('--current-panel-bg', getComputedStyle(root).getPropertyValue('--original-panel-bg').trim());
      root.style.setProperty('--current-console-bg', getComputedStyle(root).getPropertyValue('--original-console-bg').trim());
      root.style.setProperty('--current-console-header-bg', getComputedStyle(root).getPropertyValue('--original-console-header-bg').trim());


      // 设置原始图层文本颜色
      root.style.setProperty('--current-sidebar-text', getComputedStyle(root).getPropertyValue('--original-sidebar-text').trim());
      root.style.setProperty('--current-panel-text', getComputedStyle(root).getPropertyValue('--original-panel-text').trim());
      root.style.setProperty('--current-console-text', getComputedStyle(root).getPropertyValue('--original-console-text').trim());
      root.style.setProperty('--current-heading-text', getComputedStyle(root).getPropertyValue('--original-heading-text').trim());
      break;

    case 'cluster':
      originalLayer.style.opacity = "0";
      originalLayer.style.zIndex = "5";
      clusterLayer.style.display = "block";
      clusterLayer.style.zIndex = "10";

      // 从 originalRenderer 同步镜头状态到 clusterRenderer
      const currentOriginalCameraState = originalRenderer.getCamera().getState();
      const clusterCamera = clusterRenderer.getCamera();

      clusterCamera.x = currentOriginalCameraState.x;
      clusterCamera.y = currentOriginalCameraState.y;
      clusterCamera.ratio = currentOriginalCameraState.ratio;

      state.lastClusterCameraState = clusterCamera.getState(); // 更新存储的集群图层最后镜头状态
      switchToZoomLevel(findClosestZoomLevel(clusterCamera.ratio, state.zoomThresholds), mapData);
      
      // 初始化网格叠加层，如果尚未初始化
      initGridOverlay(mapData);
      // WebSocket会推送数据，这里不再主动fetch. 
      if (gridOverlayState.canvas) {
        gridOverlayState.canvas.style.display = 'block';
      }

      clusterRenderer.refresh();

      // 设置集群图层主题色和背景色
      root.style.setProperty('--theme-color', getComputedStyle(root).getPropertyValue('--cluster-theme').trim());
      root.style.setProperty('--current-sidebar-bg', getComputedStyle(root).getPropertyValue('--cluster-sidebar-bg').trim());
      root.style.setProperty('--current-panel-bg', getComputedStyle(root).getPropertyValue('--cluster-panel-bg').trim());
      root.style.setProperty('--current-console-bg', getComputedStyle(root).getPropertyValue('--cluster-console-bg').trim());
      root.style.setProperty('--current-console-header-bg', getComputedStyle(root).getPropertyValue('--cluster-console-header-bg').trim());

      // 设置集群图层文本颜色
      root.style.setProperty('--current-sidebar-text', getComputedStyle(root).getPropertyValue('--cluster-sidebar-text').trim());
      root.style.setProperty('--current-panel-text', getComputedStyle(root).getPropertyValue('--cluster-panel-text').trim());
      root.style.setProperty('--current-console-text', getComputedStyle(root).getPropertyValue('--cluster-console-text').trim());
      root.style.setProperty('--current-heading-text', getComputedStyle(root).getPropertyValue('--cluster-heading-text').trim());
      break;

    case 'mixed':
    default:
      state.mapLiveActive = true;
      originalLayer.style.opacity = "1";
      originalLayer.style.zIndex = "10";
      clusterLayer.style.display = "block";
      clusterLayer.style.zIndex = "5";
      gridOverlayState.canvas.style.display = 'none';

      // 从 clusterRenderer 同步镜头状态到 originalRenderer
      const currentClusterCameraState = clusterRenderer.getCamera().getState();
      const originalCamera = originalRenderer.getCamera();

      originalCamera.x = currentClusterCameraState.x;
      originalCamera.y = currentClusterCameraState.y;
      originalCamera.ratio = currentClusterCameraState.ratio;

      state.lastOriginalCameraState = originalCamera.getState();
      const activeMaskStyle = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 100%)`;
      originalLayer.style.webkitMask = activeMaskStyle;
      originalLayer.style.mask = activeMaskStyle;
      originalRenderer.refresh();
      clusterRenderer.refresh();

      // 设置混合图层主题色和背景色
      root.style.setProperty('--theme-color', getComputedStyle(root).getPropertyValue('--mixed-theme').trim());
      root.style.setProperty('--current-sidebar-bg', getComputedStyle(root).getPropertyValue('--mixed-sidebar-bg').trim());
      root.style.setProperty('--current-panel-bg', getComputedStyle(root).getPropertyValue('--mixed-panel-bg').trim());
      root.style.setProperty('--current-console-bg', getComputedStyle(root).getPropertyValue('--mixed-console-bg').trim());
      root.style.setProperty('--current-console-header-bg', getComputedStyle(root).getPropertyValue('--mixed-console-header-bg').trim());

      // 设置混合图层文本颜色
      root.style.setProperty('--current-sidebar-text', getComputedStyle(root).getPropertyValue('--mixed-sidebar-text').trim());
      root.style.setProperty('--current-panel-text', getComputedStyle(root).getPropertyValue('--mixed-panel-text').trim());
      root.style.setProperty('--current-console-text', getComputedStyle(root).getPropertyValue('--mixed-console-text').trim());
      root.style.setProperty('--current-heading-text', getComputedStyle(root).getPropertyValue('--mixed-heading-text').trim());
      break;
  }

  state.currentLayer = layerType;
  console.log(`图层已切换到 ${layerType}`);
}

/**
 * 初始化图层切换相关的事件监听器
 * @param {Object} mapData - 地图数据对象
 */
function initLayerSwitchEvents(mapData) {
  const { state } = mapData;
  const mapLiveBtn = document.getElementById("mapLive");

  if (mapLiveBtn) {
    // 设置初始状态
    mapLiveBtn.textContent = '切换图层: 原始';
    mapLiveBtn.classList.add('active');

    mapLiveBtn.addEventListener('click', function() {
      // 三种图层类型切换：mixed -> original -> cluster -> mixed
      switch(state.currentLayer) {
        case 'mixed':
          // state.currentLayer = 'original'; // state.currentLayer is updated in switchLayer
          switchLayer('original', mapData);
          mapLiveBtn.textContent = '切换图层: 原始';
          break;
        case 'original':
          // state.currentLayer = 'cluster'; // state.currentLayer is updated in switchLayer
          switchLayer('cluster', mapData);
          mapLiveBtn.textContent = '切换图层: 集群';
          break;
        case 'cluster':
        default:
          // state.currentLayer = 'mixed'; // state.currentLayer is updated in switchLayer
          switchLayer('mixed', mapData);
          mapLiveBtn.textContent = '切换图层: 混合';
          break;
      }

      // 添加到控制台
      addConsoleMessage(`已切换到${state.currentLayer === 'mixed' ? '混合' : (state.currentLayer === 'original' ? '原始' : '集群')}图层`);
    });
    
    // 监听集群渲染器的相机更新事件，更新网格拥堵叠加层
    if (mapData.clusterRenderer) {
      mapData.clusterRenderer.getCamera().on("updated", () => {
        if (state.currentLayer === 'cluster' && gridOverlayState.currentData && gridOverlayState.isInitialized) {
          renderGridCongestion(mapData, gridOverlayState.currentData);
        }
      });
    }
  }
}

export { switchLayer, initLayerSwitchEvents, renderGridCongestion };
