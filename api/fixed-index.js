const fs = require('fs');
const path = require('path');

module.exports = function fixedIndex(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(filePath, 'utf8');

    const replacements = [
      [
        'topbarAvatar.innerHTML = <span style="font-weight:800; font-size:13px; color:var(--gold-primary);"> + initial + </span>;',
        'topbarAvatar.innerHTML = `<span style="font-weight:800; font-size:13px; color:var(--gold-primary);">${initial}</span>`;'
      ],
      [
        'topbarAvatar.innerHTML = <span class="material-symbols-outlined" style="font-size:18px; color:var(--gold-primary);">person</span>;',
        'topbarAvatar.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px; color:var(--gold-primary);">person</span>`;'
      ],
      [
        'topbarAvatar.innerHTML = <span class="material-symbols-outlined" style="font-size:18px;">lock</span>;',
        'topbarAvatar.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">lock</span>`;'
      ],
      [
        'detectSessionInUrl: true,',
        'detectSessionInUrl: false,'
      ]
    ];

    for (const [from, to] of replacements) html = html.split(from).join(to);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(html);
  } catch (error) {
    console.error('fixed-index error:', error);
    res.status(500).send('Munna AI failed to load.');
  }
};
