# Полное руководство по деплою SuperEngulfing

Подробная пошаговая инструкция: GitHub, Kontabo (VPS), Nginx, PM2, PostgreSQL, автообновление при push.

---

## Структура проекта

| Компонент | Описание |
|-----------|----------|
| **Frontend** | Remix + Vite, собирается в `build/client` и `build/server` |
| **Backend API** | Express в `server/index.cjs`, порт 3001 |
| **База данных** | PostgreSQL |
| **В dev** | Vite (5173) проксирует `/api` на Express (3001) |

---

# ЧАСТЬ 1: GitHub

## Шаг 1.1. Создать репозиторий

1. Открой [github.com](https://github.com) и войди в аккаунт
2. Нажми **New repository**
3. **Repository name**: `superengulfing` (или другое)
4. **Visibility**: **Private**
5. НЕ включай README, .gitignore, license — проект уже есть
6. Нажми **Create repository**

## Шаг 1.2. Первый push

Открой терминал в папке проекта и выполни:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ТВОЙ_USERNAME/superengulfing.git
git push -u origin main
```

**ТВОЙ_USERNAME** — замени на свой логин GitHub.

При запросе логина/пароля:
- Логин: твой GitHub username
- Пароль: Personal Access Token (не обычный пароль)

Как создать токен: GitHub → Settings → Developer settings → Personal access tokens → Generate new token.

---

# ЧАСТЬ 2: Kontabo — подготовка сервера

## Шаг 2.1. Подключение по SSH

```bash
ssh root@ТВОЙ_IP_АДРЕС
```

IP и пароль указаны в письме Kontabo после создания VPS.

## Шаг 2.2. Обновление системы

```bash
apt update && apt upgrade -y
```

## Шаг 2.3. Установка Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # должно показать v20.x
npm -v
```

## Шаг 2.4. Установка PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

## Шаг 2.5. Создание БД и пользователя

```bash
sudo -u postgres psql
```

В консоли PostgreSQL:

```sql
CREATE DATABASE superengulfing_email;
CREATE USER superengulfing_user WITH PASSWORD 'твой_надежный_пароль';
GRANT ALL PRIVILEGES ON DATABASE superengulfing_email TO superengulfing_user;
\c superengulfing_email
GRANT ALL ON SCHEMA public TO superengulfing_user;
\q
```

## Шаг 2.6. Установка Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

## Шаг 2.7. Установка PM2

```bash
npm install -g pm2
pm2 -v
```

---

# ЧАСТЬ 3: Клонирование и настройка проекта

## Шаг 3.1. Создать папку (если нужно)

```bash
mkdir -p /var/www
cd /var/www
```

Или использовать `/root`:

```bash
cd /root
```

## Шаг 3.2. Клонировать репозиторий

```bash
git clone https://github.com/ТВОЙ_USERNAME/superengulfing.git
cd superengulfing
```

Для приватного репо: при запросе — логин и Personal Access Token.

## Шаг 3.3. Установить зависимости

```bash
npm install
```

## Шаг 3.4. Собрать проект

```bash
NODE_ENV=production npm run build
```

---

# ЧАСТЬ 4: Настройка .env (детально)

## Шаг 4.1. server/.env

```bash
cp server/.env.example server/.env
nano server/.env
```

Заполни переменные:

### Email (SMTP)

| Переменная | Описание | Пример |
|------------|----------|--------|
| SMTP_HOST | Хост почтового сервера | `mail.privateemail.com` |
| SMTP_PORT | Порт (обычно 465) | `465` |
| SMTP_USER | Полный email | `info@superengulfing.com` |
| SMTP_PASS | Пароль от почты | `твой_пароль` |
| SMTP_FROM | От кого письма | `"SuperEngulfing <info@superengulfing.com>"` |
| SMTP_REPLY_TO | Reply-To | `info@superengulfing.com` |

### URL

| Переменная | Описание | Пример |
|------------|----------|--------|
| API_URL | Базовый URL сайта (без /api — код сам добавляет /api/...) | `https://superengulfing.com` |
| THANK_YOU_URL | Страница Thank You | `https://superengulfing.io/thank-you` |
| FRONTEND_URL | Домен сайта | `https://superengulfing.io` |
| PDF_LINK | Ссылка на PDF (fallback если per-locale не задан) | `https://drive.google.com/file/d/...` |

### PDF и видео по локали (EN / AM)

| Переменная | Описание | Пример |
|------------|----------|--------|
| PDF_LINK_EN | PDF для английской аудитории | `https://drive.google.com/file/d/.../view?usp=sharing` |
| PDF_LINK_AM | PDF для армянской аудитории | `https://drive.google.com/file/d/.../view?usp=sharing` |
| WELCOME_VIDEO_EN | Welcome-видео (Wistia embed) для EN | `https://fast.wistia.net/embed/iframe/xxxxx?videoFoam=true` |
| WELCOME_VIDEO_AM | Welcome-видео для AM | `https://fast.wistia.net/embed/iframe/xxxxx?videoFoam=true` |

### Безопасность

| Переменная | Описание | Как получить |
|------------|----------|--------------|
| CORS_ORIGIN | Разрешённый origin для API | Тот же домен: `https://superengulfing.io` |
| JWT_SECRET | Секрет для JWT | Сгенерировать: `openssl rand -hex 32` |

### Admin

| Переменная | Описание | Пример |
|------------|----------|--------|
| ADMIN_EMAIL | Fallback для уведомлений (если per-locale не задан) | `email1@gmail.com,email2@gmail.com` |
| ADMIN_EMAIL_EN | Кому слать уведомления о запросах EN | `admin-en@example.com` |
| ADMIN_EMAIL_AM | Кому слать уведомления о запросах AM | `admin-am@example.com` |
| ADMIN_EMAILS | Fallback для входа (если per-locale не задан) | `email1@gmail.com,email2@gmail.com` |
| ADMIN_EMAILS_EN | Email для входа в /admin (EN) | `admin-en@example.com` |
| ADMIN_EMAILS_AM | Email для входа в /am/admin (AM) | `admin-am@example.com` |

### Throttle

| Переменная | Описание | Значение |
|------------|----------|----------|
| THROTTLE_EMAILS_PER_MINUTE | Лимит писем в минуту | `50` или `0` (без лимита) |

### PostgreSQL

| Переменная | Описание | Пример |
|------------|----------|--------|
| DB_HOST | Хост БД | `localhost` |
| DB_PORT | Порт | `5432` |
| DB_NAME | Имя БД | `superengulfing_email` |
| DB_USER | Пользователь | `superengulfing_user` |
| DB_PASSWORD | Пароль | Пароль из шага 2.5 |

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Шаг 4.2. Корневой .env (для фронта)

```bash
nano .env
```

Содержимое:

```
VITE_API_URL=https://твой-домен.com
VITE_SITE_URL=https://твой-домен.com
API_URL=https://твой-домен.com
```

Важно: не добавляй `/api` — код сам добавляет `/api/subscribe`, `/api/confirm` и т.д.

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Шаг 4.3. Права доступа

```bash
chmod 600 server/.env
chmod 600 .env
```

---

# ЧАСТЬ 5: Миграции БД

## Шаг 5.1. Базовая схема

```bash
cd /var/www/superengulfing
sudo -u postgres psql -d superengulfing_email -f server/schema.sql
```

Если база уже создана и schema.sql даёт ошибки (таблицы есть), можно пропустить.

## Шаг 5.2. Миграции

Выполни по порядку:

```bash
node server/run_access_migration.cjs
node server/run_analytics_migration.cjs
node server/run_broadcast_segment_migration.cjs
node server/run_certificate_section_migration.cjs
node server/run_courses_migration.cjs
node server/run_indicator_access_migration.cjs
node server/run_lesson_resources_migration.cjs
node server/run_locale_migration.cjs
node server/run_onboarding_migration.cjs
node server/run_profile_migration.cjs
node server/run_wistia_migration.cjs
node server/run_site_settings_locale_migration.cjs
```

При ошибках вида «relation already exists» — миграция уже применена, можно идти дальше.

---

# ЧАСТЬ 6: PM2 — запуск процессов

## Шаг 6.1. Express API (порт 3001)

```bash
cd /var/www/superengulfing
NODE_ENV=production pm2 start server/index.cjs --name api
```

## Шаг 6.2. Remix (порт 3000)

Если есть `build/server/index.js`:

```bash
NODE_ENV=production pm2 start npx --name remix -- remix-serve build/server/index.js
```

Если Remix server не собирается, Nginx может раздавать `build/client` как статику (см. альтернативу ниже).

## Шаг 6.3. Сохранение и автозапуск

```bash
pm2 save
pm2 startup
```

Выполни команду, которую выведет `pm2 startup`.

## Шаг 6.4. Проверка

```bash
pm2 status
pm2 logs
```

---

# ЧАСТЬ 7: Nginx — reverse proxy

## Шаг 7.1. Создать конфиг

```bash
nano /etc/nginx/sites-available/superengulfing
```

Вставь (замени `superengulfing.io` на свой домен):

```nginx
server {
    listen 80;
    server_name superengulfing.io www.superengulfing.io;

    # API — проксируем на Express
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Остальное — Remix server
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Если Remix не запущен, можно раздавать статику:

```nginx
    location / {
        root /var/www/superengulfing/build/client;
        try_files $uri $uri/ /index.html;
    }
```

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Шаг 7.2. Включить сайт

```bash
ln -s /etc/nginx/sites-available/superengulfing /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Шаг 7.3. SSL (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d superengulfing.io -d www.superengulfing.io
```

Дальше следуй подсказкам certbot.

---

# ЧАСТЬ 8: Автообновление (GitHub Actions)

При каждом push в `main` сервер автоматически обновляется.

## Шаг 8.1. SSH-ключ на сервере

На сервере:

```bash
ssh-keygen -t ed25519 -C "deploy" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key
```

Скопируй вывод `cat ~/.ssh/deploy_key` (приватный ключ) — он понадобится для GitHub Secrets.

## Шаг 8.2. Создать workflow

На своём компьютере в папке проекта создай файл:

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy to Kontabo

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/superengulfing
            git pull origin main
            npm install
            npm run build
            pm2 restart api
            pm2 restart remix
```

## Шаг 8.3. GitHub Secrets

1. GitHub → твой репозиторий → Settings → Secrets and variables → Actions
2. New repository secret:
   - `SERVER_HOST` — IP сервера (например `123.45.67.89`)
   - `SERVER_USER` — `root`
   - `SSH_PRIVATE_KEY` — содержимое `~/.ssh/deploy_key` (приватный ключ)

## Шаг 8.4. Push workflow

```bash
git add .github/workflows/deploy.yml
git commit -m "Add deploy workflow"
git push
```

После push в `main` GitHub Actions выполнит деплой.

---

# ЧАСТЬ 9: Чеклист и troubleshooting

## Чеклист после деплоя

- [ ] Сайт открывается по домену
- [ ] API отвечает: `curl https://твой-домен.com/api/ping`
- [ ] Логин/подписка работают
- [ ] Письма приходят

## Типичные ошибки

### API не отвечает

```bash
pm2 logs api
```

Проверь `server/.env`, порт 3001, CORS_ORIGIN.

### Ошибки БД

```bash
sudo -u postgres psql -d superengulfing_email -c "\dt"
```

Проверь, что миграции выполнены и `DB_*` в `.env` верные.

### 502 Bad Gateway

Nginx не может достучаться до приложения. Проверь:

```bash
pm2 status
curl http://127.0.0.1:3001/api/ping
curl http://127.0.0.1:3000
```

### Письма не отправляются

Проверь SMTP в `server/.env`. Убедись, что SMTP_HOST, SMTP_USER, SMTP_PASS корректны и порт 465 доступен.

### GitHub Actions падает

Проверь Secrets. Убедись, что `SSH_PRIVATE_KEY` содержит весь ключ, включая `-----BEGIN ... KEY-----` и `-----END ... KEY-----`.

---

## Краткая шпаргалка команд

```bash
# На сервере
cd /var/www/superengulfing
git pull
npm install
npm run build
pm2 restart api
pm2 restart remix
pm2 logs
```
