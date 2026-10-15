/** Svarsformen från våra API-routes (mall §6): { success: true, data } eller { error }. */
export type ApiResult<T = unknown> = {
  success?: boolean;
  data?: T;
  error?: string;
  /** Fält som felet gäller, för formulär */
  field?: string;
};

export async function readApiResult<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json().catch(() => ({}))) as ApiResult<T>;
}
