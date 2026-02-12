# Деплой через GitHub

При **push в ветку `main`** GitHub Actions подключается к серверу и выполняет:

```bash
cd /var/www/superengulfing
git pull origin main
npm install
NODE_ENV=production npm run build
pm2 restart api
pm2 restart remix
pm2 save
```

---

## Что сделать один раз

### 1. Секреты в репозитории

В GitHub: **Settings → Secrets and variables → Actions** должны быть:

| Секрет           | Значение                          |
|------------------|-----------------------------------|
| `SERVER_HOST`    | IP сервера (например `173.249.3.156`) |
| `SERVER_USER`    | Пользователь SSH (например `root`)    |
| `SSH_PRIVATE_KEY`| Приватный SSH-ключ (содержимое ключа для доступа к серверу) |

Без них workflow не сможет подключиться к серверу.

### 2. На сервере

- В `/var/www/superengulfing` уже должен быть клон репозитория:  
  `git clone https://github.com/hrantm400/superengulfing.git .`
- Файл `server/.env` на сервере не трогать (его нет в репозитории по .gitignore).

---

## Обычный деплой (после правок в коде)

Локально в папке проекта:

```bash
# Добавить только нужные файлы (не весь build)
git add src/pages/Admin.tsx
git add src/components/AdminGate.tsx
git add src/components/admin/SequenceEmailsSortable.tsx
git add src/components/admin/RichTextEditor.tsx
git add server/migrations/020_subscribers_double_optin.sql
git add server/migrations/021_broadcast_sequence_locale_and_opens.sql
git add server/migrations/022_email_send_jobs.sql

# Если нужно задеплоить и другие изменения — добавь их отдельно, например:
# git add server/index.cjs
# git add package.json package-lock.json
# и т.д.

git status
git commit -m "Admin: QR for second admin, dnd-kit client-only, migrations, RichTextEditor"
git push origin main
```

После push зайди в GitHub → вкладка **Actions** — должен запуститься workflow **Deploy to Kontabo**. Если секреты настроены, через 1–2 минуты на сервере будет новая сборка и перезапущенные `api` и `remix`.

---

## Если в коммит попала папка build

Папка `build/` в .gitignore, но если она раньше была в репозитории, в `git status` могут быть «deleted: build/...». Чтобы не коммитить удаление build (оставить как было в репо):

```bash
git restore --staged build
```

Если, наоборот, хочешь убрать build из репозитория (на сервере каждый раз собирается заново):

```bash
git add build
git commit -m "Stop tracking build folder; server builds on deploy"
git push origin main
```

---

## Проверка после деплоя

На сервере (по SSH) или по логам в Actions:

```bash
pm2 status
pm2 logs remix --lines 10
pm2 logs api --err --lines 10
```

Если в логах remix нет ошибки про `@dnd-kit/core`, а в api нет `permission denied` для `email_send_jobs` (и GRANT на сервере уже делался) — всё ок.
