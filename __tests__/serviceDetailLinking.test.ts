import { getPathFromState, getStateFromPath } from '@react-navigation/native';
import { linking, serviceDetailParams } from '../navigation/linking';
import type { ServiceDto } from '../services/services';

// Opening a service from a list carries the whole DTO as a head start. Every list used to pass
// only that, so the web address bar read `/services/undefined?service=%5Bobject%20Object%5D` and a
// reload (or a shared link) parsed the id back as NaN and the service as that string.
describe('ServiceDetail URL', () => {
  const config = linking.config as any;
  const service = { id: 42, name: 'Riverside Dog Walks' } as ServiceDto;

  it('is /services/{id}, with the DTO kept out of the query string', () => {
    const path = getPathFromState(
      { routes: [{ name: 'ServiceDetail', params: serviceDetailParams(service) }] } as any,
      config
    );
    expect(path).toBe('/services/42');
  });

  it('parses back to the id the screen fetches by', () => {
    const state = getStateFromPath('/services/42', config) as any;
    const route = state.routes[state.routes.length - 1];
    expect(route.name).toBe('ServiceDetail');
    expect(route.params).toEqual({ serviceId: 42 });
  });
});
