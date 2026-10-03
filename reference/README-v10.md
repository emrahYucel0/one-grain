# One Grain — reference v10 (lit)

`v10-lit.html` is the reference for Phase 4a: the full scroll experience with lit grains
(per-world surface normals and light rigs), emission, a point-sprite shadow map, an HDR
target, bloom, half-resolution depth of field, a shoulder-only tone curve, vignette and
film grain, and the final pixel → grain morph. Dark-only by design.

The panel (bottom right) toggles each layer; "Benchmark" measures the median frame time
of eight configurations at the current chapter.

Measured on the target laptop (1920×909, DPR 1, chip chapter, no screen recording):
all on 20.9 ms · no shadows 19.2 · no DOF 19.4 · no bloom 20.4 · no grade 21.0 ·
no light 19.4 · all off 16.9 · unlit, no HDR/post 17.4.
