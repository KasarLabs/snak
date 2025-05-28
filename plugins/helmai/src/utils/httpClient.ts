import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@snakagent/core';
import { API_CONFIG } from '../constants/api.js';
import { HelmaiErrorHandler, HelmaiResult } from './errorHandler.js';

export interface HttpClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: HttpClientConfig) {
    this.maxRetries = config.maxRetries || API_CONFIG.MAX_RETRIES;
    this.retryDelay = config.retryDelay || API_CONFIG.RETRY_DELAY;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || API_CONFIG.REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'x-api-key': config.apiKey }),
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('HTTP Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: this.sanitizeHeaders(config.headers),
        });
        return config;
      },
      (error) => {
        logger.error('HTTP Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HTTP Response:', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length,
        });
        return response;
      },
      (error) => {
        logger.error('HTTP Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  private sanitizeHeaders(
    headers: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = '[REDACTED]';
    }
    if (sanitized['x-api-key']) {
      sanitized['x-api-key'] = '[REDACTED]';
    }
    return sanitized;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    context: string
  ): Promise<HelmaiResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await operation();
        return HelmaiErrorHandler.createSuccess(response.data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          `HTTP request failed (attempt ${attempt}/${this.maxRetries}):`,
          {
            context,
            error: lastError.message,
            attempt,
          }
        );

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 429) {
            break;
          }
        }

        // Wait before retrying (except on last attempt)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    return HelmaiErrorHandler.handleApiError(lastError, context);
  }

  async get<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<HelmaiResult<T>> {
    return this.executeWithRetry(
      () => this.client.get<T>(url, config),
      `GET ${url}`
    );
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<HelmaiResult<T>> {
    return this.executeWithRetry(
      () => this.client.post<T>(url, data, config),
      `POST ${url}`
    );
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<HelmaiResult<T>> {
    return this.executeWithRetry(
      () => this.client.put<T>(url, data, config),
      `PUT ${url}`
    );
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<HelmaiResult<T>> {
    return this.executeWithRetry(
      () => this.client.patch<T>(url, data, config),
      `PATCH ${url}`
    );
  }

  async delete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<HelmaiResult<T>> {
    return this.executeWithRetry(
      () => this.client.delete<T>(url, config),
      `DELETE ${url}`
    );
  }

  // Utility method for URL parameter replacement
  static replaceUrlParams(url: string, params: Record<string, string>): string {
    let result = url;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`:${key}`, encodeURIComponent(value));
    }
    return result;
  }

  // Utility method for query string building
  static buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }
}

// Pre-configured HTTP clients for different services
export class HelmaiHttpClients {
  private static backendClient: HttpClient | null = null;
  private static desmosClient: HttpClient | null = null;
  private static whatsappClient: HttpClient | null = null;

  static getBackendClient(): HttpClient {
    if (!this.backendClient) {
      this.backendClient = new HttpClient({
        baseURL: API_CONFIG.BACKEND_URL,
        apiKey: API_CONFIG.BACKEND_API_KEY,
        timeout: API_CONFIG.REQUEST_TIMEOUT,
        maxRetries: API_CONFIG.MAX_RETRIES,
        retryDelay: API_CONFIG.RETRY_DELAY,
      });
    }
    return this.backendClient;
  }

  static getDesmosClient(): HttpClient {
    if (!this.desmosClient) {
      this.desmosClient = new HttpClient({
        baseURL: API_CONFIG.DESMOS_URL,
        apiKey: API_CONFIG.DESMOS_API_KEY,
        timeout: API_CONFIG.REQUEST_TIMEOUT,
        maxRetries: API_CONFIG.MAX_RETRIES,
        retryDelay: API_CONFIG.RETRY_DELAY,
      });
    }
    return this.desmosClient;
  }

  static getWhatsAppClient(): HttpClient {
    if (!this.whatsappClient) {
      const baseURL = `${API_CONFIG.WHATSAPP_API_URL}/${API_CONFIG.WHATSAPP_API_VERSION}`;
      this.whatsappClient = new HttpClient({
        baseURL,
        apiKey: API_CONFIG.WHATSAPP_ACCESS_TOKEN,
        timeout: API_CONFIG.REQUEST_TIMEOUT,
        maxRetries: API_CONFIG.MAX_RETRIES,
        retryDelay: API_CONFIG.RETRY_DELAY,
      });
    }
    return this.whatsappClient;
  }

  // Reset clients (useful for testing or config changes)
  static resetClients(): void {
    this.backendClient = null;
    this.desmosClient = null;
    this.whatsappClient = null;
  }
}