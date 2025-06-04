import { addConsoleMessage } from '../uiUtils.js';
import { updateTrafficOnEdges } from '../../renderers/mapRenderer.js';
import { listenToSocket } from '../../api/apiService.js';
// 导入来自 layersEvents.js 的渲染函数
import { renderGridCongestion } from './layersEvents.js'; 

// 定义处理交通更新的函数
function handleTrafficUpdate(data) {
  // console.log('收到交通更新数据:', data);
  if (data && data.edges) {
    // console.log(`收到 ${data.edges.length} 条边的交通更新数据`);
    // addConsoleMessage(`收到${data.edges.length}条边的交通更新数据`);
    
    // 调用渲染函数更新边的颜色
    if (window.mapData) { // 确保 mapData 可用
      updateTrafficOnEdges(window.mapData, data.edges);
    } else {
      console.warn('mapData 不可用，无法更新交通数据视图。');
    }
  }
}

// 定义处理网格拥堵数据更新的函数
function handleGridCongestionUpdate(data) {
  // console.log('收到网格拥堵更新数据:', data);
  if (data && data.cells) {
    if (window.mapData) { // 确保 mapData 可用
      // 调用 layersEvents.js 中的渲染函数
      renderGridCongestion(window.mapData, data);
    } else {
      console.warn('mapData 不可用，无法更新网格拥堵视图。');
    }
  }
}

/**
 * 初始化交通事件相关的逻辑
 * @param {Object} mapData - 地图数据对象
 */
function initTrafficEvents(mapData) {
  const { state } = mapData;

  // 初始化 WebSocket 连接并监听事件
  // listenToSocket 返回的是同一个socket实例，我们可以多次调用它来为同一个socket实例注册不同事件的监听器
  const socket = listenToSocket('traffic_update', handleTrafficUpdate);
  listenToSocket('grid_congestion_update', handleGridCongestionUpdate); // 为网格拥堵数据添加监听
  
  // 将socket保存到mapData.state中，以便其他地方使用
  // 由于 listenToSocket 内部处理 socket 实例的创建和返回，这里我们假设它返回的是同一个实例
  // 如果不是，apiService.js 中的 listenToSocket 需要调整为返回或管理单个共享的 socket 实例
  if (!state.socket) { // 避免重复赋值，假设 listenToSocket 返回的是相同的 socket 实例
    state.socket = socket; 
  }
  state.isTrafficSimulationRunning = false; // 初始化模拟状态
  
  // 添加交通模拟控制按钮事件
  const trafficSimButton = document.getElementById("trafficSim");
  if (trafficSimButton) {
    // 设置初始按钮文本
    trafficSimButton.textContent = '启动交通模拟';

    trafficSimButton.addEventListener('click', function() {
      if (state.isTrafficSimulationRunning) {
        // 如果正在运行，则停止
        console.log('发送停止交通模拟请求');
        addConsoleMessage('已发送停止交通模拟请求');
        state.socket.emit('stop_traffic_simulation');
        trafficSimButton.textContent = '启动交通模拟';
      } else {
        // 如果已停止，则启动
        console.log('发送启动交通模拟请求');
        addConsoleMessage('已发送启动交通模拟请求');
        state.socket.emit('start_traffic_simulation');
        trafficSimButton.textContent = '停止交通模拟';
      }
      // 切换状态
      state.isTrafficSimulationRunning = !state.isTrafficSimulationRunning;
    });
  }
}

export { initTrafficEvents, handleTrafficUpdate, handleGridCongestionUpdate };
