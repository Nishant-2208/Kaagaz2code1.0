import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';

import App from './App';
import './index.css';


const rootElement =
  document.getElementById('root');


if (!rootElement) {
  throw new Error(
    'Kaagaz2Code: root element was not found.',
  );
}


const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID;


if (!googleClientId) {
  throw new Error(
    'Kaagaz2Code: VITE_GOOGLE_CLIENT_ID is not configured.',
  );
}


createRoot(rootElement).render(
  <StrictMode>
    <GoogleOAuthProvider
      clientId={googleClientId}
    >
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);