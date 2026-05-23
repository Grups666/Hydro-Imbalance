window.RESEARCH_EXPLORER = {
  modes: {
    snow: { label: "积雪与冰川融水补给型", color: "#39b8c4" },
    monsoon: { label: "季风洪泛补给型", color: "#48c78e" },
    dryIrrigation: { label: "干旱区灌溉与地下水依赖型", color: "#e85d75" },
    reservoir: { label: "水库调节与季节流量重组型", color: "#8f72d8" },
    humid: { label: "湿润径流主导型", color: "#4f8ce8" },
    managed: { label: "治理恢复或外源调水缓冲型", color: "#d89b35" },
    mixed: { label: "混合或弱诊断型", color: "#9aa3ad" }
  },
  highlightedRegions: [
    {
      id: "high-plains",
      name: "High Plains / Ogallala",
      match: { lon: [-106.5, -94], lat: [31, 45] },
      mode: "dryIrrigation",
      label: "地下水支撑的半干旱农业灌溉",
      summary: "低补给半干旱灌溉系统，长期抽取地下水把含水层储量转化为作物蒸散，形成典型的人类用水驱动型水循环重分配。",
      cycle: ["地下水储量长期亏损", "灌溉提高作物蒸散并削弱天然水量留存", "自然补给不足导致恢复缓慢"],
      pattern: ["中南部亏损更强", "多年累积趋势比单年异常更关键"],
      references: ["scanlon2012", "jasechko2024Aquifers", "globalIrrigationReview"]
    },
    {
      id: "central-valley",
      name: "California Central Valley",
      match: { lon: [-123.5, -118], lat: [34, 41.5] },
      mode: "dryIrrigation",
      label: "地表水短缺下的地下水替代抽采",
      summary: "地表水工程和地下水抽采耦合，干旱期地下水替代抽采增强，导致地下水、总水储量和地表沉降风险同步变化。",
      cycle: ["雪水和水库供给存在年际波动", "干旱期地下水补偿抽采增强", "湿年可短暂恢复但难以完全抵消累积亏损"],
      pattern: ["San Joaquin Valley 压力更强", "干旱序列会放大地下水异常"],
      references: ["scanlon2012", "rodell2018Freshwater", "globalIrrigationReview"]
    },
    {
      id: "indus",
      name: "Indus / Northwest India",
      match: { lon: [67, 78.5], lat: [22, 36.5] },
      mode: "dryIrrigation",
      label: "灌溉抽采驱动的地下水亏损",
      summary: "高强度粮食生产、机井灌溉和有限补给共同驱动地下水快速亏损，是全球最典型的人类用水扰动区之一。",
      cycle: ["季风补给与干季灌溉错配", "地下水支撑农业耗水", "GRACE 观测到显著总水储量亏损"],
      pattern: ["西北印度和 Indus 灌区压力最强", "季风年际波动叠加长期抽采"],
      references: ["rodell2009India", "jasechko2024Aquifers", "globalIrrigationReview"]
    },
    {
      id: "ganges",
      name: "Ganges-Brahmaputra Plain",
      match: { lon: [76, 93.5], lat: [21, 31.5] },
      mode: "monsoon",
      label: "季风补给抵消的洪泛平原系统",
      summary: "强灌溉与强季风补给并存，局地地下水亏损和洪泛平原补给会在流域尺度混合，表现出明显空间异质性。",
      cycle: ["洪泛平原补给强", "河流和含水层交换频繁", "灌溉回归流可缓冲部分抽采影响"],
      pattern: ["西部更易亏损", "东部和洪泛区更易出现补给抵消"],
      references: ["rodell2018Freshwater", "globalIrrigationReview", "jasechko2024Aquifers"]
    },
    {
      id: "north-china-plain",
      name: "North China Plain",
      match: { lon: [112, 121.5], lat: [34, 41.5] },
      mode: "managed",
      label: "强人类干预下的治理恢复系统",
      summary: "早期地下水灌溉造成显著亏损，近年因南水北调、限采和生态补水出现恢复或缓冲信号，是强人类干预下的治理响应型系统。",
      cycle: ["地下水灌溉压力强", "外源水替代部分抽采", "治理措施可能改变地下水趋势方向"],
      pattern: ["2000-2019 年呈混合亏损与治理初期信号", "2020 年后恢复信号更强"],
      references: ["leng2014NorthChina", "long2025NorthChina", "leng2015Irrigation"]
    },
    {
      id: "yellow-river",
      name: "Yellow River Basin",
      match: { lon: [96, 120.5], lat: [32, 42.5] },
      mode: "reservoir",
      label: "人类调控主导的径流特征变化",
      summary: "灌溉、水库和土地利用共同改变高流量、低流量和年径流特征，下游可用水量对人类调控高度敏感。",
      cycle: ["径流总体减少", "水库调节洪枯过程", "中下游用水削弱下游可用水"],
      pattern: ["1980 年代后流量特征明显变化", "中下游人为贡献更强"],
      references: ["wang2020YellowRiver", "leng2015Irrigation"]
    },
    {
      id: "tigris-euphrates",
      name: "Tigris-Euphrates-Western Iran",
      match: { lon: [34, 58.5], lat: [25, 39.5] },
      mode: "dryIrrigation",
      label: "干旱区抽采与水库压力叠加",
      summary: "干旱背景下，灌溉、地下水抽采、水库和跨境分配共同导致总水储量和地下水亏损。",
      cycle: ["潜在蒸散高且补给有限", "地下水作为隐性缓冲水源", "水库调度影响下游供水"],
      pattern: ["多年干旱期亏损更明显", "西伊朗和灌区压力突出"],
      references: ["rodell2018Freshwater", "globalIrrigationReview"]
    },
    {
      id: "aral",
      name: "Aral Sea / Amu Darya-Syr Darya",
      match: { lon: [54, 75.5], lat: [37, 48.5] },
      mode: "reservoir",
      label: "端流湖泊引水与灌溉损失",
      summary: "大规模灌溉引水把入湖径流转化为灌区蒸散和排盐水，导致端流湖泊系统重组。",
      cycle: ["入湖径流下降", "灌区蒸散和盐分累积", "湖泊水量与盐度强烈变化"],
      pattern: ["1960 年代后长期萎缩", "北 Aral 局部存在治理恢复"],
      references: ["globalIrrigationReview", "rodell2018Freshwater"]
    },
    {
      id: "mekong",
      name: "Lower Mekong",
      match: { lon: [98, 107.5], lat: [8, 23.5] },
      mode: "reservoir",
      label: "水电调度改变洪泛脉冲",
      summary: "水电梯级改变洪泛脉冲、枯水期流量和湖泊湿地连通性，核心变化往往体现在年内分配而非年总量。",
      cycle: ["丰水期削峰", "枯水期释放改变", "沉积物和生态连通性变化"],
      pattern: ["年均水量不一定明显下降", "年内分配和极值过程更关键"],
      references: ["galelli2024Mekong", "rodell2018Freshwater"]
    },
    {
      id: "nile",
      name: "Nile Basin",
      match: { lon: [24, 35.5], lat: [5, 32] },
      mode: "reservoir",
      label: "大型水库与跨境分配控制",
      summary: "High Aswan Dam、GERD 和灌溉配置改变下游供水稳定性、蒸发损失和跨境调度风险。",
      cycle: ["上游高原降水控制径流", "大型水库改变年内流量", "蒸发损失和跨境调度风险并存"],
      pattern: ["旱年连续发生时风险放大", "调度规则决定下游影响"],
      references: ["wheeler2020Nile", "rodell2018Freshwater"]
    },
    {
      id: "murray-darling",
      name: "Murray-Darling Basin",
      match: { lon: [139, 153.5], lat: [-38.5, -24] },
      mode: "reservoir",
      label: "干旱河流管理与生态流量调控",
      summary: "在高自然变率背景下，灌溉分水和河流调控改变低流量、湿地洪泛和生态流量。",
      cycle: ["干旱期低流量压力强", "地表水和地下水联系被调控改变", "环境水恢复政策介入"],
      pattern: ["Millennium Drought 暴露系统脆弱性", "政策恢复响应空间不均一"],
      references: ["rodell2018Freshwater", "globalIrrigationReview"]
    }
  ]
};
