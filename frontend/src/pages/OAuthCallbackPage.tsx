import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser, storeTokens, storeUser } from '../api/services';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
      navigate('/login?oauth=failed', { replace: true });
      return;
    }
    storeTokens({ access_token, refresh_token });
    getCurrentUser().then((user) => {
      storeUser(user);
      navigate(user.role === 'admin' ? '/admin' : user.role === 'officer' ? '/upload' : user.role === 'reviewer' ? '/review' : '/lookup', { replace: true });
    }).catch(() => navigate('/login?oauth=failed', { replace: true }));
  }, [navigate, params]);

  return <div className="flex min-h-screen items-center justify-center text-sm">Completing Google sign-in…</div>;
}
