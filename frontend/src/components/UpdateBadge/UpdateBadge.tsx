import Badge from '../Badge';

interface UpdateBadgeProps {
  updateAvailable: boolean;
  latestVersion: string | null;
}

export function UpdateBadge({ updateAvailable, latestVersion }: UpdateBadgeProps) {
  if (!updateAvailable) return null;

  const label = latestVersion ? `Update available: v${latestVersion}` : 'Update available';

  return (
    <span role="status" aria-label={label} title={label}>
      <Badge colorClass="bg-yellow-100 text-yellow-800">
        {latestVersion ? `v${latestVersion}` : 'Update'}
      </Badge>
    </span>
  );
}
