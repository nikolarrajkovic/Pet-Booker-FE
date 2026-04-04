// Single source of truth for mock schedule data
// In production, this will come from your backend API

export interface ServiceItem {
  id: string;
  title: string;
  provider: string;
  petName: string;
  time: string;
  location: string;
  type: 'walking' | 'grooming' | 'sitting';
  duration: number; // in hours
  isUserService: boolean; // true if user is booking this service for their pet
}

// Mock services data - key is date in format YYYY-MM-DD
export const mockScheduleData: { [key: string]: ServiceItem[] } = {
  '2026-04-01': [
    {
      id: '1',
      title: 'Dog Walking',
      provider: 'Happy Paws Walking',
      petName: 'Luna',
      time: '08:30 AM - 11:00 AM',
      location: 'Central Park',
      type: 'walking',
      duration: 2.5,
      isUserService: false // Partner providing service
    },
    {
      id: '2',
      title: 'Pet Grooming',
      provider: 'Pampered Paws',
      petName: 'Mochi',
      time: '11:00 AM - 02:00 PM',
      location: 'Downtown Grooming',
      type: 'grooming',
      duration: 3,
      isUserService: false // Partner providing service
    },
    {
      id: '3',
      title: 'Pet Sitting',
      provider: 'Pet Care Plus',
      petName: 'Buddy',
      time: '03:00 PM - 05:00 PM',
      location: 'Client Home',
      type: 'sitting',
      duration: 2,
      isUserService: false // Partner providing service
    }
  ],
  '2026-04-02': [
    {
      id: '4',
      title: 'Dog Walking',
      provider: 'Happy Paws Walking',
      petName: 'Rex',
      time: '09:00 AM - 11:30 AM',
      location: 'Riverside Park',
      type: 'walking',
      duration: 2.5,
      isUserService: false
    },
    {
      id: '5',
      title: 'Pet Grooming',
      provider: 'Pets & Co',
      petName: 'Chloe',
      time: '12:00 PM - 03:00 PM',
      location: 'Uptown Spa',
      type: 'grooming',
      duration: 3,
      isUserService: false
    }
  ],
  '2026-04-03': [
    {
      id: '6',
      title: 'Dog Training',
      provider: 'K9 Academy',
      petName: 'Duke',
      time: '10:00 AM - 04:00 PM',
      location: 'Training Center',
      type: 'sitting',
      duration: 6,
      isUserService: false
    }
  ],
  '2026-04-04': [
    {
      id: '7',
      title: 'Dog Walking Service',
      provider: 'Happy Paws Walking',
      petName: 'Max',
      time: '10:00 AM - 12:30 PM',
      location: 'Golden Gate Park',
      type: 'walking',
      duration: 2.5,
      isUserService: true // User is booking this service for their pet
    }
  ],
  '2026-04-05': [
    {
      id: '8',
      title: 'Pet Grooming',
      provider: 'Spa Paws',
      petName: 'Bella',
      time: '02:00 PM - 04:00 PM',
      location: 'Pet Spa',
      type: 'grooming',
      duration: 2,
      isUserService: false
    }
  ],
  '2026-04-06': [
    {
      id: '9',
      title: 'Dog Daycare',
      provider: 'Playful Paws',
      petName: 'Rocky',
      time: '08:00 AM - 05:00 PM',
      location: 'Daycare Center',
      type: 'sitting',
      duration: 9,
      isUserService: false
    }
  ],
  '2026-04-07': [
    {
      id: '10',
      title: 'Dog Walking',
      provider: 'Active Paws',
      petName: 'Charlie',
      time: '09:00 AM - 11:00 AM',
      location: 'Beach Walk',
      type: 'walking',
      duration: 2,
      isUserService: false
    },
    {
      id: '11',
      title: 'Pet Sitting',
      provider: 'Home Pet Care',
      petName: 'Daisy',
      time: '01:00 PM - 04:00 PM',
      location: 'Client Home',
      type: 'sitting',
      duration: 3,
      isUserService: false
    }
  ],
  '2026-04-08': [
    {
      id: '12',
      title: 'Full Day Care',
      provider: 'Premium Pet Care',
      petName: 'Zeus',
      time: '07:00 AM - 04:00 PM',
      location: 'Care Center',
      type: 'sitting',
      duration: 9,
      isUserService: false
    }
  ],
  '2026-04-09': [
    {
      id: '13',
      title: 'Dog Training',
      provider: 'Obedience School',
      petName: 'Luna',
      time: '10:00 AM - 03:00 PM',
      location: 'Training Field',
      type: 'sitting',
      duration: 5,
      isUserService: false
    }
  ],
  '2026-04-10': [
    {
      id: '14',
      title: 'Morning Walk',
      provider: 'Walk & Play',
      petName: 'Max',
      time: '08:00 AM - 10:30 AM',
      location: 'Park Trail',
      type: 'walking',
      duration: 2.5,
      isUserService: false
    }
  ]
};

// Helper function to get services for a specific date
export const getServicesForDate = (date: Date): ServiceItem[] => {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return mockScheduleData[dateStr] || [];
};

// Helper function to calculate day color based on services
export const getDayColorInfo = (date: Date) => {
  const services = getServicesForDate(date);
  
  if (services.length === 0) {
    return { color: 'transparent', totalHours: 0, hasUserService: false };
  }

  // Check if user has any service on this day
  const hasUserService = services.some(s => s.isUserService);
  
  // If user has a service, the day is blue regardless of hours
  if (hasUserService) {
    const totalHours = services.reduce((sum, s) => sum + s.duration, 0);
    return { color: '#93C5FD', totalHours, hasUserService: true }; // Blue-300 (pastel)
  }

  // Calculate total hours for partner services
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);

  let color: string;
  if (totalHours <= 3) {
    color = '#86EFAC'; // Green-300 (pastel)
  } else if (totalHours <= 6) {
    color = '#FDE047'; // Yellow-300 (pastel)
  } else {
    color = '#FCA5A5'; // Red-300 (pastel)
  }

  return { color, totalHours, hasUserService: false };
};

// Helper function to get pressed (darker) color
export const getDayColorPressed = (date: Date) => {
  const services = getServicesForDate(date);
  
  if (services.length === 0) {
    return { color: 'transparent', totalHours: 0, hasUserService: false };
  }

  const hasUserService = services.some(s => s.isUserService);
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);

  let color: string;
  if (hasUserService) {
    color = '#60A5FA'; // Blue-400 (darker)
  } else if (totalHours <= 3) {
    color = '#4ADE80'; // Green-400 (darker)
  } else if (totalHours <= 6) {
    color = '#FBBF24'; // Yellow-400 (darker)
  } else {
    color = '#F87171'; // Red-400 (darker)
  }

  return { color, totalHours, hasUserService };
};

// Helper function to get statistics for a month
export const getMonthStats = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  let totalServices = 0;
  let bookedDays = 0;
  let totalHours = 0;

  // Count all days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const services = getServicesForDate(currentDate);
    
    if (services.length > 0) {
      totalServices += services.length;
      bookedDays++;
      totalHours += services.reduce((sum, s) => sum + s.duration, 0);
    }
  }

  const avgPerWeek = Math.round(totalHours / 4);

  return { totalServices, bookedDays, avgPerWeek };
};
