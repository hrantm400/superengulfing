import { useEffect } from 'react';
import { useLocation } from '@remix-run/react';

/** Scrolls window to top on route change (e.g. when opening Terms/Privacy/Disclaimer from footer). */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
