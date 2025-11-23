/**
 * Централизованная конфигурация API
 */

const resolveDefaultApiUrl = () => {
	if (typeof window === 'undefined') {
		return import.meta.env.DEV ? 'http://localhost:5000' : '';
	}

	if (import.meta.env.DEV) {
		return 'http://localhost:5000';
	}

	return window.location.origin;
};

const resolveDefaultSocketUrl = (apiUrl: string) => {
	if (!apiUrl) {
		return import.meta.env.DEV ? 'ws://localhost:5000/ws' : '';
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

export const API_URL = import.meta.env.VITE_API_URL || resolveDefaultApiUrl();

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || resolveDefaultSocketUrl(API_URL);
