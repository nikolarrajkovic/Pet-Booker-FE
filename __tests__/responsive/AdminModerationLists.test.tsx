import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { withProviders, setViewport } from '../test-utils';

/**
 * The admin moderation lists on the web design page from the server, one tab per status, each
 * in its own order. What fails silently if it regresses is the *query*, not the pixels:
 *
 *  - a pending queue must be asked for oldest first, and decisions newest first;
 *  - a sort picked on one tab must stay on that tab, not reorder the others;
 *  - the phone design must keep its own data path — it was deliberately left as it was.
 */

const mockGetPage = jest.fn();
const mockCount = jest.fn();
const mockGetAll = jest.fn();

jest.mock('../../services/service-providers', () => ({
  ...jest.requireActual('../../services/service-providers'),
  getServiceProvidersPage: (...a: unknown[]) => mockGetPage(...a),
  countServiceProviders: (...a: unknown[]) => mockCount(...a),
  getAllServiceProviders: (...a: unknown[]) => mockGetAll(...a),
}));

jest.mock('../../services/admin', () => ({
  approveServiceProvider: jest.fn(),
  declineServiceProvider: jest.fn(),
  approveCertificate: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => {
  const value = { showError: jest.fn(), showSuccess: jest.fn(), showInfo: jest.fn() };
  return { useToast: () => value };
});

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown, fallback?: string) => fallback ?? String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => false, goBack: jest.fn() }),
    useRoute: () => ({ name: 'AdminNewRequests', key: 'k', params: {} }),
    // `usePagedList` reads it for its refocus refresh; no navigator here is fine.
    NavigationContext: react.createContext(undefined),
  };
});

import AdminNewRequestsScreen from '../../screens/admin-new-requests-screen/containers/AdminNewRequestsScreen';

const provider = (id: number) => ({
  id,
  name: `Applicant ${id}`,
  type: 0,
  approvalStatus: 0,
  createdAt: '2026-09-01T10:00:00Z',
  photos: [],
  certificates: [],
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

/** The query the list most recently asked the server for. */
const lastQuery = () => mockGetPage.mock.calls[mockGetPage.mock.calls.length - 1][0];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPage.mockResolvedValue({
    items: [provider(1), provider(2)],
    totalItems: 2,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 20,
    hasMore: false,
  });
  mockCount.mockResolvedValue(2);
  mockGetAll.mockResolvedValue([provider(1)]);
});

describe('Partner applications on the web design', () => {
  it('asks for pending oldest first, and for decisions newest first', async () => {
    setViewport('desktop');
    render(withProviders(<AdminNewRequestsScreen />));
    await screen.findByText('Applicant 1');

    expect(lastQuery()).toMatchObject({ approvalStatus: 0, order: 0, page: 1 });

    fireEvent.press(screen.getByText('Approved'));
    await flush();
    expect(lastQuery()).toMatchObject({ approvalStatus: 1, order: 1, page: 1 });

    fireEvent.press(screen.getByText('Rejected'));
    await flush();
    expect(lastQuery()).toMatchObject({ approvalStatus: 2, order: 1, page: 1 });
  });

  it('keeps a picked order on its own tab', async () => {
    setViewport('desktop');
    render(withProviders(<AdminNewRequestsScreen />));
    await screen.findByText('Applicant 1');

    // Pending → newest first.
    fireEvent.press(screen.getByLabelText(/Sort by:/));
    fireEvent.press(screen.getByText('Newest first'));
    await flush();
    expect(lastQuery()).toMatchObject({ approvalStatus: 0, order: 1 });

    // Approved still opens on its own default...
    fireEvent.press(screen.getByText('Approved'));
    await flush();
    expect(lastQuery()).toMatchObject({ approvalStatus: 1, order: 1 });

    // ...and Pending remembers what was picked for it.
    fireEvent.press(screen.getByText('Pending'));
    await flush();
    expect(lastQuery()).toMatchObject({ approvalStatus: 0, order: 1 });
  });

  it('badges each tab with the server count, not the rows loaded', async () => {
    mockCount.mockImplementation(({ approvalStatus }: { approvalStatus: number }) =>
      Promise.resolve([79, 626, 3][approvalStatus])
    );
    setViewport('desktop');
    render(withProviders(<AdminNewRequestsScreen />));
    await screen.findByText('Applicant 1');
    await flush();

    expect(screen.getByText('79')).toBeTruthy();
    expect(screen.getByText('626')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('Partner applications on the phone design', () => {
  it('keeps its own data path: every application read up front, no paged queries', async () => {
    setViewport('mobile');
    render(withProviders(<AdminNewRequestsScreen />));
    await screen.findByText('Applicant 1');

    expect(mockGetAll).toHaveBeenCalled();
    expect(mockGetPage).not.toHaveBeenCalled();
  });
});
