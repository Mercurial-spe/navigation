/**
 * Sigma.js 事件处理模块
 */
import { handleNearbyNodesRequest } from '../eventHandlers.js';
import { updateScaleInfo, addConsoleMessage, showInfoBox } from '../uiUtils.js';
import { switchToZoomLevel } from '../../renderers/mapRenderer.js';
import { COLORS, resetNodeAndEdgeColors } from '../renderHelper.js';
import { fetchNearbySpecialPoints } from '../../api/apiService.js';

/**
 * 找到最接近的预定义缩放等级
 * @param {number} currentZoom - 当前缩放值
 * @param {Array} thresholds - 预定义的缩放等级数组
 * @return {number} 最接近的缩放等级
 */
function findClosestZoomLevel(currentZoom, thresholds) {
  if (!thresholds || thresholds.length === 0) {
    // 如果 thresholds 未定义或为空，则返回当前缩放值或一个默认值
    console.warn("Zoom thresholds are not defined or empty. Returning current zoom level.");
    return currentZoom; 
  }
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
 * 初始化 Sigma.js 相关的事件监听器
 * @param {Object} mapData - 包含clusterGraph、originalGraph、clusterRenderer、originalRenderer、container和state的对象
 */
function initSigmaEventHandlers(mapData) {
  const { originalGraph, clusterGraph, originalRenderer, clusterRenderer, state } = mapData;

  let lastClickTime = 0;
  const doubleClickDelay = 1000; // 毫秒

  // 初始化 activeNearbySearch 状态
  state.activeNearbySearch = null;

  /**
   * 清除当前激活的附近节点搜索高亮状态
   * @param {Object} mapData - 包含图形和渲染器数据的对象
   */
  function clearActiveNearbySearch(mapData) {
    const { originalGraph, originalRenderer, state } = mapData;
    if (state.activeNearbySearch) {
      const { targetNodeId, relatedEdgeIds } = state.activeNearbySearch;
      resetNodeAndEdgeColors(originalGraph, originalRenderer);


      state.activeNearbySearch = null;
      originalRenderer.refresh();
      console.log("已清除附近节点高亮状态。");
    }
  }

  originalRenderer.on("clickNode", async function(event) {
    const nodeId = event.node;
    const currentTime = new Date().getTime();

    // 双击检测
    if (currentTime - lastClickTime < doubleClickDelay) {
      console.log("原始图层节点双击事件:", nodeId);

      if (state.activeNearbySearch && state.activeNearbySearch.targetNodeId === nodeId) {
        // 如果再次双击同一个已激活的节点，则取消高亮
        console.log(`节点 ${nodeId} 再次被双击，取消高亮。`);
        clearActiveNearbySearch(mapData);
      } else {
        // 如果存在其他高亮，先清除
        if (state.activeNearbySearch) {
          console.log("清除上一个附近节点高亮。");
          clearActiveNearbySearch(mapData);
        }

        // 获取节点的坐标信息
        const nodeAttributes = originalGraph.getNodeAttributes(nodeId);
        const x = nodeAttributes.x;
        const y = nodeAttributes.y;

        // 获取附近节点
        const nearbyData = await handleNearbyNodesRequest(x, y, 100, mapData); // mapData 已包含 container

        if (nearbyData && nearbyData.nodes && nearbyData.edges) {
          console.log(`为节点 ${nodeId} 获取到 ${nearbyData.edges.length} 条相关边。`);
          const relatedEdgeIds = nearbyData.edges.map(edge => {
            // API 返回的边可能没有直接的ID，或者ID格式不一致
            // 我们需要确保能从originalGraph中找到这些边
            // 假设 API 返回的 edge 有 source 和 target
            const source = edge.source.toString();
            const target = edge.target.toString();
            if (originalGraph.hasEdge(source, target)) {
              return originalGraph.edge(source, target);
            } else if (originalGraph.hasEdge(target, source)) {
              return originalGraph.edge(target, source);
            }
            return null;
          }).filter(id => id !== null);

          state.activeNearbySearch = {
            targetNodeId: nodeId,
            relatedEdgeIds: relatedEdgeIds,

          };


          // 2. 特别标记目标点
          if (originalGraph.hasNode(nodeId)) {
            originalGraph.setNodeAttribute(nodeId, 'color', COLORS.TARGET_NODE); // 假设 TARGET_NODE 已定义
            originalGraph.setNodeAttribute(nodeId, 'size', (originalGraph.getNodeAttribute(nodeId, 'size') || 5) * 1.5); // 增大尺寸
            originalGraph.setNodeAttribute(nodeId, 'zIndex', 10); // 确保在最上层
          }

          // 3. 标记相关边
          relatedEdgeIds.forEach(edgeId => {
            if (originalGraph.hasEdge(edgeId)) {
              originalGraph.setEdgeAttribute(edgeId, 'color', COLORS.RELATED_EDGE); // 假设 RELATED_EDGE 已定义
              originalGraph.setEdgeAttribute(edgeId, 'size', (originalGraph.getEdgeAttribute(edgeId, 'size') || 1) * 2); // 加粗
              originalGraph.setEdgeAttribute(edgeId, 'zIndex', 5);
            }
          });
          
          console.log(`节点 ${nodeId} 及其周边已被高亮。`);
          originalRenderer.refresh();
        } else {
          console.log(`未能获取节点 ${nodeId} 的附近数据。`);
        }
      }
    }

    lastClickTime = currentTime;
  });
  originalRenderer.on("rightClickNode", function(event) { 
    const nodeId = event.node;
    console.log("节点被右键点击:", nodeId);
    addConsoleMessage(`节点 ${nodeId} 被右键点击`);
    // 调用API获取附近特殊点信息（加油站、购物中心、停车场等）
    fetchNearbySpecialPoints(nodeId, 100)
      .then(data => {
        console.log("获取到节点附近的特殊点:", data);
        // 这里可以添加处理特殊点数据的逻辑
        // 例如: 高亮显示特殊点，显示信息框等
        
        if (data && data.special_points_in_radius) {
          // 计算特殊点总数
          const totalSpecialPoints = 
            (data.special_points_in_radius.gas_stations?.count || 0) +
            (data.special_points_in_radius.shopping_malls?.count || 0) +
            (data.special_points_in_radius.parking_lots?.count || 0);
            
          addConsoleMessage(`获取到节点附近的特殊点总数: ${totalSpecialPoints}`);

          if (totalSpecialPoints > 0) {
            // 显示信息框，列出找到的特殊点
            let infoContent = {
              '节点ID': nodeId,
              '半径': '50米', // 注意这里半径应与请求一致
              '特殊点总数': totalSpecialPoints
            };
            
            // 详细列出每种特殊点
            if (data.special_points_in_radius.gas_stations?.ids.length > 0) {
                infoContent['加油站'] = data.special_points_in_radius.gas_stations.ids.map(id => `ID: ${id}`).join(', ');
            }
             if (data.special_points_in_radius.shopping_malls?.ids.length > 0) {
                infoContent['购物中心'] = data.special_points_in_radius.shopping_malls.ids.map(id => `ID: ${id}`).join(', ');
            }
             if (data.special_points_in_radius.parking_lots?.ids.length > 0) {
                infoContent['停车场'] = data.special_points_in_radius.parking_lots.ids.map(id => `ID: ${id}`).join(', ');
            }

            // 使用鼠标事件坐标显示信息框
            let clickX = originalGraph.getNodeAttribute(nodeId, 'x');
            let clickY = originalGraph.getNodeAttribute(nodeId, 'y');
            clickX = originalRenderer.graphToViewport({x: clickX, y: clickY}).x;
            clickY = originalRenderer.graphToViewport({x: clickX, y: clickY}).y;
            addConsoleMessage(clickX, clickY);
            showInfoBox(infoContent, `节点 ${nodeId} 附近的特殊点信息`, clickX, clickY);
          } else {
            console.log("在指定半径内未找到特殊点");
            addConsoleMessage("在指定半径内未找到特殊点");
          }
        } else {
           console.log("获取到的数据格式不正确或没有特殊点信息");
           addConsoleMessage("获取特殊点信息失败或数据为空");
        }
      })
      .catch(error => {
        console.error("获取附近特殊点时出错:", error);
        addConsoleMessage("获取附近特殊点时出错: " + error.message);
      });
  });

  
  //单击边显示边的信息
  originalRenderer.on("clickEdge", function(event) {
    console.log("边被点击:", event.edge, "原始事件:", event.original);
    // 获取边的信息
    const edgeAttributes = originalGraph.getEdgeAttributes(event.edge);
    console.log("边信息:", edgeAttributes);

    const infoToShow = {
      'ID': event.edge,
      '大小': edgeAttributes.size ? edgeAttributes.size.toFixed(2) : 'N/A',
      '车辆数': edgeAttributes.current_vehicles !== undefined ? edgeAttributes.current_vehicles : 'N/A',
      '容量': edgeAttributes.capacity !== undefined ? edgeAttributes.capacity : 'N/A',
      // 可以根据需要添加更多属性
    };

    // 获取点击坐标的方法1：使用边的源节点和目标节点的中点
    const sourceId = originalGraph.source(event.edge);
    const targetId = originalGraph.target(event.edge);
    
    if (sourceId && targetId) {
      const sourceAttributes = originalGraph.getNodeAttributes(sourceId);
      const targetAttributes = originalGraph.getNodeAttributes(targetId);
      
      // 计算边的中点坐标（在图形空间中）
      const middleX = (sourceAttributes.x + targetAttributes.x) / 2;
      const middleY = (sourceAttributes.y + targetAttributes.y) / 2;
      
      // 将图形坐标转换为屏幕坐标
      const screenPosition = originalRenderer.graphToViewport({
        x: middleX,
        y: middleY
      });
      
      const clickX = screenPosition.x;
      const clickY = screenPosition.y;
      
      console.log("计算得到的边中点坐标:", clickX, clickY);
      showInfoBox(infoToShow, `边 ${edgeAttributes.label || event.edge} 的信息`, clickX, clickY);
    } else {
      // 备选方法：如果无法获取边的节点，尝试使用鼠标事件坐标
      const clickX = event.original?.clientX || 0;
      const clickY = event.original?.clientY || 0;
      console.log("使用原始事件坐标:", clickX, clickY);
      showInfoBox(infoToShow, `边 ${edgeAttributes.label || event.edge} 的信息`, clickX, clickY);
    }
  });

  // 修改双击舞台事件，确保先重置原始图层相机，然后相机同步会自动处理集群图层的重置
  originalRenderer.on("doubleClickStage", function(event) {
    console.log("双击舞台事件触发");
    // 首先重置原始图层相机
    originalRenderer.getCamera().animatedReset();
    // 不再需要单独重置集群图层，因为相机同步逻辑会自动处理
    console.log("重置成功");
    // 尝试阻止默认缩放行为
    if (event && event.original) { // Sigma typings suggest event.original for raw browser event
        event.original.preventDefault();
        event.original.stopPropagation();
    }
    // 双击舞台时，也清除附近节点高亮
    if (state.activeNearbySearch) {
        console.log("双击舞台，清除附近节点高亮。");
        clearActiveNearbySearch(mapData);
    }
  });
  
  // 当鼠标进入边时触发
  originalRenderer.on("enterEdge", function(event) {
    // 获取 Sigma 容器元素

    const container = originalRenderer.getContainer();
    if (container) {
      container.style.cursor = 'pointer'; // 改变鼠标样式为手型
    }
  });

  // 当鼠标离开边时触发
  originalRenderer.on("leaveEdge", function(event) {
    // 获取 Sigma 容器元素
    const container = originalRenderer.getContainer();
    if (container) {
      container.style.cursor = 'default'; // 恢复默认鼠标样式
    }
  });
  
  // 初始化相机状态，保存引用
  // state.lastCameraState = originalRenderer.getCamera().getState(); // This was in initEventListeners, but seems more relevant if used by sigma handlers

  // 标记是否已添加平移限制
  state.hasPanLimitation = false;

  // 创建命名的事件处理函数，以便之后可以移除
  const mousedownHandler = function(e) {
    if (e.button === 0) { // 确保只阻止左键拖动
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const touchstartHandler = function(e) {
    e.preventDefault();
    e.stopPropagation();
  };

  const mousemoveHandlerSigma = function(e) { // Renamed to avoid conflict if other mousemove handlers exist
    if (e.buttons === 1) { // 如果左键按下并移动
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const touchmoveHandlerSigma = function(e) { // Renamed to avoid conflict
    e.preventDefault();
    e.stopPropagation();
  };

  // 保存事件处理函数引用
  state.panLimitHandlers = {
    mousedownHandler,
    touchstartHandler,
    mousemoveHandler: mousemoveHandlerSigma, // Use renamed handler
    touchmoveHandler: touchmoveHandlerSigma  // Use renamed handler
  };

  originalRenderer.on("afterRender", function() {
    const currentOriginalCamera = originalRenderer.getCamera().getState();

    // --- 平移/缩放限制逻辑 (始终基于originalRenderer) ---
    // if (currentOriginalCamera.ratio < 1) {
    //   if (state.hasPanLimitation) {
    //     console.log("重新启用平移功能");
    //     const originalDomElement = originalRenderer.getContainer();
    //     originalDomElement.removeEventListener('mousedown', state.panLimitHandlers.mousedownHandler, false);
    //     originalDomElement.removeEventListener('touchstart', state.panLimitHandlers.touchstartHandler, false);
    //     originalDomElement.removeEventListener('mousemove', state.panLimitHandlers.mousemoveHandler, false);
    //     originalDomElement.removeEventListener('touchmove', state.panLimitHandlers.touchmoveHandler, false);
    //     state.hasPanLimitation = false;
    //   }
    // }
    // if (currentOriginalCamera.ratio >= 1 && !state.hasPanLimitation) {
    //   console.log("阻止鼠标和触摸事件导致的平移");
    //   const originalDomElement = originalRenderer.getContainer();
    //   originalDomElement.addEventListener('mousedown', state.panLimitHandlers.mousedownHandler, false);
    //   originalDomElement.addEventListener('touchstart', state.panLimitHandlers.touchstartHandler, false);
    //   originalDomElement.addEventListener('mousemove', state.panLimitHandlers.mousemoveHandler, false);
    //   originalDomElement.addEventListener('touchmove', state.panLimitHandlers.touchmoveHandler, false);
    //   state.hasPanLimitation = true;
    // }
    // --- 结束 平移/缩放限制逻辑 ---

    if (state.currentLayer === 'mixed') {
      const lastOriginalCamera = state.lastOriginalCameraState || {};
      if (currentOriginalCamera.ratio !== lastOriginalCamera.ratio ||
          currentOriginalCamera.x !== lastOriginalCamera.x ||
          currentOriginalCamera.y !== lastOriginalCamera.y) {

        state.lastOriginalCameraState = {...currentOriginalCamera};

        // 从原始图层同步到集群图层
        const clusterCamera = clusterRenderer.getCamera();
        clusterCamera.x = currentOriginalCamera.x;
        clusterCamera.y = currentOriginalCamera.y;
        clusterCamera.ratio = currentOriginalCamera.ratio;
        clusterRenderer.refresh();
        // console.log("混合图层模式: 相机同步已执行"); // Reduced log verbosity

        // 更新缩放比例显示
        if (mapData.scaleInfo) {
          updateScaleInfo(mapData.scaleInfo, currentOriginalCamera.ratio);
        }

        // 找到最接近的预定义缩放等级并切换
        const closestZoomLevel = findClosestZoomLevel(currentOriginalCamera.ratio, state.zoomThresholds);
        if (state.currentZoomLevel !== closestZoomLevel) {
          // console.log(\`缩放等级变化 (mixed): \${state.currentZoomLevel} -> \${closestZoomLevel}\`);
          switchToZoomLevel(closestZoomLevel, mapData);
        }
      }
    }else if(state.currentLayer === 'original'){
        const currentOriginalCamera = originalRenderer.getCamera().getState();
        const lastOriginalCamera = state.lastOriginalCameraState || {};
  
        if (currentOriginalCamera.ratio !== lastOriginalCamera.ratio ||
            currentOriginalCamera.x !== lastOriginalCamera.x ||
            currentOriginalCamera.y !== lastOriginalCamera.y) {
  
          state.lastOriginalCameraState = {...currentOriginalCamera};
  
          // 更新缩放比例显示
          if (mapData.scaleInfo) {
            updateScaleInfo(mapData.scaleInfo, currentOriginalCamera.ratio);
          }
        }
    }
  });

  clusterRenderer.on("afterRender", function() {
    if (state.currentLayer === 'cluster') {
      const currentClusterCamera = clusterRenderer.getCamera().getState();
      const lastClusterCamera = state.lastClusterCameraState || {};

      if (currentClusterCamera.ratio !== lastClusterCamera.ratio ||
          currentClusterCamera.x !== lastClusterCamera.x ||
          currentClusterCamera.y !== lastClusterCamera.y) {

        state.lastClusterCameraState = {...currentClusterCamera};

        // 更新缩放比例显示
        if (mapData.scaleInfo) {
          updateScaleInfo(mapData.scaleInfo, currentClusterCamera.ratio);
        }

        // 找到最接近的预定义缩放等级并切换
        const closestZoomLevel = findClosestZoomLevel(currentClusterCamera.ratio, state.zoomThresholds);
        if (state.currentZoomLevel !== closestZoomLevel) {
          // console.log(\`缩放等级变化 (cluster): \${state.currentZoomLevel} -> \${closestZoomLevel}\`);
          switchToZoomLevel(closestZoomLevel, mapData);
        }
      }
    }
  });
  
  console.log("Sigma.js 事件处理器已初始化");
}

export { initSigmaEventHandlers, findClosestZoomLevel };
