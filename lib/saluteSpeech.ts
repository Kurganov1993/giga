export class SaluteSpeechError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message)
    this.name = 'SaluteSpeechError'
  }
}

export const handleSaluteSpeechError = (error: unknown): string => {
  if (error instanceof SaluteSpeechError) {
    switch (error.status) {
      case 401:
        return 'Ошибка авторизации SaluteSpeech. Проверьте Client ID и Secret.'
      case 403:
        return 'Доступ к SaluteSpeech API запрещен.'
      case 429:
        return 'Превышен лимит запросов к SaluteSpeech API.'
      default:
        return `Ошибка SaluteSpeech: ${error.message}`
    }
  }
  return 'Произошла неизвестная ошибка при синтезе речи.'
}