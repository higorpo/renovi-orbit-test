/**
 * Request body for the match-provider-jobs edge function.
 */
export interface MatchProviderJobsBody {
  /** Provider location latitude (-90..90). Required. */
  latitude: number;
  /** Provider location longitude (-180..180). Required. */
  longitude: number;
  /** Search radius in km. Clamped to [1, 100] by RPC. Default 10. */
  radius_km?: number;
  /** Optional service UUID to filter by single service. */
  service_id?: string | null;
  /** Sort mode: "nearest" (default), "newest", "least_competitive". */
  sort_mode?: string;
  /** Page number (min 1). Default 1. */
  page?: number;
  /** Page size. Clamped to [1, 50] by RPC. Default 20. */
  page_size?: number;
  /**
   * When set, returns at most that service request if the provider is eligible.
   * Geographic radius is not applied for this lookup (direct link / refresh).
   */
  service_request_id?: string | null;
}
