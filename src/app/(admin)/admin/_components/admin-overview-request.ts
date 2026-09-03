type AdminOverviewRedirect = "/admin/login" | "/admin/inventory";

type AdminOverviewRequestOptions<T> = {
  signal: AbortSignal;
  request: (signal: AbortSignal) => Promise<Response>;
  isPayload: (value: unknown) => value is T;
  onData: (payload: T) => void;
  onError: () => void;
  onRedirect: (href: AdminOverviewRedirect) => void;
};

function getRedirectForStatus(status: number): AdminOverviewRedirect | null {
  if (status === 401) return "/admin/login";
  if (status === 403) return "/admin/inventory";
  return null;
}

export async function runAdminOverviewRequest<T>({
  signal,
  request,
  isPayload,
  onData,
  onError,
  onRedirect,
}: AdminOverviewRequestOptions<T>) {
  let response: Response;

  try {
    response = await request(signal);
  } catch {
    if (!signal.aborted) onError();
    return;
  }

  if (signal.aborted) return;

  const redirect = getRedirectForStatus(response.status);
  if (redirect) {
    onRedirect(redirect);
    return;
  }

  if (!response.ok) {
    onError();
    return;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!signal.aborted) onError();
    return;
  }

  if (signal.aborted) return;
  if (!isPayload(payload)) {
    onError();
    return;
  }

  onData(payload);
}
