import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  label: string;
  bg?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
};

export const ServiceBubble = ({ label, bg = 'bg-brand-500', onPress, icon }: Props) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      // The icon carries no text, so without a label the whole pill announces as an unnamed
      // button; `accessible` collapses the icon + caption into that one control.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessible
      className="items-center">
      <View className={`h-24 w-24 items-center justify-center rounded-full ${bg} shadow-lg`}>
        {icon ?? <MaterialCommunityIcons name="dog-side" size={28} color="white" />}
      </View>
      <Text className="mt-3 text-sm text-gray-800">{label}</Text>
    </TouchableOpacity>
  );
};

export default ServiceBubble;
