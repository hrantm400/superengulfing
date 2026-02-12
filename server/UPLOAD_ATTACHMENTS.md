# Загрузка фото и документов в письма (как в Gmail)

## API загрузки

**POST /api/upload** (только для админа, заголовок `Authorization: Bearer <admin_jwt>`)

- **Content-Type:** `multipart/form-data`
- **Поле:** `file` (один файл за запрос)
- **Лимит:** 15 МБ на файл
- **Ответ:** `{ "url": "https://your-api.com/uploads/123-filename.pdf", "path": "uploads/123-filename.pdf", "filename": "filename.pdf" }`

Файлы сохраняются в папку `server/uploads/`. По адресу `API_URL/uploads/имя_файла` они отдаются как статика (картинки можно вставлять в тело письма через `<img src="...">`).

## Вложения в рассылке (Broadcast)

При создании и обновлении рассылки можно передать массив вложений:

- **POST /api/broadcasts** — в теле: `attachments: [ { "filename": "doc.pdf", "path": "uploads/123-doc.pdf" } ]`
- **PUT /api/broadcasts/:id** — то же поле `attachments`

При отправке рассылки эти файлы добавляются к каждому письму как вложения (как в Gmail).

## Вложения в шаге цепочки (Sequence email)

- **POST /api/sequences/:id/emails** — в теле: `attachments: [ { "filename": "file.pdf", "path": "uploads/456-file.pdf" } ]`
- **PUT /api/sequences/:seqId/emails/:emailId** — то же поле `attachments`

Формат тот же: массив объектов с `filename` (имя в письме) и `path` (относительный путь, как вернул `/api/upload`).

## Как сделать в админке

1. **Кнопка «Загрузить файл»:** выбор файла → `FormData` с полем `file` → запрос на `POST /api/upload` с тем же `Authorization`, что и остальные запросы админки.
2. Из ответа взять `url` и `path`, `filename`.
3. **Картинки:** вставить в HTML письма, например: `<img src="${url}" alt="" />` (использовать `url` из ответа).
4. **Документы (вложения):** добавить объект `{ filename, path }` в массив `attachments` рассылки или шага цепочки и сохранить broadcast/sequence email как обычно (с полем `attachments` в теле запроса).

Можно держать в состоянии массив вложений и при сохранении рассылки/шага отправлять его в поле `attachments`.
