import type { Repository } from '../../types';
import { RepoBranchChip, RepoNameLink, RepoPrIndicator } from '../RepoLinks';

interface Props {
  repo: Repository;
}

export default function RepoContextBar({ repo }: Props) {
  return (
    <div className="bg-white rounded-lg shadow px-3 py-2 mb-2">
      <h2 className="text-lg font-semibold text-gray-900">
        <RepoNameLink repo={repo} />
      </h2>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <p className="text-xs text-gray-500 font-mono truncate max-w-full">{repo.path}</p>
        <RepoBranchChip repo={repo} />
        <RepoPrIndicator repo={repo} />
      </div>
    </div>
  );
}
