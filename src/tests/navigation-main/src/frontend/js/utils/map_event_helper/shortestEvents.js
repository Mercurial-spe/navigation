import { fetchShortestPath } from '../../api/apiService.js';
import { resetNodeAndEdgeColors, highlightEdges, COLORS } from '../renderHelper.js';
import { addConsoleMessage } from '../uiUtils.js';

/**
 * 初始化最短路径计算相关的事件监听器
 * @param {Object} mapData - 地图数据对象
 */
function initShortestPathEvents(mapData) {
  const shortestPathButton = document.getElementById("shortestPath");

  if (shortestPathButton) {
    shortestPathButton.addEventListener('click', async () => {
      // 创建模态框HTML
      const modalHtml = `
        <div id="path-input-modal" class="modal">
          <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>计算最短路径</h3>
            <div class="form-group">
              <label for="start-node">起始节点:</label>
              <input type="text" id="start-node" class="form-control" value="node1" placeholder="输入起始节点ID">
            </div>
            <div class="form-group">
              <label for="end-node">终止节点:</label>
              <input type="text" id="end-node" class="form-control" value="node999" placeholder="输入终止节点ID">
            </div>
            <div class="button-container">
              <button id="calculate-path-btn" class="btn primary-btn">计算路径</button>
              <button id="reset-highlight-btn" class="btn secondary-btn">清除高亮</button>
              <button id="cancel-path-btn" class="btn secondary-btn">取消</button>
            </div>
            <div id="path-result-container" class="result-container" style="display: none;"></div>
          </div>
        </div>
      `;

      // 添加模态框到DOM
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer.firstElementChild);

      // 获取模态框元素
      const modal = document.getElementById('path-input-modal');
      const closeBtn = modal.querySelector('.close-modal');
      const calculateBtn = document.getElementById('calculate-path-btn');
      const cancelBtn = document.getElementById('cancel-path-btn');
      const resultContainer = document.getElementById('path-result-container');
      const resetHighlightBtn = document.getElementById('reset-highlight-btn');

      // 显示模态框
      modal.style.display = 'block';

      // 关闭模态框的函数
      const closeModal = () => {
        modal.style.display = 'none';
        document.body.removeChild(modal);
      };

      // 绑定关闭按钮事件
      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);

      // 绑定重置高亮按钮事件
      resetHighlightBtn.addEventListener('click', function() {
        if (window.mapData && window.mapData.originalGraph && window.mapData.originalRenderer) {
          resetNodeAndEdgeColors(window.mapData.originalGraph, window.mapData.originalRenderer);
          window.mapData.originalRenderer.refresh();
          addConsoleMessage("已清除路径高亮", "info");
        }
      });

      // 点击模态框外部关闭
      window.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });

      // 绑定计算路径按钮事件
      calculateBtn.addEventListener('click', async () => {
        // 获取输入值
        const startId = document.getElementById('start-node').value.trim();
        const endId = document.getElementById('end-node').value.trim();

        // 输入验证
        if (!startId || !endId) {
          resultContainer.innerHTML = `<p class="error">请输入有效的起始节点和终止节点ID</p>`;
          resultContainer.style.display = 'block';
          return;
        }

        // 显示加载状态
        resultContainer.innerHTML = `<p class="info">正在计算从 ${startId} 到 ${endId} 的路径...</p>`;
        resultContainer.style.display = 'block';
        calculateBtn.disabled = true;

        try {
          // 调用封装的API函数
          const responseData = await fetchShortestPath(startId, endId);

          // 处理错误
          if (responseData && responseData.error) {
            resultContainer.innerHTML = `<p class="error">路径请求失败: ${responseData.error}</p>`;
            addConsoleMessage(`路径请求失败: ${responseData.error}`, 'error');
            calculateBtn.disabled = false;
            return;
          }

          // 检查是否成功获取路径数据
          if (!responseData || !responseData.paths) {
            resultContainer.innerHTML = `<p class="error">路径请求返回意外数据</p>`;
            addConsoleMessage(`路径请求返回意外数据`, 'error');
            calculateBtn.disabled = false;
            return;
          }

          // 构建结果HTML
          let resultHtml = `<h4>路径结果:</h4>`;

          // 用于高亮路径的变量
          let fastestPathEdges = null;
          let shortestPathEdges = null;

          // 添加最快路径信息
          if (responseData.paths.fastest_path) {
            if (responseData.paths.fastest_path.error) {
              resultHtml += `<p class="warning">最快路径: ${responseData.paths.fastest_path.error}</p>`;
              addConsoleMessage(`最快路径: ${responseData.paths.fastest_path.error}`, 'warn');
            } else if (responseData.paths.fastest_path.edges) {
              fastestPathEdges = responseData.paths.fastest_path.edges;
              resultHtml += `<p class="success">最快路径: ${responseData.paths.fastest_path.edges.length} 条边, 总耗时: ${responseData.paths.fastest_path.total_cost.toFixed(2)}</p>`;
              addConsoleMessage(`最快路径: ${responseData.paths.fastest_path.edges.length} 条边, 总耗时: ${responseData.paths.fastest_path.total_cost.toFixed(2)}`);
            }
          }

          // 添加最短路径信息
          if (responseData.paths.shortest_path_by_length) {
            if (responseData.paths.shortest_path_by_length.error) {
              resultHtml += `<p class="warning">最短路径(长度): ${responseData.paths.shortest_path_by_length.error}</p>`;
              addConsoleMessage(`最短路径(长度): ${responseData.paths.shortest_path_by_length.error}`, 'warn');
            } else if (responseData.paths.shortest_path_by_length.edges) {
              shortestPathEdges = responseData.paths.shortest_path_by_length.edges;
              resultHtml += `<p class="success">最短路径(长度): ${responseData.paths.shortest_path_by_length.edges.length} 条边, 总距离: ${responseData.paths.shortest_path_by_length.total_cost.toFixed(2)}</p>`;
              addConsoleMessage(`最短路径(长度): ${responseData.paths.shortest_path_by_length.edges.length} 条边, 总距离: ${responseData.paths.shortest_path_by_length.total_cost.toFixed(2)}`);
            }
          }

          // 处理起点终点相同的情况
          if (responseData.message) {
            resultHtml += `<p class="info">${responseData.message}</p>`;
            addConsoleMessage(responseData.message, "info");
          }

          // 高亮路径 - 首先重置
          if (window.mapData && window.mapData.originalGraph && window.mapData.originalRenderer) {
            // 先重置所有高亮状态
            resetNodeAndEdgeColors(window.mapData.originalGraph, window.mapData.originalRenderer);

            // 如果有最快路径，用蓝色高亮
            if (fastestPathEdges && fastestPathEdges.length > 0) {
              highlightEdges(
                window.mapData.originalGraph,
                fastestPathEdges,
                COLORS.FASTEST_PATH,
                true,
                COLORS.PATH_NODE,
                'fastest',
                startId,
                endId
              );
              addConsoleMessage("已高亮显示最快路径", "success");
            }

            // 如果有最短路径，用橙色高亮
            if (shortestPathEdges && shortestPathEdges.length > 0) {
              highlightEdges(
                window.mapData.originalGraph,
                shortestPathEdges,
                COLORS.SHORTEST_PATH,
                true,
                COLORS.PATH_NODE,
                'shortest',
                startId,
                endId
              );
              addConsoleMessage("已高亮显示最短路径", "success");
            }

            // 刷新渲染器以显示高亮
            window.mapData.originalRenderer.refresh();
          }

          // 在结果容器中添加高亮路径的图例
          if (fastestPathEdges || shortestPathEdges) {
            resultHtml += `<div class="path-legend">
              <p><strong>路径图例:</strong></p>
              ${fastestPathEdges ? `<p style="color:${COLORS.FASTEST_PATH}">■ 最快路径</p>` : ''}
              ${shortestPathEdges ? `<p style="color:${COLORS.SHORTEST_PATH}">■ 最短路径</p>` : ''}
              <p style="color:${COLORS.PATH_NODE}">■ 路径节点</p>
            </div>`;
          }

          // 更新结果容器
          resultContainer.innerHTML = resultHtml;
          console.log("路径数据:", responseData);
          addConsoleMessage(`成功计算从 ${startId} 到 ${endId} 的路径`);

        } catch (error) {
          console.error("请求路径数据时发生错误:", error);
          resultContainer.innerHTML = `<p class="error">请求路径时出错: ${error.message}</p>`;
          addConsoleMessage(`请求路径时出错: ${error.message}`, 'error');
        }

        // 重置按钮状态
        calculateBtn.disabled = false;
      });
    });
  }
}

export { initShortestPathEvents };
