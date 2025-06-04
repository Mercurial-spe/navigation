"""
Delaunay三角剖分算法实现 - 使用SciPy库实现
效果已经很不错了，将其接入到主函数中
"""
import math
import time
import random
import numpy as np
from scipy.spatial import Delaunay as ScipyDelaunay
from ..models.vertex import Vertex

def create_delaunay_triangulation(vertices):
    """
    创建Delaunay三角剖分，使用SciPy库实现
    
    参数:
        vertices: 顶点列表
        
    返回:
        三角形列表，每个三角形是三个顶点的元组
    """
    if len(vertices) < 3:
        return []
    
    # 将顶点转换为NumPy数组
    points = np.array([[v.x, v.y] for v in vertices])
    
    # 使用SciPy创建Delaunay三角剖分
    try:
        tri = ScipyDelaunay(points)
        
        # 将结果转换回我们的数据结构
        triangulation = []
        for simplex in tri.simplices:
            triangle = (vertices[simplex[0]], vertices[simplex[1]], vertices[simplex[2]])
            triangulation.append(triangle)
        
        return triangulation
    except Exception as e:
        print(f"创建Delaunay三角剖分时出错: {e}")
        return []

def is_point_in_circumcircle(point, triangle):
    """
    检查点是否在三角形的外接圆内
    
    参数:
        point: 要检查的点
        triangle: 三个顶点的元组
        
    返回:
        如果点在外接圆内则为True，否则为False
    """
    v1, v2, v3 = triangle
    
    # 重命名坐标以便于计算
    x1, y1 = v1.x, v1.y
    x2, y2 = v2.x, v2.y
    x3, y3 = v3.x, v3.y
    x, y = point.x, point.y
    
    # 检查三角形是否退化为一条线
    if abs((y2 - y3) * (x1 - x3) - (y1 - y3) * (x2 - x3)) < 1e-10:
        return False
    
    # 计算外接圆中心
    A = x1 * (y2 - y3) - y1 * (x2 - x3) + x2 * y3 - x3 * y2
    B = (x1 * x1 + y1 * y1) * (y3 - y2) + (x2 * x2 + y2 * y2) * (y1 - y3) + (x3 * x3 + y3 * y3) * (y2 - y1)
    C = (x1 * x1 + y1 * y1) * (x2 - x3) + (x2 * x2 + y2 * y2) * (x3 - x1) + (x3 * x3 + y3 * y3) * (x1 - x2)
    
    # 如果A接近0，三角形几乎是共线的
    if abs(A) < 1e-10:
        return False
    
    # 计算外接圆中心坐标
    center_x = -B / (2 * A)
    center_y = -C / (2 * A)
    
    # 计算外接圆半径
    radius_squared = ((x1 - center_x) ** 2 + (y1 - center_y) ** 2)
    
    # 计算点到圆心的距离
    dist_squared = ((x - center_x) ** 2 + (y - center_y) ** 2)
    
    # 点在圆内或圆上
    return dist_squared <= radius_squared * (1 + 1e-10)  # 添加小偏移量以处理浮点误差

def calculate_edge_lengths(triangulation):
    """
    计算三角剖分中所有边的长度
    
    参数:
        triangulation: 三角形列表
        
    返回:
        边长度字典，键为边（顶点对），值为长度
    """
    start_time = time.time()
    
    edge_lengths = {}
    
    for triangle in triangulation:
        v1, v2, v3 = triangle
        
        # 为三条边计算长度
        for edge in [(v1, v2), (v2, v3), (v3, v1)]:
            if edge not in edge_lengths and (edge[1], edge[0]) not in edge_lengths:
                length = ((edge[0].x - edge[1].x) ** 2 + (edge[0].y - edge[1].y) ** 2) ** 0.5
                # 按顶点ID排序边
                sorted_edge = tuple(sorted([edge[0], edge[1]], key=lambda v: v.id))
                edge_lengths[sorted_edge] = length
    
    total_time = time.time() - start_time
    print(f"计算边长度完成，共 {len(edge_lengths)} 条边，耗时: {total_time:.4f}秒")
    
    return edge_lengths

def test_random_generation(n=1000):
    """
    测试随机地图生成并验证Delaunay三角剖分的正确性
    
    参数:
        n: 生成的随机顶点数量
        
    返回:
        验证结果，如果通过则为True，否则为False
    """
    print(f"开始生成{n}个随机点...")
    
    # 生成随机顶点
    vertices = []
    for i in range(n):
        x = random.uniform(0, 1000)
        y = random.uniform(0, 1000)
        vertices.append(Vertex(i, x, y))
    
    print(f"生成随机点完成，开始进行Delaunay三角剖分...")
    
    # 记录开始时间
    start_time = time.time()
    
    # 执行Delaunay三角剖分
    triangulation = create_delaunay_triangulation(vertices)
    
    # 记录执行时间
    execution_time = time.time() - start_time
    
    print(f"三角剖分完成，生成了{len(triangulation)}个三角形，耗时: {execution_time:.4f}秒")
    
    # 随机抽样验证
    # 如果点数过多，只检验部分三角形
    sample_size = min(100, len(triangulation))
    sampled_triangles = random.sample(triangulation, sample_size)
    
    valid_count = 0
    invalid_count = 0
    invalid_triangles = []
    
    # 验证Delaunay特性：任何三角形的外接圆内不应包含其他点
    for triangle in sampled_triangles:
        v1, v2, v3 = triangle
        
        # 获取三角形的外接圆
        try:
            center_x, center_y, radius = circumcircle(v1, v2, v3)
            
            # 检查是否有其他点在此外接圆内
            is_valid = True
            violated_points = []
            
            # 随机抽样点进行检查，避免检查所有点
            test_vertices = random.sample(vertices, min(200, n))
            
            for vertex in test_vertices:
                # 跳过三角形自身的顶点
                if vertex in triangle:
                    continue
                
                # 计算点到圆心的距离
                dist = math.sqrt((vertex.x - center_x)**2 + (vertex.y - center_y)**2)
                
                # 如果点在圆内（考虑浮点误差）
                if dist < radius * (1 - 1e-10):
                    is_valid = False
                    violated_points.append(vertex)
            
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
                invalid_triangles.append((triangle, violated_points[:3]))  # 只记录前3个违反条件的点
        
        except Exception as e:
            print(f"验证三角形时出错: {e}")
            invalid_count += 1
    
    # 输出验证结果
    print(f"验证完成：从{sample_size}个抽样三角形中，有{valid_count}个有效，{invalid_count}个无效")
    
    if invalid_count > 0:
        print("无效三角形示例：")
        for i, (triangle, points) in enumerate(invalid_triangles[:3]):  # 只显示前3个无效三角形
            print(f"  无效三角形 {i+1}: 顶点坐标: ({triangle[0].x:.2f}, {triangle[0].y:.2f}), "
                  f"({triangle[1].x:.2f}, {triangle[1].y:.2f}), ({triangle[2].x:.2f}, {triangle[2].y:.2f})")
            for j, p in enumerate(points):
                print(f"    违反点 {j+1}: ({p.x:.2f}, {p.y:.2f})")
    
    validity_rate = valid_count / sample_size
    print(f"Delaunay三角剖分有效率: {validity_rate:.2%}")
    
    # 通常认为95%以上的有效率可以接受（考虑到浮点误差等因素）
    is_valid = validity_rate >= 0.95
    
    if is_valid:
        print("验证结果: 通过 ✅")
    else:
        print("验证结果: 失败 ❌ - 请检查算法实现")
    
    return is_valid

def circumcircle(p1, p2, p3):
    """
    计算三点的外接圆
    
    参数:
        p1, p2, p3: 三个顶点
    
    返回:
        (center_x, center_y, radius): 圆心坐标和半径
    """
    # 计算外接圆中心
    D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
    
    if abs(D) < 1e-10:
        # 三点共线，无法形成外接圆
        return 0, 0, float('inf')
    
    Ux = ((p1.x**2 + p1.y**2) * (p2.y - p3.y) + (p2.x**2 + p2.y**2) * (p3.y - p1.y) + (p3.x**2 + p3.y**2) * (p1.y - p2.y)) / D
    Uy = ((p1.x**2 + p1.y**2) * (p3.x - p2.x) + (p2.x**2 + p2.y**2) * (p1.x - p3.x) + (p3.x**2 + p3.y**2) * (p2.x - p1.x)) / D
    
    # 计算半径
    radius = math.sqrt((p1.x - Ux)**2 + (p1.y - Uy)**2)
    
    return Ux, Uy, radius


if __name__ == "__main__":
    # 如果直接运行此文件，执行测试
    test_random_generation(100000) 