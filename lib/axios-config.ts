// lib/axios-config.ts
import https from 'https'
import axios from 'axios'

// Глобальная конфигурация axios для игнорирования SSL ошибок (только для разработки)
export const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Глобальный инстанс axios
export const apiClient = axios.create({
  httpsAgent,
  timeout: 30000,
})