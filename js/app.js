(function () {
  'use strict';

  const PER_PAGE = 50;
  const MAX_COMPARE = 6;

  var allData = { cpu: [], gpu: [] };
  var filteredData = { cpu: [], gpu: [] };
  var currentTab = 'cpu';
  var sortField = null;
  var sortDir = 'asc';
  var currentPage = 1;
  var compareSet = new Set();
  var compareMode = false;

  var tierYearStats = { cpu: {}, gpu: {} };
  var tierBandStats = { cpu: {}, gpu: {} };
  var latestYear = { cpu: {}, gpu: {} };
  var manuCounts = { cpu: {}, gpu: {} };

  var state = {
    search: '',
    manufacturers: new Set(),
    sockets: new Set(),
    processes: new Set(),
    tdpMin: null,
    tdpMax: null,
    yearMin: null,
    yearMax: null,
    pmMin: null,
    pmMax: null,
    busTypes: new Set(),
    memSizeMin: null,
    memSizeMax: null,
  };

  var els = {};

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function initElements() {
    els.sidebar = document.getElementById('sidebar');
    els.sidebarOverlay = document.getElementById('sidebar-overlay');
    els.sidebarToggle = document.getElementById('sidebar-toggle');
    els.search = document.getElementById('search');
    els.filterManu = document.getElementById('filter-manufacturer');
    els.filterSocket = document.getElementById('filter-socket');
    els.filterProcess = document.getElementById('filter-process');
    els.filterGpuBus = document.getElementById('filter-gpu-bus');
    els.gpuMemMin = document.getElementById('gpu-mem-min');
    els.gpuMemMax = document.getElementById('gpu-mem-max');
    els.tdpMin = document.getElementById('tdp-min');
    els.tdpMax = document.getElementById('tdp-max');
    els.yearMin = document.getElementById('year-min');
    els.yearMax = document.getElementById('year-max');
    els.pmMin = document.getElementById('pm-min');
    els.pmMax = document.getElementById('pm-max');
    els.clearFilters = document.getElementById('clear-filters');
    els.clearFiltersEmpty = document.getElementById('clear-filters-empty');
    els.resultCount = document.getElementById('result-count');
    els.cpuTbody = document.getElementById('cpu-tbody');
    els.gpuTbody = document.getElementById('gpu-tbody');
    els.emptyState = document.getElementById('empty-state');
    els.emptyStateMsg = document.getElementById('empty-state-msg');
    els.loadingState = document.getElementById('loading-state');
    els.loadingStateMsg = document.getElementById('loading-state-msg');
    els.pagination = document.getElementById('pagination');
    els.compareMode = document.getElementById('compare-mode');
    els.compareBtn = document.getElementById('compare-btn');
    els.compareCount = document.getElementById('compare-count');
    els.selectAll = document.getElementById('select-all');
    els.compareModal = document.getElementById('compare-modal');
    els.compareModalTitle = document.getElementById('compare-modal-title');
    els.compareBody = document.getElementById('compare-body');
    els.modalClose = document.getElementById('modal-close');
    els.detailModal = document.getElementById('detail-modal');
    els.detailName = document.getElementById('detail-name');
    els.detailBody = document.getElementById('detail-body');
    els.detailClose = document.getElementById('detail-close');
    els.cpuTable = document.getElementById('cpu-table');
    els.tabBtns = qsa('.tab-btn');
  }

  function getTbody() {
    return currentTab === 'cpu' ? els.cpuTbody : els.gpuTbody;
  }

  function getAllItems() {
    return allData[currentTab];
  }

  function getFilteredItems() {
    return filteredData[currentTab];
  }

  function setFilteredItems(arr) {
    filteredData[currentTab] = arr;
  }

  // ── CPU helpers ──

  function deriveManufacturer(name) {
    var lower = name.toLowerCase();
    if (/^core[ \s-]|^xeon[ \s-]|^pentium[ \s-]|^celeron[ \s-]|^atom[ \s-]|^itanium[ \s-]|^intel[ \s-]/i.test(name)) return 'Intel';
    if (/^arc[ \s-]/i.test(name)) return 'Intel';
    if (/^processor[ \s-]/i.test(name)) return 'Intel';
    if (/^mobile (core|pentium|celeron|atom|xeon)([ \s-]|$)/i.test(name)) return 'Intel';
    if (/^mobile (athlon|duron|sempron|ryzen) /i.test(name)) return 'AMD';
    if (/^aubrey isle/i.test(name)) return 'Intel';
    if (/^a100$|^a110$/i.test(name)) return 'Intel';
    if (/^ryzen[ \s-]|^athlon[ \s-]|^epyc[ \s-]|^opteron[ \s-]|^phenom[ \s-]|^sempron[ \s-]|^turion[ \s-]|^duron[ \s-]/i.test(name)) return 'AMD';
    if (/^a\d{1,3}[\s-]/i.test(name)) return 'AMD';
    if (/^e[12]?[\s-]/i.test(name)) return 'AMD';
    if (/^c-\d+/i.test(name)) return 'AMD';
    if (/^gx[\s-]/i.test(name)) return 'AMD';
    if (/^fx[\s-]/i.test(name)) return 'AMD';
    if (/^z-\d+/i.test(name)) return 'AMD';
    if (/^pro[ \s-]/i.test(name) && /a\d{1,2}/i.test(name)) return 'AMD';
    if (/^steam deck /i.test(name)) return 'AMD';
    if (/^firepro[ \s-]/i.test(name)) return 'AMD';
    if (/^k6[-+]/i.test(name)) return 'AMD';
    if (/^4\d{3}s/i.test(name)) return 'AMD';
    if (/^a\d{1,2} pro[\s-]/i.test(name)) return 'AMD';
    if (/^snapdragon[ \s-]/i.test(name) || /^qualcomm[ \s-]/i.test(name)) return 'Qualcomm';
    if (/^apple[ \s-]/i.test(name)) return 'Apple';
    if (/^kunpeng[ \s-]/i.test(name) || /^hisilicon[ \s-]/i.test(name)) return 'HiSilicon';
    if (/^(nano |c3 |c86 |corefusion |centaur[ \s-]|1\.1gigapro|xp2000\+)/i.test(name)) return 'VIA';
    if (/^jh-7110/i.test(name)) return 'StarFive';
    if (/\bintel\b/.test(lower)) return 'Intel';
    if (/\bamd\b/.test(lower)) return 'AMD';
    return 'Other';
  }

  function parseReleaseYear(released) {
    if (!released) return null;
    var m = released.match(/\b(\d{4})\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseTDP(tdp) {
    if (tdp == null || tdp === '' || tdp === 'N/A' || tdp === '—') return null;
    var m = String(tdp).match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  }

  function parseMaxClock(clock) {
    if (!clock) return null;
    var nums = clock.match(/[\d.]+/g);
    if (!nums || !nums.length) return null;
    var max = 0;
    for (var i = 0; i < nums.length; i++) {
      var v = parseFloat(nums[i]);
      if (v > max) max = v;
    }
    // Normalize MHz to GHz (all modern CPUs use GHz, but some older entries are in MHz)
    if (max >= 100) max = max / 1000;
    return max || null;
  }

  function getCpuTier(pm) {
    if (pm >= 40000) return 'tier-flagship';
    if (pm >= 20000) return 'tier-ultra';
    if (pm >= 10000) return 'tier-high';
    if (pm >= 5000) return 'tier-med';
    return 'tier-low';
  }
  function getCpuTierLabel(pm) {
    if (pm >= 40000) return 'Flagship';
    if (pm >= 20000) return 'Ultra';
    if (pm >= 10000) return 'High';
    if (pm >= 5000) return 'Mid';
    return 'Entry';
  }

  function getCpuSortValue(cpu, field) {
    switch (field) {
      case 'name': return (cpu.name || '').toLowerCase();
      case 'coresThreads': {
        var m = (cpu.coresThreads || '').match(/^(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      }
      case 'clock': return parseMaxClock(cpu.clock) || 0;
      case 'socket': return (cpu.socket || '').toLowerCase();
      case 'process': {
        var pm = (cpu.process || '').match(/^([\d.]+)/);
        return pm ? parseFloat(pm[1]) : 999;
      }
      case 'tdp': return parseTDP(cpu.tdp) || 0;
      case 'passmark': return cpu.passmark || 0;
      case 'released': return parseReleaseYear(cpu.released) || 0;
      default: return '';
    }
  }

  function processCpus(cpus) {
    return cpus.map(function (cpu) {
      return {
        name: cpu.name || 'Unknown',
        fullName: cpu._details && cpu._details._fullName,
        codename: cpu.codename || '—',
        coresThreads: cpu.coresThreads || '—',
        clock: cpu.clock || '—',
        socket: cpu.socket || '—',
        process: cpu.process || '—',
        l3Cache: cpu.l3Cache || '—',
        tdp: cpu.tdp || '—',
        released: cpu.released || '—',
        url: cpu.url || '',
        passmark: cpu.passmark || null,
        manufacturer: deriveManufacturer(cpu.name || ''),
        releaseYear: parseReleaseYear(cpu.released),
        igpu: cpu.igpu || null,
      };
    });
  }

  function buildCpuFilterOptions(cpus) {
    var manufacturers = new Set();
    var sockets = new Set();
    var processes = new Set();
    for (var i = 0; i < cpus.length; i++) {
      var c = cpus[i];
      if (c.manufacturer) manufacturers.add(c.manufacturer);
      if (c.socket && c.socket !== '—') sockets.add(c.socket);
      if (c.process && c.process !== '—') processes.add(c.process);
    }
    return {
      manufacturers: sortSet(manufacturers),
      sockets: sortSockets(sortSet(sockets)),
      processes: sortSet(processes, function (a, b) {
        var na = parseFloat(a) || 0, nb = parseFloat(b) || 0;
        return na - nb;
      }),
    };
  }

  // ── GPU helpers ──

  function deriveGpuManufacturer(name) {
    if (!name) return 'Other';
    var lower = name.toLowerCase().trim();
    // Known brands
    if (/^intel/i.test(lower)) return 'Intel';
    if (/^amd/i.test(lower)) return 'AMD';
    if (/^nvidia/i.test(lower) || /^geforce/i.test(lower) || /^quadro/i.test(lower) || /^tesla/i.test(lower) || /^nvs/i.test(lower) || /^grid/i.test(lower) || /^titan/i.test(lower)) return 'NVIDIA';
    if (/^radeon/i.test(lower) || /^firepro/i.test(lower) || /^firegl/i.test(lower) || /^firemv/i.test(lower) || /^firestream/i.test(lower) || /^ryzen/i.test(lower) || /^instinct/i.test(lower)) return 'AMD';
    if (/^qualcomm/i.test(lower)) return 'Qualcomm';
    if (/^apple/i.test(lower)) return 'Apple';
    if (/^matrox/i.test(lower)) return 'Matrox';
    if (/^s3\b/i.test(lower)) return 'S3';
    if (/^via/i.test(lower)) return 'VIA';
    if (/^mobility/i.test(lower)) {
      // Check second word
      var parts = name.split(/\s+/);
      if (parts.length > 1) return deriveGpuManufacturer(parts[1]);
    }
    // Any name containing known brands
    if (/\bintel\b/.test(lower)) return 'Intel';
    if (/\bamd\b/.test(lower)) return 'AMD';
    if (/\bnvidia\b/.test(lower)) return 'NVIDIA';
    // PCI IDs, weird strings, numbers → Other
    if (/^pci\\/.test(lower) || /^\d/.test(lower) || /^[a-z0-9]{8,}$/.test(lower) || lower.length > 30) return 'Other';
    var first = (name.split(/\s+/)[0] || '').trim();
    return first || 'Other';
  }

  function parseG3D(g3d) {
    return (g3d != null && typeof g3d === 'number') ? Math.round(g3d) : 0;
  }

  function parseG2D(g2d) {
    return (g2d != null && typeof g2d === 'number') ? Math.round(g2d) : 0;
  }

  function parseMemSize(memSize) {
    if (!memSize) return 0;
    var m = String(memSize).match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function getGpuTier(g3d) {
    if (g3d >= 30000) return 'tier-flagship';
    if (g3d >= 20000) return 'tier-ultra';
    if (g3d >= 10000) return 'tier-high';
    if (g3d >= 3000) return 'tier-med';
    return 'tier-low';
  }

  function getGpuTierLabel(g3d) {
    if (g3d >= 30000) return 'Flagship';
    if (g3d >= 20000) return 'Ultra';
    if (g3d >= 10000) return 'High';
    if (g3d >= 3000) return 'Mid';
    return 'Entry';
  }

  function getGpuSortValue(gpu, field) {
    switch (field) {
      case 'name': return (gpu.name || '').toLowerCase();
      case 'g3d': return gpu.g3d || 0;
      case 'g2d': return gpu.g2d || 0;
      case 'type': return (g.manufacturer || '').toLowerCase();
      case 'category': return (gpu.category || '').toLowerCase();
      case 'bus': return (gpu.bus || '').toLowerCase();
      case 'memSize': return parseMemSize(gpu.memSize);
      case 'tdp': return parseTDP(gpu.tdp) || 0;
      case 'released': return gpu.releaseYear || 0;
      default: return '';
    }
  }

  function processGpus(gpus) {
    return gpus.map(function (gpu) {
      var g3d = parseG3D(gpu.g3d);
      var g2d = parseG2D(gpu.g2d);
      return {
        name: gpu.name || 'Unknown',
        url: gpu.url || '',
        g3d: g3d,
        g2d: g2d,
        integrated: !!gpu.integrated,
        category: gpu.category || '—',
        bus: gpu.bus || '—',
        memSize: gpu.memSize || '—',
        memSizeNum: parseMemSize(gpu.memSize),
        tdp: gpu.tdp || '—',
        tdpNum: parseTDP(gpu.tdp),
        released: gpu.released || '—',
        releaseYear: parseReleaseYear(gpu.released),
        manufacturer: deriveGpuManufacturer(gpu.name || ''),
        coreClk: gpu.coreClk || '—',
        memClk: gpu.memClk || '—',
      };
    });
  }

  function buildGpuFilterOptions(gpus) {
    var manufacturers = new Set();
    var buses = new Set();
    for (var i = 0; i < gpus.length; i++) {
      var g = gpus[i];
      if (g.manufacturer) manufacturers.add(g.manufacturer);
      if (g.bus && g.bus !== '—') buses.add(g.bus);
    }
    return {
      manufacturers: sortSet(manufacturers),
      buses: sortSet(buses),
    };
  }

  function sortSet(set, cmp) {
    var arr = [];
    set.forEach(function (v) { arr.push(v); });
    arr.sort(cmp || undefined);
    return arr;
  }

  function sortManufacturers(arr) {
    var order = ['Qualcomm', 'Intel', 'AMD', 'Apple', 'NVIDIA', 'HiSilicon', 'VIA', 'Matrox', 'S3', 'StarFive', 'Other'];
    var copy = arr.slice();
    copy.sort(function (a, b) {
      var ia = order.indexOf(a);
      var ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
    return copy;
  }

  function sortSockets(arr) {
    var copy = arr.slice();
    copy.sort(function (a, b) {
      var numsA = a.match(/[\d.]+/g);
      var numsB = b.match(/[\d.]+/g);
      var na = 0, nb = 0;
      if (numsA) for (var i = 0; i < numsA.length; i++) { var v = parseFloat(numsA[i]); if (v > na) na = v; }
      if (numsB) for (var i = 0; i < numsB.length; i++) { var v = parseFloat(numsB[i]); if (v > nb) nb = v; }
      if (na && nb) return nb - na;
      if (na) return -1;
      if (nb) return 1;
      return a.localeCompare(b);
    });
    return copy;
  }

  function renderFilterCheckboxes(container, values, filterKey, counts) {
    container.innerHTML = '';
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      var label = document.createElement('label');
      label.className = 'filter-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = v;
      cb.dataset.filterKey = filterKey;
      label.appendChild(cb);
      var span = document.createElement('span');
      span.textContent = v;
      label.appendChild(span);
      if (counts) {
        var cnt = document.createElement('span');
        cnt.className = 'count';
        cnt.textContent = counts[v] || 0;
        label.appendChild(cnt);
      }
      container.appendChild(label);
    }
  }

  // ── Tier-Year Stats ──

  function getCoreBand(coresThreads) {
    if (!coresThreads || coresThreads === '—') return null;
    var m = String(coresThreads).match(/^(\d+)/);
    var cores = m ? parseInt(m[1], 10) : 0;
    if (cores <= 0) return null;
    if (cores <= 4) return '1-4';
    if (cores <= 8) return '5-8';
    if (cores <= 16) return '9-16';
    return '17+';
  }

  function buildTierYearStats(data, tab) {
    var bandScores = {};
    var tierScores = {};
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var year = item.releaseYear;
      if (!year) continue;
      var score;
      var tier;
      if (tab === 'cpu') {
        score = item.passmark;
        tier = getCpuTierLabel(score || 0);
      } else {
        score = item.g3d;
        tier = getGpuTierLabel(score || 0);
      }
      if (!score || !tier) continue;
      // Per-band scores
      var coreBand = tab === 'cpu' ? getCoreBand(item.coresThreads) : 'all';
      var bandKey = tier + '|' + coreBand;
      if (!bandScores[bandKey]) bandScores[bandKey] = {};
      if (!bandScores[bandKey][year]) bandScores[bandKey][year] = [];
      bandScores[bandKey][year].push(score);
      // Aggregated tier scores (all core bands combined)
      if (!tierScores[tier]) tierScores[tier] = {};
      if (!tierScores[tier][year]) tierScores[tier][year] = [];
      tierScores[tier][year].push(score);
    }

    var topN = 10;
    function computeAverages(scores) {
      var result = {};
      var maxYear = {};
      for (var key in scores) {
        result[key] = {};
        var yMax = 0;
        for (var yr in scores[key]) {
          var all = scores[key][yr];
          all.sort(function (a, b) { return b - a; });
          var top = all.slice(0, topN);
          var sum = 0;
          for (var s = 0; s < top.length; s++) sum += top[s];
          result[key][yr] = Math.round(sum / top.length);
          var y = parseInt(yr, 10);
          if (y > yMax) yMax = y;
        }
        maxYear[key] = yMax;
      }
      return { stats: result, latestYear: maxYear };
    }

    var aggregated = computeAverages(tierScores);
    var banded = computeAverages(bandScores);
    return { stats: aggregated.stats, latestYear: aggregated.latestYear, bandStats: banded.stats, bandLatestYear: banded.latestYear };
  }

  function findModern26Tier(score, tab, tier, coreBand, selfScore) {
    var stats = tierBandStats[tab];
    if (!stats) return null;
    // Try specific core band first, fall back to any core band in same tier
    var keys = [tier + '|' + coreBand, tier + '|null', tier + '|all'];
    if (coreBand) {
      // Try neighboring bands if exact match not found
      var bands = ['1-4', '5-8', '9-16', '17+'];
      var idx = bands.indexOf(coreBand);
      if (idx > 0) keys.push(tier + '|' + bands[idx - 1]);
      if (idx < bands.length - 1) keys.push(tier + '|' + bands[idx + 1]);
    }
    for (var k = 0; k < keys.length; k++) {
      var avg = stats[keys[k]] && stats[keys[k]][2026] ? stats[keys[k]][2026] : null;
      if (avg) {
        // Exclude this item's own score if it was likely in the top 10
        var adjusted = avg;
        if (selfScore && selfScore >= avg * 0.7) {
          // Approximate: undo selfScore's contribution if it was in the top 10
          adjusted = Math.round((avg * 10 - selfScore) / 9);
          if (adjusted < 1) adjusted = avg;
        }
        return { tier: tier, avg: adjusted };
      }
    }
    return null;
  }

  // ── Filtering ──

  function applyFilters() {
    var items = getAllItems();
    var result = items;

    if (state.search) {
      var q = state.search.toLowerCase();
      result = result.filter(function (item) {
        var name = (item.name || '').toLowerCase();
        var manu = (item.manufacturer || '').toLowerCase();
        if (currentTab === 'cpu') {
          var codename = (item.codename || '').toLowerCase();
          var socket = (item.socket || '').toLowerCase();
          return name.indexOf(q) !== -1 || codename.indexOf(q) !== -1 || socket.indexOf(q) !== -1 || manu.indexOf(q) !== -1;
        }
        var bus = (item.bus || '').toLowerCase();
        var category = (item.category || '').toLowerCase();
        return name.indexOf(q) !== -1 || bus.indexOf(q) !== -1 || category.indexOf(q) !== -1 || manu.indexOf(q) !== -1;
      });
    }

    if (state.manufacturers.size) {
      result = result.filter(function (item) { return state.manufacturers.has(item.manufacturer); });
    }

    // CPU-specific filters
    if (currentTab === 'cpu') {
      if (state.sockets.size) {
        result = result.filter(function (c) { return state.sockets.has(c.socket); });
      }
      if (state.processes.size) {
        result = result.filter(function (c) { return state.processes.has(c.process); });
      }
    }

    // GPU-specific filters
    if (currentTab === 'gpu') {
      if (state.busTypes.size) {
        result = result.filter(function (g) { return state.busTypes.has(g.bus); });
      }
      if (state.memSizeMin !== null) {
        result = result.filter(function (g) { return g.memSizeNum > 0 && g.memSizeNum >= state.memSizeMin; });
      }
      if (state.memSizeMax !== null) {
        result = result.filter(function (g) { return g.memSizeNum > 0 && g.memSizeNum <= state.memSizeMax; });
      }
    }

    if (state.tdpMin !== null) {
      result = result.filter(function (item) {
        var v = parseTDP(item.tdp);
        return v !== null && v >= state.tdpMin;
      });
    }
    if (state.tdpMax !== null) {
      result = result.filter(function (item) {
        var v = parseTDP(item.tdp);
        return v !== null && v <= state.tdpMax;
      });
    }

    if (state.yearMin !== null) {
      result = result.filter(function (item) { return item.releaseYear !== null && item.releaseYear >= state.yearMin; });
    }
    if (state.yearMax !== null) {
      result = result.filter(function (item) { return item.releaseYear !== null && item.releaseYear <= state.yearMax; });
    }

    if (state.pmMin !== null) {
      if (currentTab === 'cpu') {
        result = result.filter(function (c) { return c.passmark !== null && c.passmark >= state.pmMin; });
      } else {
        result = result.filter(function (g) { return g.g3d > 0 && g.g3d >= state.pmMin; });
      }
    }
    if (state.pmMax !== null) {
      if (currentTab === 'cpu') {
        result = result.filter(function (c) { return c.passmark !== null && c.passmark <= state.pmMax; });
      } else {
        result = result.filter(function (g) { return g.g3d > 0 && g.g3d <= state.pmMax; });
      }
    }

    setFilteredItems(result);

    if (sortField) {
      getFilteredItems().sort(function (a, b) {
        var sortFn = currentTab === 'cpu' ? getCpuSortValue : getGpuSortValue;
        var va = sortFn(a, sortField);
        var vb = sortFn(b, sortField);
        // Push items with missing data (value 0) to the end regardless of sort direction
        var aMiss = (va === 0 || va === null || va === undefined);
        var bMiss = (vb === 0 || vb === null || vb === undefined);
        if (aMiss && bMiss) return 0;
        if (aMiss) return 1;
        if (bMiss) return -1;
        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDir === 'asc' ? (va - vb) : (vb - va);
      });
    }

    currentPage = 1;
    render();
  }

  function getCurrentPageItems() {
    var items = getFilteredItems();
    var start = (currentPage - 1) * PER_PAGE;
    return items.slice(start, start + PER_PAGE);
  }

  function totalPages() {
    return Math.ceil(getFilteredItems().length / PER_PAGE) || 1;
  }

  function render() {
    renderTable();
    renderPagination();
    updateResultCount();
    updateCompareButton();
    updateSelectAllState();
    updateFilterStats();
    updateFilterCounts();
  }

  function renderTable() {
    var pageItems = getCurrentPageItems();
    var tbody = getTbody();
    tbody.innerHTML = '';
    els.cpuTbody.style.display = currentTab === 'cpu' ? '' : 'none';
    els.gpuTbody.style.display = currentTab === 'gpu' ? '' : 'none';

    if (!pageItems.length) {
      els.emptyStateMsg.textContent = currentTab === 'cpu' ? 'No CPUs match your filters.' : 'No GPUs match your filters.';
      els.emptyState.classList.add('visible');
      els.cpuTable.style.display = 'none';
      return;
    }
    els.emptyState.classList.remove('visible');
    els.cpuTable.style.display = '';

    var frag = document.createDocumentFragment();
    for (var i = 0; i < pageItems.length; i++) {
      var item = pageItems[i];
      var tr = document.createElement('tr');
      tr.dataset.idx = getAllItems().indexOf(item);
      if (compareSet.has(item)) tr.classList.add('selected');

      var tdCheck = document.createElement('td');
      tdCheck.className = 'col-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = compareSet.has(item);
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      if (currentTab === 'cpu') {
        renderCpuRow(tr, item);
      } else {
        renderGpuRow(tr, item);
      }

      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
  }

  function renderCpuRow(tr, c) {
    var tdName = document.createElement('td');
    tdName.className = 'col-name';
    var nameWrap = document.createElement('div');
    nameWrap.className = 'name-wrap';
    var a = document.createElement('a');
    a.className = 'cpu-name-link';
    a.href = '/embed?cpu=' + encodeURIComponent(c.name);
    a.textContent = c.name;
    nameWrap.appendChild(a);
    if (c.passmark) {
      var badge = document.createElement('span');
      badge.className = 'tier-badge ' + getCpuTier(c.passmark);
      badge.textContent = getCpuTierLabel(c.passmark);
      badge.title = 'PassMark ' + c.passmark.toLocaleString();
      nameWrap.appendChild(badge);
    }
    tdName.appendChild(nameWrap);
    var span = document.createElement('span');
    span.className = 'cpu-codename';
    span.textContent = c.codename !== '—' ? c.codename : (c.fullName || '');
    tdName.appendChild(span);
    tr.appendChild(tdName);

    var tdCores = document.createElement('td');
    tdCores.className = 'col-cores';
    tdCores.textContent = c.coresThreads;
    tr.appendChild(tdCores);

    var tdClock = document.createElement('td');
    tdClock.className = 'col-clock';
    tdClock.textContent = c.clock;
    tr.appendChild(tdClock);

    var tdSocket = document.createElement('td');
    tdSocket.className = 'col-socket';
    tdSocket.textContent = c.socket;
    tr.appendChild(tdSocket);

    var tdProcess = document.createElement('td');
    tdProcess.className = 'col-process';
    tdProcess.textContent = c.process;
    tr.appendChild(tdProcess);

    var tdTdp = document.createElement('td');
    tdTdp.className = 'col-tdp';
    tdTdp.textContent = c.tdp;
    tr.appendChild(tdTdp);

    var tdReleased = document.createElement('td');
    tdReleased.className = 'col-released';
    tdReleased.textContent = c.released;
    tr.appendChild(tdReleased);

    var tdPassmark = document.createElement('td');
    tdPassmark.className = 'col-passmark';
    if (c.passmark) {
      var bar = document.createElement('div');
      bar.className = 'pm-bar-wrap';
      var fill = document.createElement('div');
      var pm = c.passmark;
      fill.className = 'pm-bar ' + getCpuTier(pm);
      var maxScore = 150000;
      var pct = Math.min(Math.sqrt(pm / maxScore) * 100, 100);
      fill.style.width = pct + '%';
      bar.title = 'Score: ' + pm.toLocaleString() + ' | Top CPU: ~150,000';
      bar.appendChild(fill);
      tdPassmark.appendChild(bar);
      var label = document.createElement('span');
      label.className = 'pm-score';
      label.textContent = pm.toLocaleString();
      tdPassmark.appendChild(label);
    } else {
      tdPassmark.textContent = '—';
      tdPassmark.style.color = 'var(--text-muted)';
    }
    tr.appendChild(tdPassmark);
  }

  function renderGpuRow(tr, g) {
    var tdName = document.createElement('td');
    tdName.className = 'col-name';
    var nameWrap = document.createElement('div');
    nameWrap.className = 'name-wrap';
    var a = document.createElement('a');
    a.className = 'cpu-name-link';
    a.href = '/embed?gpu=' + encodeURIComponent(g.name);
    a.textContent = g.name;
    nameWrap.appendChild(a);
    if (g.g3d > 0) {
      var badge = document.createElement('span');
      badge.className = 'tier-badge ' + getGpuTier(g.g3d);
      badge.textContent = getGpuTierLabel(g.g3d);
      badge.title = 'G3D ' + g.g3d.toLocaleString();
      nameWrap.appendChild(badge);
    }
    tdName.appendChild(nameWrap);
    var span = document.createElement('span');
    span.className = 'cpu-codename';
    span.textContent = g.manufacturer;
    tdName.appendChild(span);
    tr.appendChild(tdName);

    var tdTdp = document.createElement('td');
    tdTdp.className = 'col-tdp';
    tdTdp.textContent = g.tdp;
    tr.appendChild(tdTdp);

    var tdReleased = document.createElement('td');
    tdReleased.className = 'col-released';
    tdReleased.textContent = g.released;
    tr.appendChild(tdReleased);

    var tdG3d = document.createElement('td');
    tdG3d.className = 'col-g3d';
    if (g.g3d > 0) {
      var bar = document.createElement('div');
      bar.className = 'pm-bar-wrap';
      var fill = document.createElement('div');
      fill.className = 'pm-bar ' + getGpuTier(g.g3d);
      var maxScore = 60000;
      var pct = Math.min(Math.sqrt(g.g3d / maxScore) * 100, 100);
      fill.style.width = pct + '%';
      bar.title = 'G3D: ' + g.g3d.toLocaleString() + ' | Top GPU: ~42,000';
      bar.appendChild(fill);
      tdG3d.appendChild(bar);
      var label = document.createElement('span');
      label.className = 'pm-score';
      label.textContent = g.g3d.toLocaleString();
      tdG3d.appendChild(label);
    } else {
      tdG3d.textContent = '—';
      tdG3d.style.color = 'var(--text-muted)';
    }
    tr.appendChild(tdG3d);

    var tdG2d = document.createElement('td');
    tdG2d.className = 'col-g2d';
    if (g.g2d > 0) {
      tdG2d.textContent = g.g2d.toLocaleString();
    } else {
      tdG2d.textContent = '—';
      tdG2d.style.color = 'var(--text-muted)';
    }
    tr.appendChild(tdG2d);

    var tdBrand = document.createElement('td');
    tdBrand.className = 'col-type';
    var brandBadge = document.createElement('span');
    var manuLower = (g.manufacturer || '').toLowerCase();
    if (manuLower === 'amd') brandBadge.className = 'type-badge amd';
    else if (manuLower === 'intel') brandBadge.className = 'type-badge intel';
    else if (manuLower === 'nvidia') brandBadge.className = 'type-badge nvidia';
    else brandBadge.className = 'type-badge other';
    brandBadge.textContent = g.manufacturer || '—';
    tdBrand.appendChild(brandBadge);
    tr.appendChild(tdBrand);

    var tdCat = document.createElement('td');
    tdCat.className = 'col-category';
    tdCat.textContent = g.category;
    tr.appendChild(tdCat);

    var tdBus = document.createElement('td');
    tdBus.className = 'col-bus';
    tdBus.textContent = g.bus;
    tr.appendChild(tdBus);

    var tdMem = document.createElement('td');
    tdMem.className = 'col-memsize';
    tdMem.textContent = g.memSize;
    tr.appendChild(tdMem);
  }

  function renderPagination() {
    var el = els.pagination;
    var total = totalPages();
    var cur = currentPage;
    el.innerHTML = '';
    if (getFilteredItems().length === 0) return;

    var prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '\u25c0 Prev';
    prevBtn.disabled = cur <= 1;
    prevBtn.addEventListener('click', function () { if (cur > 1) { currentPage--; render(); } });
    el.appendChild(prevBtn);

    var pages = [];
    if (total <= 7) {
      for (var i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('...');
      var start = Math.max(2, cur - 1);
      var end = Math.min(total - 1, cur + 1);
      if (cur <= 3) start = 2;
      if (cur >= total - 2) end = total - 1;
      for (var i = start; i <= end; i++) pages.push(i);
      if (cur < total - 2) pages.push('...');
      pages.push(total);
    }

    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (p === '...') {
        var dot = document.createElement('span');
        dot.className = 'page-info';
        dot.textContent = '\u2026';
        el.appendChild(dot);
      } else {
        var btn = document.createElement('button');
        btn.className = 'page-btn' + (p === cur ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', (function (page) {
          return function () { currentPage = page; render(); };
        })(p));
        el.appendChild(btn);
      }
    }

    var nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Next \u25b6';
    nextBtn.disabled = cur >= total;
    nextBtn.addEventListener('click', function () { if (cur < total) { currentPage++; render(); } });
    el.appendChild(nextBtn);
  }

  function updateResultCount() {
    var total = getAllItems().length;
    var shown = getFilteredItems().length;
    var label = currentTab === 'cpu' ? 'CPU' : 'GPU';
    var start = (currentPage - 1) * PER_PAGE + 1;
    var end = Math.min(currentPage * PER_PAGE, shown);
    if (shown === 0) {
      els.resultCount.textContent = 'No results';
    } else {
      els.resultCount.textContent = start + '\u2013' + end + ' of ' + shown + ' ' + label + (shown !== 1 ? 's' : '') + ' (filtered from ' + total + ')';
    }
  }

  function updateCompareButton() {
    var count = compareSet.size;
    els.compareCount.textContent = count;
    els.compareBtn.disabled = count < 2;
  }

  function updateSelectAllState() {
    var pageItems = getCurrentPageItems();
    var checked = 0;
    for (var i = 0; i < pageItems.length; i++) {
      if (compareSet.has(pageItems[i])) checked++;
    }
    els.selectAll.checked = pageItems.length > 0 && checked === pageItems.length;
    els.selectAll.indeterminate = checked > 0 && checked < pageItems.length;
  }

  function toggleCompare(item, tr) {
    if (compareSet.has(item)) {
      compareSet.delete(item);
      if (tr) tr.classList.remove('selected');
    } else {
      if (compareSet.size >= MAX_COMPARE) return;
      compareSet.add(item);
      if (tr) tr.classList.add('selected');
    }
    updateCompareButton();
    updateSelectAllState();
  }

  function showCompareModal() {
    var items = [];
    compareSet.forEach(function (c) { items.push(c); });
    if (items.length < 2) return;

    if (currentTab === 'cpu') {
      showCpuCompare(items);
    } else {
      showGpuCompare(items);
    }
  }

  function showCpuCompare(cpus) {
    var specs = [
      { label: 'Name', fn: function (c) { return c.name; } },
      { label: 'Manufacturer', fn: function (c) { return c.manufacturer; } },
      { label: 'Codename', fn: function (c) { return c.codename; } },
      { label: 'Cores / Threads', fn: function (c) { return c.coresThreads; } },
      { label: 'Clock', fn: function (c) { return c.clock; } },
      { label: 'Socket', fn: function (c) { return c.socket; } },
      { label: 'Process', fn: function (c) { return c.process; } },
      { label: 'L3 Cache', fn: function (c) { return c.l3Cache; } },
      { label: 'TDP', fn: function (c) { return c.tdp; } },
      { label: 'PassMark', fn: function (c) { return c.passmark ? c.passmark.toLocaleString() : '—'; }, numeric: true },
      { label: 'Released', fn: function (c) { return c.released; } },
    ];

    var bestVals = {};
    for (var s = 0; s < specs.length; s++) {
      if (specs[s].numeric) {
        var maxVal = -1;
        var maxIdx = -1;
        for (var i = 0; i < cpus.length; i++) {
          var val = cpus[i].passmark || 0;
          if (val > maxVal) { maxVal = val; maxIdx = i; }
        }
        bestVals[s] = maxIdx;
      }
    }

    var html = '<table class="compare-table"><thead><tr><th class="spec-label">Spec</th>';
    for (var i = 0; i < cpus.length; i++) {
      html += '<th class="cpu-col"><h3>' + escHtml(cpus[i].name) + '</h3>';
      if (cpus[i].codename !== '—') html += '<em>' + escHtml(cpus[i].codename) + '</em>';
      html += '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var s = 0; s < specs.length; s++) {
      html += '<tr><td class="spec-label">' + escHtml(specs[s].label) + '</td>';
      for (var i = 0; i < cpus.length; i++) {
        var cls = (bestVals[s] === i) ? ' class="best-val"' : '';
        html += '<td' + cls + '>' + escHtml(specs[s].fn(cpus[i])) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    els.compareModalTitle.textContent = 'CPU Comparison';
    els.compareBody.innerHTML = html;
    els.compareModal.classList.add('open');
  }

  function showGpuCompare(gpus) {
    var specs = [
      { label: 'Name', fn: function (g) { return g.name; } },
      { label: 'Manufacturer', fn: function (g) { return g.manufacturer; } },
      { label: 'G3D Score', fn: function (g) { return g.g3d > 0 ? g.g3d.toLocaleString() : '—'; }, numeric: true },
      { label: 'G2D Score', fn: function (g) { return g.g2d > 0 ? g.g2d.toLocaleString() : '—'; }, numeric: true },
      { label: 'Manufacturer', fn: function (g) { return g.manufacturer; } },
      { label: 'Category', fn: function (g) { return g.category; } },
      { label: 'Bus', fn: function (g) { return g.bus; } },
      { label: 'Memory', fn: function (g) { return g.memSize; } },
      { label: 'TDP', fn: function (g) { return g.tdp; } },
      { label: 'Released', fn: function (g) { return g.released; } },
    ];

    var bestVals = {};
    for (var s = 0; s < specs.length; s++) {
      if (specs[s].numeric) {
        var maxVal = -1;
        var maxIdx = -1;
        for (var i = 0; i < gpus.length; i++) {
          var val = specs[s].label === 'G3D Score' ? (gpus[i].g3d || 0) : (gpus[i].g2d || 0);
          if (val > maxVal) { maxVal = val; maxIdx = i; }
        }
        bestVals[s] = maxIdx;
      }
    }

    var html = '<table class="compare-table"><thead><tr><th class="spec-label">Spec</th>';
    for (var i = 0; i < gpus.length; i++) {
      html += '<th class="cpu-col"><h3>' + escHtml(gpus[i].name) + '</h3></th>';
    }
    html += '</tr></thead><tbody>';
    for (var s = 0; s < specs.length; s++) {
      html += '<tr><td class="spec-label">' + escHtml(specs[s].label) + '</td>';
      for (var i = 0; i < gpus.length; i++) {
        var cls = (bestVals[s] === i) ? ' class="best-val"' : '';
        html += '<td' + cls + '>' + escHtml(specs[s].fn(gpus[i])) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    els.compareModalTitle.textContent = 'GPU Comparison';
    els.compareBody.innerHTML = html;
    els.compareModal.classList.add('open');
  }

  // ── Enhanced Detail View ──

  function showDetailModal(item) {
    if (currentTab === 'cpu') {
      showCpuDetail(item);
    } else {
      showGpuDetail(item);
    }
  }

  function getShortTierLabel(tier) {
    switch (tier) {
      case 'Flagship': return 'Flagship';
      case 'Ultra': return 'Ultra';
      case 'High': return 'High';
      case 'Mid': return 'Mid';
      case 'Entry': return 'Entry';
      default: return tier;
    }
  }

  function getBadgeClass(tier) {
    switch (tier) {
      case 'Flagship': return 'badge-flagship';
      case 'Ultra': return 'badge-ultra';
      case 'High': return 'badge-high';
      case 'Mid': return 'badge-mid';
      case 'Entry': return 'badge-entry';
      default: return 'badge-entry';
    }
  }

  function renderPerformanceGraph(container, item, tab) {
    var getTierLabel, getTierFn, score, label = 'CPU';
    if (tab === 'cpu') {
      score = item.passmark;
      getTierLabel = getCpuTierLabel;
      getTierFn = getCpuTier;
    } else {
      score = item.g3d;
      getTierLabel = getGpuTierLabel;
      getTierFn = getGpuTier;
      label = 'GPU';
    }
    if (!score) { container.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted)">No benchmark data available</div>'; return; }

    var stats = tierYearStats[tab];
    var bandStats = tierBandStats[tab];
    var tierOrder = ['Entry', 'Mid', 'High', 'Ultra', 'Flagship'];
    var tierColors = {'Entry':'#6b7280','Mid':'#eab308','High':'#22c55e','Ultra':'#06b6d4','Flagship':'#6366f1'};
    var itemTier = getTierLabel(score);
    var itemYear = item.releaseYear || 0;

    // Find which 2026 class this CPU belongs to (same tier, similar core count)
    var coreBand = tab === 'cpu' ? getCoreBand(item.coresThreads) : null;
    var modern26 = findModern26Tier(score, tab, itemTier, coreBand, score);
    var modern26Tier = modern26 ? modern26.tier : null;
    var modern26Avg = modern26 ? modern26.avg : null;

    // Use 2026 average for perfClass, fall back to own-year tier average
    var compareAvg = modern26Avg || (stats && stats[itemTier] && stats[itemTier][itemYear] ? stats[itemTier][itemYear] : null);
    var perfClass = '';
    var perfClassColor = '';
    if (compareAvg) {
      var ratio = score / compareAvg;
      if (ratio >= 1.15) { perfClass = 'Top End'; perfClassColor = tierColors[itemTier]; }
      else if (ratio >= 1.0) { perfClass = 'Strong'; perfClassColor = '#22c55e'; }
      else if (ratio >= 0.85) { perfClass = 'Solid'; perfClassColor = '#eab308'; }
      else { perfClass = 'Below Avg'; perfClassColor = '#6b7280'; }
    }

    // Helper: get 2026 average for a tier, preferring the matching core band
    function getTierAvg(tierName) {
      var bandKey = tierName + '|' + coreBand;
      if (bandStats && bandStats[bandKey] && bandStats[bandKey][2026]) return bandStats[bandKey][2026];
      if (stats && stats[tierName] && stats[tierName][2026]) return stats[tierName][2026];
      return null;
    }

    // Compute max for scaling — use core-band-specific 2026 averages for each tier
    var allTierMax = 0;
    var segBoundaries = [0];
    for (var t = 0; t < tierOrder.length; t++) {
      var tn = tierOrder[t];
      var mx = getTierAvg(tn) || 0;
      segBoundaries.push(Math.max(mx, segBoundaries[t] + 1));
      if (mx > allTierMax) allTierMax = mx;
    }
    allTierMax = Math.max(allTierMax, score * 1.15);
    segBoundaries[segBoundaries.length - 1] = allTierMax;

    var W = 700, H = 190, padL = 10, barArea = 680;
    var barH = 28, barY = 42;
    function xPos(v) { return padL + (v / allTierMax) * barArea; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">';

    // Tier bands
    for (var t = 0; t < tierOrder.length; t++) {
      var tn = tierOrder[t];
      var x1 = xPos(segBoundaries[t]);
      var x2 = xPos(segBoundaries[t + 1]);
      svg += '<rect x="' + x1 + '" y="' + barY + '" width="' + (x2 - x1) + '" height="' + barH + '" fill="' + tierColors[tn] + '" opacity="0.1"/>';
    }

    // Tier labels
    for (var t = 0; t < tierOrder.length; t++) {
      var tn = tierOrder[t];
      var cx = (xPos(segBoundaries[t]) + xPos(segBoundaries[t + 1])) / 2;
      svg += '<text x="' + cx + '" y="' + (barY + barH + 16) + '" text-anchor="middle" fill="' + tierColors[tn] + '" font-size="10" font-weight="700" opacity="0.7">' + tn + '</text>';
    }

    // Score bar (colored segments)
    var scoreX = xPos(score);
    var drawnTo = padL;
    for (var t = 0; t < tierOrder.length; t++) {
      var tn = tierOrder[t];
      var segEnd = Math.min(scoreX, xPos(segBoundaries[t + 1]));
      if (segEnd <= drawnTo) continue;
      svg += '<rect x="' + drawnTo + '" y="' + (barY - 2) + '" width="' + (segEnd - drawnTo) + '" height="' + (barH + 4) + '" fill="' + tierColors[tn] + '" opacity="0.85"/>';
      drawnTo = segEnd;
    }
    svg += '<rect x="' + (padL - 1) + '" y="' + (barY - 2) + '" width="8" height="' + (barH + 4) + '" rx="4" fill="' + tierColors[tierOrder[0]] + '" opacity="0.85"/>';
    svg += '<rect x="' + (scoreX - 7) + '" y="' + (barY - 2) + '" width="8" height="' + (barH + 4) + '" rx="4" fill="' + tierColors[itemTier] + '" opacity="0.85"/>';

    // Score + class badge on bar
    svg += '<text x="' + (padL + 10) + '" y="' + (barY + barH / 2 + 4) + '" fill="#fff" font-size="12" font-weight="700">' + score.toLocaleString() + '</text>';
    if (perfClass) {
      svg += '<rect x="' + (padL + 10 + (score.toLocaleString().length * 8)) + '" y="' + (barY + 4) + '" width="' + (perfClass.length * 7 + 14) + '" height="18" rx="9" fill="' + perfClassColor + '" opacity="0.9"/>';
      svg += '<text x="' + (padL + 17 + (score.toLocaleString().length * 8)) + '" y="' + (barY + 16) + '" fill="#fff" font-size="10" font-weight="700">' + perfClass + '</text>';
    }

    // 2026 average marker line (for the matched tier core-band average)
    if (modern26Avg) {
      var mx26 = xPos(modern26Avg);
      var markerBot = barY + barH + 5;
      svg += '<line x1="' + mx26 + '" y1="14" x2="' + mx26 + '" y2="' + markerBot + '" stroke="var(--primary)" stroke-width="2" stroke-dasharray="6,3"/>';
      var bandLabel = coreBand ? 'top 10 × ' + coreBand + ' core' : 'top 10';
      svg += '<text x="' + mx26 + '" y="11" text-anchor="middle" fill="var(--primary)" font-size="10" font-weight="700">2026 ' + modern26Tier + ' avg: ' + modern26Avg.toLocaleString() + '</text>';
    }

    // Item name and tier
    svg += '<text x="' + padL + '" y="' + (barY - 8) + '" fill="var(--text)" font-size="13" font-weight="700">' + escHtml(item.name) + '</text>';
    var tierInfo = itemTier + ' ' + label + ' (' + (itemYear || '?') + ')';
    if (coreBand) tierInfo += ' | ' + coreBand + ' cores';
    tierInfo += ')';
    svg += '<text x="' + padL + '" y="' + (barY + barH + 34) + '" fill="var(--text-muted)" font-size="11">' + tierInfo + '</text>';

    // Bottom line: "Roughly a 2026 [tier]-class CPU (top 10 × [core band] cores)"
    if (modern26Tier) {
      var pct = Math.round((score / modern26Avg) * 100);
      var bandLabel = coreBand ? ' (top 10 × ' + coreBand + ' cores)' : ' (top 10)';
      svg += '<text x="' + padL + '" y="' + (barY + barH + 52) + '" fill="var(--text-muted)" font-size="10">Roughly a 2026 ' + modern26Tier + '-class CPU' + bandLabel + ' — ' + pct + '% of avg</text>';
    }

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderSimilarItems(container, item, tab) {
    var score, getTier, allItems;
    if (tab === 'cpu') {
      score = item.passmark;
      getTier = getCpuTier;
      allItems = allData.cpu;
    } else {
      score = item.g3d;
      getTier = getGpuTier;
      allItems = allData.gpu;
    }
    if (!score) return;

    var sameTier = [];
    for (var i = 0; i < allItems.length; i++) {
      var other = allItems[i];
      var otherScore = tab === 'cpu' ? other.passmark : other.g3d;
      if (otherScore && getTier(otherScore) === getTier(score) && other !== item) {
        sameTier.push({ item: other, score: otherScore, diff: Math.abs(otherScore - score) });
      }
    }
    sameTier.sort(function (a, b) { return a.diff - b.diff; });
    var similar = sameTier.slice(0, 5);

    var wrap = document.createElement('div');
    wrap.className = 'detail-similar-wrap';
    for (var i = 0; i < similar.length; i++) {
      var chip = document.createElement('span');
      chip.className = 'similar-chip';
      chip.textContent = similar[i].item.name;
      var scoreSpan = document.createElement('span');
      scoreSpan.className = 'chip-score';
      scoreSpan.textContent = similar[i].score.toLocaleString();
      chip.appendChild(scoreSpan);
      chip.addEventListener('click', (function (sItem) {
        return function () { showDetailModal(sItem); };
      })(similar[i].item));
      wrap.appendChild(chip);
    }
    container.appendChild(wrap);
  }

  function showCpuDetail(cpu) {
    var tier = cpu.passmark ? getCpuTierLabel(cpu.passmark) : '';
    var tierClass = cpu.passmark ? getBadgeClass(tier) : '';
    var type = cpu.igpu ? 'Integrated' : null;

    var html = '<div class="detail-page">';

    // Header
    html += '<div class="detail-header">';
    html += '<span class="detail-name">' + escHtml(cpu.fullName || cpu.name) + '</span>';
    if (tier) html += '<span class="detail-badge ' + tierClass + '">' + escHtml(tier) + '</span>';
    if (type) html += '<span class="detail-type-badge integrated">iGPU</span>';
    html += '</div>';

    // Chart
    var chartId = 'detail-chart-' + Date.now();
    html += '<div class="detail-chart-section"><div class="chart-title">Performance Comparison (' + escHtml(tier) + ' ' + (cpu.releaseYear || '') + ')</div><div id="' + chartId + '"></div></div>';

    // Modern equivalent
    if (cpu.passmark) {
      var cb = getCoreBand(cpu.coresThreads);
      var m26 = findModern26Tier(cpu.passmark, 'cpu', tier, cb, cpu.passmark);
      if (m26) {
        var pct = Math.round((cpu.passmark / m26.avg) * 100);
        var bandLabel = cb ? ' (top 10 × ' + cb + ' cores)' : ' (top 10)';
        html += '<div class="detail-equivalent">Roughly a 2026 <strong>' + m26.tier + '-class CPU</strong>' + bandLabel + ' — ' + pct + '% of avg</div>';
      }
    }

    // Specs
    html += '<div class="detail-specs">';
    var specRows = [
      ['Name', cpu.name],
      ['Full Name', cpu.fullName || '—'],
      ['Manufacturer', cpu.manufacturer],
      ['Codename', cpu.codename],
      ['Cores / Threads', cpu.coresThreads],
      ['Clock', cpu.clock],
      ['Socket', cpu.socket],
      ['Process Node', cpu.process],
      ['L3 Cache', cpu.l3Cache],
      ['TDP', cpu.tdp],
      ['PassMark', cpu.passmark ? cpu.passmark.toLocaleString() : '—'],
      ['Released', cpu.released],
    ];
    if (cpu.igpu) specRows.push(['iGPU', cpu.igpu]);
    for (var i = 0; i < specRows.length; i++) {
      html += '<div class="spec-label">' + escHtml(specRows[i][0]) + '</div><div class="spec-value">' + escHtml(specRows[i][1]) + '</div>';
    }
    html += '</div>';

    // Similar
    html += '<div class="detail-similar"><h4>Similar Performance</h4><div id="detail-similar-' + chartId + '"></div></div>';

    html += '</div>';

    els.detailName.textContent = cpu.fullName || cpu.name;
    els.detailBody.innerHTML = html;
    els.detailModal.classList.add('open');

    // Render chart after DOM is ready
    var chartContainer = document.getElementById(chartId);
    if (chartContainer) renderPerformanceGraph(chartContainer, cpu, 'cpu');

    var similarContainer = document.getElementById('detail-similar-' + chartId);
    if (similarContainer) renderSimilarItems(similarContainer, cpu, 'cpu');
  }

  function showGpuDetail(gpu) {
    var tier = gpu.g3d > 0 ? getGpuTierLabel(gpu.g3d) : '';
    var tierClass = gpu.g3d > 0 ? getBadgeClass(tier) : '';
    var manuLower = (gpu.manufacturer || '').toLowerCase();
    var typeClass = 'other';
    if (manuLower === 'amd') typeClass = 'amd';
    else if (manuLower === 'intel') typeClass = 'intel';
    else if (manuLower === 'nvidia') typeClass = 'nvidia';

    var html = '<div class="detail-page">';

    // Header
    html += '<div class="detail-header">';
    html += '<span class="detail-name">' + escHtml(gpu.name) + '</span>';
    if (tier) html += '<span class="detail-badge ' + tierClass + '">' + escHtml(tier) + '</span>';
    html += '<span class="detail-type-badge ' + typeClass + '">' + escHtml(gpu.manufacturer) + '</span>';
    html += '</div>';

    // Chart
    var chartId = 'detail-chart-' + Date.now();
    html += '<div class="detail-chart-section"><div class="chart-title">Performance Comparison (' + escHtml(tier) + ' ' + (gpu.releaseYear || '') + ')</div><div id="' + chartId + '"></div></div>';

    // Modern equivalent
    if (gpu.g3d > 0) {
      var m26 = findModern26Tier(gpu.g3d, 'gpu', tier, null, gpu.g3d);
      if (m26) {
        var pct = Math.round((gpu.g3d / m26.avg) * 100);
        html += '<div class="detail-equivalent">Roughly a 2026 <strong>' + m26.tier + '-class GPU</strong> (' + pct + '% of 2026 ' + m26.tier + ' avg)</div>';
      }
    }

    // Specs
    html += '<div class="detail-specs">';
    var specRows = [
      ['Name', gpu.name],
      ['Manufacturer', gpu.manufacturer],
      ['Manufacturer', gpu.manufacturer],
      ['Category', gpu.category],
      ['Bus', gpu.bus],
      ['Memory', gpu.memSize],
      ['Core Clock', gpu.coreClk],
      ['Memory Clock', gpu.memClk],
      ['G3D Score', gpu.g3d > 0 ? gpu.g3d.toLocaleString() : '—'],
      ['G2D Score', gpu.g2d > 0 ? gpu.g2d.toLocaleString() : '—'],
      ['TDP', gpu.tdp],
      ['Released', gpu.released],
    ];
    for (var i = 0; i < specRows.length; i++) {
      html += '<div class="spec-label">' + escHtml(specRows[i][0]) + '</div><div class="spec-value">' + escHtml(specRows[i][1]) + '</div>';
    }
    html += '</div>';

    // Similar
    html += '<div class="detail-similar"><h4>Similar Performance</h4><div id="detail-similar-' + chartId + '"></div></div>';

    html += '</div>';

    els.detailName.textContent = gpu.name;
    els.detailBody.innerHTML = html;
    els.detailModal.classList.add('open');

    // Render chart after DOM is ready
    var chartContainer = document.getElementById(chartId);
    if (chartContainer) renderPerformanceGraph(chartContainer, gpu, 'gpu');

    var similarContainer = document.getElementById('detail-similar-' + chartId);
    if (similarContainer) renderSimilarItems(similarContainer, gpu, 'gpu');
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
  }

  // ── Tab Switching ──

  function switchTab(tab) {
    if (tab === currentTab) {
      // Ensure UI is correct on initial load
      for (var i = 0; i < els.tabBtns.length; i++) {
        els.tabBtns[i].classList.toggle('active', els.tabBtns[i].dataset.tab === tab);
      }
      var tabContents = qsa('.tab-content');
      for (var i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.toggle('active', tabContents[i].dataset.tab === tab);
      }
      els.cpuTbody.style.display = tab === 'cpu' ? '' : 'none';
      els.gpuTbody.style.display = tab === 'gpu' ? '' : 'none';
      return;
    }
    currentTab = tab;

    for (var i = 0; i < els.tabBtns.length; i++) {
      var btn = els.tabBtns[i];
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }

    var tabContents = qsa('.tab-content');
    for (var i = 0; i < tabContents.length; i++) {
      var el = tabContents[i];
      el.classList.toggle('active', el.dataset.tab === tab);
    }

    els.cpuTbody.style.display = tab === 'cpu' ? '' : 'none';
    els.gpuTbody.style.display = tab === 'gpu' ? '' : 'none';

    sortField = null;
    sortDir = 'asc';
    currentPage = 1;
    compareSet.clear();
    compareMode = false;
    els.compareMode.checked = false;
    updateCompareButton();
    updateSelectAllState();
    updateSortHeaders();

    applyFilters();
  }

  // ── Quick Filters ──

  function initQuickFilters() {
    var container = document.getElementById('quick-filters');
    if (!container) return;
    container.addEventListener('click', function (e) {
      if (currentTab !== 'cpu') return;
      var btn = e.target.closest('.qf-btn');
      if (!btn) return;
      var preset = btn.dataset.preset;
      var filters = {
        flagship: { pmMin: 40000 },
        ultra: { pmMin: 20000, pmMax: 39999 },
        high: { pmMin: 10000, pmMax: 19999 },
        mid: { pmMin: 5000, pmMax: 9999 },
        entry: { pmMin: 0, pmMax: 4999 },
        server: { coresMin: 16 },
      };
      var p = filters[preset] || {};
      clearFiltersInternal(false);
      if (p.pmMin !== undefined) { state.pmMin = p.pmMin; els.pmMin.value = p.pmMin; }
      if (p.pmMax !== undefined) { state.pmMax = p.pmMax; els.pmMax.value = p.pmMax; }
      applyFilters();
    });
  }

  function clearFiltersInternal(skipRender) {
    els.search.value = '';
    state.search = '';
    state.manufacturers.clear();
    state.sockets.clear();
    state.processes.clear();
    state.busTypes.clear();
    state.tdpMin = null;
    state.tdpMax = null;
    state.yearMin = null;
    state.yearMax = null;
    state.pmMin = null;
    state.pmMax = null;
    state.memSizeMin = null;
    state.memSizeMax = null;
    els.tdpMin.value = '';
    els.tdpMax.value = '';
    els.yearMin.value = '';
    els.yearMax.value = '';
    els.pmMin.value = '';
    els.pmMax.value = '';
    if (els.gpuMemMin) els.gpuMemMin.value = '';
    if (els.gpuMemMax) els.gpuMemMax.value = '';
    var cbs = document.querySelectorAll('.filter-group input[type="checkbox"]');
    for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;
    sortField = null;
    sortDir = 'asc';
    updateSortHeaders();
    if (!skipRender) applyFilters();
  }

  function updateFilterCounts() {
    var counts = manuCounts[currentTab];
    var cbs = els.filterManu.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < cbs.length; i++) {
      var cb = cbs[i];
      var countSpan = cb.parentNode.querySelector('.count');
      if (countSpan) countSpan.textContent = counts[cb.value] || 0;
    }
  }

  function updateFilterStats() {
    var el = document.getElementById('filter-stats');
    if (!el) return;

    var total = getAllItems().length;
    var shown = getFilteredItems().length;

    if (currentTab === 'cpu') {
      var tiers = [0, 0, 0, 0, 0];
      var tierNames = ['Flagship', 'Ultra', 'High', 'Mid', 'Entry'];
      for (var i = 0; i < getFilteredItems().length; i++) {
        var pm = getFilteredItems()[i].passmark || 0;
        if (pm >= 40000) tiers[0]++;
        else if (pm >= 20000) tiers[1]++;
        else if (pm >= 10000) tiers[2]++;
        else if (pm >= 5000) tiers[3]++;
        else tiers[4]++;
      }
      var html = '<div class="stat-row"><span>Total DB</span><span class="stat-val">' + total.toLocaleString() + '</span></div>';
      html += '<div class="stat-row"><span>Showing</span><span class="stat-val">' + shown.toLocaleString() + '</span></div>';
      if (tiers[0] > 0) html += '<div class="stat-row"><span><span class="tier-dot flagship"></span>Flagship</span><span class="stat-val">' + tiers[0] + '</span></div>';
      if (tiers[1] > 0) html += '<div class="stat-row"><span><span class="tier-dot ultra"></span>Ultra</span><span class="stat-val">' + tiers[1] + '</span></div>';
      if (tiers[2] > 0) html += '<div class="stat-row"><span><span class="tier-dot high"></span>High</span><span class="stat-val">' + tiers[2] + '</span></div>';
      if (tiers[3] > 0) html += '<div class="stat-row"><span><span class="tier-dot mid"></span>Mid</span><span class="stat-val">' + tiers[3] + '</span></div>';
      if (tiers[4] > 0 && tiers[4] < getFilteredItems().length) html += '<div class="stat-row"><span><span class="tier-dot entry"></span>Entry</span><span class="stat-val">' + tiers[4] + '</span></div>';
      el.innerHTML = html;
    } else {
      var gtiers = [0, 0, 0, 0, 0];
      for (var i = 0; i < getFilteredItems().length; i++) {
        var g3d = getFilteredItems()[i].g3d || 0;
        if (g3d >= 30000) gtiers[0]++;
        else if (g3d >= 20000) gtiers[1]++;
        else if (g3d >= 10000) gtiers[2]++;
        else if (g3d >= 3000) gtiers[3]++;
        else gtiers[4]++;
      }
      var html = '<div class="stat-row"><span>Total DB</span><span class="stat-val">' + total.toLocaleString() + '</span></div>';
      html += '<div class="stat-row"><span>Showing</span><span class="stat-val">' + shown.toLocaleString() + '</span></div>';
      if (gtiers[0] > 0) html += '<div class="stat-row"><span><span class="tier-dot flagship"></span>Flagship</span><span class="stat-val">' + gtiers[0] + '</span></div>';
      if (gtiers[1] > 0) html += '<div class="stat-row"><span><span class="tier-dot ultra"></span>Ultra</span><span class="stat-val">' + gtiers[1] + '</span></div>';
      if (gtiers[2] > 0) html += '<div class="stat-row"><span><span class="tier-dot high"></span>High</span><span class="stat-val">' + gtiers[2] + '</span></div>';
      if (gtiers[3] > 0) html += '<div class="stat-row"><span><span class="tier-dot mid"></span>Mid</span><span class="stat-val">' + gtiers[3] + '</span></div>';
      if (gtiers[4] > 0 && gtiers[4] < getFilteredItems().length) html += '<div class="stat-row"><span><span class="tier-dot entry"></span>Entry</span><span class="stat-val">' + gtiers[4] + '</span></div>';
      el.innerHTML = html;
    }
  }

  // ── Event Listeners ──

  function setupEventListeners() {
    els.sidebarToggle.addEventListener('click', function () {
      els.sidebar.classList.toggle('open');
      els.sidebarOverlay.classList.toggle('open');
    });
    els.sidebarOverlay.addEventListener('click', function () {
      els.sidebar.classList.remove('open');
      els.sidebarOverlay.classList.remove('open');
    });

    // Tab switching
    for (var i = 0; i < els.tabBtns.length; i++) {
      els.tabBtns[i].addEventListener('click', function () {
        switchTab(this.dataset.tab);
      });
    }

    var debounceTimer;
    els.search.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        state.search = els.search.value.trim();
        applyFilters();
      }, 250);
    });

    // Shared filter events
    if (els.filterGpuBus) {
      els.filterGpuBus.addEventListener('change', function (e) {
        if (e.target.type === 'checkbox' && e.target.dataset.filterKey === 'busTypes') {
          state.busTypes.clear();
          var cbs = els.filterGpuBus.querySelectorAll('input[type="checkbox"]');
          for (var i = 0; i < cbs.length; i++) {
            if (cbs[i].checked) state.busTypes.add(cbs[i].value);
          }
          applyFilters();
        }
      });
    }

    // Manufacturer checkbox delegation (shared)
    els.filterManu.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' && e.target.dataset.filterKey === 'manufacturer') {
        state.manufacturers.clear();
        var cbs = els.filterManu.querySelectorAll('input[type="checkbox"][data-filter-key="manufacturer"]');
        for (var i = 0; i < cbs.length; i++) {
          if (cbs[i].checked) state.manufacturers.add(cbs[i].value);
        }
        applyFilters();
      }
    });

    els.filterSocket.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' && e.target.dataset.filterKey === 'socket') {
        state.sockets.clear();
        var cbs = els.filterSocket.querySelectorAll('input[type="checkbox"][data-filter-key="socket"]');
        for (var i = 0; i < cbs.length; i++) {
          if (cbs[i].checked) state.sockets.add(cbs[i].value);
        }
        applyFilters();
      }
    });

    els.filterProcess.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' && e.target.dataset.filterKey === 'process') {
        state.processes.clear();
        var cbs = els.filterProcess.querySelectorAll('input[type="checkbox"][data-filter-key="process"]');
        for (var i = 0; i < cbs.length; i++) {
          if (cbs[i].checked) state.processes.add(cbs[i].value);
        }
        applyFilters();
      }
    });

    els.tdpMin.addEventListener('input', function () {
      state.tdpMin = els.tdpMin.value ? parseFloat(els.tdpMin.value) : null;
      applyFilters();
    });
    els.tdpMax.addEventListener('input', function () {
      state.tdpMax = els.tdpMax.value ? parseFloat(els.tdpMax.value) : null;
      applyFilters();
    });
    els.yearMin.addEventListener('input', function () {
      state.yearMin = els.yearMin.value ? parseInt(els.yearMin.value, 10) : null;
      applyFilters();
    });
    els.yearMax.addEventListener('input', function () {
      state.yearMax = els.yearMax.value ? parseInt(els.yearMax.value, 10) : null;
      applyFilters();
    });

    els.pmMin.addEventListener('input', function () {
      state.pmMin = els.pmMin.value ? parseInt(els.pmMin.value, 10) : null;
      applyFilters();
    });
    els.pmMax.addEventListener('input', function () {
      state.pmMax = els.pmMax.value ? parseInt(els.pmMax.value, 10) : null;
      applyFilters();
    });

    if (els.gpuMemMin) {
      els.gpuMemMin.addEventListener('input', function () {
        state.memSizeMin = els.gpuMemMin.value ? parseFloat(els.gpuMemMin.value) : null;
        applyFilters();
      });
    }
    if (els.gpuMemMax) {
      els.gpuMemMax.addEventListener('input', function () {
        state.memSizeMax = els.gpuMemMax.value ? parseFloat(els.gpuMemMax.value) : null;
        applyFilters();
      });
    }

    function clearFilters() {
      clearFiltersInternal(false);
    }

    els.clearFilters.addEventListener('click', clearFilters);
    els.clearFiltersEmpty.addEventListener('click', clearFilters);

    els.compareMode.addEventListener('change', function () {
      compareMode = els.compareMode.checked;
      if (!compareMode) {
        compareSet.clear();
        var sel = qsa('#cpu-tbody tr.selected, #gpu-tbody tr.selected');
        for (var i = 0; i < sel.length; i++) sel[i].classList.remove('selected');
        updateCompareButton();
        updateSelectAllState();
      }
    });

    els.compareBtn.addEventListener('click', showCompareModal);
    els.modalClose.addEventListener('click', function () { els.compareModal.classList.remove('open'); });
    els.detailClose.addEventListener('click', function () { els.detailModal.classList.remove('open'); });
    els.compareModal.addEventListener('click', function (e) { if (e.target === els.compareModal) els.compareModal.classList.remove('open'); });
    els.detailModal.addEventListener('click', function (e) { if (e.target === els.detailModal) els.detailModal.classList.remove('open'); });

    els.selectAll.addEventListener('change', function () {
      var pageItems = getCurrentPageItems();
      for (var i = 0; i < pageItems.length; i++) {
        if (els.selectAll.checked) {
          compareSet.add(pageItems[i]);
        } else {
          compareSet.delete(pageItems[i]);
        }
      }
      render();
    });

    // Row click delegation for both tbodies
    function onTbodyClick(e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var tbody = tr.parentNode;
      var idx = parseInt(tr.dataset.idx, 10);
      var item = getAllItems()[idx];
      if (!item) return;

      if (e.target.type === 'checkbox') {
        toggleCompare(item, tr);
        return;
      }

      if (compareMode) {
        toggleCompare(item, tr);
        return;
      }

      if (e.target.closest('a')) e.preventDefault();
      showDetailModal(item);
    }

    els.cpuTbody.addEventListener('click', onTbodyClick);
    els.gpuTbody.addEventListener('click', onTbodyClick);

    els.cpuTable.querySelector('thead').addEventListener('click', function (e) {
      var th = e.target.closest('.sortable');
      if (!th) return;
      var field = th.dataset.sort;
      if (sortField === field) {
        if (sortDir === 'asc') sortDir = 'desc';
        else if (sortDir === 'desc') { sortField = null; sortDir = 'asc'; }
      } else {
        sortField = field;
        sortDir = 'asc';
      }
      updateSortHeaders();
      applyFilters();
    });
  }

  function updateSortHeaders() {
    qsa('.sortable').forEach(function (th) {
      th.classList.remove('sorted-asc', 'sorted-desc');
    });
    if (sortField) {
      var th = qs('.sortable[data-sort="' + sortField + '"]');
      if (th) th.classList.add('sorted-' + sortDir);
    }
  }

  function handleUrlParam() {
    var params = new URLSearchParams(window.location.search);
    var cpuName = params.get('cpu');
    var gpuName = params.get('gpu');
    // Also check path-based params
    var path = window.location.pathname;
    if (!cpuName && !gpuName && path.indexOf('/embed') === 0) {
      // Already handled by the embed function
      return;
    }
    if (cpuName) {
      switchTab('cpu');
      var items = allData.cpu;
      for (var i = 0; i < items.length; i++) {
        if (items[i].name === cpuName) { showDetailModal(items[i]); return; }
      }
    } else if (gpuName) {
      switchTab('gpu');
      var items = allData.gpu;
      for (var i = 0; i < items.length; i++) {
        if (items[i].name === gpuName) { showDetailModal(items[i]); return; }
      }
    }
  }

  // ── Initialization ──

  function init() {
    initElements();
    els.loadingState.classList.add('visible');
    els.loadingStateMsg.textContent = 'Loading CPU database...';

    fetch('all_cpus.json?_=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        allData.cpu = processCpus(data.cpus || []);
        filteredData.cpu = allData.cpu.slice();
        var total = allData.cpu.length;

        var options = buildCpuFilterOptions(allData.cpu);

        var manuCountsCpu = {};
        var socketCounts = {};
        var processCounts = {};
        for (var i = 0; i < allData.cpu.length; i++) {
          var c = allData.cpu[i];
          manuCountsCpu[c.manufacturer] = (manuCountsCpu[c.manufacturer] || 0) + 1;
          socketCounts[c.socket] = (socketCounts[c.socket] || 0) + 1;
          processCounts[c.process] = (processCounts[c.process] || 0) + 1;
        }

        renderFilterCheckboxes(els.filterManu, options.manufacturers, 'manufacturer', manuCountsCpu);
        renderFilterCheckboxes(els.filterSocket, options.sockets, 'socket', socketCounts);
        renderFilterCheckboxes(els.filterProcess, options.processes, 'process', processCounts);

        // Load GPU data
        els.loadingStateMsg.textContent = 'Loading GPU database...';
        return fetch('all_gpus.json?_=' + Date.now())
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (gpuData) {
            allData.gpu = processGpus(gpuData.gpus || []);
            filteredData.gpu = allData.gpu.slice();

            var gpuOptions = buildGpuFilterOptions(allData.gpu);

            var gpuManuCounts = {};
            var gpuBusCounts = {};
            for (var i = 0; i < allData.gpu.length; i++) {
              var g = allData.gpu[i];
              gpuManuCounts[g.manufacturer] = (gpuManuCounts[g.manufacturer] || 0) + 1;
              if (g.bus !== '—') gpuBusCounts[g.bus] = (gpuBusCounts[g.bus] || 0) + 1;
            }

            // Merge CPU manufacturer counts into existing checkboxes (already rendered)
            // Only add GPU manufacturers that aren't already in the list
            var existingManus = {};
            var manuCbs = els.filterManu.querySelectorAll('input[type="checkbox"]');
            for (var i = 0; i < manuCbs.length; i++) {
              existingManus[manuCbs[i].value] = true;
            }
            // Deduplicate merged manufacturers
            // Store separate counts for tab-aware display
            manuCounts.cpu = {};
            for (var key in manuCountsCpu) manuCounts.cpu[key] = manuCountsCpu[key];
            manuCounts.gpu = {};
            for (var key in gpuManuCounts) manuCounts.gpu[key] = gpuManuCounts[key];

            var allManuSet = {};
            var allManufacturers = [];
            Object.keys(manuCountsCpu).concat(Object.keys(gpuManuCounts)).forEach(function (m) {
              if (!allManuSet[m]) {
                allManuSet[m] = true;
                allManufacturers.push(m);
              }
            });
            allManufacturers = sortManufacturers(allManufacturers);
            var mergedCounts = {};
            for (var key in manuCountsCpu) mergedCounts[key] = manuCountsCpu[key];
            for (var key in gpuManuCounts) {
              mergedCounts[key] = (mergedCounts[key] || 0) + gpuManuCounts[key];
            }
            renderFilterCheckboxes(els.filterManu, allManufacturers, 'manufacturer', mergedCounts);

            renderFilterCheckboxes(els.filterGpuBus, gpuOptions.buses, 'busTypes', gpuBusCounts);

            // Build tier-year stats
            var cpuStats = buildTierYearStats(allData.cpu, 'cpu');
            tierYearStats.cpu = cpuStats.stats;
            tierBandStats.cpu = cpuStats.bandStats;
            latestYear.cpu = cpuStats.latestYear;
            var gpuStats = buildTierYearStats(allData.gpu, 'gpu');
            tierYearStats.gpu = gpuStats.stats;
            tierBandStats.gpu = gpuStats.bandStats;
            latestYear.gpu = gpuStats.latestYear;

            els.loadingState.classList.remove('visible');
            els.resultCount.textContent = total + ' CPU' + (total !== 1 ? 's' : '') + ' loaded';

            setupEventListeners();
            render();
            initQuickFilters();
            updateFilterStats();
            switchTab('cpu');

            // Check URL params for auto-opening a detail view
            handleUrlParam();
          });
      })
      .catch(function (err) {
        els.loadingState.classList.remove('visible');
        var msg = 'Failed to load data. Make sure JSON files are in the same folder.<br><small>' + escHtml(err.message) + '</small>';
        els.cpuTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--danger);">' + msg + '</td></tr>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
