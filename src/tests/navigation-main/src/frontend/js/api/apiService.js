import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

/**
 * API服务模块 - 负责处理与后端API的通信
 */

/**
 * 获取地图数据
 * @returns {Promise<Object>} 包含节点和边数据的对象
 */
async function fetchMapData() {
    try {
      // 从后端获取详细视图数据
      const detailResponse = await fetch('/api/map-data/detail');
      if (!detailResponse.ok) {
        throw new Error(`HTTP error fetching detail data: ${detailResponse.status}`);
      }
      const detailData = await detailResponse.json();
      return {detailData};

    } catch (error) {
      console.error("获取地图数据失败:", error);
      document.querySelector(".loading").textContent = "加载地图数据失败，请刷新重试";
      throw error;
    }
  }

/**
 * 获取指定缩放等级的聚类数据
 * @param {number} zoomLevel - 缩放等级(0.1-5)
 * @returns {Promise<Object>} 包含节点和边的聚类数据
 */
async function fetchZoomClusterData(zoomLevel) {
  try {
    // 将浮点数缩放等级转换为最接近的预计算缩放等级
    const zoomLevels = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
    let closestZoomLevel = zoomLevels[0];
    let minDiff = Math.abs(zoomLevel - zoomLevels[0]);
    
    for (let i = 1; i < zoomLevels.length; i++) {
      const diff = Math.abs(zoomLevel - zoomLevels[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestZoomLevel = zoomLevels[i];
      }
    }
    
    console.log(`获取缩放等级 ${zoomLevel} 的聚类数据 (映射到 ${closestZoomLevel})`);
    
    // 使用查询参数获取缩放等级数据
    // const response = await fetch(`/api/zoom_clusters?zoom_level=${zoomLevel}`);
    const response = await fetch(`/api/zoom_clusters?zoom_level=${zoomLevel}`);
    if (!response.ok) {
      throw new Error(`HTTP error fetching zoom cluster data: ${response.status}`);
    }
    const clusterData = await response.json();
    
    return clusterData;
  } catch (error) {
    console.error(`获取缩放等级 ${zoomLevel} 的聚类数据失败:`, error);
    throw error;
  }
}

/**
 * 获取附近节点数据
 * @param {number} x - 中心点x坐标
 * @param {number} y - 中心点y坐标
 * @param {number} count - 获取节点数量
 * @returns {Promise<Object>} 包含节点和边数据的对象
 */
async function fetchNearbyNodesData(x, y, count) {
    try {
      const response = await fetch(`/api/nearby_nodes?x=${x}&y=${y}&count=${count}`);
      if (!response.ok) {
        throw new Error('网络响应错误');
      }
      return await response.json();
    } catch (error) {
      console.error('获取附近节点失败:', error);
      throw error;
    }
  }

  /**
 * 获取四叉树数据
 */
async function fetchQuadtreeData() {
    try {
        const response = await fetch('/api/quadtree');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.boundaries;
    } catch (error) {
        console.error('Failed to fetch quadtree data:', error);
        alert('Failed to fetch quadtree data!');
        return [];
    }
}

/**
 * 获取三角剖分和外接圆数据
 * @returns {Promise<Object>} 包含三角形和外接圆数据的对象
 */
async function fetchTriangulationData() {
  try {
    const response = await fetch('/api/triangulation');
    if (!response.ok) {
      throw new Error(`HTTP error fetching triangulation data: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("获取三角剖分数据失败:", error);
    throw error;
  }
}

/**
 * 监听WebSocket服务器发送的消息
 * @param {string} eventName - 要监听的事件名称
 * @param {Function} callback - 收到消息时调用的回调函数
 */
function listenToSocket(eventName, callback) {
  const socket = io('ws://127.0.0.1:5000'); // 或者您的服务器地址

  socket.on('connect', () => {
    console.log('已连接到 WebSocket 服务器');
  });

  socket.on(eventName, (data) => {
    if (callback && typeof callback === 'function') {
      callback(data);
    }
  });

  socket.on('disconnect', () => {
    console.log('已从 WebSocket 服务器断开');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket 连接错误:', error);
  });

  // 返回socket实例，以便调用者可以执行其他操作，例如关闭连接
  return socket;
}

/**
 * 获取最短路径数据
 * @param {string} start_id - 起始节点ID
 * @param {string} end_id - 终止节点ID
 * @returns {Promise<Object>} 包含路径数据的对象
 */
async function fetchShortestPath(start_id, end_id) {
  try {
    const requestData = {
      start_id: start_id,
      end_id: end_id,
      path_types: ["fastest", "shortest_by_length"]
    };

    const response = await fetch('/api/paths', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    const responseData = await response.json(); // 尝试解析JSON，无论响应是否OK

    if (!response.ok) {
      // 即使不是2xx响应，也返回responseData，以便调用者可以处理错误信息
      return responseData;
    }

    return responseData;
  } catch (error) {
    console.error("请求路径数据时发生错误:", error);
    throw error; // 重新抛出错误以便调用者处理
  }
}

/**
 * 获取指定点附近特殊点的信息以及到最近特殊点的路径
 * @param {number} nodeId - 中心点的ID
 * @param {number} radius - 邻域大小 (例如 500)
 * @returns {Promise<Object>} 包含特殊点信息和路径数据的对象
 */
async function fetchNearbySpecialPoints(nodeId, radius) {
  try {
    const response = await fetch(`/api/nearby_special_points?node_id=${nodeId}&radius=${radius}`);
    const responseData = await response.json(); // 尝试解析JSON，无论响应是否OK

    if (!response.ok) {
      // 即使不是2xx响应，也返回responseData，以便调用者可以处理错误信息
      console.error('获取附近特殊点信息失败:', responseData);
      // 你可以决定是抛出错误还是返回错误数据，这里选择返回错误数据
      // throw new Error(responseData.error || `HTTP error: ${response.status}`); 
      return responseData; 
    }

    return responseData;
  } catch (error) {
    console.error("请求附近特殊点信息时发生网络错误:", error);
    throw error; // 重新抛出错误以便调用者处理
  }
}

/**
 * 获取指定点附近特殊点的信息以及到最近特殊点的路径
 * @param {number} nodeId - 中心点的ID
 * @param {number} radius - 邻域大小 (例如 500)
 * @returns {Promise<Object>} 包含特殊点信息和路径数据的对象
 */
async function fetchGridCongestion() {
  try {
    const response = await fetch(`/api/grid_congestion`);
    const responseData = await response.json(); // 尝试解析JSON，无论响应是否OK

    if (!response.ok) {
      // 即使不是2xx响应，也返回responseData，以便调用者可以处理错误信息
      console.error('获取拥堵信息失败:', responseData);

      return responseData; 
    }

    return responseData;
  } catch (error) {
    console.error("请求拥堵信息时发生网络错误:", error);
    throw error; // 重新抛出错误以便调用者处理
  }
}
export { fetchMapData, fetchNearbyNodesData, fetchQuadtreeData, fetchZoomClusterData, listenToSocket, fetchShortestPath, fetchNearbySpecialPoints, fetchGridCongestion, fetchTriangulationData }; 