# Деплой на Amvera Cloud

Хостинг: [cloud.amvera.ru](https://cloud.amvera.ru). Документация: [docs.amvera.ru](https://docs.amvera.ru/).

Сборка идёт через окружение **Node.js (npm)**, не через Dockerfile: так обходится сбой Harbor (`INTERNAL_ERROR` при pull `node:*-alpine`).  
Приложение слушает порт **3000** (`amvera.yaml` → `run.containerPort`).

В панели Amvera:
- окружение: **node.js**, инструмент: **npm**, версия Node **22**;
- `containerPort`: **3000**;
- либо просто положите актуальный `amvera.yaml` в git и нажмите «Применить» / пересборку.

Dockerfile оставлен для Timeweb / локального `docker compose`.

---

## 1. Создание приложения

1. Войти в [личный кабинет Amvera](https://cloud.amvera.ru).
2. **Создать проект** → тип **Приложение**.
3. Выбрать тариф: для сборки Next.js рекомендуется минимум **1 ГБ RAM** (лучше 2 ГБ — `next build` прожорлив). На «Пробном» часто 503.
4. Подключить репозиторий GitHub (ваш форк или `KodBuster/Wentkompany`).
5. Ветка деплоя: **`main`** (по умолчанию Amvera ждёт `master` — смените в настройках).
6. Окружение: **node.js / npm / 22** (не docker), пока Harbor нестабилен.

---

## 2. Переменные окружения

В панели приложения → **Переменные** → «Добавить переменные или секрет».

| Переменная | Когда нужна | Где задаётся |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Заявки в Telegram | Панель Amvera (секрет) |
| `TELEGRAM_CHAT_ID` | Заявки в Telegram | Панель Amvera |
| `MAX_BOT_TOKEN` | Заявки в MAX | Панель Amvera (секрет) |
| `MAX_RECIPIENT_IDS` | Числовые user_id MAX через запятую | Панель Amvera |
| `CRM_WEBHOOK_URL` | CRM, если есть | Панель Amvera (секрет) |
| `NEXT_PUBLIC_SITE_URL` | metadata, sitemap, JSON-LD | **`amvera.build.env`** в git |
| `NEXT_PUBLIC_YM_ID` | Яндекс.Метрика | **`amvera.build.env`** в git |
| `ENABLE_HSTS` | Заголовок HSTS | **`amvera.build.env`** в git |

Важно: на Amvera переменные из панели **не доступны на этапе сборки** ([документация](https://docs.amvera.ru/applications/configuration/variables.html)).  
Публичные `NEXT_PUBLIC_*` и `ENABLE_HSTS` правятся в файле `amvera.build.env`, затем `git push` — Amvera пересоберёт образ.

Секреты (`TELEGRAM_*`, `MAX_*`, `CRM_*`) задаются только в панели и подхватываются при **запуске**. В git и `amvera.build.env` их не пишем. После изменения — перезапуск приложения.

---

## 3. Публичные переменные сборки

Отредактируйте `amvera.build.env` в корне репозитория:

```bash
NEXT_PUBLIC_SITE_URL=https://fortinox.ru
NEXT_PUBLIC_YM_ID=12345678
ENABLE_HSTS=0
```

После привязки домена и проверки HTTPS поставьте `ENABLE_HSTS=1`, закоммитьте и запушьте.

---

## 4. Деплой

```bash
git add amvera.build.env   # если меняли
git commit -m "deploy: update build env"
git push origin main
```

Amvera автоматически соберёт Docker-образ и запустит контейнер. Логи сборки и запуска — в панели приложения.

Проверка после деплоя:

```bash
curl -I https://<ваш-домен-amvera>/
curl https://<ваш-домен-amvera>/api/health
```

Ожидается `200` и `{"ok":true,...}`.

---

## 5. Свой домен

1. В Amvera: **Домены** → добавить `fortinox.ru` и `www.fortinox.ru`.
2. У регистратора: CNAME или A-запись по инструкции Amvera.
3. Дождаться SSL (Amvera выпускает сертификат автоматически).
4. Убедиться, что в `amvera.build.env` указан финальный `NEXT_PUBLIC_SITE_URL`.
5. Включить `ENABLE_HSTS=1`, пересобрать.

---

## 6. Картинки каталога

Пока фото товаров могут тянуться со старого `wentkompany.ru` (`next.config.ts` → `remotePatterns`).  
Перед переключением домена выполните локально:

```bash
npm run images
git add public/catalog src/data/catalog.json
git commit -m "assets: local catalog images"
git push
```

---

## 7. Чеклист перед продакшеном

- [ ] `amvera.build.env` — URL и `NEXT_PUBLIC_YM_ID` заполнены
- [ ] Telegram или CRM принимают тестовую заявку
- [ ] `src/lib/site.ts` — телефон, почта, юрлицо (не заглушки)
- [ ] Домен привязан, HTTPS работает
- [ ] `ENABLE_HSTS=1` после проверки сертификата
- [ ] `npm run check:redirects` — старые URL отдают 301 (на финальном домене)
- [ ] Конфигуратор: 3D, PDF, DXF, IFC скачиваются
- [ ] Яндекс.Вебмастер: sitemap отправлен

---

## Отличия от Timeweb

| | Timeweb | Amvera |
| --- | --- | --- |
| Оркестрация | docker compose + nginx вручную | Dockerfile + панель |
| SSL | certbot | автоматически в Amvera |
| `NEXT_PUBLIC_*` | build-args в compose | `amvera.build.env` в git |
| Секреты | файл `.env` на сервере | панель Amvera |
| Порт | 127.0.0.1:3000 → nginx | `containerPort: 3000` |

Подробная инструкция для VPS: [`docs/deploy.md`](deploy.md).
