import * as SecureStore from 'expo-secure-store';

const tokenKey = 'logistics-access-token';
export const setAccessToken = (token: string) => SecureStore.setItemAsync(tokenKey, token);
export const clearAccessToken = () => SecureStore.deleteItemAsync(tokenKey);

export async function api(path: string, init: RequestInit = {}) {
  const token = await SecureStore.getItemAsync(tokenKey);
  return fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${path}`, {
    ...init, headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
