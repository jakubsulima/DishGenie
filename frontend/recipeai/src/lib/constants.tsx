/// <reference types="vite/client" />

export const TIMEOUT = 10;
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const normalizeApiUrl = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

export const API_URL: string = configuredApiUrl
  ? normalizeApiUrl(configuredApiUrl)
  : "/api/";
