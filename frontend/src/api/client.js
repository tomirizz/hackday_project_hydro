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

export default client;
