import React from "react";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const Skeleton = ({ className = "", style }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-primary/10 ${className}`}
    style={style}
  />
);

const SkeletonText = ({ className = "" }: SkeletonProps) => (
  <Skeleton className={`h-4 w-full ${className}`} />
);

const SkeletonCircle = ({ className = "" }: SkeletonProps) => (
  <Skeleton className={`rounded-full ${className}`} />
);

const RecipeContainerSkeleton = () => (
  <div className="group flex flex-col rounded-2xl border border-primary/10 bg-secondary p-5 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex-1 mb-3 sm:mb-0">
      <SkeletonText className="mb-2 h-7 w-3/4 rounded-lg" />
      <SkeletonText className="h-4 w-2/5 rounded-full" />
    </div>
    <div className="flex w-24 items-center justify-end gap-2 text-sm">
      <SkeletonCircle className="h-4 w-4" />
      <SkeletonText className="h-4 w-12 rounded-md" />
    </div>
  </div>
);

export const HomePageSkeleton = ({
  showGuestCta = false,
}: {
  showGuestCta?: boolean;
}) => (
  <section className="relative flex min-h-screen flex-col overflow-hidden bg-background">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-28 left-[-8%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-accent)_34%,transparent)_0%,transparent_72%)] blur-2xl" />
      <div className="absolute right-[-10%] top-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-primary)_10%,transparent)_0%,transparent_72%)] blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-64 w-[32rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-accent)_15%,transparent)_0%,transparent_70%)] blur-2xl" />
    </div>

    <article className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-6 pt-8 md:px-8 md:pt-12">
      <div className="rounded-3xl border border-primary/10 bg-background/80 p-5 text-center shadow-[0_25px_65px_rgba(0,0,0,0.06)] backdrop-blur-sm md:p-8">
        <SkeletonText className="mx-auto h-10 w-3/4 rounded-xl" />
        <SkeletonText className="mx-auto mt-3 h-4 w-5/6 rounded-full" />
        <SkeletonText className="mx-auto mt-2 h-4 w-2/3 rounded-full" />

        <div className="mt-6">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>

        <section className="space-y-4 pb-3 pt-5">
          <div className="rounded-[2rem] border border-primary/5 bg-secondary/50 p-1.5 shadow-inner">
            <div className="mb-3 px-2 pt-2">
              <SkeletonText className="h-4 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-full" />
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary/5 bg-secondary/50 p-1.5 shadow-inner">
            <div className="mb-3 px-2 pt-2">
              <SkeletonText className="h-4 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-full" />
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary/5 bg-secondary/50 p-1.5 shadow-inner">
            <div className="mb-3 px-2 pt-2">
              <SkeletonText className="h-4 w-40 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-full" />
              ))}
            </div>
          </div>

          <Skeleton className="h-12 w-full rounded-full" />

          {showGuestCta && (
            <div className="rounded-2xl border border-primary/15 bg-secondary/40 p-4 text-left backdrop-blur-sm">
              <SkeletonText className="h-5 w-48 rounded-full" />
              <SkeletonText className="mt-3 h-4 w-2/3 rounded-full" />
              <SkeletonText className="mt-2 h-4 w-3/4 rounded-full" />
              <SkeletonText className="mt-2 h-4 w-1/2 rounded-full" />
              <SkeletonText className="mt-4 h-4 w-full rounded-full" />
              <Skeleton className="mt-4 h-10 w-52 rounded-full" />
            </div>
          )}
        </section>
      </div>
    </article>

    <section className="relative z-10 mx-5 mb-6 flex flex-col gap-4 rounded-3xl border border-primary/10 bg-[linear-gradient(160deg,_color-mix(in_srgb,var(--color-secondary)_88%,white)_0%,_color-mix(in_srgb,var(--color-accent)_18%,white)_100%)] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:mx-8 md:mb-10 md:flex-row md:p-7">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex-1">
          <SkeletonText className="h-4 w-full rounded-full" />
          <SkeletonText className="mt-2 h-4 w-5/6 rounded-full" />
          <SkeletonText className="mt-2 h-4 w-4/6 rounded-full" />
        </div>
      ))}
    </section>
  </section>
);

export const RecipePageSkeleton = () => (
  <div className="mobile-page-enter min-h-screen bg-background">
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-secondary p-6 sm:p-8">
        <SkeletonText className="mb-4 h-6 w-28 rounded-full" />
        <SkeletonText className="mb-3 h-10 w-2/3 rounded-xl" />
        <SkeletonText className="mb-2 h-5 w-full" />
        <SkeletonText className="mb-6 h-5 w-5/6" />

        <div className="flex flex-wrap gap-2">
          <SkeletonText className="h-8 w-24 rounded-full" />
          <SkeletonText className="h-8 w-32 rounded-full" />
          <SkeletonText className="h-8 w-28 rounded-full" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/10 bg-secondary p-6">
          <SkeletonText className="mb-4 h-8 w-36 rounded-lg" />
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-primary/10 bg-background px-3 py-2"
              >
                <SkeletonText className="h-5 w-32 rounded-full" />
                <SkeletonText className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-secondary p-6">
          <SkeletonText className="mb-4 h-8 w-40 rounded-lg" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-primary/12 bg-background/95 px-4 py-4 sm:px-5"
              >
                <div className="flex items-start gap-3.5">
                  <SkeletonCircle className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1 pt-1">
                    <SkeletonText className="h-4 w-full rounded-full" />
                    <SkeletonText className="mt-2 h-4 w-5/6 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

export const RecipesPageSkeleton = ({
  showSearch = false,
  showGuestBanner = false,
}: {
  showSearch?: boolean;
  showGuestBanner?: boolean;
}) => (
  <div className="mobile-page-enter flex flex-col max-w-4xl mx-auto w-full bg-background min-h-screen p-4 md:p-6">
    <article className="flex-1">
      <div className="ambient-gradient-card mb-6 rounded-3xl border border-accent/35 bg-secondary p-6 text-center md:mb-8 sm:p-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <SkeletonText className="h-10 w-56 rounded-xl" />
          <SkeletonText className="h-4 w-72 rounded-lg" />
        </div>
      </div>

      {showSearch && (
        <div className="mb-6">
          <Skeleton className="mx-auto h-12 w-full max-w-2xl rounded-full" />
          <SkeletonText className="mx-auto mt-2 h-4 w-48 rounded-full" />
        </div>
      )}

      {showGuestBanner && (
        <div className="mb-6 rounded-2xl border border-accent/35 bg-secondary p-4 text-center">
          <SkeletonText className="mx-auto h-4 w-4/5 rounded-full" />
          <SkeletonText className="mx-auto mt-2 h-4 w-3/5 rounded-full" />
          <div className="mt-4 flex items-center justify-center gap-3">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      )}

      <div className="space-y-3 md:space-y-4">
        {Array.from({ length: showSearch ? 6 : 5 }).map((_, index) => (
          <div
            key={index}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <RecipeContainerSkeleton />
          </div>
        ))}
      </div>

      {showSearch && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
      )}
    </article>
  </div>
);

export const FridgePageSkeleton = () => (
  <div className="mobile-page-enter container mx-auto grid grid-cols-1 items-start gap-5 bg-background px-4 py-5 sm:px-6 md:grid-cols-3 md:gap-6">
    <div className="w-full space-y-4">
      <div className="ambient-gradient-card rounded-2xl border border-accent/30 bg-accent/10 p-3 sm:p-3.5 space-y-3">
        <div className="space-y-2 px-1">
          <SkeletonText className="h-4 w-32 rounded-full" />
          <SkeletonText className="h-3 w-52 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="min-h-16 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="mobile-card-enter ambient-gradient-card w-full rounded-2xl border border-primary/10 bg-secondary p-5 shadow-sm sm:p-6">
        <div className="flex w-full items-center justify-between rounded-xl border border-primary/10 bg-background px-4 py-3">
          <div className="space-y-2 text-left">
            <SkeletonText className="h-6 w-36 rounded-lg" />
            <SkeletonText className="h-3 w-40 rounded-full" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>
    </div>

    <div className="mobile-card-enter mobile-card-delay-1 ambient-gradient-card md:col-span-2 w-full rounded-xl border border-primary/5 bg-secondary p-5 shadow-sm sm:p-6 min-h-[320px] md:min-h-[380px] flex flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SkeletonText className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4 mt-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

export const ShoppingListPageSkeleton = () => (
  <div className="mx-auto min-h-screen w-full max-w-4xl bg-background px-4 py-6 sm:px-6">
    <div className="mb-6 overflow-hidden rounded-3xl border border-accent/35 bg-secondary p-6">
      <SkeletonText className="h-10 w-56 rounded-xl" />
      <SkeletonText className="mt-2 h-4 w-80 rounded-full" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>

    <div className="mb-5 rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
      <SkeletonText className="mb-2 h-4 w-36 rounded-full" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>
    </div>

    <div className="rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SkeletonText className="h-5 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-background px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2 flex-1">
              <Skeleton className="h-4 w-4 rounded-full" />
              <SkeletonText className="h-4 w-2/3 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const TableSkeleton = ({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) => (
  <div className="w-full overflow-hidden rounded-lg border border-primary/10 px-0 shadow-sm">
    <table className="min-w-full bg-secondary">
      <thead className="bg-primary/10">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="py-3 px-4">
              <SkeletonText className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-b border-primary/5">
            {Array.from({ length: columns }).map((_, j) => (
              <td key={j} className="py-3 px-4">
                <SkeletonText className="h-4 w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const AdminDashboardSkeleton = ({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) => (
  <div className="mobile-page-enter container mx-auto p-4 bg-background min-h-screen">
    <SkeletonText className="mb-6 h-10 w-64 rounded-xl" />
    <div className="mb-12">
      <SkeletonText className="mb-4 h-8 w-48 rounded-lg" />
      <TableSkeleton rows={rows} columns={columns} />
      <div className="mt-4 flex items-center justify-center gap-4">
        <Skeleton className="h-10 w-24 rounded-full" />
        <SkeletonText className="h-4 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    </div>
    <div className="mt-8">
      <SkeletonText className="mb-4 h-8 w-56 rounded-lg" />
      <TableSkeleton rows={rows} columns={4} />
      <div className="mt-4 flex items-center justify-center gap-4">
        <Skeleton className="h-10 w-24 rounded-full" />
        <SkeletonText className="h-4 w-28 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="ambient-gradient-card mb-8 overflow-hidden rounded-3xl border border-accent/35 bg-secondary p-6 sm:p-8">
    <SkeletonText className="h-10 w-44 rounded-xl" />
    <SkeletonText className="mt-3 h-4 w-72 rounded-full" />
    <div className="mt-4 flex flex-wrap gap-2">
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-8 w-32 rounded-full" />
      <Skeleton className="h-8 w-40 rounded-full" />
      <Skeleton className="h-8 w-36 rounded-full" />
    </div>
  </div>
);

export const PreferencesPageSkeleton = () => (
  <div className="mobile-page-enter min-h-screen w-full bg-background">
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <ProfileSkeleton />
      <div className="mobile-card-enter mobile-card-delay-1 ambient-gradient-card rounded-2xl border border-primary/10 bg-secondary p-5 shadow-sm sm:p-6">
        <div className="mb-6 rounded-xl border border-primary/10 bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SkeletonText className="h-6 w-52 rounded-lg" />
              <SkeletonText className="mt-2 h-4 w-64 rounded-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-primary/10 bg-background p-4">
          <SkeletonText className="h-6 w-36 rounded-lg" />
          <SkeletonText className="mt-2 h-4 w-64 rounded-full" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <SkeletonText className="mt-4 h-9 w-full rounded-xl" />
          <Skeleton className="mt-3 h-14 w-full rounded-xl" />
          <Skeleton className="mt-2 h-14 w-full rounded-xl" />
          <Skeleton className="mt-2 h-14 w-full rounded-xl" />
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-10 w-20 rounded-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2 w-6 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <Skeleton className="h-10 w-20 rounded-full" />
          </div>
        </div>

        <div className="rounded-xl border border-primary/10 bg-background p-4">
          <SkeletonText className="h-6 w-44 rounded-lg" />
          <SkeletonText className="mt-2 h-4 w-72 rounded-full" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-20 rounded-lg" />
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-primary/10 bg-secondary px-3 py-2.5"
              >
                <SkeletonText className="h-5 w-32 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const AuthPageSkeleton = ({
  variant = "login",
}: {
  variant?: "login" | "register";
}) => (
  <div className="mobile-page-enter min-h-screen w-full bg-background p-4 sm:p-6 lg:p-8">
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col items-center justify-center sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
      <SkeletonText className="h-8 w-40 rounded-xl" />
      <SkeletonText className="mt-3 h-4 w-64 rounded-full" />

      <div className="mt-8 w-full rounded-2xl border border-primary/10 bg-secondary p-8 shadow-lg">
        <Skeleton className="mb-6 h-10 w-full rounded-lg" />
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-primary/10" />
          <SkeletonText className="h-4 w-8 rounded-full" />
          <div className="h-px flex-1 bg-primary/10" />
        </div>
        <div className="space-y-4">
          <div>
            <SkeletonText className="mb-1.5 h-4 w-16 rounded-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div>
            <SkeletonText className="mb-1.5 h-4 w-20 rounded-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          {variant === "register" && (
            <div>
              <SkeletonText className="mb-1.5 h-4 w-28 rounded-full" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          )}
          <Skeleton className="h-12 w-40 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

export const PageLayoutSkeleton = () => (
  <div className="min-h-screen w-full bg-background">
    <div className="mx-auto flex max-w-4xl flex-col space-y-6 p-4 md:p-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  </div>
);
