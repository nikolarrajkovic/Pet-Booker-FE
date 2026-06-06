import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PetCard } from '../components';
import { getPets, PetResponse } from '../../../services/pets';

function mapSexLabel(sex: number): string {
  if (sex === 1) return 'Male';
  if (sex === 2) return 'Female';
  return 'Unspecified';
}

function mapSexToInput(sex: number): string {
  if (sex === 1) return 'male';
  if (sex === 2) return 'female';
  return '';
}

function mapTypeToInput(type: number): string {
  switch (type) {
    case 1: return 'dog';
    case 2: return 'cat';
    case 3: return 'parrot';
    case 4: return 'turtle';
    case 5: return 'fish';
    case 6: return 'snake';
    default: return '';
  }
}

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function toPetCardShape(p: PetResponse) {
  return {
    id: p.id,
    name: p.name,
    breed: p.breed,
    sex: mapSexLabel(p.sex),
    age: p.ageYears ? `${p.ageYears} year${p.ageYears !== 1 ? 's' : ''}` : 'Unknown',
    weight: p.weightKg ? `${p.weightKg} kg` : '-',
    height: p.heightCm ? `${p.heightCm} cm` : '-',
    image: resolveUrl(p.photoUrl),
  };
}

export default function MyPetsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { currentUser } = useAuth();

  const [pets, setPets] = useState<PetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getPets(currentUser.id);
        if (!cancelled) setPets(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load pets.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentUser]);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="My Pets"
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity onPress={() => (navigation as any).navigate('AddPet')} className="w-10 h-10 bg-white rounded-full items-center justify-center">
          <Ionicons name="add" size={24} color="#00C870" />
        </TouchableOpacity>
      }
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#00C870" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text className={`text-center mt-10 ${subtextColor}`}>{error}</Text>
        ) : pets.length === 0 ? (
          <Text className={`text-center mt-10 ${subtextColor}`}>No pets yet. Tap + to add one!</Text>
        ) : (
          pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={toPetCardShape(pet)}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              onEdit={() => (navigation as any).navigate('AddPet', {
                pet: {
                  ...toPetCardShape(pet),
                  type: mapTypeToInput(pet.type as unknown as number),
                  sex: mapSexToInput(pet.sex),
                  weight: pet.weightKg ? String(pet.weightKg) : '',
                  height: pet.heightCm ? String(pet.heightCm) : '',
                  dateOfBirth: pet.dateOfBirth ?? undefined,
                  dietaryNotes: pet.dietaryNotes ?? '',
                  favoriteFood: pet.favoriteFood ?? '',
                  additionalNotes: pet.additionalNotes ?? '',
                },
              })}
              onDelete={() => {}}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

