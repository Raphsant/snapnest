import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

import { getAuthToken } from './authService';

const BACKEND_PORT = 3000;

/** Fallback when Metro host can't be inferred (update if you use a fixed LAN IP). */
const FALLBACK_DEV_API_HOST = '10.0.0.25';

function resolveDevApiHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;

  const host = hostUri?.split(':')[0]?.trim();
  if (host && host.length > 0) {
    return host;
  }

  return FALLBACK_DEV_API_HOST;
}

const resolvedBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${resolveDevApiHost()}:${BACKEND_PORT}` : undefined);

if (!resolvedBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not set for this build');
}

export const API_BASE_URL: string = resolvedBaseUrl;

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

/** Attach Cognito ID token for all backend requests */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const token = await getAuthToken();
    if (!token) {
      return Promise.reject(
        new Error('Not authenticated — sign in again. Your session may have expired.'),
      );
    }
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

if (__DEV__) {
  console.log('[API] baseURL:', API_BASE_URL);

  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      console.log('[API][Request]', {
        method: config.method,
        url: `${config.baseURL ?? ''}${config.url ?? ''}`,
        data: config.data,
      });
      return config;
    },
    (error: unknown) => {
      console.error('[API][Request Error]', error);
      return Promise.reject(error);
    },
  );

  apiClient.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
      console.log('[API][Response]', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
      return response;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        console.error('[API][Response Error]', {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
        });
      } else {
        console.error('[API][Response Error]', error);
      }
      return Promise.reject(error);
    },
  );
}
