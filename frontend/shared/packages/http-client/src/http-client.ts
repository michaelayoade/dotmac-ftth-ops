import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type { HttpClientConfig, RequestConfig, ApiResponse, HttpMethod } from "./types";
import { TenantResolver } from "./tenant-resolver";
import { ErrorNormalizer } from "./error-normalizer";
import { RetryHandler } from "./retry-handler";
import { AuthInterceptor, type AuthConfig } from "./auth-interceptor";

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private tenantResolver: TenantResolver | null = null;
  private retryHandler: RetryHandler;
  private authInterceptor: AuthInterceptor | null = null;
  private config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: "",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      tenantIdSource: "subdomain",
      authTokenSource: "cookie",
      ...config,
    };

    this.retryHandler = new RetryHandler({
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
    });

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for tenant ID and auth
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig & { skipTenantId?: boolean }) => {
        // Add tenant ID if not skipped
        if (!this.isSkipTenantId(config)) {
          const tenantId = this.tenantResolver?.getTenantId();
          if (tenantId) {
            config.headers = config.headers || {};
            config.headers["X-Tenant-ID"] = tenantId;
          }
        }

        return config;
      },
      (error) => Promise.reject(ErrorNormalizer.normalize(error)),
    );

    // Response interceptor for error normalization
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        const normalizedError = ErrorNormalizer.normalize(error);
        return Promise.reject(normalizedError);
      },
    );
  }

  // Configuration methods
  setTenantResolver(resolver: TenantResolver): this {
    this.tenantResolver = resolver;
    return this;
  }

  setTenantFromHostname(): this {
    this.tenantResolver = TenantResolver.fromHostname();
    return this;
  }

  setTenantId(tenantId: string): this {
    this.tenantResolver = TenantResolver.fromConfig(tenantId);
    return this;
  }

  enableAuth(authConfig?: Partial<AuthConfig>): this {
    this.authInterceptor = new AuthInterceptor({
      tokenSource: this.config.authTokenSource,
      ...authConfig,
    });

    // Add auth interceptors
    this.axiosInstance.interceptors.request.use(this.authInterceptor.requestInterceptor, (error) =>
      Promise.reject(ErrorNormalizer.normalize(error)),
    );

    this.axiosInstance.interceptors.response.use(
      this.authInterceptor.responseInterceptor.onFulfilled,
      async (error) => {
        try {
          return await this.authInterceptor!.responseInterceptor.onRejected(error);
        } catch (authError) {
          return Promise.reject(ErrorNormalizer.normalize(authError));
        }
      },
    );

    return this;
  }

  // HTTP methods with retry logic
  async get<T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>("GET", url, undefined, config);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", url, data, config);
  }

  async put<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", url, data, config);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", url, data, config);
  }

  async delete<T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", url, undefined, config);
  }

  // Core request method
  private async request<T>(
    method: HttpMethod,
    url: string,
    data?: any,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: method.toLowerCase(),
      url,
      data,
      ...config,
    };

    const operation = () => this.axiosInstance.request<T>(requestConfig);

    try {
      const response = config.skipRetry
        ? await operation()
        : await this.retryHandler.execute(operation);

      return this.normalizeResponse<T>(response);
    } catch (error) {
      throw ErrorNormalizer.normalize(error);
    }
  }

  private normalizeResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      data: response.data,
      success: true,
      message: "Request successful",
    };
  }

  private isSkipTenantId(config: RequestConfig | InternalAxiosRequestConfig | undefined): boolean {
    if (!config) {
      return false;
    }
    return (config as RequestConfig).skipTenantId === true;
  }

  // Utility methods
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  getCurrentTenantId(): string | null {
    return this.tenantResolver?.getTenantId() || null;
  }

  // Static factory methods
  static create(config?: HttpClientConfig): HttpClient {
    return new HttpClient(config);
  }

  static createWithTenant(tenantId: string, config?: HttpClientConfig): HttpClient {
    return new HttpClient(config).setTenantId(tenantId);
  }

  static createFromHostname(config?: HttpClientConfig): HttpClient {
    return new HttpClient(config).setTenantFromHostname();
  }

  static createWithAuth(
    authConfig?: Partial<AuthConfig>,
    httpConfig?: HttpClientConfig,
  ): HttpClient {
    return new HttpClient(httpConfig).enableAuth(authConfig);
  }
}
