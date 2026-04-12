import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSession, getSessionOutput } from '../services/api';
import SessionDetail from '../components/SessionDetail/SessionDetail';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import SessionMetaRow from '../components/SessionMetaRow/SessionMetaRow';
import { useSettings } from '../hooks/useSettings';


export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [settings, updateSetting] = useSettings();
  const displayMode = settings.outputDisplayMode ?? 'focused';

  function toggleMode() {
    updateSetting('outputDisplayMode', displayMode === 'focused' ? 'verbose' : 'focused');
  }
  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });

  const { data: outputPage, isLoading: outputLoading } = useQuery({
    queryKey: ['session-output', id],
    queryFn: () => getSessionOutput(id!, { limit: 100 }),
    enabled: !!id,
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
          ← Back to Dashboard
        </button>
        <div className="text-center text-gray-500 py-16">Session not found.</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Always-visible header — shrink-0 sibling of the scrollable area */}
      <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-6">
        <div className="max-w-4xl mx-auto w-full">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 mb-4 py-2 flex items-center gap-1">
            ← Back to Dashboard
          </button>
          <div className="bg-white rounded-lg shadow p-4" data-tour-id="session-status">
            <SessionMetaRow session={session} />
            {session.summary && (
              <p className="text-gray-600 text-sm mt-2">{session.summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Output stream + prompt bar — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col px-4 md:px-8 pb-4 md:pb-6 mt-4">
        <div className="max-w-4xl mx-auto w-full flex-1 min-h-0 flex flex-col">

          <div data-tour-id="session-output-stream" className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
            <div className="px-3 py-1 border-b border-gray-200 shrink-0 flex items-center justify-between bg-gray-50">
              <span className="text-xs text-gray-500 font-mono truncate">Session {session.id}</span>
              <button
                onClick={toggleMode}
                className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 shrink-0 ml-2"
              >
                {displayMode === 'focused' ? 'Focused' : 'Verbose'}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-900 rounded-b-lg">
              {outputLoading ? (
                <div className="p-8 text-center text-gray-400">Loading output...</div>
              ) : (
                <SessionDetail
                  sessionId={session.id}
                  items={outputPage?.items ?? []}
                  displayMode={displayMode}
                  dark
                />
              )}
            </div>
          </div>

          <div data-tour-id="session-prompt-bar" className="bg-white rounded-lg shadow p-4 mt-4 shrink-0">
            <SessionPromptBar session={session} />
          </div>

        </div>
      </div>

    </div>
  );
}
