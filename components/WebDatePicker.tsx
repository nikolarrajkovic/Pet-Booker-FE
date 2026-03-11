import React from 'react';

export interface WebDatePickerProps {
  value: Date;
  minDate?: Date;
  isDarkMode: boolean;
  onChange: (date: Date | null) => void;
  onClose: () => void;
}

export default function WebDatePicker(_props: WebDatePickerProps): null {
  return null;
}
