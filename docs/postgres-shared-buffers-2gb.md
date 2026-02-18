# PostgreSQL: поднять shared_buffers до 2 GB

Выполнить **на сервере** (где крутится Postgres).

## 1. Найти конфиг

```bash
sudo -u postgres psql -d superengulfing_email -c "SHOW config_file;"
```

Обычно путь: `/etc/postgresql/16/main/postgresql.conf` (или 15/main — смотри вывод команды выше).

## 2. Открыть конфиг и поставить 2 GB

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Найди строку `shared_buffers` (поиск: Ctrl+W). Поставь:

```
shared_buffers = '2GB'
```

Если строка закомментирована (`# shared_buffers = ...`), убери `#` в начале. Сохрани (Ctrl+O, Enter, Ctrl+X).

## 3. Перезапустить Postgres

```bash
sudo systemctl restart postgresql
```

## 4. Проверить

```bash
sudo -u postgres psql -d superengulfing_email -c "SHOW shared_buffers;"
```

Должно быть: `2GB`.

---

**Примечание:** 2 GB — нормально для сервера с 11+ GB RAM. После апгрейда до 24 GB можно оставить 2 GB или поднять до 4 GB.
