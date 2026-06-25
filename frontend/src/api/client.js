import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: API_BASE });

export async function fetchObjects(filters = {}) {
  const params = {};
  if (filters.category)  params.category  = filters.category;
  if (filters.district)  params.district  = filters.district;
  if (filters.typeCode)  params.type_code = filters.typeCode;
  if (filters.yearFrom)  params.year_from = filters.yearFrom;
  if (filters.yearTo)    params.year_to   = filters.yearTo;
  if (filters.minRisk != null) params.min_risk = filters.minRisk;
  params.limit = filters.limit || 1000;

  const { data } = await client.get("/objects", { params });
  return data;
}

export async function fetchObject(id) {
  const { data } = await client.get(`/objects/${id}`);
  return data;
}

export async function fetchStats() {
  const { data } = await client.get("/stats");
  return data;
}

export async function fetchDashboard() {
  const { data } = await client.get("/dashboard");
  return data;
}

export async function searchObjects(q) {
  const { data } = await client.get("/search", { params: { q } });
  return data;
}

export async function nearbyObjects(lat, lon, radiusM = 500) {
  const { data } = await client.get("/nearby", {
    params: { lat, lon, radius_m: radiusM },
  });
  return data;
}

export async function askAssistant(message) {
  const { data } = await client.post("/assistant", { message });
  return data;
}

export async function fetchForecast(objectId) {
  const { data } = await client.get(`/forecast/${objectId}`);
  return data;
}

export async function discoverObjects(limit = 50) {
  const { data } = await client.get("/discover", { params: { limit } });
  return data;
}

export async function createObject(payload) {
  const { data } = await client.post("/objects", payload);
  return data;
}

export async function fetchInspections(objectId) {
  const { data } = await client.get(`/objects/${objectId}/inspections`);
  return data;
}

export async function fetchOverdue() {
  const { data } = await client.get("/inspections/overdue");
  return data;
}

export async function fetchPhotos(objectId) {
  const { data } = await client.get(`/objects/${objectId}/photos`);
  return data;
}

export async function uploadPhoto(objectId, imageBase64, mediaType) {
  const { data } = await client.post(`/objects/${objectId}/photos`, {
    image_base64: imageBase64,
    media_type: mediaType,
    analyze: true,
  });
  return data;
}

export function photoUrl(filename) {
  return `${API_BASE}/photos/${filename}`;
}

export async function addInspection(objectId, payload) {
  const { data } = await client.post(`/objects/${objectId}/inspections`, payload);
  return data;
}

export function reportUrl(lang = "ru") {
  return `${API_BASE}/report?lang=${lang}`;
}

export function excelUrl(category = null, typeCode = null) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (typeCode) params.set("type_code", typeCode);
  const qs = params.toString();
  return `${API_BASE}/export/excel${qs ? "?" + qs : ""}`;
}

export default client;
