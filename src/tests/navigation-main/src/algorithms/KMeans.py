import numpy as np
import time
from src.generators.random_map import generate_random_points, generate_connected_map
from src.models.graph import Graph # Assuming Graph is needed for type hinting or instantiation if not returned directly

class KMeans:
    """
    K-Means 聚类算法实现
    """
    def __init__(self, n_clusters, max_iter=300, tol=1e-4, init_method='kmeans++'):
        """
        初始化 K-Means 算法

        参数:
            n_clusters (int): 要形成的簇的数量 (K)
            max_iter (int): 最大迭代次数
            tol (float): 收敛容忍度。质心变化的平方和小于此值则认为收敛。
            init_method (str): 质心初始化方法，可选 'kmeans++' 或 'random'
        """
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.tol = tol
        self.init_method = init_method
        self.centroids_ = None  # 最终的质心 (NumPy 数组)
        self.cluster_labels_ = {}  # 顶点ID -> 簇ID 的映射

    def _initialize_centroids(self, points):
        """
        初始化质心
        
        参数:
            points (np.ndarray): 数据点数组，形状 (n_samples, n_features)
        返回:
            np.ndarray: 初始化的质心数组，形状 (n_clusters, n_features)
        """
        n_samples, n_features = points.shape
        
        if self.init_method == 'kmeans++':
            centroids = np.empty((self.n_clusters, n_features), dtype=points.dtype)
            
            # 1. 随机选择第一个质心
            first_centroid_idx = np.random.choice(n_samples)
            centroids[0] = points[first_centroid_idx]
            
            # 计算到第一个质心的平方距离
            closest_dist_sq = np.sum((points - centroids[0])**2, axis=1)
            
            for i in range(1, self.n_clusters):
                # 2. 计算选择下一个质心的概率 D(x)^2 / sum(D(x)^2)
                current_sum_dist_sq = closest_dist_sq.sum()
                if np.isclose(current_sum_dist_sq, 0):
                    # 如果所有点都与现有质心重合，则随机选择剩余质心
                    num_already_picked = i
                    num_to_pick_randomly = self.n_clusters - num_already_picked
                    # replace=True 确保在 n_samples 不足时也能选择
                    random_indices = np.random.choice(n_samples, num_to_pick_randomly, replace=True)
                    centroids[i:] = points[random_indices]
                    break 
                
                probs = closest_dist_sq / current_sum_dist_sq
                
                # 3. 根据权重选择下一个质心
                next_centroid_idx = np.random.choice(n_samples, p=probs)
                centroids[i] = points[next_centroid_idx]
                
                # 4. 更新到最近质心的平方距离 (如果不是最后一个质心)
                if i < self.n_clusters - 1:
                    dist_to_new_centroid = np.sum((points - centroids[i])**2, axis=1)
                    closest_dist_sq = np.minimum(closest_dist_sq, dist_to_new_centroid)
            return centroids

        elif self.init_method == 'random':
            # 随机选择 K 个不重复的点作为初始质心 (如果 n_samples >= n_clusters)
            # _initialize_centroids 只应在 n_samples >= n_clusters 时被调用 (fit 方法中处理此情况)
            replace_flag = n_samples < self.n_clusters # Should generally be False due to checks in fit()
            random_indices = np.random.choice(n_samples, self.n_clusters, replace=replace_flag)
            return points[random_indices]
        else:
            raise ValueError(f"未知的初始化方法: {self.init_method}")

    def fit(self, graph):
        """
        对图中的顶点执行 K-Means 聚类

        参数:
            graph: Graph 对象，包含要聚类的顶点
        返回:
            self: 返回自身，便于链式调用
        """
        if not graph.vertices:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self

        vertex_list = list(graph.vertices.values())
        if not vertex_list:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self
            
        self.vertex_ids_ = [v.id for v in vertex_list]
        # 假设顶点有 x, y 属性
        points = np.array([[v.x, v.y] for v in vertex_list], dtype=np.float64)
        
        n_samples, n_features = points.shape

        if n_samples == 0:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self

        if n_samples < self.n_clusters:
            # print(f"警告: 样本数量 ({n_samples}) 小于簇数量 ({self.n_clusters}). "
            #       f"每个点将成为其自身的簇，或者形成的簇将少于 K。")
            self.centroids_ = np.full((self.n_clusters, n_features), np.nan)
            if n_samples > 0:
                self.centroids_[:n_samples] = points
            
            labels = np.arange(n_samples)
            self.cluster_labels_ = {self.vertex_ids_[i]: int(labels[i]) for i in range(n_samples)}
            return self

        centroids = self._initialize_centroids(points)

        for iteration in range(self.max_iter):
            # E-step: 将点分配到最近的质心 (向量化)
            term1 = np.sum(points**2, axis=1)[:, np.newaxis] 
            term3 = np.sum(centroids**2, axis=1)[np.newaxis, :] 
            term2 = -2 * np.dot(points, centroids.T) 
            distances_sq = term1 + term2 + term3
            distances_sq = np.maximum(distances_sq, 0) # 处理浮点精度问题
            
            labels = np.argmin(distances_sq, axis=1)

            # M-step: 更新质心
            new_centroids = np.copy(centroids)
            for k_idx in range(self.n_clusters):
                points_in_cluster = points[labels == k_idx]
                if len(points_in_cluster) > 0:
                    new_centroids[k_idx] = points_in_cluster.mean(axis=0)
                else:
                    # 处理空簇：随机重新初始化质心
                    # print(f"警告: 簇 {k_idx} 为空。随机重新初始化质心。")
                    if n_samples > 0: # Ensure points exist for random choice
                        new_centroids[k_idx] = points[np.random.choice(n_samples)]
                    # else: new_centroids[k_idx] remains unchanged if n_samples is 0 (though this path shouldn't be hit often)
            
            # 检查收敛
            centroid_shift_sq = np.sum((new_centroids - centroids)**2)
            if centroid_shift_sq < self.tol:
                # print(f"在 {iteration+1} 次迭代后收敛。")
                break
            
            centroids = new_centroids

        self.centroids_ = centroids
        self.cluster_labels_ = {self.vertex_ids_[i]: int(labels[i]) for i in range(n_samples)}
        
        return self

    def get_cluster_labels(self):
        """
        获取每个顶点的聚类标签
        返回:
            字典，键为顶点ID，值为聚类ID
        """
        return self.cluster_labels_

    def get_centroids(self):
        """
        获取簇质心的坐标
        返回:
            np.ndarray: 形状为 (n_clusters, n_features) 的质心数组
        """
        return self.centroids_

    def get_clusters(self, graph):
        """
        获取所有聚类及其包含的顶点对象
        参数:
            graph: Graph 对象，用于通过 ID 查找顶点对象
        返回:
            列表，其中每个元素是一个包含该簇中顶点对象的列表
        """
        if not self.cluster_labels_ or not graph or not graph.vertices:
            return [[] for _ in range(self.n_clusters if self.n_clusters > 0 else 0)]

        clusters = [[] for _ in range(self.n_clusters)]
        for vertex_id, label in self.cluster_labels_.items():
            if 0 <= label < self.n_clusters: # 确保标签有效
                vertex_obj = graph.vertices.get(vertex_id)
                if vertex_obj:
                    clusters[label].append(vertex_obj)
        return clusters

def apply_kmeans(graph, n_clusters, max_iter=300, tol=1e-4, init_method='kmeans++'):
    """
    应用 K-Means 算法对图中的顶点进行聚类的便捷函数

    参数:
        graph: Graph 对象，包含要聚类的顶点
        n_clusters (int): 要形成的簇的数量 (K)
        max_iter (int): 最大迭代次数
        tol (float): 收敛容忍度
        init_method (str): 质心初始化方法 ('kmeans++' 或 'random')
        
    返回:
        cluster_labels: 字典，键为顶点ID，值为聚类ID
        centroids: np.ndarray, 簇质心的坐标
    """
    kmeans_algo = KMeans(n_clusters=n_clusters, max_iter=max_iter, tol=tol, init_method=init_method)
    kmeans_algo.fit(graph)
    return kmeans_algo.get_cluster_labels(), kmeans_algo.get_centroids()

class MiniBatchKMeans:
    """
    Mini-Batch K-Means 聚类算法实现
    """
    def __init__(self, n_clusters, max_iter=100, tol=1e-3, batch_size=100, init_method='kmeans++', max_no_improvement=10):
        """
        初始化 Mini-Batch K-Means 算法

        参数:
            n_clusters (int): 要形成的簇的数量 (K)
            max_iter (int): 最大迭代次数
            tol (float): 收敛容忍度。质心变化的平方和小于此值，并且在一定数量的连续迭代中没有改善，则认为收敛。
            batch_size (int): 每个小批量的大小
            init_method (str): 质心初始化方法，可选 'kmeans++' 或 'random'
            max_no_improvement (int): 连续多少次迭代没有显著改善就停止算法（提前停止）
        """
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.tol = tol
        self.batch_size = batch_size
        self.init_method = init_method
        self.max_no_improvement = max_no_improvement
        self.centroids_ = None  # 最终的质心 (NumPy 数组)
        self.cluster_labels_ = {}  # 顶点ID -> 簇ID 的映射
        # KMeans++ 初始化方法需要访问 KMeans 类的内部方法，暂时简单复用
        self._kmeans_initializer = KMeans(n_clusters=n_clusters, init_method=init_method)

    def _initialize_centroids(self, points):
        """
        初始化质心 (使用 KMeans 类的初始化方法)
        
        参数:
            points (np.ndarray): 数据点数组，形状 (n_samples, n_features)
        返回:
            np.ndarray: 初始化的质心数组，形状 (n_clusters, n_features)
        """
        #  KMeans 的 _initialize_centroids 是一个内部方法，但为了复用逻辑，我们直接调用它
        # 注意：这在实际的库设计中可能不是最佳实践，但为了教学目的可以接受
        return self._kmeans_initializer._initialize_centroids(points)

    def fit(self, graph):
        """
        对图中的顶点执行 Mini-Batch K-Means 聚类

        参数:
            graph: Graph 对象，包含要聚类的顶点
        返回:
            self: 返回自身，便于链式调用
        """
        if not graph.vertices:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self

        vertex_list = list(graph.vertices.values())
        if not vertex_list:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self
            
        self.vertex_ids_ = [v.id for v in vertex_list]
        points = np.array([[v.x, v.y] for v in vertex_list], dtype=np.float64)
        
        n_samples, n_features = points.shape

        if n_samples == 0:
            self.cluster_labels_ = {}
            self.centroids_ = np.array([])
            return self

        if n_samples < self.n_clusters:
            # print(f"警告: 样本数量 ({n_samples}) 小于簇数量 ({self.n_clusters}). ")
            self.centroids_ = np.full((self.n_clusters, n_features), np.nan)
            if n_samples > 0:
                self.centroids_[:n_samples] = points
            
            labels = np.arange(n_samples)
            self.cluster_labels_ = {self.vertex_ids_[i]: int(labels[i]) for i in range(n_samples)}
            return self

        centroids = self._initialize_centroids(points)
        # 用于提前停止的计数器和变量
        counts = np.zeros(self.n_clusters, dtype=np.int32)
        no_improvement_count = 0
        previous_inertia = np.inf # 使用 inertia (点到其质心的距离平方和) 作为评估指标

        for iteration in range(self.max_iter):
            # 1. 随机抽取一个小批量数据
            batch_indices = np.random.choice(n_samples, self.batch_size, replace=False)
            mini_batch = points[batch_indices]
            
            # 2. E-step (部分): 将小批量中的点分配到最近的质心
            term1_batch = np.sum(mini_batch**2, axis=1)[:, np.newaxis]
            term3_centroids = np.sum(centroids**2, axis=1)[np.newaxis, :]
            term2_dot = -2 * np.dot(mini_batch, centroids.T)
            distances_sq_batch = term1_batch + term2_dot + term3_centroids
            distances_sq_batch = np.maximum(distances_sq_batch, 0) # 处理浮点精度
            
            batch_labels = np.argmin(distances_sq_batch, axis=1)
            
            # 3. M-step (部分): 更新受影响的质心
            #    使用学习率 η = 1 / counts[k] 来更新质心，counts[k] 是分配给质心 k 的点的数量
            #    c_k_new = c_k_old + η * (x_i - c_k_old)  等价于 c_k_new = (1-η)c_k_old + η * x_i
            #    当 η = 1/counts[k] 时，这个更新变成了 c_k_new = ((counts[k]-1)/counts[k])c_k_old + (1/counts[k])x_i
            #    这与在线均值更新是类似的
            
            # old_centroids_for_shift_check = np.copy(centroids) # 用于计算质心位移

            for i in range(self.batch_size):
                label = batch_labels[i]
                counts[label] += 1
                learning_rate = 1.0 / counts[label]
                centroids[label] = (1.0 - learning_rate) * centroids[label] + learning_rate * mini_batch[i]
            
            # 4. 检查收敛性 (可选，或者在多次迭代后检查)
            #    对于 Mini-Batch K-Means, 收敛检查更复杂，通常基于质心稳定性或损失函数的变化。
            #    这里我们实现一个基于质心在一定迭代次数内没有明显改善的提前停止机制。
            
            # 计算当前批次的 inertia (可选，用于监控)
            # current_batch_inertia = np.sum(np.min(distances_sq_batch, axis=1))

            # 评估整体 inertia (在所有点上，不是小批量)
            if (iteration + 1) % 10 == 0 or iteration == self.max_iter - 1: # 每10次迭代或最后一次迭代
                term1_all = np.sum(points**2, axis=1)[:, np.newaxis]
                term3_all_centroids = np.sum(centroids**2, axis=1)[np.newaxis, :]
                term2_all_dot = -2 * np.dot(points, centroids.T)
                all_distances_sq = term1_all + term2_all_dot + term3_all_centroids
                all_distances_sq = np.maximum(all_distances_sq, 0)
                current_total_inertia = np.sum(np.min(all_distances_sq, axis=1))

                if previous_inertia - current_total_inertia < self.tol:
                    no_improvement_count += 1
                else:
                    no_improvement_count = 0 # 有改善，重置计数器
                
                previous_inertia = current_total_inertia

                if no_improvement_count >= self.max_no_improvement:
                    # print(f"在 {iteration+1} 次迭代后收敛 (连续 {self.max_no_improvement} 次迭代无明显改善)。")
                    break
        
        # 最后，将所有点分配到最终的质心
        term1_final = np.sum(points**2, axis=1)[:, np.newaxis]
        term3_final_centroids = np.sum(centroids**2, axis=1)[np.newaxis, :]
        term2_final_dot = -2 * np.dot(points, centroids.T)
        final_distances_sq = term1_final + term2_final_dot + term3_final_centroids
        final_distances_sq = np.maximum(final_distances_sq, 0)
        final_labels = np.argmin(final_distances_sq, axis=1)

        self.centroids_ = centroids
        self.cluster_labels_ = {self.vertex_ids_[i]: int(final_labels[i]) for i in range(n_samples)}
        
        return self

    def get_cluster_labels(self):
        """
        获取每个顶点的聚类标签
        返回:
            字典，键为顶点ID，值为聚类ID
        """
        return self.cluster_labels_

    def get_centroids(self):
        """
        获取簇质心的坐标
        返回:
            np.ndarray: 形状为 (n_clusters, n_features) 的质心数组
        """
        return self.centroids_

    def get_clusters(self, graph):
        """
        获取所有聚类及其包含的顶点对象
        参数:
            graph: Graph 对象，用于通过 ID 查找顶点对象
        返回:
            列表，其中每个元素是一个包含该簇中顶点对象的列表
        """
        if not self.cluster_labels_ or not graph or not graph.vertices:
            return [[] for _ in range(self.n_clusters if self.n_clusters > 0 else 0)]

        clusters = [[] for _ in range(self.n_clusters)]
        for vertex_id, label in self.cluster_labels_.items():
            if 0 <= label < self.n_clusters: # 确保标签有效
                vertex_obj = graph.vertices.get(vertex_id)
                if vertex_obj:
                    clusters[label].append(vertex_obj)
        return clusters

def apply_mini_batch_kmeans(graph, n_clusters, max_iter=100, tol=1e-3, batch_size=100, init_method='kmeans++', max_no_improvement=10):
    """
    应用 Mini-Batch K-Means 算法对图中的顶点进行聚类的便捷函数

    参数:
        graph: Graph 对象
        n_clusters (int): 簇数量 (K)
        max_iter (int): 最大迭代次数
        tol (float): 收敛容忍度
        batch_size (int): 小批量大小
        init_method (str): 初始化方法
        max_no_improvement (int): 提前停止的无改善迭代次数
        
    返回:
        cluster_labels: 字典，顶点ID -> 聚类ID
        centroids: np.ndarray, 簇质心坐标
    """
    mbk = MiniBatchKMeans(n_clusters=n_clusters, max_iter=max_iter, tol=tol, 
                          batch_size=batch_size, init_method=init_method, 
                          max_no_improvement=max_no_improvement)
    mbk.fit(graph)
    return mbk.get_cluster_labels(), mbk.get_centroids()

if __name__ == "__main__":
    # 定义测试参数
    n_points_test = 20000
    n_clusters_test = 1000 # 您可以调整 K 值
    batch_size_test = 256 # 小批量大小
    
    print(f"--- Mini-Batch K-Means 聚类时间测试 (N={n_points_test}, K={n_clusters_test}, BatchSize={batch_size_test}) ---")

    # 生成随机点
    print(f"\n正在为 {n_points_test} 个点生成随机数据...")
    vertices = generate_random_points(n=n_points_test, x_min=0, y_min=0, x_max=1000, y_max=1000, min_distance=1) # min_distance 调整以确保能生成足够多的点
    
    # 生成连接图
    print("正在生成连接图...")
    graph = generate_connected_map(vertices)
    
    print(f"生成了 {len(graph.vertices)} 个顶点和 {len(graph.edges)} 条边。")
    
    start_time = time.time()
    print(f"正在对地图数据执行 Mini-Batch K-Means 聚类 (K={n_clusters_test}, BatchSize={batch_size_test})...")
    
    # 应用 Mini-Batch K-Means 算法
    # 参数可以按需调整，例如 max_iter, tol, init_method, max_no_improvement
    cluster_labels, centroids = apply_mini_batch_kmeans(
        graph,
        n_clusters=n_clusters_test,
        batch_size=batch_size_test,
        max_iter=100, # Mini-batch 通常需要较少的迭代
        tol=1e-3,      # 收敛容忍度
        max_no_improvement=10 # 提前停止参数
    )
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    print("Mini-Batch K-Means 聚类完成。")
    actual_clusters = len(np.unique(list(cluster_labels.values()))) if cluster_labels else 0
    print(f"实际找到 {actual_clusters} 个簇。") 
    print(f"总耗时: {elapsed_time:.4f} 秒")
    
    print("\n--- 测试结束 ---")

    # 注意：要可视化这些结果，你需要在前端代码中加载地图和聚类标签/质心。
    # 这个脚本现在只负责后端算法的运行和验证。 