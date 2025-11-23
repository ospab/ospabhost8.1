# Design System — ospab.host

## Обзор

Новая главная страница `/test` реализована с современным дизайном, следуя принципам minimalist dark theme с акцентом на скругленные края, плавные анимации и градиенты.

---

## Цветовая палитра

### Основные цвета

```css
/* Background */
--bg-primary: from-slate-900 via-blue-900 to-slate-900
--bg-secondary: bg-white/5 (backdrop-blur-sm)
--bg-card: bg-white/10

/* Text */
--text-primary: text-white
--text-secondary: text-gray-300
--text-muted: text-gray-400

/* Accent */
--accent-blue: #3B82F6 (blue-500)
--accent-purple: #9333EA (purple-600)
--accent-pink: #EC4899 (pink-400)

/* Gradient */
--gradient-primary: from-blue-600 to-purple-600
--gradient-text: from-blue-400 via-purple-400 to-pink-400
```

### Состояния

```css
/* Hover */
--hover-card: bg-white/10 + border-blue-500/50
--hover-button: shadow-2xl shadow-blue-500/50

/* Active/Focus */
--active-border: border-blue-500

/* Disabled */
--disabled-bg: bg-gray-700
--disabled-text: text-gray-500
```

---

## Типографика

### Размеры заголовков

```tsx
<h1> // Hero title
text-7xl md:text-8xl lg:text-9xl font-black

<h2> // Section titles
text-4xl md:text-5xl font-bold

<h3> // Card titles
text-xl md:text-2xl font-bold

<p> // Hero description
text-2xl md:text-3xl font-light

<p> // Body text
text-lg md:text-xl text-gray-400
```

### Шрифты

- **Primary**: System font stack (default)
- **Weight**: 
  - Light: 300 (hero descriptions)
  - Medium: 500 (navigation, labels)
  - Bold: 700 (section titles)
  - Black: 900 (hero title)

---

## Скругления (Border Radius)

### Стандартные значения

```css
/* Buttons, small cards */
rounded-xl (12px)
rounded-2xl (16px)

/* Large cards, sections */
rounded-3xl (24px)

/* Logo, icon containers */
rounded-2xl (16px)
```

### Правило применения

- Все интерактивные элементы имеют скругления **минимум 12px**
- Карточки и секции — **24px**
- Мелкие элементы (badges, pills) — **12-16px**

---

## Анимации

### Fade In Up

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage */
.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
  opacity: 0;
}
```

**Применение:**
- Hero секция
- Feature cards (с задержкой)
- Статистика (staggered delay)

### Gradient Animation

```css
@keyframes gradient-x {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x 3s ease infinite;
}
```

**Применение:**
- Hero title (ospab.host)
- Акцентные элементы

### Hover Effects

```tsx
// Scale + Shadow
hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/50

// Background change
hover:bg-white/20

// Border glow
hover:border-blue-500/50

// Transform
group-hover:scale-110 transition-transform duration-300
```

### Delays

```css
/* Staggered animations */
style={{ animationDelay: `${index * 100}ms` }}

.delay-1000 { animation-delay: 1s; }
.delay-2000 { animation-delay: 2s; }
```

---

## Компоненты

### Header

**Характеристики:**
- Фиксированная позиция (`fixed top-0`)
- Backdrop blur при скролле (`backdrop-blur-xl`)
- Плавный переход фона

```tsx
<header className={`fixed top-0 transition-all duration-500 ${
  scrolled ? 'bg-slate-900/95 backdrop-blur-xl shadow-2xl' : 'bg-transparent'
}`}>
```

**Элементы:**
- Logo (скругленный квадрат с градиентом)
- Navigation (hover: text-white)
- CTA button (rounded-xl, gradient на hover)

### Hero Section

**Структура:**
1. Main heading (огромный, с градиентом)
2. Subtitle (font-light, gray-300)
3. Description (текст с отступами)
4. CTA buttons (gradient + outline)
5. Stats grid (4 колонки)

**Анимации:**
- Весь блок: fade-in-up
- Статистика: staggered fade-in-up

### Feature Cards

**Дизайн:**
```tsx
<div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10
               hover:bg-white/10 hover:border-blue-500/50 
               hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105">
  <div className="text-5xl mb-4">🚀</div>
  <h3 className="text-xl font-bold">Мгновенный деплой</h3>
  <p className="text-gray-400">Описание...</p>
</div>
```

**Особенности:**
- Glassmorphism эффект (`backdrop-blur-sm`)
- Эмодзи иконки (5xl)
- Hover: scale + shadow + border glow
- Внутренний gradient glow на hover

### Pricing Cards

**Варианты:**
- Обычная: `border-white/10`
- Популярная: `border-blue-500 shadow-2xl shadow-blue-500/30`

**Элементы:**
- Badge "Популярный" (gradient, rounded-full)
- Цена (огромный текст)
- Список фич (зеленые галочки)
- CTA button (gradient для популярной)

### Footer

**Структура:**
- Logo + описание
- 4 колонки ссылок
- Bottom bar (copyright + links)

**Цвета:**
```tsx
bg-black/40 backdrop-blur-xl border-t border-white/10
```

### CTA Section

**Дизайн:**
```tsx
<div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12">
  {/* Background pattern с opacity-10 */}
  <div className="absolute inset-0 opacity-10">
    <div className="w-40 h-40 bg-white rounded-full blur-3xl"></div>
  </div>
  
  <h2 className="text-4xl md:text-5xl font-bold text-white">Готовы начать?</h2>
  <div className="flex gap-4">
    <button className="bg-white text-blue-600">Создать сервер</button>
    <button className="bg-transparent border-2 border-white">Связаться</button>
  </div>
</div>
```

---

## Background Effects

### Animated Particles

```tsx
<div className="fixed inset-0 overflow-hidden pointer-events-none">
  <div className="absolute top-20 left-20 w-72 h-72 
                  bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
  <div className="absolute bottom-20 right-20 w-96 h-96 
                  bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
  <div className="absolute top-1/2 left-1/2 w-64 h-64 
                  bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
</div>
```

**Характеристики:**
- `pointer-events-none` (не блокирует клики)
- Низкая opacity (10%)
- Большой blur (3xl = 64px)
- Анимация pulse с задержками

---

## Breakpoints

### Адаптивность

```css
/* Mobile First */
- Base: < 640px
md: >= 768px  (tablets)
lg: >= 1024px (desktops)
xl: >= 1280px (large screens)

/* Typography scaling */
text-7xl → md:text-8xl → lg:text-9xl

/* Grid changes */
grid-cols-2 → md:grid-cols-3 → lg:grid-cols-4

/* Padding adjustments */
p-8 → md:p-16
```

---

## Best Practices

### 1. Скругления везде
✅ Все элементы имеют `rounded-*`
❌ Никаких острых углов (кроме иконок SVG)

### 2. Transitions на все
```tsx
transition-all duration-300
transition-colors duration-300
transition-transform duration-500
```

### 3. Hover эффекты
Каждый интерактивный элемент имеет:
- `hover:scale-105` (легкое увеличение)
- `hover:shadow-*` (тень с цветом accent)
- `hover:bg-*/hover:border-*` (изменение фона/границы)

### 4. Glassmorphism
```tsx
bg-white/5 backdrop-blur-sm border border-white/10
```

### 5. Градиенты для акцентов
```tsx
// Buttons
bg-gradient-to-r from-blue-600 to-purple-600

// Text
bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent
```

### 6. Shadows с цветом
```tsx
// Не просто shadow-xl
// А shadow-2xl shadow-blue-500/50
hover:shadow-2xl hover:shadow-blue-500/50
```

### 7. Анимации с delays
```tsx
// Для списков
{items.map((item, index) => (
  <div 
    className="animate-fade-in-up"
    style={{ animationDelay: `${index * 100}ms` }}
  >
))}
```

---

## Структура страницы

```
<TestPage>
  ├── Background Particles (fixed, animated)
  ├── Header (fixed, scrolled state)
  ├── Hero Section
  │   ├── Main Heading (ospab.host with gradient)
  │   ├── Description
  │   ├── CTA Buttons
  │   └── Stats Grid (4 columns)
  ├── Features Section
  │   ├── Section Title
  │   └── Features Grid (6 cards, 3 columns)
  ├── Pricing Section
  │   ├── Section Title
  │   └── Pricing Cards (3 cards, 1 popular)
  ├── CTA Section (gradient background)
  └── Footer
      ├── Company Info + Links (4 columns)
      └── Bottom Bar (copyright + legal links)
</TestPage>
```

---

## Используемые технологии

- **React** 18
- **React Router** v6
- **Tailwind CSS** 3.x
- **TypeScript** 5.x

---

## Файлы

- `frontend/src/pages/test.tsx` — главная страница
- `frontend/src/App.tsx` — роутинг (добавлен `/test`)

---

## Следующие шаги

### Когда дизайн понравится:
1. Перенести компоненты из `/test` в `/` (index.tsx)
2. Создать отдельные компоненты:
   - `components/Hero.tsx`
   - `components/FeatureCard.tsx`
   - `components/PricingCard.tsx`
   - `components/CTASection.tsx`
3. Обновить остальные страницы в том же стиле
4. Создать тему в отдельном файле `theme.config.ts`

---

_Документ создан: 11 ноября 2025 г._
