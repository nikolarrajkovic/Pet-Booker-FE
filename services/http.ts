export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (__DEV__) {
    console.log('[API Request]', init?.method ?? 'GET', url, init?.body ?? '');
  }

  const response = await fetch(url, init);
  const clone = response.clone();

  if (__DEV__) {
    clone.text().then((body) => {
      console.log('[API Response]', response.status, url, body);
    });
  }

  return response;
}
