/**
 * Централизованная конфигурация API
 */

const PRODUCTION_API_ORIGIN = 'https://api.ospab.host';

const resolveDefaultApiUrl = () => {
	if (typeof window === 'undefined') {
		return import.meta.env.DEV ? 'http://localhost:5000' : PRODUCTION_API_ORIGIN;
	}

	if (import.meta.env.DEV) {
		return 'http://localhost:5000';
	}

	return PRODUCTION_API_ORIGIN;
};

const resolveDefaultSocketUrl = (apiUrl: string) => {
	if (!apiUrl) {
		return import.meta.env.DEV ? 'ws://localhost:5000/ws' : 'wss://api.ospab.host/ws';
	}

	try {
		const url = new URL(apiUrl);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		url.pathname = '/ws';
		url.search = '';
		url.hash = '';
		return url.toString();
	} catch (error) {
		console.warn('[config/api] Некорректный API_URL, используем ws://localhost:5000/ws');
		return 'ws://localhost:5000/ws';
	}
};

const normalizeSocketUrl = (value: string | undefined, fallbackApiUrl: string): string | undefined => {
	if (value === undefined) return undefined;

	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const lowered = trimmed.toLowerCase();
	if (lowered === 'disabled' || lowered === 'none' || lowered === 'off') {
		return '';
	}

	try {
		const url = new URL(trimmed);
		if (!url.pathname || url.pathname === '/') {
			url.pathname = '/ws';
		}
		url.search = '';
		url.hash = '';
		return url.toString();
	} catch (error) {
		console.warn('[config/api] Некорректный VITE_SOCKET_URL, используем значение по умолчанию', error);
		try {
			const base = new URL(fallbackApiUrl);
			base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
			base.pathname = '/ws';
			base.search = '';
			base.hash = '';
			return base.toString();
		} catch {
			return undefined;
		}
	}
};

const RAW_API_URL = import.meta.env.VITE_API_URL;
export const API_URL = RAW_API_URL || resolveDefaultApiUrl();

const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const defaultSocketUrl = resolveDefaultSocketUrl(API_URL);
const normalizedSocketUrl = normalizeSocketUrl(RAW_SOCKET_URL, API_URL);
export const SOCKET_URL = normalizedSocketUrl !== undefined ? normalizedSocketUrl : defaultSocketUrl;
