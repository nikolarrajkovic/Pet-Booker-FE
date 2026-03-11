import React from 'react';

export interface WebTimePickerProps {
  value: Date;
  isDarkMode: boolean;
  onChange: (time: Date) => void;
  onClose: () => void;
}

export default function WebTimePicker(_props: WebTimePickerProps): null {
  return null;
}
