/**
 * 地图渲染模块 - 负责处理地图渲染和视图切换
 */
import { COLORS } from '../utils/renderHelper.js';
import { fetchZoomClusterData } from '../api/apiService.js';
import Sigma from 'https://cdn.jsdelivr.net/npm/sigma@3.0.2/+esm';
import { createNodeImageProgram,NodeImageProgram } from "https://cdn.jsdelivr.net/npm/@sigma/node-image@3.0.0/+esm";

/**
 * 初始化地图渲染
 * @param {Object} data - 包含detailData的对象
 * @returns {Object} - 包含graph、renderer、container等属性的对象
 */
function initMapRender(data) {
  const { detailData } = data;
  console.time('总渲染时间');
  
  // 创建主容器
  const container = document.getElementById("map-container");
  
  // 创建两个嵌套容器用于两个图层
  const clusterContainer = document.createElement("div");
  clusterContainer.id = "cluster-layer";
  clusterContainer.style.position = "absolute";
  clusterContainer.style.width = "100%";
  clusterContainer.style.height = "100%";
  clusterContainer.style.top = "0";
  clusterContainer.style.left = "0";
  clusterContainer.style.zIndex = "1"; // 聚类图层在上方
  clusterContainer.style.pointerEvents = "auto";

  const originalContainer = document.createElement("div");
  originalContainer.id = "original-layer";
  originalContainer.style.position = "absolute";
  originalContainer.style.width = "100%";
  originalContainer.style.height = "100%";
  originalContainer.style.top = "0";
  originalContainer.style.left = "0";
  originalContainer.style.zIndex = "2"; // 原始数据图层在下方
  originalContainer.style.pointerEvents = "auto"

  // 将两个容器添加到主容器中
  container.appendChild(originalContainer);
  container.appendChild(clusterContainer);
  
  // 创建两个graphology图实例
  const clusterGraph = new graphology.Graph();
  const originalGraph = new graphology.Graph();
  
  // 初始化状态
  const state = {
    currentMode: 'zoom',  // 默认为缩放模式，不再使用detail模式
    detailNodes: detailData.nodes,
    detailEdges: detailData.edges,
    // 缩放模式相关状态
    currentZoomLevel: null,
    zoomThresholds: [0.3, 0.5, 1.0],
    zoomData: {}, // 缓存不同缩放等级的数据
  };
  
  // 检查节点数量
  const nodeCount = detailData.nodes.length;
  console.log(`初始化地图，节点数量: ${nodeCount}`);
  
  // 创建聚类图层的Sigma实例
  const clusterRenderer = new Sigma(clusterGraph, clusterContainer, {
    // 渲染设置
    renderEdgeLabels: false,
    minCameraRatio: 0.05,
    maxCameraRatio: 2,
    defaultNodeColor: COLORS.ORIGINAL_NODE,
    defaultEdgeColor: COLORS.ORIGINAL_EDGE,
    // 减小滚轮缩放幅度
    zoomingRatio: 1.7,
    autoRescale: false, // 默认开启自动调整
  });
  
  // 创建原始数据图层的Sigma实例
  const originalRenderer = new Sigma(originalGraph, originalContainer, {
    // 渲染设置
    renderEdgeLabels: true,
    minCameraRatio: 0.05,
    maxCameraRatio: 2,
    defaultNodeColor: COLORS.ORIGINAL_NODE,
    defaultEdgeColor: COLORS.ORIGINAL_EDGE,
    zoomingRatio: 1.7,
    autoRescale: false,
    // 边交互设置
    enableEdgeEvents: true,
    enableEdgeClickEvents: true,
    enableEdgeWheelEvents: true,
    enableEdgeHoverEvents: true,
    // 增加边的尺寸，使其更容易被鼠标选中
    edgeMinSize: 5,
    edgeMaxSize: 8,
    // **注册自定义节点程序**
    nodeProgramClasses: {
      image: createNodeImageProgram(), // 这里注册了图片节点程序
         },
  });
  
  // 加载原始数据到originalGraph
  console.log("加载原始数据到图层...");
  // 添加节点
  state.detailNodes.forEach(node => {
    const nodeAttributes = {
      label: node.label || `Node ${node.id}`,
      x: node.x,
      y: node.y,
      size: 3, // 使用较小的节点大小
      color: node.color || COLORS.ORIGINAL_NODE,
      cluster_id: node.cluster_id,
      original: true, 
      // 添加 type 和 image 属性用于图片节点渲染
    };
    
    // // 检查是否为特殊地点，添加对应图像并设置 type 为 'image'
    if (node.is_gas_station) {
      nodeAttributes.type = 'image';
      nodeAttributes.image = "/icons/gas_station.png";
      nodeAttributes.size = 12; // 增加带图像节点的大小以便更好地显示
    } else if (node.is_shopping_mall) {
      nodeAttributes.type = 'image';
      nodeAttributes.image = "/icons/shopping_mall.png";
      nodeAttributes.size = 12;
    } else if (node.is_parking_lot) {
      nodeAttributes.type = 'image';
      nodeAttributes.image = "/icons/parking_lot.png";
      nodeAttributes.size = 12;
    }
    
    
    originalGraph.addNode(node.id, nodeAttributes);
  });
  
  // 添加边
  const nodeMap = new Map();
  state.detailNodes.forEach(node => nodeMap.set(node.id, node));

  state.detailEdges.forEach(edge => {
    try {

      const sourceId = edge.source !== undefined ? edge.source : edge.from;
      const targetId = edge.target !== undefined ? edge.target : edge.to;

      if (sourceId === undefined || targetId === undefined) {
        console.warn("跳过边，缺少source或target:", edge);
        return;
      }

      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);

      let edgeColor = edge.color || COLORS.ORIGINAL_EDGE;

      // 检查源节点或目标节点是否为特殊地点
      if (sourceNode && (sourceNode.is_gas_station || sourceNode.is_shopping_mall || sourceNode.is_parking_lot)) {
        edgeColor = COLORS.LOCATION_EDGE;
      } else if (targetNode && (targetNode.is_gas_station || targetNode.is_shopping_mall || targetNode.is_parking_lot)) {
        edgeColor = COLORS.LOCATION_EDGE;
      }

      originalGraph.addEdge(sourceId, targetId, {
        size:  3, // 使用较小的节点大小
        color: edgeColor,
        level: edge.level,
        current_vehicles: edge.current_vehicles,
        capacity: edge.capacity
      });
    } catch (e) {
      console.error("添加边时出错:", e, edge);
    }
  });
  
  console.log(`原始数据图层已加载 ${state.detailNodes.length} 个节点和 ${state.detailEdges.length} 条边`);
  
  // 获取渲染容器并添加事件监听器以阻止平移
  
  

 
  
  // 包装返回对象
  const mapData = {
    clusterGraph,
    originalGraph,
    clusterRenderer,
    originalRenderer,
    container,
    state
  };
  
  // 设置初始缩放比例并立即加载聚类视图
  console.log("初始化自动缩放模式，设置初始缩放比例为0.2并加载聚类视图");
  // 设置相机缩放比例为0.2
  clusterRenderer.getCamera().ratio = 0.1;
  originalRenderer.getCamera().ratio = 0.1;
  console.timeEnd('总渲染时间');
  console.log("地图渲染完成");
  
  return mapData;
}

/**
 * 找到最接近的预定义缩放等级
 * @param {number} currentZoom - 当前缩放值
 * @param {Array} thresholds - 预定义的缩放等级数组
 * @return {number} 最接近的缩放等级
 */
function findClosestZoomLevel(currentZoom, thresholds) {
  let closestZoom = thresholds[0];
  let minDiff = Math.abs(currentZoom - thresholds[0]);
  
  for (let i = 1; i < thresholds.length; i++) {
    const diff = Math.abs(currentZoom - thresholds[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestZoom = thresholds[i];
    }
  }
  
  return closestZoom;
}

/**
 * 根据缩放等级渲染视图
 * @param {Object} graph - graphology图实例
 * @param {Object} state - 当前状态对象
 * @param {number} zoomLevel - 缩放等级
 * @param {Object} zoomData - 该缩放等级对应的节点和边数据
 */
function renderZoomView(graph, state, zoomLevel, zoomData) {
  console.time(`渲染缩放等级 ${zoomLevel} 视图`);
  
  // 清空图
  graph.clear();
  
  // 根据缩放等级确定节点大小
  // 缩放等级越大（视图越远），节点越大，以保证可见性
  let nodeSize;
  if (zoomLevel <= 0.2) {
    nodeSize = 2;  // 最近距离，使用较小的节点
  } else if (zoomLevel <= 0.5) {
    nodeSize = 5;
  } else if (zoomLevel <= 1.0) {
    nodeSize = 12;
  } else if (zoomLevel <= 2.0) {
    nodeSize = 15;
  } else {
    nodeSize = 20;  // 最远距离，使用较大的节点
  }
  
  // 噪声点的大小稍小于集群点
  const noiseNodeSize = Math.max(3, nodeSize - 2);
  
  // 添加节点
  zoomData.nodes.forEach(node => {
    // 使用固定大小，不再基于集群点数量
    const size = node.is_noise ? noiseNodeSize : nodeSize;
    const label = node.label || (node.is_noise ? `Node ${node.id}` : `Cluster ${node.cluster_id}`);
    
    graph.addNode(node.id, {
      label: label,
      x: node.x,
      y: node.y,
      size: size,
      color: node.is_noise ? COLORS.NOISE_NODE : COLORS.CLUSTER_NODE,
      cluster_id: node.cluster_id,
      is_noise: node.is_noise,
      cluster_size: node.cluster_size
    });
  });
  
  // 添加边
  zoomData.edges.forEach(edge => {
    try {
      const source = edge.source !== undefined ? edge.source : edge.from;
      const target = edge.target !== undefined ? edge.target : edge.to;
      
      if (source === undefined || target === undefined) {
        console.warn("跳过边，缺少source或target:", edge);
        return;
      }
      
      graph.addEdge(source, target, {
        size: edge.size || 0.5,
        color: edge.color || COLORS.CLUSTER_EDGE
      });
    } catch (e) {
      console.error("添加边时出错:", e, edge);
    }
  });
  
  state.currentMode = 'zoom';
  state.currentZoomLevel = zoomLevel;
  
  console.timeEnd(`渲染缩放等级 ${zoomLevel} 视图`);
}

/**
 * 切换到指定缩放等级
 * @param {number} zoomLevel - 要切换到的缩放等级
 * @param {Object} mapData - 包含graph、renderer和state的对象
 */
async function switchToZoomLevel(zoomLevel, mapData) {
  const { clusterGraph, clusterRenderer, state } = mapData;
  
  // 初始化正在获取数据的标记对象
  if (!state.ongoingFetches) {
    state.ongoingFetches = {};
  }
  
  // 如果已经在获取该缩放等级的数据，直接返回
  if (state.ongoingFetches[zoomLevel]) {
    console.log(`缩放等级 ${zoomLevel} 的数据正在获取中，跳过重复请求。`);
    return;
  }
  
  try {
    console.time(`切换到缩放等级 ${zoomLevel}`);

    
    // 检查缓存中是否已有该等级的数据
    if (!state.zoomData[zoomLevel]) {
      console.log(`缓存中没有缩放等级 ${zoomLevel} 的数据，正在获取...`);
      
      // 显示加载指示器
      document.getElementById("loading-indicator")?.classList.remove("hidden");
      
      // 标记该缩放等级数据正在获取中
      state.ongoingFetches[zoomLevel] = true;
      
      // 获取该缩放等级的聚类数据
      const clusterData = await fetchZoomClusterData(zoomLevel);
      
      // 将数据存入缓存
      state.zoomData[zoomLevel] = clusterData;
      
      // 隐藏加载指示器
      document.getElementById("loading-indicator")?.classList.add("hidden");
    }
    
    // 渲染该缩放等级的视图
    renderZoomView(clusterGraph, state, zoomLevel, state.zoomData[zoomLevel]);
    
    // 刷新视图
    clusterRenderer.refresh();
    
    
    console.log(`已切换到缩放等级 ${zoomLevel}，显示 ${state.zoomData[zoomLevel].nodes.length} 个聚类节点`);
  } catch (error) {
    console.error(`切换到缩放等级 ${zoomLevel} 失败:`, error);
    document.getElementById("loading-indicator")?.classList.add("hidden");
    
    // 出错时尝试切换到不同的缩放级别
    if (state.zoomThresholds.includes(zoomLevel)) {
      const fallbackLevel = state.zoomThresholds.find(level => level !== zoomLevel);
      if (fallbackLevel && state.zoomData[fallbackLevel]) {
        console.log(`尝试切换到备用缩放等级 ${fallbackLevel}`);
        renderZoomView(clusterGraph, state, fallbackLevel, state.zoomData[fallbackLevel]);
        clusterRenderer.refresh();
      }
    }
  }
  finally {
    // 无论成功或失败，都移除正在获取的标记
    if (state.ongoingFetches) {
      delete state.ongoingFetches[zoomLevel];
    }
    console.timeEnd(`切换到缩放等级 ${zoomLevel}`);
  }
}

/**
 * 根据交通数据更新原始图层上边的颜色
 * @param {Object} mapData - 包含 originalGraph 和 originalRenderer 的对象
 * @param {Array} trafficEdgesData - 从服务器接收的边数据数组，每项包含 source, target, color
 * @returns {number} 更新的边的数量
 */
function updateTrafficOnEdges(mapData, trafficEdgesData) {
  const { originalGraph, originalRenderer, state } = mapData;

  if (!originalGraph || !originalRenderer) {
    console.error("原始图或渲染器不可用，无法更新交通数据。");
    return 0;
  }

  let updatedCount = 0;
  let protectedEdgesCount = 0;
  
  trafficEdgesData.forEach(trafficEdge => {
    const sourceId = trafficEdge.source;
    const targetId = trafficEdge.target;
    const newColor = trafficEdge.color;

    let edgeToUpdate;
    let edgeKeyGraphology = null; // 用于在 activeNearbySearch 中检查的边ID

    // 检查边的两个方向，因为Graphology的edge()可能需要特定顺序或图可能是定向的
    if (originalGraph.hasEdge(sourceId, targetId)) {
        edgeToUpdate = originalGraph.edge(sourceId, targetId);
        edgeKeyGraphology = edgeToUpdate; // Graphology 返回的边ID
    } else if (originalGraph.hasEdge(targetId, sourceId)) { // 也检查反向，以防万一
        edgeToUpdate = originalGraph.edge(targetId, sourceId);
        edgeKeyGraphology = edgeToUpdate;
    }

    if (edgeToUpdate) {
      let isHighlighted = false; // 标记边是否被高亮（需要保护颜色）
      
      // 检查是否在邻近搜索高亮的边中
      if (state && state.activeNearbySearch && state.activeNearbySearch.relatedEdgeIds && 
          state.activeNearbySearch.relatedEdgeIds.includes(edgeKeyGraphology)) {
        isHighlighted = true;
      }
      
      // 检查是否在高亮路径上的边（最短路径或最快路径）
      if (!isHighlighted && state && state.highlightedPaths) {
        // 检查最短路径
        if (state.highlightedPaths.shortestPath && 
            state.highlightedPaths.shortestPath.edgeIds && 
            state.highlightedPaths.shortestPath.edgeIds.has(edgeKeyGraphology)) {
          isHighlighted = true;
        }
        
        // 检查最快路径
        if (!isHighlighted && state.highlightedPaths.fastestPath && 
            state.highlightedPaths.fastestPath.edgeIds && 
            state.highlightedPaths.fastestPath.edgeIds.has(edgeKeyGraphology)) {
          isHighlighted = true;
        }
        
        // 检查其他高亮路径
        if (!isHighlighted && state.highlightedPaths.otherPaths && 
            state.highlightedPaths.otherPaths.edgeIds && 
            state.highlightedPaths.otherPaths.edgeIds.has(edgeKeyGraphology)) {
          isHighlighted = true;
        }
      }

      if (!isHighlighted) {
        // 如果边没有被高亮，正常更新颜色
        originalGraph.setEdgeAttribute(edgeToUpdate, 'color', newColor);
        updatedCount++;
      } else {
        // 边被高亮，保护其颜色
        protectedEdgesCount++;
      }
      
      // 始终更新交通相关的属性（无论边是否被高亮）
      if (trafficEdge.current_vehicles !== undefined) {
          originalGraph.setEdgeAttribute(edgeToUpdate, 'current_vehicles', trafficEdge.current_vehicles);
      }
      if (trafficEdge.capacity !== undefined) {
          originalGraph.setEdgeAttribute(edgeToUpdate, 'capacity', trafficEdge.capacity);
      }
    } else {
      console.warn(`来自交通数据的边 (源: ${sourceId}, 目标: ${targetId}) 在原始图中未找到。`);
    }
  });

  if (updatedCount > 0 || protectedEdgesCount > 0) {
    originalRenderer.refresh();
    if (protectedEdgesCount > 0) {
      console.log(`交通更新: ${updatedCount} 条边颜色已更新，${protectedEdgesCount} 条高亮边颜色已保护。`);
    }
  }
  return updatedCount;
}

export { 
  initMapRender,
  switchToZoomLevel,
  updateTrafficOnEdges
};