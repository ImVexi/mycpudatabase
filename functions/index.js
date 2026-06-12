export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cpuName = url.searchParams.get('cpu');
  const gpuName = url.searchParams.get('gpu');

  // No params — serve the static index.html as-is
  if (!cpuName && !gpuName) {
    return env.ASSETS.fetch(request);
  }

  const baseUrl = url.origin;
  let name = '', score = '', tier = '', type = 'CPU';

  try {
    if (cpuName) {
      const resp = await fetch(`${baseUrl}/all_cpus.json`);
      const data = await resp.json();
      const cpu = data.cpus.find(c => c.name === cpuName);
      if (cpu) {
        name = cpu.fullName || cpu.name;
        score = cpu.passmark ? cpu.passmark.toLocaleString() : 'N/A';
        const pm = cpu.passmark || 0;
        if (pm >= 40000) tier = 'Flagship';
        else if (pm >= 20000) tier = 'Ultra';
        else if (pm >= 10000) tier = 'High';
        else if (pm >= 5000) tier = 'Mid';
        else tier = 'Entry';
      }
    } else if (gpuName) {
      const resp = await fetch(`${baseUrl}/all_gpus.json`);
      const data = await resp.json();
      const gpu = data.gpus.find(g => g.name === gpuName);
      if (gpu) {
        type = 'GPU';
        name = gpu.name;
        score = gpu.g3d > 0 ? gpu.g3d.toLocaleString() : 'N/A';
        const g3d = gpu.g3d || 0;
        if (g3d >= 30000) tier = 'Flagship';
        else if (g3d >= 20000) tier = 'Ultra';
        else if (g3d >= 10000) tier = 'High';
        else if (g3d >= 3000) tier = 'Mid';
        else tier = 'Entry';
      }
    }
  } catch (e) {
    // Fall through to static index.html
  }

  const title = name ? `${name} — ${tier} ${type}` : 'CPUDb — Hardware Specs Database';
  const desc = name ? `PassMark: ${score} | ${tier} ${type}` : 'Browse and compare 9000+ CPUs and 3000+ GPUs.';

  // Fetch the real index.html and inject OG tags
  try {
    const staticResp = await env.ASSETS.fetch(new Request(baseUrl + '/'));
    const staticHtml = await staticResp.text();
    const ogHtml = staticHtml
      .replace(/<title>.*?<\/title>/, `<title>${escHtml(title)}</title>`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escHtml(title)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escHtml(desc)}">`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escHtml(url.href)}">`);
    return new Response(ogHtml, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  } catch (e) {
    // Fallback minimal page
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escHtml(url.href)}">
<title>${escHtml(title)}</title></head><body>
<script>location.href = '/?cpu=${encodeURIComponent(cpuName || '')}${gpuName ? '?gpu=' + encodeURIComponent(gpuName) : ''}'</script>
</body></html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
