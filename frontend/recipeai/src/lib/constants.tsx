/// <reference types="vite/client" />

export const TIMEOUT = 10;
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL: string = configuredApiUrl ? configuredApiUrl : "/api/";
