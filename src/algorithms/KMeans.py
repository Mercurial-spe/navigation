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
        self.tol = tol*max_iter
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
        
        start_time = time.time()
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
            end_time = time.time()
            print(f"KMeans++ 初始化质心时间: {end_time - start_time} 秒")
            return centroids
        elif self.init_method == 'random':
            # 随机选择 K 个不重复的点作为初始质心 (如果 n_samples >= n_clusters)
            # _initialize_centroids 只应在 n_samples >= n_clusters 时被调用 (fit 方法中处理此情况)
            replace_flag = n_samples < self.n_clusters 
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
            start_time = time.time()
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
                
            end_time = time.time()
            print(f"单次迭代 时间: {end_time - start_time} 秒")
            # 检查收敛
            centroid_shift_sq = np.sum((new_centroids - centroids)**2)
            #打印之前和现在的质心坐标
            #只打印前两行
            # print(f"质心坐标: {centroids[:2]}")
            # print(f"新质心坐标: {new_centroids[:2]}")
            if centroid_shift_sq < self.tol:
                # print(f"在 {iteration+1} 次迭代后收敛。")
                break
            
            centroids = new_centroids
        
        print(f"KMeans 聚类时间: {end_time - start_time} 秒")
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

def apply_kmeans(graph, n_clusters, max_iter=300, tol=1e-1, init_method='kmeans++'):
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
