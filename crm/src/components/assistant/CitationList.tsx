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
    <div className="mt-4 pt-3 border-t dark:border-slate-800">
      <p className="text-xs text-slate-500 mb-2 font-medium">Источники:</p>
      <div className="space-y-2">
        {citations.map((citation, i) => {
          const Icon = iconMap[citation.type];
          
          return (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
            >
              <Icon size={14} className="mt-0.5 text-indigo-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {citation.title}
                </p>
                {citation.excerpt && (
                  <p className="text-slate-500 mt-0.5 line-clamp-2">
                    {citation.excerpt}
                  </p>
                )}
                {citation.url && (
                  <a
                    href={citation.url}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 inline-block"
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
