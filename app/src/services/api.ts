import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

function construirUrl(ruta: string, params?: Record<string, string | number | undefined>): string {
  const rutaNormalizada = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const urlBase = `${BASE_URL}${rutaNormalizada}`;

  if (!params) return urlBase;

  const searchParams = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') {
      searchParams.set(clave, String(valor));
    }
  }

  const query = searchParams.toString();
  return query ? `${urlBase}?${query}` : urlBase;
}

export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;
  const url = construirUrl(ruta, params);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 204) {
    return null as T;
  }

  let cuerpoJson: unknown = null;
  const texto = await response.text();
  if (texto) {
    try {
      cuerpoJson = JSON.parse(texto);
    } catch {
      cuerpoJson = { mensaje: texto };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && ruta !== '/login') {
      await olvidarSesion();
      await router.replace('/login');
    }
    throw new ErrorApi(response.status, cuerpoJson);
  }

  return cuerpoJson as T;
}