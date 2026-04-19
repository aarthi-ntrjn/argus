import { useRef, useState, useEffect } from 'react';
import { MessageSquarePlus, ChevronDown, Bug, Lightbulb } from 'lucide-react';
import { Button } from '../Button';
import { buildBugReportUrl, buildFeatureRequestUrl } from '../../config/feedback';

export default function FeedbackDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(o => !o)}
        aria-label="Feedback"
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1"
      >
        <MessageSquarePlus size={11} aria-hidden="true" />
        Feedback
        <ChevronDown size={10} aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[180px] py-1">
          <a
            href={buildBugReportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Bug size={12} className="text-red-500 shrink-0" aria-hidden="true" />
            Report a Bug
          </a>
          <a
            href={buildFeatureRequestUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Lightbulb size={12} className="text-yellow-500 shrink-0" aria-hidden="true" />
            Request a Feature
          </a>
        </div>
      )}
    </div>
  );
}
