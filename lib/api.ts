import axios, { type InternalAxiosRequestConfig } from 'axios';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign(new URL('/', window.location.href).toString());
  }
}

const publicApi = axios.create({
  baseURL: '/api/backend',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

publicApi.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;

    const request = error.config as RetryConfig | undefined;
    if (error.response?.status !== 401 || !request) throw error;

    if (request._retry) {
      redirectToLogin();
      throw error;
    }

    request._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios.post('/api/auth/refresh')
          .then(() => undefined)
          .finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('session-refreshed'));
      }
      return await publicApi.request(request);
    } catch (refreshError) {
      redirectToLogin();
      throw refreshError;
    }
  },
);

export async function logoutSession() {
  await publicApi.post('/api/auth/logout', null, { baseURL: '' });
}

export default publicApi;
