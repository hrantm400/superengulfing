# Certificate step — animated typewriter (English)

Кусок кода, где после ввода имени показывается анимированная строка «I, **Name**, declare the following:» и посимвольно печатается декларация. Локали захардкожены для английского.

---

## 1. English strings (for reference)

```js
// First line: "I, " + firstName + ", declare the following:"
const CERT_DECLARE_PREFIX = "I, ";
const CERT_DECLARE_SUFFIX = ", declare the following:";

// Declaration lines (11 lines)
const DECLARATION_LINES_EN = [
  "I am done getting stopped out.",
  "I am done watching price move without me.",
  "I am done being the exit liquidity.",
  "Today, I choose a different path.",
  "I will learn to see what Smart Money sees.",
  "I will wait for the trap to complete before I strike.",
  "I will trade with patience, discipline, and precision.",
  "I will follow my rules, not emotions.",
  "I will not quit when it gets hard.",
  "I will become consistently profitable.",
  "This is not a hope. This is a decision.",
];
const DECLARATION_FULL = DECLARATION_LINES_EN.join("\n");
```

---

## 2. State and typewriter logic (React)

```tsx
const [firstLineDone, setFirstLineDone] = useState(false);
const [visibleChars, setVisibleChars] = useState(0);
const [declarationChars, setDeclarationChars] = useState(0);

const firstLine = CERT_DECLARE_PREFIX + firstName + CERT_DECLARE_SUFFIX;
const declarationComplete = firstLineDone && declarationChars >= DECLARATION_FULL.length;

// Typewriter: first line (with name)
useEffect(() => {
  if (visibleChars >= firstLine.length) {
    setFirstLineDone(true);
    return;
  }
  const speed = Math.random() * 28 + 22;
  const timeout = setTimeout(() => {
    setVisibleChars((prev) => prev + 1);
    // playTypewriterTick(); // optional sound
  }, speed);
  return () => clearTimeout(timeout);
}, [visibleChars, firstLine.length, firstLine]);

// Typewriter: declaration lines
useEffect(() => {
  if (!firstLineDone || declarationChars >= DECLARATION_FULL.length) return;
  const speed = Math.random() * 26 + 20;
  const timeout = setTimeout(() => {
    setDeclarationChars((prev) => prev + 1);
    // playTypewriterTick();
  }, speed);
  return () => clearTimeout(timeout);
}, [firstLineDone, declarationChars, DECLARATION_FULL.length]);
```

---

## 3. JSX — animated first line + blinking cursor

```tsx
<p className="text-lg md:text-xl text-slate-200 leading-relaxed max-w-2xl mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
  <span className="text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(245,158,11,0.2)]">
    {firstLine.substring(0, visibleChars)}
  </span>
  {!firstLineDone && (
    <motion.span
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      className="inline-block w-0.5 h-6 bg-amber-400 ml-1 align-middle rounded-full"
      style={{ boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)' }}
    />
  )}
</p>
```

---

## 4. JSX — declaration text (appears after first line is done)

```tsx
{firstLineDone && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="text-left w-full max-w-2xl space-y-1.5 text-slate-300 text-sm md:text-base"
    style={{ fontFamily: 'Playfair Display, serif' }}
  >
    {DECLARATION_FULL.substring(0, declarationChars).split('\n').map((line, i) => (
      <motion.p
        key={i}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={(i === 3 || i === 10) ? 'text-amber-400/95 font-medium' : ''}
      >
        {line}
      </motion.p>
    ))}
    {declarationChars < DECLARATION_FULL.length && (
      <motion.span
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 align-middle rounded-full"
        style={{ boxShadow: '0 0 6px rgba(245, 158, 11, 0.5)' }}
      />
    )}
  </motion.div>
)}
```

---

## Summary

- **firstLine** = `"I, " + firstName + ", declare the following:"` — печатается посимвольно (`visibleChars`).
- После окончания первой строки печатается **DECLARATION_FULL** посимвольно (`declarationChars`), разбитая по `\n` на параграфы.
- Мигающий курсор — `motion.span` с `animate={{ opacity: [1, 0.4, 1] }}` (или `[1, 0.35, 1]` для декларации).
- Компонент из проекта: `src/components/onboarding/CertificateStep.tsx` (там же используется `t('onboarding.declaration1')` и т.д.; здесь приведены английские строки явно).
