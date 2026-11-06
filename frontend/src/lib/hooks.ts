import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { AccountStats, Group, SenderId, Template } from './types';

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<AccountStats>('/account/stats') });
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => api.get<Group[]>('/groups', { per_page: 200 }) });
export const useTemplates = () => useQuery({ queryKey: ['templates'], queryFn: () => api.get<Template[]>('/templates', { per_page: 200 }) });
export const useSenderIds = () => useQuery({ queryKey: ['sender-ids'], queryFn: () => api.get<SenderId[]>('/sender-ids', { per_page: 200 }) });
export const useBalance = () => useQuery({ queryKey: ['balance'], queryFn: () => api.get<{ balance_tzs: number | string; price_per_sms_tzs: number }>('/balance') });
export const groupSize = (g: Group) => g.contact_count ?? g.member_count;
