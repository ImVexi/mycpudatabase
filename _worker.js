export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cpuName = url.searchParams.get('cpu');
    const gpuName = url.searchParams.get('gpu');

    // No CPU/GPU param — serve static assets as normal
    if (!cpuName && !gpuName) {
      return env.ASSETS.fetch(request);
    }

    // Fetch the real index.html
    const staticResp = await env.ASSETS.fetch(new Request(url.origin + '/'));
    let html = await staticResp.text();

    // Fetch JSON data for OG tags
    try {
      if (cpuName) {
        const resp = await env.ASSETS.fetch(new Request(url.origin + '/all_cpus.json'));
        const data = await resp.json();
        const cpu = data.cpus.find(c => c.name === cpuName);
        if (cpu) {
          const pm = cpu.passmark || 0;
          const tier = pm >= 40000 ? 'Flagship' : pm >= 20000 ? 'Ultra' : pm >= 10000 ? 'High' : pm >= 5000 ? 'Mid' : 'Entry';
          const name = cpu.fullName || cpu.name;
          const score = pm ? pm.toLocaleString() : 'N/A';
          const title = `${name} — ${tier} CPU`;
          const desc = `PassMark: ${score} | ${tier} CPU`;
          html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
          html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
          html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
          html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url.href)}">`);
        }
      } else if (gpuName) {
        const resp = await env.ASSETS.fetch(new Request(url.origin + '/all_gpus.json'));
        const data = await resp.json();
        const gpu = data.gpus.find(g => g.name === gpuName);
        if (gpu) {
          const g3d = gpu.g3d || 0;
          const tier = g3d >= 30000 ? 'Flagship' : g3d >= 20000 ? 'Ultra' : g3d >= 10000 ? 'High' : g3d >= 3000 ? 'Mid' : 'Entry';
          const score = g3d > 0 ? g3d.toLocaleString() : 'N/A';
          const title = `${gpu.name} — ${tier} GPU`;
          const desc = `G3D: ${score} | ${tier} GPU`;
          html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
          html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
          html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
          html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url.href)}">`);
        }
      }
    } catch (e) {
      // Serve modified HTML even if JSON fetch fails
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
