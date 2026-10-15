import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  View,
  type ImageProps,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiAuthFetch } from '../../services/http';
import { getValidAccessToken } from '../../services/session';

/**
 * An image source that carries the session: a blob URL on the web (an `<img>` cannot send a
 * header), the Authorization header on a phone (React Native's Image can). `null` while it loads,
 * `'failed'` when the server refuses it.
 *
 * For files the API serves only to their owner or an admin — government-ID photos. A plain
 * `<Image source={{ uri }}>` asks for them anonymously, the API answers 404 by design, and the
 * admin reviewing an application saw an empty box where the ID should be.
 */
export function usePrivateImageSource(uri?: string | null): ImageSourcePropType | null | 'failed' {
  const [source, setSource] = useState<ImageSourcePropType | null | 'failed'>(null);

  useEffect(() => {
    setSource(null);
    if (!uri) return;
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const response = await apiAuthFetch(uri, { headers: { Accept: '*/*' } });
          if (!response.ok) throw new Error(String(response.status));
          objectUrl = URL.createObjectURL(await response.blob());
          if (alive) setSource({ uri: objectUrl });
          else URL.revokeObjectURL(objectUrl);
        } else {
          const token = await getValidAccessToken();
          if (alive) setSource({ uri, headers: { Authorization: `Bearer ${token}` } });
        }
      } catch {
        if (alive) setSource('failed');
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri]);

  return source;
}

type PrivateImageProps = Omit<ImageProps, 'source'> & { uri: string };

/** `<Image>` for a file only the owner or an admin may read (see usePrivateImageSource). */
export default function PrivateImage({ uri, style, ...rest }: PrivateImageProps) {
  const source = usePrivateImageSource(uri);
  if (source === null || source === 'failed') {
    return (
      <View
        style={[
          style,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(127,127,127,0.12)',
          },
        ]}>
        {source === null ? (
          <ActivityIndicator color="#9CA3AF" />
        ) : (
          <Ionicons name="image-outline" size={22} color="#9CA3AF" />
        )}
      </View>
    );
  }
  return <Image source={source} style={style} {...rest} />;
}
