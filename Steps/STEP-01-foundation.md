# STEP-01: Foundation — Storage, Data Structures, App Shell

## Зависимости

Нет. Это первый шаг.

## Scope

Создать скелет single-file React JSX артефакта с:

1. **Storage layer** — обёртка над `window.storage` API.
2. **Все типы данных** (Salon, Room, Procedure, ComboPackage, Booking).
3. **Default-данные** (начальная конфигурация салонов, стандартные процедуры).
4. **App shell** — header + tab bar + content area + переключатель салонов.
5. **Роутинг по табам** (useState для activeTab).
6. **Глобальный state** (salons, procedures, combos, bookings, activeSalonId).

## Детали реализации

### Storage Layer

```javascript
const Storage = {
  async get(key) {
    try {
      const result = await window.storage.get(key);
      return result ? JSON.parse(result.value) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      await window.storage.set(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  async delete(key) {
    try {
      await window.storage.delete(key);
      return true;
    } catch { return false; }
  },
  async list(prefix) {
    try {
      const result = await window.storage.list(prefix);
      return result?.keys || [];
    } catch { return []; }
  }
};
```

### Ключи storage:

```
spa-crm:salons
spa-crm:procedures:salon-1
spa-crm:procedures:salon-2
spa-crm:combos:salon-1
spa-crm:combos:salon-2
spa-crm:bookings:salon-1:YYYY-MM
spa-crm:bookings:salon-2:YYYY-MM
```

### Default Salon Config:

```javascript
const DEFAULT_SALONS = [
  {
    id: "salon-1",
    name: "Салон 1",
    rooms: [
      { id: "room-1", name: "Кабинка 1", beds: 2 },
      { id: "room-2", name: "Кабинка 2", beds: 1 },
      { id: "room-3", name: "Кабинка 3", beds: 2 }
    ],
    therapistCount: 6,
    hasSauna: true,
    saunaCapacity: 4,
    hasPeeling: true,
    peelingMaxPerHour: 4,
    peelingMastersMax: 2,
    peelingTimePerPerson: 30,
    saunaDuration: 60,
    workStart: "10:00",
    workEnd: "22:00",
    dayOff: "monday",
    bufferMinutes: 15
  },
  // salon-2 аналогично
];
```

### Default Procedures (11 штук на салон):

Тайский 1ч/1.5ч/2ч, Ойл 1ч/1.5ч/2ч, Массаж в 4 руки 1ч/1.5ч/2ч, Сауна, Пиллинг. См. таблицу в master-спеке §1.3.

### App Shell — Layout:

```
┌──────────────────────────────────────────────────────────┐
│  HEADER (56px, fixed, bg #141B24, border-bottom #2A3A4E) │
│  [◈ SPA CRM]          [Салон 1 | Салон 2]    [16 марта]  │
├──────────────────────────────────────────────────────────┤
│  TAB BAR (44px, fixed under header)                      │
│  [Расписание] [Услуги и цены] [Дашборд] [Журнал] [⚙]   │
├──────────────────────────────────────────────────────────┤
│  CONTENT (остаток высоты, overflow-y auto)               │
│  padding: 24px, max-width: 1400px, margin: 0 auto       │
└──────────────────────────────────────────────────────────┘
```

### UI-спецификация для этого шага:

**Палитра:**
- Фон основной: #0F1419
- Header/tabs: #141B24
- Линии: #2A3A4E
- Текст: #E8E0D6 (основной), #8A9AAE (вторичный)
- Акцент: #D4A84B (золотой), hover #E6BE6A
- Активный таб: текст #D4A84B + underline 2px золотой
- Переключатель салонов: active = фон #D4A84B текст #0F1419, inactive = transparent + border

**Логотип:** символ ◈ + текст "SPA CRM". Lucide-icon: `Gem` или `Sparkles`.

**Табы:** 5 штук. "Настройки" = иконка Settings из lucide-react.

### Загрузка при старте:

1. `useEffect` на mount → загрузить `spa-crm:salons`.
2. Если нет — показать состояние `needsOnboarding = true` (заглушка, онбординг в STEP-02).
3. Если есть — загрузить procedures, combos, bookings текущего месяца.
4. Пока грузится — loading spinner.

## Acceptance Criteria

- [ ] Артефакт рендерится без ошибок.
- [ ] Header с логотипом, переключателем салонов, датой.
- [ ] Tab bar с 5 табами, переключение работает.
- [ ] Активный таб подсвечен золотым + underline.
- [ ] Переключатель салонов работает (меняет activeSalonId).
- [ ] Storage layer: get/set/delete/list обёрнуты в try/catch.
- [ ] При отсутствии данных в storage — показывает заглушку "Требуется настройка".
- [ ] Цвета соответствуют палитре.
- [ ] Все типы данных определены как JSDoc/комментарии в коде.
