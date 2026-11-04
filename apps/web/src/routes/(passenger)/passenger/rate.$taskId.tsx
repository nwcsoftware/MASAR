import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Camera, EyeOff, FileQuestion, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError } from '@/components/form';
import { StarsInput } from '@/components/passenger/stars';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePassengerHome, useRatingOptions, useSubmitRating } from '@/features/passenger/queries';
import { RATING_CATEGORIES, SINGLE_CHOICE, type PassengerTrip, type RatingCategory } from '@/features/passenger/types';
import { useLocalizedName } from '@/lib/i18n-data';
import { useNow } from '@/lib/use-now';
import type { RatingOption } from '@/mocks/fixtures';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(passenger)/passenger/rate/$taskId')({
  component: RatePage,
});

const MAX_PHOTOS = 4;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_MB = 8;

function RatingForm({ trip, options, personId }: { trip: PassengerTrip; options: RatingOption[]; personId: string }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const navigate = useNavigate();
  const submit = useSubmitRating();
  const existing = trip.my_rating;
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [chosen, setChosen] = useState<string[]>(existing?.option_ids ?? []);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (option: RatingOption) => {
    const single = SINGLE_CHOICE.includes(option.category as RatingCategory);
    setChosen((current) => {
      if (current.includes(option.id)) return current.filter((id) => id !== option.id);
      const others = single ? current.filter((id) => options.find((o) => o.id === id)?.category !== option.category) : current;
      return [...others, option.id];
    });
  };

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!stars) return setProblem('rating.errors.stars');
        setProblem(null);
        submit.mutate(
          { taskId: trip.id, personId, stars, optionIds: chosen, comment, photos },
          { onSuccess: () => void navigate({ to: '/passenger/trips/$taskId', params: { taskId: trip.id } }) },
        );
      }}
    >
      <section className="space-y-2">
        <h2 className="text-base font-bold">{t('rating.overall')}</h2>
        <StarsInput value={stars} onChange={setStars} id="rating-stars" />
        {problem === 'rating.errors.stars' && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {t('rating.errors.stars')}
          </p>
        )}
      </section>

      {RATING_CATEGORIES.map((category) => {
        const group = options.filter((o) => o.category === category && o.is_active);
        if (!group.length) return null;
        const single = SINGLE_CHOICE.includes(category);
        return (
          <fieldset key={category} className="space-y-2" data-category={category}>
            <legend className="text-base font-bold">
              {t(`rating.categories.${category}`)}
              <span className="ms-2 text-xs font-normal text-fg-3">{single ? t('rating.pickOne') : t('rating.pickAny')}</span>
            </legend>
            <div className="flex flex-wrap gap-2" role={single ? 'radiogroup' : 'group'}>
              {group.map((option) => {
                const on = chosen.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role={single ? 'radio' : 'checkbox'}
                    aria-checked={on}
                    onClick={() => toggle(option)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm font-semibold transition-colors',
                      on ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border bg-surface text-fg-2 hover:bg-surface-2',
                    )}
                  >
                    {name({ label: option.label, label_ar: option.label_ar }, 'label')}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <Field id="rating-comment" label={t('rating.comment')}>
        <Textarea id="rating-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      </Field>

      <Field
        id="rating-photos"
        label={t('rating.photos')}
        hint={photos.length ? t('rating.photosChosen', { count: photos.length }) : t('rating.photosHint', { max: MAX_PHOTOS })}
        error={problem && problem !== 'rating.errors.stars' ? problem : undefined}
      >
        <div className="flex items-center gap-2">
          <Camera className="size-5 text-fg-3" aria-hidden="true" />
          <Input
            id="rating-photos"
            type="file"
            accept={PHOTO_TYPES.join(',')}
            multiple
            capture="environment"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > MAX_PHOTOS) return setProblem('rating.errors.tooManyPhotos');
              if (files.some((f) => !PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO_MB * 1024 * 1024)) return setProblem('rating.errors.photo');
              setProblem(null);
              setPhotos(files);
            }}
          />
        </div>
      </Field>

      <p className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-2">
        <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t('rating.anonymous')}
      </p>
      <FormError error={submit.error} />
      <Button type="submit" size="hero" disabled={submit.isPending}>
        {submit.isPending ? t('common.saving') : existing ? t('rating.update') : t('rating.submit')}
      </Button>
    </form>
  );
}

/** §5 / §14 — rate a finished trip: driver, trip, road, cleanliness, vehicle, stars, comment, photos. */
function RatePage() {
  const { t } = useTranslation();
  const { taskId } = Route.useParams();
  const home = usePassengerHome();
  const options = useRatingOptions();
  const now = useNow();

  const back = (
    <Link to="/passenger/trips/$taskId" params={{ taskId }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500">
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {t('passenger.backToTrip')}
    </Link>
  );

  if (home.isPending || options.isPending) return <Skeleton className="h-96 w-full" />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />;
  const trip = home.data.trips.find((x) => x.id === taskId);
  if (!trip || !home.data.person_id) return <EmptyState icon={FileQuestion} title={t('passenger.tripNotFound')} />;

  const locked = trip.my_rating && now > new Date(trip.my_rating.editable_until).getTime();
  return (
    <div className="space-y-5">
      {back}
      <div>
        <h1 className="text-xl font-extrabold">{t('rating.title')}</h1>
        <p className="text-sm text-fg-2">{trip.title}</p>
      </div>
      {trip.status !== 'completed' ? (
        <EmptyState icon={Lock} title={t('rating.errors.notFinished')} />
      ) : locked ? (
        <EmptyState icon={Lock} title={t('passenger.ratingLocked')} />
      ) : (
        <RatingForm trip={trip} options={options.data} personId={home.data.person_id} />
      )}
    </div>
  );
}
