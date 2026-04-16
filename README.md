# 水循环失衡辨识

基于 WaterGAP 数据，对本地 `datasets/` 中所有可读取的时序变量进行近 20 年、近 30 年相对于历史长期基线的偏离分析，并以静态 Web 页面展示全球热点图。

## 当前实现

- 数据范围：1901-2016
- 分析变量：自动扫描 `datasets/` 中可正常读取的时序 nc4 文件
- 判定方法：
  - 先把月数据聚合为年均值
  - 把近 20 年或近 30 年作为 recent window
  - 把 recent window 之前的年份作为 long-term baseline
  - 计算 `z = (recent_mean - baseline_mean) / baseline_std`
  - 为避免极小方差网格把 z-score 放大失真，标准差使用 5% 分位数作为稳健下限
  - 当前端设置阈值 `x` 时，满足 `|z| >= x` 的网格被判定为失衡
- 可视化能力：
  - 切换所有已纳入分析的变量
  - 切换时间窗口 `20 / 30` 年
  - 调整判定阈值 `0.5σ - 3σ`
  - 中英双语切换
  - 鼠标悬停查看网格位置与统计值
  - 展示本地存在但当前不可分析的文件列表

## 运行方式

1. 生成前端数据：

```bash
python src/build_analysis.py
```

2. 打开页面：

- 直接打开 `web/index.html`
- 或在项目根目录执行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/web/`

## 输出文件

- `src/build_analysis.py`：读取 nc4 数据并生成前端数据文件
- `web/analysis-data.js`：分析结果数据
- `web/index.html`：页面结构
- `web/styles.css`：界面样式
- `web/app.js`：交互和绘图逻辑

## 备注

当前版本优先满足 README 中的最小可用需求。后续如果需要更严格的科研分析，可以继续扩展为：

- 月气候态异常而不是年均值异常
- 趋势检验与显著性检验
- 流域尺度聚合与行政区统计
- 导出高分辨率图片或 GeoTIFF
