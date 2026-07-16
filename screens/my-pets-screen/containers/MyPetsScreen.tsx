import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PetCard } from '../components';
import { getPets, deletePet, PetResponse } from '../../../services/pets';
import ActionPopup from '../../../components/shared/ActionPopup';

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function MyPetsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const { currentUser } = useAuth();
  const { t, tEnum } = useLocale();

  // Localized display shape for a pet (sex via tEnum, age via the yrs unit).
  const toPetCardShape = (p: PetResponse) => ({
    id: p.id,
    name: p.name,
    breed: p.breed,
    sex: p.sex === 1 || p.sex === 2 ? tEnum('sex', p.sex) : t('pets.unspecified'),
    age: p.ageYears ? `${p.ageYears} ${t('pets.yearsShort')}` : t('pets.unknown'),
    weight: p.weightKg ? `${p.weightKg} kg` : '-',
    height: p.heightCm ? `${p.heightCm} cm` : '-',
    image: resolveUrl(p.photoUrl),
  });

  const [pets, setPets] = useState<PetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeletePet, setPendingDeletePet] = useState<PetResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Tracks the last refreshKey we fetched for — re-fetch only when it changes
  const prevRefreshKeyRef = useRef<number | undefined>(undefined);
  const hasFetchedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;

      const refreshKey: number | undefined = (route.params as any)?.refreshKey;
      const needsFetch = !hasFetchedOnceRef.current || refreshKey !== prevRefreshKeyRef.current;

      if (!needsFetch) return;

      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getPets(currentUser.id);
          if (!cancelled) {
            setPets(data);
            hasFetchedOnceRef.current = true;
            prevRefreshKeyRef.current = refreshKey;
          }
        } catch (err: any) {
          if (!cancelled) setError(err?.message ?? t('pets.loadError'));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [currentUser, route.params])
  );

  const handleDelete = (pet: PetResponse) => {
    setPendingDeletePet(pet);
  };

  const confirmDelete = async () => {
    if (!pendingDeletePet) return;
    const pet = pendingDeletePet;
    setPendingDeletePet(null);
    setDeletingId(pet.id);
    try {
      await deletePet(pet.id);
      setPets((prev) => prev.filter((p) => p.id !== pet.id));
    } catch (err: any) {
      setDeleteError(err?.message ?? t('pets.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('pets.title')}
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('AddPet')}
          className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <Ionicons name="add" size={24} color="#00C870" />
        </TouchableOpacity>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#00C870" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text className={`mt-10 text-center ${subtextColor}`}>{error}</Text>
        ) : pets.length === 0 ? (
          <Text className={`mt-10 text-center ${subtextColor}`}>{t('pets.noPets')}</Text>
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
              onEdit={() =>
                (navigation as any).navigate('AddPet', {
                  pet: {
                    ...toPetCardShape(pet),
                    petTypeNum: pet.type,
                    sexNum: pet.sex,
                    weight: pet.weightKg ? String(pet.weightKg) : '',
                    height: pet.heightCm ? String(pet.heightCm) : '',
                    dateOfBirth: pet.dateOfBirth ?? undefined,
                    dietaryNotes: pet.dietaryNotes ?? '',
                    favoriteFood: pet.favoriteFood ?? '',
                    additionalNotes: pet.additionalNotes ?? '',
                    photos: pet.photos,
                  },
                })
              }
              onDelete={() => handleDelete(pet)}
              isDeleting={deletingId === pet.id}
            />
          ))
        )}
      </ScrollView>

      <ActionPopup
        visible={!!pendingDeletePet}
        mode="error"
        text={t('pets.deleteConfirm', { name: pendingDeletePet?.name ?? t('pets.thisPet') })}
        buttonText={t('common.delete')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeletePet(null)}
      />

      <ActionPopup
        visible={!!deleteError}
        mode="error"
        text={deleteError ?? ''}
        buttonText={t('common.ok')}
        onConfirm={() => setDeleteError(null)}
        onCancel={() => setDeleteError(null)}
      />
    </ScreenLayout>
  );
}
