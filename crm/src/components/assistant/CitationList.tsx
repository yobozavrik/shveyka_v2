import React from 'react';
import { FileText, Database, Link } from 'lucide-react';

interface Citation {
  type: 'document' | 'table' | 'api';
  source: string;
  title: string;
  url?: string;
  excerpt?: string;
}

interface CitationListProps {
  citations: Citation[];
}

const iconMap = {
  document: FileText,
  table: Database,
  api: Link
};

export default function CitationList({ citations }: CitationListProps) {
  if (!citations || citations.length === 0) return null;
  
  return (
    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
      <p className="text-xs text-[var(--text-3)] mb-2 font-medium">Джерела:</p>
      <div className="space-y-2">
        {citations.map((citation, i) => {
          const Icon = iconMap[citation.type];

          return (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-[var(--text-2)]"
            >
              <Icon size={14} className="mt-0.5 text-[var(--accent)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--text-1)]">
                  {citation.title}
                </p>
                {citation.excerpt && (
                  <p className="text-[var(--text-3)] mt-0.5 line-clamp-2">
                    {citation.excerpt}
                  </p>
                )}
                {citation.url && (
                  <a
                    href={citation.url}
                    className="text-[var(--accent)] hover:underline mt-0.5 inline-block"
                  >
                    {citation.source}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
