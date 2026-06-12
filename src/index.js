const SITE = 'https://database.vextroboomin.xyz';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isEmbed = url.pathname === '/' || url.pathname.startsWith('/embed');
    const cpuName = url.searchParams.get('cpu');
    const gpuName = url.searchParams.get('gpu');

    const embedCrawler = /(Discordbot|Twitterbot|facebookexternalhit|Facebot|Slack|TelegramBot|WhatsApp|LinkedInBot|Applebot|Slackbot|Slack-ImgProxy|Googlebot|bingbot|Pinterest)/i;
    const isBot = embedCrawler.test(request.headers.get('User-Agent') || '');
    const hasParams = cpuName || gpuName;

    // Pass through static assets for normal browsing
    if (!isEmbed || (!hasParams && url.pathname !== '/embed')) {
      try { return await env.ASSETS.fetch(request); } catch (e) {}
      const staticResp = await fetch(SITE + url.pathname);
      return new Response(staticResp.body, {
        status: staticResp.status,
        headers: { 'Content-Type': staticResp.headers.get('Content-Type') || 'text/html;charset=UTF-8' }
      });
    }

    let title = 'CPUDb — Hardware Specs Database';
    let desc = 'Browse and compare 9000+ CPUs and 3000+ GPUs with specs, benchmarks, and performance comparisons.';

    try {
      if (cpuName) {
        const resp = await fetch(SITE + '/all_cpus.json');
        const data = await resp.json();
        const cpu = data.cpus.find(c => c.name === cpuName);
        if (cpu) {
          const pm = cpu.passmark || 0;
          const tier = pm >= 40000 ? 'Flagship' : pm >= 20000 ? 'Ultra' : pm >= 10000 ? 'High' : pm >= 5000 ? 'Mid' : 'Entry';
          const fullName = (cpu._details && cpu._details._fullName) || cpu.fullName || cpu.name;
          title = `${fullName} — ${tier} CPU`;
          desc = buildCpuDesc(cpu, pm, tier);
        }
      } else if (gpuName) {
        const resp = await fetch(SITE + '/all_gpus.json');
        const data = await resp.json();
        const gpu = data.gpus.find(g => g.name === gpuName);
        if (gpu) {
          const g3d = gpu.g3d || 0;
          const tier = g3d >= 30000 ? 'Flagship' : g3d >= 20000 ? 'Ultra' : g3d >= 10000 ? 'High' : g3d >= 3000 ? 'Mid' : 'Entry';
          title = `${gpu.name} — ${tier} GPU`;
          desc = buildGpuDesc(gpu, g3d, tier);
        }
      }
    } catch (e) {}

    const redirect = SITE + '/?' + (cpuName ? 'cpu=' + encodeURIComponent(cpuName) : 'gpu=' + encodeURIComponent(gpuName));

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
};

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

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
