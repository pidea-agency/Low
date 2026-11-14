
import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { ChevronDown } from 'lucide-react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(
      'relative z-10 flex max-w-max items-center justify-center',
      className
    )}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
));

NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-1 list-none',
      className
    )}
    {...props}
  />
));

NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'h-9 px-3 rounded-lg',
    'text-sm font-medium',
    'text-slate-600 dark:text-slate-300',
    'bg-transparent',
    'transition-colors duration-150',
    'hover:bg-slate-100 hover:text-slate-900',
    'dark:hover:bg-white/[0.06] dark:hover:text-white',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[#C49A45]/40',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=open]:bg-slate-100',
    'data-[state=open]:text-slate-900',
    'dark:data-[state=open]:bg-white/[0.06]',
    'dark:data-[state=open]:text-white',
  ].join(' ')
);

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      navigationMenuTriggerStyle(),
      'group',
      className
    )}
    {...props}
  >
    {children}

    <ChevronDown
      className="
        w-3.5 h-3.5 shrink-0
        text-slate-400
        transition-transform duration-200
        group-data-[state=open]:rotate-180
      "
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
));

NavigationMenuTrigger.displayName =
  NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      `
        left-0 top-0 w-full
        md:absolute md:w-auto
        overflow-hidden
        rounded-xl
        border border-slate-200
        bg-white
        text-slate-800
        shadow-lg shadow-slate-900/[0.04]
        dark:border-white/[0.08]
        dark:bg-[#192D42]
        dark:text-slate-100
        data-[motion^=from-]:animate-in
        data-[motion^=to-]:animate-out
        data-[motion^=from-]:fade-in
        data-[motion^=to-]:fade-out
      `,
      className
    )}
    {...props}
  />
));

NavigationMenuContent.displayName =
  NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className="absolute left-0 top-full flex justify-center">
    <NavigationMenuPrimitive.Viewport
      ref={ref}
      className={cn(
        `
          relative mt-2
          h-[var(--radix-navigation-menu-viewport-height)]
          w-full md:w-[var(--radix-navigation-menu-viewport-width)]
          overflow-hidden
          rounded-xl
          border border-slate-200
          bg-white
          shadow-lg shadow-slate-900/[0.05]
          dark:border-white/[0.08]
          dark:bg-[#192D42]
          data-[state=open]:animate-in
          data-[state=closed]:animate-out
          data-[state=closed]:zoom-out-95
          data-[state=open]:zoom-in-95
        `,
        className
      )}
      {...props}
    />
  </div>
));

NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      `
        top-full z-[1]
        flex h-1.5 items-end justify-center
        overflow-hidden
        data-[state=visible]:animate-in
        data-[state=hidden]:animate-out
        data-[state=hidden]:fade-out
        data-[state=visible]:fade-in
      `,
      className
    )}
    {...props}
  >
    <div className="
      relative top-[60%]
      h-2 w-2 rotate-45
      rounded-tl-sm
      bg-slate-200
      dark:bg-slate-700
    " />
  </NavigationMenuPrimitive.Indicator>
));

NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName;

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
};
