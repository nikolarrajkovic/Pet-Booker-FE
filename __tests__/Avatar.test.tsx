import React from 'react';
import { Image } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { withProviders } from './test-utils';
import Avatar from '../components/shared/Avatar';

/**
 * The bug this component exists to prevent: the initial was shown while the user record loaded,
 * unmounted the moment an `avatarUrl` arrived, and — when the photo 404'd — put back by `onError`.
 * Three frames, so the placeholder visibly blinked. None of that is visible to a screenshot test,
 * and all of it is a mount/unmount question, which is exactly what the tree can be asked about.
 */
describe('Avatar', () => {
  const photo = (view: ReturnType<typeof render>) => view.UNSAFE_queryAllByType(Image);

  it('keeps the initial mounted behind a photo that is still loading', () => {
    const view = render(
      withProviders(<Avatar uri="https://example.test/a.jpg" name="Nikola" size={64} />)
    );

    expect(screen.getByText('N')).toBeTruthy();
    expect(photo(view)).toHaveLength(1);
  });

  it('leaves the initial in place when the photo fails, without ever removing it', () => {
    const view = render(
      withProviders(<Avatar uri="https://example.test/gone.jpg" name="Nikola" size={64} />)
    );

    fireEvent(photo(view)[0], 'error');

    expect(screen.getByText('N')).toBeTruthy();
    expect(photo(view)).toHaveLength(0); // the broken image is dropped; the initial never moved
  });

  it('retries once a different photo is picked', () => {
    const view = render(
      withProviders(<Avatar uri="https://example.test/gone.jpg" name="Nikola" size={64} />)
    );
    fireEvent(photo(view)[0], 'error');

    view.rerender(
      withProviders(<Avatar uri="https://example.test/new.jpg" name="Nikola" size={64} />)
    );

    expect(photo(view)).toHaveLength(1);
  });

  it('renders the initial alone when there is no photo', () => {
    const view = render(withProviders(<Avatar name="nikola@example.test" size={64} />));

    expect(screen.getByText('N')).toBeTruthy();
    expect(photo(view)).toHaveLength(0);
  });

  it('falls back to ? when there is no name to take an initial from', () => {
    render(withProviders(<Avatar name="" size={64} />));

    expect(screen.getByText('?')).toBeTruthy();
  });
});
