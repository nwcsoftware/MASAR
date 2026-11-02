import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * Slide-over panel. docs/DESIGN.md §2.5 — panels slide from the inline-end
 * side: right in LTR, left in RTL. `bottom` is the driver PWA action sheet.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 flex flex-col bg-surface shadow-lg transition ease-ease data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-base data-[state=open]:duration-slow',
  {
    variants: {
      side: {
        end: 'inset-y-0 end-0 h-full w-full max-w-xl border-s border-border ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left',
        start:
          'inset-y-0 start-0 h-full w-72 border-e border-border ltr:data-[state=closed]:slide-out-to-left ltr:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right',
        bottom:
          'inset-x-0 bottom-0 max-h-[92vh] rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      },
    },
    defaultVariants: { side: 'end' },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideClose?: boolean;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = 'end', className, children, hideClose, ...props }, ref) => {
    const { t } = useTranslation();
    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
          {children}
          {!hideClose && (
            <SheetPrimitive.Close
              className="absolute end-4 top-4 grid size-8 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label={t('common.close')}
            >
              <X className="size-4" />
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pe-14 text-start', className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col gap-2 p-5', className)} {...props} />;
}

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn('text-lg font-bold text-fg', className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-fg-2', className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
