const CPUS_URL = 'https://raw.githubusercontent.com/ImVexi/mycpudatabase/main/all_cpus.json';
const GPUS_URL = 'https://raw.githubusercontent.com/ImVexi/mycpudatabase/main/all_gpus.json';
const GH_BASE = 'https://raw.githubusercontent.com/ImVexi/mycpudatabase/main';
const PREFIXES = ['', 'AMD ', 'Intel ', 'Qualcomm ', 'Apple '];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cpuName = url.searchParams.get('cpu');
    const gpuName = url.searchParams.get('gpu');
    const hasParams = cpuName || gpuName;

    // /?cpu=X or /?gpu=X → 301 redirect to /embed?cpu=X
    if (hasParams && !url.pathname.startsWith('/embed')) {
      const dest = cpuName ? '/embed?cpu=' + encodeURIComponent(cpuName) : '/embed?gpu=' + encodeURIComponent(gpuName);
      return new Response(null, { status: 301, headers: { 'Location': dest } });
    }

    // /embed?cpu=X or /embed?gpu=X → serve OG-rich HTML
    if (url.pathname.startsWith('/embed')) {
      return serveEmbed(url, cpuName, gpuName);
    }

    // Everything else: proxy from GitHub raw
    const ghPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const ghResp = await fetch(GH_BASE + ghPath);
    if (ghResp.ok || ghResp.status === 404) {
      const headers = new Headers(ghResp.headers);
      headers.set('Cache-Control', 'public, max-age=60');
      return new Response(ghResp.body, {
        status: ghResp.status === 404 ? 404 : 200,
        headers
      });
    }
    return new Response('Not found', { status: 404 });
  }
};

async function serveEmbed(url, cpuName, gpuName) {
  let title = 'CPUDb — Hardware Specs Database';
  let desc = 'Browse and compare 9000+ CPUs and 3000+ GPUs with specs, benchmarks, and performance comparisons.';

  try {
    if (cpuName) {
      const jsonResp = await fetch(CPUS_URL);
      const data = await jsonResp.json();
      const cpu = findByName(data.cpus, cpuName);
      if (cpu) {
        const pm = cpu.passmark || 0;
        const tier = pm >= 40000 ? 'Flagship' : pm >= 20000 ? 'Ultra' : pm >= 10000 ? 'High' : pm >= 5000 ? 'Mid' : 'Entry';
        const fullName = (cpu._details && cpu._details._fullName) || cpu.fullName || cpu.name;
        title = `${fullName} — ${tier} CPU`;
        desc = buildCpuDesc(cpu, pm, tier);
      }
    } else if (gpuName) {
      const jsonResp = await fetch(GPUS_URL);
      const data = await jsonResp.json();
      const gpu = findByName(data.gpus, gpuName);
      if (gpu) {
        const g3d = gpu.g3d || 0;
        const tier = g3d >= 30000 ? 'Flagship' : g3d >= 20000 ? 'Ultra' : g3d >= 10000 ? 'High' : g3d >= 3000 ? 'Mid' : 'Entry';
        title = `${gpu.name} — ${tier} GPU`;
        desc = buildGpuDesc(gpu, g3d, tier);
      }
    }
  } catch (e) {}

  const redirect = 'https://database.vextroboomin.xyz/?' + (cpuName ? 'cpu=' + encodeURIComponent(cpuName) : 'gpu=' + encodeURIComponent(gpuName));

  return new Response(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url.href)}">
<meta name="theme-color" content="#2563eb">
<meta http-equiv="refresh" content="0;url=${esc(redirect)}">
<title>${esc(title)}</title>
</head><body><script>location.href='${esc(redirect)}'</script></body></html>`, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

function buildCpuDesc(cpu, pm, tier) {
  const parts = [];
  if (cpu.coresThreads) parts.push(`Cores: ${cpu.coresThreads}`);
  if (cpu.clock) parts.push(`Clock: ${cpu.clock}`);
  if (cpu.socket && cpu.socket !== 'Unknown') parts.push(`Socket: ${cpu.socket}`);
  if (cpu.process && cpu.process !== '-' && cpu.process !== 'Unknown') parts.push(`Node: ${cpu.process}`);
  if (cpu.tdp && cpu.tdp !== '-' && cpu.tdp !== 'unknown') parts.push(`TDP: ${cpu.tdp}`);
  if (pm) parts.push(`PassMark: ${pm.toLocaleString()}`);
  if (cpu.released) parts.push(`Released: ${cpu.released}`);
  parts.push(`${tier} CPU`);
  return parts.join(' | ');
}

function buildGpuDesc(gpu, g3d, tier) {
  const parts = [];
  if (gpu.cores) parts.push(`Cores: ${gpu.cores}`);
  if (gpu.clock) parts.push(`Clock: ${gpu.clock}`);
  if (gpu.memSize) parts.push(`VRAM: ${gpu.memSize}`);
  if (gpu.bus && gpu.bus !== 'Unknown') parts.push(`Bus: ${gpu.bus}`);
  if (gpu.tdp && gpu.tdp !== '-' && gpu.tdp !== 'unknown') parts.push(`TDP: ${gpu.tdp}`);
  if (g3d) parts.push(`G3D: ${g3d.toLocaleString()}`);
  if (gpu.released) parts.push(`Released: ${gpu.released}`);
  parts.push(`${tier} GPU`);
  return parts.join(' | ');
}

function findByName(items, name) {
  for (const prefix of PREFIXES) {
    const found = items.find(c => c.name === prefix + name);
    if (found) return found;
  }
  return null;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
