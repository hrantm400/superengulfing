-- =============================================================================
-- ПОЛНАЯ ОЧИСТКА ТЕСТОВЫХ ДАННЫХ — запуск перед продакшном
-- =============================================================================
--
-- Удаляет: платежи, ордера, подписчики, броадкасты, enrollments,
--          access requests, dashboard users, email логи
--
-- НЕ ТРОГАЕТ: sequences, sequence_emails, sequence_triggers,
--             courses, lessons, lesson_resources,
--             tags, templates, site_settings, admin_2fa_secrets,
--             admin_pin_codes, blocked_email_domains,
--             usdt_deposit_addresses (адреса сбрасываем в 'free')
--
-- Запуск на сервере:
--   sudo -u postgres psql -d superengulfing_email -f server/migrations/reset_all_test_data.sql
--
-- Или из папки проекта:
--   cd /var/www/superengulfing
--   sudo -u postgres psql -d superengulfing_email -f server/migrations/reset_all_test_data.sql
-- =============================================================================

BEGIN;

-- ─── 1. EMAIL / ANALYTICS ───────────────────────────────────────────────────
DELETE FROM email_opens;
DELETE FROM email_clicks;
DELETE FROM email_log;
DELETE FROM email_send_jobs;

-- ─── 2. PAYMENTS ────────────────────────────────────────────────────────────
DELETE FROM course_payments;
DELETE FROM usdt_orders;
DELETE FROM payment_issue_reports;

-- Reset deposit addresses to 'free' so they can be reused
UPDATE usdt_deposit_addresses
   SET status = 'free', assigned_at = NULL, last_used_at = NULL;

-- ─── 3. COURSES (progress only, NOT structure) ─────────────────────────────
DELETE FROM video_progress;
DELETE FROM enrollments;

-- ─── 4. BROADCASTS (удаляем все тестовые рассылки) ──────────────────────────
DELETE FROM broadcasts;

-- ─── 5. SUBSCRIBERS ─────────────────────────────────────────────────────────
DELETE FROM subscriber_sequences;
DELETE FROM subscriber_tags;
DELETE FROM subscribers;

-- ─── 6. USERS / ACCESS ─────────────────────────────────────────────────────
DELETE FROM set_password_tokens;
DELETE FROM access_requests;
DELETE FROM dashboard_users;

COMMIT;

-- ─── Что ОСТАЛОСЬ нетронутым: ───────────────────────────────────────────────
-- sequences              — автоматические email-цепочки (структура)
-- sequence_emails         — шаги цепочек
-- sequence_triggers       — триггеры (тег → цепочка)
-- courses                 — курсы
-- lessons                 — уроки
-- lesson_resources        — ресурсы уроков
-- tags                    — теги
-- templates               — шаблоны писем
-- site_settings           — настройки сайта
-- admin_2fa_secrets       — 2FA админки
-- admin_pin_codes         — PIN-коды админки
-- blocked_email_domains   — заблокированные домены
-- usdt_deposit_addresses  — адреса кошельков (сброшены в free)
