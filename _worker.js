const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Share</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f0f2f5; max-width: 500px; margin: 40px auto; padding: 20px; }
        .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
        h2 { margin-top: 0; color: #333; font-size: 1.2rem; }
        input[type="file"] { display: block; margin-bottom: 15px; width: 100%; }
        button { background: #0070f3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%; }
        button:hover { background: #0051a8; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { background: #f8f9fa; padding: 10px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eee; font-size: 14px; }
        li span { word-break: break-all; margin-right: 10px; }
        a.dl { background: #0070f3; color: white; text-decoration: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="box">
        <h2>Upload File</h2>
        <form id="uploadForm">
            <input type="file" id="fileInput" required>
            <button type="submit">Upload</button>
        </form>
    </div>
    <div class="box">
        <h2>Files</h2>
        <ul id="fileList"><li>Loading...</li></ul>
    </div>
    <script>
        const fileList = document.getElementById('fileList');
        async function loadFiles() {
            try {
                const res = await fetch('/api/files');
                const files = await res.json();
                fileList.innerHTML = files.length === 0 ? '<li>No files yet.</li>' : '';
                files.forEach(file => {
                    const li = document.createElement('li');
                    li.innerHTML = \`<span>\${file.key}</span> <a class="dl" href="/api/download?file=\${encodeURIComponent(file.key)}">Download</a>\`;
                    fileList.appendChild(li);
                });
            } catch { fileList.innerHTML = '<li>Error loading files.</li>'; }
        }
        document.getElementById('uploadForm').onsubmit = async (e) => {
            e.preventDefault();
            const file = document.getElementById('fileInput').files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            fileList.innerHTML = '<li>Uploading...</li>';
            await fetch('/api/upload', { method: 'POST', body: formData });
            document.getElementById('uploadForm').reset();
            loadFiles();
        };
        loadFiles();
    </script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/files') {
      const objects = await env.SHARE_BUCKET.list();
      return new Response(JSON.stringify(objects.objects.map(o => ({ key: o.key }))), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/upload' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response('No file', { status: 400 });
      await env.SHARE_BUCKET.put(file.name, file.stream(), { httpMetadata: { contentType: file.type } });
      return new Response('Ok');
    }

    if (url.pathname === '/api/download') {
      const fileName = url.searchParams.get('file');
      const object = await env.SHARE_BUCKET.get(fileName);
      if (!object) return new Response('Not Found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Content-Disposition', `attachment; filename="\${fileName}"`);
      return new Response(object.body, { headers });
    }

    return new Response(HTML_CONTENT, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }
};
