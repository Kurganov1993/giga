/**
 * Утилиты для работы с русским языком и кириллицей
 * 
 * @remarks
 * Функции для нормализации, валидации и форматирования русского текста
 * с учетом особенностей кириллицы и требований GigaChat API
 */

// Константы
const MAX_TEXT_LENGTH = 4000
const RUSSIAN_LETTERS_PATTERN = /[а-яА-Я]/g
const RUSSIAN_TEXT_DETECTION_PATTERN = /[а-яА-ЯёЁ]/
const MULTIPLE_SPACES_PATTERN = /\s+/g

// Типы для результатов валидации
interface TextValidationResult {
  isValid: boolean
  errors: string[]
  normalizedText?: string
}

interface CyrillicAnalysis {
  totalChars: number
  cyrillicChars: number
  cyrillicPercentage: number
  hasCyrillic: boolean
  isPrimarilyCyrillic: boolean
}

/**
 * Нормализация русского текста с обработкой различных сценариев
 * 
 * @param text - Исходный текст для нормализации
 * @param options - Опции нормализации
 * @returns Нормализованный текст
 * 
 * @example
 * normalizeRussianText('  Привет, мир!  ') // 'Привет, мир!'
 * normalizeRussianText('ёлка') // 'елка'
 */
export function normalizeRussianText(
  text: string, 
  options: {
    preserveYo?: boolean
    removeExtraSpaces?: boolean
    trim?: boolean
  } = {}
): string {
  const {
    preserveYo = false,
    removeExtraSpaces = true,
    trim = true
  } = options

  if (typeof text !== 'string') {
    console.warn('normalizeRussianText: expected string, got', typeof text)
    return ''
  }

  let normalized = text

  // Нормализация Unicode (объединение символов с диакритиками)
  normalized = normalized.normalize('NFC')

  // Замена ё на е (если не указано сохранять)
  if (!preserveYo) {
    normalized = normalized.replace(/ё/g, 'е').replace(/Ё/g, 'Е')
  }

  // Удаление лишних пробелов
  if (removeExtraSpaces) {
    normalized = normalized.replace(MULTIPLE_SPACES_PATTERN, ' ')
  }

  // Обрезка пробелов по краям
  if (trim) {
    normalized = normalized.trim()
  }

  return normalized
}

/**
 * Подсчет кириллических символов в тексте
 * 
 * @param text - Текст для анализа
 * @returns Объект с детальной статистикой по кириллице
 * 
 * @example
 * countCyrillicChars('Hello мир!') // { cyrillicChars: 3, ... }
 */
export function analyzeCyrillicText(text: string): CyrillicAnalysis {
  if (typeof text !== 'string') {
    return {
      totalChars: 0,
      cyrillicChars: 0,
      cyrillicPercentage: 0,
      hasCyrillic: false,
      isPrimarilyCyrillic: false
    }
  }

  const totalChars = text.length
  const cyrillicMatches = text.match(RUSSIAN_LETTERS_PATTERN)
  const cyrillicChars = cyrillicMatches ? cyrillicMatches.length : 0
  const cyrillicPercentage = totalChars > 0 ? (cyrillicChars / totalChars) * 100 : 0

  return {
    totalChars,
    cyrillicChars,
    cyrillicPercentage,
    hasCyrillic: cyrillicChars > 0,
    isPrimarilyCyrillic: cyrillicPercentage > 50
  }
}

// Упрощенная версия для обратной совместимости
export function countCyrillicChars(text: string): number {
  return analyzeCyrillicText(text).cyrillicChars
}

/**
 * Проверка наличия русского текста
 * 
 * @param text - Текст для проверки
 * @param threshold - Минимальный процент кириллицы для определения "русскости"
 * @returns true если текст содержит кириллицу
 * 
 * @example
 * hasRussianText('Hello world') // false
 * hasRussianText('Привет мир') // true
 * hasRussianText('Hello мир', 30) // true (33% кириллицы)
 */
export function hasRussianText(text: string, threshold: number = 0): boolean {
  if (typeof text !== 'string' || !text.trim()) {
    return false
  }

  if (threshold <= 0) {
    return RUSSIAN_TEXT_DETECTION_PATTERN.test(text)
  }

  const analysis = analyzeCyrillicText(text)
  return analysis.cyrillicPercentage >= threshold
}

/**
 * Валидация текста для отправки в GigaChat
 * 
 * @param text - Текст для валидации
 * @returns Результат валидации с ошибками и нормализованным текстом
 * 
 * @example
 * validateTextForGigaChat('') // { isValid: false, errors: ['Текст не может быть пустым'] }
 */
export function validateTextForGigaChat(text: string): TextValidationResult {
  const errors: string[] = []

  if (typeof text !== 'string') {
    errors.push('Текст должен быть строкой')
    return { isValid: false, errors }
  }

  if (!text.trim()) {
    errors.push('Текст не может быть пустым')
    return { isValid: false, errors }
  }

  if (text.length > MAX_TEXT_LENGTH) {
    errors.push(`Текст слишком длинный. Максимум ${MAX_TEXT_LENGTH} символов`)
  }

  // Проверяем на наличие только пробельных символов
  if (/^\s+$/.test(text)) {
    errors.push('Текст не может состоять только из пробелов')
  }

  // Проверяем на наличие неподдерживаемых символов
  const invalidChars = text.match(/[^\p{L}\p{N}\p{P}\p{Z}\n\r\t]/gu)
  if (invalidChars) {
    errors.push(`Текст содержит неподдерживаемые символы: ${invalidChars.slice(0, 5).join(', ')}`)
  }

  const normalizedText = normalizeRussianText(text)
  
  return {
    isValid: errors.length === 0,
    errors,
    normalizedText: errors.length === 0 ? normalizedText : undefined
  }
}

/**
 * Форматирование текста для отправки в GigaChat
 * 
 * @param text - Исходный текст
 * @param options - Опции форматирования
 * @returns Отформатированный и нормализованный текст
 * 
 * @example
 * formatForGigaChat('  Привет,   мир!  ') // 'Привет, мир!'
 */
export function formatForGigaChat(
  text: string, 
  options: {
    maxLength?: number
    preserveYo?: boolean
  } = {}
): string {
  const {
    maxLength = MAX_TEXT_LENGTH,
    preserveYo = false
  } = options

  const validation = validateTextForGigaChat(text)
  
  if (!validation.isValid) {
    console.warn('Text validation failed:', validation.errors)
    
    // Возвращаем безопасную версию текста даже при ошибках
    const safeText = typeof text === 'string' ? text : String(text)
    return normalizeRussianText(safeText, { preserveYo })
      .replace(MULTIPLE_SPACES_PATTERN, ' ')
      .trim()
      .substring(0, maxLength)
  }

  // Используем нормализованный текст из валидации
  let formatted = validation.normalizedText!

  // Обрезаем до максимальной длины (сохраняя целые слова если возможно)
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength)
    
    // Пытаемся обрезать по последнему пробелу
    const lastSpaceIndex = formatted.lastIndexOf(' ')
    if (lastSpaceIndex > maxLength * 0.8) { // Если пробел в последних 20%
      formatted = formatted.substring(0, lastSpaceIndex)
    }
    
    formatted = formatted.trim() + '...'
  }

  return formatted
}

/**
 * Транслитерация русского текста в латиницу
 * 
 * @param text - Русский текст для транслитерации
 * @returns Текст в латинице
 * 
 * @example
 * transliterateToLatin('Привет мир') // 'Privet mir'
 */
export function transliterateToLatin(text: string): string {
  const translitMap: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  }

  return text.replace(/[а-яА-ЯёЁ]/g, char => translitMap[char] || char)
}

// Экспорт констант для использования в других модулях
export { MAX_TEXT_LENGTH }