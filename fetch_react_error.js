const https = require('https');
https.get('https://react.dev/errors/300', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const titleMatch = data.match(/<title>(.*?)<\/title>/i);
    console.log('Title:', titleMatch ? titleMatch[1] : 'Not found');
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
