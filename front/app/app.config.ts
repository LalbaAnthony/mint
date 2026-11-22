export default defineAppConfig({
  ui: {
    colors: {
      primary: 'mint',
      secondary: 'coral',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
      neutral: 'olive',
    },
    button: {
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class:
            'hover:bg-(--app-primary-hover) active:bg-(--app-primary-hover)',
        },
      ],
    },
    badge: {
      compoundVariants: [
        {
          color: 'secondary',
          variant: 'solid',
          class: 'text-(--app-accent-on-fill)',
        },
      ],
    },
    modal: {
      variants: {
        fullscreen: {
          true: {
            content:
              'bottom-auto top-(--app-visible-top) h-(--app-visible-height)',
          },
        },
      },
      compoundVariants: [
        {
          scrollable: false,
          fullscreen: false,
          class: {
            content:
              'top-[calc(var(--app-visible-top)_+_var(--app-visible-height)_/_2)] max-h-[calc(var(--app-visible-height)_-_2rem)] sm:max-h-[calc(var(--app-visible-height)_-_4rem)]',
          },
        },
      ],
    },
  },
})
