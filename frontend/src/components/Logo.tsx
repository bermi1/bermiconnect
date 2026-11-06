import { cx } from './ui';
import markNavy from '../assets/bermi-mark.png';
import markWhite from '../assets/bermi-mark-white.png';

export function LogoMark({ className = 'h-8 w-8', dark }: { className?: string; dark?: boolean }) {
  return <img src={dark ? markWhite : markNavy} alt="" aria-hidden className={cx('object-contain', className)} />;
}
export function Logo({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark dark={dark} className="h-7 w-8" />
      <span className={cx('text-[19px] font-extrabold tracking-[-0.02em]', dark ? 'text-white' : 'text-ink')}>
        Bermi<span className={dark ? 'text-amber' : 'text-brand'}> Connect</span>
      </span>
    </span>
  );
}
