import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from '@remix-run/react';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from '../locales';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { Menu, X, ChevronRight, Sparkles, LayoutDashboard, LogOut, Sun, Moon } from 'lucide-react';
import TelegramIcon from './icons/TelegramIcon';

// --- 3D Tilt Component (Visuals Only) ---
const TiltButton = ({ children, className, onClick, to, href }: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ['17.5deg', '-17.5deg']);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ['-17.5deg', '17.5deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;
    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Component = to ? Link : href ? 'a' : 'div';
  const props = to ? { to } : href ? { href } : { onClick };

  return (
    <Component
      {...props}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block ${className}`}
      style={{ perspective: 1000 }}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        className="relative transition-transform duration-100 ease-out"
      >
        {children}
      </motion.div>
    </Component>
  );
};

const SiteNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { locale, localizePath } = useLocale();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const telegramUrl = locale === 'am' ? 'https://t.me/+rXXH4RsfH08zMWZi' : 'https://t.me/+ek3QkeAz-NY5NDFi';

  // Scroll Animations with Physics
  const { scrollY } = useScroll();

  // Create a physics-based scroll value that lags slightly for smoothness
  // mass: weight of object (higher = slower start/stop)
  // stiffness: string tension (lower = looser)
  // damping: friction (higher = less oscillation)
  const smoothScroll = useSpring(scrollY, { mass: 0.1, stiffness: 50, damping: 10 });

  // 1. Dust Phase: Appears immediately but lingers longer (0-150px)
  const dustOpacity = useTransform(smoothScroll, [0, 50, 200], [0, 1, 0]);
  const dustScale = useTransform(smoothScroll, [0, 200], [1.1, 1]);

  // 2. Glass Phase: Smooth blur takes over very gradually (100-300px)
  const glassOpacity = useTransform(smoothScroll, [100, 300], [0, 1]);
  const glassBlur = useTransform(smoothScroll, [100, 300], [0, 16]);

  // 3. Border appears last and very softly (200-400px)
  const borderOpacity = useTransform(smoothScroll, [200, 400], [0, 1]);

  // Spotlight effect state
  const navRef = useRef<HTMLElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { profile, setProfile } = useUser();
  const isAuthenticated = !!profile;
  const userEmail = profile?.email ?? null;

  // Handle mouse move for spotlight
  const handleNavMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setProfile(null);
    navigate(localizePath('/login'));
  };

  const navLinks = [
    { path: '/', label: t('nav.home') },
    { path: '/course-access', label: t('nav.access') },
    { path: '/book', label: t('nav.book') },
  ];

  const faviconSrc = '/logo/se-favicon.png';

  return (
    <>
      <motion.nav
        ref={navRef}
        onMouseMove={handleNavMouseMove}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 group/nav h-14 md:h-16 pt-safe"
      >
        {/* --- DYNAMIC BACKGROUND LAYERS --- */}

        {/* 1. Dust/Grain Layer */}
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{
            opacity: dustOpacity,
            scale: dustScale,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        {/* 2. Glass Base Layer (Solid Color + Blur) */}
        <motion.div
          className="absolute inset-0 z-0 bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-xl transition-colors"
          style={{
            opacity: glassOpacity,
            backdropFilter: useTransform(glassBlur, (v) => `blur(${v}px)`)
          }}
        />

        {/* 3. Plasma Border (Bottom) */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden"
          style={{ opacity: borderOpacity }}
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        </motion.div>

        {/* Spotlight Overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-500 z-1"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${theme === 'dark' ? 'rgba(57, 255, 20, 0.04)' : 'rgba(22, 163, 74, 0.04)'}, transparent 40%)`
          }}
        />

        <div className="max-w-[1440px] mx-auto px-4 md:px-6 relative z-10 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo: favicon + styled SuperEngulfing text */}
            <Link
              to={localizePath('/')}
              className="group flex items-center gap-2.5 shrink-0"
            >
              <motion.img
                src={faviconSrc}
                alt=""
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="h-8 w-8 md:h-9 md:w-9 object-contain transition-transform duration-300 group-hover:scale-[1.05]"
              />
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="text-foreground font-bold text-lg md:text-xl tracking-tight select-none"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Super<span className="text-primary">Engulfing</span>
              </motion.span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const to = localizePath(link.path);
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={link.path}
                    to={to}
                    onMouseEnter={() => setHoveredPath(to)}
                    onMouseLeave={() => setHoveredPath(null)}
                    className={`relative px-5 py-2 text-sm font-medium transition-colors duration-200 ${isActive ? 'text-foreground' : 'text-muted hover:text-foreground'
                      }`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {link.label}
                      {link.label === 'Access' && isActive && <Sparkles size={14} className="text-primary" />}
                    </span>

                    {/* Active Underline */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavLine"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_10px_rgba(57,255,20,0.5)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}

                    {/* Hover Glow */}
                    {hoveredPath === to && !isActive && (
                      <motion.div
                        layoutId="hoverNavGlow"
                        className="absolute inset-0 bg-neutral-100/50 dark:bg-white/5 rounded-lg -z-10"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-3">
              {!isAuthenticated && !location.pathname.includes('admin2admin10') && (
                <Link
                  to={locale === 'am' ? (location.pathname.replace(/^\/am/, '') || '/') : `/am${location.pathname}`}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border bg-surface/80 hover:bg-surface hover:border-primary/30 text-muted hover:text-foreground transition-colors"
                >
                  {locale === 'am' ? 'EN' : 'AM'}
                </Link>
              )}
              {isAuthenticated && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tg-btn text-xs font-semibold"
                >
                  <span className="svg-wrapper flex items-center">
                    <TelegramIcon size={18} className="shrink-0" />
                  </span>
                  <span>Telegram</span>
                </a>
              )}
              <button
                onClick={() => toggleTheme()}
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/10 transition-all duration-300 active:scale-90"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {isAuthenticated ? (
                <>
                  <TiltButton to={localizePath('/dashboard')} className="cursor-pointer">
                    <div className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-semibold hover:border-primary/50 hover:text-primary hover:bg-white/10 transition-all flex items-center gap-2">
                      <LayoutDashboard size={14} />
                      {t('nav.dashboard')}
                    </div>
                  </TiltButton>
                  <button
                    onClick={() => handleLogout()}
                    className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                    title={t('nav.logout')}
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <TiltButton to={localizePath('/login')} className="cursor-pointer">
                  <div className="px-5 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 font-semibold text-xs hover:bg-primary hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(57,255,20,0.1)] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                    {t('nav.login')}
                  </div>
                </TiltButton>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden relative z-50 min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-foreground active:scale-90 transition-transform"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                  >
                    <X size={24} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ scale: 0, rotate: 90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: -90 }}
                  >
                    <Menu size={24} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-2xl md:hidden flex flex-col pt-nav-safe px-4 sm:px-6"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link, idx) => {
                const to = localizePath(link.path);
                return (
                  <motion.div
                    key={link.path}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 + idx * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                  >
                    <Link
                      to={to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block text-3xl font-black tracking-tighter ${location.pathname === to ? 'text-primary' : 'text-foreground'}`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}

              <motion.div
                className="w-full h-px bg-gradient-to-r from-transparent via-neutral-200 dark:via-white/20 to-transparent my-4"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3 }}
              />

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col gap-4"
              >
                {isAuthenticated && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="tg-btn w-full justify-center text-sm font-semibold"
                  >
                    <span className="svg-wrapper flex items-center">
                      <TelegramIcon size={20} />
                    </span>
                    <span>Telegram</span>
                  </a>
                )}
                {isAuthenticated ? (
                  <>
                    <Link
                      to={localizePath('/dashboard')}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between p-4 rounded-xl bg-neutral-100 dark:bg-white/5 active:scale-95 transition-transform border border-transparent focus:border-primary"
                    >
                      <span className="font-semibold flex items-center gap-3">
                        <LayoutDashboard className="text-primary" /> {t('nav.dashboard')}
                      </span>
                      <ChevronRight className="text-muted" />
                    </Link>
                    <button
                      onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                      className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 text-red-500 active:scale-95 transition-transform"
                    >
                      <span className="font-semibold flex items-center gap-3">
                        <LogOut /> {t('nav.logout')}
                      </span>
                    </button>
                  </>
                ) : (
                  <Link
                    to={localizePath('/login')}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center p-4 rounded-xl bg-primary text-black font-bold text-lg shadow-[0_0_20px_rgba(57,255,20,0.3)] active:scale-95 transition-transform"
                  >
                    {t('nav.loginAccess')}
                  </Link>
                )}

                {!isAuthenticated && !location.pathname.includes('admin2admin10') && (
                <Link
                  to={locale === 'am' ? (location.pathname.replace(/^\/am/, '') || '/') : `/am${location.pathname}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-white/10 active:bg-white/5"
                >
                  <span className="text-muted font-medium">{locale === 'am' ? 'English' : 'Հայերեն'}</span>
                  <span className="text-primary font-bold">{locale === 'am' ? 'EN' : 'AM'}</span>
                </Link>
              )}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-white/10 mt-2 active:bg-white/5"
                >
                  <span className="text-muted font-medium">{t('nav.switchTheme')}</span>
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SiteNavbar;
