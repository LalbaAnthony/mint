const appleDevices = [
  [1024, 1366, 2],
  [834, 1194, 2],
  [834, 1112, 2],
  [820, 1180, 2],
  [810, 1080, 2],
  [768, 1024, 2],
  [744, 1133, 2],
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [420, 912, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [375, 667, 2],
  [320, 568, 2],
] as const

const orientations = ['portrait', 'landscape'] as const

export function appleSplashScreenLinks(scheme: 'light' | 'dark') {
  const colorScheme =
    scheme === 'dark' ? '(prefers-color-scheme: dark) and ' : ''
  return appleDevices.flatMap(([width, height, ratio]) =>
    orientations.map((orientation) => {
      const [pixelWidth, pixelHeight] =
        orientation === 'portrait'
          ? [width * ratio, height * ratio]
          : [height * ratio, width * ratio]
      return {
        rel: 'apple-touch-startup-image' as const,
        media: `screen and ${colorScheme}(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
        href: `/apple-splash-${orientation}-${scheme}-${pixelWidth}x${pixelHeight}.png`,
      }
    }),
  )
}
