---
type: community
members: 9
---

# N-Body WebGPU Solver

**Members:** 9 nodes

## Members
- [[Bodies]] - code - src/experiments/n-body/types.ts
- [[GpuSolver]] - code - src/experiments/n-body/gpu/solver.ts
- [[PresetDef]] - code - src/experiments/n-body/presets.ts
- [[PresetId]] - code - src/experiments/n-body/types.ts
- [[StagingSlot]] - code - src/experiments/n-body/gpu/solver.ts
- [[adapterInfo()]] - code - src/experiments/n-body/gpu/solver.ts
- [[createGpuSolver()]] - code - src/experiments/n-body/gpu/solver.ts
- [[nbody.wgsl.ts]] - code - src/experiments/n-body/gpu/nbody.wgsl.ts
- [[solver.ts]] - code - src/experiments/n-body/gpu/solver.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/N-Body_WebGPU_Solver
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_N-Body WebGL Renderer]]
- 4 edges to [[_COMMUNITY_N-Body Controls & UI]]
- 3 edges to [[_COMMUNITY_N-Body Scene Presets]]
- 2 edges to [[_COMMUNITY_N-Body Physics (Barnes-Hut)]]

## Top bridge nodes
- [[Bodies]] - degree 7, connects to 4 communities
- [[solver.ts]] - degree 8, connects to 2 communities
- [[PresetDef]] - degree 4, connects to 2 communities
- [[PresetId]] - degree 3, connects to 2 communities
- [[GpuSolver]] - degree 2, connects to 1 community