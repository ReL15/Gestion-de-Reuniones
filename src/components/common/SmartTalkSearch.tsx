import React, { useState, useRef, useEffect } from 'react';
import { Search, Building2, User, BookOpen, Music, X } from 'lucide-react';
import { Congregation, Speaker, Talk } from '../../types/database';

interface SmartSearchResult {
  type: 'congregation' | 'speaker' | 'talk';
  congregation: Congregation;
  speaker?: Speaker;
  talk?: Talk;
  matchHighlight: string;
}

interface SmartTalkSearchProps {
  congregations: Congregation[];
  speakers: Speaker[];
  talks: Talk[];
  onSelectResult: (selection: {
    congregation: Congregation;
    speaker?: Speaker;
    talk?: Talk;
  }) => void;
  placeholder?: string;
}

export const SmartTalkSearch: React.FC<SmartTalkSearchProps> = ({
  congregations,
  speakers,
  talks,
  onSelectResult,
  placeholder = 'Buscar rápidamente congregación, conferenciante o tema...',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results: SmartSearchResult[] = [];
  const cleanQuery = query.trim().toLowerCase();

  if (cleanQuery.length >= 2) {
    // 1. Search Congregations
    congregations.forEach((cong) => {
      if (cong.name.toLowerCase().includes(cleanQuery)) {
        results.push({
          type: 'congregation',
          congregation: cong,
          matchHighlight: cong.name,
        });
      }
    });

    // 2. Search Speakers
    speakers.forEach((spk) => {
      if (spk.full_name.toLowerCase().includes(cleanQuery)) {
        const cong = congregations.find((c) => c.id === spk.congregation_id);
        if (cong) {
          results.push({
            type: 'speaker',
            congregation: cong,
            speaker: spk,
            matchHighlight: spk.full_name,
          });
        }
      }
    });

    // 3. Search Talks
    talks.forEach((tlk) => {
      if (
        tlk.title.toLowerCase().includes(cleanQuery) ||
        (tlk.theme_number && String(tlk.theme_number).includes(cleanQuery))
      ) {
        const spk = tlk.speaker_id ? speakers.find((s) => s.id === tlk.speaker_id) : undefined;
        const cong = congregations.find((c) => c.id === (tlk.congregation_id || spk?.congregation_id));
        if (cong) {
          results.push({
            type: 'talk',
            congregation: cong,
            speaker: spk,
            talk: tlk,
            matchHighlight: tlk.title,
          });
        }
      }
    });
  }

  const handleSelect = (item: SmartSearchResult) => {
    onSelectResult({
      congregation: item.congregation,
      speaker: item.speaker,
      talk: item.talk,
    });
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && cleanQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No se encontraron coincidencias para &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="p-1 divide-y divide-slate-100">
              {results.slice(0, 8).map((item, idx) => (
                <button
                  key={`${item.type}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-2.5 hover:bg-indigo-50/70 rounded-lg transition-colors flex items-start gap-3 group"
                >
                  <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0">
                    {item.type === 'congregation' && <Building2 className="w-4 h-4" />}
                    {item.type === 'speaker' && <User className="w-4 h-4" />}
                    {item.type === 'talk' && <BookOpen className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600">
                        {item.type === 'congregation' && 'Congregación'}
                        {item.type === 'speaker' && 'Conferenciante'}
                        {item.type === 'talk' && 'Discurso / Conferencia'}
                      </span>
                      {item.talk && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                          <Music className="w-3 h-3 text-slate-400" /> Canto {item.talk.song_number}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-800 truncate mt-0.5">
                      {item.type === 'congregation' && item.congregation.name}
                      {item.type === 'speaker' && item.speaker?.full_name}
                      {item.type === 'talk' && item.talk?.title}
                    </p>

                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                      {item.type !== 'congregation' && (
                        <span>{item.congregation.name}</span>
                      )}
                      {item.type === 'talk' && item.speaker && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.speaker.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
