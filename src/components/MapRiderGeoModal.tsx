import type { Feature } from '@/types/geojson';
import { RiderGeoModal } from '@/components/RiderGeoModal';

interface MapRiderGeoModalProps {
  isOpen: boolean;
  riders: Feature[];
  onClose: () => void;
}

export function MapRiderGeoModal({ isOpen, riders, onClose }: MapRiderGeoModalProps) {
  if (!isOpen) return null;

  return <RiderGeoModal riders={riders} onClose={onClose} />;
}
