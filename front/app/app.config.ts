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
  },
})
