# Деплой фикса PDF во втором письме

Во втором письме («Your PDF is ready - SuperEngulfing») теперь по умолчанию используется **оригинальный** PDF (Liquidity Sweep Cheatsheet), а не тестовый.

---

## 1. На своём компьютере (локально)

Закоммитить и запушить изменения:

```bash
cd C:\Users\hrant\Desktop\test2
git add server/index.cjs DEPLOY_PDF_FIX.md
git commit -m "fix: use original PDF link for second welcome email"
git push origin main
```

*(Если репозиторий на другой ветке — замени `main` на неё.)*

---

## 2. На сервере (VPS)

Подключись по SSH, затем выполни по порядку:

```bash
cd /var/www/superengulfing
git pull origin main
pm2 restart api
```

Проверка, что API поднялся:

```bash
pm2 status api
```

Должно быть `online`. После этого второе письмо будет вести на оригинальный PDF.

---

## Переменные .env (по желанию)

Файл **`/var/www/superengulfing/server/.env`** — не трогать, если уже настроен. Если хочешь явно задать ссылки:

- `PDF_LINK_EN` — английский PDF
- `PDF_LINK_AM` — армянский PDF

После правок `.env` снова: `pm2 restart api`.
