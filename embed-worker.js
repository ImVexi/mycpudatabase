// Paste this into a new Cloudflare Worker at https://dash.cloudflare.com
// Then set a route: database.vextroboomin.xyz/embed*

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cpuName = url.searchParams.get('cpu');
    const gpuName = url.searchParams.get('gpu');
    const site = 'https://database.vextroboomin.xyz';

    let title = 'CPUDb — Hardware Specs Database';
    let desc = 'Browse and compare 9000+ CPUs and 3000+ GPUs.';

    try {
      if (cpuName) {
        const resp = await fetch(site + '/all_cpus.json');
        const data = await resp.json();
        const cpu = data.cpus.find(c => c.name === cpuName);
        if (cpu) {
          const pm = cpu.passmark || 0;
          const tier = pm >= 40000 ? 'Flagship' : pm >= 20000 ? 'Ultra' : pm >= 10000 ? 'High' : pm >= 5000 ? 'Mid' : 'Entry';
          const name = cpu.fullName || cpu.name;
          title = `${name} — ${tier} CPU`;
          desc = `PassMark: ${pm ? pm.toLocaleString() : 'N/A'} | ${tier} CPU`;
        }
      } else if (gpuName) {
        const resp = await fetch(site + '/all_gpus.json');
        const data = await resp.json();
        const gpu = data.gpus.find(g => g.name === gpuName);
        if (gpu) {
          const g3d = gpu.g3d || 0;
          const tier = g3d >= 30000 ? 'Flagship' : g3d >= 20000 ? 'Ultra' : g3d >= 10000 ? 'High' : g3d >= 3000 ? 'Mid' : 'Entry';
          title = `${gpu.name} — ${tier} GPU`;
          desc = `G3D: ${g3d > 0 ? g3d.toLocaleString() : 'N/A'} | ${tier} GPU`;
        }
      }
    } catch (e) {}

    const redirect = site + '/?' + (cpuName ? 'cpu=' + encodeURIComponent(cpuName) : 'gpu=' + encodeURIComponent(gpuName));

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
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
