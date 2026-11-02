import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/i18n';
import { useSession } from './session';

/** docs/DESIGN.md §5 LanguageToggle — "persists in profile". No-op in demo mode. */
export function useUpdateProfileLanguage() {
  const session = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: Language) => {
      if (!supabase || session.status !== 'signed-in') return;
      const { error } = await supabase.from('profiles').update({ language }).eq('id', session.user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session'] }),
  });
}
