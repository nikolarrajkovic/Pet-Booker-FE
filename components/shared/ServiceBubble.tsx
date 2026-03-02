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
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className="items-center">
      <View className={`w-24 h-24 rounded-full items-center justify-center ${bg} shadow-lg`}>
        {icon ?? <MaterialCommunityIcons name="dog-side" size={28} color="white" />}
      </View>
      <Text className="mt-3 text-sm text-gray-800">{label}</Text>
    </TouchableOpacity>
  );
};

export default ServiceBubble;
