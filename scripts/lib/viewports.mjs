// The responsive matrix's viewports (npm run responsive, npm run check:responsive).
export const VIEWPORTS = [
  // phones: touch, mobile, DPR 3
  { name: 'phone-360x800', width: 360, height: 800, dpr: 3, touch: true, mobile: true },
  { name: 'phone-375x667', width: 375, height: 667, dpr: 3, touch: true, mobile: true },
  { name: 'phone-390x844', width: 390, height: 844, dpr: 3, touch: true, mobile: true },
  { name: 'phone-430x932', width: 430, height: 932, dpr: 3, touch: true, mobile: true },
  { name: 'phone-844x390-landscape', width: 844, height: 390, dpr: 3, touch: true, mobile: true },
  // tablets: touch, DPR 2
  { name: 'tablet-744x1133', width: 744, height: 1133, dpr: 2, touch: true, mobile: false },
  { name: 'tablet-820x1180', width: 820, height: 1180, dpr: 2, touch: true, mobile: false },
  { name: 'tablet-1180x820', width: 1180, height: 820, dpr: 2, touch: true, mobile: false },
  { name: 'tablet-1024x1366', width: 1024, height: 1366, dpr: 2, touch: true, mobile: false },
  // desktops: the MacBook sizes at DPR 2, the rest at 1
  { name: 'desktop-1512x982', width: 1512, height: 982, dpr: 2, touch: false, mobile: false },
  { name: 'desktop-1728x1117', width: 1728, height: 1117, dpr: 2, touch: false, mobile: false },
  { name: 'desktop-1920x1080', width: 1920, height: 1080, dpr: 1, touch: false, mobile: false },
  { name: 'desktop-2560x1080-21x9', width: 2560, height: 1080, dpr: 1, touch: false, mobile: false },
  { name: 'desktop-3440x1440-21x9', width: 3440, height: 1440, dpr: 1, touch: false, mobile: false },
];
