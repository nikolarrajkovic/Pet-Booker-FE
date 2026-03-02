import React from 'react';
import { Text, View } from 'react-native';

import { EditScreenInfo } from './EditScreenInfo';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  return (
    <View className={styles.container}>
      <Text className={styles.title}>{title}</Text>
      <View className={styles.separator} />
      <EditScreenInfo path={path} />
      {children}
    </View>
  );
};
const styles = {
  // friendly brand green background with darker title for contrast
  container: `items-center flex-1 justify-center bg-brand-100`,
  separator: `h-[1px] my-7 w-4/5 bg-brand-200`,
  title: `text-xl font-bold text-brand-700`,
};
