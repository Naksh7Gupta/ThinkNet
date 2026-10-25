import { parseApiError } from "@/lib/utils";
import type {
  ArchitectureCatalogResponse,
  CompileResponse,
  DeleteModelResponse,
  ExportResponse,
  GraphDef,
  HealthResponse,
  ModelMetadata,
  NodeCatalogResponse,
  QuantizeResponse,
  ShapePreviewResponse,
  ValidationResponse,
} from "@/types/api";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the ThinkNet backend at ${getApiBaseUrl()}. Start it with: uvicorn backend.thinknet_backend_core:app --reload`,
      0,
    );
  }

  // Read once as text so an HTML proxy error or malformed JSON response does
  // not leak an unhelpful SyntaxError into the UI.
  const rawPayload = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown = rawPayload;
  if (rawPayload && contentType.includes("application/json")) {
    try {
      payload = JSON.parse(rawPayload) as unknown;
    } catch {
      throw new ApiError(
        `ThinkNet backend returned invalid JSON for ${path} (HTTP ${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(parseApiError(payload, response.status), response.status);
  }

  if (!rawPayload) {
    throw new ApiError(`ThinkNet backend returned an empty response for ${path}.`, response.status);
  }

  return payload as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listNodes: () => request<NodeCatalogResponse>("/api/v1/nodes"),
  listArchitectures: () => request<ArchitectureCatalogResponse>("/api/v1/architectures"),
  validateGraph: (graph: GraphDef) =>
    request<ValidationResponse>("/api/v1/graphs/validate", {
      method: "POST",
      body: JSON.stringify(graph),
    }),
  inferShapes: (graph: GraphDef, inputShape?: number[]) => {
    const params = new URLSearchParams();
    for (const dim of inputShape ?? []) {
      params.append("input_shape", String(dim));
    }
    const query = (inputShape?.length ?? 0) > 0 ? `?${params.toString()}` : "";
    return request<ShapePreviewResponse>(`/api/v1/graphs/infer-shapes${query}`, {
      method: "POST",
      body: JSON.stringify(graph),
    });
  },
  compileModel: (graph: GraphDef) =>
    request<CompileResponse>("/api/v1/models/compile", {
      method: "POST",
      body: JSON.stringify(graph),
    }),
  exportSource: (graph: GraphDef) =>
    request<ExportResponse>("/api/v1/models/export", {
      method: "POST",
      body: JSON.stringify(graph),
    }),
  quantizeModel: (modelId: string, dtype: string) =>
    request<QuantizeResponse>("/api/v1/models/quantize", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId, dtype }),
    }),
  getModel: (modelId: string) => request<ModelMetadata>(`/api/v1/models/${encodeURIComponent(modelId)}`),
  deleteModel: (modelId: string) =>
    request<DeleteModelResponse>(`/api/v1/models/${encodeURIComponent(modelId)}`, { method: "DELETE" }),
};
