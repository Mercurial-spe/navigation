"""
Delaunay三角剖分增量法实现
目前时间复杂度为O(n^3)，在大样例下无法使用，只是作为探索的记录
"""
import math
import random
import time
from ..models.vertex import Vertex
from .delaunay import circumcircle
def create_delaunay_triangulation(vertices):
    """
    创建Delaunay三角剖分
    
    参数:
        vertices: 顶点列表
        
    返回:
        三角形列表，每个三角形是三个顶点的元组
    """
    # 检查顶点数量
    if len(vertices) < 3:
        return []
    
    # 创建初始的超级三角形，包含所有点
    super_triangle = create_super_triangle(vertices)
    
    # 初始化三角剖分为一个包含超级三角形的列表
    triangulation = [super_triangle]
    
    # 逐个添加点
    for vertex in vertices:
        # 查找包含该点的所有三角形的边
        edges = []
        triangles_to_remove = []
        
        for i, triangle in enumerate(triangulation):
            # 如果点在三角形的外接圆内，收集其边
            if is_point_in_circumcircle(vertex, triangle):
                # 将三角形的三条边加入列表
                t1, t2, t3 = triangle
                edges.append((t1, t2))
                edges.append((t2, t3))
                edges.append((t3, t1))
                # 标记该三角形待删除
                triangles_to_remove.append(i)
        
        # 从三角剖分中移除不满足Delaunay条件的三角形
        triangles_to_remove.sort(reverse=True)
        for i in triangles_to_remove:
            triangulation.pop(i)
        
        # 构建边界多边形
        boundary_edges = []
        for edge in edges:
            # 检查边的反向边是否也在edges中
            reversed_edge = (edge[1], edge[0])
            if reversed_edge in edges:
                # 如果反向边也在，则这不是边界边
                continue
                
            # 计算该边在edges中出现的次数
            edge_count = edges.count(edge)
            
            # 如果边只出现一次，它是边界边
            if edge_count == 1:
                boundary_edges.append(edge)
        
        # 使用新顶点和边界边创建新三角形
        for edge in boundary_edges:
            v1, v2 = edge
            triangulation.append((v1, v2, vertex))
    
    # 移除包含超级三角形顶点的三角形
    st_vertices = set(super_triangle)
    i = 0
    while i < len(triangulation):
        v1, v2, v3 = triangulation[i]
        if v1 in st_vertices or v2 in st_vertices or v3 in st_vertices:
            triangulation.pop(i)
        else:
            i += 1
    
    return triangulation

def create_super_triangle(vertices):
    """
    创建包含所有顶点的超级三角形
    
    参数:
        vertices: 顶点列表
        
    返回:
        三个超级顶点的元组
    """
    # 找出顶点集合的边界
    min_x = min(v.x for v in vertices)
    min_y = min(v.y for v in vertices)
    max_x = max(v.x for v in vertices)
    max_y = max(v.y for v in vertices)
    
    # 计算边界框的尺寸
    dx = (max_x - min_x) * 10
    dy = (max_y - min_y) * 10
    
    # 创建比边界框大得多的三角形
    from ..models.vertex import Vertex
    v1 = Vertex(-1, min_x - dx, min_y - dy * 3)
    v2 = Vertex(-2, max_x + dx * 3, min_y - dy)
    v3 = Vertex(-3, min_x - dx, max_y + dy * 3)
    
    return (v1, v2, v3)

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
if __name__ == "__main__":
    # 如果直接运行此文件，执行测试
    test_random_generation(10000) 