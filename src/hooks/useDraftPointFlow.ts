import { useCallback, useState } from 'react';
import type { MapPointDraftInput } from '@/types';
import { clearHash } from '@/utils/hashNav';
import { createMapPointDraft } from '@/lib/supabase';

export function useDraftPointFlow(onStartAdding?: () => void) {
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [draftCoordinates, setDraftCoordinates] = useState<[number, number] | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftSubmitError, setDraftSubmitError] = useState<string | null>(null);
  const [draftSubmitSuccess, setDraftSubmitSuccess] = useState<string | null>(null);

  const handleCancelAddPoint = useCallback(() => {
    setIsAddingPoint(false);
    setDraftCoordinates(null);
    setDraftSubmitError(null);
  }, []);

  const clearDraftSubmitError = useCallback(() => {
    setDraftSubmitError(null);
  }, []);

  const handleToggleAddPoint = useCallback(() => {
    setDraftSubmitSuccess(null);
    setDraftSubmitError(null);
    clearHash();
    onStartAdding?.();
    setIsAddingPoint((prev) => !prev);
    setDraftCoordinates(null);
  }, [onStartAdding]);

  const handleSubmitDraft = useCallback(
    async (payload: MapPointDraftInput) => {
      if (isSubmittingDraft) return;
      setIsSubmittingDraft(true);
      setDraftSubmitError(null);
      setDraftSubmitSuccess(null);

      try {
        await createMapPointDraft(payload);
        setDraftSubmitSuccess('Заявка отправлена на модерацию.');
        setIsAddingPoint(false);
        setDraftCoordinates(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте позже.';
        setDraftSubmitError(message);
      } finally {
        setIsSubmittingDraft(false);
      }
    },
    [isSubmittingDraft]
  );

  return {
    isAddingPoint,
    draftCoordinates,
    setDraftCoordinates,
    isSubmittingDraft,
    draftSubmitError,
    draftSubmitSuccess,
    clearDraftSubmitError,
    handleCancelAddPoint,
    handleToggleAddPoint,
    handleSubmitDraft,
  };
}
