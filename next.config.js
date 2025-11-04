/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Добавьте это для проверки, что переменные доступны
    SALUTE_SPEECH_CLIENT_ID: process.env.SALUTE_SPEECH_CLIENT_ID,
    SALUTE_SPEECH_CLIENT_SECRET: process.env.SALUTE_SPEECH_CLIENT_SECRET,
  },
}

module.exports = nextConfig