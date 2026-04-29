import { useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type ScheduleRefresh = () => void;

export function useTelegramRealtime(supabaseClient: SupabaseClient | null, scheduleRefresh: ScheduleRefresh) {
  useEffect(() => {
    if (!supabaseClient) return;

    const channel = supabaseClient
      .channel('telegram-live-points')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telegram_locations' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telegram_profiles' }, scheduleRefresh)
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, scheduleRefresh]);
}
