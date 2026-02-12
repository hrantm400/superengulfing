-- =============================================================================
-- Очистка данных пользователей/подписчиков ТОЛЬКО для БД SuperEngulfing
-- =============================================================================
-- ВАЖНО: Запускай ТОЛЬКО с указанием базы superengulfing_email:
--
--   sudo -u postgres psql -d superengulfing_email -f server/migrations/reset_user_data.sql
--
-- Или с сервера из /var/www/superengulfing:
--   sudo -u postgres psql -d superengulfing_email -f server/migrations/reset_user_data.sql
--
-- Другие базы (другие проекты) НЕ затрагиваются — команда применяется только
-- к той БД, которую ты указал в -d (superengulfing_email).
-- =============================================================================

BEGIN;

-- Порядок удаления: сначала дочерние таблицы (из-за внешних ключей)

-- Открытия писем (миграция 021)
DELETE FROM email_opens;

-- Клики по ссылкам в письмах
DELETE FROM email_clicks;

-- Лог отправленных писем
DELETE FROM email_log;

-- Очередь отправки (джобы)
DELETE FROM email_send_jobs;

-- Прогресс по видео (курсы)
DELETE FROM video_progress;

-- Записи на курсы
DELETE FROM enrollments;

-- Подписчики в цепочках
DELETE FROM subscriber_sequences;

-- Связь подписчик–тег
DELETE FROM subscriber_tags;

-- Подписчики (email-рассылки)
DELETE FROM subscribers;

-- Токены смены пароля
DELETE FROM set_password_tokens;

-- Заявки на доступ (Access page)
DELETE FROM access_requests;

-- Пользователи дашборда (логин после одобрения заявки)
DELETE FROM dashboard_users;

COMMIT;

-- Не трогаем: site_settings, admin_2fa_secrets, admin_pin_codes, tags,
-- templates, broadcasts, sequences, sequence_emails, sequence_triggers,
-- courses, lessons, lesson_resources — структура и контент остаются.
