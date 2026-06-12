export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const cpuName = url.searchParams.get('cpu');
  const gpuName = url.searchParams.get('gpu');

  // Fetch the JSON data
  const baseUrl = url.origin;
  let name = '', score = '', tier = '', type = 'CPU', imgUrl = '';

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
        imgUrl = `${baseUrl}/icon.png`;
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
    // Silently fall back to default embed
  }

  const title = name ? `${name} — ${tier} ${type}` : 'CPUDb — Hardware Specs Database';
  const desc = name ? `PassMark: ${score} | ${tier} ${type}` : 'Browse and compare 9000+ CPUs and 3000+ GPUs.';
  const redirectUrl = cpuName ? `${baseUrl}/?cpu=${encodeURIComponent(cpuName)}` :
                       gpuName ? `${baseUrl}/?gpu=${encodeURIComponent(gpuName)}` : baseUrl;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url.href)}">
  <meta name="theme-color" content="#2563eb">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <script>window.location.href = ${JSON.stringify(redirectUrl)};</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
