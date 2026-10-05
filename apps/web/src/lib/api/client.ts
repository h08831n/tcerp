/**
 * TCERP - Frontend HTTP API Client
 * Package: @tcerp/web
 *
 * Provides typed, decoupled HTTP communication with the NestJS backend.
 * Zero database, zero server, and zero Node dependencies.
 */

export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(message: string, statusCode: number, errorCode: string = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class ApiConnectionError extends Error {
  constructor(message: string = 'ارتباط با سرور API برقرار نشد. لطفاً وضعیت سرور را بررسی کنید.') {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

class HttpClient {
  private activeUserId: string = 'usr-admin-01';
  private activeCompanyId: string = 'comp-001-arvin';

  public setSession(userId: string, companyId: string) {
    this.activeUserId = userId;
    this.activeCompanyId = companyId;
  }

  public getSession() {
    return {
      userId: this.activeUserId,
      companyId: this.activeCompanyId,
    };
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.activeUserId,
      'x-company-id': this.activeCompanyId,
      ...(options.headers as Record<string, string> || {}),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new ApiConnectionError();
    }

    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
      } catch {
        errorData = { message: res.statusText || 'خطای ناشناخته سرور' };
      }

      throw new ApiError(
        errorData.message || 'خطای درخواست به سرور',
        res.status,
        errorData.errorCode || `HTTP_${res.status}`,
        errorData.details
      );
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  public get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      }
      const qs = query.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const httpClient = new HttpClient();
