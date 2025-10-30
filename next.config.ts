import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   experimental: {
    appDir: true,
  },
  // Для продакшена
  env: {
    GIGACHAT_CLIENT_ID: process.env.GIGACHAT_CLIENT_ID,
    GIGACHAT_CLIENT_SECRET: process.env.GIGACHAT_CLIENT_SECRET,
  },
  // Увеличиваем таймауты для API запросов
  serverRuntimeConfig: {
    apiTimeout: 30000,
  },
  publicRuntimeConfig: {
    apiBaseUrl: process.env.API_BASE_URL || '',
  },
}

export default nextConfig;
