import { thumbnailUrl } from '../services/service-providers';

/**
 * List cards ask the API for a smaller copy of an uploaded photo (`/files/{name}?w=`, feedback
 * 2026-10-21) instead of the full 1920px upload. Only our own files have one.
 */
describe('thumbnailUrl', () => {
  it('asks for a width on one of our uploads', () => {
    expect(thumbnailUrl('http://localhost:5161/files/abc.jpg', 480)).toBe(
      'http://localhost:5161/files/abc.jpg?w=480'
    );
  });

  it('leaves external photos, empty sources and already-sized URLs alone', () => {
    expect(thumbnailUrl('https://cdn.example.com/dog.jpg', 480)).toBe(
      'https://cdn.example.com/dog.jpg'
    );
    expect(thumbnailUrl(null, 480)).toBe('');
    expect(thumbnailUrl('/files/abc.jpg?w=240', 480)).toBe('/files/abc.jpg?w=240');
  });
});
