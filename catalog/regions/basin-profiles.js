window.RESEARCH_EXPLORER = {
  modes: {
    snow: { label: "Snow and Glacier Melt Dominant", color: "#39b8c4" },
    monsoon: { label: "Monsoon Floodplain Recharge", color: "#48c78e" },
    dryIrrigation: { label: "Arid Irrigation & Groundwater Dependent", color: "#e85d75" },
    reservoir: { label: "Reservoir Regulation & Flow Redistribution", color: "#8f72d8" },
    humid: { label: "Humid Runoff Dominant", color: "#4f8ce8" },
    tropical: { label: "Tropical High-runoff Forest Basin", color: "#1f9d68" },
    boreal: { label: "Boreal Snowmelt and Wetland Storage", color: "#2d9cdb" },
    dryNatural: { label: "Natural Dryland Ephemeral Flow", color: "#c98b2b" },
    mountain: { label: "Mountain Orographic Runoff", color: "#7b8fa1" },
    lowHumanImpact: { label: "Low Human-impact Natural Basin", color: "#6abf69" },
    managed: { label: "Managed Recovery or External Transfer", color: "#d89b35" },
    mixed: { label: "Mixed or Weak Diagnosis", color: "#9aa3ad" }
  },
  modeProfiles: {
    snow: {
      summary: "Cold-region or high-elevation basins where snow accumulation, glacier melt, and seasonal freeze-thaw regulate runoff timing. Human influence can be low, but climate warming can shift melt timing and storage.",
      cycle: ["Seasonal snowpack stores winter precipitation", "Spring/summer melt controls runoff pulse", "Warming can reduce snow storage and advance peak flow"],
      pattern: ["High-latitude and mountain basins", "Strong seasonality in snow water equivalent and runoff"],
      references: ["barnett2005Snow", "immerzeel2010AsiaWaterTowers", "huss2017Glacier", "musselman2021SnowDrought", "taylor2013GroundwaterClimate"]
    },
    monsoon: {
      summary: "Monsoon-dominated basins where seasonal rainfall, floodplain storage, river-aquifer exchange, and recharge pulses shape water availability.",
      cycle: ["Wet-season precipitation drives floodplain and aquifer recharge", "Dry-season water availability depends on storage carryover", "Irrigation can amplify or offset monsoon variability"],
      pattern: ["Strong intra-annual rainfall concentration", "Large floodplain storage and recharge heterogeneity"],
      references: ["asoka2017India", "shamsudduha2012GBM", "papa2015GBMStorage", "macdonald2016IndoGangetic", "revelle1964GangesMachine"]
    },
    dryIrrigation: {
      summary: "Dryland or semi-arid basins where irrigation and groundwater abstraction often exceed renewable supply, causing groundwater depletion and storage imbalance.",
      cycle: ["Potential evapotranspiration is high", "Irrigation converts groundwater or imported surface water into ET", "Recharge is often insufficient to balance abstraction"],
      pattern: ["Persistent groundwater storage decline", "Drought years amplify pumping and storage deficits"],
      references: ["wada2010GlobalGroundwater", "wada2012Nonsustainable", "gleeson2012WaterBalance", "richey2015RenewableStress", "globalIrrigationReview", "jasechko2024Aquifers"]
    },
    reservoir: {
      summary: "Regulated river basins where reservoirs, hydropower, diversions, and operating rules redistribute flow seasonally and spatially.",
      cycle: ["Reservoirs store wet-season or snowmelt runoff", "Operations alter flood peaks and dry-season flows", "Downstream ecosystems and sediment budgets can be disrupted"],
      pattern: ["Intra-annual flow redistribution is often stronger than annual volume change", "Cumulative basin impacts depend on cascade operation and water allocation"],
      references: ["zarfl2015Boom", "grill2019FreeFlowing", "deGraaf2019EnvironmentalFlow", "hecht2019Mekong", "galelli2024Mekong"]
    },
    humid: {
      summary: "Humid runoff-dominated basins where precipitation and evapotranspiration regulate streamflow, and water-cycle imbalance often appears through flood extremes, land-use change, or climate-driven runoff shifts rather than groundwater mining.",
      cycle: ["Frequent rainfall maintains soil moisture and runoff", "Storage deficits are usually episodic unless land use or climate shifts strongly", "Flood and high-flow changes can dominate risk"],
      pattern: ["High runoff ratios relative to drylands", "Hydrological sensitivity to precipitation extremes and vegetation change"],
      references: ["milly2008Stationarity", "huntington2006Intensification", "oGorman2015ExtremePrecip", "bloschl2019Floods", "vanDijk2013GlobalWaterCycle"]
    },
    tropical: {
      summary: "Tropical forest and rainforest basins with high rainfall, strong evapotranspiration recycling, and relatively low direct human water abstraction in many headwater or intact forest areas.",
      cycle: ["High precipitation and forest ET sustain atmospheric moisture recycling", "Wetlands and floodplains buffer seasonal storage", "Deforestation can alter rainfall-runoff partitioning"],
      pattern: ["High annual runoff and strong wet-season dynamics", "Land-cover change can be more important than irrigation abstraction"],
      references: ["spracklen2012Rainfall", "nobre2016Amazon", "sorribas2016Amazon", "davidson2012Amazon", "vanDijk2013GlobalWaterCycle"]
    },
    boreal: {
      summary: "High-latitude boreal and wetland basins where snowmelt, frozen ground, peatlands, lakes, and wetlands control storage and runoff timing.",
      cycle: ["Winter storage is released during snowmelt", "Wetlands and lakes buffer runoff", "Permafrost thaw and warming can alter subsurface flow paths"],
      pattern: ["Large seasonal runoff pulse", "Climate warming shifts snow, ice, and wetland storage"],
      references: ["bring2015Arctic", "walvoord2016Permafrost", "smith2007ArcticDrainage", "barnett2005Snow", "musselman2021SnowDrought"]
    },
    dryNatural: {
      summary: "Arid or semi-arid basins with limited human water use where natural water imbalance is dominated by low rainfall, high evaporative demand, episodic runoff, and high interannual variability.",
      cycle: ["Rainfall is sparse and often episodic", "Runoff is flashy and transmission losses can be high", "Groundwater recharge occurs in rare events or focused zones"],
      pattern: ["Ephemeral channels and high drought sensitivity", "Storage changes driven more by climate variability than direct abstraction"],
      references: ["goodrich1997Ephemeral", "tooth2000Dryland", "dunkerley2008DesertRunoff", "taylor2013GroundwaterClimate", "huntington2006Intensification"]
    },
    mountain: {
      summary: "Mountain basins where orographic precipitation, steep gradients, snow/glacier storage, and headwater runoff generation supply downstream lowlands.",
      cycle: ["Orographic precipitation and snowpack feed headwater runoff", "Glacier and seasonal snow buffer dry periods", "Warming shifts timing and reliability of downstream supply"],
      pattern: ["Strong elevation gradients", "High downstream dependency on headwater storage"],
      references: ["viviroli2007Mountains", "immerzeel2010AsiaWaterTowers", "huss2017Glacier", "barnett2005Snow", "milly2008Stationarity"]
    },
    lowHumanImpact: {
      summary: "Basins with no strong signal of irrigation, reservoir regulation, or dense population in this prototype's current rules. Their profile is treated as natural or weakly disturbed until better land-use, dam, population, and withdrawal data are added.",
      cycle: ["Hydrology mainly follows climate, topography, soils, and vegetation", "Human water-cycle imbalance is not assumed without evidence", "Mode assignment should be refined with future pressure datasets"],
      pattern: ["Current classification is intentionally conservative", "Useful baseline for comparing altered and unaltered basins"],
      references: ["vorosmarty2010GlobalThreats", "best2019Anthropocene", "milly2008Stationarity", "vanDijk2013GlobalWaterCycle", "huntington2006Intensification"]
    },
    mixed: {
      summary: "Basins with ambiguous signals under the current rule-based classifier. They need additional data on climate, dams, land use, withdrawals, snow, groundwater, and population pressure.",
      cycle: ["Multiple mechanisms may coexist", "Current prototype provides screening rather than definitive attribution", "Use literature and data layers to refine diagnosis"],
      pattern: ["Uncertainty is part of the classification", "Future releases should replace coarse rules with data-driven indicators"],
      references: ["vorosmarty2010GlobalThreats", "best2019Anthropocene", "milly2008Stationarity", "rodell2018Freshwater", "vanDijk2013GlobalWaterCycle"]
    }
  },
  highlightedRegions: [
    {
      id: "high-plains",
      name: "High Plains / Ogallala",
      match: { lon: [-106.5, -94], lat: [31, 45] },
      mode: "dryIrrigation",
      label: "Groundwater-supported Semi-arid Irrigation",
      summary: "Low-recharge semi-arid irrigation system where long-term groundwater pumping converts aquifer storage to crop evapotranspiration, forming a typical human water use-driven water cycle redistribution.",
      cycle: ["Long-term groundwater storage depletion", "Irrigation increases crop ET and reduces natural water retention", "Natural recharge insufficient for slow recovery"],
      pattern: ["Depletion stronger in central-southern regions", "Multi-year cumulative trends more critical than single-year anomalies"],
      references: ["scanlon2012", "steward2013HighPlains", "perkins2017HighPlainsFish", "deines2020HighPlains", "foster2024HighPlainsDrought", "jasechko2024Aquifers", "wada2010GlobalGroundwater", "gleeson2012WaterBalance", "globalIrrigationReview"]
    },
    {
      id: "central-valley",
      name: "California Central Valley",
      match: { lon: [-123.5, -118], lat: [34, 41.5] },
      mode: "dryIrrigation",
      label: "Groundwater Substitution under Surface Water Shortage",
      summary: "Coupled surface water infrastructure and groundwater pumping, with enhanced groundwater substitution pumping during drought periods leading to synchronized groundwater, total storage, and subsidence risk changes.",
      cycle: ["Snowmelt and reservoir supply has interannual variability", "Groundwater compensation pumping enhanced during droughts", "Wet years can briefly recover but cannot fully offset cumulative depletion"],
      pattern: ["San Joaquin Valley has stronger pressure", "Drought sequences amplify groundwater anomalies"],
      references: ["scanlon2012", "famiglietti2011CentralValley", "ojha2018CentralValley", "liu2022CentralValley", "alam2021CentralValleyRecovery", "faunt2016CentralValley", "rodell2018Freshwater", "wada2012Nonsustainable", "globalIrrigationReview"]
    },
    {
      id: "indus",
      name: "Indus / Northwest India",
      match: { lon: [67, 78.5], lat: [22, 36.5] },
      mode: "dryIrrigation",
      label: "Irrigation Pumping-driven Groundwater Depletion",
      summary: "High-intensity grain production, tubewell irrigation, and limited recharge jointly drive rapid groundwater depletion, representing one of the most typical human water use perturbation zones globally.",
      cycle: ["Monsoon recharge and dry season irrigation mismatch", "Groundwater supports agricultural water consumption", "GRACE observes significant total water storage depletion"],
      pattern: ["Northwest India and Indus irrigation areas have strongest pressure", "Monsoon interannual variability combined with long-term pumping"],
      references: ["rodell2009India", "tiwari2009India", "macdonald2016IndoGangetic", "asoka2017India", "macallister2022Accumulation", "yin2021IndusTWS", "arshad2022IndusSWAT", "jasechko2024Aquifers", "wada2012Nonsustainable", "globalIrrigationReview"]
    },
    {
      id: "ganges",
      name: "Ganges-Brahmaputra Plain",
      match: { lon: [76, 93.5], lat: [21, 31.5] },
      mode: "monsoon",
      label: "Monsoon Recharge-offset Floodplain System",
      summary: "Strong irrigation and strong monsoon recharge coexist, with local groundwater depletion and floodplain recharge mixing at basin scale, showing significant spatial heterogeneity.",
      cycle: ["Strong floodplain recharge", "Frequent river-aquifer exchange", "Irrigation return flow can buffer some pumping impacts"],
      pattern: ["Western regions more prone to depletion", "Eastern and floodplain areas more prone to recharge offset"],
      references: ["macdonald2016IndoGangetic", "rodell2009India", "tiwari2009India", "asoka2017India", "shamsudduha2012GBM", "papa2015GBMStorage", "revelle1964GangesMachine", "rodell2018Freshwater", "globalIrrigationReview", "jasechko2024Aquifers"]
    },
    {
      id: "north-china-plain",
      name: "North China Plain",
      match: { lon: [112, 121.5], lat: [34, 41.5] },
      mode: "managed",
      label: "Managed Recovery under Strong Human Intervention",
      summary: "Early groundwater irrigation caused significant depletion, recent years show recovery or buffering signals due to South-to-North Water Transfer, extraction limits, and ecological water replenishment.",
      cycle: ["Strong groundwater irrigation pressure", "External water substitutes part of pumping", "Governance measures may change groundwater trend direction"],
      pattern: ["2000-2019 shows mixed depletion and early governance signals", "Post-2020 recovery signals stronger"],
      references: ["leng2014NorthChina", "feng2013NorthChina", "chen2019NorthChinaAcceleration", "cao2013NorthChinaRecharge", "long2025NorthChina", "piao2010ChinaWater", "leng2015Irrigation", "jasechko2024Aquifers", "taylor2013GroundwaterClimate"]
    },
    {
      id: "yellow-river",
      name: "Yellow River Basin",
      match: { lon: [96, 120.5], lat: [32, 42.5] },
      mode: "reservoir",
      label: "Human Regulation-dominated Runoff Character Changes",
      summary: "Irrigation, reservoirs, and land use jointly alter high flow, low flow, and annual runoff characteristics; downstream water availability is highly sensitive to human regulation.",
      cycle: ["Runoff generally decreasing", "Reservoirs regulate flood-dry processes", "Mid-downstream water use reduces downstream availability"],
      pattern: ["Post-1980s flow characteristics significantly changed", "Human contribution stronger in mid-downstream"],
      references: ["wang2020YellowRiver", "kong2020YellowRiver500y", "mueller2016YellowSedimentRunoff", "li2019YellowTWS", "piao2010ChinaWater", "leng2015Irrigation", "rodell2018Freshwater", "pokhrel2012HumanWaterCycle"]
    },
    {
      id: "tigris-euphrates",
      name: "Tigris-Euphrates-Western Iran",
      match: { lon: [34, 58.5], lat: [25, 39.5] },
      mode: "dryIrrigation",
      label: "Arid Pumping and Reservoir Pressure Combined",
      summary: "Under arid conditions, irrigation, groundwater pumping, reservoirs, and transboundary allocation jointly cause total water storage and groundwater depletion.",
      cycle: ["High potential ET and limited recharge", "Groundwater as implicit buffer water source", "Reservoir operation affects downstream supply"],
      pattern: ["Multi-year drought periods show stronger depletion", "Western Iran and irrigation areas have prominent pressure"],
      references: ["voss2013MiddleEast", "joodaki2014MiddleEast", "grace2018TigrisDrought", "alAnsari2021TigrisReview", "rodell2018Freshwater", "wada2010GlobalGroundwater", "globalIrrigationReview"]
    },
    {
      id: "aral",
      name: "Aral Sea / Amu Darya-Syr Darya",
      match: { lon: [54, 75.5], lat: [37, 48.5] },
      mode: "reservoir",
      label: "Terminal Lake Diversion and Irrigation Loss",
      summary: "Large-scale irrigation diversion converts inflow runoff to irrigation area ET and saline drainage, leading to terminal lake system reorganization.",
      cycle: ["Lake inflow runoff declining", "Irrigation area ET and salt accumulation", "Lake water volume and salinity strongly changing"],
      pattern: ["Long-term shrinkage post-1960s", "North Aral has local governance recovery"],
      references: ["micklin2007Aral", "gaybullaev2012AralBalance", "small2001Aral", "cretaux2013Aral", "globalIrrigationReview", "rodell2018Freshwater", "pokhrel2012HumanWaterCycle"]
    },
    {
      id: "mekong",
      name: "Lower Mekong",
      match: { lon: [98, 107.5], lat: [8, 23.5] },
      mode: "reservoir",
      label: "Hydropower Operation Alters Floodplain Pulse",
      summary: "Hydropower cascade alters floodplain pulse, dry season flow, and lake-wetland connectivity; core changes often appear in intra-annual distribution rather than annual totals.",
      cycle: ["Wet season peak reduction", "Dry season release changed", "Sediment and ecological connectivity changes"],
      pattern: ["Annual water volume not necessarily significantly declining", "Intra-annual distribution and extreme processes more critical"],
      references: ["hecht2019Mekong", "rasanen2017Mekong", "galelli2024Mekong", "ziv2012MekongTradeoffs", "kondolf2018MekongSediment", "dang2020MekongDams", "rodell2018Freshwater", "deGraaf2019EnvironmentalFlow"]
    },
    {
      id: "nile",
      name: "Nile Basin",
      match: { lon: [24, 35.5], lat: [5, 32] },
      mode: "reservoir",
      label: "Large Reservoir and Transboundary Allocation Control",
      summary: "High Aswan Dam, GERD, and irrigation configuration alter downstream supply stability, evaporation losses, and transboundary operation risks.",
      cycle: ["Upper plateau precipitation controls runoff", "Large reservoirs alter intra-annual flow", "Evaporation losses and transboundary operation risks coexist"],
      pattern: ["Risk amplified when drought years consecutively occur", "Operation rules determine downstream impacts"],
      references: ["wheeler2020Nile", "siam2017Nile", "basheer2021Nile", "zhang2015NileGERD", "elshamy2009NileClimate", "kahsay2015NileCooperation", "rodell2018Freshwater", "taylor2013GroundwaterClimate"]
    },
    {
      id: "murray-darling",
      name: "Murray-Darling Basin",
      match: { lon: [139, 153.5], lat: [-38.5, -24] },
      mode: "reservoir",
      label: "Dry River Management and Environmental Flow Regulation",
      summary: "Under high natural variability, irrigation diversion and river regulation alter low flows, wetland flooding, and environmental flows.",
      cycle: ["Strong low flow pressure during droughts", "Surface-groundwater connection altered by regulation", "Environmental water recovery policy intervention"],
      pattern: ["Millennium Drought exposed system vulnerability", "Policy recovery response spatially uneven"],
      references: ["leblanc2009MurrayDarling", "vandijk2013MurrayDarling", "cai2008MDBClimate", "chiew2011MDBDrought", "grafton2011MDBPlan", "rodell2018Freshwater", "globalIrrigationReview", "deGraaf2019EnvironmentalFlow"]
    }
  ]
};
