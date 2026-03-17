# STEP-12: Экспорт / Импорт / Сброс данных

## Зависимости

- **STEP-01**: Storage layer (все ключи).

## Scope

Раздел "Данные" в настройках: экспорт, импорт и полный сброс всех данных CRM.

## Функциональность

### Экспорт в JSON

Кнопка "📥 Экспорт JSON":

1. Загрузить ВСЕ данные из storage:
   - `spa-crm:salons`
   - `spa-crm:procedures:salon-1`, `spa-crm:procedures:salon-2`
   - `spa-crm:combos:salon-1`, `spa-crm:combos:salon-2`
   - Все ключи `spa-crm:bookings:*` (через `Storage.list`)
2. Собрать в один объект:
   ```json
   {
     "version": "v4",
     "exportDate": "2026-03-16T12:00:00Z",
     "salons": {...},
     "procedures": { "salon-1": [...], "salon-2": [...] },
     "combos": { "salon-1": [...], "salon-2": [...] },
     "bookings": { "salon-1:2026-03": [...], "salon-2:2026-03": [...], ... }
   }
   ```
3. Создать Blob → скачать как файл `spa-crm-backup-2026-03-16.json`.

```javascript
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Импорт из JSON

Кнопка "📤 Импорт JSON":

1. Открыть file input (скрытый `<input type="file" accept=".json">`).
2. Прочитать файл → JSON.parse.
3. Валидация: проверить наличие ключей `salons`, `procedures`, `combos`. Проверить `version`.
4. **Предупреждение:** "Импорт перезапишет ВСЕ текущие данные. Продолжить?" с кнопками "Да, импортировать" / "Отмена".
5. При подтверждении:
   - Удалить все текущие ключи `spa-crm:*`.
   - Записать все данные из импорта.
   - Перезагрузить state.
6. Toast "Данные импортированы".

### Сброс данных

Кнопка "🗑 Сброс":

1. **Двойное подтверждение:**
   - Первый клик: "Вы уверены? Это удалит ВСЕ данные." [Да / Нет]
   - Второй клик: "Это действие необратимо. Последний шанс." [Удалить всё / Отмена]
2. При подтверждении:
   - Удалить все ключи `spa-crm:*`.
   - Установить `needsOnboarding = true`.
   - Перейти на онбординг.
3. Toast "Все данные удалены".

## UI

В разделе "Данные" на экране настроек (под блоками салонов):

```
── Данные ──────────────────────────────────────
[📥 Экспорт JSON]   [📤 Импорт JSON]   [🗑 Сброс]
```

- "Экспорт" — secondary button (outlined gold).
- "Импорт" — secondary button.
- "Сброс" — danger button (красная). Визуально отделена от остальных (margin-left auto или на новой строке).

Модалка подтверждения: стандартный стиль (фон #1A2332, overlay, 400px ширина).

## Acceptance Criteria

- [ ] Экспорт скачивает JSON-файл со всеми данными.
- [ ] Файл содержит version, exportDate, salons, procedures, combos, bookings.
- [ ] Импорт: выбор файла → валидация → подтверждение → перезапись.
- [ ] Импорт невалидного файла → ошибка.
- [ ] Сброс: двойное подтверждение → удаление всех данных → онбординг.
- [ ] Toast-уведомления при каждом действии.
