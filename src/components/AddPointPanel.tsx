import { useMemo, useState, type SyntheticEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faXmark, faLocationDot, faCircleCheck, faRotateLeft, faMapPin, faPlug } from '@fortawesome/free-solid-svg-icons';
import type { MapPointDraftInput, MapPointType } from '@/types';

interface AddPointPanelProps {
  coordinates: [number, number] | null;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (payload: MapPointDraftInput) => Promise<void>;
  onCancel: () => void;
  onClearCoordinates: () => void;
}

const TYPE_OPTIONS: Array<{ value: MapPointType; label: string; icon: IconDefinition; color: string }> = [
  { value: 'point', label: 'Точка', icon: faMapPin, color: '#2563eb' },
  { value: 'socket', label: 'Розетка', icon: faPlug, color: '#eab308' },
];

export function AddPointPanel({
  coordinates,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
  onClearCoordinates,
}: AddPointPanelProps) {
  const [type, setType] = useState<MapPointType>('point');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const hasCoordinates = Boolean(coordinates);
  const titleTrimmed = title.trim();
  const titleError = touched && !titleTrimmed ? 'Введите название.' : null;
  const hasErrors = !titleTrimmed || !hasCoordinates;

  const submitBlockReason = !hasCoordinates && !titleTrimmed
    ? 'Выберите место на карте и введите название'
    : !hasCoordinates
      ? 'Выберите место на карте'
      : 'Введите название';

  const coordinateText = useMemo(() => {
    if (!coordinates) return 'Координаты не выбраны';
    const [lng, lat] = coordinates;
    return `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
  }, [coordinates]);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!coordinates || !titleTrimmed) return;

    await onSubmit({
      type,
      title: titleTrimmed,
      description: description.trim() || null,
      coordinates,
      flag_is_meeting: false,
    });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)] sm:absolute sm:top-0 sm:right-0 sm:bottom-auto sm:inset-x-auto sm:max-h-none sm:w-[320px] sm:max-w-[calc(100%-1rem)] sm:rounded-xl sm:border sm:m-2 sm:shadow-lg"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Добавить объект</h2>
          <p className="text-xs text-neutral-500">Кликните по карте, чтобы выбрать место</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Закрыть"
          className="ml-3 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <FontAwesomeIcon icon={faXmark} className="text-base" aria-hidden />
        </button>
      </div>

      <form
        id="add-point-form"
        className="flex flex-col gap-3 px-4 pb-3"
        autoComplete="off"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-700">Тип</p>
          <div className="flex gap-2" role="group" aria-label="Тип объекта">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { setType(option.value); }}
                aria-pressed={type === option.value}
                className={`flex-1 cursor-pointer rounded-lg border py-2 text-sm font-medium transition ${
                  type === option.value
                    ? 'border-neutral-300 bg-neutral-50 text-neutral-900'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                <FontAwesomeIcon
                  icon={option.icon}
                  className="mr-1.5"
                  style={{ color: type === option.value ? option.color : '#9ca3af' }}
                  aria-hidden
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="add-point-title" className="mb-1 block text-xs font-medium text-neutral-700">
            Название
          </label>
          <input
            id="add-point-title"
            type="search"
            value={title}
            onChange={(event) => { setTitle(event.target.value); }}
            maxLength={120}
            placeholder="Например, Точка сбора у парка"
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500 [&::-webkit-search-cancel-button]:hidden"
          />
          {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
        </div>

        <div>
          <label htmlFor="add-point-description" className="mb-1 block text-xs font-medium text-neutral-700">
            Описание <span className="font-normal text-neutral-400">(необязательно)</span>
          </label>
          <textarea
            id="add-point-description"
            value={description}
            onChange={(event) => { setDescription(event.target.value); }}
            rows={2}
            maxLength={500}
            autoComplete="off"
            className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500"
          />
        </div>

        {hasCoordinates ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <FontAwesomeIcon icon={faCircleCheck} className="shrink-0 text-green-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-green-800">Место выбрано</p>
              <p className="truncate font-mono text-[11px] text-green-700">{coordinateText}</p>
            </div>
            <button
              type="button"
              onClick={onClearCoordinates}
              aria-label="Сбросить координаты"
              className="shrink-0 cursor-pointer text-green-400 hover:text-green-700 transition-colors"
            >
              <FontAwesomeIcon icon={faRotateLeft} className="text-sm" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5">
            <FontAwesomeIcon icon={faLocationDot} className="shrink-0 text-neutral-400" aria-hidden />
            <p className="text-sm text-neutral-500">Нажмите на карту, чтобы выбрать место</p>
          </div>
        )}

        {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</p>}
      </form>
      </div>

      {/* Sticky-футер с кнопкой отправки */}
      <div
        className="shrink-0 border-t border-neutral-100 px-4 pt-3 pb-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="submit"
          form="add-point-form"
          disabled={isSubmitting || hasErrors}
          title={hasErrors ? submitBlockReason : undefined}
          className="w-full cursor-pointer rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}
