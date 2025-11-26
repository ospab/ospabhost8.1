import axios from 'axios';

/**
 * Cloudflare API для проверки файлов
 * Использует VirusTotal через Cloudflare Gateway
 */

export interface FileScanResult {
  isSafe: boolean;
  detections: number;
  vendor: string;
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN';
  hash: string;
  lastAnalysisStats?: {
    malicious: number;
    suspicious: number;
    undetected: number;
  };
}

const CLOUDFLARE_GATEWAY_URL = process.env.CLOUDFLARE_GATEWAY_URL || '';
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || '';

/**
 * Сканирует файл на вирусы через VirusTotal API
 * @param fileBuffer - Буфер файла
 * @param fileName - Имя файла
 * @returns Результат сканирования
 */
export async function scanFileWithVirusTotal(
  fileBuffer: Buffer,
  fileName: string,
): Promise<FileScanResult> {
  if (!VIRUSTOTAL_API_KEY) {
    console.warn('[FileScanner] VirusTotal API key не настроена');
    return {
      isSafe: true,
      detections: 0,
      vendor: 'VirusTotal',
      verdict: 'UNKNOWN',
      hash: '',
    };
  }

  try {
    // Вычисляем SHA-256 хеш файла для проверки
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Сначала проверим по хешу (быстрый способ)
    const hashCheckResponse = await axios.get(
      `https://www.virustotal.com/api/v3/files/${hash}`,
      {
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
        },
      },
    );

    const analysisStats = hashCheckResponse.data.data.attributes.last_analysis_stats;
    const maliciousCount = analysisStats.malicious || 0;
    const suspiciousCount = analysisStats.suspicious || 0;

    let verdict: FileScanResult['verdict'] = 'CLEAN';
    if (maliciousCount > 0) {
      verdict = 'MALICIOUS';
    } else if (suspiciousCount > 0) {
      verdict = 'SUSPICIOUS';
    }

    return {
      isSafe: maliciousCount === 0,
      detections: maliciousCount,
      vendor: 'VirusTotal',
      verdict,
      hash,
      lastAnalysisStats: analysisStats,
    };
  } catch (hashError) {
    // Если файл не найден по хешу, загружаем на анализ
    if (axios.isAxiosError(hashError) && hashError.response?.status === 404) {
      return uploadFileForAnalysis(fileBuffer, fileName);
    }

    console.error('[FileScanner] Ошибка при проверке по хешу:', hashError);
    throw new Error('Не удалось проверить файл на вирусы');
  }
}

/**
 * Загружает файл на анализ в VirusTotal
 */
async function uploadFileForAnalysis(
  fileBuffer: Buffer,
  fileName: string,
): Promise<FileScanResult> {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, fileName);

    const uploadResponse = await axios.post(
      'https://www.virustotal.com/api/v3/files',
      form,
      {
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
          ...form.getHeaders(),
        },
      },
    );

    const analysisId = uploadResponse.data.data.id;

    // Ждём результата анализа (с таймаутом)
    const analysisResult = await waitForAnalysisCompletion(analysisId);

    return analysisResult;
  } catch (error) {
    console.error('[FileScanner] Ошибка при загрузке файла на анализ:', error);
    throw new Error('Не удалось загрузить файл на анализ');
  }
}

/**
 * Ждёт завершения анализа файла
 */
async function waitForAnalysisCompletion(
  analysisId: string,
  maxAttempts: number = 10,
): Promise<FileScanResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: {
            'x-apikey': VIRUSTOTAL_API_KEY,
          },
        },
      );

      const status = response.data.data.attributes.status;

      if (status === 'completed') {
        const stats = response.data.data.attributes.stats;
        const maliciousCount = stats.malicious || 0;
        const suspiciousCount = stats.suspicious || 0;

        let verdict: FileScanResult['verdict'] = 'CLEAN';
        if (maliciousCount > 0) {
          verdict = 'MALICIOUS';
        } else if (suspiciousCount > 0) {
          verdict = 'SUSPICIOUS';
        }

        return {
          isSafe: maliciousCount === 0,
          detections: maliciousCount,
          vendor: 'VirusTotal',
          verdict,
          hash: response.data.data.attributes.sha256,
          lastAnalysisStats: stats,
        };
      }

      // Ждём перед следующей попыткой
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[FileScanner] Ошибка при проверке статуса анализа (попытка ${attempt + 1}):`, error);
    }
  }

  throw new Error('Анализ файла превысил таймаут');
}

/**
 * Проверяет расширение и размер файла на безопасность
 */
export function isFileExtensionSafe(fileName: string): boolean {
  const dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.zip',
    '.rar',
    '.7z',
  ];

  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return !dangerousExtensions.includes(ext);
}

/**
 * Проверяет размер файла
 */
export function isFileSizeSafe(fileSize: number, maxSizeMB: number = 500): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxBytes;
}

/**
 * Комплексная проверка файла
 */
export async function validateFileForUpload(
  fileBuffer: Buffer,
  fileName: string,
  fileSize: number,
): Promise<{
  isValid: boolean;
  reason?: string;
  scanResult?: FileScanResult;
}> {
  // 1. Проверка расширения
  if (!isFileExtensionSafe(fileName)) {
    return {
      isValid: false,
      reason: `Тип файла .${fileName.split('.').pop()} запрещен`,
    };
  }

  // 2. Проверка размера
  if (!isFileSizeSafe(fileSize)) {
    return {
      isValid: false,
      reason: 'Размер файла превышает максимально допустимый (500 МБ)',
    };
  }

  // 3. Сканирование на вирусы (если API ключ настроен)
  if (VIRUSTOTAL_API_KEY) {
    try {
      const scanResult = await scanFileWithVirusTotal(fileBuffer, fileName);

      if (scanResult.verdict === 'MALICIOUS') {
        return {
          isValid: false,
          reason: `Файл содержит вредоносный код (обнаружено ${scanResult.detections} вредоносных сигнатур)`,
          scanResult,
        };
      }

      if (scanResult.verdict === 'SUSPICIOUS' && scanResult.detections > 2) {
        return {
          isValid: false,
          reason: `Файл подозрителен (${scanResult.detections} подозреваемых сигнатур)`,
          scanResult,
        };
      }

      return {
        isValid: true,
        scanResult,
      };
    } catch (error) {
      // Если сканирование не удалось, позволяем загрузку, но логируем ошибку
      console.error('[FileScanner] Ошибка сканирования:', error);
      return {
        isValid: true, // Не блокируем загрузку при ошибке сканирования
      };
    }
  }

  return {
    isValid: true,
  };
}
