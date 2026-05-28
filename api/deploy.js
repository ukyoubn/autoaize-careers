export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, title, description, html, date } = req.body;
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const GAS_URL = process.env.GAS_URL;

  try {
    const htmlBuffer = Buffer.from(html, 'base64');
    const siteName = 'autoaize-' + Date.now();

    // Netlifyサイト作成
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NETLIFY_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: siteName })
    });
    const site = await siteRes.json();
    if (!site.id) return res.status(500).json({ error: site });

    // ZIPを作成してデプロイ
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('index.html', htmlBuffer);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const deployRes = await fetch('https://api.netlify.com/api/v1/sites/' + site.id + '/deploys', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NETLIFY_TOKEN,
        'Content-Type': 'application/zip'
      },
      body: zipBuffer
    });
    const deploy = await deployRes.json();

    const url = 'https://' + siteName + '.netlify.app';

    // スプレッドシートに保存
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name, title, description, url, date })
    });

    return res.status(200).json({ url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
