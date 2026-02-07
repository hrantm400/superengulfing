import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useUser } from '../contexts/UserContext';

const ProtectedRoute: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { localizePath } = useLocale();
    const { profile } = useUser();

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            const loginPath = location.pathname.startsWith('/am') ? '/am/login' : '/login';
            navigate(loginPath, { replace: true });
            return;
        }
        if (!profile) return;
        const pathname = location.pathname;
        const userBase = profile.locale === 'am' ? '/am' : '';
        if (profile.locale === 'am') {
            if (pathname === '/dashboard' || (pathname.startsWith('/dashboard') && !pathname.startsWith('/am'))) {
                navigate('/am' + pathname, { replace: true });
            }
        } else {
            if (pathname.startsWith('/am/dashboard')) {
                navigate(pathname.replace(/^\/am/, '') || '/dashboard', { replace: true });
            }
        }
    }, [navigate, localizePath, location.pathname, profile]);

    if (!localStorage.getItem('auth_token')) {
        return null;
    }
    if (profile === null) {
        return null;
    }

    return <Outlet />;
};

export default ProtectedRoute;
