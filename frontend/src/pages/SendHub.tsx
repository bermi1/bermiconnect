import { Link } from 'react-router-dom';
import { MessageSquareText, FileSpreadsheet, Users, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui';

const CHOICES = [
  { to: '/app/send/quick', icon: MessageSquareText, t: 'Quick SMS', d: 'Type a message and a few numbers.', eg: 'A reminder to 5 teachers' },
  { to: '/app/send/excel', icon: FileSpreadsheet, t: 'Send from Excel', d: 'Each row of your sheet gets its own message.', eg: 'Exam results to every parent' },
  { to: '/app/campaigns/new', icon: Users, t: 'Campaign to a group', d: 'One message to a saved contact group.', eg: 'Meeting notice to Form 4 parents' },
];

export default function SendHub() {
  return (
    <div className="animate-rise max-w-4xl">
      <PageHeader title="Tuma SMS" subtitle="How would you like to send?" />
      <div className="grid gap-3">
        {CHOICES.map(({ to, icon: Icon, t, d, eg }, i) => (
          <Link key={to} to={to}
            className={'press group flex items-center gap-4 sm:gap-6 rounded-3xl p-5 sm:p-7 border-2 hover:-translate-y-0.5 hover:shadow-lift ' + (i === 1 ? 'bg-brand text-white border-brand' : 'bg-white border-line hover:border-brand/40')}>
            <span className={'h-14 w-14 sm:h-16 sm:w-16 rounded-2xl grid place-items-center shrink-0 ' + (i === 1 ? 'bg-amber text-ink' : 'bg-brand-50 text-brand')}><Icon className="h-7 w-7" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl sm:text-2xl font-extrabold tracking-tight">{t}</span>
              <span className={'block text-[15px] ' + (i === 1 ? 'text-white/80' : 'text-ink-500')}>{d}</span>
              <span className={'block text-[13px] mt-1 ' + (i === 1 ? 'text-amber' : 'text-ink-400')}>For example: {eg}</span>
            </span>
            <ChevronRight className={'h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1 ' + (i === 1 ? 'text-white/70' : 'text-ink-300')} />
          </Link>
        ))}
      </div>
    </div>
  );
}
