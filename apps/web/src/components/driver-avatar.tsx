import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/format';

/** Avatar tinted by live status colour (design/preview.html driver list). */
export function DriverAvatar({
  name,
  photoUrl,
  colorVar,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  colorVar?: string;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback
        // inline so the status tint wins over the fallback's default brand utilities
        style={
          colorVar
            ? {
                color: `color-mix(in srgb, ${colorVar} 70%, var(--text))`,
                backgroundColor: `color-mix(in srgb, ${colorVar} 18%, transparent)`,
              }
            : undefined
        }
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
