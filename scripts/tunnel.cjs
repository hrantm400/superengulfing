const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const LOCAL_URL = 'http://localhost:5173';

function checkDevServer() {
  return new Promise((resolve) => {
    const req = http.get(LOCAL_URL, { timeout: 3000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('Проверка: запущен ли dev-сервер на localhost:5173 ...');
  const ok = await checkDevServer();
  if (!ok) {
    console.log('');
    console.log('*** ВНИМАНИЕ: на порту 5173 ничего не отвечает! ***');
    console.log('   Сначала в ДРУГОМ терминале запусти:  npm run dev');
    console.log('   Дождись строки "Local: http://localhost:5173/" и затем снова запусти:  npm run tunnel');
    console.log('');
  } else {
    console.log('OK — dev-сервер запущен.\n');
  }
  console.log('Подсказка: если страница по ссылке «крутится» — перезапусти фронт так: npm run dev:tunnel\n');

  const cloudflared = spawn('cloudflared', ['tunnel', '--url', LOCAL_URL], {
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let urlShown = false;

  function showUrl(link) {
    if (urlShown) return;
    urlShown = true;
    const full = link.startsWith('http') ? link : `https://${link}`;
    const outDir = path.join(__dirname, '..');
    const filePath = path.join(outDir, 'TUNNEL_URL.txt');
    fs.writeFileSync(filePath, full + '\n', 'utf8');
    console.log('\n');
    console.log('============================================================');
    console.log('  ЭТА ССЫЛКА — копируй и открывай (или передавай другу):');
    console.log('  ' + full);
    console.log('============================================================');
    console.log('  • Подожди 30–60 секунд после появления ссылки.');
    console.log('  • Сначала открой ссылку НА ЭТОМ ЖЕ компьютере (где запущен туннель).');
    console.log('  • Не закрывай этот терминал — иначе ссылка перестанет работать.');
    console.log('  (Ссылка также в файле TUNNEL_URL.txt)');
    console.log('============================================================\n');
  }

  cloudflared.stdout.setEncoding('utf8');
  cloudflared.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const match = chunk.match(/https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.trycloudflare\.com/);
    if (match) showUrl(match[0]);
  });

  cloudflared.stderr.setEncoding('utf8');
  cloudflared.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    const match = chunk.match(/https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.trycloudflare\.com/);
    if (match) showUrl(match[0]);
  });

  cloudflared.on('error', (err) => {
    console.error('Ошибка: cloudflared не найден. Установи: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/', err.message);
    process.exit(1);
  });

  cloudflared.on('close', (code) => {
    process.exit(code);
  });
}

main();
