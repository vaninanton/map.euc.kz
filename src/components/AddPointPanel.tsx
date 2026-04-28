import { useMemo, useState } from 'react';
import type { MapPointDraftInput, MapPointType } from '@/types';

interface AddPointPanelProps {
  coordinates: [number, number] | null;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (payload: MapPointDraftInput) => Promise<void>;
  onCancel: () => void;
}

const TYPE_OPTIONS: Array<{ value: MapPointType; label: string }> = [
  { value: 'point', label: 'Точка' },
  { value: 'socket', label: 'Розетка' },
];

export function AddPointPanel({
  coordinates,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: AddPointPanelProps) {
  const [type, setType] = useState<MapPointType>('point');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isMeeting, setIsMeeting] = useState(false);
  const [touched, setTouched] = useState(false);

  const hasCoordinates = Boolean(coordinates);
  const titleTrimmed = title.trim();
  const titleError = touched && !titleTrimmed ? 'Введите название.' : null;
  const coordinatesError = touched && !hasCoordinates ? 'Выберите место кликом по карте.' : null;
  const hasErrors = Boolean(titleError || coordinatesError);

  const coordinateText = useMemo(() => {
    if (!coordinates) return 'Координаты не выбраны';
    const [lng, lat] = coordinates;
    return `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
  }, [coordinates]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!coordinates || !titleTrimmed) return;

    await onSubmit({
      type,
      title: titleTrimmed,
      description: description.trim() || null,
      coordinates,
      flag_is_meeting: type === 'point' ? isMeeting : false,
    });
  };

  return (
    <div className="absolute top-0 right-0 z-20 w-[320px] max-w-[calc(100%-1rem)] rounded-xl border border-neutral-200/80 bg-white/95 p-4 shadow-lg shadow-neutral-900/10 backdrop-blur-xl overlay-safe-inset m-2">
      <h2 className="text-sm font-semibold text-neutral-900">Добавить объект</h2>
      <p className="mt-1 text-xs text-neutral-600">Кликните по карте, затем заполните форму и отправьте заявку.</p>

      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="add-point-type" className="mb-1 block text-xs font-medium text-neutral-700">
            Тип
          </label>
          <select
            id="add-point-type"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as MapPointType;
              setType(nextType);
              if (nextType === 'socket') {
                setIsMeeting(false);
              }
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="add-point-title" className="mb-1 block text-xs font-medium text-neutral-700">
            Название
          </label>
          <input
            id="add-point-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            maxLength={120}
            placeholder="Например, Точка сбора у парка"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500"
          />
          {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
        </div>

        <div>
          <label htmlFor="add-point-description" className="mb-1 block text-xs font-medium text-neutral-700">
            Описание
          </label>
          <textarea
            id="add-point-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={3}
            maxLength={500}
            placeholder="Дополнительная информация (необязательно)"
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500"
          />
        </div>

        {type === 'point' && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={isMeeting}
              onChange={(event) => {
                setIsMeeting(event.target.checked);
              }}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600"
            />
            Место встречи
          </label>
        )}

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <p className="text-xs font-medium text-neutral-700">Координаты</p>
          <p className="mt-0.5 text-xs text-neutral-600">{coordinateText}</p>
          {coordinatesError && <p className="mt-1 text-xs text-red-600">{coordinatesError}</p>}
        </div>

        {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</p>}

        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? 'Отправка...' : 'Отправить'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
