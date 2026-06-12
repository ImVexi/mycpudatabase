export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cpuName = url.searchParams.get('cpu');
  const gpuName = url.searchParams.get('gpu');

  if (!cpuName && !gpuName) {
    return env.ASSETS.fetch(request);
  }

  const staticResp = await env.ASSETS.fetch(new Request(url.origin + '/'));
  let html = await staticResp.text();

  try {
    if (cpuName) {
      const resp = await env.ASSETS.fetch(new Request(url.origin + '/all_cpus.json'));
      const data = await resp.json();
      const cpu = data.cpus.find(c => c.name === cpuName);
      if (cpu) {
        const pm = cpu.passmark || 0;
        const tier = pm >= 40000 ? 'Flagship' : pm >= 20000 ? 'Ultra' : pm >= 10000 ? 'High' : pm >= 5000 ? 'Mid' : 'Entry';
        const fullName = (cpu._details && cpu._details._fullName) || cpu.fullName || cpu.name;
        const title = `${fullName} — ${tier} CPU`;
        const desc = buildCpuDesc(cpu, pm, tier);
        html = replaceMeta(html, title, desc, url.href);
      }
    } else if (gpuName) {
      const resp = await env.ASSETS.fetch(new Request(url.origin + '/all_gpus.json'));
      const data = await resp.json();
      const gpu = data.gpus.find(g => g.name === gpuName);
      if (gpu) {
        const g3d = gpu.g3d || 0;
        const tier = g3d >= 30000 ? 'Flagship' : g3d >= 20000 ? 'Ultra' : g3d >= 10000 ? 'High' : g3d >= 3000 ? 'Mid' : 'Entry';
        const title = `${gpu.name} — ${tier} GPU`;
        const desc = buildGpuDesc(gpu, g3d, tier);
        html = replaceMeta(html, title, desc, url.href);
      }
    }
  } catch (e) {}

  return new Response(html, {
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

function replaceMeta(html, title, desc, href) {
  html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(href)}">`);
  return html;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
