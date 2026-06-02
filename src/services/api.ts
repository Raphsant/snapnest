import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { getAuthToken } from './authService';

export const API_BASE_URL = 'http://10.0.0.174:3000';

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
      console.error('[API][Response Error]', error);
      return Promise.reject(error);
    },
  );
}
