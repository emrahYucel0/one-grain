# One Grain — reference v27 (skies, loupe, light pattern)

`v27-skies.html` is a prototype built on v23 (it predates the port's later fixes:
new first screen, pink fix, safe area, phone opening, copy corrections). Port only
the three features below; everything else in the port stays as it is.

1. Skies — only while the grain is at the surface: river (soft morning), coast
   (sunset), desert (sunny, drifting clouds), again (darkening as it is buried).
   Magma, granite, industry and now keep their dark stages. A ground band below
   each sky's horizon; distant grains fog into the horizon colour; coast, river and
   desert light rigs adjusted to match their skies.
2. The loupe — a magnified view of the hero grain, only at granite, coast, quarry,
   wafer and display, morphing between chapters.
3. The light chapter's pattern — a circuit pattern exposed onto the layer.

See the SKY table, the LOUPE module, the uPatC block in the grain vertex shader and
the RIG changes for coast, river and desert.
