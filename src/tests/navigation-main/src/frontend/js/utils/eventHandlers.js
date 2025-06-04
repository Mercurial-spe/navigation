/**
 * 事件处理模块 - 负责处理各种用户交互事件
 */
import { fetchNearbyNodesData, listenToSocket, fetchShortestPath } from '../api/apiService.js';
import { highlightNearbyNodes, resetNodeAndEdgeColors, highlightEdges, COLORS } from './renderHelper.js';
import { showLoadingMessage, showResultMessage, showErrorMessage, removeElement, updateScaleInfo, addConsoleMessage } from './uiUtils.js';
import { switchToZoomLevel, updateTrafficOnEdges } from '../renderers/mapRenderer.js';
import { initSigmaEventHandlers, findClosestZoomLevel } from './map_event_helper/sigmaEvents.js';
import { initLayerSwitchEvents, switchLayer } from './map_event_helper/layersEvents.js';
import { initTrafficEvents } from './map_event_helper/trafficEvents.js';
import { initShortestPathEvents } from './map_event_helper/shortestEvents.js';
import { initSidebarToggle } from './map_event_helper/sidebarEvents.js';
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';
import { initResizers } from './map_event_helper/resizerEvents.js';

// 全局调整Sigma.js渲染器尺寸的函数，便于多处共享
// 移除全局的 resizeSigmaRenderers 函数，已移至 resizerEvents.js

/**
 * 初始化事件监听器
 * @param {Object} mapData - 包含clusterGraph、originalGraph、clusterRenderer、originalRenderer、container和state的对象
 */
function initEventListeners(mapData) {
  const { clusterGraph, originalGraph, clusterRenderer, originalRenderer, container, state } = mapData;
  
  // 保存地图数据的全局引用
  window.mapData = mapData;
  
  // 初始化地图实况查看开关状态
  state.mapLiveActive = false;
  // 初始化当前图层类型，支持三种模式：'mixed'(混合), 'original'(原始), 'cluster'(集群)
  state.currentLayer = 'original';
  state.lastOriginalCameraState = originalRenderer.getCamera().getState();
  state.lastClusterCameraState = clusterRenderer.getCamera().getState();
  // 初始化缩放等级和阈值 (示例，这些值应该在mapData或配置中定义)
  state.zoomThresholds = [ 0.3, 0.5, 1]; 
  state.currentZoomLevel = findClosestZoomLevel(originalRenderer.getCamera().getState().ratio, state.zoomThresholds);
  
  // 设置初始原始图层主题色
  const root = document.documentElement;
  root.style.setProperty('--theme-color', getComputedStyle(root).getPropertyValue('--original-theme').trim());
  

  // 初始化 Sigma.js 相关事件
  initSigmaEventHandlers(mapData);

  // 初始化可调整分隔条 - 传递 mapData 参数
  initResizers(mapData);
  
  // 初始化侧边栏切换功能
  initSidebarToggle();
  
  // 初始化图层切换事件
  initLayerSwitchEvents(mapData);
  
  // 初始化交通事件
  initTrafficEvents(mapData);

  // 初始化最短路径事件
  initShortestPathEvents(mapData);
  
  //初始化侧边栏事件
  initSidebarToggle();
  
  // 阻止浏览器默认右键菜单
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // 绑定控制台清空按钮事件
  const clearConsoleBtn = document.getElementById("clearConsole");
  if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', function() {
      const consoleOutput = document.getElementById("consoleOutput");
      if (consoleOutput) {
        consoleOutput.innerHTML = '';
        addConsoleMessage("控制台已清空");
      }
    });
  }
  
  // 保存鼠标移动事件处理函数引用，便于后期解绑或重绑定
  const mouseMoveHandler = function(e) {
    // console.log("mouseMoveHandler 触发"); // 添加日志
    // 只有在地图实况激活时才响应鼠标移动事件
    if (state.mapLiveActive) {
      const rect = this.getBoundingClientRect();
      state.currentMousePosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // 在鼠标移动时更新遮罩
      const centerX = state.currentMousePosition.x;
      const centerY = state.currentMousePosition.y;
      const maskRadius = 30/(originalRenderer.getCamera().getState().ratio); // 使用固定值
      
      // 应用径向渐变遮罩
      const maskStyle = 
        `radial-gradient(circle at ${centerX}px ${centerY}px, 
         rgba(0,0,0,1) 0px, rgba(0,0,0,1) ${maskRadius}px,
         rgba(0,0,0,0.2) ${maskRadius + 1}px, rgba(0,0,0,0.2) 100%)`;
      
      this.style.webkitMask = maskStyle;
      this.style.mask = maskStyle;
    }
  };
  
  // 保存鼠标离开事件处理函数引用
  const mouseLeaveHandler = function() {
    // 只有在地图实况激活时才响应鼠标离开事件
    if (state.mapLiveActive) {
      // 恢复全屏遮蔽，但保留0.2可见度
      const fullMaskStyle = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 100%)`;
      this.style.webkitMask = fullMaskStyle;
      this.style.mask = fullMaskStyle;
      console.log("鼠标离开图层，恢复遮蔽状态");
    }
  };
  
  // 添加鼠标移动和离开事件监听
  state.currentMousePosition = { x: 0, y: 0 };
  document.getElementById("original-layer").addEventListener('mousemove', mouseMoveHandler);
  document.getElementById("original-layer").addEventListener('mouseleave', mouseLeaveHandler);
  
  // 初始化相机状态，保存引用
  state.lastCameraState = originalRenderer.getCamera().getState();
  
  // 标记是否已添加平移限制
  state.hasPanLimitation = false;
  

  
}

/**
 * 处理获取附近节点的请求
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} count - 获取节点数量
 * @param {Object} mapData - 包含图形、渲染器等数据的对象
 */
async function handleNearbyNodesRequest(x, y, count, mapData) {
  const { clusterGraph, originalGraph, clusterRenderer, originalRenderer, container } = mapData;
  console.log(`获取坐标(${x}, ${y})附近的${count}个节点`);
  
  // 显示加载提示
  showLoadingMessage(container, '加载附近节点...');
  
  try {
    // 获取附近节点数据
    const data = await fetchNearbyNodesData(x, y, count);
    console.log(`获取到${data.nodes.length}个附近节点和${data.edges.length}条边`);
    
    // 清除之前的高亮状态
    // resetNodeAndEdgeColors(clusterGraph, clusterRenderer);
    // 同时清除原始图层的高亮状态
    resetNodeAndEdgeColors(originalGraph, originalRenderer);
    
    // 在两个图层上都高亮显示双击的节点和附近节点及边
    // highlightNearbyNodes(clusterGraph, data.nodes, data.edges);
    highlightNearbyNodes(originalGraph, data.nodes, data.edges);
    
    originalRenderer.refresh();
    console.log("handleNearbyNodesRequest: clusterRenderer.refresh() and originalRenderer.refresh() called"); // 添加日志
    
    // 移除加载提示
    removeElement('loading-nearby');
    
    // 显示结果提示
    showResultMessage(container, `显示附近${data.nodes.length}个节点和${data.edges.length}条边`);
    
    return data; // 返回获取到的数据
    
  } catch (error) {
    console.error('获取附近节点失败:', error);
    
    // 移除加载提示
    removeElement('loading-nearby');
    
    // 显示错误提示
    showErrorMessage(container, `获取附近节点失败: ${error.message}`);
    return null; // 发生错误时返回 null
  }
}

export { initEventListeners, handleNearbyNodesRequest };